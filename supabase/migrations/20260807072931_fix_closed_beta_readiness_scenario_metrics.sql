create or replace function public.crypto_closed_beta_readiness()
returns jsonb
language sql
security definer
set search_path = public
as $function$
  select jsonb_build_object(
    'mode', c.mode,
    'target_min_users', c.target_min_users,
    'target_max_users', c.target_max_users,
    'invitations_enabled', c.invitations_enabled,
    'auth_accounts_enabled', c.auth_accounts_enabled,
    'real_payments_enabled', c.real_payments_enabled,
    'mainnet_enabled', c.mainnet_enabled,
    'owner_approval_required', c.owner_approval_required,
    'synthetic_personas', (select count(*) from public.crypto_closed_beta_test_personas where real_person=false and auth_user_id is null and invitation_sent=false),
    'prepared_scenarios', (select count(*) from public.crypto_closed_beta_scenarios),
    'passed_scenarios', (select count(*) from public.crypto_closed_beta_scenarios where status='passed'),
    'blocked_external_scenarios', (select count(*) from public.crypto_closed_beta_scenarios where status='blocked_external'),
    'failed_scenarios', (select count(*) from public.crypto_closed_beta_scenarios where status='failed'),
    'checklist_items', (select count(*) from public.crypto_closed_beta_checklist),
    'executed_checklist_items', (select count(*) from public.crypto_closed_beta_checklist where status in ('passed','failed')),
    'auth_users_total', (select count(*) from auth.users),
    'production_flags', (select jsonb_build_object(
       'paid_checkout_enabled',paid_checkout_enabled,
       'paid_entitlement_enabled',paid_entitlement_enabled,
       'public_registration_enabled',public_registration_enabled,
       'recurring_billing_enabled',recurring_billing_enabled,
       'refund_execution_enabled',refund_execution_enabled,
       'production_launch_authorized',production_launch_authorized
     ) from public.crypto_commercial_runtime_flags where singleton=true),
    'safe_to_prepare', not c.invitations_enabled and not c.auth_accounts_enabled and not c.real_payments_enabled and not c.mainnet_enabled
  )
  from public.crypto_closed_beta_config c
  where c.singleton=true;
$function$;

revoke all on function public.crypto_closed_beta_readiness() from public, anon, authenticated;
grant execute on function public.crypto_closed_beta_readiness() to service_role;
