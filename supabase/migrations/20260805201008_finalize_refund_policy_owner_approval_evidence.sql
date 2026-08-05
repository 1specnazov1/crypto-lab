-- CRYPTO LAB v79: align refund-policy evidence with the recorded owner approval.
-- No publication, payment activation, or refund execution is authorized.

update public.crypto_launch_requirements
set evidence=evidence || jsonb_build_object(
      'owner_approval_pending',false,
      'owner_approval_recorded',true,
      'published',false,
      'refunds_enabled',false,
      'payments_enabled',false
    ),
    updated_at=now()
where code='REFUND_POLICY';

do $$
begin
  if not exists(
    select 1 from public.crypto_launch_requirements
    where code='REFUND_POLICY'
      and status='verified'
      and not decision_required
      and coalesce((decision_summary->>'owner_approved')::boolean,false)
      and not coalesce((evidence->>'owner_approval_pending')::boolean,true)
      and not coalesce((evidence->>'published')::boolean,true)
      and not coalesce((evidence->>'refunds_enabled')::boolean,true)
      and not coalesce((evidence->>'payments_enabled')::boolean,true)
  ) then
    raise exception 'Refund policy evidence alignment failed';
  end if;

  if exists(
    select 1 from public.crypto_billing_provider_adapters
    where provider='onchain'
      and (checkout_enabled or webhook_enabled or recurring_enabled or refunds_enabled)
  ) then
    raise exception 'Payment/refund activation boundary changed unexpectedly';
  end if;
end $$;
