drop trigger if exists crypto_onchain_network_owner_approval_guard on public.crypto_onchain_networks;
drop trigger if exists crypto_payment_owner_decision_provenance_guard on public.crypto_launch_requirements;
drop trigger if exists crypto_owner_decision_record_immutable on public.crypto_owner_decision_records;
drop trigger if exists crypto_payment_owner_decision_record_fail_closed on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_decision_record_insert_guard on public.crypto_owner_decision_records;
drop trigger if exists crypto_owner_decision_correction_supersession_immutable on public.crypto_owner_decision_correction_supersessions;

alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_networks_exact_owner_selection;
alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_canonical_three_network_approval_check;
alter table public.crypto_onchain_networks drop constraint if exists crypto_onchain_networks_owner_decision_fail_closed;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_exact_owner_network_decision;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_provider_owner_decision_check;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_provider_owner_decision_fail_closed;
alter table public.crypto_launch_requirements drop constraint if exists crypto_payment_sandbox_owner_claim_fail_closed;
alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_canonical_three_network_check;
alter table public.crypto_owner_decision_records drop constraint if exists crypto_owner_decision_payment_record_fail_closed;

drop function if exists private.block_crypto_onchain_owner_approval();
drop function if exists private.block_crypto_payment_owner_decision_claim();
drop function if exists private.block_crypto_payment_owner_decision_record();
drop function if exists private.block_crypto_owner_decision_record_insert();
drop function if exists private.crypto_onchain_candidate_metadata_safe(jsonb);
drop function if exists private.crypto_payment_owner_claim_absent(jsonb,jsonb,text);
drop function if exists private.enforce_crypto_onchain_owner_decision_record();
drop function if exists private.enforce_crypto_payment_owner_decision_record();
drop function if exists private.crypto_owner_decision_record_immutable();
drop function if exists private.crypto_owner_decision_correction_supersession_immutable();

alter table public.crypto_owner_decision_correction_supersessions
  add column if not exists effective boolean not null default true,
  add column if not exists invalidated_by_migration text,
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidation_evidence jsonb not null default '{}'::jsonb;

update public.crypto_owner_decision_correction_supersessions
set effective=false,
    invalidated_by_migration='finalize_explicit_owner_three_network_selection_after_race',
    invalidated_at=now(),
    invalidation_evidence=jsonb_build_object(
      'reason','The supersession was produced by an overlapping automation run using stale conversation context.',
      'exact_owner_text','Три сети утверждаю.',
      'exact_owner_text_sha256','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
      'owner_network_selection_confirmed',true,
      'network_activation_authorized',false,
      'recurring_automation_paused',true
    )
where effective;

alter table public.crypto_owner_decision_correction_supersessions
  drop constraint if exists crypto_owner_decision_correction_effective_check;
alter table public.crypto_owner_decision_correction_supersessions
  add constraint crypto_owner_decision_correction_effective_check
  check(effective or (invalidated_by_migration is not null and invalidated_at is not null and jsonb_typeof(invalidation_evidence)='object'));

insert into public.crypto_owner_decision_records(
  decision_code,decision_text,decision_hash,source_channel,scope,activation_authorized,active
)
values(
  'ONCHAIN_THREE_NETWORK_SELECTION',
  'Три сети утверждаю.',
  '57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
  'owner_chat',
  jsonb_build_object(
    'payment_rail','onchain_direct',
    'wallet_client','trust_wallet_walletconnect',
    'decision_scope','network_selection_only',
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_activation',false,
    'settlement_asset_selected',false,
    'pricing_selected',false,
    'receiving_addresses_configured',false,
    'original_message_timestamp_known',false,
    'concurrency_race_repaired',true
  ),
  false,
  true
)
on conflict(decision_code) do update set
  decision_text=excluded.decision_text,
  decision_hash=excluded.decision_hash,
  source_channel=excluded.source_channel,
  scope=excluded.scope,
  activation_authorized=false,
  active=true;

alter table public.crypto_owner_decision_records
  add constraint crypto_owner_decision_canonical_three_network_check
  check(
    decision_code<>'ONCHAIN_THREE_NETWORK_SELECTION'
    or (
      decision_text='Три сети утверждаю.'
      and decision_hash='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
      and source_channel='owner_chat'
      and active
      and not activation_authorized
      and scope->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')
      and coalesce((scope->>'network_activation')::boolean,false)=false
    )
  );

