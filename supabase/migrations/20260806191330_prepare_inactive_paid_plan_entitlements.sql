-- Prepare BASIC/PRO commercial access contracts while keeping every launch gate closed.
-- No checkout, paid entitlement, registration, recurring charge, refund, or mainnet activation is enabled.

create table if not exists public.crypto_commercial_runtime_flags (
  singleton boolean primary key default true check (singleton),
  paid_checkout_enabled boolean not null default false check (not paid_checkout_enabled),
  paid_entitlement_enabled boolean not null default false check (not paid_entitlement_enabled),
  public_registration_enabled boolean not null default false check (not public_registration_enabled),
  recurring_billing_enabled boolean not null default false check (not recurring_billing_enabled),
  refund_execution_enabled boolean not null default false check (not refund_execution_enabled),
  production_launch_authorized boolean not null default false check (not production_launch_authorized),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crypto_commercial_runtime_flags enable row level security;
revoke all on public.crypto_commercial_runtime_flags from anon, authenticated;
grant select,insert,update,delete on public.crypto_commercial_runtime_flags to service_role;

insert into public.crypto_commercial_runtime_flags
(singleton,paid_checkout_enabled,paid_entitlement_enabled,public_registration_enabled,recurring_billing_enabled,refund_execution_enabled,production_launch_authorized,metadata)
values
(true,false,false,false,false,false,false,
 '{"state":"commercial_candidate_inactive","owner_activation_required":true,"real_value_execution":false,"v78_unchanged":true}'::jsonb)
on conflict (singleton) do update set
  paid_checkout_enabled=false,
  paid_entitlement_enabled=false,
  public_registration_enabled=false,
  recurring_billing_enabled=false,
  refund_execution_enabled=false,
  production_launch_authorized=false,
  metadata=excluded.metadata,
  updated_at=now();

create table if not exists public.crypto_plan_access_policies (
  plan text primary key references public.crypto_plan_limits(plan) on update cascade on delete restrict,
  billing_interval text not null check (billing_interval in ('none','month')),
  access_period interval,
  grace_period interval not null default interval '0 seconds' check (grace_period >= interval '0 seconds'),
  payment_required boolean not null,
  renewal_mode text not null check (renewal_mode in ('none','manual')),
  cancellation_effect text not null check (cancellation_effect in ('immediate','period_end')),
  entitlement_activation_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (plan='FREE' and billing_interval='none' and access_period is null and not payment_required and renewal_mode='none' and entitlement_activation_enabled)
    or
    (plan in ('BASIC','PRO') and billing_interval='month' and access_period=interval '1 month' and payment_required and renewal_mode='manual' and cancellation_effect='period_end' and not entitlement_activation_enabled)
  )
);

alter table public.crypto_plan_access_policies enable row level security;
revoke all on public.crypto_plan_access_policies from anon, authenticated;
grant select,insert,update,delete on public.crypto_plan_access_policies to service_role;

insert into public.crypto_plan_access_policies
(plan,billing_interval,access_period,grace_period,payment_required,renewal_mode,cancellation_effect,entitlement_activation_enabled,metadata)
values
('FREE','none',null,interval '0 seconds',false,'none','immediate',true,
 '{"display":"Free","commercial":false}'::jsonb),
('BASIC','month',interval '1 month',interval '0 seconds',true,'manual','period_end',false,
 '{"display":"BASIC","amount_minor":2000,"currency":"USD","activation_authorized":false}'::jsonb),
('PRO','month',interval '1 month',interval '0 seconds',true,'manual','period_end',false,
 '{"display":"PRO","amount_minor":4900,"currency":"USD","activation_authorized":false}'::jsonb)
on conflict (plan) do update set
  billing_interval=excluded.billing_interval,
  access_period=excluded.access_period,
  grace_period=excluded.grace_period,
  payment_required=excluded.payment_required,
  renewal_mode=excluded.renewal_mode,
  cancellation_effect=excluded.cancellation_effect,
  entitlement_activation_enabled=excluded.entitlement_activation_enabled,
  metadata=excluded.metadata,
  updated_at=now();

