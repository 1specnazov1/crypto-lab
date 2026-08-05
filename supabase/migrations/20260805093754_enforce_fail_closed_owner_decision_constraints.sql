-- CRYPTO LAB v79
-- Enforce candidate-only payment state through validated constraints and trigger guards.

create or replace function private.crypto_onchain_candidate_metadata_safe(p_metadata jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_key text;
begin
  for v_key in select jsonb_object_keys(coalesce(p_metadata,'{}'::jsonb))
  loop
    if v_key ~* '(owner|approval|decision|activation)' then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function private.crypto_payment_owner_claim_absent(
  p_decision_summary jsonb,
  p_evidence jsonb,
  p_operator_note text
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
begin
  if coalesce(p_decision_summary,'{}'::jsonb) ?| array['approved_networks','decision_hash','decision_code','owner_decision_id'] then return false; end if;
  if coalesce(p_evidence,'{}'::jsonb) ?| array['approved_networks','decision_hash','decision_code','owner_decision_id'] then return false; end if;
  if coalesce((p_decision_summary->>'owner_approval_recorded')::boolean,false)
     or coalesce((p_decision_summary->>'network_approval_recorded')::boolean,false)
     or coalesce((p_evidence->>'owner_approval_recorded')::boolean,false)
     or coalesce((p_evidence->>'network_approval_recorded')::boolean,false) then return false; end if;
  if coalesce(p_operator_note,'') ~* 'owner( explicitly)? approved|approved by owner|владелец.{0,40}(утверд|одобр)|утверждаю' then return false; end if;
  return true;
exception when invalid_text_representation then return false;
end;
$$;

revoke all on function private.crypto_onchain_candidate_metadata_safe(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.crypto_payment_owner_claim_absent(jsonb,jsonb,text) from public,anon,authenticated,service_role;

update public.crypto_onchain_networks
set approved_by_owner=false,
    status='inactive',
    metadata=jsonb_strip_nulls(jsonb_build_object('verification',metadata->'verification')),
    updated_at=now()
where network_code in ('TRON','BSC','SOLANA');

update public.crypto_launch_requirements
set status='decision_required',
    decision_summary=jsonb_build_object(
      'candidate_provider','onchain_direct','wallet_client','trust_wallet_walletconnect',
      'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'settlement_asset','pending','owner_approval_recorded',false
    ),
    evidence=jsonb_build_object(
      'foundation_schema',true,'transaction_claim_lifecycle_hardened',true,
      'automatic_entitlement_path',true,'private_keys_required',false,
      'network_activation',false,'active_network_count',0,'active_price_count',0,
      'receiving_address_count',0,'invoice_count',0,'chain_observation_count',0,
      'bsc_asset_contract_review_required',true,'fail_closed_owner_decision_gate',true,
      'database_constraints_enforced',true
    ),
    operator_note='Direct on-chain payment is a disabled candidate. No provider rail or network is owner-approved. Future approval requires a manual constraint-changing migration after an explicit user decision.',
    decided_at=null,verified_at=null,updated_at=now()
where code='PAYMENT_PROVIDER';

update public.crypto_launch_requirements
set status='blocked_dependency',decision_summary='{}'::jsonb,
    evidence=jsonb_build_object(
      'activation',false,'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'onchain_foundation',true,'owner_approval_recorded',false,
      'fail_closed_owner_decision_gate',true,'database_constraints_enforced',true,
      'transaction_claim_lifecycle_hardened',true
    ),
    operator_note='Sandbox execution remains blocked. No provider rail, network, asset, price or receiving address is owner-approved.',
    decided_at=null,verified_at=null,updated_at=now()
where code='PAYMENT_SANDBOX_E2E';

alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_networks_owner_decision_fail_closed;
alter table public.crypto_onchain_networks add constraint crypto_onchain_networks_owner_decision_fail_closed
check (approved_by_owner=false and private.crypto_onchain_candidate_metadata_safe(metadata)) not valid;
alter table public.crypto_onchain_networks validate constraint crypto_onchain_networks_owner_decision_fail_closed;

alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_provider_owner_decision_fail_closed;
alter table public.crypto_launch_requirements add constraint crypto_payment_provider_owner_decision_fail_closed
check (
  code <> 'PAYMENT_PROVIDER'
  or (
    status='decision_required' and decided_at is null and verified_at is null
    and private.crypto_payment_owner_claim_absent(decision_summary,evidence,operator_note)
  )
) not valid;
alter table public.crypto_launch_requirements validate constraint crypto_payment_provider_owner_decision_fail_closed;

alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_sandbox_owner_claim_fail_closed;
alter table public.crypto_launch_requirements add constraint crypto_payment_sandbox_owner_claim_fail_closed
check (code <> 'PAYMENT_SANDBOX_E2E' or private.crypto_payment_owner_claim_absent(decision_summary,evidence,operator_note)) not valid;
alter table public.crypto_launch_requirements validate constraint crypto_payment_sandbox_owner_claim_fail_closed;

create or replace function private.block_crypto_onchain_owner_approval()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if new.approved_by_owner or not private.crypto_onchain_candidate_metadata_safe(new.metadata) then
    raise exception 'On-chain owner approval is fail-closed until an explicit manual owner-decision migration replaces the database constraint' using errcode='42501';
  end if;
  return new;
end;
$$;

create or replace function private.block_crypto_payment_owner_decision_claim()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if new.code='PAYMENT_PROVIDER' and (
      new.status<>'decision_required' or new.decided_at is not null or new.verified_at is not null
      or not private.crypto_payment_owner_claim_absent(new.decision_summary,new.evidence,new.operator_note)
    ) then
    raise exception 'Payment owner decision is fail-closed until an explicit manual owner-decision migration replaces the database constraint' using errcode='42501';
  end if;
  if new.code='PAYMENT_SANDBOX_E2E'
     and not private.crypto_payment_owner_claim_absent(new.decision_summary,new.evidence,new.operator_note) then
    raise exception 'Payment sandbox owner claim is fail-closed until an explicit manual owner-decision migration replaces the database constraint' using errcode='42501';
  end if;
  return new;
end;
$$;

revoke all on function private.block_crypto_onchain_owner_approval() from public,anon,authenticated,service_role;
revoke all on function private.block_crypto_payment_owner_decision_claim() from public,anon,authenticated,service_role;

drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
create trigger crypto_onchain_network_owner_approval_guard
before insert or update of approved_by_owner,metadata on public.crypto_onchain_networks
for each row execute function private.block_crypto_onchain_owner_approval();

drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;
create trigger crypto_payment_owner_decision_provenance_guard
before insert or update of status,decision_summary,evidence,operator_note,decided_at,verified_at
on public.crypto_launch_requirements for each row execute function private.block_crypto_payment_owner_decision_claim();
