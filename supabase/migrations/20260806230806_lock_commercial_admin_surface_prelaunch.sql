-- CRYPTO LAB closed-prelaunch admin hardening.
-- Browser/API admin RPCs stay disabled until an authenticated admin + 2FA launch decision exists.

do $$
declare
  r record;
  sig text;
begin
  for r in
    select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private')
      and (p.proname like 'admin\_%' escape '\' or p.proname like 'get\_crypto\_admin\_%' escape '\')
  loop
    sig := format('%I.%I(%s)', r.schema_name, r.proname, r.args);
    execute format('revoke execute on function %s from public, anon, authenticated', sig);
    execute format('grant execute on function %s to service_role', sig);
  end loop;
end $$;

insert into public.crypto_admin_audit_log(
  actor_user_id, actor_role, source, action, entity_type, entity_id, severity, summary, old_state, new_state, request_context
) values (
  null,
  'automation_service',
  'service',
  'lock_commercial_admin_surface_prelaunch',
  'admin_security',
  'closed_prelaunch',
  'high',
  'Revoked anon/authenticated execution from all public/private admin RPCs; retained service_role execution. Admin browser surface remains closed pending authenticated admin + owner-verified 2FA.',
  jsonb_build_object('auth_users',0,'mfa_factors',0),
  jsonb_build_object('anon_admin_rpc_enabled',false,'authenticated_admin_rpc_enabled',false,'service_role_admin_rpc_enabled',true),
  jsonb_build_object('owner_2fa_status','requires_platform_level_verification','commercial_activation',false)
);
