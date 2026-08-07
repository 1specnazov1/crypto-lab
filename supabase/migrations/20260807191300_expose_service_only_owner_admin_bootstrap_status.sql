create or replace function public.service_crypto_owner_admin_bootstrap_status()
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select jsonb_build_object(
    'authorized', coalesce(c.authorized,false),
    'consumed', c.consumed_at is not null,
    'allowed_email', case when c.authorized and c.consumed_at is null then c.allowed_email else null end,
    'admin_exists', exists(select 1 from public.crypto_user_profiles where role='admin')
  )
  from private.crypto_admin_bootstrap_config c
  where c.singleton=true;
$$;

revoke all on function public.service_crypto_owner_admin_bootstrap_status() from public, anon, authenticated;
grant execute on function public.service_crypto_owner_admin_bootstrap_status() to service_role;
comment on function public.service_crypto_owner_admin_bootstrap_status() is 'Service-role-only readiness for one-time owner registration bootstrap; never exposed to anon/authenticated.';
