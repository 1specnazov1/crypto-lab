do $$
declare
  v_text constant text := 'Разрешаю тестовые переводы SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1: 0,01 testnet USDC в сети Ethereum Sepolia и 0,01 testnet USDC в сети Solana Devnet на уже подтверждённые адреса. Mainnet, реальные платежи, активацию тарифов и возвратов не разрешаю.';
  v_hash text := encode(extensions.digest(convert_to(v_text,'UTF8'),'sha256'),'hex');
  v_existing public.crypto_owner_decision_records%rowtype;
begin
  select * into v_existing
  from public.crypto_owner_decision_records
  where decision_code='SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1';

  if found then
    if v_existing.decision_text<>v_text or v_existing.decision_hash<>v_hash then
      raise exception 'Sandbox transfer approval record mismatch' using errcode='23505';
    end if;
  else
    insert into public.crypto_owner_decision_records(
      decision_code,decision_text,decision_hash,source_channel,scope,
      activation_authorized,recorded_at,active
    ) values(
      'SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1',v_text,v_hash,'owner_chat',
      jsonb_build_object(
        'decision_scope','two_testnet_usdc_transfers_only',
        'approved_transfers',jsonb_build_array(
          jsonb_build_object('network','ETHEREUM','environment','Sepolia','asset','USDC','amount_base_units','10000','amount_display','0.01 USDC'),
          jsonb_build_object('network','SOLANA','environment','Devnet','asset','USDC','amount_base_units','10000','amount_display','0.01 USDC')
        ),
        'recipient_scope','previously_verified_owner_receiving_addresses',
        'mainnet_authorized',false,
        'real_value_authorized',false,
        'payment_activation_authorized',false,
        'plan_activation_authorized',false,
        'refund_execution_authorized',false,
        'checkout_authorized',false,
        'webhook_authorized',false,
        'recurring_authorized',false,
        'private_keys_requested',false,
        'seed_phrases_requested',false
      ),
      true,now(),true
    );
  end if;

  if not exists(
    select 1 from public.crypto_owner_decision_authority_events
    where decision_code='SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1'
      and event_type='confirmed'
      and authority_state='effective'
      and decision_text_hash=v_hash
  ) then
    insert into public.crypto_owner_decision_authority_events(
      decision_code,event_type,authority_state,decision_text_hash,evidence,effective_at
    ) values(
      'SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1','confirmed','effective',v_hash,
      jsonb_build_object(
        'source_channel','owner_chat',
        'scope','two_testnet_usdc_transfers_only',
        'mainnet_authorized',false,
        'real_payments_authorized',false,
        'payment_activation_authorized',false,
        'refund_execution_authorized',false
      ),now()
    );
  end if;

  update public.crypto_onchain_sandbox_cases
  set evidence = evidence || jsonb_build_object(
        'owner_execution_decision_code','SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1',
        'owner_execution_decision_hash',v_hash,
        'scoped_execution_authorized',true,
        'authorized_amount_base_units','10000',
        'authorization_recorded_at',now(),
        'source_wallet_pending',true,
        'native_gas_funding_pending',true,
        'test_usdc_funding_pending',true,
        'mainnet_authorized',false,
        'can_grant_entitlement',false
      ),
      updated_at=now()
  where environment='sandbox'
    and asset_code='USDC'
    and network_code in('ETHEREUM','SOLANA')
    and expected_amount_base_units=10000;

  update public.crypto_launch_requirements
  set evidence = evidence || jsonb_build_object(
        'scoped_test_transfer_execution_authorized',true,
        'scoped_decision_code','SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1',
        'scoped_decision_hash',v_hash,
        'approved_transfer_count',2,
        'approved_pairs',jsonb_build_array('ETHEREUM_SEPOLIA_USDC','SOLANA_DEVNET_USDC'),
        'approved_amount_base_units_per_transfer','10000',
        'approved_amount_display_per_transfer','0.01 testnet USDC',
        'mainnet_authorized',false,
        'real_payments_authorized',false,
        'payment_activation_authorized',false,
        'plan_activation_authorized',false,
        'refund_execution_authorized',false,
        'source_wallet_pending',true,
        'native_gas_funding_pending',true,
        'test_usdc_funding_pending',true,
        'general_live_transfer_execution_authorized',false
      ),
      operator_note='Owner authorized exactly two isolated testnet transfers: 0.01 USDC on Ethereum Sepolia and 0.01 USDC on Solana Devnet to previously verified addresses. Mainnet, real payments, plan activation and refunds remain prohibited. Execution is still blocked until a test sender wallet has test USDC and native gas.',
      updated_at=now()
  where code='PAYMENT_SANDBOX_E2E';
end $$;