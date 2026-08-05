-- CRYPTO LAB v79 build 7930
-- Owner update: PRO from $40/month to $49/month.
-- Pricing remains inactive; payment activation remains explicitly denied.

do $$
declare
  v_text constant text := 'PRO — $40/месяц - замени на PRO — $49/месяц';
  v_hash constant text := '94518ffc701c792338d1a259594674d3fad52f4fc071478045e4488b4da8e61c';
begin
  if encode(extensions.digest(convert_to(v_text,'UTF8'),'sha256'),'hex') <> v_hash then
    raise exception 'PRO pricing decision hash mismatch';
  end if;

  insert into public.crypto_owner_decision_records(
    decision_code,decision_text,decision_hash,source_channel,scope,activation_authorized,recorded_at,active
  ) values(
    'ONCHAIN_PRO_USD_49_MONTHLY_PRICING_UPDATE',v_text,v_hash,'owner_chat',
    jsonb_build_object(
      'decision_scope','pricing_update_only',
      'currency','USD',
      'billing_interval','month',
      'basic_amount_minor',2000,
      'previous_pro_amount_minor',4000,
      'pro_amount_minor',4900,
      'display_basic','$20/month',
      'display_pro','$49/month',
      'selected_assets',jsonb_build_array('USDT','USDC'),
      'payment_activation_authorized',false,
      'pricing_activation_authorized',false,
      'supersedes_decision_code','ONCHAIN_BASIC_PRO_USD_MONTHLY_PRICING',
      'supersedes_decision_hash','db8ef6f56587b0aa05c602c838dc94acc06d6dca5a42d6f2e76130a7c7e198c0'
    ),false,now(),true
  ) on conflict(decision_code) do nothing;

  if not exists(
    select 1 from public.crypto_owner_decision_records
    where decision_code='ONCHAIN_PRO_USD_49_MONTHLY_PRICING_UPDATE'
      and decision_hash=v_hash and active and not activation_authorized
  ) then
    raise exception 'PRO pricing owner decision record missing';
  end if;

  insert into public.crypto_owner_decision_authority_events(
    decision_code,event_type,authority_state,decision_text_hash,evidence,effective_at
  ) select
    'ONCHAIN_PRO_USD_49_MONTHLY_PRICING_UPDATE','confirmed','effective',v_hash,
    jsonb_build_object(
      'exact_owner_text',v_text,
      'currency','USD',
      'billing_interval','month',
      'basic_amount_minor',2000,
      'previous_pro_amount_minor',4000,
      'pro_amount_minor',4900,
      'payment_activation_authorized',false,
      'pricing_activation_authorized',false
    ),now()
  where not exists(
    select 1 from public.crypto_owner_decision_authority_events
    where decision_code='ONCHAIN_PRO_USD_49_MONTHLY_PRICING_UPDATE'
      and authority_state='effective' and decision_text_hash=v_hash
  );
end $$;

alter table public.crypto_plan_prices drop constraint if exists crypto_paid_plan_owner_usd_pricing_check;
alter table public.crypto_onchain_plan_pricing drop constraint if exists crypto_onchain_owner_usd_pricing_check;

update public.crypto_plan_prices
set amount_minor=4900,
    provider='onchain_candidate',
    active=false,
    updated_at=now()
where plan='PRO' and currency='USD' and billing_interval='month';

update public.crypto_onchain_plan_pricing
set accounting_currency='USD',
    accounting_amount_minor=4900,
    pricing_mode='fiat_pegged',
    fixed_asset_base_units=null,
    active=false,
    approved_at=now(),
    metadata=jsonb_build_object(
      'state','owner_approved_inactive',
      'owner_approved',true,
      'decision_code','ONCHAIN_PRO_USD_49_MONTHLY_PRICING_UPDATE',
      'decision_hash','94518ffc701c792338d1a259594674d3fad52f4fc071478045e4488b4da8e61c',
      'supersedes_decision_code','ONCHAIN_BASIC_PRO_USD_MONTHLY_PRICING',
      'currency','USD',
      'billing_interval','month',
      'amount_usd',49,
      'activation_authorized',false
    ),
    updated_at=now()
where plan='PRO' and asset_code in('USDT','USDC');

