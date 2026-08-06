create table if not exists public.crypto_account_portal_config (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'closed_prelaunch' check (mode in ('closed_prelaunch','controlled_beta','production')),
  registration_enabled boolean not null default false,
  login_enabled boolean not null default false,
  recovery_enabled boolean not null default false,
  portal_enabled boolean not null default false,
  owner_approval_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.crypto_account_portal_config (
  singleton, mode, registration_enabled, login_enabled, recovery_enabled, portal_enabled,
  owner_approval_required, metadata
)
values (
  true, 'closed_prelaunch', false, false, false, false, true,
  jsonb_build_object(
    'commercial_candidate', 'v79',
    'stable_public_version', 'v78',
    'activation_authorized', false,
    'real_users_invited', false,
    'prepared_at', now()
  )
)
on conflict (singleton) do update set
  mode = 'closed_prelaunch',
  registration_enabled = false,
  login_enabled = false,
  recovery_enabled = false,
  portal_enabled = false,
  owner_approval_required = true,
  metadata = coalesce(public.crypto_account_portal_config.metadata, '{}'::jsonb) || jsonb_build_object(
    'commercial_candidate', 'v79',
    'stable_public_version', 'v78',
    'activation_authorized', false,
    'real_users_invited', false,
    'prepared_at', now()
  ),
  updated_at = now();

alter table public.crypto_account_portal_config enable row level security;
revoke all on table public.crypto_account_portal_config from anon, authenticated;
grant select, insert, update, delete on table public.crypto_account_portal_config to service_role;

drop policy if exists crypto_account_portal_deny_anon on public.crypto_account_portal_config;
create policy crypto_account_portal_deny_anon
on public.crypto_account_portal_config
for all to anon
using (false)
with check (false);

drop policy if exists crypto_account_portal_deny_authenticated on public.crypto_account_portal_config;
create policy crypto_account_portal_deny_authenticated
on public.crypto_account_portal_config
for all to authenticated
using (false)
with check (false);

create or replace function private.guard_crypto_account_portal_activation()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  runtime public.crypto_commercial_runtime_flags%rowtype;
  decision_hash text;
begin
  if new.registration_enabled or new.login_enabled or new.recovery_enabled or new.portal_enabled then
    select * into runtime
    from public.crypto_commercial_runtime_flags
    where singleton = true;

    decision_hash := nullif(btrim(coalesce(new.metadata->>'owner_activation_decision_hash','')), '');

    if runtime.singleton is distinct from true
       or runtime.production_launch_authorized is distinct from true
       or decision_hash is null then
      raise exception 'ACCOUNT_PORTAL_ACTIVATION_NOT_AUTHORIZED';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_crypto_account_portal_activation() from public, anon, authenticated;
grant execute on function private.guard_crypto_account_portal_activation() to service_role;

drop trigger if exists crypto_account_portal_activation_guard on public.crypto_account_portal_config;
create trigger crypto_account_portal_activation_guard
before insert or update on public.crypto_account_portal_config
for each row execute function private.guard_crypto_account_portal_activation();

create or replace function public.crypto_account_portal_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'mode', mode,
    'registration_enabled', registration_enabled,
    'login_enabled', login_enabled,
    'recovery_enabled', recovery_enabled,
    'portal_enabled', portal_enabled,
    'owner_approval_required', owner_approval_required
  )
  from public.crypto_account_portal_config
  where singleton = true
$$;

revoke all on function public.crypto_account_portal_status() from public;
grant execute on function public.crypto_account_portal_status() to anon, authenticated, service_role;

create or replace function public.crypto_my_account_snapshot()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select jsonb_build_object(
    'user_id', uid,
    'profile', coalesce((
      select to_jsonb(p) - 'role'
      from public.crypto_user_profiles p
      where p.user_id = uid
    ), '{}'::jsonb),
    'subscription', coalesce((
      select to_jsonb(s) - 'provider_customer_id' - 'provider_subscription_id' - 'metadata'
      from public.crypto_subscriptions s
      where s.user_id = uid
    ), jsonb_build_object(
      'user_id', uid,
      'plan', 'FREE',
      'status', 'inactive',
      'cancel_at_period_end', false
    )),
    'pending_plan_requests', (
      select count(*)
      from public.crypto_plan_requests r
      where r.user_id = uid and r.status = 'pending'
    ),
    'account_deletion_pending', exists (
      select 1
      from public.crypto_account_deletion_requests d
      where d.user_id = uid and d.status = 'pending'
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.crypto_my_account_snapshot() from public, anon;
grant execute on function public.crypto_my_account_snapshot() to authenticated, service_role;

insert into public.crypto_launch_requirements (
  code, phase, title, description, owner_type, status, weight,
  dependencies, decision_required, sensitive_input_required,
  physical_action_required, decision_summary, evidence, operator_note,
  verified_at, created_at, updated_at
)
values (
  'ACCOUNT_PORTAL', 'identity', 'Закрытый личный кабинет',
  'Регистрация, вход, recovery и базовый кабинет подготовлены в закрытом неактивном режиме.',
  'autonomous', 'ready', 6,
  array['TURNSTILE_CONFIG','MAIL_RELAY','AUTH_E2E','REAL_ADMIN']::text[],
  true, false, false, '{}'::jsonb,
  jsonb_build_object(
    'mode', 'closed_prelaunch',
    'registration_enabled', false,
    'login_enabled', false,
    'recovery_enabled', false,
    'portal_enabled', false,
    'account_snapshot_rpc', 'crypto_my_account_snapshot',
    'public_status_rpc', 'crypto_account_portal_status',
    'activation_guard', 'ACCOUNT_PORTAL_ACTIVATION_NOT_AUTHORIZED',
    'stable_public_version', 'v78',
    'commercial_candidate', 'v79'
  ),
  'Активация запрещена до отдельного решения владельца и production_launch_authorized=true.',
  now(), now(), now()
)
on conflict (code) do update set
  status = 'ready',
  dependencies = excluded.dependencies,
  decision_required = true,
  evidence = coalesce(public.crypto_launch_requirements.evidence, '{}'::jsonb) || excluded.evidence,
  operator_note = excluded.operator_note,
  verified_at = now(),
  updated_at = now();

update public.crypto_launch_requirements
set evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object(
      'account_portal_contract_ready', true,
      'account_portal_active', false,
      'account_snapshot_rpc_ready', true,
      'current_auth_users', (select count(*) from auth.users),
      'current_profiles', (select count(*) from public.crypto_user_profiles),
      'current_subscriptions', (select count(*) from public.crypto_subscriptions),
      'checked_at', now()
    ),
    updated_at = now()
where code = 'AUTH_E2E';

do $$
declare
  portal public.crypto_account_portal_config%rowtype;
  runtime public.crypto_commercial_runtime_flags%rowtype;
begin
  select * into portal from public.crypto_account_portal_config where singleton = true;
  select * into runtime from public.crypto_commercial_runtime_flags where singleton = true;

  if portal.registration_enabled or portal.login_enabled or portal.recovery_enabled or portal.portal_enabled then
    raise exception 'ACCOUNT_PORTAL_MUST_REMAIN_CLOSED';
  end if;

  if runtime.public_registration_enabled or runtime.production_launch_authorized then
    raise exception 'COMMERCIAL_RUNTIME_MUST_REMAIN_INACTIVE';
  end if;
end;
$$;
