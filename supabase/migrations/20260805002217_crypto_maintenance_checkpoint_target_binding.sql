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
  v_checkpoint_count integer;
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
  perform pg_catalog.pg_advisory_xact_lock(7930000014::bigint);

  select * into v_manifest
  from public.crypto_release_manifests
  where active and (p_manifest_key is null or manifest_key=p_manifest_key)
  order by created_at desc,id desc limit 1;
  if v_manifest.id is null then
    raise exception 'Active release manifest not found' using errcode='P0002';
  end if;

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

  if v_run.status='started' or v_run.completed_at is null then
    return jsonb_build_object(
      'sealed',false,'status','pending','reason','maintenance_run_not_terminal',
      'scope','first_run_after_threshold','maintenance_run_id',v_run.id,
      'run_status',v_run.status,'run_started_at',v_run.started_at,
      'age_seconds',greatest(0,floor(extract(epoch from(clock_timestamp()-v_run.started_at)))::bigint),
      'manifest_key',v_manifest.manifest_key,'expected_after',p_min_started_at
    );
  end if;

  if v_run.status not in('completed','failed') then
    raise exception 'Unsupported maintenance terminal status: %',v_run.status using errcode='22023';
  end if;

  select count(*)::integer,max(c.id)
  into v_checkpoint_count,v_checkpoint_id
  from public.crypto_release_checkpoints c
  where c.build=v_manifest.build
    and c.git_commit_sha=v_manifest.source_commit
    and coalesce(c.evidence#>>'{maintenance_evidence,status}','')='pending'
    and not (coalesce(c.evidence->'maintenance_evidence','{}'::jsonb) ? 'seal_id')
    and coalesce(c.evidence#>>'{maintenance_evidence,scope}','')='first_run_after_threshold'
    and (c.evidence#>>'{maintenance_evidence,expected_after}')::timestamptz=p_min_started_at;

  if v_checkpoint_count=0 or v_checkpoint_id is null then
    raise exception 'Release checkpoint target not found for active manifest %',v_manifest.source_commit using errcode='P0002';
  end if;
  if v_checkpoint_count<>1 then
    raise exception 'Ambiguous release checkpoint target for active manifest %: % candidates',v_manifest.source_commit,v_checkpoint_count using errcode='21000';
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
    where e.value is null or e.value !~ '^[0-9]+$' or e.value::numeric<0
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

  if not found then
    raise exception 'Release checkpoint target disappeared during sealing' using errcode='P0002';
  end if;

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

revoke all on function private.service_seal_latest_crypto_maintenance(text,timestamptz)
from public,anon,authenticated,service_role;
grant execute on function private.service_seal_latest_crypto_maintenance(text,timestamptz) to postgres;

comment on function private.service_seal_latest_crypto_maintenance(text,timestamptz) is
'Creates one immutable seal for the first terminal maintenance run after the threshold and binds it to the unique pending release checkpoint matching the active manifest source commit.';