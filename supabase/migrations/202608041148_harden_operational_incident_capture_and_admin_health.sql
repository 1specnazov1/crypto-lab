create table if not exists public.crypto_operational_cursors(
  source_type text not null check(source_type in('cron')),
  source_name text not null,
  last_observation_id bigint not null default 0 check(last_observation_id>=0),
  updated_at timestamptz not null default now(),
  primary key(source_type,source_name)
);

alter table public.crypto_operational_cursors enable row level security;
revoke all on table public.crypto_operational_cursors from public,anon,authenticated;
grant select,insert,update,delete on table public.crypto_operational_cursors to service_role;

insert into public.crypto_operational_cursors(source_type,source_name,last_observation_id)
select 'cron',j.jobname,coalesce(max(d.runid),0)
from cron.job j
left join cron.job_run_details d on d.jobid=j.jobid and d.status in('succeeded','failed')
where j.jobname in(
  'crypto-signal-monitor-every-minute','crypto-market-scanner-every-15-minutes',
  'crypto-lab-daily-maintenance','crypto-lab-subscription-lifecycle',
  'crypto-lab-billing-event-retry','crypto-lab-billing-reconciliation',
  'crypto-lab-incident-reconciliation'
)
group by j.jobname
on conflict(source_type,source_name) do nothing;

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
  v_fingerprint text;
  v_observation text;
  v_opened integer:=0;
  v_resolved integer:=0;
  v_http_processed integer:=0;
  v_cron_processed integer:=0;
begin
  for v_edge in
    select q.request_id,q.source_name,q.requested_at,r.status_code,r.timed_out,r.error_msg,r.content
    from public.crypto_operational_http_requests q
    left join net._http_response r on r.id=q.request_id
    where q.processed_at is null
      and (r.id is not null or q.requested_at<now()-interval '2 minutes')
    order by q.requested_at
    limit 500
  loop
    v_fingerprint:='edge:'||v_edge.source_name;
    v_observation:=v_edge.request_id::text;
    v_failed:=v_edge.status_code is null
      or coalesce(v_edge.timed_out,false)
      or v_edge.error_msg is not null
      or v_edge.status_code<200
      or v_edge.status_code>=300
      or coalesce(v_edge.content,'') like '%"success":false%';

    if v_failed then
      insert into public.crypto_operational_incidents(
        fingerprint,source_type,source_name,status,severity,first_seen_at,last_seen_at,occurrences,
        last_observation_id,last_status_code,last_error,resolved_at,resolution_note
      ) values (
        v_fingerprint,'edge',v_edge.source_name,'open','high',v_edge.requested_at,now(),1,
        v_observation,v_edge.status_code,
        case
          when v_edge.status_code is null then 'No HTTP response within two minutes'
          when coalesce(v_edge.timed_out,false) then 'HTTP request timed out'
          when v_edge.error_msg is not null then 'HTTP transport error'
          when v_edge.status_code<200 or v_edge.status_code>=300 then 'HTTP status '||v_edge.status_code::text
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

    update public.crypto_operational_http_requests set processed_at=now() where request_id=v_edge.request_id;
    v_http_processed:=v_http_processed+1;
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

  delete from public.crypto_operational_http_requests where processed_at<now()-interval '30 days';
  delete from public.crypto_operational_incidents where status='resolved' and resolved_at<now()-interval '180 days';

  return jsonb_build_object(
    'success',true,
    'http_requests_processed',v_http_processed,
    'cron_runs_processed',v_cron_processed,
    'incidents_opened_or_updated',v_opened,
    'incidents_resolved',v_resolved,
    'open_incidents',(select count(*) from public.crypto_operational_incidents where status='open'),
    'resolved_incidents',(select count(*) from public.crypto_operational_incidents where status='resolved')
  );
end;
$$;

create or replace function private.get_crypto_admin_incident_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare v_result jsonb;
begin
  if not public.crypto_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'generated_at',now(),
    'open',(select count(*) from public.crypto_operational_incidents where status='open'),
    'resolved_24h',(select count(*) from public.crypto_operational_incidents where status='resolved' and resolved_at>=now()-interval '24 hours'),
    'oldest_open_minutes',(select round(extract(epoch from(now()-min(first_seen_at)))/60.0,1) from public.crypto_operational_incidents where status='open'),
    'pending_http_requests',(select count(*) from public.crypto_operational_http_requests where processed_at is null),
    'recent',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',x.id,'source_type',x.source_type,'source_name',x.source_name,'status',x.status,
        'severity',x.severity,'first_seen_at',x.first_seen_at,'last_seen_at',x.last_seen_at,
        'occurrences',x.occurrences,'last_status_code',x.last_status_code,
        'last_error',left(coalesce(x.last_error,''),160),'resolved_at',x.resolved_at,
        'resolution_note',left(coalesce(x.resolution_note,''),160)
      ) order by x.last_seen_at desc)
      from (
        select id,source_type,source_name,status,severity,first_seen_at,last_seen_at,occurrences,
               last_status_code,last_error,resolved_at,resolution_note
        from public.crypto_operational_incidents
        order by last_seen_at desc
        limit 20
      ) x
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_crypto_admin_incident_health()
returns jsonb
language sql
stable
security invoker
set search_path to 'public','private','pg_temp'
as $$ select private.get_crypto_admin_incident_health() $$;

revoke all on function private.reconcile_crypto_operational_incidents() from public,anon,authenticated;
revoke all on function private.get_crypto_admin_incident_health() from public,anon;
revoke all on function public.get_crypto_admin_incident_health() from public,anon;
grant execute on function private.reconcile_crypto_operational_incidents() to service_role;
grant execute on function private.get_crypto_admin_incident_health() to authenticated,service_role;
grant execute on function public.get_crypto_admin_incident_health() to authenticated,service_role;
