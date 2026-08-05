-- CRYPTO LAB v79 build 7930
-- Record the owner's approval of Refund Policy Proposal v1.
-- This migration does not publish the policy and does not enable payments or refunds.

do $$
declare
  v_text constant text := 'Политику возвратов v1 утверждаю.';
  v_hash constant text := '564665bf2203c0cd86838b669516c516c73f562bf3f362a1ee5762a79ec19e11';
begin
  if encode(extensions.digest(convert_to(v_text,'UTF8'),'sha256'),'hex') <> v_hash then
    raise exception 'Refund policy owner decision hash mismatch';
  end if;

  insert into public.crypto_owner_decision_records(
    decision_code,decision_text,decision_hash,source_channel,scope,
    activation_authorized,recorded_at,active
  ) values(
    'REFUND_POLICY_V1_APPROVAL',v_text,v_hash,'owner_chat',
    jsonb_build_object(
      'decision_scope','refund_policy_approval_only',
      'proposal_version','2026-08-05-v1',
      'proposal_sha256','2b88bb0518cce25f24847b31adae688e2a70caeeb45d593f9e128f6fcac15e05',
      'owner_approved',true,
      'publication_authorized',false,
      'payment_activation_authorized',false,
      'refund_execution_authorized',false,
      'automatic_refunds_authorized',false
    ),false,now(),true
  ) on conflict(decision_code) do nothing;

  if not exists(
    select 1 from public.crypto_owner_decision_records
    where decision_code='REFUND_POLICY_V1_APPROVAL'
      and decision_hash=v_hash
      and decision_text=v_text
      and source_channel='owner_chat'
      and active
      and not activation_authorized
  ) then
    raise exception 'Refund policy approval record was not created';
  end if;

  insert into public.crypto_owner_decision_authority_events(
    decision_code,event_type,authority_state,decision_text_hash,evidence,effective_at
  ) select
    'REFUND_POLICY_V1_APPROVAL','confirmed','effective',v_hash,
    jsonb_build_object(
      'exact_owner_text',v_text,
      'proposal_version','2026-08-05-v1',
      'proposal_sha256','2b88bb0518cce25f24847b31adae688e2a70caeeb45d593f9e128f6fcac15e05',
      'owner_approved',true,
      'publication_authorized',false,
      'payment_activation_authorized',false,
      'refund_execution_authorized',false
    ),now()
  where not exists(
    select 1 from public.crypto_owner_decision_authority_events
    where decision_code='REFUND_POLICY_V1_APPROVAL'
      and authority_state='effective'
      and decision_text_hash=v_hash
  );
end $$;

update public.crypto_launch_requirements
set status='verified',
    decision_required=false,
    decision_summary=decision_summary || jsonb_build_object(
      'decision_code','REFUND_POLICY_V1_APPROVAL',
      'decision_text_exact','Политику возвратов v1 утверждаю.',
      'decision_hash','564665bf2203c0cd86838b669516c516c73f562bf3f362a1ee5762a79ec19e11',
      'approval_state','owner_approved_unpublished',
      'owner_approved',true,
      'publication_authorized',false,
      'refund_execution_enabled',false,
      'automatic_refunds_enabled',false,
      'payment_activation_authorized',false
    ),
    evidence=evidence || jsonb_build_object(
      'owner_approval_recorded',true,
      'owner_approval_decision_code','REFUND_POLICY_V1_APPROVAL',
      'owner_approval_decision_hash','564665bf2203c0cd86838b669516c516c73f562bf3f362a1ee5762a79ec19e11',
      'approved_at',now(),
      'published',false,
      'refunds_enabled',false,
      'payments_enabled',false
    ),
    operator_note='Owner approved Refund Policy Proposal v1. The policy remains unpublished and refund execution remains disabled until separate launch and activation decisions.',
    decided_at=now(),
    verified_at=now(),
    updated_at=now()
where code='REFUND_POLICY';

update public.crypto_launch_requirements
set evidence=evidence || jsonb_build_object(
      'refund_policy_owner_approved',true,
      'refund_policy_decision_code','REFUND_POLICY_V1_APPROVAL',
      'refund_policy_decision_hash','564665bf2203c0cd86838b669516c516c73f562bf3f362a1ee5762a79ec19e11',
      'refund_policy_published',false,
      'refund_execution_enabled',false
    ),
    operator_note='Networks, assets, pricing and Refund Policy v1 are owner-approved. Payment and refund execution remain disabled until separate explicit activation decisions.',
    updated_at=now()
where code='PAYMENT_PROVIDER';

do $$
declare
  v_ready jsonb;
begin
  if not exists(
    select 1 from public.crypto_launch_requirements
    where code='REFUND_POLICY'
      and status='verified'
      and not decision_required
      and verified_at is not null
      and coalesce((decision_summary->>'owner_approved')::boolean,false)
      and not coalesce((decision_summary->>'publication_authorized')::boolean,false)
      and not coalesce((decision_summary->>'refund_execution_enabled')::boolean,false)
  ) then
    raise exception 'Refund policy approval state assertion failed';
  end if;

  if exists(
    select 1 from public.crypto_billing_provider_adapters
    where provider='onchain'
      and (checkout_enabled or webhook_enabled or recurring_enabled or refunds_enabled
           or desired_mode<>'disabled' or lifecycle_status<>'draft')
  ) then
    raise exception 'Payment or refund activation boundary changed unexpectedly';
  end if;

  if exists(select 1 from public.crypto_onchain_receiving_addresses where active)
     or exists(select 1 from public.crypto_onchain_plan_pricing where active)
     or exists(select 1 from public.crypto_onchain_network_assets where enabled)
     or exists(select 1 from public.crypto_onchain_networks where status='active') then
    raise exception 'On-chain activation boundary changed unexpectedly';
  end if;

  v_ready:=private.crypto_onchain_activation_readiness();
  if coalesce((v_ready->>'verified_configuration_requirements')::integer,-1)<>2 then
    raise exception 'Verified configuration requirement count mismatch: %',v_ready;
  end if;
  if coalesce((v_ready->>'configuration_ready')::boolean,true)
     or coalesce((v_ready->>'activation_ready')::boolean,true)
     or coalesce((v_ready->>'payment_activation_authorized')::boolean,true) then
    raise exception 'Readiness must remain fail-closed: %',v_ready;
  end if;
end $$;
