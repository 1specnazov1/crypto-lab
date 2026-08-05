create table if not exists public.crypto_owner_decision_supersession_corrections(
  decision_id uuid primary key references public.crypto_owner_decision_records(id) on delete restrict,
  correction_reason text not null,
  correction_migration text not null,
  corrected_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  constraint crypto_owner_decision_correction_reason_check check(char_length(correction_reason) between 1 and 1000),
  constraint crypto_owner_decision_correction_migration_check check(correction_migration ~ '^[a-z0-9_]{3,120}$'),
  constraint crypto_owner_decision_correction_evidence_check check(jsonb_typeof(evidence)='object')
);
alter table public.crypto_owner_decision_supersession_corrections enable row level security;
revoke all on table public.crypto_owner_decision_supersession_corrections from public,anon,authenticated;
grant select on table public.crypto_owner_decision_supersession_corrections to service_role;
drop policy if exists crypto_owner_decision_supersession_corrections_direct_deny on public.crypto_owner_decision_supersession_corrections;
create policy crypto_owner_decision_supersession_corrections_direct_deny on public.crypto_owner_decision_supersession_corrections as restrictive for all to anon,authenticated using(false) with check(false);

alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_networks_owner_decision_fail_closed;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_provider_owner_decision_fail_closed;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_sandbox_owner_claim_fail_closed;
alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_payment_record_fail_closed;

drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;
drop trigger if exists crypto_payment_owner_decision_record_fail_closed on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_decision_record_insert_guard on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_decision_record_immutable on public.crypto_owner_decision_records;

update public.crypto_owner_decision_records
set decision_text='Три сети утверждаю.',
    decision_hash=encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
    source_channel='owner_chat',
    scope=jsonb_build_object(
      'payment_rail','onchain_direct',
      'wallet_client','trust_wallet_walletconnect',
      'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'decision_scope','network_selection_only',
      'network_activation',false,
      'settlement_asset_selected',false,
      'pricing_selected',false,
      'receiving_addresses_configured',false,
      'original_message_timestamp_known',false
    ),
    activation_authorized=false,
    active=true
where decision_code='ONCHAIN_THREE_NETWORK_SELECTION';

insert into public.crypto_owner_decision_supersession_corrections(decision_id,correction_reason,correction_migration,evidence)
select r.id,
  'The prior supersession was based on incomplete conversation context. The user explicitly wrote “Три сети утверждаю.” and approved TRON, BSC and Solana as network choices.',
  'supersede_false_network_decision_denial_with_exact_owner_record',
  jsonb_build_object(
    'classification','false_supersession_corrected',
    'exact_owner_text','Три сети утверждаю.',
    'decision_hash',r.decision_hash,
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'activation_authorized',false,
    'remaining_decisions',jsonb_build_array('settlement_asset','bsc_token_contract','pricing','receiving_addresses','verifier_configuration','payment_activation')
  )
from public.crypto_owner_decision_records r
where r.decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
on conflict(decision_id) do update set
  correction_reason=excluded.correction_reason,
  correction_migration=excluded.correction_migration,
  evidence=excluded.evidence,
  corrected_at=now();

update public.crypto_onchain_networks n
set approved_by_owner=true,
    status='inactive',
    metadata=jsonb_build_object(
      'verification',n.metadata->'verification',
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash',encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
      'approval_source','owner_chat',
      'decision_scope','network_selection_only',
      'activation_pending',true
    ),
    updated_at=now()
where n.network_code in('TRON','BSC','SOLANA');

update public.crypto_launch_requirements
set status='in_progress',
    decision_summary=jsonb_build_object(
      'provider','onchain_direct',
      'wallet','trust_wallet_walletconnect',
      'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'owner_approval_recorded',true,
      'network_approval_recorded',true,
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash',encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
      'decision_scope','networks_only',
      'settlement_asset','pending'
    ),
    evidence=jsonb_build_object(
      'foundation_schema',true,
      'automatic_entitlement_path',true,
      'private_keys_required',false,
      'network_activation',false,
      'active_network_count',0,
      'active_price_count',0,
      'receiving_address_count',0,
      'invoice_count',(select count(*) from public.crypto_onchain_invoices),
      'chain_observation_count',(select count(*) from public.crypto_onchain_tx_observations),
      'bsc_asset_contract_review_required',true,
      'immutable_owner_decision_record',true,
      'false_supersession_corrected',true
    ),
    operator_note='Owner explicitly approved TRON, BSC and Solana as network choices only. Asset, BSC token contract, prices, addresses, verifier configuration and activation remain pending.',
    decided_at=coalesce(decided_at,now()),
    verified_at=null,
    updated_at=now()
where code='PAYMENT_PROVIDER';

update public.crypto_launch_requirements
set status='blocked_dependency',
    decision_summary='{}'::jsonb,
    evidence=jsonb_build_object(
      'onchain_foundation',true,
      'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'owner_approval_recorded',true,
      'network_approval_recorded',true,
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash',encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
      'immutable_owner_decision_record',true,
      'transaction_claim_lifecycle_hardened',true,
      'activation',false,
      'sandbox_execution_authorized',false,
      'scenarios_extended',jsonb_build_array(
        'wrong_network','wrong_asset','underpayment','overpayment','duplicate_tx_hash','duplicate_evidence','unfinalized_tx','finality_progression','finality_regression','conflicting_observation','expired_invoice','late_transaction','existing_period_extension'
      )
    ),
    operator_note='The three-network sandbox scope is owner-approved. Execution remains blocked by settlement asset, exact BSC token contract, prices, public receiving addresses and verifier configuration.',
    decided_at=null,
    verified_at=null,
    updated_at=now()
where code='PAYMENT_SANDBOX_E2E';

