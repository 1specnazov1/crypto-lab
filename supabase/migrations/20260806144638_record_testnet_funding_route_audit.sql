-- Record testnet funding route audit and the 2026-08-06 retry.
-- No production payment, subscription, or mainnet state is changed.

update public.crypto_onchain_sandbox_sender_accounts
set evidence=evidence || jsonb_build_object(
      'latest_official_rpc_retry_at',now(),
      'latest_official_rpc_retry_lamports','100000000',
      'latest_official_rpc_retry_request_id','18008',
      'latest_official_rpc_retry_result','internal_error',
      'solana_foundation_web_faucet_result','github_account_too_new',
      'devnetfaucet_org_requirement','github_auth_and_solana_ecosystem_eligibility',
      'quicknode_faucet_requirement','wallet_connect_or_web_interaction',
      'coinbase_cdp_faucet_requirement','cdp_api_bearer_token',
      'circle_faucet_requirement','human_recaptcha',
      'background_balance_watch_enabled',true,
      'background_retry_interval_hours',4,
      'mainnet_funding_route_allowed',false
    ),
    updated_at=now()
where environment='sandbox' and network_code='SOLANA';

update public.crypto_onchain_sandbox_cases
set evidence=evidence || jsonb_build_object(
      'latest_official_rpc_retry_at',now(),
      'latest_official_rpc_retry_result','internal_error',
      'funding_route_audit_completed',true,
      'remaining_safe_routes',jsonb_build_array(
        'official_rpc_periodic_retry',
        'human_web_faucet_with_captcha_or_oauth',
        'authenticated_provider_faucet'
      ),
      'unsafe_or_out_of_scope_routes_rejected',jsonb_build_array(
        'mainnet_sol_exchange_faucet',
        'seed_phrase_export',
        'private_key_export',
        'rate_limit_bypass'
      )
    ),
    updated_at=now()
where environment='sandbox' and network_code='SOLANA' and asset_code='USDC';

update public.crypto_launch_requirements
set evidence=evidence || jsonb_build_object(
      'testnet_funding_route_audit_completed',true,
      'solana_official_rpc_retry_result','internal_error',
      'solana_web_faucet_github_result','account_too_new',
      'background_funding_watch_enabled',true,
      'production_funding_attempted',false,
      'mainnet_authorized',false
    ),
    operator_note='Scoped testnet transfer approval remains effective. Test senders are registered. Public funding routes require rate-limit reset, human CAPTCHA/OAuth, or provider credentials. Mainnet and real-value routes remain prohibited.',
    updated_at=now()
where code='PAYMENT_SANDBOX_E2E';

do $$
begin
  if exists(select 1 from public.crypto_onchain_sandbox_sender_accounts where mainnet_authorized or entitlement_capable or secret_material_received) then
    raise exception 'Sandbox sender boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_plan_pricing where active) then
    raise exception 'Pricing activation boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_receiving_addresses where active) then
    raise exception 'Receiving-address activation boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_invoices) or exists(select 1 from public.crypto_onchain_tx_claims) or exists(select 1 from public.crypto_onchain_tx_observations) then
    raise exception 'Production payment state changed';
  end if;
end $$;
