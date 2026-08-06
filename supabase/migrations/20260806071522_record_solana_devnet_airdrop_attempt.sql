-- Record Solana Devnet gas funding attempts without changing any production boundary.
update public.crypto_onchain_sandbox_sender_accounts
set evidence=evidence || jsonb_build_object(
      'devnet_balance_before_lamports','0',
      'airdrop_requested_lamports','500000000',
      'primary_rpc','https://api.devnet.solana.com',
      'primary_rpc_result','internal_error',
      'primary_rpc_request_id','16853',
      'fallback_rpc','https://rpc.ankr.com/solana_devnet',
      'fallback_rpc_result','api_key_required',
      'fallback_rpc_request_id','16854',
      'native_gas_funding_status','manual_official_faucet_required',
      'airdrop_attempted_at',now()
    ),
    updated_at=now()
where environment='sandbox' and network_code='SOLANA';

update public.crypto_onchain_sandbox_cases
set evidence=evidence || jsonb_build_object(
      'native_gas_funding_pending',true,
      'native_gas_funding_status','manual_official_faucet_required',
      'automatic_airdrop_attempted',true,
      'automatic_airdrop_primary_result','internal_error',
      'automatic_airdrop_fallback_result','api_key_required',
      'official_web_faucet','https://faucet.solana.com/'
    ),
    updated_at=now()
where environment='sandbox' and network_code='SOLANA' and asset_code='USDC';

do $$
begin
  if exists(select 1 from public.crypto_onchain_sandbox_sender_accounts where mainnet_authorized or entitlement_capable or secret_material_received) then
    raise exception 'Sandbox sender boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_plan_pricing where active) then
    raise exception 'Pricing activation boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_invoices) or exists(select 1 from public.crypto_onchain_tx_claims) or exists(select 1 from public.crypto_onchain_tx_observations) then
    raise exception 'Production payment state changed';
  end if;
end $$;
