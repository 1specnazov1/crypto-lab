-- CRYPTO LAB v79 build 7930
-- Prepare Ethereum/TRON/Solana multi-asset checkout while keeping every payment path disabled.
-- Current owner authority: USDT + USDC selected; payment activation explicitly denied.

create or replace function private.crypto_validate_onchain_address(p_network text,p_address text)
returns boolean
language sql immutable
set search_path='pg_catalog','pg_temp'
as $$
  select case p_network
    when 'ETHEREUM' then p_address ~ '^0x[0-9a-fA-F]{40}$'
    when 'TRON' then p_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
    when 'BSC' then p_address ~ '^0x[0-9a-fA-F]{40}$'
    when 'SOLANA' then p_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    else false end
$$;

create or replace function private.crypto_validate_onchain_tx_hash(p_network text,p_tx_hash text)
returns boolean
language sql immutable
set search_path='pg_catalog','pg_temp'
as $$
  select case
    when p_network in('ETHEREUM','BSC') then p_tx_hash ~ '^0x[0-9a-fA-F]{64}$'
    when p_network='TRON' then p_tx_hash ~ '^[0-9a-fA-F]{64}$'
    when p_network='SOLANA' then p_tx_hash ~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$'
    else false end
$$;

create or replace function private.crypto_normalize_onchain_value(p_network text,p_value text)
returns text
language sql immutable
set search_path='pg_catalog','pg_temp'
as $$ select case when p_network in('ETHEREUM','BSC') then lower(trim(p_value)) else trim(p_value) end $$;

create or replace function private.crypto_onchain_finality_rank(p_network text,p_status text)
returns integer
language sql immutable
set search_path='pg_catalog','pg_temp'
as $$
  select case
    when p_network='TRON' and p_status='unconfirmed' then 0
    when p_network='TRON' and p_status='confirmed' then 1
    when p_network='TRON' and p_status='solidified' then 2
    when p_network in('ETHEREUM','BSC','SOLANA') and p_status='unconfirmed' then 0
    when p_network in('ETHEREUM','BSC','SOLANA') and p_status='confirmed' then 1
    when p_network in('ETHEREUM','BSC','SOLANA') and p_status='finalized' then 2
    else -1 end
$$;

create or replace function private.crypto_onchain_tx_identity_guard()
returns trigger
language plpgsql security definer
set search_path='private','pg_catalog','pg_temp'
as $$
begin
  if not private.crypto_validate_onchain_tx_hash(new.network_code,new.tx_hash) then
    raise exception 'Invalid transaction identifier for network' using errcode='22023';
  end if;
  return new;
end $$;

drop trigger if exists crypto_onchain_claim_tx_identity_guard on public.crypto_onchain_tx_claims;
create trigger crypto_onchain_claim_tx_identity_guard
before insert or update of network_code,tx_hash on public.crypto_onchain_tx_claims
for each row execute function private.crypto_onchain_tx_identity_guard();

drop trigger if exists crypto_onchain_observation_tx_identity_guard on public.crypto_onchain_tx_observations;
create trigger crypto_onchain_observation_tx_identity_guard
before insert on public.crypto_onchain_tx_observations
for each row execute function private.crypto_onchain_tx_identity_guard();

create or replace function private.service_create_crypto_onchain_invoice(
  p_user_id uuid,p_plan text,p_network_code text,p_asset_code text
)
returns jsonb
language plpgsql security definer
set search_path='public','private','extensions','pg_temp'
as $$
declare
  v_network public.crypto_onchain_networks%rowtype;
  v_asset public.crypto_onchain_assets%rowtype;
  v_na public.crypto_onchain_network_assets%rowtype;
  v_address public.crypto_onchain_receiving_addresses%rowtype;
  v_price public.crypto_onchain_plan_pricing%rowtype;
  v_quote public.crypto_onchain_fx_quotes%rowtype;
  v_invoice_id uuid:=gen_random_uuid();
  v_order_id uuid:=gen_random_uuid();
  v_base numeric(78,0);v_disc integer;v_expires timestamptz;
