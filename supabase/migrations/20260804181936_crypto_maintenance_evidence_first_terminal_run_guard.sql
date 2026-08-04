create or replace function private.service_seal_latest_crypto_maintenance(
  p_manifest_key text default null,
  p_min_started_at timestamptz default timestamptz '2026-08-05 03:17:00+00'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare
  v_manifest public.crypto_release_manifests%rowtype;
  v_run public.crypto_maintenance_runs%rowtype;
  v_checkpoint_id bigint;
  v_integrity jsonb;
  v_drift jsonb;
  v_counters jsonb;
  v_failures jsonb:='[]'::jsonb;
  v_status text;
  v_payload jsonb;
  v_hash text;
  v_seal_id bigint;
  v_existing public.crypto_maintenance_evidence_seals%rowtype;
  v_verification jsonb;
begin
  select * into v_manifest
  from public.crypto_release_manifests
  where active and (p_manifest_key is null or manifest_key=p_manifest_key)
  order by created_at desc,id desc limit 1;
  if v_manifest.id is null then
    raise exception 'Active release manifest not found' using errcode='P0002';
  end if;

  -- One-shot release evidence: use the first maintenance run at or after the threshold.
  select * into v_run
  from public.crypto_maintenance_runs
  where started_at>=p_min_started_at
  order by started_at asc,id asc limit 1;

  if v_run.id is null then
    return jsonb_build_object(
      'sealed',false,'status','pending','reason','maintenance_run_not_available',
      'scope','first_run_after_threshold','manifest_key',v_manifest.manifest_key,
      'expected_after',p_min_started_at
    );
  end if;

  select * into v_existing
  from public.crypto_maintenance_evidence_seals
  where maintenance_run_id=v_run.id;
  if v_existing.id is not null then
    v_verification:=private.verify_crypto_maintenance_evidence(v_existing.id);
    return jsonb_build_object(
      'sealed',true,'id',v_existing.id,'status',v_existing.seal_status,
      'scope','first_run_after_threshold','maintenance_run_id',v_existing.maintenance_run_id,
      'evidence_hash',v_existing.evidence_hash,'hash_algorithm',v_existing.hash_algorithm,
      'sealed_at',v_existing.sealed_at,
      'verified',coalesce((v_verification->>'verified')::boolean,false),
      'verification',v_verification,'idempotent',true
    );
  end if;

  -- Immutable evidence must never be created while maintenance is still running.
  if v_run.status='started' or v_run.completed_at is null then
    return jsonb_build_object(
      'sealed',false,'status','pending','reason','maintenance_run_not_terminal',
      'scope','first_run_after_threshold','maintenance_run_id',v_run.id,
      'run_status',v_run.status,'run_started_at',v_run.started_at,
      'age_seconds',greatest(0,floor(extract(epoch from(now()-v_run.started_at)))::bigint),
      'manifest_key',v_manifest.manifest_key,'expected_after',p_min_started_at
    );
  end if;

  if v_run.status not in('completed','failed') then
    raise exception 'Unsupported maintenance terminal status: %',v_run.status using errcode='22023';
  end if;

  select id into v_checkpoint_id
  from public.crypto_release_checkpoints
  where build=v_manifest.build
  order by id desc limit 1;
  if v_checkpoint_id is null then
    raise exception 'Release checkpoint not found' using errcode='P0002';
  end if;

  v_integrity:=private.crypto_data_integrity_snapshot();
  v_drift:=private.crypto_release_drift_snapshot();
  v_counters:=private.crypto_maintenance_counter_snapshot(v_run.id);

  if v_run.status<>'completed' then v_failures:=v_failures||jsonb_build_array('maintenance_not_completed'); end if;
  if v_run.completed_at is null then v_failures:=v_failures||jsonb_build_array('maintenance_completion_time_missing'); end if;
  if v_run.error_message is not null then v_failures:=v_failures||jsonb_build_array('maintenance_error_present'); end if;
  if coalesce(v_integrity->>'state','critical')<>'healthy' then v_failures:=v_failures||jsonb_build_array('data_integrity_not_healthy'); end if;
  if coalesce(v_drift->>'state','critical')<>'healthy' then v_failures:=v_failures||jsonb_build_array('release_drift_not_healthy'); end if;
  if exists(
    select 1 from jsonb_each_text(v_counters) e
    where e.value !~ '^[0-9]+$' or e.value::numeric<0
  ) then v_failures:=v_failures||jsonb_build_array('invalid_retention_counter'); end if;

  v_status:=case when jsonb_array_length(v_failures)=0 then 'passed' else 'failed' end;
  v_payload:=private.crypto_maintenance_evidence_payload_v2(
    1,v_manifest.id,v_manifest.manifest_key,v_manifest.source_commit,
    v_checkpoint_id,v_run.id,p_min_started_at,v_run.started_at,v_run.completed_at,
    v_run.status,v_counters,coalesce(v_integrity->>'state','critical'),
    coalesce(v_drift->>'state','critical'),v_status,v_failures
  );
  v_hash:=private.crypto_maintenance_evidence_hash(v_payload);

  insert into public.crypto_maintenance_evidence_seals(
    maintenance_run_id,manifest_id,manifest_key,manifest_source_commit,release_checkpoint_id,
    evidence_version,expected_after,run_started_at,run_completed_at,run_status,counters,
    integrity_state,drift_state,seal_status,failure_codes,evidence_payload,hash_algorithm,evidence_hash
  ) values(
    v_run.id,v_manifest.id,v_manifest.manifest_key,v_manifest.source_commit,v_checkpoint_id,
    1,p_min_started_at,v_run.started_at,v_run.completed_at,v_run.status,v_counters,
    coalesce(v_integrity->>'state','critical'),coalesce(v_drift->>'state','critical'),
    v_status,v_failures,v_payload,'sha256-jsonb-v1',v_hash
  ) returning id into v_seal_id;

  update public.crypto_release_checkpoints
  set evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
    'maintenance_evidence',jsonb_build_object(
      'seal_id',v_seal_id,'maintenance_run_id',v_run.id,'status',v_status,
      'scope','first_run_after_threshold',
      'manifest_key',v_manifest.manifest_key,'manifest_source_commit',v_manifest.source_commit,
      'evidence_hash',v_hash,'hash_algorithm','sha256-jsonb-v1','payload_version',1,
      'sealed_at',now(),'counters',v_counters
    )
  )
  where id=v_checkpoint_id;

  v_verification:=private.verify_crypto_maintenance_evidence(v_seal_id);
  if not coalesce((v_verification->>'verified')::boolean,false) then
    raise exception 'Maintenance evidence verification failed' using errcode='55000';
  end if;

  return jsonb_build_object(
    'sealed',true,'id',v_seal_id,'status',v_status,
    'scope','first_run_after_threshold','maintenance_run_id',v_run.id,
    'manifest_key',v_manifest.manifest_key,'manifest_source_commit',v_manifest.source_commit,
    'evidence_hash',v_hash,'hash_algorithm','sha256-jsonb-v1','verified',true,
    'failure_codes',v_failures,'checkpoint_id',v_checkpoint_id,'counters',v_counters
  );
end;
$$;

revoke all on function private.service_seal_latest_crypto_maintenance(text,timestamptz) from public,anon,authenticated;
grant execute on function private.service_seal_latest_crypto_maintenance(text,timestamptz) to service_role;

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
  v_verified boolean:=false;
  v_state text;
begin
  if not public.crypto_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;

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

revoke all on function private.get_crypto_admin_maintenance_evidence() from public,anon,authenticated;
grant execute on function private.get_crypto_admin_maintenance_evidence() to authenticated,service_role;
