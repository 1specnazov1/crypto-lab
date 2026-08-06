update public.crypto_launch_requirements
set evidence = jsonb_set(
      jsonb_set(
        jsonb_set(
          evidence,
          '{testnet_transfer_execution_pending_owner_approval}',
          'false'::jsonb,
          true
        ),
        '{next_owner_decision_proposal,owner_confirmation_required}',
        'false'::jsonb,
        true
      ),
      '{next_owner_decision_proposal,owner_approved}',
      'true'::jsonb,
      true
    ) || jsonb_build_object(
      'owner_approval_recorded',true,
      'owner_approval_recorded_at',now(),
      'remaining_execution_dependencies',jsonb_build_array(
        'TEST_SENDER_WALLET',
        'TESTNET_USDC_FUNDING',
        'TESTNET_NATIVE_GAS',
        'OWNER_WALLET_SIGNATURE_OR_CONTROLLED_TEST_SIGNER'
      )
    ),
    updated_at=now()
where code='PAYMENT_SANDBOX_E2E';