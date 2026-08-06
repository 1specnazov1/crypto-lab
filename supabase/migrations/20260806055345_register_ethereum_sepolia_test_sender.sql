-- Register owner-controlled test sender accounts separately from production receiving addresses.
-- No secret material, mainnet activation, billing or entitlement linkage is allowed.

create table if not exists public.crypto_onchain_sandbox_sender_accounts (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'sandbox' check (environment='sandbox'),
  network_code text not null check (network_code in ('ETHEREUM','SOLANA')),
  address text not null,
  wallet_label text not null default 'CRYPTO LAB Test Sender',
  custody_model text not null default 'owner_signed_external_wallet' check (custody_model='owner_signed_external_wallet'),
  verified boolean not null default false,
  verification_method text,
  configured boolean not null default true,
  secret_material_received boolean not null default false check (secret_material_received=false),
  mainnet_authorized boolean not null default false check (mainnet_authorized=false),
  entitlement_capable boolean not null default false check (entitlement_capable=false),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(environment,network_code)
);

alter table public.crypto_onchain_sandbox_sender_accounts enable row level security;
revoke all on table public.crypto_onchain_sandbox_sender_accounts from public,anon,authenticated;
grant select,insert,update on table public.crypto_onchain_sandbox_sender_accounts to service_role;

drop policy if exists crypto_onchain_sandbox_sender_accounts_service_only_deny on public.crypto_onchain_sandbox_sender_accounts;
create policy crypto_onchain_sandbox_sender_accounts_service_only_deny
on public.crypto_onchain_sandbox_sender_accounts
for all to anon,authenticated
using(false)
with check(false);

insert into public.crypto_onchain_sandbox_sender_accounts(
  environment,network_code,address,wallet_label,custody_model,verified,verification_method,
  configured,secret_material_received,mainnet_authorized,entitlement_capable,evidence,created_at,updated_at
) values(
  'sandbox','ETHEREUM','0x4eadfbe9665265527e9a5d6bde6fb15a70f05555','CRYPTO LAB Test Sender',
  'owner_signed_external_wallet',true,'trust_wallet_receive_screen',true,false,false,false,
  jsonb_build_object(
    'network_name','Sepolia',
    'chain_id','11155111',
    'screen_confirmed',true,
    'same_as_production_receiver',false,
    'allowed_asset','USDC',
    'allowed_amount_base_units','10000',
    'allowed_amount_display','0.01 USDC',
    'decision_code','SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1',
    'decision_hash','5b43613baf3fa255e1c9c1b430d70c65cc534532492adcb64bb412599f792a2e',
    'signature_required_in_owner_wallet',true,
    'private_key_received',false,
    'seed_phrase_received',false
  ),now(),now()
)
on conflict(environment,network_code) do update set
  address=excluded.address,
  wallet_label=excluded.wallet_label,
  custody_model=excluded.custody_model,
  verified=excluded.verified,
  verification_method=excluded.verification_method,
  configured=true,
  secret_material_received=false,
  mainnet_authorized=false,
  entitlement_capable=false,
  evidence=excluded.evidence,
  updated_at=now();

update public.crypto_onchain_sandbox_cases
set evidence=evidence || jsonb_build_object(
      'source_wallet_address','0x4eadfbe9665265527e9a5d6bde6fb15a70f05555',
      'source_wallet_verified',true,
      'source_wallet_network','Sepolia',
      'source_wallet_custody','owner_signed_external_wallet',
      'source_wallet_pending',false,
      'test_usdc_funding_pending',true,
      'native_gas_funding_pending',true,
      'transaction_signature_pending',true
    ),
    updated_at=now()
where environment='sandbox' and network_code='ETHEREUM' and asset_code='USDC';

do $$
begin
  if not private.crypto_validate_onchain_address('ETHEREUM','0x4eadfbe9665265527e9a5d6bde6fb15a70f05555') then
    raise exception 'Invalid Ethereum sandbox sender address';
  end if;
  if '0x4eadfbe9665265527e9a5d6bde6fb15a70f05555'=(select address from public.crypto_onchain_receiving_addresses where network_code='ETHEREUM') then
    raise exception 'Sandbox sender must differ from production receiver';
  end if;
  if exists(select 1 from public.crypto_onchain_sandbox_sender_accounts where mainnet_authorized or entitlement_capable or secret_material_received) then
    raise exception 'Sandbox sender safety boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_invoices) or exists(select 1 from public.crypto_onchain_tx_claims) or exists(select 1 from public.crypto_onchain_tx_observations) then
    raise exception 'Production payment data changed';
  end if;
end $$;