create table if not exists public.crypto_owner_decision_authority_events(
  id bigint generated always as identity primary key,
  decision_code text not null,
  event_type text not null,
  authority_state text not null,
  decision_text_hash text not null,
  evidence jsonb not null default '{}'::jsonb,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint crypto_owner_authority_event_code_check check(decision_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  constraint crypto_owner_authority_event_type_check check(event_type in('confirmed','revoked','corrected')),
  constraint crypto_owner_authority_state_check check(authority_state in('effective','superseded')),
  constraint crypto_owner_authority_hash_check check(decision_text_hash ~ '^[0-9a-f]{64}$'),
  constraint crypto_owner_authority_evidence_check check(jsonb_typeof(evidence)='object')
);

insert into public.crypto_owner_decision_authority_events(
  decision_code,event_type,authority_state,decision_text_hash,evidence
)
select
  'ONCHAIN_THREE_NETWORK_SELECTION','corrected','effective',
  '57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
  jsonb_build_object(
    'exact_owner_text','Три сети утверждаю.',
    'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
    'network_activation_authorized',false,
    'supersedes_migration','final_restore_candidate_only_after_false_owner_authority',
    'race_condition_confirmed',true,
    'automation_paused',true
  )
where not exists(
  select 1 from public.crypto_owner_decision_authority_events
  where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
    and event_type='corrected'
    and authority_state='effective'
    and decision_text_hash='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
);

update public.crypto_onchain_networks
set approved_by_owner=true,
    status='inactive',
    metadata=jsonb_build_object(
      'verification',metadata->'verification',
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
      'approval_source','owner_chat',
      'owner_approval_recorded',true,
      'activation_pending',true,
      'canonical_authority_migration','finalize_explicit_owner_three_network_selection_after_race'
    ),
    updated_at=now()
where network_code in('TRON','BSC','SOLANA');

alter table public.crypto_onchain_networks
  add constraint crypto_onchain_canonical_three_network_approval_check
  check(network_code not in('TRON','BSC','SOLANA') or (approved_by_owner and status='inactive'));

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
    'original_message_timestamp_known',false,
    'canonical_owner_authority',true,
    'concurrency_race_repaired',true,
    'recurring_automation_paused',true,
    'foundation_schema',true,
    'transaction_claim_lifecycle_hardened',true,
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
  'The owner explicitly approved TRON, BSC and Solana by writing “Три сети утверждаю.” A confirmed overlapping-automation race was repaired and the recurring cycle was paused. The networks remain inactive until all remaining prerequisites and explicit activation approval are complete.'
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
    'canonical_owner_authority',true,
    'transaction_claim_lifecycle_hardened',true,
    'activation',false
  ),
  'The approved three-network sandbox scope remains disabled. Execution requires settlement asset, pricing, public addresses, verifier configuration and controlled-test authorization.'
);

alter table public.crypto_launch_requirements
  add constraint crypto_payment_provider_owner_decision_check
  check(
    code<>'PAYMENT_PROVIDER'
    or (
      status='in_progress'
      and decision_summary->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION'
      and decision_summary->>'decision_hash'='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
      and coalesce((decision_summary->>'network_approval_recorded')::boolean,false)
      and decision_summary->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')
    )
  );

create or replace function private.crypto_owner_decision_record_immutable()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','pg_temp'
as $$
begin
  raise exception 'Owner decision records are immutable' using errcode='55000';
end $$;

create or replace function private.crypto_owner_authority_event_immutable()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','pg_temp'
as $$
begin
  raise exception 'Owner decision authority events are append-only' using errcode='55000';
end $$;

create or replace function private.crypto_owner_decision_correction_supersession_immutable()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','pg_temp'
as $$
begin
  raise exception 'Owner decision correction history is immutable' using errcode='55000';
end $$;

create trigger crypto_owner_decision_record_immutable
before update or delete on public.crypto_owner_decision_records
for each row execute function private.crypto_owner_decision_record_immutable();

create trigger crypto_owner_authority_event_immutable
before update or delete on public.crypto_owner_decision_authority_events
for each row execute function private.crypto_owner_authority_event_immutable();

