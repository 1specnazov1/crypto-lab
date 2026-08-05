drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;

insert into public.crypto_owner_decision_records(
  decision_code,decision_text,decision_hash,source_channel,scope,activation_authorized
)
values(
  'ONCHAIN_THREE_NETWORK_SELECTION',
  'Три сети утверждаю.',
  '57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
  'owner_chat',
  jsonb_build_object(
    'payment_rail','onchain_direct',
    'wallet_client','trust_wallet_walletconnect',
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_activation',false,
    'settlement_asset_selected',false,
    'pricing_selected',false,
    'receiving_addresses_configured',false,
    'original_message_timestamp_known',false,
    'recorded_by','autonomous_release_control'
  ),
  false
)
on conflict(decision_code) do nothing;

create or replace function private.enforce_crypto_onchain_owner_decision_record()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_expected_hash constant text:='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';
  v_record_exists boolean;
  v_revocation_authorized boolean:=coalesce(current_setting('app.crypto_owner_decision_revocation_authorized',true),'false')='true';
begin
  select exists(
    select 1 from public.crypto_owner_decision_records
    where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
      and decision_text='Три сети утверждаю.'
      and decision_hash=v_expected_hash
      and source_channel='owner_chat'
      and activation_authorized=false
  ) into v_record_exists;

  if new.approved_by_owner then
    if not v_record_exists then
      raise exception 'Owner-approved network requires the immutable three-network decision record' using errcode='42501';
    end if;
    if coalesce(new.metadata->>'decision_code','')<>'ONCHAIN_THREE_NETWORK_SELECTION'
       or coalesce(new.metadata->>'decision_hash','')<>v_expected_hash then
      raise exception 'Owner-approved network metadata does not match the immutable decision record' using errcode='42501';
    end if;
  end if;

  if tg_op='UPDATE' and old.approved_by_owner and not new.approved_by_owner and v_record_exists and not v_revocation_authorized then
    raise exception 'Recorded owner network approval cannot be removed without an explicit revocation decision' using errcode='42501';
  end if;

  if not new.approved_by_owner and (
    new.metadata ? 'decision_code' or new.metadata ? 'decision_hash' or new.metadata ? 'owner_approval_recorded'
  ) then
    raise exception 'Decision metadata requires approved_by_owner=true' using errcode='42501';
  end if;
  return new;
end $$;

create or replace function private.enforce_crypto_payment_owner_decision_record()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_expected_hash constant text:='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';
  v_record_exists boolean;
  v_owner_claim boolean:=false;
  v_revocation_authorized boolean:=coalesce(current_setting('app.crypto_owner_decision_revocation_authorized',true),'false')='true';
begin
  if new.code not in('PAYMENT_PROVIDER','PAYMENT_SANDBOX_E2E') then return new; end if;
  select exists(
    select 1 from public.crypto_owner_decision_records
    where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
      and decision_text='Три сети утверждаю.'
      and decision_hash=v_expected_hash
      and source_channel='owner_chat'
      and activation_authorized=false
  ) into v_record_exists;

  v_owner_claim:=
    coalesce((new.decision_summary->>'network_approval_recorded')::boolean,false)
    or coalesce((new.decision_summary->>'owner_approval_recorded')::boolean,false)
    or coalesce((new.evidence->>'network_approval_recorded')::boolean,false)
    or coalesce((new.evidence->>'owner_approval_recorded')::boolean,false)
    or new.decision_summary ? 'approved_networks'
    or new.evidence ? 'approved_networks'
    or new.decision_summary ? 'decision_code'
    or new.decision_summary ? 'decision_hash'
    or new.evidence ? 'decision_code'
    or new.evidence ? 'decision_hash';

  if v_owner_claim then
    if not v_record_exists then
      raise exception 'Payment owner claim requires the immutable three-network decision record' using errcode='42501';
    end if;
    if coalesce(new.decision_summary->>'decision_code',new.evidence->>'decision_code','')<>'ONCHAIN_THREE_NETWORK_SELECTION'
       or coalesce(new.decision_summary->>'decision_hash',new.evidence->>'decision_hash','')<>v_expected_hash then
      raise exception 'Payment owner claim does not match the immutable decision record' using errcode='42501';
    end if;
  end if;

  if new.code='PAYMENT_PROVIDER' and v_record_exists
     and old.status<>'decision_required' and new.status='decision_required'
     and not v_revocation_authorized then
    raise exception 'Recorded owner network decision cannot be reverted to decision_required without an explicit revocation decision' using errcode='42501';
  end if;
  return new;
end $$;

revoke all on function private.enforce_crypto_onchain_owner_decision_record() from public,anon,authenticated,service_role;
revoke all on function private.enforce_crypto_payment_owner_decision_record() from public,anon,authenticated,service_role;

