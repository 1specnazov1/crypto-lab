-- Final live RPC probe and owner-signed transfer templates for the isolated testnet contour.
-- No transaction is signed or broadcast. No production state is activated.

with eth_update as (
  select id, evidence
  from public.crypto_onchain_sandbox_cases
  where environment='sandbox' and network_code='ETHEREUM' and asset_code='USDC'
)
update public.crypto_onchain_sandbox_cases c
set evidence = c.evidence
  || jsonb_build_object(
      'last_funding_check_at','2026-08-06T17:00:16Z',
      'last_observed_native_base_units','0',
      'last_observed_test_usdc_base_units','0',
      'latest_live_probe_version','live-funding-probe-v1',
      'latest_live_probe_request_ids',jsonb_build_array(18330,18331,18332),
      'latest_live_probe_chain_id_hex','0xaa36a7',
      'official_contract_reference','https://developers.circle.com/stablecoins/usdc-contract-addresses',
      'official_chain_reference','https://ethereum.org/developers/tutorials/creating-a-wagmi-ui-for-your-contract/'
    )
  || jsonb_build_object(
      'transfer_template', (c.evidence->'transfer_template') || jsonb_build_object(
        'method_signature','transfer(address,uint256)',
        'method_selector','0xa9059cbb',
        'transaction_to','0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        'transaction_value_wei','0',
        'transaction_data','0xa9059cbb000000000000000000000000bcd27864ea603643bc8aebb3fe2cec2ffdb39eb90000000000000000000000000000000000000000000000000000000000002710',
        'gas_and_nonce_source','owner_wallet_estimation',
        'broadcast_allowed',false
      )
    ),
    updated_at=now()
from eth_update u
where c.id=u.id;

with sol_update as (
  select id, evidence
  from public.crypto_onchain_sandbox_cases
  where environment='sandbox' and network_code='SOLANA' and asset_code='USDC'
)
update public.crypto_onchain_sandbox_cases c
set evidence = c.evidence
  || jsonb_build_object(
      'last_funding_check_at','2026-08-06T17:00:15Z',
      'last_observed_native_base_units','0',
      'last_observed_test_usdc_base_units','0',
      'latest_live_probe_version','live-funding-probe-v1',
      'latest_live_probe_request_ids',jsonb_build_array(18333,18334),
      'latest_live_probe_confirmed_slot','481666787',
      'official_contract_reference','https://developers.circle.com/stablecoins/usdc-contract-addresses',
      'official_transfer_reference','https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana',
      'official_payment_reference','https://solana.com/docs/payments/send-payments/verify-address'
    )
  || jsonb_build_object(
      'transfer_template', (c.evidence->'transfer_template') || jsonb_build_object(
        'token_program','TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        'instruction','transfer_checked',
        'source_ata_resolution','derive from sender owner + token program + mint',
        'recipient_ata_resolution','derive from recipient owner + token program + mint',
        'recipient_ata_creation','create idempotently if absent',
        'mint_decimals_check',6,
        'recent_blockhash_source','official Devnet RPC at signing time',
        'fee_payer','owner wallet',
        'broadcast_allowed',false
      )
    ),
    updated_at=now()
from sol_update u
where c.id=u.id;

update public.crypto_onchain_sandbox_sender_accounts
set evidence=evidence || case network_code
  when 'ETHEREUM' then jsonb_build_object(
    'last_balance_check_at','2026-08-06T17:00:16Z',
    'last_balance_check_rpc','PublicNode Sepolia',
    'last_native_balance_base_units','0',
    'last_test_usdc_balance_base_units','0',
    'last_balance_probe_request_ids',jsonb_build_array(18330,18331,18332)
  )
  when 'SOLANA' then jsonb_build_object(
    'last_balance_check_at','2026-08-06T17:00:15Z',
    'last_balance_check_rpc','Solana official Devnet RPC',
    'last_native_balance_base_units','0',
    'last_test_usdc_balance_base_units','0',
    'last_balance_probe_request_ids',jsonb_build_array(18333,18334),
    'last_balance_probe_confirmed_slot','481666787'
  )
end,
updated_at=now()
where environment='sandbox' and network_code in ('ETHEREUM','SOLANA');

with observations as (
  select c.id as case_id,
    jsonb_build_object(
      'network_code','ETHEREUM','asset_code','USDC','rpc_success',true,
      'chain_reference','11155111','chain_id_hex','0xaa36a7',
      'sender_address','0x4eadfbe9665265527e9a5d6bde6fb15a70f05555',
      'native_balance_base_units','0','test_usdc_balance_base_units','0',
      'funding_ready',false,'transaction_broadcast',false,
      'request_ids',jsonb_build_array(18330,18331,18332),
      'observed_at','2026-08-06T17:00:16Z',
      'production_state_changed',false,'entitlement_changed',false
    ) as observation
  from public.crypto_onchain_sandbox_cases c
  where c.environment='sandbox' and c.network_code='ETHEREUM' and c.asset_code='USDC'
  union all
  select c.id,
    jsonb_build_object(
      'network_code','SOLANA','asset_code','USDC','rpc_success',true,
      'chain_reference','devnet','confirmed_slot','481666787',
      'sender_address','4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4',
      'native_balance_base_units','0','test_usdc_balance_base_units','0',
      'token_account_count',0,'funding_ready',false,'transaction_broadcast',false,
      'request_ids',jsonb_build_array(18333,18334),
      'observed_at','2026-08-06T17:00:15Z',
      'production_state_changed',false,'entitlement_changed',false
    )
  from public.crypto_onchain_sandbox_cases c
  where c.environment='sandbox' and c.network_code='SOLANA' and c.asset_code='USDC'
)
insert into public.crypto_onchain_sandbox_runs(
  case_id,verifier_version,status,tx_hash,normalized_observation,evidence_hash,error_code,started_at,completed_at
)
select case_id,'live-funding-probe-v1','rpc_observed',null,observation,
       encode(digest(observation::text,'sha256'),'hex'),'FUNDING_REQUIRED',
       (observation->>'observed_at')::timestamptz,(observation->>'observed_at')::timestamptz
from observations;

do $$
begin
  if exists(select 1 from public.crypto_onchain_sandbox_sender_accounts where mainnet_authorized or entitlement_capable or secret_material_received) then
    raise exception 'Sandbox sender safety boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_networks where status='active') then
    raise exception 'Production network activation boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_plan_pricing where active) then
    raise exception 'Pricing activation boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_receiving_addresses where active) then
    raise exception 'Receiving address activation boundary changed';
  end if;
  if exists(select 1 from public.crypto_onchain_invoices)
     or exists(select 1 from public.crypto_onchain_tx_claims)
     or exists(select 1 from public.crypto_onchain_tx_observations) then
    raise exception 'Production payment state changed';
  end if;
end $$;