begin
  if not exists(select 1 from auth.users where id=p_user_id) then
    raise exception 'User not found' using errcode='P0002';
  end if;
  if p_plan not in('BASIC','PRO') then
    raise exception 'Paid plan required' using errcode='22023';
  end if;
  if p_asset_code not in('USDT','USDC') then
    raise exception 'Unsupported settlement asset' using errcode='22023';
  end if;
  select * into v_network from public.crypto_onchain_networks
  where network_code=p_network_code and status='active' and approved_by_owner;
  if not found then raise exception 'On-chain network is not active' using errcode='55000'; end if;
  select * into v_asset from public.crypto_onchain_assets
  where asset_code=p_asset_code and selected and status='active';
  if not found then raise exception 'Settlement asset is not active' using errcode='55000'; end if;
  select * into v_na from public.crypto_onchain_network_assets
  where network_code=p_network_code and asset_code=p_asset_code and enabled
    and availability_status='available_verified' and verified_at is not null and token_identifier is not null;
  if not found then raise exception 'Settlement asset is unavailable on selected network' using errcode='55000'; end if;
  select * into v_address from public.crypto_onchain_receiving_addresses
  where network_code=p_network_code and active and verified and verified_at is not null;
  if not found or not private.crypto_validate_onchain_address(p_network_code,v_address.address) then
    raise exception 'Receiving address is not ready' using errcode='55000';
  end if;
  select * into v_price from public.crypto_onchain_plan_pricing
  where plan=p_plan and asset_code=p_asset_code and active and approved_at is not null;
  if not found then raise exception 'On-chain pricing is not active' using errcode='55000'; end if;
  if v_price.pricing_mode='fixed_asset' then
    v_base:=v_price.fixed_asset_base_units;
  else
    select * into v_quote from public.crypto_onchain_fx_quotes
    where fiat_currency=v_price.accounting_currency and asset_code=p_asset_code and expires_at>now()
    order by observed_at desc limit 1;
    if not found then raise exception 'Fresh settlement quote is unavailable' using errcode='55000'; end if;
    v_base:=ceil(v_price.accounting_amount_minor::numeric*v_quote.asset_base_units/v_quote.fiat_minor_units);
  end if;
  v_disc:=case when v_price.discriminator_max_base_units=0 then 0
    else 1+mod((hashtextextended(v_invoice_id::text,7930)&9223372036854775807),v_price.discriminator_max_base_units)::integer end;
  v_expires:=now()+make_interval(secs=>v_price.invoice_ttl_seconds);
  insert into public.crypto_billing_orders(
    id,user_id,plan,currency,amount_minor,provider,provider_order_id,status,expires_at,metadata,billing_interval,idempotency_key
  ) values(
    v_order_id,p_user_id,p_plan,v_price.accounting_currency,v_price.accounting_amount_minor,'onchain',v_invoice_id::text,
    'pending',v_expires,jsonb_build_object('settlement_asset',p_asset_code,'network',p_network_code,'invoice_id',v_invoice_id,
    'explicit_asset_selection',true,'automatic_renewal',false),'month',v_invoice_id::text
  );
  insert into public.crypto_onchain_invoices(
    id,billing_order_id,user_id,plan,network_code,asset_code,token_identifier,receiving_address,
    accounting_currency,accounting_amount_minor,base_amount_base_units,discriminator_base_units,expires_at,metadata
  ) values(
    v_invoice_id,v_order_id,p_user_id,p_plan,p_network_code,p_asset_code,v_na.token_identifier,v_address.address,
    v_price.accounting_currency,v_price.accounting_amount_minor,v_base,v_disc,v_expires,
    jsonb_build_object('pricing_mode',v_price.pricing_mode,'asset_decimals',v_asset.decimals,'finality_mode',v_network.finality_mode,
    'required_confirmations',v_network.required_confirmations,'explicit_asset_selection',true)
  );
  return jsonb_build_object('ok',true,'invoice_id',v_invoice_id,'billing_order_id',v_order_id,
    'network_code',p_network_code,'asset_code',p_asset_code,'amount_due_base_units',(v_base+v_disc)::text,
    'decimals',v_asset.decimals,'receiving_address',v_address.address,'token_identifier',v_na.token_identifier,
    'expires_at',v_expires,'native_fee_symbol',v_network.native_fee_symbol,'automatic_renewal',false);
end $$;

