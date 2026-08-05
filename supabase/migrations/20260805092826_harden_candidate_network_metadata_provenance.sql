-- CRYPTO LAB v79
-- Candidate network metadata is restricted to operational data until an explicit owner decision.

update public.crypto_onchain_networks
set metadata=jsonb_strip_nulls(jsonb_build_object('verification',metadata->'verification')),
    approved_by_owner=false,
    status='inactive',
    updated_at=now()
where network_code in ('TRON','BSC','SOLANA');

create or replace function private.block_crypto_onchain_owner_approval()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if new.approved_by_owner
     or exists(
       select 1
       from jsonb_object_keys(coalesce(new.metadata,'{}'::jsonb)) as key_name
       where key_name ~* '(owner|approval|decision|activation)'
     ) then
    raise exception 'On-chain owner approval metadata is fail-closed until an explicit manual owner-decision migration replaces this guard'
      using errcode='42501';
  end if;
  return new;
end;
$$;

revoke all on function private.block_crypto_onchain_owner_approval() from public;
revoke all on function private.block_crypto_onchain_owner_approval() from anon;
revoke all on function private.block_crypto_onchain_owner_approval() from authenticated;
revoke all on function private.block_crypto_onchain_owner_approval() from service_role;

comment on function private.block_crypto_onchain_owner_approval() is
  'Fail-closed candidate-network guard: owner/approval/decision/activation metadata and approved_by_owner=true require a future explicit manual owner-decision migration.';
