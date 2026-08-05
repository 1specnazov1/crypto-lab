-- CRYPTO LAB v79
-- Correct the on-chain foundation evidence: networks are candidates, not owner-approved.

update public.crypto_onchain_networks
set approved_by_owner=false,
    status='inactive',
    updated_at=now()
where network_code in ('TRON','BSC','SOLANA');

select private.service_update_crypto_launch_requirement(
  'PAYMENT_PROVIDER','decision_required',
  jsonb_build_object(
    'candidate_provider','onchain_direct',
    'wallet_client','trust_wallet_walletconnect',
    'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'settlement_asset','pending',
    'owner_approval_recorded',false
  ),
  jsonb_build_object(
    'foundation_schema',true,
    'automatic_entitlement_path',true,
    'private_keys_required',false,
    'network_activation',false,
    'active_network_count',0,
    'active_price_count',0,
    'receiving_address_count',0,
    'invoice_count',0,
    'chain_observation_count',0,
    'bsc_asset_contract_review_required',true
  ),
  'Direct on-chain payment is a prepared candidate only. TRON, BSC and Solana are not owner-approved; settlement asset, networks, pricing, receiving addresses and verifier configuration remain pending. All routes are disabled.'
);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency','{}'::jsonb,
  jsonb_build_object(
    'onchain_foundation',true,
    'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'owner_approval_recorded',false,
    'scenarios_extended',jsonb_build_array(
      'wrong_network','wrong_asset','underpayment','overpayment',
      'duplicate_tx_hash','unfinalized_tx','reorg_or_nonfinal_tx','expired_invoice'
    ),
    'activation',false
  ),
  'On-chain sandbox scenarios are prepared but blocked until the owner chooses provider rail, network, settlement asset, pricing and public receiving addresses.'
);
