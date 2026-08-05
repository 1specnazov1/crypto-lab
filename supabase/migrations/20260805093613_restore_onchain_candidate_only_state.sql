drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;

update public.crypto_onchain_networks
set approved_by_owner=false,
    status='inactive',
    metadata=jsonb_strip_nulls(jsonb_build_object('verification',metadata->'verification')),
    updated_at=now()
where network_code in('TRON','BSC','SOLANA');

update public.crypto_onchain_network_assets set enabled=false,updated_at=now()
where network_code in('TRON','BSC','SOLANA');

update public.crypto_onchain_assets
set selected=false,status='decision_required',metadata=metadata||jsonb_build_object('decision_pending',true),updated_at=now()
where asset_code in('USDT','USDC');

update public.crypto_onchain_plan_pricing set active=false,approved_at=null,updated_at=now();
update public.crypto_onchain_receiving_addresses set active=false,verified=false,verified_at=null,updated_at=now();

update public.crypto_billing_provider_adapters
set desired_mode='disabled',lifecycle_status='draft',checkout_enabled=false,webhook_enabled=false,recurring_enabled=false,refunds_enabled=false,last_verified_at=null,
    last_verification=jsonb_build_object('state','candidate_only','owner_provider_decision_recorded',false,'owner_network_decision_recorded',false,'asset_selected',false,'pricing_active',false,'receiving_addresses_active',false,'activation_allowed',false),updated_at=now()
where provider='onchain';

update public.crypto_launch_requirements
set status='decision_required',
    decision_summary=jsonb_build_object('candidate_provider','onchain_direct','wallet_client_candidate','trust_wallet_walletconnect','candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),'settlement_asset','pending','owner_approval_recorded',false),
    evidence=jsonb_build_object('foundation_schema',true,'transaction_claim_lifecycle_hardened',true,'automatic_entitlement_path_prepared',true,'automatic_entitlement_enabled',false,'automatic_wallet_debit',false,'private_keys_required',false,'network_activation',false,'active_network_count',0,'selected_asset_count',0,'active_price_count',0,'receiving_address_count',0,'invoice_count',(select count(*) from public.crypto_onchain_invoices),'chain_observation_count',(select count(*) from public.crypto_onchain_tx_observations),'owner_approval_recorded',false,'superseded_invalid_evidence',true),
    operator_note='Direct on-chain payment, Trust Wallet/WalletConnect and TRON/BSC/Solana are disabled candidates only. No provider rail, network, asset, price, receiving address or activation is owner-approved.',
    decided_at=null,verified_at=null,updated_at=now()
where code='PAYMENT_PROVIDER';

update public.crypto_launch_requirements
set status='blocked_dependency',decision_summary='{}'::jsonb,
    evidence=jsonb_build_object('onchain_foundation',true,'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),'owner_approval_recorded',false,'transaction_claim_lifecycle_hardened',true,'activation',false,'sandbox_execution_authorized',false,'scenarios_extended',jsonb_build_array('wrong_network','wrong_asset','underpayment','overpayment','duplicate_tx_hash','duplicate_evidence','unfinalized_tx','finality_progression','finality_regression','conflicting_observation','expired_invoice','late_transaction','existing_period_extension')),
    operator_note='Provider-neutral and on-chain sandbox scenarios are prepared but disabled. No payment provider, network, asset, price, address, verifier or controlled payment test is approved.',
    decided_at=null,verified_at=null,updated_at=now()
where code='PAYMENT_SANDBOX_E2E';
