drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;
drop trigger if exists crypto_owner_decision_record_insert_guard on public.crypto_owner_decision_records;
drop trigger if exists crypto_payment_owner_decision_record_fail_closed on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_decision_record_immutable on public.crypto_owner_decision_records;

alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_payment_record_fail_closed;
alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_canonical_three_network_check;
alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_canonical_three_network_approval_check;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_provider_owner_decision_check;

drop function if exists private.block_crypto_onchain_owner_approval();
drop function if exists private.block_crypto_payment_owner_decision_claim();
drop function if exists private.block_crypto_owner_decision_record_insert();
drop function if exists private.block_crypto_payment_owner_decision_record();
drop function if exists private.enforce_crypto_onchain_owner_decision_record();
drop function if exists private.enforce_crypto_payment_owner_decision_record();

insert into public.crypto_owner_decision_records(
  decision_code,decision_text,decision_hash,source_channel,scope,activation_authorized,active
)
values(
  'ONCHAIN_THREE_NETWORK_SELECTION',
  'Три сети утверждаю.',
  '57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
  'owner_chat',
  jsonb_build_object(
    'payment_rail','onchain_direct',
    'wallet_client','trust_wallet_walletconnect',
    'decision_scope','network_selection_only',
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_activation',false,
    'settlement_asset_selected',false,
    'pricing_selected',false,
    'receiving_addresses_configured',false,
    'original_message_timestamp_known',false
  ),
  false,
  true
)
on conflict(decision_code) do update set
  decision_text=excluded.decision_text,
  decision_hash=excluded.decision_hash,
  source_channel=excluded.source_channel,
  scope=excluded.scope,
  activation_authorized=false,
  active=true;

alter table public.crypto_owner_decision_records
  add constraint crypto_owner_decision_canonical_three_network_check
  check(
    decision_code<>'ONCHAIN_THREE_NETWORK_SELECTION'
    or (
      decision_text='Три сети утверждаю.'
      and decision_hash='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
      and source_channel='owner_chat'
      and active
      and not activation_authorized
      and scope->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')
      and coalesce((scope->>'network_activation')::boolean,false)=false
    )
  );

update public.crypto_onchain_networks
set approved_by_owner=true,
    status='inactive',
    metadata=jsonb_build_object(
      'verification',metadata->'verification',
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
      'approval_source','owner_chat',
      'owner_approval_recorded',true,
      'activation_pending',true,
      'canonical_authority_migration','restore_canonical_owner_three_network_authority'
    ),
    updated_at=now()
where network_code in('TRON','BSC','SOLANA');

alter table public.crypto_onchain_networks
  add constraint crypto_onchain_canonical_three_network_approval_check
  check(network_code not in('TRON','BSC','SOLANA') or approved_by_owner);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_PROVIDER','in_progress',
  jsonb_build_object(
    'provider','onchain_direct',
    'wallet','trust_wallet_walletconnect',
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_approval_recorded',true,
    'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
    'settlement_asset','pending'
  ),
  jsonb_build_object(
    'decision_source','owner_chat',
    'decision_text_exact','Три сети утверждаю.',
    'original_message_timestamp_known',false,
    'canonical_owner_authority',true,
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
    'bsc_asset_contract_review_required',true
  ),
  'The owner explicitly approved TRON, BSC and Solana by writing “Три сети утверждаю.” The exact active immutable record and fingerprint are canonical. All networks remain inactive until the remaining asset, pricing, address, verifier and sandbox prerequisites are separately approved.'
);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency',
  jsonb_build_object(
    'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
  ),
  jsonb_build_object(
    'onchain_foundation',true,
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_approval_recorded',true,
    'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
    'canonical_owner_authority',true,
    'transaction_claim_lifecycle_hardened',true,
    'activation',false
  ),
  'The approved three-network sandbox scope remains disabled. Execution requires a settlement asset, prices, public addresses, verifier configuration and controlled-test authorization.'
);

alter table public.crypto_launch_requirements
  add constraint crypto_payment_provider_owner_decision_check
  check(
    code<>'PAYMENT_PROVIDER'
    or (
      status<>'decision_required'
      and decision_summary->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION'
      and decision_summary->>'decision_hash'='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
      and coalesce((decision_summary->>'network_approval_recorded')::boolean,false)
      and decision_summary->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')
    )
  );

create or replace function private.crypto_owner_decision_record_immutable()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','pg_temp'
as $$
begin
  raise exception 'Owner decision records are immutable' using errcode='55000';
end $$;

create trigger crypto_owner_decision_record_immutable
before update or delete on public.crypto_owner_decision_records
for each row execute function private.crypto_owner_decision_record_immutable();

create or replace function private.enforce_crypto_onchain_owner_decision_record()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_hash constant text:='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';
  v_valid boolean;
begin
  select exists(
    select 1 from public.crypto_owner_decision_records
    where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
      and decision_text='Три сети утверждаю.'
      and decision_hash=v_hash
      and source_channel='owner_chat'
      and active
      and not activation_authorized
  ) into v_valid;
  if new.network_code in('TRON','BSC','SOLANA') then
    if not v_valid or not new.approved_by_owner then
      raise exception 'Canonical owner-approved network cannot be removed or marked unapproved' using errcode='42501';
    end if;
    if new.metadata->>'decision_code'<>'ONCHAIN_THREE_NETWORK_SELECTION'
       or new.metadata->>'decision_hash'<>v_hash then
      raise exception 'Canonical owner decision metadata mismatch' using errcode='42501';
    end if;
  end if;
  return new;
