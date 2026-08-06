-- Register owner-controlled Solana Devnet test sender for the exact scoped USDC sandbox test.
insert into public.crypto_onchain_sandbox_sender_accounts(
  environment,network_code,address,wallet_label,custody_model,verified,
  verification_method,configured,secret_material_received,mainnet_authorized,
  entitlement_capable,evidence,created_at,updated_at
) values (
  'sandbox','SOLANA','4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4',
  'CRYPTO LAB Test Sender','owner_signed_external_wallet',true,
  'trust_wallet_receive_screen',true,false,false,false,
  jsonb_build_object(
    'network_name','Devnet',
    'allowed_asset','USDC',
    'decision_code','SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1',
    'decision_hash','5b43613baf3fa255e1c9c1b430d70c65cc534532492adcb64bb412599f792a2e',
    'screen_confirmed',true,
    'same_as_production_receiver',false,
    'allowed_amount_display','0.01 USDC',
    'allowed_amount_base_units','10000',
    'signature_required_in_owner_wallet',true,
    'seed_phrase_received',false,
    'private_key_received',false
  ),now(),now()
)
on conflict(environment,network_code) do update set
  address=excluded.address,
  wallet_label=excluded.wallet_label,
  custody_model=excluded.custody_model,
  verified=true,
  verification_method=excluded.verification_method,
  configured=true,
  secret_material_received=false,
  mainnet_authorized=false,
  entitlement_capable=false,
  evidence=excluded.evidence,
  updated_at=now();

update public.crypto_onchain_sandbox_cases
set evidence=evidence || jsonb_build_object(
      'source_wallet_address','4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4',
      'source_wallet_network','Devnet',
      'source_wallet_custody','owner_signed_external_wallet',
      'source_wallet_verified',true,
      'source_wallet_pending',false,
      'transaction_signature_pending',true,
      'native_gas_funding_pending',true,
      'test_usdc_funding_pending',true
    ),
    updated_at=now()
where environment='sandbox' and network_code='SOLANA' and asset_code='USDC';

do $$
begin
  if not private.crypto_validate_onchain_address('SOLANA','4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4') then
    raise exception 'Invalid Solana sender address';
  end if;
  if exists(select 1 from public.crypto_onchain_receiving_addresses where network_code='SOLANA' and address='4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4') then
    raise exception 'Sandbox sender matches production receiver';
  end if;
  if exists(select 1 from public.crypto_onchain_sandbox_sender_accounts where mainnet_authorized or entitlement_capable or secret_material_received) then
    raise exception 'Sandbox sender safety boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_plan_pricing where active) then
    raise exception 'Pricing activation boundary changed';
  end if;
end $$;
