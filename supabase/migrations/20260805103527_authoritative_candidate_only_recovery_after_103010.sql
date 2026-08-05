-- Authoritative candidate-only recovery after false stale-cycle migration 20260805103010.
-- No provider, network, asset, price, address or activation has been approved by the owner.

drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;
drop trigger if exists crypto_owner_decision_record_immutable on public.crypto_owner_decision_records;
drop trigger if exists crypto_payment_owner_decision_record_fail_closed on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_decision_record_insert_guard on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_decision_exact_record_guard on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_authority_event_immutable on public.crypto_owner_decision_authority_events;
drop trigger if exists crypto_payment_owner_authority_event_fail_closed on public.crypto_owner_decision_authority_events;

alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_networks_exact_owner_selection;
alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_canonical_three_network_approval_check;
alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_final_owner_network_state;
alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_networks_owner_decision_fail_closed;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_exact_owner_network_decision;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_provider_owner_decision_check;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_final_owner_network_state;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_provider_owner_decision_fail_closed;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_sandbox_owner_claim_fail_closed;
alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_canonical_three_network_check;
alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_final_three_network_state;
alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_payment_record_fail_closed;
alter table public.crypto_owner_decision_authority_events drop constraint if exists crypto_owner_authority_event_payment_fail_closed;

update public.crypto_owner_decision_records
set active=false,activation_authorized=false
where decision_code ~* '^(ONCHAIN|PAYMENT)_';

update public.crypto_owner_decision_authority_events
set authority_state='superseded',
    evidence=evidence||jsonb_build_object(
      'invalidated_by_migration','authoritative_candidate_only_recovery_after_103010',
      'classification','invalid_reconstructed_owner_authority',
      'owner_approval_recorded',false,
      'preserve_for_audit_only',true,
      'superseded_false_migration','20260805103010_restore_exact_owner_three_network_authority_after_stale_cycle'
    )
where decision_code ~* '^(ONCHAIN|PAYMENT)_' and authority_state='effective';

update public.crypto_onchain_networks
set approved_by_owner=false,status='inactive',
    metadata=jsonb_strip_nulls(jsonb_build_object('verification',metadata->'verification')),
    updated_at=now()
where network_code in('TRON','BSC','SOLANA');

update public.crypto_onchain_network_assets set enabled=false,updated_at=now();
update public.crypto_onchain_assets
set selected=false,status='decision_required',
    metadata=(metadata-'owner_approval'-'decision_hash'-'decision_code')||jsonb_build_object('decision_pending',true),
    updated_at=now()
where asset_code in('USDT','USDC');
update public.crypto_onchain_plan_pricing set active=false,approved_at=null,updated_at=now();
update public.crypto_onchain_receiving_addresses set active=false,verified=false,verified_at=null,updated_at=now();

update public.crypto_billing_provider_adapters
set desired_mode='disabled',lifecycle_status='draft',checkout_enabled=false,webhook_enabled=false,
    recurring_enabled=false,refunds_enabled=false,last_verified_at=null,
    last_verification=jsonb_build_object(
      'state','candidate_only','owner_provider_decision_recorded',false,
      'owner_network_decision_recorded',false,'asset_selected',false,
      'pricing_active',false,'receiving_addresses_active',false,
      'automatic_entitlement_enabled',false,'activation_allowed',false,
      'false_103010_authority_superseded',true
    ),updated_at=now()
where provider='onchain';

update public.crypto_launch_requirements
set status='decision_required',
    decision_summary=jsonb_build_object(
      'candidate_provider','onchain_direct','wallet_client_candidate','trust_wallet_walletconnect',
      'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'settlement_asset','pending','owner_approval_recorded',false
    ),
    evidence=jsonb_build_object(
      'foundation_schema',true,'transaction_claim_lifecycle_hardened',true,
      'automatic_entitlement_path_prepared',true,'automatic_entitlement_enabled',false,
      'automatic_wallet_debit',false,'private_keys_required',false,
      'network_activation',false,'active_network_count',0,'selected_asset_count',0,
      'active_price_count',0,'receiving_address_count',0,
      'invoice_count',(select count(*) from public.crypto_onchain_invoices),
      'chain_observation_count',(select count(*) from public.crypto_onchain_tx_observations),
      'owner_approval_recorded',false,'false_103010_authority_superseded',true,
      'overlapping_automation_disabled',true
    ),
    operator_note='Trust Wallet and direct on-chain payment are disabled candidates. TRON, BSC and Solana are candidate networks only. No provider rail, network, asset, price, address, verifier, entitlement or activation is owner-approved.',
    decided_at=null,verified_at=null,updated_at=now()