end $$;

create trigger crypto_onchain_network_owner_approval_guard
before insert or update of approved_by_owner,metadata,network_code
on public.crypto_onchain_networks
for each row execute function private.enforce_crypto_onchain_owner_decision_record();

create or replace function private.enforce_crypto_payment_owner_decision_record()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_hash constant text:='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';
  v_valid boolean;
begin
  if new.code not in('PAYMENT_PROVIDER','PAYMENT_SANDBOX_E2E') then return new; end if;
  select exists(
    select 1 from public.crypto_owner_decision_records
    where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
      and decision_text='Три сети утверждаю.'
      and decision_hash=v_hash
      and source_channel='owner_chat'
      and active
      and not activation_authorized
  ) into v_valid;
  if not v_valid then raise exception 'Canonical owner decision record is missing' using errcode='42501'; end if;
  if new.code='PAYMENT_PROVIDER' then
    if new.status='decision_required' then
      raise exception 'Canonical three-network selection cannot return to decision_required' using errcode='42501';
    end if;
    if new.decision_summary->>'decision_code'<>'ONCHAIN_THREE_NETWORK_SELECTION'
       or new.decision_summary->>'decision_hash'<>v_hash
       or new.decision_summary->'approved_networks'<>jsonb_build_array('TRON','BSC','SOLANA')
       or not coalesce((new.decision_summary->>'network_approval_recorded')::boolean,false) then
      raise exception 'Canonical payment owner decision mismatch' using errcode='42501';
    end if;
  end if;
  return new;
end $$;

create trigger crypto_payment_owner_decision_provenance_guard
before insert or update of status,decision_summary,evidence,operator_note,decided_at,verified_at
on public.crypto_launch_requirements
for each row execute function private.enforce_crypto_payment_owner_decision_record();

create or replace function private.crypto_owner_decision_integrity_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path='public','private','pg_catalog','pg_temp'
as $$
declare
  v_hash constant text:='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';
  v_checks jsonb;v_failures integer;
begin
  with checks(code,violations) as (
    select 'exact_active_immutable_decision_record',case when exists(
      select 1 from public.crypto_owner_decision_records
      where decision_code='ONCHAIN_THREE_NETWORK_SELECTION' and decision_text='Три сети утверждаю.'
        and decision_hash=v_hash and source_channel='owner_chat' and active and not activation_authorized
    ) then 0 else 1 end
    union all
    select 'three_networks_approved_inactive',case when (select count(*) from public.crypto_onchain_networks
      where network_code in('TRON','BSC','SOLANA') and approved_by_owner and status='inactive'
        and metadata->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION' and metadata->>'decision_hash'=v_hash)=3 then 0 else 1 end
    union all
    select 'payment_requirement_matches_decision',case when exists(select 1 from public.crypto_launch_requirements
      where code='PAYMENT_PROVIDER' and status<>'decision_required'
        and decision_summary->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION'
        and decision_summary->>'decision_hash'=v_hash
        and decision_summary->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')) then 0 else 1 end
    union all
    select 'no_network_activation',case when (select count(*) from public.crypto_onchain_networks where status='active')=0 then 0 else 1 end
    union all
    select 'payment_adapter_disabled',case when exists(select 1 from public.crypto_billing_provider_adapters
      where provider='onchain' and desired_mode='disabled' and lifecycle_status='draft'
        and not checkout_enabled and not webhook_enabled and not recurring_enabled and not refunds_enabled) then 0 else 1 end
    union all
    select 'canonical_constraints_present',case when (
      select count(*) from pg_constraint where conname in(
        'crypto_owner_decision_canonical_three_network_check',
        'crypto_onchain_canonical_three_network_approval_check',
        'crypto_payment_provider_owner_decision_check'
      ))=3 then 0 else 1 end
  )
  select jsonb_agg(jsonb_build_object('code',code,'violations',violations,'passed',violations=0) order by code),
         sum(case when violations>0 then 1 else 0 end)
  into v_checks,v_failures from checks;
  return jsonb_build_object('state',case when v_failures=0 then 'healthy' else 'critical' end,'generated_at',now(),'total_checks',jsonb_array_length(v_checks),'failed_checks',v_failures,'checks',v_checks);
end $$;

alter table public.crypto_owner_decision_records enable row level security;
revoke all on table public.crypto_owner_decision_records from public,anon,authenticated;
revoke insert,update,delete on table public.crypto_owner_decision_records from service_role;
grant select on table public.crypto_owner_decision_records to service_role;

revoke all on function private.crypto_owner_decision_record_immutable() from public,anon,authenticated,service_role;
revoke all on function private.enforce_crypto_onchain_owner_decision_record() from public,anon,authenticated,service_role;
revoke all on function private.enforce_crypto_payment_owner_decision_record() from public,anon,authenticated,service_role;
revoke all on function private.crypto_owner_decision_integrity_snapshot() from public,anon,authenticated;
grant execute on function private.crypto_owner_decision_integrity_snapshot() to service_role;

comment on table public.crypto_owner_decision_records is 'Immutable owner decisions. ONCHAIN_THREE_NETWORK_SELECTION is canonical and can change only through a new explicit owner-authorized schema migration.';
comment on constraint crypto_onchain_canonical_three_network_approval_check on public.crypto_onchain_networks is 'TRON, BSC and SOLANA are owner-approved. This does not activate them.';
