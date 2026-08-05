update public.crypto_launch_requirements
set owner_type='user_decision',
    status='decision_required',
    decision_required=true,
    description='Выбрать: перейти на платный Supabase с managed backup/PITR либо утвердить документированную альтернативу с логическими off-site backup и проверкой восстановления.',
    operator_note='Текущая организация Supabase определена как Free; managed automatic backups и PITR недоступны до отдельного решения владельца.'
where code='BACKUP_PITR';

create or replace function private.crypto_launch_control_integrity_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare
  v_total integer;
  v_weight integer;
  v_missing_dependencies integer;
  v_self_dependencies integer;
  v_invalid_verified integer;
  v_secret_like integer;
  v_checks jsonb;
begin
  select count(*),coalesce(sum(weight),0) into v_total,v_weight from public.crypto_launch_requirements;
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
  where coalesce(decision_summary,'{}'::jsonb)::text ~* '"(secret|password|private[_-]?key|access[_-]?token|refresh[_-]?token|authorization|signature|webhook[_-]?secret|bot[_-]?token)"\s*:'
     or coalesce(evidence,'{}'::jsonb)::text ~* '"(secret|password|private[_-]?key|access[_-]?token|refresh[_-]?token|authorization|signature|webhook[_-]?secret|bot[_-]?token)"\s*:';
  v_checks:=jsonb_build_array(
    jsonb_build_object('code','requirement_count','passed',v_total=16,'actual',v_total,'expected',16),
    jsonb_build_object('code','weight_total','passed',v_weight=100,'actual',v_weight,'expected',100),
    jsonb_build_object('code','dependency_targets','passed',v_missing_dependencies=0,'violations',v_missing_dependencies),
    jsonb_build_object('code','self_dependencies','passed',v_self_dependencies=0,'violations',v_self_dependencies),
    jsonb_build_object('code','verified_evidence','passed',v_invalid_verified=0,'violations',v_invalid_verified),
    jsonb_build_object('code','secret_like_values','passed',v_secret_like=0,'violations',v_secret_like)
  );
  return jsonb_build_object(
    'generated_at',now(),
    'state',case when v_total=16 and v_weight=100 and v_missing_dependencies=0 and v_self_dependencies=0 and v_invalid_verified=0 and v_secret_like=0 then 'healthy' else 'critical' end,
    'total_checks',6,
    'checks',v_checks
  );
end $$;
revoke all on function private.crypto_launch_control_integrity_snapshot() from public,anon,authenticated;
grant execute on function private.crypto_launch_control_integrity_snapshot() to service_role;

