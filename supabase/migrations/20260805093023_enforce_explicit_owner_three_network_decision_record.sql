drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;

insert into public.crypto_owner_decision_records(decision_code,decision_text,decision_hash,source_channel,scope,activation_authorized)
values(
  'ONCHAIN_THREE_NETWORK_SELECTION',
  'Три сети утверждаю.',
  encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
  'owner_chat',
  jsonb_build_object(
    'payment_rail','onchain_direct',
    'wallet_client','trust_wallet_walletconnect',
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'decision_scope','network_selection_only',
    'network_activation',false,
    'settlement_asset_selected',false,
    'pricing_selected',false,
    'receiving_addresses_configured',false,
    'original_message_timestamp_known',false
  ),
  false
)
on conflict(decision_code) do nothing;

update public.crypto_onchain_networks n
set approved_by_owner=true,
    status='inactive',
    metadata=jsonb_build_object(
      'verification',n.metadata->'verification',
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash',encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
      'approval_source','owner_chat',
      'decision_scope','network_selection_only',
      'activation_pending',true
    ),
    updated_at=now()
where n.network_code in('TRON','BSC','SOLANA');

update public.crypto_launch_requirements
set status='in_progress',
    decision_summary=jsonb_build_object(
      'provider','onchain_direct',
      'wallet','trust_wallet_walletconnect',
      'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'owner_approval_recorded',true,
      'network_approval_recorded',true,
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash',encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
      'decision_scope','networks_only',
      'settlement_asset','pending'
    ),
    evidence=evidence||jsonb_build_object(
      'decision_source','owner_chat',
      'decision_text_exact','Три сети утверждаю.',
      'immutable_decision_record',true,
      'network_activation',false,
      'bsc_asset_contract_review_required',true
    ),
    operator_note='Owner explicitly approved TRON, BSC and Solana as network choices only. Asset, BSC token contract, prices, addresses, verifier configuration and activation remain pending.',
    decided_at=coalesce(decided_at,now()),
    verified_at=null,
    updated_at=now()
where code='PAYMENT_PROVIDER';

update public.crypto_launch_requirements
set status='blocked_dependency',
    evidence=evidence||jsonb_build_object(
      'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'owner_approval_recorded',true,
      'network_approval_recorded',true,
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash',encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex'),
      'immutable_decision_record',true,
      'activation',false
    ),
    operator_note='The three-network sandbox scope is owner-approved. Execution remains blocked by asset, BSC token contract, prices, addresses and verifier configuration.',
    updated_at=now()
where code='PAYMENT_SANDBOX_E2E';

create or replace function private.enforce_crypto_onchain_network_decision_record()
returns trigger language plpgsql security definer
set search_path='pg_catalog','public','private','extensions','pg_temp'
as $$
declare
  v_hash text:=encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex');
  v_exists boolean;
begin
  if new.network_code not in('TRON','BSC','SOLANA') then return new; end if;
  select exists(
    select 1 from public.crypto_owner_decision_records
    where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
      and decision_hash=v_hash
      and decision_text='Три сети утверждаю.'
      and source_channel='owner_chat'
      and scope->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')
      and activation_authorized=false
  ) into v_exists;
  if not v_exists then raise exception 'Immutable owner network decision record is missing' using errcode='42501'; end if;
  if not new.approved_by_owner then raise exception 'Approved network selection cannot be removed without a new owner decision' using errcode='42501'; end if;
  if new.status='active' then raise exception 'Network selection does not authorize live activation' using errcode='42501'; end if;
  new.metadata=jsonb_build_object(
    'verification',new.metadata->'verification',
    'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
    'decision_hash',v_hash,
    'approval_source','owner_chat',
    'decision_scope','network_selection_only',
    'activation_pending',true
  );
  return new;
end $$;

create trigger crypto_onchain_network_owner_approval_guard
before insert or update of approved_by_owner,status,metadata
on public.crypto_onchain_networks
for each row execute function private.enforce_crypto_onchain_network_decision_record();

create or replace function private.enforce_crypto_payment_network_decision_record()
returns trigger language plpgsql security definer
set search_path='pg_catalog','public','private','extensions','pg_temp'
as $$
declare
  v_hash text:=encode(extensions.digest(convert_to('Три сети утверждаю.','UTF8'),'sha256'),'hex');
  v_exists boolean;
  v_networks jsonb;
begin
  if new.code not in('PAYMENT_PROVIDER','PAYMENT_SANDBOX_E2E') then return new; end if;
  select exists(
    select 1 from public.crypto_owner_decision_records
    where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
      and decision_hash=v_hash
      and decision_text='Три сети утверждаю.'
      and source_channel='owner_chat'
      and scope->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')
      and activation_authorized=false
  ) into v_exists;
  if not v_exists then raise exception 'Immutable owner payment decision record is missing' using errcode='42501'; end if;
  v_networks:=coalesce(new.decision_summary->'approved_networks',new.evidence->'approved_networks');
  if v_networks is distinct from jsonb_build_array('TRON','BSC','SOLANA') then
    raise exception 'Approved payment networks cannot be removed or expanded without a new owner decision' using errcode='42501';
  end if;
  if new.code='PAYMENT_PROVIDER' and new.status in('decision_required','verified','waived') then
    raise exception 'Network decision must remain in progress until remaining payment decisions are completed' using errcode='42501';
  end if;
  if new.code='PAYMENT_PROVIDER' and coalesce(new.decision_summary->>'settlement_asset','pending')<>'pending' then
    raise exception 'This owner decision does not authorize a settlement asset' using errcode='42501';
  end if;
  return new;
end $$;

create trigger crypto_payment_owner_decision_provenance_guard
before update of status,decision_summary,evidence,operator_note,decided_at,verified_at
on public.crypto_launch_requirements
for each row execute function private.enforce_crypto_payment_network_decision_record();

revoke all on function private.enforce_crypto_onchain_network_decision_record() from public,anon,authenticated,service_role;
revoke all on function private.enforce_crypto_payment_network_decision_record() from public,anon,authenticated,service_role;
revoke insert on table public.crypto_owner_decision_records from service_role;