revoke all on function private.service_create_crypto_onchain_invoice(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.service_create_crypto_onchain_invoice(uuid,text,text,text) to service_role;

create or replace function private.service_create_crypto_onchain_invoice(
  p_user_id uuid,p_plan text,p_network_code text
)
returns jsonb
language plpgsql security definer
set search_path='public','private','pg_temp'
as $$
declare v_asset text;v_count integer;
begin
  select count(*),min(na.asset_code) into v_count,v_asset
  from public.crypto_onchain_network_assets na
  join public.crypto_onchain_assets a using(asset_code)
  where na.network_code=p_network_code and na.enabled and na.availability_status='available_verified'
    and na.verified_at is not null and na.token_identifier is not null
    and a.selected and a.status='active';
  if v_count=0 then raise exception 'No active settlement asset is available for the network' using errcode='55000'; end if;
  if v_count<>1 then raise exception 'Explicit settlement asset selection is required' using errcode='22023'; end if;
  return private.service_create_crypto_onchain_invoice(p_user_id,p_plan,p_network_code,v_asset);
end $$;

revoke all on function private.service_create_crypto_onchain_invoice(uuid,text,text) from public,anon,authenticated;
grant execute on function private.service_create_crypto_onchain_invoice(uuid,text,text) to service_role;

create or replace function private.crypto_onchain_activation_readiness()
returns jsonb
language plpgsql stable security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_owner_decision boolean;v_activation_authorized boolean;
  v_selected_assets integer;v_active_assets integer;
  v_approved_networks integer;v_active_networks integer;
  v_supported_pairs integer;v_enabled_pairs integer;
  v_active_addresses integer;v_draft_prices integer;v_active_prices integer;
  v_verified_requirements integer;v_sandbox_verified boolean;
  v_configuration_ready boolean;v_activation_ready boolean;
begin
  select exists(select 1 from public.crypto_owner_decision_records
    where decision_code='ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION'
      and decision_hash='df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750'
      and active),
    coalesce(bool_or(activation_authorized),false)
  into v_owner_decision,v_activation_authorized
  from public.crypto_owner_decision_records
  where decision_code='ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION';

  select count(*) filter(where selected and status in('selected_inactive','active')),
         count(*) filter(where selected and status='active')
  into v_selected_assets,v_active_assets
  from public.crypto_onchain_assets where asset_code in('USDT','USDC');

  select count(*) filter(where approved_by_owner),count(*) filter(where approved_by_owner and status='active')
  into v_approved_networks,v_active_networks
  from public.crypto_onchain_networks where network_code in('ETHEREUM','TRON','SOLANA');

  select count(*) filter(where availability_status='available_verified' and verified_at is not null and token_identifier is not null),
         count(*) filter(where enabled and availability_status='available_verified' and verified_at is not null and token_identifier is not null)
  into v_supported_pairs,v_enabled_pairs
  from public.crypto_onchain_network_assets
  where network_code in('ETHEREUM','TRON','SOLANA') and asset_code in('USDT','USDC');

  select count(*) into v_active_addresses from public.crypto_onchain_receiving_addresses
  where network_code in('ETHEREUM','TRON','SOLANA') and active and verified and verified_at is not null;

  select count(*) filter(where not active),count(*) filter(where active and approved_at is not null)
  into v_draft_prices,v_active_prices
  from public.crypto_onchain_plan_pricing
  where plan in('BASIC','PRO') and asset_code in('USDT','USDC');

  select count(*) into v_verified_requirements from public.crypto_launch_requirements
  where code in('PRICING_MODEL','MERCHANT_CREDENTIALS','REFUND_POLICY') and status='verified';
  select coalesce(status='verified',false) into v_sandbox_verified
  from public.crypto_launch_requirements where code='PAYMENT_SANDBOX_E2E';
  v_sandbox_verified:=coalesce(v_sandbox_verified,false);

  v_configuration_ready:=v_owner_decision and v_selected_assets=2 and v_active_assets=2
    and v_approved_networks=3 and v_active_networks=3 and v_supported_pairs=5 and v_enabled_pairs=5
    and v_active_addresses=3 and v_active_prices=4 and v_verified_requirements=3;
  v_activation_ready:=v_configuration_ready and v_sandbox_verified and v_activation_authorized;

  return jsonb_build_object(
    'owner_decision_present',v_owner_decision,'payment_activation_authorized',v_activation_authorized,
    'selected_assets',jsonb_build_array('USDT','USDC'),'selected_asset_count',v_selected_assets,
    'active_asset_count',v_active_assets,'approved_network_count',v_approved_networks,'active_network_count',v_active_networks,
    'official_supported_pair_count',v_supported_pairs,'enabled_network_asset_count',v_enabled_pairs,
    'active_receiving_address_count',v_active_addresses,'draft_plan_price_count',v_draft_prices,
    'active_plan_price_count',v_active_prices,'verified_configuration_requirements',v_verified_requirements,
    'sandbox_verified',v_sandbox_verified,'configuration_ready',v_configuration_ready,'activation_ready',v_activation_ready,
    'unsupported_official_pairs',jsonb_build_array('TRON_USDC')
  );
end $$;

create or replace function private.crypto_owner_decision_integrity_snapshot()
returns jsonb
language plpgsql stable security definer
set search_path='public','private','pg_catalog','pg_temp'
as $$
declare v_checks jsonb;v_failures integer;
begin
  with checks(code,violations) as (
    select 'current_owner_decision',case when exists(select 1 from public.crypto_owner_decision_records
      where decision_code='ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION'
        and decision_text='USDT, USDC утверждаю для Ethereum TRON и Solana. Активацию платежей не разрешаю.'
        and decision_hash='df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750'
        and source_channel='owner_chat' and active and not activation_authorized) then 0 else 1 end
    union all select 'current_authority_event',case when exists(select 1 from public.crypto_owner_decision_authority_events
      where decision_code='ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION' and event_type='confirmed'
        and authority_state='effective' and decision_text_hash='df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750') then 0 else 1 end
    union all select 'previous_decision_superseded',case when exists(select 1 from public.crypto_owner_decision_records
      where decision_code='ONCHAIN_THREE_NETWORK_SELECTION' and not active and not activation_authorized) then 0 else 1 end
    union all select 'networks_selected_inactive',case when (select count(*) from public.crypto_onchain_networks
      where network_code in('ETHEREUM','TRON','SOLANA') and approved_by_owner and status='inactive')=3 then 0 else 1 end
    union all select 'bsc_unapproved_inactive',case when exists(select 1 from public.crypto_onchain_networks
      where network_code='BSC' and not approved_by_owner and status='inactive') then 0 else 1 end
    union all select 'assets_selected_inactive',case when (select count(*) from public.crypto_onchain_assets
      where asset_code in('USDT','USDC') and selected and status='selected_inactive')=2 then 0 else 1 end
    union all select 'supported_pairs_disabled',case when (select count(*) from public.crypto_onchain_network_assets
      where network_code in('ETHEREUM','TRON','SOLANA') and asset_code in('USDT','USDC') and enabled)=0 then 0 else 1 end
    union all select 'tron_usdc_unsupported',case when exists(select 1 from public.crypto_onchain_network_assets
      where network_code='TRON' and asset_code='USDC' and availability_status='unsupported_official'
        and token_identifier is null and not enabled) then 0 else 1 end
    union all select 'adapter_disabled',case when exists(select 1 from public.crypto_billing_provider_adapters
      where provider='onchain' and desired_mode='disabled' and lifecycle_status='draft'
        and not checkout_enabled and not webhook_enabled and not recurring_enabled and not refunds_enabled) then 0 else 1 end
    union all select 'payment_data_zero',case when
      (select count(*) from public.crypto_onchain_invoices)=0 and (select count(*) from public.crypto_onchain_tx_claims)=0
      and (select count(*) from public.crypto_onchain_tx_observations)=0 then 0 else 1 end
    union all select 'current_constraints_present',case when (select count(*) from pg_constraint where conname in(
      'crypto_owner_decision_current_network_asset_check','crypto_onchain_owner_selected_network_state_check',
      'crypto_onchain_owner_selected_asset_state_check','crypto_onchain_owner_selected_pairs_disabled_check',
      'crypto_onchain_adapter_owner_activation_denied_check'))=5 then 0 else 1 end
  )
  select jsonb_agg(jsonb_build_object('code',code,'violations',violations,'passed',violations=0) order by code),
    sum(case when violations>0 then 1 else 0 end) into v_checks,v_failures from checks;
  return jsonb_build_object('state',case when v_failures=0 then 'healthy' else 'critical' end,
    'generated_at',now(),'total_checks',jsonb_array_length(v_checks),'failed_checks',v_failures,'checks',v_checks);
end $$;

insert into public.crypto_onchain_plan_pricing(
  plan,asset_code,pricing_mode,accounting_currency,accounting_amount_minor,fixed_asset_base_units,
  invoice_ttl_seconds,discriminator_max_base_units,active,approved_at,metadata
) values
('BASIC','USDT','fiat_pegged','UAH',39900,null,1800,999,false,null,jsonb_build_object('state','owner_decision_required','proposal_amount_uah',399,'owner_approved',false,'activation_authorized',false)),
('BASIC','USDC','fiat_pegged','UAH',39900,null,1800,999,false,null,jsonb_build_object('state','owner_decision_required','proposal_amount_uah',399,'owner_approved',false,'activation_authorized',false)),
('PRO','USDT','fiat_pegged','UAH',79900,null,1800,999,false,null,jsonb_build_object('state','owner_decision_required','proposal_amount_uah',799,'owner_approved',false,'activation_authorized',false)),
('PRO','USDC','fiat_pegged','UAH',79900,null,1800,999,false,null,jsonb_build_object('state','owner_decision_required','proposal_amount_uah',799,'owner_approved',false,'activation_authorized',false))
on conflict(plan,asset_code) do update set
  pricing_mode=excluded.pricing_mode,accounting_currency=excluded.accounting_currency,
  accounting_amount_minor=excluded.accounting_amount_minor,fixed_asset_base_units=null,
  invoice_ttl_seconds=excluded.invoice_ttl_seconds,discriminator_max_base_units=excluded.discriminator_max_base_units,
  active=false,approved_at=null,metadata=excluded.metadata,updated_at=now();

insert into public.crypto_plan_prices(plan,currency,billing_interval,amount_minor,provider,active)
values
('BASIC','UAH','month',39900,'onchain_candidate',false),
('PRO','UAH','month',79900,'onchain_candidate',false)
on conflict(plan,currency,billing_interval) do update set
  amount_minor=excluded.amount_minor,provider='onchain_candidate',active=false,updated_at=now();

alter table public.crypto_onchain_plan_pricing drop constraint if exists crypto_onchain_pricing_activation_denied_by_owner;
alter table public.crypto_onchain_plan_pricing
  add constraint crypto_onchain_pricing_activation_denied_by_owner check(not active);

alter table public.crypto_plan_prices drop constraint if exists crypto_paid_plan_activation_denied_by_owner;
alter table public.crypto_plan_prices
  add constraint crypto_paid_plan_activation_denied_by_owner check(plan='FREE' or not active);

alter table public.crypto_onchain_receiving_addresses drop constraint if exists crypto_onchain_address_activation_denied_by_owner;
alter table public.crypto_onchain_receiving_addresses
  add constraint crypto_onchain_address_activation_denied_by_owner check(not active);

update public.crypto_launch_requirements
set status='external_input_required',decision_required=false,sensitive_input_required=false,physical_action_required=false,
  evidence=jsonb_build_object(
    'addresses_configured',false,'private_keys_required',false,'public_addresses_are_not_secrets',true,
    'required_public_addresses',jsonb_build_array('ETHEREUM','TRON','SOLANA'),
    'address_validation_prepared',true,'rpc_or_indexer_configuration_pending',true
  ),
  operator_note='Requires three public receiving addresses for Ethereum, TRON and Solana plus verifier/RPC configuration. Never provide seed phrases, private keys or wallet passwords.',
  updated_at=now()
where code='MERCHANT_CREDENTIALS';

update public.crypto_launch_requirements
set status='decision_required',decision_required=true,
  decision_summary=jsonb_build_object(
    'proposal_prepared',true,'currency','UAH','billing_interval','month',
    'basic_amount_minor',39900,'pro_amount_minor',79900,'owner_approved',false,'activation_authorized',false
  ),
  evidence=jsonb_build_object(
    'draft_onchain_price_rows',4,'active_onchain_price_rows',0,'selected_assets',jsonb_build_array('USDT','USDC'),
    'pricing_mode','fiat_pegged','annual_deferred',true,'recommended_currency','UAH',
    'recommended_interval','month','recommended_basic_amount_minor',39900,'recommended_pro_amount_minor',79900
  ),
  operator_note='Draft monthly pricing is prepared for both USDT and USDC. No price is approved or active; owner decision is required.',
  decided_at=null,verified_at=null,updated_at=now()
where code='PRICING_MODEL';

insert into public.crypto_launch_requirements(
  code,phase,title,description,owner_type,status,weight,dependencies,decision_required,
  sensitive_input_required,physical_action_required,decision_summary,evidence,operator_note
) values(
  'ONCHAIN_ASSET_ROUTING','commercial','Маршрутизация сети и актива',
  'Explicit network and settlement-asset selection with no silent fallback.',
  'autonomous','ready',20,array['PAYMENT_PROVIDER'],false,false,false,
  jsonb_build_object('policy','explicit_pair_selection','fallback_allowed',false,'invoice_pair_immutable',true),
  jsonb_build_object('supported_pairs',jsonb_build_array('ETHEREUM_USDT','ETHEREUM_USDC','TRON_USDT','SOLANA_USDT','SOLANA_USDC'),
    'unsupported_pairs',jsonb_build_array('TRON_USDC'),'legacy_three_argument_service_fail_closed',true,
    'ethereum_address_validation',true,'ethereum_transaction_validation',true),
  'The checkout must require an explicit supported network/asset pair. TRON USDC is never substituted automatically.'
) on conflict(code) do update set
  status='ready',decision_required=false,sensitive_input_required=false,physical_action_required=false,
  decision_summary=excluded.decision_summary,evidence=excluded.evidence,operator_note=excluded.operator_note,updated_at=now();

update public.crypto_launch_requirements
set evidence=evidence || jsonb_build_object(
    'multi_asset_invoice_service_prepared',true,'explicit_asset_selection_required',true,
    'ethereum_address_validation_prepared',true,'ethereum_transaction_validation_prepared',true,
    'draft_price_row_count',4,'active_price_count',0
  ),
  operator_note='Owner-selected Ethereum/TRON/Solana and USDT/USDC configuration remains inactive. Multi-asset routing, Ethereum validation and draft pricing are prepared; activation remains explicitly denied.',
  updated_at=now()
where code='PAYMENT_PROVIDER';

update public.crypto_billing_provider_adapters
set last_verification=last_verification || jsonb_build_object(
    'multi_asset_invoice_service_prepared',true,'explicit_asset_selection_required',true,
    'ethereum_validation_prepared',true,'draft_price_row_count',4,'active_price_count',0,
    'public_receiving_addresses_configured',false,'activation_allowed',false
  ),updated_at=now()
where provider='onchain';

drop function if exists private.block_crypto_onchain_owner_approval_until_explicit_decision();
drop function if exists private.enforce_crypto_onchain_network_decision_record();
drop function if exists private.guard_crypto_onchain_owner_approval();

do $$
declare v_ready jsonb;v_integrity jsonb;
begin
  if (select count(*) from public.crypto_onchain_plan_pricing
      where plan in('BASIC','PRO') and asset_code in('USDT','USDC') and not active and approved_at is null)<>4 then
    raise exception 'Draft pricing assertion failed';
  end if;
  if exists(select 1 from public.crypto_plan_prices where plan in('BASIC','PRO') and active) then
    raise exception 'Paid plan activation assertion failed';
  end if;
  if not private.crypto_validate_onchain_address('ETHEREUM','0x0000000000000000000000000000000000000001')
     or private.crypto_validate_onchain_address('ETHEREUM','0x1234') then
    raise exception 'Ethereum address validation assertion failed';
  end if;
  if not private.crypto_validate_onchain_tx_hash('ETHEREUM','0x'||repeat('a',64))
     or private.crypto_validate_onchain_tx_hash('ETHEREUM','0x'||repeat('a',63)) then
    raise exception 'Ethereum transaction validation assertion failed';
  end if;
  v_ready:=private.crypto_onchain_activation_readiness();
  if coalesce((v_ready->>'activation_ready')::boolean,true)
     or coalesce((v_ready->>'configuration_ready')::boolean,true)
     or (v_ready->>'draft_plan_price_count')::integer<>4
     or (v_ready->>'active_plan_price_count')::integer<>0 then
    raise exception 'Readiness fail-closed assertion failed: %',v_ready;
  end if;
  v_integrity:=private.crypto_owner_decision_integrity_snapshot();
  if v_integrity->>'state'<>'healthy' then raise exception 'Owner integrity assertion failed: %',v_integrity; end if;
  if (select count(*) from public.crypto_onchain_networks where status='active')<>0
     or (select count(*) from public.crypto_onchain_network_assets where enabled)<>0
     or (select count(*) from public.crypto_onchain_receiving_addresses)<>0
     or (select count(*) from public.crypto_onchain_invoices)<>0
     or (select count(*) from public.crypto_onchain_tx_claims)<>0
     or (select count(*) from public.crypto_onchain_tx_observations)<>0 then
    raise exception 'Zero payment execution state assertion failed';
  end if;
end $$;
