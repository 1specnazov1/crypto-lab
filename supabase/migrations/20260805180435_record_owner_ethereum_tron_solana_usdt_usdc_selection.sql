-- CRYPTO LAB v79 build 7930
-- Exact owner text: USDT, USDC утверждаю для Ethereum TRON и Solana. Активацию платежей не разрешаю.
-- SHA-256: df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750
-- Ethereum supersedes BSC. USDT and USDC are selected-inactive. Payment activation is denied.

drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;
drop trigger if exists crypto_owner_decision_record_immutable on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_authority_event_immutable on public.crypto_owner_decision_authority_events;

alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_canonical_three_network_approval_check;
alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_owner_selected_network_state_check;
alter table public.crypto_onchain_assets drop constraint if exists crypto_onchain_owner_selected_asset_state_check;
alter table public.crypto_onchain_network_assets drop constraint if exists crypto_onchain_token_standard_check;
alter table public.crypto_onchain_network_assets drop constraint if exists crypto_onchain_owner_selected_pairs_disabled_check;
alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_canonical_three_network_check;
alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_current_network_asset_check;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_provider_owner_decision_check;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_current_owner_decision_check;
alter table public.crypto_billing_provider_adapters drop constraint if exists crypto_onchain_adapter_owner_activation_denied_check;
drop index if exists public.crypto_onchain_one_selected_asset_idx;
create index if not exists crypto_onchain_selected_assets_idx on public.crypto_onchain_assets(asset_code) where selected;

update public.crypto_owner_decision_records
set active=false
where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
  and decision_hash='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';

update public.crypto_owner_decision_authority_events
set authority_state='superseded',
    evidence=evidence || jsonb_build_object(
      'superseded_by_decision_code','ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION',
      'superseded_by_decision_hash','df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
      'superseded_reason','Owner replaced BSC with Ethereum, selected USDT and USDC, and denied activation.',
      'superseded_at',now()
    )
where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
  and decision_text_hash='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
  and authority_state='effective';

insert into public.crypto_owner_decision_records(
  decision_code,decision_text,decision_hash,source_channel,scope,activation_authorized,active
) values (
  'ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION',
  'USDT, USDC утверждаю для Ethereum TRON и Solana. Активацию платежей не разрешаю.',
  'df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
  'owner_chat',
  jsonb_build_object(
    'payment_rail','onchain_direct','wallet_client','trust_wallet_walletconnect',
    'decision_scope','network_and_settlement_asset_selection',
    'approved_networks',jsonb_build_array('ETHEREUM','TRON','SOLANA'),
    'selected_assets',jsonb_build_array('USDT','USDC'),
    'network_activation',false,'payment_activation_authorized',false,
    'pricing_selected',false,'receiving_addresses_configured',false,
    'unsupported_official_pairs',jsonb_build_array(
      jsonb_build_object('network','TRON','asset','USDC','reason','Circle discontinued official USDC support on TRON')
    ),
    'supersedes_decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'original_message_timestamp_known',true
  ),false,true
);

insert into public.crypto_owner_decision_authority_events(
  decision_code,event_type,authority_state,decision_text_hash,evidence
) values (
  'ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION','confirmed','effective',
  'df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
  jsonb_build_object(
    'exact_owner_text','USDT, USDC утверждаю для Ethereum TRON и Solana. Активацию платежей не разрешаю.',
    'approved_networks',jsonb_build_array('ETHEREUM','TRON','SOLANA'),
    'selected_assets',jsonb_build_array('USDT','USDC'),
    'payment_activation_authorized',false,
    'unsupported_official_pairs',jsonb_build_array('TRON_USDC'),
    'supersedes_decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'recurring_automation_disabled',true
  )
);

