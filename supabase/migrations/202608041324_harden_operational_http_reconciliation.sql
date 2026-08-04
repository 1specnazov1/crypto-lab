alter table public.crypto_operational_http_requests
  add column if not exists corrected_at timestamptz,
  add column if not exists correction_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='crypto_operational_http_error_class_chk'
      and conrelid='public.crypto_operational_http_requests'::regclass
  ) then
    alter table public.crypto_operational_http_requests
      add constraint crypto_operational_http_error_class_chk
      check(error_class is null or error_class in('none','timeout','transport','no_response','http_status','application_failure')) not valid;
  end if;
end;
$$;

alter table public.crypto_operational_http_requests
  validate constraint crypto_operational_http_error_class_chk;

create or replace function private.crypto_operational_content_failed(p_content text)
returns boolean
language plpgsql
immutable
set search_path to 'pg_catalog','pg_temp'
as $$
declare
  v_payload jsonb;
begin
  if nullif(btrim(p_content),'') is null then
    return false;
  end if;

  begin
    v_payload:=p_content::jsonb;
    if jsonb_typeof(v_payload)='object' and v_payload ? 'success' then
      return lower(coalesce(v_payload->>'success',''))='false';
    end if;
  exception when others then
    null;
  end;

  return p_content ~* '"success"[[:space:]]*:[[:space:]]*false';
end;
$$;

revoke all on function private.crypto_operational_content_failed(text) from public,anon,authenticated;
grant execute on function private.crypto_operational_content_failed(text) to service_role;

create or replace function private.track_crypto_operational_http_request(p_source_name text,p_request_id bigint)
returns bigint
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_existing_source text;
begin
  if p_source_name not in('crypto-signal-monitor','crypto-market-scanner') then
    raise exception 'Unsupported operational source' using errcode='22023';
  end if;
  if p_request_id is null then
    raise exception 'Request id is required' using errcode='22023';
  end if;

  insert into public.crypto_operational_http_requests(request_id,source_name)
  values(p_request_id,p_source_name)
  on conflict(request_id) do nothing;

  select source_name into v_existing_source
  from public.crypto_operational_http_requests
  where request_id=p_request_id
  for update;

  if v_existing_source is null then
    raise exception 'Operational request tracking failed' using errcode='55000';
  end if;
  if v_existing_source<>p_source_name then
    raise exception 'Operational request id is already tracked for a different source' using errcode='23514';
  end if;

  return p_request_id;
end;
$$;

revoke all on function private.track_crypto_operational_http_request(text,bigint) from public,anon,authenticated;
grant execute on function private.track_crypto_operational_http_request(text,bigint) to service_role;

create or replace function private.reconcile_crypto_operational_incidents()
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','cron','net','pg_temp'
as $$
declare
  v_edge record;
  v_cron record;
  v_failed boolean;
  v_content_failed boolean;
  v_fingerprint text;
  v_observation text;
  v_error_class text;
  v_completed_at timestamptz;
  v_duration_ms bigint;
  v_stale_after interval;
  v_claimed integer;
  v_opened integer:=0;
  v_resolved integer:=0;
  v_http_processed integer:=0;
  v_http_late_corrected integer:=0;
  v_cron_processed integer:=0;
