-- CRYPTO LAB commercial account contract: read-only account/billing/support snapshot.
-- Keeps paid checkout, entitlements, recurring billing, refunds, registration and production launch disabled.

revoke execute on function public.get_my_crypto_subscription_lifecycle() from public, anon;
grant execute on function public.get_my_crypto_subscription_lifecycle() to authenticated, service_role;

revoke execute on function public.request_crypto_subscription_cancellation() from public, anon;
grant execute on function public.request_crypto_subscription_cancellation() to authenticated, service_role;

revoke execute on function public.resume_crypto_subscription() from public, anon;
grant execute on function public.resume_crypto_subscription() to authenticated, service_role;

revoke execute on function private.get_my_crypto_account() from public, anon;
grant execute on function private.get_my_crypto_account() to authenticated, service_role;

revoke execute on function private.get_my_crypto_subscription_lifecycle() from public, anon;
grant execute on function private.get_my_crypto_subscription_lifecycle() to authenticated, service_role;

revoke execute on function private.request_crypto_subscription_cancellation() from public, anon;
grant execute on function private.request_crypto_subscription_cancellation() to authenticated, service_role;

revoke execute on function private.resume_crypto_subscription() from public, anon;
grant execute on function private.resume_crypto_subscription() to authenticated, service_role;

create or replace function private.crypto_my_commercial_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_sub public.crypto_subscriptions%rowtype;
  v_effective_plan text;
  v_policy public.crypto_plan_access_policies%rowtype;
  v_runtime public.crypto_commercial_runtime_flags%rowtype;
  v_portal public.crypto_account_portal_config%rowtype;
  v_support_open integer := 0;
  v_support_total integer := 0;
begin
  if v_user is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  select * into v_sub
  from public.crypto_subscriptions
  where user_id = v_user;

  if not found then
    v_sub.user_id := v_user;
    v_sub.plan := 'FREE';
    v_sub.status := 'active';
    v_sub.provider := 'internal';
    v_sub.cancel_at_period_end := false;
  end if;

  v_effective_plan := public.crypto_effective_plan(v_user);

  select * into v_policy
  from public.crypto_plan_access_policies
  where plan = v_effective_plan;

  select * into v_runtime
  from public.crypto_commercial_runtime_flags
  where singleton = true;

  select * into v_portal
  from public.crypto_account_portal_config
  where singleton = true;

  select count(*), count(*) filter (where status in ('open','in_progress'))
    into v_support_total, v_support_open
  from public.crypto_support_tickets
  where user_id = v_user;

  return jsonb_build_object(
    'effective_plan', v_effective_plan,
    'subscription', jsonb_build_object(
      'plan', coalesce(v_sub.plan, 'FREE'),
      'status', coalesce(v_sub.status, 'active'),
      'current_period_start', v_sub.current_period_start,
      'current_period_end', v_sub.current_period_end,
      'cancel_at_period_end', coalesce(v_sub.cancel_at_period_end, false),
      'cancellation_requested_at', v_sub.cancellation_requested_at,
      'scheduled_plan', v_sub.scheduled_plan,
      'scheduled_change_at', v_sub.scheduled_change_at,
      'ended_at', v_sub.ended_at,
      'renewal_mode', coalesce(v_policy.renewal_mode, 'none'),
      'cancellation_effect', coalesce(v_policy.cancellation_effect, 'immediate')
    ),
    'price', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'currency', p.currency,
        'billing_interval', p.billing_interval,
        'amount_minor', p.amount_minor,
        'provider', p.provider,
        'active', p.active
      ) order by p.currency, p.billing_interval), '[]'::jsonb)
      from public.crypto_plan_prices p
      where p.plan = v_effective_plan
    ),
    'payment_history', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'order_id', o.id,
        'plan', o.plan,
        'currency', o.currency,
        'amount_minor', o.amount_minor,
        'billing_interval', o.billing_interval,
        'provider', o.provider,
        'status', o.status,
        'created_at', o.created_at,
        'expires_at', o.expires_at,
        'completed_at', o.completed_at,
        'failure_code', o.failure_code,
        'invoice', case when i.id is null then null else jsonb_build_object(
          'invoice_id', i.id,
          'network_code', i.network_code,
          'asset_code', i.asset_code,
          'status', i.status,
          'expires_at', i.expires_at,
          'finality_status', i.finality_status,
          'observed_at', i.observed_at,
          'verified_at', i.verified_at,
          'tx_hash', i.tx_hash
        ) end
      ) order by o.created_at desc), '[]'::jsonb)
      from (
        select * from public.crypto_billing_orders
        where user_id = v_user
        order by created_at desc
        limit 30
      ) o
      left join public.crypto_onchain_invoices i on i.billing_order_id = o.id
    ),
    'subscription_events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event_type', e.event_type,
        'from_plan', e.from_plan,
        'from_status', e.from_status,
        'to_plan', e.to_plan,
        'to_status', e.to_status,
        'effective_at', e.effective_at,
        'created_at', e.created_at
      ) order by e.created_at desc), '[]'::jsonb)
      from (
        select * from public.crypto_subscription_events
        where user_id = v_user
        order by created_at desc
        limit 30
      ) e
    ),
    'support', jsonb_build_object(
      'total_tickets', v_support_total,
      'open_tickets', v_support_open,
      'recent_tickets', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', t.id,
          'category', t.category,
          'subject', t.subject,
          'status', t.status,
          'priority', t.priority,
          'created_at', t.created_at,
          'updated_at', t.updated_at,
          'last_message_at', t.last_message_at,
          'message_count', (select count(*) from public.crypto_support_messages m where m.ticket_id = t.id)
        ) order by t.last_message_at desc), '[]'::jsonb)
        from (
          select * from public.crypto_support_tickets
          where user_id = v_user
          order by last_message_at desc
          limit 10
        ) t
      )
    ),
    'actions', jsonb_build_object(
      'can_request_cancellation',
        coalesce(v_sub.plan, 'FREE') in ('BASIC','PRO')
        and coalesce(v_sub.status, '') in ('active','trialing','past_due')
        and not coalesce(v_sub.cancel_at_period_end, false),
      'can_resume_cancellation',
        coalesce(v_sub.cancel_at_period_end, false)
        and (v_sub.current_period_end is null or v_sub.current_period_end > now()),
      'can_open_support', true,
      'checkout_enabled', coalesce(v_runtime.paid_checkout_enabled, false),
      'recurring_billing_enabled', coalesce(v_runtime.recurring_billing_enabled, false),
      'refund_execution_enabled', coalesce(v_runtime.refund_execution_enabled, false),
      'portal_enabled', coalesce(v_portal.portal_enabled, false)
    )
  );