create trigger crypto_owner_decision_correction_supersession_immutable
before update or delete on public.crypto_owner_decision_correction_supersessions
for each row execute function private.crypto_owner_decision_correction_supersession_immutable();

create or replace function private.enforce_crypto_onchain_owner_decision_record()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare
  v_hash constant text:='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';
  v_valid boolean;
begin
  select exists(
    select 1 from public.crypto_owner_decision_records r
    where r.decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
      and r.decision_text='Три сети утверждаю.'
      and r.decision_hash=v_hash
      and r.source_channel='owner_chat'
      and r.active
      and not r.activation_authorized
      and exists(
        select 1 from public.crypto_owner_decision_authority_events e
        where e.decision_code=r.decision_code
          and e.event_type='corrected'
          and e.authority_state='effective'
          and e.decision_text_hash=v_hash
      )
  ) into v_valid;
  if new.network_code in('TRON','BSC','SOLANA') then
    if not v_valid or not new.approved_by_owner or new.status<>'inactive' then
      raise exception 'Canonical owner-approved network must remain approved and inactive until explicit activation migration' using errcode='42501';
    end if;
    if new.metadata->>'decision_code'<>'ONCHAIN_THREE_NETWORK_SELECTION'
       or new.metadata->>'decision_hash'<>v_hash then
      raise exception 'Canonical owner decision metadata mismatch' using errcode='42501';
    end if;
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
  v_hash constant text:='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';
  v_valid boolean;
begin
  if new.code not in('PAYMENT_PROVIDER','PAYMENT_SANDBOX_E2E') then return new; end if;
  select exists(
    select 1 from public.crypto_owner_decision_records r
    where r.decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
      and r.decision_text='Три сети утверждаю.'
      and r.decision_hash=v_hash
      and r.source_channel='owner_chat'
      and r.active
      and not r.activation_authorized
      and exists(
        select 1 from public.crypto_owner_decision_authority_events e
        where e.decision_code=r.decision_code
          and e.event_type='corrected'
          and e.authority_state='effective'
          and e.decision_text_hash=v_hash
      )
  ) into v_valid;
  if not v_valid then raise exception 'Canonical owner decision authority is missing' using errcode='42501'; end if;
  if new.code='PAYMENT_PROVIDER' then
    if new.status<>'in_progress'
       or new.decision_summary->>'decision_code'<>'ONCHAIN_THREE_NETWORK_SELECTION'
       or new.decision_summary->>'decision_hash'<>v_hash
       or new.decision_summary->'approved_networks'<>jsonb_build_array('TRON','BSC','SOLANA')
       or not coalesce((new.decision_summary->>'network_approval_recorded')::boolean,false) then
      raise exception 'Canonical payment owner decision mismatch' using errcode='42501';
    end if;
  end if;
  return new;
end $$;

create trigger crypto_onchain_network_owner_approval_guard
before insert or update of approved_by_owner,status,metadata,network_code
on public.crypto_onchain_networks
for each row execute function private.enforce_crypto_onchain_owner_decision_record();

create trigger crypto_payment_owner_decision_provenance_guard
before insert or update of status,decision_summary,evidence,operator_note,decided_at,verified_at
on public.crypto_launch_requirements
for each row execute function private.enforce_crypto_payment_owner_decision_record();

create or replace function private.crypto_owner_decision_integrity_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path='public','private','pg_catalog','pg_temp'
as $$
declare
  v_hash constant text:='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be';
  v_checks jsonb;v_failures integer;