insert into public.crypto_onchain_networks(
  network_code,display_name,chain_family,chain_reference,native_fee_symbol,
  finality_mode,required_confirmations,status,approved_by_owner,display_order,metadata
) values (
  'ETHEREUM','Ethereum (ERC20)','evm','1','ETH','finalized',12,'inactive',true,1,
  jsonb_build_object(
    'verification','finalized JSON-RPC block tag plus confirmation depth',
    'decision_code','ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION',
    'decision_hash','df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
    'approval_source','owner_chat','owner_approval_recorded',true,
    'activation_authorized',false,'activation_pending',true
  )
) on conflict(network_code) do update set
  display_name=excluded.display_name,chain_family=excluded.chain_family,
  chain_reference=excluded.chain_reference,native_fee_symbol=excluded.native_fee_symbol,
  finality_mode=excluded.finality_mode,required_confirmations=excluded.required_confirmations,
  status='inactive',approved_by_owner=true,display_order=1,metadata=excluded.metadata,updated_at=now();

update public.crypto_onchain_networks
set status='inactive',approved_by_owner=true,
    display_order=case network_code when 'TRON' then 2 when 'SOLANA' then 3 else display_order end,
    metadata=jsonb_build_object(
      'verification',metadata->'verification',
      'decision_code','ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION',
      'decision_hash','df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
      'approval_source','owner_chat','owner_approval_recorded',true,
      'activation_authorized',false,'activation_pending',true
    ),updated_at=now()
where network_code in('TRON','SOLANA');

update public.crypto_onchain_networks
set status='inactive',approved_by_owner=false,display_order=99,
    metadata=jsonb_build_object(
      'verification',metadata->'verification',
      'superseded_by_decision_code','ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION',
      'superseded_by_decision_hash','df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
      'owner_approval_recorded',false,'activation_authorized',false,
      'reason','Owner selected Ethereum, TRON and Solana; BSC is no longer approved.'
    ),updated_at=now()
where network_code='BSC';

alter table public.crypto_onchain_networks
  add constraint crypto_onchain_owner_selected_network_state_check
  check(
    (network_code not in('ETHEREUM','TRON','SOLANA') or (approved_by_owner and status='inactive'))
    and (network_code<>'BSC' or ((not approved_by_owner) and status='inactive'))
  );

update public.crypto_onchain_assets
set selected=true,status='selected_inactive',
    metadata=metadata || jsonb_build_object(
      'decision_code','ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION',
      'decision_hash','df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
      'owner_selected',true,'activation_authorized',false,'decision_pending',false
    ),updated_at=now()
where asset_code in('USDT','USDC');

alter table public.crypto_onchain_assets
  add constraint crypto_onchain_owner_selected_asset_state_check
  check(asset_code not in('USDT','USDC') or (selected and status='selected_inactive'));

alter table public.crypto_onchain_network_assets
  add constraint crypto_onchain_token_standard_check
  check(token_standard in('ERC20','TRC20','BEP20','SPL'));

insert into public.crypto_onchain_network_assets(
  network_code,asset_code,token_standard,token_identifier,issuer_model,
  availability_status,official_source_url,verified_at,enabled,metadata
) values
('ETHEREUM','USDT','ERC20','0xdAC17F958D2ee523a2206206994597C13D831ec7','direct_issuer','available_verified','https://tether.to/en/supported-protocols/',now(),false,jsonb_build_object('official_issuer_contract',true,'owner_selected',true,'activation_authorized',false)),
('ETHEREUM','USDC','ERC20','0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48','direct_issuer','available_verified','https://developers.circle.com/stablecoins/usdc-contract-addresses',now(),false,jsonb_build_object('official_issuer_contract',true,'owner_selected',true,'activation_authorized',false)),
('TRON','USDT','TRC20','TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t','direct_issuer','available_verified','https://tether.to/en/supported-protocols/',now(),false,jsonb_build_object('official_issuer_contract',true,'owner_selected',true,'activation_authorized',false)),
('TRON','USDC','TRC20',null,'not_available','unsupported_official','https://www.circle.com/blog/circle-is-discontinuing-support-for-usdc-on-the-tron-blockchain',now(),false,jsonb_build_object('owner_requested',true,'operationally_supported',false,'activation_authorized',false,'reason','Circle discontinued official USDC support on TRON')),
('SOLANA','USDT','SPL','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB','direct_issuer','available_verified','https://tether.to/en/supported-protocols/',now(),false,jsonb_build_object('official_issuer_contract',true,'owner_selected',true,'activation_authorized',false)),
('SOLANA','USDC','SPL','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','direct_issuer','available_verified','https://developers.circle.com/stablecoins/usdc-contract-addresses',now(),false,jsonb_build_object('official_issuer_contract',true,'owner_selected',true,'activation_authorized',false))
on conflict(network_code,asset_code) do update set
  token_standard=excluded.token_standard,token_identifier=excluded.token_identifier,
  issuer_model=excluded.issuer_model,availability_status=excluded.availability_status,
  official_source_url=excluded.official_source_url,verified_at=excluded.verified_at,
  enabled=false,metadata=excluded.metadata,updated_at=now();

