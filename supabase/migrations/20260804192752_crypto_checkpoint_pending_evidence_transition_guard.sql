create or replace function private.protect_crypto_checkpoint_maintenance_evidence()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog','pg_temp'
as $$
begin
  if coalesce(old.evidence#>>'{maintenance_evidence,seal_id}','')<>''
    and new.evidence->'maintenance_evidence' is distinct from old.evidence->'maintenance_evidence'
  then
    raise exception 'Checkpoint maintenance evidence is immutable' using errcode='55000';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_crypto_checkpoint_maintenance_evidence() from public,anon,authenticated;
grant execute on function private.protect_crypto_checkpoint_maintenance_evidence() to service_role;

comment on function private.protect_crypto_checkpoint_maintenance_evidence() is
  'Allows a pending maintenance_evidence placeholder to transition once to a sealed payload. Once seal_id exists, the checkpoint evidence is immutable.';