end;
$$;

revoke all on function private.crypto_my_commercial_account() from public, anon;
grant execute on function private.crypto_my_commercial_account() to authenticated, service_role;

create or replace function public.crypto_my_commercial_account()
returns jsonb
language sql
stable
security invoker
set search_path = public, private, auth, pg_temp
as $$
  select private.crypto_my_commercial_account()
$$;

revoke all on function public.crypto_my_commercial_account() from public, anon;
grant execute on function public.crypto_my_commercial_account() to authenticated, service_role;

update public.crypto_launch_requirements
set evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object(
      'commercial_account_rpc', 'crypto_my_commercial_account',
      'subscription_lifecycle_rpc', 'get_my_crypto_subscription_lifecycle',
      'cancellation_rpc', 'request_crypto_subscription_cancellation',
      'resume_cancellation_rpc', 'resume_crypto_subscription',
      'support_list_rpc', 'get_my_crypto_support_tickets',
      'support_create_rpc', 'create_crypto_support_ticket',
      'support_reply_rpc', 'reply_crypto_support_ticket',
      'payment_history_limit', 30,
      'support_ticket_limit', 10,
      'paid_checkout_active', false,
      'recurring_billing_active', false,
      'refund_execution_active', false,
      'verified_at', now()
    ),
    operator_note = 'Account plan/period, payment history, period-end cancellation and support contract prepared. Commercial activation remains owner-gated.',
    updated_at = now()
where code = 'ACCOUNT_PORTAL';

update public.crypto_account_portal_config
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'commercial_account_rpc_ready', true,
      'payment_history_ready', true,
      'period_end_cancellation_ready', true,
      'support_ready', true,
      'commercial_actions_active', false,
      'verified_at', now()
    ),
    updated_at = now()
where singleton = true;

do $$
declare
  r public.crypto_commercial_runtime_flags%rowtype;
  p public.crypto_account_portal_config%rowtype;
begin
  select * into r from public.crypto_commercial_runtime_flags where singleton = true;
  select * into p from public.crypto_account_portal_config where singleton = true;

  if r.paid_checkout_enabled or r.paid_entitlement_enabled or r.public_registration_enabled
     or r.recurring_billing_enabled or r.refund_execution_enabled or r.production_launch_authorized then
    raise exception 'COMMERCIAL_RUNTIME_MUST_REMAIN_INACTIVE';
  end if;

  if p.registration_enabled or p.login_enabled or p.recovery_enabled or p.portal_enabled then
    raise exception 'ACCOUNT_PORTAL_MUST_REMAIN_CLOSED';
  end if;

  if exists(select 1 from public.crypto_plan_prices where plan in ('BASIC','PRO') and active) then
    raise exception 'PAID_PRICES_MUST_REMAIN_INACTIVE';
  end if;
end;
$$;