create or replace function private.protect_crypto_checkpoint_maintenance_evidence()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare
  v_old jsonb:=old.evidence->'maintenance_evidence';
  v_new jsonb:=new.evidence->'maintenance_evidence';
  v_seal_id bigint;
  v_seal public.crypto_maintenance_evidence_seals%rowtype;
  v_expected jsonb;
begin
  -- Unrelated checkpoint evidence may still be updated while the maintenance
  -- evidence block itself remains byte-for-byte equivalent as jsonb.
  if v_new is not distinct from v_old then
    return new;
  end if;

  -- Once a real seal is attached, the checkpoint evidence is immutable.
  if coalesce(v_old->>'seal_id','')<>'' then
    raise exception 'Checkpoint maintenance evidence is immutable' using errcode='55000';
  end if;

  -- Before sealing, the only permitted mutation is the one-time transition
  -- from the release's pending placeholder to an actual persisted seal.
  if v_old is null or coalesce(v_old->>'status','')<>'pending' then
    raise exception 'Checkpoint maintenance evidence transition is not permitted' using errcode='55000';
  end if;
  if v_new is null or coalesce(v_new->>'seal_id','') !~ '^[0-9]+$' then
    raise exception 'Checkpoint maintenance evidence requires a persisted seal' using errcode='22023';
  end if;

  v_seal_id:=(v_new->>'seal_id')::bigint;
  select * into v_seal
  from public.crypto_maintenance_evidence_seals
  where id=v_seal_id;
  if v_seal.id is null then
    raise exception 'Checkpoint maintenance evidence seal not found' using errcode='P0002';
  end if;
  if v_seal.release_checkpoint_id is distinct from old.id then
    raise exception 'Checkpoint maintenance evidence seal target mismatch' using errcode='22023';
  end if;

  v_expected:=jsonb_build_object(
    'seal_id',v_seal.id,
    'maintenance_run_id',v_seal.maintenance_run_id,
    'status',v_seal.seal_status,
    'scope','first_run_after_threshold',
    'manifest_key',v_seal.manifest_key,
    'manifest_source_commit',v_seal.manifest_source_commit,
    'evidence_hash',v_seal.evidence_hash,
    'hash_algorithm',v_seal.hash_algorithm,
    'payload_version',v_seal.evidence_version,
    'sealed_at',v_seal.sealed_at,
    'counters',v_seal.counters
  );

  if v_new is distinct from v_expected then
    raise exception 'Checkpoint maintenance evidence does not match persisted seal' using errcode='22023';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_crypto_checkpoint_maintenance_evidence() from public,anon,authenticated;
grant execute on function private.protect_crypto_checkpoint_maintenance_evidence() to service_role;

drop trigger if exists crypto_checkpoint_maintenance_evidence_immutable on public.crypto_release_checkpoints;
create trigger crypto_checkpoint_maintenance_evidence_immutable
before update on public.crypto_release_checkpoints
for each row execute function private.protect_crypto_checkpoint_maintenance_evidence();