begin
  with checks(code,violations) as (
    select 'exact_active_immutable_decision_record',case when exists(
      select 1 from public.crypto_owner_decision_records
      where decision_code='ONCHAIN_THREE_NETWORK_SELECTION' and decision_text='Три сети утверждаю.'
        and decision_hash=v_hash and source_channel='owner_chat' and active and not activation_authorized
    ) then 0 else 1 end
    union all
    select 'effective_authority_event',case when exists(
      select 1 from public.crypto_owner_decision_authority_events
      where decision_code='ONCHAIN_THREE_NETWORK_SELECTION' and event_type='corrected'
        and authority_state='effective' and decision_text_hash=v_hash
    ) then 0 else 1 end
    union all
    select 'false_supersession_invalidated',case when not exists(
      select 1 from public.crypto_owner_decision_correction_supersessions where effective
    ) then 0 else 1 end
    union all
    select 'three_networks_approved_inactive',case when (select count(*) from public.crypto_onchain_networks
      where network_code in('TRON','BSC','SOLANA') and approved_by_owner and status='inactive'
        and metadata->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION' and metadata->>'decision_hash'=v_hash)=3 then 0 else 1 end
    union all
    select 'payment_requirement_matches_decision',case when exists(select 1 from public.crypto_launch_requirements
      where code='PAYMENT_PROVIDER' and status='in_progress'
        and decision_summary->>'decision_code'='ONCHAIN_THREE_NETWORK_SELECTION'
        and decision_summary->>'decision_hash'=v_hash
        and decision_summary->'approved_networks'=jsonb_build_array('TRON','BSC','SOLANA')) then 0 else 1 end
    union all
    select 'no_network_activation',case when (select count(*) from public.crypto_onchain_networks where status='active')=0 then 0 else 1 end
    union all
    select 'payment_adapter_disabled',case when exists(select 1 from public.crypto_billing_provider_adapters
      where provider='onchain' and desired_mode='disabled' and lifecycle_status='draft'
        and not checkout_enabled and not webhook_enabled and not recurring_enabled and not refunds_enabled) then 0 else 1 end
    union all
    select 'canonical_constraints_present',case when (
      select count(*) from pg_constraint where conname in(
        'crypto_owner_decision_canonical_three_network_check',
        'crypto_onchain_canonical_three_network_approval_check',
        'crypto_payment_provider_owner_decision_check'
      ))=3 then 0 else 1 end
  )
  select jsonb_agg(jsonb_build_object('code',code,'violations',violations,'passed',violations=0) order by code),
         sum(case when violations>0 then 1 else 0 end)
  into v_checks,v_failures from checks;
  return jsonb_build_object('state',case when v_failures=0 then 'healthy' else 'critical' end,'generated_at',now(),'total_checks',jsonb_array_length(v_checks),'failed_checks',v_failures,'checks',v_checks);
end $$;

alter table public.crypto_owner_decision_records enable row level security;
alter table public.crypto_owner_decision_authority_events enable row level security;
alter table public.crypto_owner_decision_correction_supersessions enable row level security;

revoke all on table public.crypto_owner_decision_records from public,anon,authenticated;
revoke all on table public.crypto_owner_decision_authority_events from public,anon,authenticated;
revoke all on table public.crypto_owner_decision_correction_supersessions from public,anon,authenticated;
revoke insert,update,delete,truncate on table public.crypto_owner_decision_records from service_role;
revoke insert,update,delete,truncate on table public.crypto_owner_decision_authority_events from service_role;
revoke insert,update,delete,truncate on table public.crypto_owner_decision_correction_supersessions from service_role;
grant select on table public.crypto_owner_decision_records to service_role;
grant select on table public.crypto_owner_decision_authority_events to service_role;
grant select on table public.crypto_owner_decision_correction_supersessions to service_role;

revoke all on function private.crypto_owner_decision_record_immutable() from public,anon,authenticated,service_role;
revoke all on function private.crypto_owner_authority_event_immutable() from public,anon,authenticated,service_role;
revoke all on function private.crypto_owner_decision_correction_supersession_immutable() from public,anon,authenticated,service_role;
revoke all on function private.enforce_crypto_onchain_owner_decision_record() from public,anon,authenticated,service_role;
revoke all on function private.enforce_crypto_payment_owner_decision_record() from public,anon,authenticated,service_role;
revoke all on function private.crypto_owner_decision_integrity_snapshot() from public,anon,authenticated;
grant execute on function private.crypto_owner_decision_integrity_snapshot() to service_role;

comment on table public.crypto_owner_decision_records is 'Canonical immutable owner decisions. ONCHAIN_THREE_NETWORK_SELECTION is confirmed by exact user text and hash.';
comment on table public.crypto_owner_decision_authority_events is 'Append-only authority correction events used to resolve conflicting autonomous evidence.';
comment on constraint crypto_onchain_canonical_three_network_approval_check on public.crypto_onchain_networks is 'TRON, BSC and SOLANA are owner-approved and remain inactive pending explicit activation.';