create or replace function private.crypto_evaluate_subscription_access(
  p_plan text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean default false,
  p_now timestamptz default now(),
  p_entitlement_gate_override boolean default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to public,private,pg_catalog,pg_temp
as $$
declare
  v_gate boolean;
  v_policy public.crypto_plan_access_policies%rowtype;
begin
  select * into v_policy from public.crypto_plan_access_policies where plan=p_plan;
  if not found then
    return jsonb_build_object('access_granted',false,'effective_plan','FREE','reason','unknown_plan');
  end if;

  if p_plan='FREE' then
    return jsonb_build_object(
      'access_granted',true,'effective_plan','FREE','reason','free_plan',
      'expires_at',null,'cancel_at_period_end',false
    );
  end if;

  v_gate:=p_entitlement_gate_override;
  if v_gate is null then
    select paid_entitlement_enabled into v_gate
    from public.crypto_commercial_runtime_flags where singleton=true;
    v_gate:=coalesce(v_gate,false);
  end if;

  if not v_gate or not v_policy.entitlement_activation_enabled then
    -- The optional override is only for pure contract tests; the persisted policy remains closed.
    if not coalesce(p_entitlement_gate_override,false) then
      return jsonb_build_object(
        'access_granted',false,'effective_plan','FREE','reason','launch_gate_closed',
        'requested_plan',p_plan,'expires_at',p_period_end,'cancel_at_period_end',coalesce(p_cancel_at_period_end,false)
      );
    end if;
  end if;

  if p_status not in ('active','trialing') then
    return jsonb_build_object(
      'access_granted',false,'effective_plan','FREE','reason','status_not_eligible',
      'requested_plan',p_plan,'status',p_status,'expires_at',p_period_end
    );
  end if;

  if p_period_end is null then
    return jsonb_build_object(
      'access_granted',false,'effective_plan','FREE','reason','missing_period_end','requested_plan',p_plan
    );
  end if;

  if p_period_end <= p_now then
    return jsonb_build_object(
      'access_granted',false,'effective_plan','FREE','reason','period_expired',
      'requested_plan',p_plan,'expires_at',p_period_end
    );
  end if;

  return jsonb_build_object(
    'access_granted',true,'effective_plan',p_plan,'reason','eligible_paid_period',
    'expires_at',p_period_end,'cancel_at_period_end',coalesce(p_cancel_at_period_end,false),
    'renewal_mode',v_policy.renewal_mode
  );
end;
$$;

create or replace function public.crypto_effective_plan(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to public,private,pg_catalog,pg_temp
as $$
declare
  v_sub public.crypto_subscriptions%rowtype;
  v_result jsonb;
begin
  select * into v_sub from public.crypto_subscriptions where user_id=p_user_id;
  if not found then return 'FREE'; end if;
  v_result:=private.crypto_evaluate_subscription_access(
    v_sub.plan,v_sub.status,v_sub.current_period_end,v_sub.cancel_at_period_end,now(),null
  );
  return coalesce(v_result->>'effective_plan','FREE');
end;
$$;

create or replace function private.guard_crypto_paid_subscription_activation()
returns trigger
language plpgsql
security definer
set search_path to public,private,pg_catalog,pg_temp
as $$
declare v_enabled boolean:=false;
begin
  select paid_entitlement_enabled into v_enabled
  from public.crypto_commercial_runtime_flags where singleton=true;
  v_enabled:=coalesce(v_enabled,false);

  if new.plan in ('BASIC','PRO') and new.status in ('active','trialing','past_due') and not v_enabled then
    raise exception 'Paid entitlement activation is disabled' using errcode='55000';
  end if;
  if new.scheduled_plan in ('BASIC','PRO') and not v_enabled then
    raise exception 'Paid scheduled plan activation is disabled' using errcode='55000';
  end if;
  if new.plan in ('BASIC','PRO') and new.status in ('active','trialing')
     and (new.current_period_end is null or new.current_period_end<=now()) then
    raise exception 'Paid access requires a future period end' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists crypto_paid_subscription_activation_guard on public.crypto_subscriptions;
create trigger crypto_paid_subscription_activation_guard
before insert or update of plan,status,current_period_end,scheduled_plan,scheduled_change_at
on public.crypto_subscriptions
for each row execute function private.guard_crypto_paid_subscription_activation();

create or replace function private.run_crypto_subscription_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path to public,private,pg_catalog,pg_temp
as $$
declare
  r record;
  v_expired integer:=0;
  v_scheduled integer:=0;
  v_orders integer:=0;
  v_blocked_paid integer:=0;
  v_paid_gate boolean:=false;
begin
  select paid_entitlement_enabled into v_paid_gate
  from public.crypto_commercial_runtime_flags where singleton=true;
  v_paid_gate:=coalesce(v_paid_gate,false);

  update public.crypto_billing_orders
  set status='expired',updated_at=now(),failure_code='intent_expired'
  where status='created' and expires_at is not null and expires_at<=now();
  get diagnostics v_orders=row_count;

  for r in
    select * from public.crypto_subscriptions
    where plan<>'FREE' and current_period_end is not null and current_period_end<=now()
      and status in ('active','trialing','past_due')
    for update skip locked
  loop
    update public.crypto_subscriptions
    set status='expired',cancel_at_period_end=false,ended_at=now(),updated_at=now()
    where user_id=r.user_id;
    perform private.crypto_record_subscription_event(
      r.user_id,'expired',r.plan,r.status,r.plan,'expired',
      jsonb_build_object('automatic',true,'period_end',r.current_period_end),null,now()
    );
    v_expired:=v_expired+1;
  end loop;

  for r in
    select * from public.crypto_subscriptions
    where scheduled_plan is not null and scheduled_change_at is not null and scheduled_change_at<=now()
    for update skip locked
  loop
    if r.scheduled_plan in ('BASIC','PRO') and not v_paid_gate then
      v_blocked_paid:=v_blocked_paid+1;
      continue;
    end if;
    update public.crypto_subscriptions
    set plan=r.scheduled_plan,status='active',scheduled_plan=null,scheduled_change_at=null,
        current_period_start=now(),updated_at=now()
    where user_id=r.user_id;
    perform private.crypto_record_subscription_event(
      r.user_id,'scheduled_change_applied',r.plan,r.status,r.scheduled_plan,'active',
      jsonb_build_object('automatic',true),null,now()
    );
    v_scheduled:=v_scheduled+1;
  end loop;

  return jsonb_build_object(
    'expired_subscriptions',v_expired,
    'scheduled_applied',v_scheduled,
    'scheduled_paid_blocked',v_blocked_paid,
    'expired_orders',v_orders,
    'paid_entitlement_enabled',v_paid_gate,
    'completed_at',now()
  );
end;
$$;

create or replace function public.get_crypto_commercial_plan_catalog()
returns jsonb
language sql
stable
security definer
set search_path to public,private,pg_catalog,pg_temp
as $$
  select jsonb_build_object(
    'commercial_state','inactive',
    'checkout_enabled',false,
    'paid_entitlement_enabled',false,
    'plans',coalesce(jsonb_agg(jsonb_build_object(
      'plan',l.plan,
      'display_order',l.display_order,
      'currency',p.currency,
      'amount_minor',p.amount_minor,
      'billing_interval',p.billing_interval,
      'price_active',p.active,
      'checkout_ready',false,
      'access_period',a.access_period::text,
      'renewal_mode',a.renewal_mode,
      'entitlement_activation_enabled',a.entitlement_activation_enabled,
      'limits',jsonb_build_object(
        'daily_ai_requests',l.daily_ai_requests,
        'daily_backtests',l.daily_backtests,
        'daily_scanner_views',l.daily_scanner_views,
        'max_portfolio_assets',l.max_portfolio_assets,
        'max_favorites',l.max_favorites,
        'features',l.features
      )
    ) order by l.display_order),'[]'::jsonb)
  )
  from public.crypto_plan_limits l
  left join public.crypto_plan_prices p
    on p.plan=l.plan and p.currency='USD' and p.billing_interval='month'
  join public.crypto_plan_access_policies a on a.plan=l.plan;
$$;

grant execute on function public.get_crypto_commercial_plan_catalog() to anon,authenticated,service_role;

create table if not exists public.crypto_launch_integrity_baseline (
  singleton boolean primary key default true check (singleton),
  expected_requirement_count integer not null check (expected_requirement_count>0),
  expected_weight_total integer not null check (expected_weight_total>0),
  baseline_reason text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  updated_at timestamptz not null default now()
);

alter table public.crypto_launch_integrity_baseline enable row level security;
revoke all on public.crypto_launch_integrity_baseline from anon,authenticated;
grant select,insert,update,delete on public.crypto_launch_integrity_baseline to service_role;

insert into public.crypto_launch_integrity_baseline
(singleton,expected_requirement_count,expected_weight_total,baseline_reason,metadata)
values
(true,17,120,'Includes ONCHAIN_ASSET_ROUTING as a separately weighted commercial control.',
 '{"previous_count":16,"previous_weight":100,"baseline_version":2}'::jsonb)
on conflict (singleton) do update set
  expected_requirement_count=excluded.expected_requirement_count,
  expected_weight_total=excluded.expected_weight_total,
  baseline_reason=excluded.baseline_reason,
  metadata=excluded.metadata,
  updated_at=now();

create or replace function private.crypto_launch_control_integrity_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to public,private,pg_catalog,pg_temp
as $$
declare
  v_total integer;
  v_weight integer;
  v_expected_total integer;
  v_expected_weight integer;
  v_missing_dependencies integer;
  v_self_dependencies integer;
  v_invalid_verified integer;
  v_secret_like integer;
  v_checks jsonb;
begin
  select count(*),coalesce(sum(weight),0) into v_total,v_weight from public.crypto_launch_requirements;
  select expected_requirement_count,expected_weight_total into v_expected_total,v_expected_weight
  from public.crypto_launch_integrity_baseline where singleton=true;
  if not found then raise exception 'Launch integrity baseline missing'; end if;

  select count(*) into v_missing_dependencies
  from public.crypto_launch_requirements r
  cross join lateral unnest(r.dependencies) d
  where not exists(select 1 from public.crypto_launch_requirements x where x.code=d);

  select count(*) into v_self_dependencies
  from public.crypto_launch_requirements r where r.code=any(r.dependencies);

  select count(*) into v_invalid_verified
  from public.crypto_launch_requirements
  where status='verified' and (verified_at is null or evidence='{}'::jsonb);

  select count(*) into v_secret_like
  from public.crypto_launch_requirements
  where coalesce(decision_summary,'{}'::jsonb)::text ~* '\"(secret|password|private[_-]?key|access[_-]?token|refresh[_-]?token|authorization|signature|webhook[_-]?secret|bot[_-]?token)\"\s*:'
     or coalesce(evidence,'{}'::jsonb)::text ~* '\"(secret|password|private[_-]?key|access[_-]?token|refresh[_-]?token|authorization|signature|webhook[_-]?secret|bot[_-]?token)\"\s*:';

  v_checks:=jsonb_build_array(
    jsonb_build_object('code','requirement_count','passed',v_total=v_expected_total,'actual',v_total,'expected',v_expected_total),
    jsonb_build_object('code','weight_total','passed',v_weight=v_expected_weight,'actual',v_weight,'expected',v_expected_weight),
    jsonb_build_object('code','dependency_targets','passed',v_missing_dependencies=0,'violations',v_missing_dependencies),
    jsonb_build_object('code','self_dependencies','passed',v_self_dependencies=0,'violations',v_self_dependencies),
    jsonb_build_object('code','verified_evidence','passed',v_invalid_verified=0,'violations',v_invalid_verified),
    jsonb_build_object('code','secret_like_values','passed',v_secret_like=0,'violations',v_secret_like)
  );

  return jsonb_build_object(
    'generated_at',now(),
    'state',case when v_total=v_expected_total and v_weight=v_expected_weight and v_missing_dependencies=0 and v_self_dependencies=0 and v_invalid_verified=0 and v_secret_like=0 then 'healthy' else 'critical' end,
    'total_checks',6,
    'checks',v_checks
  );
end;
$$;

update public.crypto_launch_requirements
set evidence=evidence || jsonb_build_object(
      'basic_display','$20/month',
      'pro_display','$49/month',
      'access_contract_ready',true,
      'access_period','1 month',
      'renewal_mode','manual',
      'cancellation_effect','period_end',
      'expiration_logic_verified',true,
      'paid_entitlement_enabled',false,
      'checkout_enabled',false,
      'runtime_gate_table','crypto_commercial_runtime_flags',
      'access_policy_table','crypto_plan_access_policies'
    ),
    operator_note='BASIC $20/month and PRO $49/month are integrated as inactive commercial contracts. Paid checkout and entitlement issuance remain hard-disabled until a separate owner activation migration.',
    updated_at=now()
where code='PRICING_MODEL';

-- Pure contract tests: no Auth user, subscription, invoice, payment, or entitlement row is created.
do $$
declare
  v_actual jsonb;
  v_simulated jsonb;
  v_expired jsonb;
  v_catalog jsonb;
begin
  select private.crypto_evaluate_subscription_access('BASIC','active',now()+interval '1 month',false,now(),null) into v_actual;
  if v_actual->>'reason' <> 'launch_gate_closed' or v_actual->>'effective_plan' <> 'FREE' then
    raise exception 'Actual paid entitlement gate failed: %',v_actual;
  end if;

  select private.crypto_evaluate_subscription_access('BASIC','active',now()+interval '1 month',false,now(),true) into v_simulated;
  if not coalesce((v_simulated->>'access_granted')::boolean,false) or v_simulated->>'effective_plan' <> 'BASIC' then
    raise exception 'Future eligible access contract failed: %',v_simulated;
  end if;

  select private.crypto_evaluate_subscription_access('PRO','active',now()-interval '1 second',false,now(),true) into v_expired;
  if v_expired->>'reason' <> 'period_expired' or v_expired->>'effective_plan' <> 'FREE' then
    raise exception 'Expiration contract failed: %',v_expired;
  end if;

  select public.get_crypto_commercial_plan_catalog() into v_catalog;
  if v_catalog->>'commercial_state' <> 'inactive'
     or coalesce((v_catalog->>'checkout_enabled')::boolean,true)
     or coalesce((v_catalog->>'paid_entitlement_enabled')::boolean,true) then
    raise exception 'Commercial catalog boundary failed: %',v_catalog;
  end if;

  if exists(select 1 from public.crypto_commercial_runtime_flags where paid_checkout_enabled or paid_entitlement_enabled or public_registration_enabled or recurring_billing_enabled or refund_execution_enabled or production_launch_authorized) then
    raise exception 'Commercial runtime gate opened unexpectedly';
  end if;
  if exists(select 1 from public.crypto_plan_prices where plan in ('BASIC','PRO') and active) then
    raise exception 'Paid plan price activated unexpectedly';
  end if;
  if exists(select 1 from public.crypto_onchain_plan_pricing where active) then
    raise exception 'Onchain pricing activated unexpectedly';
  end if;
  if exists(select 1 from public.crypto_subscriptions where plan in ('BASIC','PRO')) then
    raise exception 'Paid subscription created unexpectedly';
  end if;
  if exists(select 1 from public.crypto_onchain_invoices) or exists(select 1 from public.crypto_billing_orders) then
    raise exception 'Billing state mutated unexpectedly';
  end if;
  if (private.crypto_launch_control_integrity_snapshot()->>'state') <> 'healthy' then
    raise exception 'Launch integrity remains unhealthy: %',private.crypto_launch_control_integrity_snapshot();
  end if;
end;
$$;