drop function if exists private.block_crypto_onchain_owner_approval();
drop function if exists private.block_crypto_payment_owner_decision_claim();

create trigger crypto_onchain_network_owner_approval_guard
before insert or update of approved_by_owner,metadata
on public.crypto_onchain_networks
for each row execute function private.enforce_crypto_onchain_owner_decision_record();

create trigger crypto_payment_owner_decision_provenance_guard
before update of status,decision_summary,evidence,operator_note,decided_at,verified_at
on public.crypto_launch_requirements
for each row execute function private.enforce_crypto_payment_owner_decision_record();

update public.crypto_onchain_networks
set approved_by_owner=true,
    status='inactive',
    metadata=jsonb_build_object(
      'verification',metadata->'verification',
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
      'approval_source','owner_chat',
      'approval_recorded_at',now(),
      'owner_approval_recorded',true,
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
    'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
    'settlement_asset','pending'
  ),
  jsonb_build_object(
    'decision_source','owner_chat',
    'decision_text_exact','Три сети утверждаю.',
    'decision_recorded_at',(select recorded_at from public.crypto_owner_decision_records where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'),
    'original_message_timestamp_known',false,
    'foundation_schema',true,
    'transaction_claim_lifecycle_hardened',true,
    'owner_decision_guard_mode','immutable_record_match',
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
  'Owner explicitly approved TRON, BSC and Solana by writing “Три сети утверждаю.” The immutable record and SHA-256 fingerprint are authoritative. Networks remain inactive pending asset, pricing, addresses, verifier configuration and sandbox evidence.'
);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency',
  jsonb_build_object(
    'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
  ),
  jsonb_build_object(
    'onchain_foundation',true,
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_approval_recorded',true,
    'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
    'owner_decision_guard_mode','immutable_record_match',
    'transaction_claim_lifecycle_hardened',true,
    'activation',false
  ),
  'The owner-approved three-network sandbox scope remains disabled. Execution requires settlement asset, prices, public addresses, verifier configuration and controlled-test authorization.'
);

create or replace function private.crypto_owner_decision_integrity_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path='public','private','pg_catalog','pg_temp'
as $$
declare
  v_hash constant text:='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';
  v_checks jsonb;
  v_failures integer;
begin
  with checks(code,violations) as (
    select 'exact_immutable_decision_record',case when exists(
      select 1 from public.crypto_owner_decision_records
      where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
        and decision_text='Три сети утверждаю.' and decision_hash=v_hash
        and source_channel='owner_chat' and activation_authorized=false
    ) then 0 else 1 end
    union all
    select 'three_networks_approved_inactive',case when (
      select count(*) from public.crypto_onchain_networks
      where network_code in('TRON','BSC','SOLANA') and approved_by_owner and status='inactive'
        and metadata->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION'
        and metadata->>'decision_hash'=v_hash
    )=3 then 0 else 1 end
    union all
    select 'payment_requirement_matches_decision',case when exists(
      select 1 from public.crypto_launch_requirements
      where code='PAYMENT_PROVIDER' and status='in_progress'
        and decision_summary->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION'
        and decision_summary->>'decision_hash'=v_hash
        and coalesce((decision_summary->>'network_approval_recorded')::boolean,false)
    ) then 0 else 1 end
    union all
    select 'no_network_activation',case when (select count(*) from public.crypto_onchain_networks where status='active')=0 then 0 else 1 end
    union all
    select 'payment_adapter_disabled',case when exists(
      select 1 from public.crypto_billing_provider_adapters
      where provider='onchain' and desired_mode='disabled' and lifecycle_status='draft'
        and not checkout_enabled and not webhook_enabled and not recurring_enabled and not refunds_enabled
    ) then 0 else 1 end
  )
  select jsonb_agg(jsonb_build_object('code',code,'violations',violations,'passed',violations=0) order by code),
         sum(case when violations>0 then 1 else 0 end)
  into v_checks,v_failures from checks;
  return jsonb_build_object('state',case when v_failures=0 then 'healthy' else 'critical' end,'generated_at',now(),'total_checks',jsonb_array_length(v_checks),'failed_checks',v_failures,'checks',v_checks);
end $$;

revoke all on function private.crypto_owner_decision_integrity_snapshot() from public,anon,authenticated;
grant execute on function private.crypto_owner_decision_integrity_snapshot() to service_role;

comment on function private.enforce_crypto_onchain_owner_decision_record() is 'Requires an exact immutable owner decision record for approval and blocks silent approval removal.';
comment on function private.enforce_crypto_payment_owner_decision_record() is 'Requires payment owner claims to match the exact immutable decision record and blocks silent reversion.';
