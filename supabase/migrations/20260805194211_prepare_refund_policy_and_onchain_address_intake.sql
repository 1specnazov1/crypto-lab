-- CRYPTO LAB v79 build 7930
-- Prepare a decision-ready refund proposal and service-role-only public address intake.
-- This migration does not activate checkout, refunds, networks, assets, prices, or addresses.

create or replace function private.service_stage_crypto_onchain_receiving_address(
  p_network text,
  p_address text,
  p_label text default 'CRYPTO LAB',
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','pg_temp'
as $$
declare
  v_network text:=upper(trim(coalesce(p_network,'')));
  v_address text;
  v_label text:=left(coalesce(nullif(trim(p_label),''),'CRYPTO LAB'),120);
  v_evidence jsonb:=coalesce(p_evidence,'{}'::jsonb);
  v_result jsonb;
begin
  if v_network not in ('ETHEREUM','TRON','SOLANA') then
    raise exception 'Unsupported receiving network' using errcode='22023';
  end if;
  if jsonb_typeof(v_evidence)<>'object' then
    raise exception 'Evidence must be a JSON object' using errcode='22023';
  end if;
  if v_evidence ?| array['private_key','privateKey','seed','seed_phrase','seedPhrase','mnemonic','password','wallet_password','secret'] then
    raise exception 'Sensitive wallet material is forbidden' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.crypto_onchain_networks
    where network_code=v_network and approved_by_owner
  ) then
    raise exception 'Network is not owner-approved' using errcode='22023';
  end if;

  v_address:=private.crypto_normalize_onchain_value(v_network,coalesce(p_address,''));
  if not private.crypto_validate_onchain_address(v_network,v_address) then
    raise exception 'Invalid receiving address for network' using errcode='22023';
  end if;

  insert into public.crypto_onchain_receiving_addresses(
    network_code,address,label,verified,active,verified_at,evidence,created_at,updated_at
  ) values(
    v_network,v_address,v_label,false,false,null,
    v_evidence || jsonb_build_object(
      'state','staged_unverified',
      'staged_at',now(),
      'staged_by','service_role',
      'activation_authorized',false,
      'sensitive_material_received',false
    ),now(),now()
  )
  on conflict(network_code) do update set
    address=excluded.address,
    label=excluded.label,
    verified=false,
    active=false,
    verified_at=null,
    evidence=excluded.evidence,
    updated_at=now();

  select jsonb_build_object(
    'network_code',network_code,
    'address',address,
    'address_suffix',right(address,6),
    'verified',verified,
    'active',active,
    'state',evidence->>'state',
    'updated_at',updated_at
  ) into v_result
  from public.crypto_onchain_receiving_addresses
  where network_code=v_network;
  return v_result;
end $$;

