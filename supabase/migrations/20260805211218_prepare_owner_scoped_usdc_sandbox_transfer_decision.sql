-- CRYPTO LAB v79 build 7930
-- Prepare an explicit owner decision request for two no-value testnet USDC transfers.
-- The payment sandbox remains blocked and no transfer is executed by this migration.

update public.crypto_launch_requirements
set evidence=(evidence - 'ethereum_rpc_secret_required') || jsonb_build_object(
      'next_owner_decision_proposal',jsonb_build_object(
        'decision_code','SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1',
        'scope','testnet_usdc_only',
        'ethereum',jsonb_build_object(
          'network','Sepolia',
          'asset','USDC',
          'token_identifier','0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
          'recipient','0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9',
          'amount_display','0.01 USDC',
          'amount_base_units','10000'
        ),
        'solana',jsonb_build_object(
          'network','Devnet',
          'asset','USDC',
          'token_identifier','4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
          'recipient','EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F',
          'amount_display','0.01 USDC',
          'amount_base_units','10000'
        ),
        'test_tokens_have_no_financial_value',true,
        'mainnet_authorized',false,
        'production_payment_activation_authorized',false,
        'subscription_activation_authorized',false,
        'refund_execution_authorized',false,
        'wallet_secret_access_required',false,
        'owner_confirmation_required',true
      ),
      'circle_faucet','https://faucet.circle.com/',
      'circle_faucet_limit','20 testnet USDC per address per blockchain every 2 hours',
      'wallet_free_fixture_tests_prepared',true,
      'testnet_transfer_execution_pending_owner_approval',true,
      'tron_live_sandbox_deferred',true,
      'tron_defer_reason','Official Nile TRC-20 test token or controlled mock token identifier is still required'
    ),
    operator_note='All three read-only sandbox RPC profiles are healthy and wallet-free parser fixtures pass. The next gated action is owner approval for two no-value testnet USDC transfers: 0.01 USDC on Ethereum Sepolia and 0.01 USDC on Solana Devnet. No transfer or production activation has been authorized.',
    updated_at=now()
where code='PAYMENT_SANDBOX_E2E';

do $$
begin
  if not exists(
    select 1 from public.crypto_launch_requirements
    where code='PAYMENT_SANDBOX_E2E'
      and status='blocked_dependency'
      and evidence->'next_owner_decision_proposal'->>'decision_code'='SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1'
      and coalesce((evidence->>'live_transfer_execution_authorized')::boolean,false)=false
  ) then
    raise exception 'Sandbox transfer decision proposal was not prepared safely';
  end if;
  if exists(select 1 from public.crypto_onchain_sandbox_runs)
     or exists(select 1 from public.crypto_onchain_invoices)
     or exists(select 1 from public.crypto_onchain_tx_claims)
     or exists(select 1 from public.crypto_onchain_tx_observations) then
    raise exception 'No transfer or production payment evidence may exist at proposal stage';
  end if;
end $$;