create or replace function private.crypto_launch_preparation_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare
  v_launch jsonb:=private.crypto_full_launch_control_snapshot();
  v_integrity jsonb:=private.crypto_launch_control_integrity_snapshot();
  v_adapters jsonb;
  v_prices jsonb;
  v_packets jsonb;
  v_scenarios jsonb;
  v_checklists jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'provider',provider,'desired_mode',desired_mode,'lifecycle_status',lifecycle_status,
    'checkout_strategy',checkout_strategy,'webhook_strategy',webhook_strategy,
    'capabilities',capabilities,'required_secret_names',required_secret_names,
    'checkout_enabled',checkout_enabled,'webhook_enabled',webhook_enabled,
    'recurring_enabled',recurring_enabled,'refunds_enabled',refunds_enabled
  ) order by provider),'[]'::jsonb)
  into v_adapters
  from public.crypto_billing_provider_adapters where provider in('liqpay','stripe');

  select coalesce(jsonb_agg(jsonb_build_object(
    'plan',plan,'currency',currency,'billing_interval',billing_interval,
    'amount_minor',amount_minor,'provider',provider,'active',active
  ) order by plan,currency,billing_interval),'[]'::jsonb)
  into v_prices from public.crypto_plan_prices where plan in('BASIC','PRO');

  v_packets:=jsonb_build_array(
    jsonb_build_object(
      'code','REAL_ADMIN','status','decision_required','decision_fields',jsonb_build_array('owned_email','auth_user_id'),
      'acceptance',jsonb_build_array('Auth user exists','email belongs to owner','crypto_user_profiles.role=admin','admin read RPC succeeds'),
      'prohibited',jsonb_build_array('invented email','service account as human admin','unconfirmed external account')
    ),
    jsonb_build_object(
      'code','PRICING_MODEL','status','decision_required','decision_fields',jsonb_build_array('basic_amount_minor','pro_amount_minor','currency','billing_interval'),
      'constraints',jsonb_build_array('amounts are positive integers','currency is ISO 4217 three-letter code','interval is month or year','both prices remain inactive until provider verification'),
      'current',v_prices
    ),
    jsonb_build_object(
      'code','PAYMENT_PROVIDER','status','decision_required','decision_fields',jsonb_build_array('provider','initial_mode'),
      'allowed',jsonb_build_array('liqpay','stripe'),'initial_mode_allowed',jsonb_build_array('test'),
      'current_adapters',v_adapters,
      'activation_rule','No adapter becomes verified or active before checkout and signed webhook tests pass.'
    ),
    jsonb_build_object(
      'code','REFUND_POLICY','status','decision_required','decision_fields',jsonb_build_array(
        'refund_window_days','eligible_payment_states','partial_refunds_allowed','access_after_refund',
        'cancel_effective_when','failed_renewal_grace_days','chargeback_access_action','support_review_required'
      ),
      'system_boundary','Current payment.refunded processing marks review_required and does not automatically revoke access.'
    ),
    jsonb_build_object(
      'code','BACKUP_PITR','status','decision_required','decision_fields',jsonb_build_array('backup_strategy','target_rpo','target_rto'),
      'allowed_strategies',jsonb_build_array('paid_managed_backup_with_optional_pitr','free_plan_logical_offsite_backup_with_restore_rehearsal'),
      'current_fact','Supabase organization is Free; managed automatic backup and PITR are unavailable in current plan.',
      'release_rule','BACKUP_PITR remains unresolved until the selected strategy is implemented and restore evidence is recorded.'
    ),
    jsonb_build_object(
      'code','PUBLISH_V79','status','blocked_dependency','decision_fields',jsonb_build_array('publish_over_v78'),
      'prerequisites',jsonb_build_array('PAYMENT_SANDBOX_E2E','BACKUP_PITR','BETA_UX_FIXES'),
      'default',false
    )
  );

  v_scenarios:=jsonb_build_array(
    jsonb_build_object('id','webhook_disabled','layer','edge','input','POST without configured webhook secret','expected_http',503,'expected_code','WEBHOOK_DISABLED','writes',false),
    jsonb_build_object('id','unauthorized','layer','edge','input','wrong x-crypto-lab-billing-key','expected_http',401,'writes',false),
    jsonb_build_object('id','invalid_json','layer','edge','input','malformed JSON','expected_http',400,'writes',false),
    jsonb_build_object('id','unsupported_provider','layer','edge','input','provider outside manual/liqpay/stripe','expected_http',400,'writes',false),
    jsonb_build_object('id','unsupported_event','layer','edge','input','unknown event_type','expected_http',400,'writes',false),
    jsonb_build_object('id','invalid_identity','layer','edge','input','missing provider_event_id or invalid order UUID','expected_http',400,'writes',false),
    jsonb_build_object('id','verified_amount_required','layer','edge','event_types',jsonb_build_array('payment.succeeded','payment.refunded','subscription.renewed'),'expected_http',400,'writes',false),
    jsonb_build_object('id','payment_pending','layer','database','from',jsonb_build_array('created'),'to','pending','event_status','processed'),
    jsonb_build_object('id','payment_succeeded','layer','database','from',jsonb_build_array('created','pending','failed','expired','canceled'),'to','paid','subscription','active'),
    jsonb_build_object('id','payment_failed','layer','database','from',jsonb_build_array('created','pending'),'to','failed'),
    jsonb_build_object('id','payment_expired','layer','database','from',jsonb_build_array('created','pending'),'to','expired'),
    jsonb_build_object('id','payment_canceled','layer','database','from',jsonb_build_array('created','pending'),'to','canceled'),
    jsonb_build_object('id','duplicate_same_payload','layer','database','expected_duplicate',true,'second_mutation',false),
    jsonb_build_object('id','event_id_collision','layer','edge','same_provider_event_id',true,'different_payload',true,'expected_http',409,'expected_code','EVENT_COLLISION'),
    jsonb_build_object('id','subscription_renewed','layer','database','order_to','paid','subscription_to','active','period_required_valid',true),
    jsonb_build_object('id','cancel_at_period_end','layer','database','subscription_flag','cancel_at_period_end=true','access_immediate_revoke',false),
    jsonb_build_object('id','subscription_canceled','layer','database','subscription_to','canceled','ended_at_required',true),
    jsonb_build_object('id','payment_refunded','layer','database','order_to','refunded','review_required',true,'automatic_access_revoke',false),
    jsonb_build_object('id','invalid_transition','layer','database','event_status','ignored','processed',true,'retry',false),
    jsonb_build_object('id','amount_mismatch','layer','database','event_status','failed','retry_schedule',jsonb_build_array('1 minute','5 minutes','15 minutes','1 hour')),
    jsonb_build_object('id','currency_mismatch','layer','database','event_status','failed','retry_schedule',jsonb_build_array('1 minute','5 minutes','15 minutes','1 hour'))
  );

  v_checklists:=jsonb_build_object(
    'turnstile',jsonb_build_array(
      'Create widget restricted to hostname 1specnazov1.github.io',
      'Store CRYPTO_TURNSTILE_SITE_KEY and CRYPTO_TURNSTILE_SECRET_KEY only in Supabase Edge secrets',
      'Keep CRYPTO_PUBLIC_REGISTRATION_ENABLED=false until mail and admin prerequisites pass',
      'Verify missing token, invalid token, wrong hostname, replay/idempotency and valid token paths'
    ),
    'mail_relay',jsonb_build_array(
      'Configure CRYPTO_MAIL_RELAY_URL and CRYPTO_MAIL_RELAY_PUBLISHABLE_KEY in Edge secrets',
      'Store relay shared secret only in private get_service_secret storage',
      'Verify signup_confirmation and password_recovery templates on an owned mailbox',
      'Verify idempotency, bounce handling, sender domain alignment and no secret leakage in logs'
    ),
    'backup_restore',jsonb_build_array(
      'Record selected backup strategy and approved RPO/RTO',
      'Produce an off-site encrypted artifact or enable managed backup',
      'Restore into an isolated non-production target',
      'Validate schema, row counts, Auth/profile linkage, functions, cron definitions and RLS',
      'Destroy or retain the isolated target according to evidence policy'
    ),
    'physical_devices',jsonb_build_array(
      'iPhone Safari install PWA, login, offline shell, chart, account and logout',
      'Android Chrome install PWA, login, offline shell, chart, account and logout',
      'Record OS/browser versions and screenshots without credentials or personal data'
    )
  );

  return jsonb_build_object(
    'generated_at',now(),
    'state',case when v_integrity->>'state'='healthy' then 'prepared_waiting_decisions' else 'integrity_failure' end,
    'launch_control',v_launch,
    'integrity',v_integrity,
    'decision_packets',v_packets,
    'payment_sandbox',jsonb_build_object(
      'provider_neutral',true,'scenario_count',jsonb_array_length(v_scenarios),
      'execution_allowed',false,
      'blocked_by',jsonb_build_array('PRICING_MODEL','PAYMENT_PROVIDER','MERCHANT_CREDENTIALS','REFUND_POLICY'),
      'scenarios',v_scenarios
    ),
    'external_checklists',v_checklists,
    'stores_sensitive_values',false
  );
end $$;
revoke all on function private.crypto_launch_preparation_snapshot() from public,anon,authenticated;
grant execute on function private.crypto_launch_preparation_snapshot() to service_role;

create or replace function private.get_crypto_admin_launch_preparation()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
begin
  if not public.crypto_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return private.crypto_launch_preparation_snapshot();
end $$;
revoke all on function private.get_crypto_admin_launch_preparation() from public,anon,authenticated;
grant execute on function private.get_crypto_admin_launch_preparation() to authenticated,service_role;

create or replace function public.get_crypto_admin_launch_preparation()
returns jsonb
language sql
stable
security invoker
set search_path to 'public','private','pg_temp'
as $$ select private.get_crypto_admin_launch_preparation(); $$;
revoke all on function public.get_crypto_admin_launch_preparation() from public,anon;
grant execute on function public.get_crypto_admin_launch_preparation() to authenticated;