update public.crypto_onchain_network_assets
set enabled=false,
    metadata=metadata || jsonb_build_object(
      'owner_selected_network',false,'activation_authorized',false,
      'superseded_by_decision_code','ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION'
    ),updated_at=now()
where network_code='BSC';

alter table public.crypto_onchain_network_assets
  add constraint crypto_onchain_owner_selected_pairs_disabled_check
  check(network_code not in('ETHEREUM','TRON','SOLANA') or asset_code not in('USDT','USDC') or not enabled);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_PROVIDER','in_progress',
  jsonb_build_object(
    'provider','onchain_direct','wallet','trust_wallet_walletconnect',
    'approved_networks',jsonb_build_array('ETHEREUM','TRON','SOLANA'),
    'selected_assets',jsonb_build_array('USDT','USDC'),
    'network_approval_recorded',true,'asset_selection_recorded',true,
    'decision_code','ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION',
    'decision_hash','df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
    'activation_authorized',false
  ),
  jsonb_build_object(
    'decision_source','owner_chat',
    'decision_text_exact','USDT, USDC утверждаю для Ethereum TRON и Solana. Активацию платежей не разрешаю.',
    'official_supported_pairs',jsonb_build_array('ETHEREUM_USDT','ETHEREUM_USDC','TRON_USDT','SOLANA_USDT','SOLANA_USDC'),
    'unsupported_official_pairs',jsonb_build_array('TRON_USDC'),
    'network_activation',false,'payment_activation',false,
    'active_network_count',0,'enabled_network_asset_count',0,
    'active_price_count',0,'receiving_address_count',0,'invoice_count',0,
    'chain_observation_count',0,'private_keys_required',false,
    'recurring_automation_disabled',true
  ),
  'Owner selected USDT and USDC for Ethereum, TRON and Solana and explicitly denied payment activation. TRON USDC remains officially unsupported and disabled.'
);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency',
  jsonb_build_object(
    'decision_code','ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION',
    'decision_hash','df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
    'approved_networks',jsonb_build_array('ETHEREUM','TRON','SOLANA'),
    'selected_assets',jsonb_build_array('USDT','USDC'),
    'activation_authorized',false
  ),
  jsonb_build_object(
    'onchain_foundation',true,
    'official_supported_pairs',jsonb_build_array('ETHEREUM_USDT','ETHEREUM_USDC','TRON_USDT','SOLANA_USDT','SOLANA_USDC'),
    'unsupported_official_pairs',jsonb_build_array('TRON_USDC'),
    'activation',false
  ),
  'Sandbox execution remains blocked. No payment execution is authorized.'
);

update public.crypto_billing_provider_adapters
set desired_mode='disabled',lifecycle_status='draft',checkout_enabled=false,webhook_enabled=false,
    recurring_enabled=false,refunds_enabled=false,last_verified_at=null,last_error_code=null,
    last_verification=jsonb_build_object(
      'state','owner_selected_networks_and_assets_inactive',
      'decision_code','ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION',
      'decision_hash','df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750',
      'approved_networks',jsonb_build_array('ETHEREUM','TRON','SOLANA'),
      'selected_assets',jsonb_build_array('USDT','USDC'),
      'official_supported_pairs',jsonb_build_array('ETHEREUM_USDT','ETHEREUM_USDC','TRON_USDT','SOLANA_USDT','SOLANA_USDC'),
      'unsupported_official_pairs',jsonb_build_array('TRON_USDC'),
      'activation_allowed',false,'pricing_active',false,
      'receiving_addresses_active',false,'automatic_entitlement_enabled',false
    ),updated_at=now()