begin
  perform pg_advisory_xact_lock(hashtext('crypto_operational_incident_reconcile'));

  for v_edge in
    select q.request_id,q.source_name,q.requested_at,r.status_code,r.timed_out,r.error_msg,r.content,r.created
    from public.crypto_operational_http_requests q
    left join net._http_response r on r.id=q.request_id
    where q.processed_at is null
      and (
        r.id is not null
        or q.requested_at<now()-case when q.source_name='crypto-market-scanner' then interval '3 minutes' else interval '2 minutes' end
      )
    order by q.requested_at,q.request_id
    limit 500
    for update of q skip locked
  loop
    v_stale_after:=case when v_edge.source_name='crypto-market-scanner' then interval '3 minutes' else interval '2 minutes' end;
    v_fingerprint:='edge:'||v_edge.source_name;
    v_observation:=v_edge.request_id::text;
    v_completed_at:=coalesce(v_edge.created,v_edge.requested_at+v_stale_after);
    v_duration_ms:=greatest(0,floor(extract(epoch from(v_completed_at-v_edge.requested_at))*1000)::bigint);
    v_content_failed:=private.crypto_operational_content_failed(v_edge.content);
    v_failed:=coalesce(v_edge.timed_out,false)
      or v_edge.error_msg is not null
      or v_edge.status_code is null
      or v_edge.status_code<200
      or v_edge.status_code>=300
      or v_content_failed;
    v_error_class:=case
      when coalesce(v_edge.timed_out,false) then 'timeout'
      when v_edge.error_msg is not null then 'transport'
      when v_edge.status_code is null then 'no_response'
      when v_edge.status_code<200 or v_edge.status_code>=300 then 'http_status'
      when v_content_failed then 'application_failure'
      else 'none'
    end;

    update public.crypto_operational_http_requests
    set processed_at=now(),completed_at=v_completed_at,status_code=v_edge.status_code,
        duration_ms=v_duration_ms,success=not v_failed,error_class=v_error_class
    where request_id=v_edge.request_id and processed_at is null;
    get diagnostics v_claimed=row_count;
    if v_claimed=0 then
      continue;
    end if;

    if v_failed then
      insert into public.crypto_operational_incidents(
        fingerprint,source_type,source_name,status,severity,first_seen_at,last_seen_at,occurrences,
        last_observation_id,last_status_code,last_error,resolved_at,resolution_note
      ) values (
        v_fingerprint,'edge',v_edge.source_name,'open','high',v_edge.requested_at,now(),1,
        v_observation,v_edge.status_code,
        case
          when v_error_class='timeout' then 'HTTP request timed out'
          when v_error_class='transport' then 'HTTP transport error'
          when v_error_class='no_response' then 'No terminal HTTP response after bounded grace period'
          when v_error_class='http_status' then 'HTTP status '||v_edge.status_code::text
          else 'Edge Function returned success=false'
        end,
        null,null
      )
      on conflict(fingerprint) do update set
        status='open',severity='high',
        first_seen_at=case when public.crypto_operational_incidents.status='resolved' then excluded.first_seen_at else public.crypto_operational_incidents.first_seen_at end,
        last_seen_at=excluded.last_seen_at,
        occurrences=case when public.crypto_operational_incidents.status='resolved' then 1 else public.crypto_operational_incidents.occurrences+1 end,
        last_observation_id=excluded.last_observation_id,
        last_status_code=excluded.last_status_code,last_error=excluded.last_error,
        resolved_at=null,resolution_note=null,updated_at=now()
      where public.crypto_operational_incidents.last_observation_id is distinct from excluded.last_observation_id;
      if found then v_opened:=v_opened+1; end if;
    else
      update public.crypto_operational_incidents
      set status='resolved',resolved_at=now(),resolution_note='Recovered on successful Edge response',
          last_observation_id=v_observation,last_status_code=v_edge.status_code,last_error=null,last_seen_at=now(),updated_at=now()
      where fingerprint=v_fingerprint and status='open' and last_observation_id is distinct from v_observation;
      if found then v_resolved:=v_resolved+1; end if;
    end if;

    v_http_processed:=v_http_processed+1;
  end loop;

  for v_edge in
    select q.request_id,q.source_name,q.requested_at,r.status_code,r.timed_out,r.error_msg,r.content,r.created
    from public.crypto_operational_http_requests q
    join net._http_response r on r.id=q.request_id
    where q.processed_at is not null
      and q.error_class='no_response'
      and q.requested_at>=now()-interval '24 hours'
      and (r.status_code is not null or coalesce(r.timed_out,false) or r.error_msg is not null)
    order by q.requested_at,q.request_id
    limit 100
    for update of q skip locked
  loop
    v_fingerprint:='edge:'||v_edge.source_name;
    v_observation:=v_edge.request_id::text;
    v_completed_at:=coalesce(v_edge.created,now());
    v_duration_ms:=greatest(0,floor(extract(epoch from(v_completed_at-v_edge.requested_at))*1000)::bigint);
    v_content_failed:=private.crypto_operational_content_failed(v_edge.content);
    v_failed:=coalesce(v_edge.timed_out,false)
      or v_edge.error_msg is not null
      or v_edge.status_code is null
      or v_edge.status_code<200
      or v_edge.status_code>=300
      or v_content_failed;
    v_error_class:=case
      when coalesce(v_edge.timed_out,false) then 'timeout'
      when v_edge.error_msg is not null then 'transport'
      when v_edge.status_code is null then 'no_response'
      when v_edge.status_code<200 or v_edge.status_code>=300 then 'http_status'
      when v_content_failed then 'application_failure'
      else 'none'
    end;

    update public.crypto_operational_http_requests
    set completed_at=v_completed_at,status_code=v_edge.status_code,duration_ms=v_duration_ms,
        success=not v_failed,error_class=v_error_class,corrected_at=now(),correction_count=correction_count+1
    where request_id=v_edge.request_id and error_class='no_response';
    get diagnostics v_claimed=row_count;
    if v_claimed=0 or v_error_class='no_response' then
      continue;
    end if;

    if v_failed then
      update public.crypto_operational_incidents
      set last_status_code=v_edge.status_code,
          last_error=case
            when v_error_class='timeout' then 'HTTP request timed out'
            when v_error_class='transport' then 'HTTP transport error'
            when v_error_class='http_status' then 'HTTP status '||v_edge.status_code::text
            else 'Edge Function returned success=false'
          end,
          last_seen_at=now(),updated_at=now()
      where fingerprint=v_fingerprint and status='open' and last_observation_id=v_observation;
    else
      update public.crypto_operational_incidents
      set status='resolved',resolved_at=now(),resolution_note='Late HTTP response corrected prior no-response classification',
          last_status_code=v_edge.status_code,last_error=null,last_seen_at=now(),updated_at=now()
      where fingerprint=v_fingerprint and status='open' and last_observation_id=v_observation;
      if found then v_resolved:=v_resolved+1; end if;
    end if;

    v_http_late_corrected:=v_http_late_corrected+1;
  end loop;

  for v_cron in
    select j.jobname,d.runid,d.status,d.start_time,d.end_time,left(coalesce(d.return_message,''),160) as return_message
    from cron.job j
    join public.crypto_operational_cursors c on c.source_type='cron' and c.source_name=j.jobname
    join cron.job_run_details d on d.jobid=j.jobid
      and d.runid>c.last_observation_id
      and d.status in('succeeded','failed')
      and d.start_time is not null
    where j.jobname in(
      'crypto-signal-monitor-every-minute','crypto-market-scanner-every-15-minutes',
      'crypto-lab-daily-maintenance','crypto-lab-subscription-lifecycle',
      'crypto-lab-billing-event-retry','crypto-lab-billing-reconciliation',
      'crypto-lab-incident-reconciliation'
    )
    order by d.runid
    limit 2000
  loop
    v_fingerprint:='cron:'||v_cron.jobname;
    v_observation:=v_cron.runid::text;

    if v_cron.status='failed' then
      insert into public.crypto_operational_incidents(
        fingerprint,source_type,source_name,status,severity,first_seen_at,last_seen_at,occurrences,
        last_observation_id,last_error,resolved_at,resolution_note
      ) values (
        v_fingerprint,'cron',v_cron.jobname,'open','high',v_cron.start_time,now(),1,
        v_observation,left('Cron failed: '||coalesce(nullif(v_cron.return_message,''),'no bounded message'),200),null,null
      )
      on conflict(fingerprint) do update set
        status='open',severity='high',
        first_seen_at=case when public.crypto_operational_incidents.status='resolved' then excluded.first_seen_at else public.crypto_operational_incidents.first_seen_at end,
        last_seen_at=excluded.last_seen_at,
        occurrences=case when public.crypto_operational_incidents.status='resolved' then 1 else public.crypto_operational_incidents.occurrences+1 end,
        last_observation_id=excluded.last_observation_id,last_error=excluded.last_error,
        resolved_at=null,resolution_note=null,updated_at=now()
      where public.crypto_operational_incidents.last_observation_id is distinct from excluded.last_observation_id;
      if found then v_opened:=v_opened+1; end if;
    else
      update public.crypto_operational_incidents
      set status='resolved',resolved_at=now(),resolution_note='Recovered on successful cron execution',
          last_observation_id=v_observation,last_error=null,last_seen_at=now(),updated_at=now()
      where fingerprint=v_fingerprint and status='open' and last_observation_id is distinct from v_observation;
      if found then v_resolved:=v_resolved+1; end if;
    end if;

    insert into public.crypto_operational_cursors(source_type,source_name,last_observation_id,updated_at)
    values('cron',v_cron.jobname,v_cron.runid,now())
    on conflict(source_type,source_name) do update set
      last_observation_id=greatest(public.crypto_operational_cursors.last_observation_id,excluded.last_observation_id),
      updated_at=now();
    v_cron_processed:=v_cron_processed+1;
  end loop;

  return jsonb_build_object(
    'success',true,
    'http_requests_processed',v_http_processed,
    'http_late_responses_corrected',v_http_late_corrected,
    'cron_runs_processed',v_cron_processed,
    'incidents_opened_or_updated',v_opened,
    'incidents_resolved',v_resolved,
    'open_incidents',(select count(*) from public.crypto_operational_incidents where status='open'),
    'resolved_incidents',(select count(*) from public.crypto_operational_incidents where status='resolved')
  );
end;
$$;

revoke all on function private.reconcile_crypto_operational_incidents() from public,anon,authenticated;
grant execute on function private.reconcile_crypto_operational_incidents() to service_role;

notify pgrst,'reload schema';