where code='PAYMENT_PROVIDER';

update public.crypto_launch_requirements
set status='blocked_dependency',decision_summary='{}'::jsonb,
    evidence=jsonb_build_object(
      'onchain_foundation',true,'candidate_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'owner_approval_recorded',false,'transaction_claim_lifecycle_hardened',true,
      'activation',false,'sandbox_execution_authorized',false,
      'false_103010_authority_superseded',true,'overlapping_automation_disabled',true
    ),
    operator_note='Payment sandbox remains disabled. No provider, network, asset, price, address, verifier or real-value test is approved.',
    decided_at=null,verified_at=null,updated_at=now()
where code='PAYMENT_SANDBOX_E2E';

create or replace function private.crypto_onchain_candidate_metadata_safe(p_metadata jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,pg_temp
as $$ declare v_key text; begin
  for v_key in select jsonb_object_keys(coalesce(p_metadata,'{}'::jsonb)) loop
    if v_key ~* '(owner|approval|decision|activation)' then return false; end if;
  end loop;
  return true;
end $$;

create or replace function private.crypto_payment_owner_claim_absent(p_summary jsonb,p_evidence jsonb,p_note text)
returns boolean language plpgsql immutable set search_path=pg_catalog,pg_temp
as $$ begin
  if coalesce(p_summary,'{}'::jsonb) ?| array['approved_networks','decision_hash','decision_code','owner_decision_id'] then return false; end if;
  if coalesce(p_evidence,'{}'::jsonb) ?| array['approved_networks','decision_hash','decision_code','owner_decision_id'] then return false; end if;
  if coalesce((p_summary->>'owner_approval_recorded')::boolean,false)
     or coalesce((p_summary->>'network_approval_recorded')::boolean,false)
     or coalesce((p_evidence->>'owner_approval_recorded')::boolean,false)
     or coalesce((p_evidence->>'network_approval_recorded')::boolean,false) then return false; end if;
  if coalesce(p_note,'') ~* 'owner( explicitly)? approved|approved by owner|владелец.{0,40}(утверд|одобр)|утверждаю' then return false; end if;
  return true;
exception when invalid_text_representation then return false;
end $$;

alter table public.crypto_onchain_networks add constraint crypto_onchain_networks_owner_decision_fail_closed
check(approved_by_owner=false and status<>'active' and private.crypto_onchain_candidate_metadata_safe(metadata)) not valid;
alter table public.crypto_onchain_networks validate constraint crypto_onchain_networks_owner_decision_fail_closed;

alter table public.crypto_launch_requirements add constraint crypto_payment_provider_owner_decision_fail_closed
check(code<>'PAYMENT_PROVIDER' or (
  status='decision_required' and decided_at is null and verified_at is null
  and private.crypto_payment_owner_claim_absent(decision_summary,evidence,operator_note)
)) not valid;
alter table public.crypto_launch_requirements validate constraint crypto_payment_provider_owner_decision_fail_closed;

alter table public.crypto_launch_requirements add constraint crypto_payment_sandbox_owner_claim_fail_closed
check(code<>'PAYMENT_SANDBOX_E2E' or private.crypto_payment_owner_claim_absent(decision_summary,evidence,operator_note)) not valid;
alter table public.crypto_launch_requirements validate constraint crypto_payment_sandbox_owner_claim_fail_closed;

alter table public.crypto_owner_decision_records add constraint crypto_owner_decision_payment_record_fail_closed
check(decision_code !~* '^(ONCHAIN|PAYMENT)_' or active=false) not valid;
alter table public.crypto_owner_decision_records validate constraint crypto_owner_decision_payment_record_fail_closed;

alter table public.crypto_owner_decision_authority_events add constraint crypto_owner_authority_event_payment_fail_closed
check(decision_code !~* '^(ONCHAIN|PAYMENT)_' or authority_state='superseded') not valid;
alter table public.crypto_owner_decision_authority_events validate constraint crypto_owner_authority_event_payment_fail_closed;

create or replace function private.block_crypto_onchain_owner_approval()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp
as $$ begin
  if new.approved_by_owner or new.status='active' or not private.crypto_onchain_candidate_metadata_safe(new.metadata) then
    raise exception 'On-chain owner approval is fail-closed until a future manual migration follows a new explicit user decision' using errcode='42501';
  end if;
  return new;
end $$;

create or replace function private.block_crypto_payment_owner_decision_claim()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp
as $$ begin
  if new.code='PAYMENT_PROVIDER' and (
    new.status<>'decision_required' or new.decided_at is not null or new.verified_at is not null
    or not private.crypto_payment_owner_claim_absent(new.decision_summary,new.evidence,new.operator_note)
  ) then raise exception 'Payment owner decision is fail-closed until a future manual migration follows a new explicit user decision' using errcode='42501'; end if;
  if new.code='PAYMENT_SANDBOX_E2E'
     and not private.crypto_payment_owner_claim_absent(new.decision_summary,new.evidence,new.operator_note) then
    raise exception 'Payment sandbox owner claim is fail-closed' using errcode='42501';
  end if;
  return new;
end $$;

create or replace function private.block_crypto_payment_owner_decision_record()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp
as $$ begin
  if new.decision_code ~* '^(ONCHAIN|PAYMENT)_' then
    raise exception 'New or modified payment owner-decision records require a future manual migration containing exact new user text' using errcode='42501';
  end if;
  return new;
end $$;

create or replace function private.block_crypto_payment_owner_authority_event()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp
as $$ begin
  if new.decision_code ~* '^(ONCHAIN|PAYMENT)_' then
    raise exception 'New or modified payment authority events require a future explicit owner-decision migration' using errcode='42501';
  end if;
  return new;
end $$;

create or replace function private.crypto_owner_decision_record_delete_block()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp
as $$ begin raise exception 'Owner decision records are immutable audit history' using errcode='55000'; end $$;

create or replace function private.crypto_owner_authority_event_delete_block()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp
as $$ begin raise exception 'Owner authority events are immutable audit history' using errcode='55000'; end $$;

create trigger crypto_onchain_network_owner_approval_guard
before insert or update of approved_by_owner,status,metadata on public.crypto_onchain_networks
for each row execute function private.block_crypto_onchain_owner_approval();
create trigger crypto_payment_owner_decision_provenance_guard
before insert or update of status,decision_summary,evidence,operator_note,decided_at,verified_at on public.crypto_launch_requirements
for each row execute function private.block_crypto_payment_owner_decision_claim();
create trigger crypto_payment_owner_decision_record_fail_closed
before insert or update of decision_code,decision_text,decision_hash,source_channel,scope,activation_authorized,active on public.crypto_owner_decision_records
for each row execute function private.block_crypto_payment_owner_decision_record();
create trigger crypto_payment_owner_authority_event_fail_closed
before insert or update of decision_code,event_type,authority_state,decision_text_hash,evidence,effective_at on public.crypto_owner_decision_authority_events
for each row execute function private.block_crypto_payment_owner_authority_event();
create trigger crypto_owner_decision_record_immutable
before delete on public.crypto_owner_decision_records
for each row execute function private.crypto_owner_decision_record_delete_block();
create trigger crypto_owner_authority_event_immutable
before delete on public.crypto_owner_decision_authority_events
for each row execute function private.crypto_owner_authority_event_delete_block();

revoke all on function private.crypto_onchain_candidate_metadata_safe(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.crypto_payment_owner_claim_absent(jsonb,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function private.block_crypto_onchain_owner_approval() from public,anon,authenticated,service_role;
revoke all on function private.block_crypto_payment_owner_decision_claim() from public,anon,authenticated,service_role;
revoke all on function private.block_crypto_payment_owner_decision_record() from public,anon,authenticated,service_role;
revoke all on function private.block_crypto_payment_owner_authority_event() from public,anon,authenticated,service_role;
revoke all on function private.crypto_owner_decision_record_delete_block() from public,anon,authenticated,service_role;
revoke all on function private.crypto_owner_authority_event_delete_block() from public,anon,authenticated,service_role;
revoke insert,update,delete,truncate on table public.crypto_owner_decision_records from public,anon,authenticated,service_role;
revoke insert,update,delete,truncate on table public.crypto_owner_decision_authority_events from public,anon,authenticated,service_role;

drop function if exists private.enforce_crypto_onchain_owner_decision_record();
drop function if exists private.enforce_crypto_payment_owner_decision_record();
drop function if exists private.crypto_owner_decision_integrity_snapshot();
drop function if exists private.crypto_final_owner_network_state_valid(text,boolean,text,jsonb);
drop function if exists private.crypto_final_payment_decision_state_valid(text,text,jsonb,jsonb,timestamptz,timestamptz);