where provider='onchain';

alter table public.crypto_owner_decision_records
  add constraint crypto_owner_decision_current_network_asset_check
  check(
    (decision_code<>'ONCHAIN_THREE_NETWORK_SELECTION' or ((not active) and (not activation_authorized)))
    and (
      decision_code<>'ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION'
      or (
        decision_text='USDT, USDC утверждаю для Ethereum TRON и Solana. Активацию платежей не разрешаю.'
        and decision_hash='df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750'
        and source_channel='owner_chat' and active and not activation_authorized
        and scope->'approved_networks'=jsonb_build_array('ETHEREUM','TRON','SOLANA')
        and scope->'selected_assets'=jsonb_build_array('USDT','USDC')
        and coalesce((scope->>'payment_activation_authorized')::boolean,false)=false
      )
    )
  );

alter table public.crypto_launch_requirements
  add constraint crypto_payment_current_owner_decision_check
  check(
    code not in('PAYMENT_PROVIDER','PAYMENT_SANDBOX_E2E')
    or (
      decision_summary->>'decision_code'='ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION'
      and decision_summary->>'decision_hash'='df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750'
      and decision_summary->'approved_networks'=jsonb_build_array('ETHEREUM','TRON','SOLANA')
      and decision_summary->'selected_assets'=jsonb_build_array('USDT','USDC')
      and coalesce((decision_summary->>'activation_authorized')::boolean,false)=false
      and ((code='PAYMENT_PROVIDER' and status='in_progress') or (code='PAYMENT_SANDBOX_E2E' and status='blocked_dependency'))
    )
  );

alter table public.crypto_billing_provider_adapters
  add constraint crypto_onchain_adapter_owner_activation_denied_check
  check(provider<>'onchain' or (
    desired_mode='disabled' and lifecycle_status='draft'
    and not checkout_enabled and not webhook_enabled and not recurring_enabled and not refunds_enabled
  ));

create trigger crypto_owner_decision_record_immutable
before update or delete on public.crypto_owner_decision_records
for each row execute function private.crypto_owner_decision_record_immutable();

create trigger crypto_owner_authority_event_immutable
before update or delete on public.crypto_owner_decision_authority_events
for each row execute function private.crypto_owner_authority_event_immutable();

create or replace function private.enforce_crypto_onchain_owner_decision_record()
returns trigger language plpgsql security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare v_hash constant text:='df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750';v_valid boolean;
begin
  select exists(
    select 1 from public.crypto_owner_decision_records r
    where r.decision_code='ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION'
      and r.decision_hash=v_hash and r.source_channel='owner_chat' and r.active and not r.activation_authorized
      and exists(select 1 from public.crypto_owner_decision_authority_events e
        where e.decision_code=r.decision_code and e.event_type='confirmed'
          and e.authority_state='effective' and e.decision_text_hash=v_hash)
  ) into v_valid;
  if new.network_code in('ETHEREUM','TRON','SOLANA') then
    if not v_valid or not new.approved_by_owner or new.status<>'inactive' then
      raise exception 'Owner-selected network must remain approved and inactive' using errcode='42501';
    end if;
    if new.metadata->>'decision_code'<>'ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION'
       or new.metadata->>'decision_hash'<>v_hash then
      raise exception 'Current owner decision metadata mismatch' using errcode='42501';
    end if;
  elsif new.network_code='BSC' and (new.approved_by_owner or new.status<>'inactive') then
    raise exception 'BSC was superseded by the current owner decision' using errcode='42501';
  end if;
  return new;
end $$;

create trigger crypto_onchain_network_owner_approval_guard
before insert or update on public.crypto_onchain_networks
for each row execute function private.enforce_crypto_onchain_owner_decision_record();

