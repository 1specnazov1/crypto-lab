select set_config('app.crypto_owner_decision_authorized','true',true);

update public.crypto_onchain_networks
set approved_by_owner=true,
    status='inactive',
    metadata=metadata||jsonb_build_object(
      'owner_approved_at','2026-08-05T08:43:00Z',
      'approval_source','explicit_user_message',
      'approval_scope','TRON_BSC_SOLANA_network_choice_only',
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
    'owner_approval_recorded',true,
    'network_approval_recorded',true,
    'decision_scope','networks_only',
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
    'owner_decision_provenance','explicit_user_message_2026-08-05T08:43:00Z'
  ),
  'Owner explicitly approved TRON, BSC and Solana as the three payment network choices. This does not approve the settlement asset, BSC token contract, prices, receiving addresses or live activation.'
);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency','{}'::jsonb,
  jsonb_build_object(
    'onchain_foundation',true,
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'owner_approval_recorded',true,
    'network_approval_recorded',true,
    'activation',false,
    'scenarios_extended',jsonb_build_array(
      'wrong_network','wrong_asset','underpayment','overpayment','duplicate_tx_hash',
      'duplicate_evidence','unfinalized_tx','finality_progression','finality_regression',
      'conflicting_observation','expired_invoice','late_transaction','existing_period_extension'
    )
  ),
  'The three-network sandbox scope is owner-approved. Execution remains blocked by settlement asset, exact BSC token contract, pricing, public receiving addresses and verifier configuration.'
);

select set_config('app.crypto_owner_decision_authorized','false',true);
