-- CRYPTO LAB commercial-readiness block 1: isolated sandbox fixture validation.
-- No production payment, entitlement, registration or network activation is performed.

create or replace function private.crypto_validate_onchain_sandbox_fixture(
  p_case_id uuid,
  p_observation jsonb
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare
  v_case public.crypto_onchain_sandbox_cases%rowtype;
  v_network public.crypto_onchain_networks%rowtype;
  v_profile public.crypto_onchain_verifier_profiles%rowtype;
  v_execution boolean := false;
  v_network_ok boolean;
  v_chain_ok boolean;
  v_recipient_ok boolean;
  v_token_ok boolean;
  v_amount_ok boolean;
  v_finality_ok boolean;
  v_execution_ok boolean;
begin
  if p_observation is null or jsonb_typeof(p_observation) <> 'object' or length(p_observation::text) > 16000 then
    raise exception 'Invalid sandbox fixture' using errcode='22023';
  end if;
  if p_observation::text ~* '\"(secret|private[_-]?key|seed|mnemonic|access[_-]?token|api[_-]?key)\"\s*:' then
    raise exception 'Sensitive sandbox fixture data rejected' using errcode='22023';
  end if;

  select * into v_case from public.crypto_onchain_sandbox_cases where id=p_case_id;
  if not found then raise exception 'Sandbox case not found' using errcode='P0002'; end if;
  select * into v_network from public.crypto_onchain_networks where network_code=v_case.network_code;
  select * into v_profile from public.crypto_onchain_verifier_profiles
  where network_code=v_case.network_code and environment='sandbox';

  begin
    v_execution := coalesce((p_observation->>'execution_success')::boolean,false);
  exception when others then
    raise exception 'Invalid execution status' using errcode='22023';
  end;

  v_network_ok := upper(trim(coalesce(p_observation->>'network_code',''))) = v_case.network_code;
  v_chain_ok := lower(trim(coalesce(p_observation->>'chain_reference',''))) = lower(v_profile.chain_reference_expected);
  v_recipient_ok := private.crypto_normalize_onchain_value(v_case.network_code,coalesce(p_observation->>'recipient_address',''))
                    = private.crypto_normalize_onchain_value(v_case.network_code,v_case.recipient_address);
  v_token_ok := private.crypto_normalize_onchain_value(v_case.network_code,coalesce(p_observation->>'token_identifier',''))
                = private.crypto_normalize_onchain_value(v_case.network_code,v_case.token_identifier);
  v_amount_ok := coalesce(p_observation->>'amount_base_units','') ~ '^[0-9]{1,78}$'
                 and (p_observation->>'amount_base_units')::numeric = v_case.expected_amount_base_units;
  v_finality_ok := lower(trim(coalesce(p_observation->>'finality_status',''))) = v_network.finality_mode
                   and private.crypto_onchain_finality_rank(v_case.network_code,lower(trim(coalesce(p_observation->>'finality_status','')))) = 2;
  v_execution_ok := v_execution;

  return jsonb_build_object(
    'pass',v_network_ok and v_chain_ok and v_recipient_ok and v_token_ok and v_amount_ok and v_finality_ok and v_execution_ok,
    'case_id',v_case.id,
    'network_code',v_case.network_code,
    'asset_code',v_case.asset_code,
    'checks',jsonb_build_object(
      'network',v_network_ok,
      'chain_reference',v_chain_ok,
      'recipient',v_recipient_ok,
      'token_identifier',v_token_ok,
      'amount',v_amount_ok,
      'finality',v_finality_ok,
      'execution_success',v_execution_ok
    ),
    'production_state_changed',false,
    'entitlement_changed',false
  );
end $$;

create or replace function public.validate_crypto_onchain_sandbox_fixture_service(
  p_case_id uuid,
  p_observation jsonb
) returns jsonb
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
  select private.crypto_validate_onchain_sandbox_fixture(p_case_id,p_observation)
$$;

revoke all on function public.validate_crypto_onchain_sandbox_fixture_service(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.validate_crypto_onchain_sandbox_fixture_service(uuid,jsonb) to service_role;

update public.crypto_onchain_sandbox_cases
set evidence = evidence || jsonb_build_object(
  'last_funding_check_at',now(),
  'last_observed_native_base_units','0',
  'last_observed_test_usdc_base_units','0',
  'native_gas_funded',false,
  'test_usdc_funded',false,
  'transfer_template',case network_code
    when 'ETHEREUM' then jsonb_build_object(
      'environment','sandbox','network_name','Sepolia','chain_reference','11155111',
      'sender_address','0x4eadfbe9665265527e9a5d6bde6fb15a70f05555',
      'recipient_address',recipient_address,'asset_code','USDC','token_identifier',token_identifier,
      'token_decimals',token_decimals,'amount_display','0.01 USDC','amount_base_units',expected_amount_base_units::text,
      'wallet_action','ERC20 transfer','owner_signature_required',true,'test_only',true
    )
    when 'SOLANA' then jsonb_build_object(
      'environment','sandbox','network_name','Devnet','chain_reference','devnet',
      'sender_address','4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4',
      'recipient_owner_address',recipient_address,'asset_code','USDC','token_identifier',token_identifier,
      'token_decimals',token_decimals,'amount_display','0.01 USDC','amount_base_units',expected_amount_base_units::text,
      'wallet_action','SPL token transfer','recipient_ata_may_require_creation',true,
      'owner_signature_required',true,'test_only',true
    ) end,
  'funding_routes',case network_code
    when 'ETHEREUM' then jsonb_build_array(
      jsonb_build_object('purpose','test USDC','provider','Circle Faucet','reference','https://faucet.circle.com/','human_action_required',true),
      jsonb_build_object('purpose','Sepolia ETH','provider','Ethereum faucet directory','reference','https://ethereum.org/developers/docs/networks/','human_action_required',true)
    )
    when 'SOLANA' then jsonb_build_array(
      jsonb_build_object('purpose','test USDC','provider','Circle Faucet','reference','https://faucet.circle.com/','human_action_required',true),
      jsonb_build_object('purpose','Devnet SOL','provider','Solana Web Faucet','reference','https://faucet.solana.com/','human_action_required',true,'current_blocker','github_account_age'),
      jsonb_build_object('purpose','Devnet SOL','provider','official RPC requestAirdrop','reference','https://api.devnet.solana.com','human_action_required',false,'current_result','internal_error')
    ) end,
  'fixture_validator_version','sandbox-fixture-v1'
), updated_at=now()
where environment='sandbox' and asset_code='USDC' and network_code in('ETHEREUM','SOLANA');

do $$
declare
  v_eth uuid;
  v_sol uuid;
  v_result jsonb;
begin
  select id into v_eth from public.crypto_onchain_sandbox_cases where environment='sandbox' and network_code='ETHEREUM' and asset_code='USDC';
  select id into v_sol from public.crypto_onchain_sandbox_cases where environment='sandbox' and network_code='SOLANA' and asset_code='USDC';

  v_result := private.crypto_validate_onchain_sandbox_fixture(v_eth,jsonb_build_object(
    'network_code','ETHEREUM','chain_reference','11155111','recipient_address','0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9',
    'token_identifier','0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238','amount_base_units','10000',
    'finality_status','finalized','execution_success',true));
  if not coalesce((v_result->>'pass')::boolean,false) then raise exception 'Ethereum valid fixture failed: %',v_result; end if;

  v_result := private.crypto_validate_onchain_sandbox_fixture(v_sol,jsonb_build_object(
    'network_code','SOLANA','chain_reference','devnet','recipient_address','EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F',
    'token_identifier','4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU','amount_base_units','10000',
    'finality_status','finalized','execution_success',true));
  if not coalesce((v_result->>'pass')::boolean,false) then raise exception 'Solana valid fixture failed: %',v_result; end if;

  if coalesce((private.crypto_validate_onchain_sandbox_fixture(v_eth,jsonb_build_object(
    'network_code','ETHEREUM','chain_reference','11155111','recipient_address','0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9',
    'token_identifier','0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238','amount_base_units','9999',
    'finality_status','finalized','execution_success',true))->>'pass')::boolean,false) then raise exception 'Wrong amount fixture was accepted'; end if;

  if coalesce((private.crypto_validate_onchain_sandbox_fixture(v_sol,jsonb_build_object(
    'network_code','SOLANA','chain_reference','devnet','recipient_address','11111111111111111111111111111111',
    'token_identifier','4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU','amount_base_units','10000',
    'finality_status','finalized','execution_success',true))->>'pass')::boolean,false) then raise exception 'Wrong recipient fixture was accepted'; end if;

  if coalesce((private.crypto_validate_onchain_sandbox_fixture(v_eth,jsonb_build_object(
    'network_code','SOLANA','chain_reference','11155111','recipient_address','0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9',
    'token_identifier','0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238','amount_base_units','10000',
    'finality_status','finalized','execution_success',true))->>'pass')::boolean,false) then raise exception 'Wrong network fixture was accepted'; end if;

  if coalesce((private.crypto_validate_onchain_sandbox_fixture(v_sol,jsonb_build_object(
    'network_code','SOLANA','chain_reference','devnet','recipient_address','EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F',
    'token_identifier','4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU','amount_base_units','10000',
    'finality_status','confirmed','execution_success',true))->>'pass')::boolean,false) then raise exception 'Non-final fixture was accepted'; end if;

  perform private.service_record_crypto_onchain_sandbox_run(v_eth,jsonb_build_object(
    'status','fixture_pass','verifier_version','sandbox-fixture-v1',
    'normalized_observation',private.crypto_validate_onchain_sandbox_fixture(v_eth,jsonb_build_object(
      'network_code','ETHEREUM','chain_reference','11155111','recipient_address','0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9',
      'token_identifier','0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238','amount_base_units','10000',
      'finality_status','finalized','execution_success',true)),
    'started_at',now(),'completed_at',now()));

  perform private.service_record_crypto_onchain_sandbox_run(v_sol,jsonb_build_object(
    'status','fixture_pass','verifier_version','sandbox-fixture-v1',
    'normalized_observation',private.crypto_validate_onchain_sandbox_fixture(v_sol,jsonb_build_object(
      'network_code','SOLANA','chain_reference','devnet','recipient_address','EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F',
      'token_identifier','4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU','amount_base_units','10000',
      'finality_status','finalized','execution_success',true)),
    'started_at',now(),'completed_at',now()));

  perform private.service_record_crypto_onchain_verifier_health('ETHEREUM','sandbox',jsonb_build_object(
    'ok',true,'chain_reference_observed','11155111','latest_block_reference',null,
    'finality_reference','finalized','evidence',jsonb_build_object(
      'rpc_status',200,'chain_id_hex','0xaa36a7','sender_native_base_units','0','sender_test_usdc_base_units','0',
      'probe_request_ids',jsonb_build_array(18191,18192,18193)),'checked_at',now()));

  perform private.service_record_crypto_onchain_verifier_health('SOLANA','sandbox',jsonb_build_object(
    'ok',true,'chain_reference_observed','devnet','latest_block_reference','slot:481656968',
    'finality_reference','confirmed balance probe','evidence',jsonb_build_object(
      'rpc_status',200,'sender_native_base_units','0','sender_test_usdc_accounts',0,
      'probe_request_ids',jsonb_build_array(18194,18195)),'checked_at',now()));

  if exists(select 1 from public.crypto_onchain_networks where status='active') then raise exception 'Production network activation boundary changed'; end if;
  if exists(select 1 from public.crypto_onchain_plan_pricing where active) then raise exception 'Pricing activation boundary changed'; end if;
  if exists(select 1 from public.crypto_onchain_invoices)
     or exists(select 1 from public.crypto_onchain_tx_claims)
     or exists(select 1 from public.crypto_onchain_tx_observations) then
    raise exception 'Production payment state changed';
  end if;
end $$;
