create table if not exists public.crypto_onchain_networks (
  network_code text primary key,
  display_name text not null,
  chain_family text not null,
  chain_reference text not null,
  native_fee_symbol text not null,
  finality_mode text not null,
  required_confirmations integer not null default 0,
  status text not null default 'inactive',
  approved_by_owner boolean not null default false,
  display_order integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_onchain_network_code_check check(network_code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  constraint crypto_onchain_chain_family_check check(chain_family in ('tron','evm','solana')),
  constraint crypto_onchain_finality_mode_check check(finality_mode in ('solidified','finalized')),
  constraint crypto_onchain_confirmations_check check(required_confirmations between 0 and 1000),
  constraint crypto_onchain_network_status_check check(status in ('inactive','ready','active','paused')),
  constraint crypto_onchain_network_metadata_check check(jsonb_typeof(metadata)='object')
);

create table if not exists public.crypto_onchain_assets (
  asset_code text primary key,
  display_name text not null,
  decimals integer not null,
  selected boolean not null default false,
  status text not null default 'decision_required',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_onchain_asset_code_check check(asset_code ~ '^[A-Z0-9]{2,12}$'),
  constraint crypto_onchain_asset_decimals_check check(decimals between 0 and 18),
  constraint crypto_onchain_asset_status_check check(status in ('decision_required','selected_inactive','active','paused')),
  constraint crypto_onchain_asset_metadata_check check(jsonb_typeof(metadata)='object')
);
create unique index if not exists crypto_onchain_one_selected_asset_idx on public.crypto_onchain_assets((selected)) where selected;

create table if not exists public.crypto_onchain_network_assets (
  network_code text not null references public.crypto_onchain_networks(network_code) on update cascade on delete restrict,
  asset_code text not null references public.crypto_onchain_assets(asset_code) on update cascade on delete restrict,
  token_standard text not null,
  token_identifier text,
  issuer_model text not null,
  availability_status text not null,
  official_source_url text,
  verified_at timestamptz,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(network_code,asset_code),
  constraint crypto_onchain_token_standard_check check(token_standard in ('TRC20','BEP20','SPL')),
  constraint crypto_onchain_issuer_model_check check(issuer_model in ('direct_issuer','pegged_token','not_available','pending_review')),
  constraint crypto_onchain_availability_check check(availability_status in ('available_verified','issuer_review_required','unsupported_official','pending_decision')),
  constraint crypto_onchain_network_asset_metadata_check check(jsonb_typeof(metadata)='object'),
  constraint crypto_onchain_enabled_contract_check check(not enabled or (availability_status='available_verified' and verified_at is not null and token_identifier is not null))
);

create table if not exists public.crypto_onchain_receiving_addresses (
  network_code text primary key references public.crypto_onchain_networks(network_code) on update cascade on delete restrict,
  address text not null,
  label text not null default 'CRYPTO LAB',
  verified boolean not null default false,
  active boolean not null default false,
  verified_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_onchain_receiving_evidence_check check(jsonb_typeof(evidence)='object'),
  constraint crypto_onchain_receiving_active_check check(not active or (verified and verified_at is not null))
);

create table if not exists public.crypto_onchain_plan_pricing (
  plan text not null references public.crypto_plan_limits(plan) on update cascade on delete restrict,
  asset_code text not null references public.crypto_onchain_assets(asset_code) on update cascade on delete restrict,
  pricing_mode text not null,
  accounting_currency text not null,
  accounting_amount_minor integer not null,
  fixed_asset_base_units numeric(78,0),
  invoice_ttl_seconds integer not null default 1800,
  discriminator_max_base_units integer not null default 999,
  active boolean not null default false,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(plan,asset_code),
  constraint crypto_onchain_pricing_mode_check check(pricing_mode in ('fixed_asset','fiat_pegged')),
  constraint crypto_onchain_accounting_currency_check check(accounting_currency ~ '^[A-Z]{3}$'),
  constraint crypto_onchain_accounting_amount_check check(accounting_amount_minor>0),
  constraint crypto_onchain_fixed_amount_check check((pricing_mode='fixed_asset' and fixed_asset_base_units is not null and fixed_asset_base_units>0) or (pricing_mode='fiat_pegged' and fixed_asset_base_units is null)),
  constraint crypto_onchain_ttl_check check(invoice_ttl_seconds between 300 and 86400),
  constraint crypto_onchain_discriminator_check check(discriminator_max_base_units between 0 and 9999),
  constraint crypto_onchain_pricing_active_check check(not active or approved_at is not null),
  constraint crypto_onchain_pricing_metadata_check check(jsonb_typeof(metadata)='object')
);

create table if not exists public.crypto_onchain_fx_quotes (
  id bigint generated always as identity primary key,
  fiat_currency text not null,
  asset_code text not null references public.crypto_onchain_assets(asset_code) on update cascade on delete restrict,
  asset_base_units numeric(78,0) not null,
  fiat_minor_units bigint not null,
  source text not null,
  source_reference text,
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  evidence_hash text not null,
  created_at timestamptz not null default now(),
  constraint crypto_onchain_quote_currency_check check(fiat_currency ~ '^[A-Z]{3}$'),
  constraint crypto_onchain_quote_amounts_check check(asset_base_units>0 and fiat_minor_units>0),
  constraint crypto_onchain_quote_time_check check(expires_at>observed_at and expires_at<=observed_at+interval '1 hour'),
  constraint crypto_onchain_quote_hash_check check(evidence_hash ~ '^[0-9a-f]{64}$')
);
create index if not exists crypto_onchain_fx_quotes_lookup_idx on public.crypto_onchain_fx_quotes(fiat_currency,asset_code,expires_at desc);

create table if not exists public.crypto_onchain_invoices (
  id uuid primary key default gen_random_uuid(),
  billing_order_id uuid not null unique references public.crypto_billing_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null references public.crypto_plan_limits(plan) on update cascade on delete restrict,
  network_code text not null references public.crypto_onchain_networks(network_code) on update cascade on delete restrict,
  asset_code text not null references public.crypto_onchain_assets(asset_code) on update cascade on delete restrict,
  token_identifier text not null,
  receiving_address text not null,
  accounting_currency text not null,
  accounting_amount_minor integer not null,
  base_amount_base_units numeric(78,0) not null,
  discriminator_base_units integer not null default 0,
  amount_due_base_units numeric(78,0) generated always as (base_amount_base_units+discriminator_base_units) stored,
  status text not null default 'awaiting_payment',
  expires_at timestamptz not null,
  tx_hash text,
  sender_address text,
  block_reference text,
  finality_status text,
  observed_amount_base_units numeric(78,0),
  observed_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_onchain_invoice_accounting_currency_check check(accounting_currency ~ '^[A-Z]{3}$'),
  constraint crypto_onchain_invoice_accounting_amount_check check(accounting_amount_minor>0),
  constraint crypto_onchain_invoice_base_amount_check check(base_amount_base_units>0),
  constraint crypto_onchain_invoice_discriminator_check check(discriminator_base_units between 0 and 9999),
  constraint crypto_onchain_invoice_status_check check(status in ('awaiting_payment','observed','confirming','paid','expired','underpaid','overpaid','wrong_asset','wrong_recipient','failed','review','canceled')),
  constraint crypto_onchain_invoice_time_check check(expires_at>created_at and expires_at<=created_at+interval '1 day'),
  constraint crypto_onchain_invoice_metadata_check check(jsonb_typeof(metadata)='object')
);
create unique index if not exists crypto_onchain_invoice_tx_unique_idx on public.crypto_onchain_invoices(network_code,tx_hash) where tx_hash is not null;
create unique index if not exists crypto_onchain_invoice_open_amount_idx on public.crypto_onchain_invoices(network_code,asset_code,receiving_address,amount_due_base_units) where status in ('awaiting_payment','observed','confirming');
create index if not exists crypto_onchain_invoice_user_idx on public.crypto_onchain_invoices(user_id,created_at desc);
create index if not exists crypto_onchain_invoice_expiry_idx on public.crypto_onchain_invoices(expires_at) where status in ('awaiting_payment','observed','confirming');

create table if not exists public.crypto_onchain_tx_observations (
  id bigint generated always as identity primary key,
  invoice_id uuid not null references public.crypto_onchain_invoices(id) on delete restrict,
  network_code text not null references public.crypto_onchain_networks(network_code) on update cascade on delete restrict,
  tx_hash text not null,
  sender_address text,
  recipient_address text not null,
  asset_code text not null,
  token_identifier text not null,
  amount_base_units numeric(78,0) not null,
  block_reference text,
  finality_status text not null,
  execution_success boolean not null,
  verifier_source text not null,
  verifier_evidence_hash text not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(network_code,tx_hash),
  constraint crypto_onchain_observation_asset_check check(asset_code ~ '^[A-Z0-9]{2,12}$'),
  constraint crypto_onchain_observation_amount_check check(amount_base_units>=0),
  constraint crypto_onchain_observation_finality_check check(finality_status in ('unconfirmed','confirmed','solidified','finalized')),
  constraint crypto_onchain_observation_source_check check(verifier_source ~ '^[a-z0-9][a-z0-9_.-]{1,63}$'),
  constraint crypto_onchain_observation_hash_check check(verifier_evidence_hash ~ '^[0-9a-f]{64}$')
);

insert into public.crypto_onchain_networks(network_code,display_name,chain_family,chain_reference,native_fee_symbol,finality_mode,required_confirmations,status,approved_by_owner,display_order,metadata)
values
('TRON','TRON (TRC20)','tron','mainnet','TRX','solidified',19,'inactive',true,1,jsonb_build_object('verification','walletsolidity confirmed state','owner_approved_at','2026-08-05T08:43:00Z')),
('BSC','BNB Smart Chain (BEP20)','evm','56','BNB','finalized',2,'inactive',true,2,jsonb_build_object('verification','finalized JSON-RPC block tag','owner_approved_at','2026-08-05T08:43:00Z')),
('SOLANA','Solana (SPL)','solana','mainnet-beta','SOL','finalized',0,'inactive',true,3,jsonb_build_object('verification','finalized commitment','owner_approved_at','2026-08-05T08:43:00Z'))
on conflict(network_code) do update set display_name=excluded.display_name,chain_family=excluded.chain_family,chain_reference=excluded.chain_reference,native_fee_symbol=excluded.native_fee_symbol,finality_mode=excluded.finality_mode,required_confirmations=excluded.required_confirmations,approved_by_owner=true,display_order=excluded.display_order,metadata=public.crypto_onchain_networks.metadata||excluded.metadata,updated_at=now();

insert into public.crypto_onchain_assets(asset_code,display_name,decimals,selected,status,metadata)
values
('USDT','Tether USD₮',6,false,'decision_required',jsonb_build_object('issuer','Tether','decision_pending',true)),
('USDC','USD Coin',6,false,'decision_required',jsonb_build_object('issuer','Circle','decision_pending',true))
on conflict(asset_code) do update set display_name=excluded.display_name,decimals=excluded.decimals,metadata=public.crypto_onchain_assets.metadata||excluded.metadata,updated_at=now();

insert into public.crypto_onchain_network_assets(network_code,asset_code,token_standard,token_identifier,issuer_model,availability_status,official_source_url,verified_at,enabled,metadata)
values
('TRON','USDT','TRC20','TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t','direct_issuer','available_verified','https://tether.to/en/supported-protocols/',now(),false,jsonb_build_object('official_issuer_contract',true)),
('SOLANA','USDT','SPL','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB','direct_issuer','available_verified','https://tether.to/en/supported-protocols/',now(),false,jsonb_build_object('official_issuer_contract',true)),
('BSC','USDT','BEP20',null,'pegged_token','issuer_review_required','https://tether.to/en/supported-protocols/',null,false,jsonb_build_object('reason','Tether official protocol page does not publish a USDt BSC contract; exact pegged token requires owner acceptance and contract verification')),
('SOLANA','USDC','SPL','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','direct_issuer','available_verified','https://developers.circle.com/stablecoins/usdc-contract-addresses',now(),false,jsonb_build_object('official_issuer_contract',true)),
('TRON','USDC','TRC20',null,'not_available','unsupported_official','https://developers.circle.com/stablecoins/usdc-contract-addresses',null,false,jsonb_build_object('reason','Circle official mainnet list does not include TRON')),
('BSC','USDC','BEP20',null,'not_available','unsupported_official','https://developers.circle.com/stablecoins/usdc-contract-addresses',null,false,jsonb_build_object('reason','Circle official mainnet list does not include BNB Smart Chain'))
on conflict(network_code,asset_code) do update set token_standard=excluded.token_standard,token_identifier=excluded.token_identifier,issuer_model=excluded.issuer_model,availability_status=excluded.availability_status,official_source_url=excluded.official_source_url,verified_at=excluded.verified_at,enabled=false,metadata=excluded.metadata,updated_at=now();

insert into public.crypto_billing_provider_adapters(provider,contract_version,desired_mode,lifecycle_status,checkout_strategy,webhook_strategy,capabilities,required_secret_names,checkout_enabled,webhook_enabled,recurring_enabled,refunds_enabled,last_verification)
values('onchain',1,'disabled','draft','wallet_transaction','verified_chain_observation',jsonb_build_object('networks',jsonb_build_array('TRON','BSC','SOLANA'),'direct_wallet',true,'walletconnect',true,'qr',true,'automatic_entitlement',true,'recurring_debit',false),array[]::text[],false,false,false,false,jsonb_build_object('reason','Asset, pricing, receiving addresses and RPC/verifier configuration pending'))
on conflict(provider) do update set contract_version=excluded.contract_version,desired_mode='disabled',lifecycle_status='draft',checkout_strategy=excluded.checkout_strategy,webhook_strategy=excluded.webhook_strategy,capabilities=excluded.capabilities,required_secret_names=excluded.required_secret_names,checkout_enabled=false,webhook_enabled=false,recurring_enabled=false,refunds_enabled=false,last_verification=excluded.last_verification,updated_at=now();
