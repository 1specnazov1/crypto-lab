-- CRYPTO LAB v79 — Admin RPC authorization bridge
-- Production fix applied 2026-08-13.
--
-- Browser sessions use the Postgres `authenticated` role. The public admin
-- wrappers had EXECUTE revoked from authenticated, so PostgREST rejected the
-- call before private.crypto_is_admin() could evaluate the signed-in user.
--
-- Keep private functions service-role only. Expose only the public wrappers as
-- SECURITY DEFINER and continue enforcing the actual admin authorization in the
-- private implementations through public.crypto_is_admin(). Anonymous access
-- remains revoked.

alter function public.get_crypto_admin_summary() security definer;
alter function public.get_crypto_admin_summary()
  set search_path = public, private, pg_temp;
revoke all on function public.get_crypto_admin_summary() from public, anon;
grant execute on function public.get_crypto_admin_summary() to authenticated, service_role;

alter function public.admin_set_crypto_subscription(uuid,text,text,timestamptz,uuid,text) security definer;
alter function public.admin_set_crypto_subscription(uuid,text,text,timestamptz,uuid,text)
  set search_path = public, private, pg_temp;
revoke all on function public.admin_set_crypto_subscription(uuid,text,text,timestamptz,uuid,text) from public, anon;
grant execute on function public.admin_set_crypto_subscription(uuid,text,text,timestamptz,uuid,text) to authenticated, service_role;

comment on function public.get_crypto_admin_summary() is
  'Authenticated bridge to private admin summary. Authorization remains enforced by private.get_crypto_admin_summary via crypto_is_admin().';

comment on function public.admin_set_crypto_subscription(uuid,text,text,timestamptz,uuid,text) is
  'Authenticated bridge to private subscription admin action. Authorization remains enforced by private.admin_set_crypto_subscription via crypto_is_admin().';
