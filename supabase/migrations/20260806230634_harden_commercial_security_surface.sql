-- CRYPTO LAB commercial prelaunch hardening: keep all public/admin surfaces fail-closed.

alter view if exists public.crypto_x_growth_discoverability_performance
  set (security_invoker = true);
revoke all on public.crypto_x_growth_discoverability_performance from anon, authenticated;
grant select on public.crypto_x_growth_discoverability_performance to service_role;

revoke execute on function public.crypto_x_block_paused_market_content() from public, anon, authenticated;
revoke execute on function public.crypto_x_block_paused_market_queue() from public, anon, authenticated;
revoke execute on function public.crypto_x_content_confirmation_guard() from public, anon, authenticated;
revoke execute on function public.crypto_x_defer_priority_ingest() from public, anon, authenticated;
revoke execute on function public.crypto_x_event_confirmation_state(uuid) from public, anon, authenticated;
revoke execute on function public.crypto_x_event_source_confirmation_refresh() from public, anon, authenticated;
revoke execute on function public.crypto_x_queue_confirmation_guard() from public, anon, authenticated;

revoke execute on function public.crypto_account_portal_status() from public, anon, authenticated;
revoke execute on function public.get_crypto_commercial_plan_catalog() from public, anon, authenticated;
grant execute on function public.crypto_account_portal_status() to service_role;
grant execute on function public.get_crypto_commercial_plan_catalog() to service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'crypto_commercial_runtime_flags',
    'crypto_launch_integrity_baseline',
    'crypto_legal_readiness',
    'crypto_onchain_indexer_profiles',
    'crypto_onchain_rpc_method_policies',
    'crypto_plan_access_policies',
    'crypto_x_profile_assets'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_deny_api_roles', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      t || '_deny_api_roles', t
    );
  end loop;
end $$;

insert into public.crypto_admin_audit_log(
  actor_user_id, actor_role, source, action, entity_type, entity_id, severity, summary, old_state, new_state, request_context
) values (
  null,
  'automation_service',
  'service',
  'harden_prelaunch_security_surface',
  'security_baseline',
  '2026-08-07T02',
  'high',
  'Hardened SECURITY DEFINER/API exposure and made fail-closed RLS intent explicit. No registration, tariffs, mainnet payments, refunds, or v79 publication activated.',
  jsonb_build_object('auth_users',0,'mfa_factors',0,'security_advisor_error_count',1),
  jsonb_build_object('public_trigger_function_execute_revoked',true,'growth_view_security_invoker',true,'closed_prelaunch_rpc_service_only',true,'explicit_deny_policies_added',7),
  jsonb_build_object('audit_scope','commercial_security','backup_status','requires_platform_level_verification','owner_2fa_status','requires_owner_platform_verification')
);
