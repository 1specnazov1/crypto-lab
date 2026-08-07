create or replace function private.service_record_crypto_onchain_sandbox_run(p_case_id uuid, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public','private','extensions','pg_catalog','pg_temp'
as $function$
declare
  v_case public.crypto_onchain_sandbox_cases%rowtype;
  v_sender public.crypto_onchain_sandbox_sender_accounts%rowtype;
  v_status text;
  v_tx text;
  v_started timestamptz;
  v_completed timestamptz;
  v_hash text;
  v_id uuid;
  v_obs jsonb;
  v_obs_sender text;
  v_obs_recipient text;
  v_obs_token text;
  v_obs_network text;
  v_obs_asset text;
  v_obs_amount text;
  v_obs_finality text;
  v_obs_success boolean;
begin
  if p_result is null or jsonb_typeof(p_result)<>'object' or length(p_result::text)>32000 then
    raise exception 'Invalid sandbox result' using errcode='22023';
  end if;
  if p_result::text ~* '\"(secret|private[_-]?key|seed|mnemonic|authorization|access[_-]?token|api[_-]?key)\"\s*:' then
    raise exception 'Sensitive sandbox data rejected' using errcode='22023';
  end if;

  select * into v_case
  from public.crypto_onchain_sandbox_cases
  where id=p_case_id
  for update;
  if not found then raise exception 'Sandbox case not found' using errcode='P0002'; end if;

  v_status=lower(trim(coalesce(p_result->>'status','blocked')));
  if v_status not in('health_only','fixture_pass','fixture_fail','rpc_observed','passed','failed','blocked') then
    raise exception 'Invalid sandbox run status' using errcode='22023';
  end if;

  v_tx=nullif(trim(coalesce(p_result->>'tx_hash','')),'');
  if v_tx is not null and not private.crypto_validate_onchain_tx_hash(v_case.network_code,v_tx) then
    raise exception 'Invalid sandbox transaction identifier' using errcode='22023';
  end if;

  begin
    v_started=coalesce(nullif(p_result->>'started_at','')::timestamptz,now());
    v_completed=coalesce(nullif(p_result->>'completed_at','')::timestamptz,now());
  exception when others then
    raise exception 'Invalid sandbox run time' using errcode='22023';
  end;
  if v_completed<v_started or v_completed>now()+interval '5 minutes' then
    raise exception 'Invalid sandbox run interval' using errcode='22023';
  end if;

  v_obs=coalesce(p_result->'normalized_observation','{}'::jsonb);
  if jsonb_typeof(v_obs)<>'object' then
    raise exception 'Invalid normalized observation' using errcode='22023';
  end if;

  if v_status='passed' then
    if v_tx is null then
      raise exception 'Passed sandbox run requires transaction identifier' using errcode='22023';
    end if;

    select * into v_sender
    from public.crypto_onchain_sandbox_sender_accounts
    where environment='sandbox'
      and network_code=v_case.network_code
      and verified=true
      and configured=true
      and mainnet_authorized=false
      and entitlement_capable=false
      and secret_material_received=false
    order by updated_at desc
    limit 1;
    if not found then
      raise exception 'Verified sandbox sender not configured' using errcode='22023';
    end if;

    v_obs_sender=nullif(trim(coalesce(v_obs->>'sender_address','')),'');
    v_obs_recipient=nullif(trim(coalesce(v_obs->>'recipient_address','')),'');
    v_obs_token=nullif(trim(coalesce(v_obs->>'token_identifier','')),'');
    v_obs_network=upper(trim(coalesce(v_obs->>'network_code','')));
    v_obs_asset=upper(trim(coalesce(v_obs->>'asset_code','')));
    v_obs_amount=trim(coalesce(v_obs->>'amount_base_units',''));
    v_obs_finality=lower(trim(coalesce(v_obs->>'finality_status','')));
    begin
      v_obs_success=coalesce((v_obs->>'execution_success')::boolean,false);
    exception when others then
      v_obs_success=false;
    end;

    if v_obs_sender is null or v_obs_recipient is null or v_obs_token is null then
      raise exception 'Passed sandbox observation is incomplete' using errcode='22023';
    end if;
    if v_obs_network<>v_case.network_code or v_obs_asset<>v_case.asset_code then
      raise exception 'Sandbox network or asset mismatch' using errcode='22023';
    end if;
    if v_case.network_code='ETHEREUM' then
      if lower(v_obs_sender)<>lower(v_sender.address)
         or lower(v_obs_recipient)<>lower(v_case.recipient_address)
         or lower(v_obs_token)<>lower(v_case.token_identifier) then
        raise exception 'Sandbox sender/recipient/token mismatch' using errcode='22023';
      end if;
    else
      if v_obs_sender<>v_sender.address
         or v_obs_recipient<>v_case.recipient_address
         or v_obs_token<>v_case.token_identifier then
        raise exception 'Sandbox sender/recipient/token mismatch' using errcode='22023';
      end if;
    end if;
    if v_obs_amount<>v_case.expected_amount_base_units::text then
      raise exception 'Sandbox amount mismatch' using errcode='22023';
    end if;
    if not v_obs_success then
      raise exception 'Sandbox transaction execution failed' using errcode='22023';
    end if;
    if v_obs_finality not in ('finalized','solidified') then
      raise exception 'Sandbox transaction is not final' using errcode='22023';
    end if;
  end if;

  v_hash=encode(extensions.digest(convert_to(p_result::text,'UTF8'),'sha256'),'hex');
  insert into public.crypto_onchain_sandbox_runs(
    case_id,verifier_version,status,tx_hash,normalized_observation,evidence_hash,error_code,started_at,completed_at
  ) values(
    p_case_id,left(coalesce(nullif(p_result->>'verifier_version',''),'unknown'),80),v_status,v_tx,v_obs,v_hash,
    left(nullif(p_result->>'error_code',''),80),v_started,v_completed
  ) returning id into v_id;

  update public.crypto_onchain_sandbox_cases
  set status=case
        when v_status='passed' then 'passed'
        when v_status in('failed','fixture_fail') then 'failed'
        when v_status='rpc_observed' then 'observed'
        else status
      end,
      tx_hash=coalesce(v_tx,tx_hash),
      updated_at=now()
  where id=p_case_id;

  return jsonb_build_object(
    'ok',true,
    'sandbox_run_id',v_id,
    'case_id',p_case_id,
    'status',v_status,
    'sender_enforced',v_status='passed',
    'entitlement_changed',false,
    'billing_changed',false
  );
end
$function$;

revoke all on function private.service_record_crypto_onchain_sandbox_run(uuid,jsonb) from public, anon, authenticated;
grant execute on function private.service_record_crypto_onchain_sandbox_run(uuid,jsonb) to service_role;
revoke all on function public.service_record_crypto_onchain_sandbox_run(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.service_record_crypto_onchain_sandbox_run(uuid,jsonb) to service_role;
