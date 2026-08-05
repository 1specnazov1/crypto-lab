update public.crypto_onchain_networks
set approved_by_owner=true,
    status='inactive',
    metadata=metadata||jsonb_build_object(
      'owner_approved_at','2026-08-05T08:43:00Z',
      'approval_source','explicit_chat_decision',
      'activation_pending',true
    ),
    updated_at=now()
where network_code in('TRON','BSC','SOLANA');

select private.service_update_crypto_launch_requirement(
  'PAYMENT_PROVIDER','in_progress',
  jsonb_build_object(
    'provider','onchain_direct',
    'wallet','trust_wallet_walletconnect',
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_approval_recorded',true,
    'settlement_asset','pending'
  ),
  jsonb_build_object(
    'foundation_schema',true,
    'automatic_entitlement_path',true,
    'private_keys_required',false,
    'network_activation',false,
    'active_network_count',0,
    'active_price_count',0,
    'receiving_address_count',0,
    'invoice_count',(select count(*) from public.crypto_onchain_invoices),
    'chain_observation_count',(select count(*) from public.crypto_onchain_tx_observations),
    'bsc_asset_contract_review_required',true,
    'owner_network_approval_corrected',true
  ),
  'Owner explicitly approved TRON, BSC and Solana. The networks are approved but remain technically inactive until asset, pricing, public receiving addresses and verifier configuration are verified.'
);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency','{}'::jsonb,
  jsonb_build_object(
    'onchain_foundation',true,
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_approval_recorded',true,
    'scenarios_extended',jsonb_build_array(
      'wrong_network','wrong_asset','underpayment','overpayment','duplicate_tx_hash',
      'duplicate_evidence','unfinalized_tx','finality_progression','finality_regression',
      'conflicting_observation','expired_invoice','late_transaction','existing_period_extension'
    ),
    'activation',false
  ),
  'Three networks are approved. Sandbox execution remains blocked only by settlement asset, pricing, receiving addresses and verifier configuration.'
);