create or replace function private.enforce_crypto_payment_owner_decision_record()
returns trigger language plpgsql security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare v_hash constant text:='df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750';v_valid boolean;
begin
  if new.code not in('PAYMENT_PROVIDER','PAYMENT_SANDBOX_E2E') then return new; end if;
  select exists(
    select 1 from public.crypto_owner_decision_records r
    where r.decision_code='ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION'
      and r.decision_hash=v_hash and r.active and not r.activation_authorized
      and exists(select 1 from public.crypto_owner_decision_authority_events e
        where e.decision_code=r.decision_code and e.event_type='confirmed'
          and e.authority_state='effective' and e.decision_text_hash=v_hash)
  ) into v_valid;
  if not v_valid then raise exception 'Current owner payment decision authority is missing' using errcode='42501'; end if;
  if new.decision_summary->>'decision_code'<>'ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION'
     or new.decision_summary->>'decision_hash'<>v_hash
     or new.decision_summary->'approved_networks'<>jsonb_build_array('ETHEREUM','TRON','SOLANA')
     or new.decision_summary->'selected_assets'<>jsonb_build_array('USDT','USDC')
     or coalesce((new.decision_summary->>'activation_authorized')::boolean,false) then
    raise exception 'Current payment owner decision mismatch' using errcode='42501';
  end if;
  if new.code='PAYMENT_PROVIDER' and new.status<>'in_progress' then
    raise exception 'Payment provider must remain disabled/in progress' using errcode='42501';
  end if;
  if new.code='PAYMENT_SANDBOX_E2E' and new.status<>'blocked_dependency' then
    raise exception 'Payment sandbox must remain blocked' using errcode='42501';
  end if;
  return new;
end $$;

create trigger crypto_payment_owner_decision_provenance_guard
before insert or update on public.crypto_launch_requirements
for each row execute function private.enforce_crypto_payment_owner_decision_record();

do $$
declare v_bad integer;
begin
  select count(*) into v_bad from public.crypto_onchain_networks
  where network_code in('ETHEREUM','TRON','SOLANA') and not(approved_by_owner and status='inactive');
  if v_bad<>0 then raise exception 'Approved inactive network assertion failed: %',v_bad; end if;
  if exists(select 1 from public.crypto_onchain_networks where network_code='BSC' and (approved_by_owner or status<>'inactive')) then raise exception 'BSC supersession assertion failed'; end if;
  if (select count(*) from public.crypto_onchain_assets where asset_code in('USDT','USDC') and selected and status='selected_inactive')<>2 then raise exception 'Selected inactive asset assertion failed'; end if;
  if exists(select 1 from public.crypto_onchain_network_assets where network_code in('ETHEREUM','TRON','SOLANA') and asset_code in('USDT','USDC') and enabled) then raise exception 'Network asset enablement assertion failed'; end if;
  if not exists(select 1 from public.crypto_onchain_network_assets where network_code='TRON' and asset_code='USDC' and availability_status='unsupported_official' and token_identifier is null and not enabled) then raise exception 'TRON USDC boundary assertion failed'; end if;
  if (select count(*) from public.crypto_owner_decision_records where decision_code='ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION' and decision_hash='df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750' and active and not activation_authorized)<>1 then raise exception 'Current owner decision assertion failed'; end if;
  if exists(select 1 from public.crypto_billing_provider_adapters where provider='onchain' and (desired_mode<>'disabled' or lifecycle_status<>'draft' or checkout_enabled or webhook_enabled or recurring_enabled or refunds_enabled)) then raise exception 'Adapter boundary assertion failed'; end if;
  if (select count(*) from public.crypto_onchain_networks where status='active')<>0
    or (select count(*) from public.crypto_onchain_plan_pricing where active)<>0
    or (select count(*) from public.crypto_onchain_receiving_addresses)<>0
    or (select count(*) from public.crypto_onchain_invoices)<>0
    or (select count(*) from public.crypto_onchain_tx_claims)<>0
    or (select count(*) from public.crypto_onchain_tx_observations)<>0 then
    raise exception 'Zero payment execution data assertion failed';
  end if;
end $$;
