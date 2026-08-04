create or replace function private.capture_crypto_edge_observation()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
begin
  if new.processed_at is null or new.success is null then
    return new;
  end if;

  insert into public.crypto_operational_observations(
    source_type,source_name,observation_id,observed_at,success,duration_ms,status_code
  ) values (
    'edge',new.source_name,new.request_id::text,new.requested_at,new.success,new.duration_ms,new.status_code
  )
  on conflict(source_type,source_name,observation_id) do update set
    observed_at=excluded.observed_at,
    success=excluded.success,
    duration_ms=excluded.duration_ms,
    status_code=excluded.status_code;

  return new;
end;
$$;

revoke all on function private.capture_crypto_edge_observation() from public,anon,authenticated;
grant execute on function private.capture_crypto_edge_observation() to service_role;

drop trigger if exists crypto_operational_edge_observation_capture on public.crypto_operational_http_requests;
create trigger crypto_operational_edge_observation_capture
after insert or update on public.crypto_operational_http_requests
for each row execute function private.capture_crypto_edge_observation();

create or replace function private.capture_crypto_cron_observation()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','cron','pg_temp'
as $$
declare
  v_previous bigint := -1;
  v_status text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if new.source_type<>'cron' then
    return new;
  end if;

  if tg_op='UPDATE' then
    v_previous:=old.last_observation_id;
  end if;

  if new.last_observation_id<=v_previous then
    return new;
  end if;

  select d.status,d.start_time,d.end_time
  into v_status,v_start,v_end
  from cron.job j
  join cron.job_run_details d on d.jobid=j.jobid
  where j.jobname=new.source_name
    and d.runid=new.last_observation_id
    and d.status in('succeeded','failed')
    and d.start_time is not null
  limit 1;

  if not found then
    return new;
  end if;

  insert into public.crypto_operational_observations(
    source_type,source_name,observation_id,observed_at,success,duration_ms,status_code
  ) values (
    'cron',new.source_name,new.last_observation_id::text,v_start,v_status='succeeded',
    case when v_end is null then null else greatest(0,floor(extract(epoch from(v_end-v_start))*1000)::bigint) end,
    null
  )
  on conflict(source_type,source_name,observation_id) do update set
    observed_at=excluded.observed_at,
    success=excluded.success,
    duration_ms=excluded.duration_ms;

  return new;
end;
$$;

revoke all on function private.capture_crypto_cron_observation() from public,anon,authenticated;
grant execute on function private.capture_crypto_cron_observation() to service_role;

drop trigger if exists crypto_operational_cron_observation_capture on public.crypto_operational_cursors;
create trigger crypto_operational_cron_observation_capture
after insert or update of last_observation_id on public.crypto_operational_cursors
for each row execute function private.capture_crypto_cron_observation();

insert into public.crypto_operational_observations(
  source_type,source_name,observation_id,observed_at,success,duration_ms,status_code
)
select 'edge',q.source_name,q.request_id::text,q.requested_at,q.success,q.duration_ms,q.status_code
from public.crypto_operational_http_requests q
where q.processed_at is not null and q.success is not null and q.requested_at>=now()-interval '90 days'
on conflict(source_type,source_name,observation_id) do update set
  observed_at=excluded.observed_at,
  success=excluded.success,
  duration_ms=excluded.duration_ms,
  status_code=excluded.status_code;

insert into public.crypto_operational_observations(
  source_type,source_name,observation_id,observed_at,success,duration_ms,status_code
)
select 'cron',j.jobname,d.runid::text,d.start_time,d.status='succeeded',
  case when d.end_time is null then null else greatest(0,floor(extract(epoch from(d.end_time-d.start_time))*1000)::bigint) end,
  null
from cron.job j
join cron.job_run_details d on d.jobid=j.jobid
where d.status in('succeeded','failed') and d.start_time is not null
  and d.start_time>=now()-interval '90 days'
  and j.jobname in(
    'crypto-signal-monitor-every-minute','crypto-market-scanner-every-15-minutes',
    'crypto-lab-daily-maintenance','crypto-lab-subscription-lifecycle',
    'crypto-lab-billing-event-retry','crypto-lab-billing-reconciliation',
    'crypto-lab-incident-reconciliation'
  )
on conflict(source_type,source_name,observation_id) do update set
  observed_at=excluded.observed_at,
  success=excluded.success,
  duration_ms=excluded.duration_ms;

create or replace function private.get_crypto_admin_operational_incidents()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_result jsonb;
begin
  if not public.crypto_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'generated_at',now(),
    'counts',jsonb_build_object(
      'open',count(*) filter(where status='open'),
      'resolved',count(*) filter(where status='resolved'),
      'edge_open',count(*) filter(where status='open' and source_type='edge'),
      'cron_open',count(*) filter(where status='open' and source_type='cron'),
      'critical_open',count(*) filter(where status='open' and severity='critical')
    ),
    'oldest_open_minutes',round(extract(epoch from(now()-min(first_seen_at) filter(where status='open')))/60.0,1),
    'recent',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,
        'fingerprint',left(i.fingerprint,160),
        'source_type',i.source_type,
        'source_name',left(i.source_name,120),
        'status',i.status,
        'severity',i.severity,
        'first_seen_at',i.first_seen_at,
        'last_seen_at',i.last_seen_at,
        'occurrences',i.occurrences,
        'last_status_code',i.last_status_code,
        'last_error',left(regexp_replace(coalesce(i.last_error,''),'[[:cntrl:]]+',' ','g'),240),
        'resolved_at',i.resolved_at,
        'resolution_note',left(regexp_replace(coalesce(i.resolution_note,''),'[[:cntrl:]]+',' ','g'),240)
      ) order by case when i.status='open' then 0 else 1 end,i.last_seen_at desc)
      from (
        select * from public.crypto_operational_incidents
        order by case when status='open' then 0 else 1 end,last_seen_at desc
        limit 50
      ) i
    ),'[]'::jsonb)
  ) into v_result
  from public.crypto_operational_incidents;

  return v_result;
end;
$$;

revoke all on function private.get_crypto_admin_operational_incidents() from public,anon;
grant execute on function private.get_crypto_admin_operational_incidents() to authenticated,service_role;

drop function if exists private.get_crypto_operational_slo_snapshot();

notify pgrst,'reload schema';