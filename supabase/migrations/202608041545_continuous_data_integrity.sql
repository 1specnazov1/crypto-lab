create or replace function private.crypto_data_integrity_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, private, auth, cron, pg_catalog, pg_temp
as $$
with metrics as (
  select
    (select count(*) from public.crypto_signal_monitors where entry_low > entry_high) as signal_entry_inverted,
    (select count(*) from public.crypto_signal_monitors where direction='LONG' and (
      stop >= entry_low or
      (tp1 is not null and tp1 <= entry_high) or
      (tp2 is not null and tp1 is not null and tp2 <= tp1) or
      (tp3 is not null and tp2 is not null and tp3 <= tp2)
    )) as signal_long_geometry,
    (select count(*) from public.crypto_signal_monitors where direction='SHORT' and (
      stop <= entry_high or
      (tp1 is not null and tp1 >= entry_low) or
      (tp2 is not null and tp1 is not null and tp2 >= tp1) or
      (tp3 is not null and tp2 is not null and tp3 >= tp2)
    )) as signal_short_geometry,
    (select count(*) from public.crypto_signal_monitors where symbol !~ '^[A-Z0-9]{2,20}$') as signal_invalid_symbol,
    (select count(*) from public.crypto_signal_monitors where status='ACTIVE' and activated_at is null) as signal_active_without_activation,
    (select count(*) from public.crypto_signal_monitors where status='CLOSED' and (closed_at is null or close_type is null)) as signal_closed_incomplete,
    (select count(*) from public.crypto_signal_monitors where status<>'CLOSED' and closed_at is not null) as signal_nonclosed_with_close_time,
    (select count(*) from public.crypto_signal_monitors where status='WAITING' and entry_notified) as signal_waiting_entry_notified,

    (select coalesce(sum(x.cnt-1),0) from (
      select count(*)::bigint cnt from public.crypto_signal_notification_outbox group by signal_id,event_type having count(*)>1
    ) x) as outbox_duplicate_pairs,
    (select count(*) from public.crypto_signal_notification_outbox where status='sent' and sent_at is null) as outbox_sent_without_time,
    (select count(*) from public.crypto_signal_notification_outbox where status<>'sent' and sent_at is not null) as outbox_unsent_with_time,
    (select count(*) from public.crypto_signal_notification_outbox where status='processing' and claimed_at<now()-interval '10 minutes') as outbox_stale_claims,
    (select count(*) from public.crypto_signal_notification_outbox where attempts>5) as outbox_excess_attempts,
    (select count(*) from public.crypto_signal_notification_outbox o left join public.crypto_signal_monitors s on s.id=o.signal_id where s.id is null) as outbox_orphans,
    (select count(*) from public.crypto_signal_notification_outbox o
      join public.crypto_signal_monitors s on s.id=o.signal_id
      where o.status='sent' and s.created_at>=timestamptz '2026-08-04 09:00:00+00'
        and not case upper(o.event_type)
          when 'ENTRY' then s.entry_notified
          when 'TP1' then s.tp1_notified
          when 'TP2' then s.tp2_notified
          when 'TP3' then s.tp3_notified
          when 'STOP' then s.stop_notified
          else true end
    ) as outbox_sent_flag_mismatch,
    (select count(*) from (
      select s.id,'ENTRY'::text event_type from public.crypto_signal_monitors s where s.created_at>=timestamptz '2026-08-04 09:00:00+00' and s.entry_notified
      union all select s.id,'TP1' from public.crypto_signal_monitors s where s.created_at>=timestamptz '2026-08-04 09:00:00+00' and s.tp1_notified
      union all select s.id,'TP2' from public.crypto_signal_monitors s where s.created_at>=timestamptz '2026-08-04 09:00:00+00' and s.tp2_notified
      union all select s.id,'TP3' from public.crypto_signal_monitors s where s.created_at>=timestamptz '2026-08-04 09:00:00+00' and s.tp3_notified
      union all select s.id,'STOP' from public.crypto_signal_monitors s where s.created_at>=timestamptz '2026-08-04 09:00:00+00' and s.stop_notified
    ) f where not exists (
      select 1 from public.crypto_signal_notification_outbox o
      where o.signal_id=f.id and upper(o.event_type)=f.event_type and o.status='sent'
    )) as postcutover_flag_without_sent,

    (select count(*) from public.crypto_ai_runs where status='started' and created_at<now()-interval '15 minutes') as ai_stale_started,
    (select count(*) from public.crypto_ai_runs where status in('completed','failed') and completed_at is null) as ai_terminal_without_time,
    (select count(*) from public.crypto_backtest_runs where status='started' and created_at<now()-interval '30 minutes') as backtest_stale_started,
    (select count(*) from public.crypto_backtest_runs where status in('completed','failed') and completed_at is null) as backtest_terminal_without_time,

    (select count(*) from public.crypto_operational_http_requests q
      left join public.crypto_operational_observations o
        on o.source_type='edge' and o.source_name=q.source_name and o.observation_id=q.request_id::text
      where q.processed_at is not null and o.id is null
    ) as operational_missing_observation,
    (select count(*) from public.crypto_operational_http_requests q
      join public.crypto_operational_observations o
        on o.source_type='edge' and o.source_name=q.source_name and o.observation_id=q.request_id::text
      where q.processed_at is not null and (
        o.success is distinct from q.success or
        o.status_code is distinct from q.status_code or
        o.duration_ms is distinct from q.duration_ms
      )
    ) as operational_observation_mismatch,
    (select count(*) from public.crypto_operational_incidents where status='open' and resolved_at is not null) as incident_open_resolved,
    (select count(*) from public.crypto_operational_incidents where status='resolved' and resolved_at is null) as incident_resolved_without_time,
    (select count(*) from public.crypto_operational_incidents where first_seen_at>last_seen_at or (resolved_at is not null and resolved_at<first_seen_at)) as incident_inverted_time,
    (select count(*) from public.crypto_operational_cursors c
      left join cron.job j on j.jobname=c.source_name
      left join lateral (
        select max(d.runid)::bigint latest_runid from cron.job_run_details d
        where d.jobid=j.jobid and d.status in('succeeded','failed') and d.start_time is not null
      ) r on true
      where c.source_type='cron' and c.last_observation_id>coalesce(r.latest_runid,0)
    ) as cursor_ahead,

    (select count(*) from public.crypto_scanner_runs where success and finished_at is null) as scanner_success_without_finish,
    (select count(*) from public.crypto_scanner_runs where (finished_at is not null and finished_at<started_at) or coalesce(duration_ms,0)<0) as scanner_negative_time,
    (select count(*) from public.crypto_scanner_runs where registered>class_a_found) as scanner_registered_exceeds_found,
    (select count(*) from public.crypto_scanner_runs where scanner_version>=12 and success and started_at>=now()-interval '24 hours' and jsonb_array_length(errors)>0) as scanner_v12_partial_errors,

    (select count(*) from public.crypto_user_profiles p left join auth.users u on u.id=p.user_id where u.id is null) as profile_orphans,
    (select count(*) from public.crypto_subscriptions s left join auth.users u on u.id=s.user_id where u.id is null) as subscription_orphans,
    (select count(*) from auth.users u left join public.crypto_user_profiles p on p.user_id=u.id where p.user_id is null) as auth_without_profile,
    (select count(*) from auth.users u left join public.crypto_subscriptions s on s.user_id=u.id where s.user_id is null) as auth_without_subscription,

    (select count(*) from public.crypto_billing_orders o left join auth.users u on u.id=o.user_id where u.id is null) as billing_order_user_orphans,
    (select count(*) from public.crypto_billing_events e left join public.crypto_billing_orders o on o.id=e.order_id where e.order_id is not null and o.id is null) as billing_event_order_orphans,
    (select count(*) from public.crypto_billing_events e left join auth.users u on u.id=e.user_id where e.user_id is not null and u.id is null) as billing_event_user_orphans,
    (select count(*) from public.crypto_billing_events where (processed and processed_at is null) or (not processed and processed_at is not null)) as billing_event_processing_mismatch,
    (select count(*) from public.crypto_billing_orders where (status in('paid','refunded') and completed_at is null) or (status not in('paid','refunded') and completed_at is not null)) as billing_order_completion_mismatch,
    (select count(*) from public.crypto_subscriptions where current_period_start is not null and current_period_end is not null and current_period_end<current_period_start) as subscription_period_inverted,
    (select count(*) from public.crypto_plan_prices p
      where p.plan<>'FREE' and p.active and not exists(
        select 1 from public.crypto_billing_provider_adapters a
        where a.provider=p.provider and a.desired_mode<>'disabled' and a.lifecycle_status in('verified','active') and a.checkout_enabled
      )
    ) as active_price_without_adapter,
    (select count(*) from public.crypto_billing_provider_adapters
      where desired_mode<>'disabled' and (
        lifecycle_status not in('verified','active') or not checkout_enabled or last_verified_at is null
      )
    ) as enabled_adapter_not_verified,

    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relname ~ '^crypto_' and not c.relrowsecurity
    ) as tables_without_rls,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef
        and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))
    ) as browser_public_definers,
    (select count(*) from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname ~ '^crypto_' and not con.convalidated
    ) as unvalidated_constraints
), checks as (
  select * from (values
    ('signal_entry_inverted','critical',(select signal_entry_inverted from metrics),'Entry low exceeds entry high'),
    ('signal_long_geometry','critical',(select signal_long_geometry from metrics),'Invalid LONG stop or target ordering'),
    ('signal_short_geometry','critical',(select signal_short_geometry from metrics),'Invalid SHORT stop or target ordering'),
    ('signal_invalid_symbol','critical',(select signal_invalid_symbol from metrics),'Stored signal symbol violates bounded format'),
    ('signal_active_without_activation','critical',(select signal_active_without_activation from metrics),'ACTIVE signal lacks activation time'),
    ('signal_closed_incomplete','critical',(select signal_closed_incomplete from metrics),'CLOSED signal lacks close time or type'),
    ('signal_nonclosed_with_close_time','critical',(select signal_nonclosed_with_close_time from metrics),'Non-CLOSED signal contains close time'),
    ('signal_waiting_entry_notified','critical',(select signal_waiting_entry_notified from metrics),'WAITING signal is already entry-notified'),
    ('outbox_duplicate_pairs','critical',(select outbox_duplicate_pairs from metrics),'Duplicate signal and event pair'),
    ('outbox_sent_without_time','critical',(select outbox_sent_without_time from metrics),'Sent notification lacks sent time'),
    ('outbox_unsent_with_time','critical',(select outbox_unsent_with_time from metrics),'Unsent notification contains sent time'),
    ('outbox_stale_claims','warning',(select outbox_stale_claims from metrics),'Processing claim is older than ten minutes'),
    ('outbox_excess_attempts','critical',(select outbox_excess_attempts from metrics),'Notification attempts exceed hard retry limit'),
    ('outbox_orphans','critical',(select outbox_orphans from metrics),'Outbox row has no signal'),
    ('outbox_sent_flag_mismatch','critical',(select outbox_sent_flag_mismatch from metrics),'Post-cutover sent event has false signal flag'),
    ('postcutover_flag_without_sent','critical',(select postcutover_flag_without_sent from metrics),'Post-cutover true flag has no sent outbox event'),
    ('ai_stale_started','warning',(select ai_stale_started from metrics),'AI run remains started beyond fifteen minutes'),
    ('ai_terminal_without_time','critical',(select ai_terminal_without_time from metrics),'Terminal AI run lacks completion time'),
    ('backtest_stale_started','warning',(select backtest_stale_started from metrics),'Backtest remains started beyond thirty minutes'),
    ('backtest_terminal_without_time','critical',(select backtest_terminal_without_time from metrics),'Terminal backtest lacks completion time'),
    ('operational_missing_observation','critical',(select operational_missing_observation from metrics),'Processed HTTP mapping lacks bounded observation'),
    ('operational_observation_mismatch','critical',(select operational_observation_mismatch from metrics),'HTTP mapping and observation disagree'),
    ('incident_open_resolved','critical',(select incident_open_resolved from metrics),'Open incident contains resolution time'),
    ('incident_resolved_without_time','critical',(select incident_resolved_without_time from metrics),'Resolved incident lacks resolution time'),
    ('incident_inverted_time','critical',(select incident_inverted_time from metrics),'Incident timestamps are inverted'),
    ('cursor_ahead','critical',(select cursor_ahead from metrics),'Durable cron cursor is ahead of terminal history'),
    ('scanner_success_without_finish','critical',(select scanner_success_without_finish from metrics),'Successful scanner run lacks finish time'),
    ('scanner_negative_time','critical',(select scanner_negative_time from metrics),'Scanner run has invalid time or duration'),
    ('scanner_registered_exceeds_found','critical',(select scanner_registered_exceeds_found from metrics),'Registered signals exceed class A candidates'),
    ('scanner_v12_partial_errors','warning',(select scanner_v12_partial_errors from metrics),'Scanner v12 has bounded partial errors in the last day'),
    ('profile_orphans','critical',(select profile_orphans from metrics),'Profile has no Auth user'),
    ('subscription_orphans','critical',(select subscription_orphans from metrics),'Subscription has no Auth user'),
    ('auth_without_profile','critical',(select auth_without_profile from metrics),'Auth user lacks profile'),
    ('auth_without_subscription','critical',(select auth_without_subscription from metrics),'Auth user lacks subscription'),
    ('billing_order_user_orphans','critical',(select billing_order_user_orphans from metrics),'Billing order has no Auth user'),
    ('billing_event_order_orphans','critical',(select billing_event_order_orphans from metrics),'Billing event references missing order'),
    ('billing_event_user_orphans','critical',(select billing_event_user_orphans from metrics),'Billing event references missing Auth user'),
    ('billing_event_processing_mismatch','critical',(select billing_event_processing_mismatch from metrics),'Billing processed flag and timestamp disagree'),
    ('billing_order_completion_mismatch','critical',(select billing_order_completion_mismatch from metrics),'Billing order status and completion time disagree'),
    ('subscription_period_inverted','critical',(select subscription_period_inverted from metrics),'Subscription period end precedes start'),
    ('active_price_without_adapter','critical',(select active_price_without_adapter from metrics),'Active paid price has no verified checkout adapter'),
    ('enabled_adapter_not_verified','critical',(select enabled_adapter_not_verified from metrics),'Enabled provider adapter is not fully verified'),
    ('tables_without_rls','critical',(select tables_without_rls from metrics),'CRYPTO LAB table lacks RLS'),
    ('browser_public_definers','critical',(select browser_public_definers from metrics),'Browser can execute public SECURITY DEFINER function'),
    ('unvalidated_constraints','critical',(select unvalidated_constraints from metrics),'CRYPTO LAB constraint is not validated')
  ) v(code,severity,violations,detail)
), summary as (
  select
    count(*) filter(where violations>0 and severity='critical') as critical_checks,
    count(*) filter(where violations>0 and severity='warning') as warning_checks,
    coalesce(sum(violations) filter(where severity='critical'),0) as critical_violations,
    coalesce(sum(violations) filter(where severity='warning'),0) as warning_violations,
    count(*) as total_checks
  from checks
)
select jsonb_build_object(
  'generated_at',now(),
  'state',case when critical_checks>0 then 'critical' when warning_checks>0 then 'warning' else 'healthy' end,
  'critical_checks',critical_checks,
  'warning_checks',warning_checks,
  'critical_violations',critical_violations,
  'warning_violations',warning_violations,
  'total_checks',total_checks,
  'cutover_at','2026-08-04T09:00:00Z',
  'checks',coalesce((select jsonb_agg(jsonb_build_object(
    'code',code,'severity',severity,'violations',violations,'passed',violations=0,'detail',detail
  ) order by case severity when 'critical' then 0 else 1 end,code) from checks),'[]'::jsonb),
  'violations',coalesce((select jsonb_agg(jsonb_build_object(
    'code',code,'severity',severity,'violations',violations,'detail',detail
  ) order by case severity when 'critical' then 0 else 1 end,code) from checks where violations>0),'[]'::jsonb)
)
from summary;
$$;