create or replace function private.service_verify_crypto_onchain_receiving_address(
  p_network text,
  p_expected_address text,
  p_verification_method text,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','pg_temp'
as $$
declare
  v_network text:=upper(trim(coalesce(p_network,'')));
  v_expected text;
  v_method text:=lower(trim(coalesce(p_verification_method,'')));
  v_evidence jsonb:=coalesce(p_evidence,'{}'::jsonb);
  v_current text;
  v_result jsonb;
begin
  if v_network not in ('ETHEREUM','TRON','SOLANA') then
    raise exception 'Unsupported receiving network' using errcode='22023';
  end if;
  if v_method not in ('owner_wallet_display','signed_message','controlled_test_transfer') then
    raise exception 'Unsupported verification method' using errcode='22023';
  end if;
  if jsonb_typeof(v_evidence)<>'object' then
    raise exception 'Evidence must be a JSON object' using errcode='22023';
  end if;
  if v_evidence ?| array['private_key','privateKey','seed','seed_phrase','seedPhrase','mnemonic','password','wallet_password','secret'] then
    raise exception 'Sensitive wallet material is forbidden' using errcode='22023';
  end if;

  v_expected:=private.crypto_normalize_onchain_value(v_network,coalesce(p_expected_address,''));
  select address into v_current
  from public.crypto_onchain_receiving_addresses
  where network_code=v_network
  for update;
  if v_current is null then
    raise exception 'Receiving address is not staged' using errcode='22023';
  end if;
  if v_current<>v_expected then
    raise exception 'Expected address does not match staged address' using errcode='22023';
  end if;

  update public.crypto_onchain_receiving_addresses
  set verified=true,
      verified_at=now(),
      active=false,
      evidence=evidence || v_evidence || jsonb_build_object(
        'state','verified_inactive',
        'verification_method',v_method,
        'verified_at',now(),
        'activation_authorized',false,
        'sensitive_material_received',false
      ),
      updated_at=now()
  where network_code=v_network;

  select jsonb_build_object(
    'network_code',network_code,
    'address',address,
    'address_suffix',right(address,6),
    'verified',verified,
    'active',active,
    'verification_method',evidence->>'verification_method',
    'updated_at',updated_at
  ) into v_result
  from public.crypto_onchain_receiving_addresses
  where network_code=v_network;
  return v_result;
end $$;

create or replace function private.service_crypto_onchain_address_intake_readiness()
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','pg_temp'
as $$
  select jsonb_build_object(
    'required_networks',jsonb_build_array('ETHEREUM','TRON','SOLANA'),
    'configured_count',count(*),
    'verified_inactive_count',count(*) filter(where verified and not active and verified_at is not null),
    'active_count',count(*) filter(where active),
    'addresses',coalesce(jsonb_agg(jsonb_build_object(
      'network_code',network_code,
      'address_suffix',right(address,6),
      'verified',verified,
      'active',active,
      'state',evidence->>'state',
      'updated_at',updated_at
    ) order by network_code),'[]'::jsonb),
    'sensitive_material_required',false,
    'activation_authorized',false
  )
  from public.crypto_onchain_receiving_addresses
  where network_code in ('ETHEREUM','TRON','SOLANA')
$$;

revoke all on function private.service_stage_crypto_onchain_receiving_address(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function private.service_verify_crypto_onchain_receiving_address(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function private.service_crypto_onchain_address_intake_readiness() from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.service_stage_crypto_onchain_receiving_address(text,text,text,jsonb) to service_role;
grant execute on function private.service_verify_crypto_onchain_receiving_address(text,text,text,jsonb) to service_role;
grant execute on function private.service_crypto_onchain_address_intake_readiness() to service_role;

update public.crypto_launch_requirements
set status='decision_required',
    decision_required=true,
    decision_summary=jsonb_build_object(
      'proposal_code','REFUND_POLICY_V1_APPROVAL',
      'proposal_version','2026-08-05-v1',
      'proposal_sha256','2b88bb0518cce25f24847b31adae688e2a70caeeb45d593f9e128f6fcac15e05',
      'approval_state','pending_owner_decision',
      'refund_execution_enabled',false,
      'automatic_refunds_enabled',false,
      'maximum_processing_days_when_legally_required',14,
      'eligible_reasons',jsonb_build_array(
        'duplicate_payment','verified_non_delivery','material_nonconformity',
        'adverse_material_modification','confirmed_unauthorized_payment','mandatory_law'
      ),
      'cancellation_stops_future_renewal',true,
      'same_asset_and_network_preferred',true,
      'mandatory_refund_fee_pass_through',false,
      'full_refund_ends_paid_access',true,
      'statutory_rights_preserved',true
    ),
    evidence=jsonb_build_object(
      'draft_path','docs/REFUND_POLICY_PROPOSAL_7930.md',
      'manifest_path','docs/release-manifests/crypto-lab-v79-refund-policy-proposal.json',
      'proposal_sha256','2b88bb0518cce25f24847b31adae688e2a70caeeb45d593f9e128f6fcac15e05',
      'ukraine_digital_content_law','https://zakon.rada.gov.ua/laws/show/3321-20',
      'ukraine_consumer_protection_law','https://zakon.rada.gov.ua/laws/show/1023-12',
      'eu_consumer_reference','https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm',
      'legal_review_pending',true,
      'owner_approval_pending',true,
      'payments_enabled',false,
      'refunds_enabled',false
    ),
    operator_note='Refund Policy Proposal v1 is prepared from official consumer-law sources. It is not approved or published and cannot enable refunds or payments.',
    decided_at=null,
    verified_at=null,
    updated_at=now()
where code='REFUND_POLICY';

update public.crypto_launch_requirements
set evidence=evidence || jsonb_build_object(
      'address_staging_service_prepared',true,
      'address_verification_service_prepared',true,
      'address_readiness_service_prepared',true,
      'supported_verification_methods',jsonb_build_array('owner_wallet_display','signed_message','controlled_test_transfer'),
      'staged_addresses_forced_inactive',true,
      'sensitive_material_rejected',true,
      'configured_address_count',(select count(*) from public.crypto_onchain_receiving_addresses where network_code in('ETHEREUM','TRON','SOLANA'))
    ),
    operator_note='Public-address staging and verification services are prepared for Ethereum, TRON and Solana. They reject sensitive wallet material and always keep addresses inactive until a separate activation decision.',
    updated_at=now()
where code='MERCHANT_CREDENTIALS';

do $$
declare
  v_before integer;
begin
  select count(*) into v_before from public.crypto_onchain_receiving_addresses;

  begin
    perform private.service_stage_crypto_onchain_receiving_address('ETHEREUM','invalid-address','negative-test','{}'::jsonb);
    raise exception 'Invalid address negative test unexpectedly succeeded';
  exception when sqlstate '22023' then
    null;
  end;

  if (select count(*) from public.crypto_onchain_receiving_addresses)<>v_before then
    raise exception 'Negative address test changed receiving-address state';
  end if;
  if exists(select 1 from public.crypto_onchain_receiving_addresses where active) then
    raise exception 'Address activation boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_plan_pricing where active) then
    raise exception 'Pricing activation boundary changed';
  end if;
  if exists(select 1 from public.crypto_billing_provider_adapters where provider='onchain' and (checkout_enabled or webhook_enabled or recurring_enabled or refunds_enabled)) then
    raise exception 'Payment adapter activation boundary changed';
  end if;
  if not exists(select 1 from public.crypto_launch_requirements where code='REFUND_POLICY' and status='decision_required' and decision_required and verified_at is null) then
    raise exception 'Refund policy must remain decision-required';
  end if;
  if has_function_privilege('anon','private.service_stage_crypto_onchain_receiving_address(text,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','private.service_stage_crypto_onchain_receiving_address(text,text,text,jsonb)','EXECUTE') then
    raise exception 'Address staging service is externally executable';
  end if;
end $$;
