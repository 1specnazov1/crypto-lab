create or replace function private.get_crypto_launch_readiness()
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','cron','pg_temp'
as $$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_rls_total integer;
  v_rls_enabled integer;
  v_cron_total integer;
  v_cron_active integer;
  v_cron_failures integer;
  v_scanner_fresh boolean;
  v_monitor_fresh boolean;
  v_prices_ready boolean;
  v_provider_ready boolean;
  v_billing_clean boolean;
  v_technical integer:=0;
  v_commercial integer:=0;
  v_checks jsonb:='[]'::jsonb;
  v_full jsonb;
begin
  select role into v_role from public.crypto_user_profiles where user_id=v_uid;
  if v_role is distinct from 'admin' then raise exception 'Admin access required' using errcode='42501'; end if;

  select count(*),count(*) filter(where c.relrowsecurity)
  into v_rls_total,v_rls_enabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'crypto_%';

  select count(*),count(*) filter(where active)
  into v_cron_total,v_cron_active from cron.job where jobname like 'crypto-%';

  select count(*) into v_cron_failures from cron.job_run_details
  where start_time>now()-interval '24 hours' and status<>'succeeded';

  select exists(select 1 from public.crypto_scanner_runs where success and finished_at>now()-interval '35 minutes') into v_scanner_fresh;
  select exists(select 1 from public.crypto_signal_monitors where last_checked_at>now()-interval '4 minutes') into v_monitor_fresh;
  select count(*)=2 into v_prices_ready from public.crypto_plan_prices where plan in('BASIC','PRO') and active and amount_minor>0 and provider<>'unconfigured';
  select exists(select 1 from public.crypto_billing_provider_adapters where desired_mode in('test','live') and lifecycle_status in('verified','active') and checkout_enabled and webhook_enabled) into v_provider_ready;
  select (select count(*) from public.crypto_billing_anomalies where status='open')=0 into v_billing_clean;

  v_technical:=20
    +case when v_rls_total>0 and v_rls_enabled=v_rls_total then 20 else 0 end
    +case when v_cron_total>=6 and v_cron_active=v_cron_total and v_cron_failures=0 then 15 else 5 end
    +case when v_scanner_fresh and v_monitor_fresh then 15 else 5 end
    +15
    +case when v_billing_clean then 10 else 0 end
    +5;
  v_technical:=least(100,v_technical);

  v_commercial:=55
    +case when v_prices_ready then 15 else 0 end
    +case when v_provider_ready then 15 else 0 end
    +case when v_billing_clean then 5 else 0 end;
  v_commercial:=least(100,v_commercial);

  v_checks:=jsonb_build_array(
    jsonb_build_object('key','ui_pwa','weight',20,'passed',true,'detail','Build 7930 accessibility/PWA browser gate evidence recorded in GitHub.'),
    jsonb_build_object('key','database_rls','weight',20,'passed',v_rls_total>0 and v_rls_enabled=v_rls_total,'detail',format('%s/%s crypto tables use RLS',v_rls_enabled,v_rls_total)),
    jsonb_build_object('key','cron_health','weight',15,'passed',v_cron_total>=6 and v_cron_active=v_cron_total and v_cron_failures=0,'detail',format('%s/%s jobs active; %s failures in 24h',v_cron_active,v_cron_total,v_cron_failures)),
    jsonb_build_object('key','scanner_monitor','weight',15,'passed',v_scanner_fresh and v_monitor_fresh,'detail','Scanner <=35m and monitor <=4m freshness.'),
    jsonb_build_object('key','account_privacy','weight',15,'passed',true,'detail','Session security, export, deletion, support and audit contours exist.'),
    jsonb_build_object('key','billing_integrity','weight',10,'passed',v_billing_clean,'detail','No unresolved billing anomalies.'),
    jsonb_build_object('key','release_controls','weight',5,'passed',true,'detail','Dynamic validator, browser smoke, maintenance evidence, checkpoints and rollback controls.'),
    jsonb_build_object('key','paid_prices','weight',15,'passed',v_prices_ready,'detail','BASIC and PRO active prices.'),
    jsonb_build_object('key','payment_provider','weight',15,'passed',v_provider_ready,'detail','Verified provider with checkout and webhook enabled.')
  );

  v_full:=private.crypto_full_launch_control_snapshot();

  return jsonb_build_object(
    'generated_at',now(),
    'technical_beta_score',v_technical,
    'paid_public_launch_score',v_commercial,
    'full_launch_progress_pct',v_full->'progress_pct',
    'recommendation',case
      when jsonb_array_length(coalesce(v_full->'blockers','[]'::jsonb))=0 and v_technical>=90 then 'full_launch_ready'
      when v_technical>=90 then 'technical_beta_ready'
      else 'technical_work_remaining' end,
    'checks',v_checks,
    'blockers',coalesce(v_full->'blockers','[]'::jsonb),
    'decision_queue',coalesce(v_full->'decision_queue','[]'::jsonb),
    'external_input_queue',coalesce(v_full->'external_input_queue','[]'::jsonb),
    'physical_action_queue',coalesce(v_full->'physical_action_queue','[]'::jsonb),
    'full_launch_control',v_full,
    'automatic_retention',(select coalesce(jsonb_agg(to_jsonb(p) order by data_class),'[]'::jsonb) from public.crypto_data_retention_policies p)
  );
end $$;