revoke all on function private.crypto_data_integrity_snapshot() from public,anon,authenticated;
grant execute on function private.crypto_data_integrity_snapshot() to service_role;

create or replace function private.get_crypto_admin_data_integrity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not public.crypto_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  return private.crypto_data_integrity_snapshot();
end;
$$;

create or replace function public.get_crypto_admin_data_integrity()
returns jsonb
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$ select private.get_crypto_admin_data_integrity() $$;

revoke all on function private.get_crypto_admin_data_integrity() from public,anon;
revoke all on function public.get_crypto_admin_data_integrity() from public,anon;
grant execute on function private.get_crypto_admin_data_integrity() to authenticated,service_role;
grant execute on function public.get_crypto_admin_data_integrity() to authenticated,service_role;

do $$
begin
  if to_regprocedure('private.get_crypto_admin_operational_summary_base()') is null
     and to_regprocedure('private.get_crypto_admin_operational_summary()') is not null then
    alter function private.get_crypto_admin_operational_summary() rename to get_crypto_admin_operational_summary_base;
  end if;
end;
$$;

revoke all on function private.get_crypto_admin_operational_summary_base() from public,anon;
grant execute on function private.get_crypto_admin_operational_summary_base() to authenticated,service_role;

create or replace function private.get_crypto_admin_operational_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_base jsonb;
  v_integrity jsonb;
  v_indicator jsonb;
  v_state text;
  v_base_state text;
  v_counts jsonb;
  v_healthy integer;
  v_warning integer;
  v_critical integer;
  v_collecting integer;
