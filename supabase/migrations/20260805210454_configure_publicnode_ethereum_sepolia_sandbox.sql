-- CRYPTO LAB v79 build 7930
-- Configure a public read-only Ethereum Sepolia endpoint for the isolated sandbox.
-- No mainnet profile, payment, price, address, invoice or entitlement is activated.

update public.crypto_onchain_verifier_profiles
set endpoint_mode='public_default',
    public_endpoint='https://ethereum-sepolia-rpc.publicnode.com',
    endpoint_secret_name=null,
    enabled=true,
    status='ready',
    metadata=metadata || jsonb_build_object(
      'provider_name','PublicNode',
      'provider_reference','https://ethereum-sepolia.publicnode.com/',
      'chain_id_decimal','11155111',
      'chain_id_hex','0xaa36a7',
      'health_verified_at',now(),
      'read_only',true,
      'production_use',false
    ),
    updated_at=now()
where network_code='ETHEREUM' and environment='sandbox';

update public.crypto_onchain_sandbox_cases
set status='ready_for_funding',
    evidence=evidence || jsonb_build_object(
      'rpc_provider_ready',true,
      'rpc_provider','PublicNode',
      'rpc_endpoint_public',true,
      'chain_id_verified','11155111',
      'live_transfer_execution_authorized',false
    ),
    updated_at=now()
where environment='sandbox' and network_code='ETHEREUM' and asset_code='USDC';

update public.crypto_launch_requirements
set evidence=evidence || jsonb_build_object(
      'ethereum_sepolia_rpc_pending',false,
      'ethereum_sepolia_profile_ready',true,
      'ethereum_sepolia_rpc_provider','PublicNode',
      'ethereum_sepolia_rpc_endpoint','https://ethereum-sepolia-rpc.publicnode.com',
      'ethereum_sepolia_chain_id_verified','11155111',
      'ethereum_sepolia_health_http_status',200,
      'ethereum_sepolia_latest_block_hex','0xae5c07',
      'ethereum_sepolia_finalized_block_hex','0xae5bc1',
      'ethereum_sepolia_read_only',true,
      'production_rpc_profiles_enabled',0
    ),
    operator_note='Ethereum Sepolia read-only PublicNode RPC is configured and chain ID 11155111 is verified. All mainnet profiles, payment execution and sandbox transfers remain disabled.',
    updated_at=now()
where code in ('MERCHANT_CREDENTIALS','PAYMENT_SANDBOX_E2E');

do $$
begin
  if not exists(
    select 1 from public.crypto_onchain_verifier_profiles
    where network_code='ETHEREUM' and environment='sandbox'
      and endpoint_mode='public_default'
      and public_endpoint='https://ethereum-sepolia-rpc.publicnode.com'
      and enabled and status='ready' and read_only
  ) then
    raise exception 'Ethereum Sepolia sandbox profile was not configured';
  end if;
  if exists(select 1 from public.crypto_onchain_verifier_profiles where environment='mainnet' and enabled) then
    raise exception 'Mainnet verifier profile activated';
  end if;
  if exists(select 1 from public.crypto_onchain_receiving_addresses where active)
     or exists(select 1 from public.crypto_onchain_plan_pricing where active)
     or exists(select 1 from public.crypto_onchain_networks where status='active')
     or exists(select 1 from public.crypto_onchain_network_assets where enabled) then
    raise exception 'Production payment boundary changed';
  end if;
  if exists(
    select 1 from public.crypto_billing_provider_adapters
    where provider='onchain'
      and (checkout_enabled or webhook_enabled or recurring_enabled or refunds_enabled)
  ) then
    raise exception 'Payment adapter activation boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_invoices)
     or exists(select 1 from public.crypto_onchain_tx_claims)
     or exists(select 1 from public.crypto_onchain_tx_observations) then
    raise exception 'Production payment records unexpectedly exist';
  end if;
end $$;