create or replace function private.crypto_exact_owner_network_selection_valid(
  p_network_code text,p_approved boolean,p_status text,p_metadata jsonb
)
returns boolean language sql immutable
set search_path=pg_catalog,pg_temp
as $$
 select case
   when p_network_code in('TRON','BSC','SOLANA') then
     p_approved=true
     and p_status<>'active'
     and p_metadata->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION'
     and p_metadata->>'decision_hash'='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
     and p_metadata->>'approval_source'='owner_chat'
   else p_approved=false
 end
$$;

alter table public.crypto_onchain_networks
  add constraint crypto_onchain_networks_exact_owner_selection
  check(private.crypto_exact_owner_network_selection_valid(network_code,approved_by_owner,status,metadata)) not valid;
alter table public.crypto_onchain_networks validate constraint crypto_onchain_networks_exact_owner_selection;

create or replace function private.crypto_exact_payment_network_decision_valid(
  p_code text,p_status text,p_decision_summary jsonb,p_evidence jsonb,p_decided_at timestamptz,p_verified_at timestamptz
)
returns boolean language sql immutable
set search_path=pg_catalog,pg_temp
as $$
 select case
   when p_code='PAYMENT_PROVIDER' then
     p_status='in_progress'
     and p_verified_at is null
     and p_decided_at is not null
     and p_decision_summary->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')
     and p_decision_summary->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION'
     and p_decision_summary->>'decision_hash'='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
     and p_decision_summary->>'settlement_asset'='pending'
     and coalesce((p_evidence->>'network_activation')::boolean,false)=false
   when p_code='PAYMENT_SANDBOX_E2E' then
     p_status='blocked_dependency'
     and p_evidence->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')
     and p_evidence->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION'
     and p_evidence->>'decision_hash'='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
     and coalesce((p_evidence->>'activation')::boolean,false)=false
   else true
 end
$$;

alter table public.crypto_launch_requirements
  add constraint crypto_payment_exact_owner_network_decision
  check(private.crypto_exact_payment_network_decision_valid(code,status,decision_summary,evidence,decided_at,verified_at)) not valid;
alter table public.crypto_launch_requirements validate constraint crypto_payment_exact_owner_network_decision;

create or replace function private.enforce_exact_crypto_owner_network_selection()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private,pg_temp
as $$
begin
  if not private.crypto_exact_owner_network_selection_valid(new.network_code,new.approved_by_owner,new.status,new.metadata) then
    raise exception 'Exact owner network selection cannot be removed, expanded or activated without a new explicit owner decision' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
create trigger crypto_onchain_network_owner_approval_guard
before insert or update of network_code,approved_by_owner,status,metadata on public.crypto_onchain_networks
for each row execute function private.enforce_exact_crypto_owner_network_selection();

create or replace function private.enforce_exact_crypto_payment_network_decision()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private,pg_temp
as $$
begin
  if not private.crypto_exact_payment_network_decision_valid(new.code,new.status,new.decision_summary,new.evidence,new.decided_at,new.verified_at) then
    raise exception 'Exact owner payment-network decision cannot be removed, expanded or used to activate payment' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;
create trigger crypto_payment_owner_decision_provenance_guard
before insert or update of status,decision_summary,evidence,operator_note,decided_at,verified_at on public.crypto_launch_requirements
for each row execute function private.enforce_exact_crypto_payment_network_decision();

create or replace function private.protect_exact_crypto_owner_decision_record()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private,pg_temp
as $$
begin
  if tg_op='DELETE' then raise exception 'Exact owner decision record is immutable' using errcode='55000'; end if;
  if new.decision_code='ONCHAIN_THREE_NETWORK_SELECTION' then
    if new.decision_text<>'Три сети утверждаю.'
       or new.decision_hash<>'57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
       or new.source_channel<>'owner_chat'
       or new.scope->'approved_networks'<>jsonb_build_array('TRON','BSC','SOLANA')
       or new.activation_authorized
       or not new.active then
      raise exception 'Exact owner decision record cannot be altered' using errcode='42501';
    end if;
  elsif new.decision_code ~* '^(ONCHAIN|PAYMENT)_' then
    raise exception 'Additional payment owner decisions require a new explicit user decision and migration' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists crypto_payment_owner_decision_record_fail_closed on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_decision_record_immutable on public.crypto_owner_decision_records;
create trigger crypto_owner_decision_record_immutable
before insert or update or delete on public.crypto_owner_decision_records
for each row execute function private.protect_exact_crypto_owner_decision_record();

create or replace function private.crypto_owner_decision_correction_immutable()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp
as $$ begin raise exception 'Owner decision correction evidence is immutable' using errcode='55000'; end $$;
drop trigger if exists crypto_owner_decision_correction_immutable on public.crypto_owner_decision_supersession_corrections;
create trigger crypto_owner_decision_correction_immutable before update or delete on public.crypto_owner_decision_supersession_corrections for each row execute function private.crypto_owner_decision_correction_immutable();

revoke all on function private.crypto_exact_owner_network_selection_valid(text,boolean,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.crypto_exact_payment_network_decision_valid(text,text,jsonb,jsonb,timestamptz,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.enforce_exact_crypto_owner_network_selection() from public,anon,authenticated,service_role;
revoke all on function private.enforce_exact_crypto_payment_network_decision() from public,anon,authenticated,service_role;
revoke all on function private.protect_exact_crypto_owner_decision_record() from public,anon,authenticated,service_role;
revoke all on function private.crypto_owner_decision_correction_immutable() from public,anon,authenticated,service_role;
revoke insert,update,delete,truncate on table public.crypto_owner_decision_records from service_role;
revoke insert,update,delete,truncate on table public.crypto_owner_decision_supersession_corrections from service_role;