begin
  if not public.crypto_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  v_base:=private.get_crypto_admin_operational_summary_base();
  v_integrity:=private.crypto_data_integrity_snapshot();
  v_state:=coalesce(v_integrity->>'state','critical');
  v_base_state:=coalesce(v_base->>'overall_state','critical');

  v_indicator:=jsonb_build_object(
    'code','data_integrity',
    'state',v_state,
    'owner','data',
    'action_code','data_integrity_runbook',
    'metrics',jsonb_build_object(
      'total_checks',v_integrity->'total_checks',
      'critical_checks',v_integrity->'critical_checks',
      'warning_checks',v_integrity->'warning_checks',
      'critical_violations',v_integrity->'critical_violations',
      'warning_violations',v_integrity->'warning_violations',
      'generated_at',v_integrity->'generated_at'
    )
  );

  v_counts:=coalesce(v_base->'counts','{}'::jsonb);
  v_healthy:=coalesce((v_counts->>'healthy')::integer,0)+(case when v_state='healthy' then 1 else 0 end);
  v_warning:=coalesce((v_counts->>'warning')::integer,0)+(case when v_state='warning' then 1 else 0 end);
  v_critical:=coalesce((v_counts->>'critical')::integer,0)+(case when v_state='critical' then 1 else 0 end);
  v_collecting:=coalesce((v_counts->>'collecting')::integer,0)+(case when v_state='collecting' then 1 else 0 end);

  return v_base || jsonb_build_object(
    'overall_state',case
      when v_base_state='critical' or v_state='critical' then 'critical'
      when v_base_state='warning' or v_state='warning' then 'warning'
      when v_base_state='collecting' or v_state='collecting' then 'collecting'
      else 'healthy' end,
    'decision',case
      when v_base_state='critical' or v_state='critical' then 'NO_GO'
      when v_base_state in('warning','collecting') or v_state in('warning','collecting') then 'WATCH'
      else 'TECHNICAL_GO' end,
    'counts',jsonb_build_object('healthy',v_healthy,'warning',v_warning,'critical',v_critical,'collecting',v_collecting),
    'indicators',coalesce(v_base->'indicators','[]'::jsonb)||jsonb_build_array(v_indicator),
    'alerts',case when v_state in('critical','warning')
      then coalesce(v_base->'alerts','[]'::jsonb)||jsonb_build_array(v_indicator)
      else coalesce(v_base->'alerts','[]'::jsonb) end,
    'data_integrity',v_integrity
  );
end;
$$;

revoke all on function private.get_crypto_admin_operational_summary() from public,anon;
grant execute on function private.get_crypto_admin_operational_summary() to authenticated,service_role;

notify pgrst,'reload schema';