alter table public.crypto_plan_prices add constraint crypto_paid_plan_owner_usd_pricing_check check(
  plan='FREE' or (
    currency='USD' and billing_interval='month' and provider='onchain_candidate' and not active
    and ((plan='BASIC' and amount_minor=2000) or (plan='PRO' and amount_minor=4900))
  )
);

alter table public.crypto_onchain_plan_pricing add constraint crypto_onchain_owner_usd_pricing_check check(
  plan not in('BASIC','PRO') or asset_code not in('USDT','USDC') or (
    accounting_currency='USD' and pricing_mode='fiat_pegged'
    and fixed_asset_base_units is null and not active
    and (
      (plan='BASIC' and accounting_amount_minor=2000
       and metadata->>'decision_code'='ONCHAIN_BASIC_PRO_USD_MONTHLY_PRICING'
       and metadata->>'decision_hash'='db8ef6f56587b0aa05c602c838dc94acc06d6dca5a42d6f2e76130a7c7e198c0')
      or
      (plan='PRO' and accounting_amount_minor=4900
       and metadata->>'decision_code'='ONCHAIN_PRO_USD_49_MONTHLY_PRICING_UPDATE'
       and metadata->>'decision_hash'='94518ffc701c792338d1a259594674d3fad52f4fc071478045e4488b4da8e61c')
    )
    and coalesce((metadata->>'owner_approved')::boolean,false)
    and not coalesce((metadata->>'activation_authorized')::boolean,false)
  )
);

update public.crypto_launch_requirements
set status='verified',
    decision_required=false,
    decision_summary=jsonb_build_object(
      'decision_code','ONCHAIN_PRO_USD_49_MONTHLY_PRICING_UPDATE',
      'decision_hash','94518ffc701c792338d1a259594674d3fad52f4fc071478045e4488b4da8e61c',
      'currency','USD',
      'billing_interval','month',
      'basic_amount_minor',2000,
      'pro_amount_minor',4900,
      'owner_approved',true,
      'activation_authorized',false
    ),
    evidence=jsonb_build_object(
      'selected_assets',jsonb_build_array('USDT','USDC'),
      'basic_display','$20/month',
      'pro_display','$49/month',
      'onchain_price_rows',4,
      'active_onchain_price_rows',0,
      'single_paid_currency',true
    ),
    operator_note='Owner approved BASIC at $20/month and updated PRO to $49/month. Pricing remains inactive because payment activation is not authorized.',
    decided_at=now(),verified_at=now(),updated_at=now()
where code='PRICING_MODEL';

update public.crypto_launch_requirements
set evidence=evidence || jsonb_build_object(
      'pricing_decision_code','ONCHAIN_PRO_USD_49_MONTHLY_PRICING_UPDATE',
      'pricing_decision_hash','94518ffc701c792338d1a259594674d3fad52f4fc071478045e4488b4da8e61c',
      'pricing_currency','USD',
      'basic_amount_minor',2000,
      'pro_amount_minor',4900,
      'pricing_owner_approved',true,
      'active_price_count',0
    ),
    operator_note='Networks, assets and updated USD monthly pricing are owner-approved. All payment execution remains disabled until a separate explicit activation decision.',
    updated_at=now()
where code='PAYMENT_PROVIDER';

do $$
declare v_ready jsonb;
begin
  if exists(select 1 from public.crypto_plan_prices where plan='BASIC' and (amount_minor<>2000 or active))
     or exists(select 1 from public.crypto_plan_prices where plan='PRO' and (amount_minor<>4900 or active)) then
    raise exception 'Updated paid plan pricing assertion failed';
  end if;
  if (select count(*) from public.crypto_onchain_plan_pricing where plan='PRO' and asset_code in('USDT','USDC') and accounting_amount_minor=4900 and not active)<>2 then
    raise exception 'Updated PRO on-chain pricing assertion failed';
  end if;
  if exists(select 1 from public.crypto_billing_provider_adapters where provider='onchain'
    and (checkout_enabled or webhook_enabled or recurring_enabled or refunds_enabled or desired_mode<>'disabled' or lifecycle_status<>'draft')) then
    raise exception 'Payment activation boundary changed unexpectedly';
  end if;
  v_ready:=private.crypto_onchain_activation_readiness();
  if coalesce((v_ready->>'activation_ready')::boolean,true) or coalesce((v_ready->>'configuration_ready')::boolean,true) then
    raise exception 'Readiness must remain fail-closed: %',v_ready;
  end if;
end $$;
