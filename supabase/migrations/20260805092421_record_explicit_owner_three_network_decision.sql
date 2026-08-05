create table if not exists public.crypto_owner_decision_records(
  id uuid primary key default gen_random_uuid(),
  decision_code text not null unique,
  decision_text text not null,
  decision_hash text not null unique,
  source_channel text not null,
  scope jsonb not null default '{}'::jsonb,
  activation_authorized boolean not null default false,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint crypto_owner_decision_code_check check(decision_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  constraint crypto_owner_decision_hash_check check(decision_hash ~ '^[0-9a-f]{64}$'),
  constraint crypto_owner_decision_source_check check(source_channel in('owner_chat','signed_document','admin_console')),
  constraint crypto_owner_decision_scope_check check(jsonb_typeof(scope)='object'),
  constraint crypto_owner_decision_text_check check(char_length(decision_text) between 1 and 500)
);

create or replace function private.crypto_owner_decision_record_immutable()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','pg_temp'
as $$
begin
  raise exception 'Owner decision records are immutable' using errcode='55000';
end $$;

revoke all on function private.crypto_owner_decision_record_immutable() from public,anon,authenticated,service_role;
drop trigger if exists crypto_owner_decision_record_immutable on public.crypto_owner_decision_records;
create trigger crypto_owner_decision_record_immutable
before update or delete on public.crypto_owner_decision_records
for each row execute function private.crypto_owner_decision_record_immutable();

alter table public.crypto_owner_decision_records enable row level security;
revoke all on table public.crypto_owner_decision_records from public,anon,authenticated;
grant select,insert on table public.crypto_owner_decision_records to service_role;
drop policy if exists crypto_owner_decision_records_direct_deny on public.crypto_owner_decision_records;
create policy crypto_owner_decision_records_direct_deny on public.crypto_owner_decision_records
as restrictive for all to anon,authenticated using(false) with check(false);

select set_config('app.crypto_owner_decision_authorized','true',true);

insert into public.crypto_owner_decision_records(
  decision_code,decision_text,decision_hash,source_channel,scope,activation_authorized
)
values(
  'ONCHAIN_THREE_NETWORK_SELECTION',
  'Три сети утверждаю.',
  encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
  'owner_chat',
  jsonb_build_object(
    'payment_rail','onchain_direct',
    'wallet_client','trust_wallet_walletconnect',
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_activation',false,
    'settlement_asset_selected',false,
    'pricing_selected',false,
    'receiving_addresses_configured',false,
    'original_message_timestamp_known',false,
    'recorded_by','autonomous_release_control'
  ),
  false
)
on conflict(decision_code) do nothing;

update public.crypto_onchain_networks
set approved_by_owner=true,
    status='inactive',
    metadata=(metadata-'owner_approved_at')||jsonb_build_object(
      'approval_source','owner_chat',
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash',encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
      'approval_recorded_at',now(),
      'activation_pending',true
    ),
    updated_at=now()
where network_code in('TRON','BSC','SOLANA');

select private.service_update_crypto_launch_requirement(
  'PAYMENT_PROVIDER','in_progress',
  jsonb_build_object(
    'provider','onchain_direct',
    'wallet','trust_wallet_walletconnect',
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_approval_recorded',true,
    'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'decision_hash',encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
    'settlement_asset','pending'
  ),
  jsonb_build_object(
    'decision_source','owner_chat',
    'decision_text_exact','Три сети утверждаю.',
    'decision_recorded_at',now(),
    'original_message_timestamp_known',false,
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
  'Owner explicitly approved TRON, BSC and Solana in chat. The exact decision text and SHA-256 fingerprint are recorded. Networks remain inactive until asset, pricing, public receiving addresses, verifier configuration and sandbox evidence are verified.'
);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency','{}'::jsonb,
  jsonb_build_object(
    'onchain_foundation',true,
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_approval_recorded',true,
    'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'decision_hash',encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
    'transaction_claim_lifecycle_hardened',true,
    'scenarios_extended',jsonb_build_array(
      'wrong_network','wrong_asset','underpayment','overpayment','duplicate_tx_hash',
      'duplicate_evidence','unfinalized_tx','finality_progression','finality_regression',
      'conflicting_observation','expired_invoice','late_transaction','existing_period_extension'
    ),
    'activation',false
  ),
  'The three networks are owner-approved but remain inactive. Sandbox execution is blocked until settlement asset, prices, public addresses and verifier configuration are supplied.'
);

select set_config('app.crypto_owner_decision_authorized','false',true);
