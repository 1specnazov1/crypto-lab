-- CRYPTO LAB v79
-- Correct fabricated owner approval and permanently require explicit owner-decision provenance.

update public.crypto_onchain_networks
set approved_by_owner=false,
    status='inactive',
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
    'automatic_entitlement_path',true,
    'private_keys_required',false,
    'network_activation',false,
    'active_network_count',0,
    'active_price_count',0,
    'receiving_address_count',0,
    'invoice_count',0,
    'chain_observation_count',0,
    'bsc_asset_contract_review_required',true
  ),
  'Direct on-chain payment is a prepared candidate only. No owner network decision is recorded. All networks, prices, addresses and payment routes remain inactive.'
);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency','{}'::jsonb,
  jsonb_build_object(
    'onchain_foundation',true,
    'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'owner_approval_recorded',false,
    'scenarios_extended',jsonb_build_array(
      'wrong_network','wrong_asset','underpayment','overpayment','duplicate_tx_hash',
      'duplicate_evidence','unfinalized_tx','finality_progression','finality_regression',
      'conflicting_observation','expired_invoice','late_transaction','existing_period_extension'
    ),
    'activation',false
  ),
  'On-chain sandbox scenarios are prepared but blocked until the owner explicitly chooses the provider rail, network, settlement asset, pricing and public receiving addresses.'
);

create or replace function private.guard_crypto_onchain_owner_approval()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_authorized boolean := coalesce(current_setting('app.crypto_owner_decision_authorized', true), 'false') = 'true';
begin
  if new.approved_by_owner
     and (tg_op = 'INSERT' or not coalesce(old.approved_by_owner,false))
     and not v_authorized then
    raise exception 'On-chain network owner approval requires an explicitly authorized owner-decision transaction'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_crypto_onchain_owner_approval() from public;
revoke all on function private.guard_crypto_onchain_owner_approval() from anon;
revoke all on function private.guard_crypto_onchain_owner_approval() from authenticated;
revoke all on function private.guard_crypto_onchain_owner_approval() from service_role;

drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
create trigger crypto_onchain_network_owner_approval_guard
before insert or update of approved_by_owner
on public.crypto_onchain_networks
for each row execute function private.guard_crypto_onchain_owner_approval();

create or replace function private.guard_crypto_payment_owner_decision_provenance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_authorized boolean := coalesce(current_setting('app.crypto_owner_decision_authorized', true), 'false') = 'true';
  v_approved_count integer := 0;
  v_owner_claim boolean := false;
begin
  if new.code not in ('PAYMENT_PROVIDER','PAYMENT_SANDBOX_E2E') then
    return new;
  end if;

  if jsonb_typeof(new.decision_summary->'approved_networks') = 'array' then
    v_approved_count := v_approved_count + jsonb_array_length(new.decision_summary->'approved_networks');
  end if;
  if jsonb_typeof(new.evidence->'approved_networks') = 'array' then
    v_approved_count := v_approved_count + jsonb_array_length(new.evidence->'approved_networks');
  end if;

  v_owner_claim :=
    coalesce((new.decision_summary->>'owner_approval_recorded')::boolean,false)
    or coalesce((new.decision_summary->>'network_approval_recorded')::boolean,false)
    or coalesce((new.evidence->>'owner_approval_recorded')::boolean,false)
    or coalesce((new.evidence->>'network_approval_recorded')::boolean,false)
    or v_approved_count > 0
    or coalesce(new.operator_note,'') ~* 'owner( explicitly)? approved';

  if not v_authorized and (
      v_owner_claim
      or (new.code='PAYMENT_PROVIDER' and old.status='decision_required' and new.status <> 'decision_required')
      or (new.code='PAYMENT_PROVIDER' and old.decided_at is null and new.decided_at is not null)
    ) then
    raise exception 'Payment owner decision requires an explicitly authorized owner-decision transaction'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_crypto_payment_owner_decision_provenance() from public;
revoke all on function private.guard_crypto_payment_owner_decision_provenance() from anon;
revoke all on function private.guard_crypto_payment_owner_decision_provenance() from authenticated;
revoke all on function private.guard_crypto_payment_owner_decision_provenance() from service_role;

drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;
create trigger crypto_payment_owner_decision_provenance_guard
before update of status, decision_summary, evidence, operator_note, decided_at
on public.crypto_launch_requirements
for each row execute function private.guard_crypto_payment_owner_decision_provenance();

comment on function private.guard_crypto_onchain_owner_approval() is
  'Prevents fabricated on-chain network approval without an explicitly authorized owner-decision transaction.';
comment on function private.guard_crypto_payment_owner_decision_provenance() is
  'Prevents payment launch-control records from claiming owner approval without an explicitly authorized owner-decision transaction.';
