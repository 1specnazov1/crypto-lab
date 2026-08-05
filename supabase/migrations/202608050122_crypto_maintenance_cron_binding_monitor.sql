create or replace function private.crypto_maintenance_cron_binding_snapshot()
returns jsonb
language sql
stable
security definer
set search_path to 'cron','pg_catalog','pg_temp'
as $$
  select jsonb_build_object(
    'state',case when count(*)=1 then 'healthy' else 'critical' end,
    'job_id',14,
    'expected_schedule','27 * * * *',
    'expected_username','postgres',
    'expected_command','select private.cron_seal_crypto_lab_v79_7930();',
    'matched_jobs',count(*),
    'observed',coalesce(jsonb_agg(jsonb_build_object(
      'jobid',jobid,'jobname',jobname,'schedule',schedule,
      'username',username,'active',active,'command',command
    )) filter(where jobid is not null),'[]'::jsonb)
  )
  from cron.job
  where jobid=14
    and active
    and schedule='27 * * * *'
    and username='postgres'
    and command='select private.cron_seal_crypto_lab_v79_7930();'
$$;

revoke all on function private.crypto_maintenance_cron_binding_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function private.crypto_maintenance_cron_binding_snapshot()
  to postgres;

create or replace function private.cron_seal_crypto_lab_v79_7930()
returns jsonb
language plpgsql
security definer
set search_path to 'private','pg_catalog','pg_temp'
as $$
declare
  v_binding jsonb;
begin
  v_binding:=private.crypto_maintenance_cron_binding_snapshot();
  if coalesce(v_binding->>'state','critical')<>'healthy' then
    raise exception 'CRYPTO LAB v79 maintenance evidence cron binding mismatch'
      using errcode='55000';
  end if;

  return private.service_seal_latest_crypto_maintenance(
    'crypto-lab-v79-7930-drift1',
    timestamptz '2026-08-05 03:17:00+00'
  );
end;
$$;

revoke all on function private.cron_seal_crypto_lab_v79_7930()
  from public, anon, authenticated, service_role;
grant execute on function private.cron_seal_crypto_lab_v79_7930()
  to postgres;

create or replace function private.get_crypto_admin_maintenance_evidence()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare
  v_expected timestamptz:=timestamptz '2026-08-05 03:17:00+00';
  v_run public.crypto_maintenance_runs%rowtype;
  v_seal public.crypto_maintenance_evidence_seals%rowtype;
  v_verification jsonb;
  v_cron_binding jsonb;
  v_verified boolean:=false;
  v_state text;
begin
  if not public.crypto_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  v_cron_binding:=private.crypto_maintenance_cron_binding_snapshot();

  select * into v_run
  from public.crypto_maintenance_runs
  where started_at>=v_expected
  order by started_at asc,id asc limit 1;

  if v_run.id is not null then
    select * into v_seal
    from public.crypto_maintenance_evidence_seals
    where maintenance_run_id=v_run.id
    order by id desc limit 1;
  end if;

  if v_seal.id is not null then
    v_verification:=private.verify_crypto_maintenance_evidence(v_seal.id);
    v_verified:=coalesce((v_verification->>'verified')::boolean,false);
  end if;

  v_state:=case
    when coalesce(v_cron_binding->>'state','critical')<>'healthy' then 'critical'
    when now()<v_expected then 'healthy'
    when v_run.id is null and now()<v_expected+interval '30 minutes' then 'collecting'
    when v_run.id is null and now()<v_expected+interval '2 hours' then 'warning'
    when v_run.id is null then 'critical'
    when v_run.status='started' and now()<v_run.started_at+interval '30 minutes' then 'collecting'
    when v_run.status='started' and now()<v_run.started_at+interval '2 hours' then 'warning'
    when v_run.status='started' then 'critical'
    when v_run.status='failed' or v_run.error_message is not null then 'critical'
    when v_seal.id is null and now()<v_run.completed_at+interval '30 minutes' then 'collecting'
    when v_seal.id is null and now()<v_run.completed_at+interval '2 hours' then 'warning'
    when v_seal.id is null then 'critical'
    when v_seal.seal_status='failed' or not v_verified then 'critical'
    else 'healthy' end;

  return jsonb_build_object(
    'state',v_state,'scope','first_run_after_threshold',
    'expected_after',v_expected,'generated_at',now(),
    'cron_binding',v_cron_binding,
    'maintenance_run',case when v_run.id is null then null else jsonb_build_object(
      'id',v_run.id,'started_at',v_run.started_at,'completed_at',v_run.completed_at,
      'status',v_run.status,'has_error',v_run.error_message is not null,
      'counters',private.crypto_maintenance_counter_snapshot(v_run.id)
    ) end,
    'seal',case when v_seal.id is null then null else jsonb_build_object(
      'id',v_seal.id,'status',v_seal.seal_status,'evidence_hash',v_seal.evidence_hash,
      'hash_algorithm',v_seal.hash_algorithm,'verified',v_verified,
      'payload_verified',v_verification->'payload_verified',
      'hash_verified',v_verification->'hash_verified',
      'checkpoint_verified',v_verification->'checkpoint_verified',
      'failure_codes',v_seal.failure_codes,'sealed_at',v_seal.sealed_at,
      'release_checkpoint_id',v_seal.release_checkpoint_id
    ) end
  );
end;
$$;
