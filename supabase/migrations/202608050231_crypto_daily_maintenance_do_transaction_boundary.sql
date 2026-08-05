drop procedure if exists private.cron_run_crypto_lab_daily_maintenance();

create or replace function private.crypto_daily_maintenance_cron_command()
returns text
language sql
immutable
set search_path to 'pg_catalog','pg_temp'
as $$
  select $command$do $maintenance$
declare
  v_binding jsonb;
  v_result jsonb;
  v_run public.crypto_maintenance_runs%rowtype;
  v_success boolean:=false;
begin
  perform pg_catalog.set_config('search_path','pg_catalog,public,private,pg_temp',true);

  if session_user<>'postgres' or current_user<>'postgres' then
    raise exception 'CRYPTO LAB daily maintenance requires postgres cron owner'
      using errcode='42501';
  end if;

  v_binding:=private.crypto_daily_maintenance_cron_binding_snapshot();
  if coalesce(v_binding->>'state','critical')<>'healthy' then
    raise exception 'CRYPTO LAB daily maintenance cron binding mismatch'
      using errcode='55000';
  end if;

  v_result:=public.run_crypto_maintenance();
  v_success:=coalesce((v_result->>'success')::boolean,false);

  if not v_success and coalesce(v_result->>'reason','')='maintenance_already_running' then
    raise exception 'CRYPTO LAB daily maintenance concurrent invocation rejected'
      using errcode='55000';
  end if;

  if coalesce(v_result->>'run_id','') !~ '^[0-9]+$' then
    raise exception 'CRYPTO LAB daily maintenance returned invalid run id: %',left(v_result::text,1000)
      using errcode='22023';
  end if;

  select * into v_run
  from public.crypto_maintenance_runs
  where id=(v_result->>'run_id')::bigint;

  if not v_success then
    if v_run.id is null
       or v_run.status<>'failed'
       or v_run.completed_at is null
       or v_run.error_message is null then
      raise exception 'CRYPTO LAB failed maintenance persistence verification failed: %',left(v_result::text,1000)
        using errcode='55000';
    end if;

    commit;

    raise exception 'CRYPTO LAB daily maintenance failed and failure evidence was committed: run_id=% error=%',
      v_run.id,left(coalesce(v_run.error_message,v_result->>'error','unknown'),500)
      using errcode='55000';
  end if;

  if v_run.id is null
     or v_run.status<>'completed'
     or v_run.completed_at is null
     or v_run.error_message is not null then
    raise exception 'CRYPTO LAB daily maintenance success persistence verification failed'
      using errcode='55000';
  end if;

  commit;
end
$maintenance$;$command$::text
$$;

revoke all on function private.crypto_daily_maintenance_cron_command() from public,anon,authenticated,service_role;
grant execute on function private.crypto_daily_maintenance_cron_command() to postgres;

create or replace function private.crypto_daily_maintenance_cron_binding_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'cron','private','pg_catalog','pg_temp'
as $$
declare
  v_expected_command text:=private.crypto_daily_maintenance_cron_command();
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
    'failure_evidence_commit_boundary',true,
    'transaction_control_surface','top_level_do',
    'observed',v_job
  );
end;
$$;

select cron.alter_job(
  5,
  command := private.crypto_daily_maintenance_cron_command()
);