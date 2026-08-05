create or replace function private.crypto_daily_maintenance_cron_binding_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'cron','pg_catalog','pg_temp'
as $$
declare
  v_expected_command constant text := 'select private.cron_run_crypto_lab_daily_maintenance();';
  v_expected_schedule constant text := '17 3 * * *';
  v_expected_username constant text := 'postgres';
  v_count integer;
  v_job jsonb;
begin
  select count(*)::integer,
         coalesce(jsonb_agg(jsonb_build_object(
           'jobid',j.jobid,
           'jobname',j.jobname,
           'schedule',j.schedule,
           'command',j.command,
           'username',j.username,
           'active',j.active
         ) order by j.jobid),'[]'::jsonb)
  into v_count,v_job
  from cron.job j
  where j.jobid=5
    and j.jobname='crypto-lab-daily-maintenance';

  return jsonb_build_object(
    'state',case
      when v_count=1
       and exists(
         select 1 from cron.job j
         where j.jobid=5
           and j.jobname='crypto-lab-daily-maintenance'
           and j.schedule=v_expected_schedule
           and j.command=v_expected_command
           and j.username=v_expected_username
           and j.active
       ) then 'healthy'
      else 'critical'
    end,
    'job_id',5,
    'matched_jobs',v_count,
    'expected_schedule',v_expected_schedule,
    'expected_command',v_expected_command,
    'expected_username',v_expected_username,
    'observed',v_job
  );
end;
$$;

revoke all on function private.crypto_daily_maintenance_cron_binding_snapshot()
  from public,anon,authenticated,service_role;
grant execute on function private.crypto_daily_maintenance_cron_binding_snapshot()
  to postgres;

create or replace function private.cron_run_crypto_lab_daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare
  v_binding jsonb;
  v_result jsonb;
  v_run public.crypto_maintenance_runs%rowtype;
begin
  v_binding:=private.crypto_daily_maintenance_cron_binding_snapshot();
  if coalesce(v_binding->>'state','critical')<>'healthy' then
    raise exception 'CRYPTO LAB daily maintenance cron binding mismatch'
      using errcode='55000';
  end if;

  v_result:=public.run_crypto_maintenance();
  if not coalesce((v_result->>'success')::boolean,false) then
    raise exception 'CRYPTO LAB daily maintenance failed: %',left(v_result::text,1000)
      using errcode='55000';
  end if;

  if coalesce(v_result->>'run_id','') !~ '^[0-9]+$' then
    raise exception 'CRYPTO LAB daily maintenance returned invalid run id'
      using errcode='22023';
  end if;

  select * into v_run
  from public.crypto_maintenance_runs
  where id=(v_result->>'run_id')::bigint;

  if v_run.id is null
     or v_run.status<>'completed'
     or v_run.completed_at is null
     or v_run.error_message is not null then
    raise exception 'CRYPTO LAB daily maintenance persistence verification failed'
      using errcode='55000';
  end if;

  return v_result||jsonb_build_object(
    'cron_verified',true,
    'persisted_status',v_run.status,
    'persisted_started_at',v_run.started_at,
    'persisted_completed_at',v_run.completed_at
  );
end;
$$;

revoke all on function private.cron_run_crypto_lab_daily_maintenance()
  from public,anon,authenticated,service_role;
grant execute on function private.cron_run_crypto_lab_daily_maintenance()
  to postgres;

select cron.alter_job(
  job_id := 5,
  schedule := '17 3 * * *',
  command := 'select private.cron_run_crypto_lab_daily_maintenance();',
  active := true
);
