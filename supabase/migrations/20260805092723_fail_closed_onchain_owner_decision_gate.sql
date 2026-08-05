-- CRYPTO LAB v79
-- Remove fabricated owner decisions and fail closed until a future explicit manual migration.

drop trigger if exists crypto_owner_decision_record_immutable on public.crypto_owner_decision_records;
delete from public.crypto_owner_decision_records
where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
  and decision_text='Три сети утверждаю.';
create trigger crypto_owner_decision_record_immutable
before update or delete on public.crypto_owner_decision_records
for each row execute function private.crypto_owner_decision_record_immutable();
revoke insert on table public.crypto_owner_decision_records from service_role;

update public.crypto_onchain_networks
set approved_by_owner=false,
    status='inactive',
    metadata=metadata
      - 'owner_approved_at'
      - 'approval_source'
      - 'activation_pending'
      - 'approval_recorded_at'
      - 'decision_code'
      - 'decision_hash'
      - 'owner_decision_id'
      - 'owner_approval_recorded',
    updated_at=now()
where network_code in ('TRON','BSC','SOLANA');

select private.service_update_crypto_launch_requirement(
  'PAYMENT_PROVIDER','decision_required',
  jsonb_build_object(
    'candidate_provider','onchain_direct',
    'wallet_client','trust_wallet_walletconnect',
    'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'settlement_asset','pending',
    'owner_approval_recorded',false
  ),
  jsonb_build_object(
    'foundation_schema',true,
    'transaction_claim_lifecycle_hardened',true,
    'automatic_entitlement_path',true,
    'private_keys_required',false,
    'network_activation',false,
    'active_network_count',0,
    'active_price_count',0,
    'receiving_address_count',0,
    'invoice_count',0,
    'chain_observation_count',0,
    'bsc_asset_contract_review_required',true,
    'fail_closed_owner_decision_gate',true
  ),
  'Direct on-chain payment is a disabled candidate. The user did not approve TRON, BSC or Solana. Owner approval is fail-closed until a new manual migration is created after an explicit user decision.'
);

update public.crypto_launch_requirements
set decided_at=null,
    verified_at=null,
    updated_at=now()
where code='PAYMENT_PROVIDER';

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency','{}'::jsonb,
  jsonb_build_object(
    'onchain_foundation',true,
    'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'owner_approval_recorded',false,
    'transaction_claim_lifecycle_hardened',true,
    'fail_closed_owner_decision_gate',true,
    'activation',false
  ),
  'Sandbox execution remains blocked. No network, asset, price, receiving address or provider rail is owner-approved.'
);

create or replace function private.block_crypto_onchain_owner_approval()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if new.approved_by_owner
     or new.metadata ?| array[
       'owner_approved_at','approval_source','activation_pending','approval_recorded_at',
       'decision_code','decision_hash','owner_decision_id','owner_approval_recorded'
     ] then
    raise exception 'On-chain owner approval is fail-closed until an explicit manual owner-decision migration replaces this guard'
      using errcode='42501';
  end if;
  return new;
end;
$$;

revoke all on function private.block_crypto_onchain_owner_approval() from public;
revoke all on function private.block_crypto_onchain_owner_approval() from anon;
revoke all on function private.block_crypto_onchain_owner_approval() from authenticated;
revoke all on function private.block_crypto_onchain_owner_approval() from service_role;

drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
create trigger crypto_onchain_network_owner_approval_guard
before insert or update of approved_by_owner,metadata
on public.crypto_onchain_networks
for each row execute function private.block_crypto_onchain_owner_approval();

create or replace function private.block_crypto_payment_owner_decision_claim()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_approved_count integer := 0;
  v_owner_claim boolean := false;
begin
  if new.code not in ('PAYMENT_PROVIDER','PAYMENT_SANDBOX_E2E') then
    return new;
  end if;
  if jsonb_typeof(new.decision_summary->'approved_networks')='array' then
    v_approved_count:=v_approved_count+jsonb_array_length(new.decision_summary->'approved_networks');
  end if;
  if jsonb_typeof(new.evidence->'approved_networks')='array' then
    v_approved_count:=v_approved_count+jsonb_array_length(new.evidence->'approved_networks');
  end if;
  v_owner_claim :=
    coalesce((new.decision_summary->>'owner_approval_recorded')::boolean,false)
    or coalesce((new.decision_summary->>'network_approval_recorded')::boolean,false)
    or coalesce((new.evidence->>'owner_approval_recorded')::boolean,false)
    or coalesce((new.evidence->>'network_approval_recorded')::boolean,false)
    or new.decision_summary ? 'decision_hash'
    or new.decision_summary ? 'decision_code'
    or new.evidence ? 'decision_hash'
    or new.evidence ? 'decision_code'
    or v_approved_count>0
    or coalesce(new.operator_note,'') ~* 'owner( explicitly)? approved';

  if v_owner_claim
     or (new.code='PAYMENT_PROVIDER' and new.status<>'decision_required')
     or (new.code='PAYMENT_PROVIDER' and (new.decided_at is not null or new.verified_at is not null)) then
    raise exception 'Payment owner decision is fail-closed until an explicit manual owner-decision migration replaces this guard'
      using errcode='42501';
  end if;
  return new;
end;
$$;

revoke all on function private.block_crypto_payment_owner_decision_claim() from public;
revoke all on function private.block_crypto_payment_owner_decision_claim() from anon;
revoke all on function private.block_crypto_payment_owner_decision_claim() from authenticated;
revoke all on function private.block_crypto_payment_owner_decision_claim() from service_role;

drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;
create trigger crypto_payment_owner_decision_provenance_guard
before update of status,decision_summary,evidence,operator_note,decided_at,verified_at
on public.crypto_launch_requirements
for each row execute function private.block_crypto_payment_owner_decision_claim();

comment on function private.block_crypto_onchain_owner_approval() is
  'Fail-closed guard: on-chain owner approval cannot be recorded autonomously and requires a future explicit manual migration after a real user decision.';
comment on function private.block_crypto_payment_owner_decision_claim() is
  'Fail-closed guard: payment launch-control owner claims cannot be recorded autonomously and require a future explicit manual migration after a real user decision.';
