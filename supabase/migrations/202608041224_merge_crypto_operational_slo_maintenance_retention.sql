create or replace function public.run_crypto_maintenance()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_run_id bigint; v_ai integer:=0; v_backtests integer:=0; v_leases integer:=0;
  v_registration integer:=0; v_recovery integer:=0; v_rate_events integer:=0;
  v_scanner integer:=0; v_old_runs integer:=0; v_outbox integer:=0; v_error text;
  v_operational_requests integer:=0; v_operational_observations integer:=0;
  v_operational_incidents integer:=0; v_operational_cursors integer:=0;
begin
  insert into public.crypto_maintenance_runs(status) values('started') returning id into v_run_id;
  begin
    update public.crypto_ai_runs
    set status='failed',completed_at=coalesce(completed_at,now()),
        duration_ms=coalesce(duration_ms,greatest(0,floor(extract(epoch from(now()-created_at))*1000)::integer)),
        error_code=coalesce(error_code,'STALE_RUN'),
        error_message=coalesce(error_message,'AI run exceeded 15 minutes without completion')
    where status='started' and created_at<now()-interval '15 minutes';
    get diagnostics v_ai=row_count;

    update public.crypto_backtest_runs
    set status='failed',completed_at=coalesce(completed_at,now()),
        duration_ms=coalesce(duration_ms,greatest(0,floor(extract(epoch from(now()-created_at))*1000)::integer)),
        error_code=coalesce(error_code,'STALE_RUN'),
        error_message=coalesce(error_message,'Backtest run exceeded 30 minutes without completion')
    where status='started' and created_at<now()-interval '30 minutes';
    get diagnostics v_backtests=row_count;

    delete from public.crypto_feature_access_leases where expires_at<now()-interval '1 day';
    get diagnostics v_leases=row_count;
    delete from public.crypto_registration_attempts where created_at<now()-interval '30 days';
    get diagnostics v_registration=row_count;
    delete from public.crypto_recovery_attempts where created_at<now()-interval '30 days';
    get diagnostics v_recovery=row_count;
    delete from public.crypto_feature_rate_events where created_at<now()-interval '2 days';
    get diagnostics v_rate_events=row_count;
    delete from public.crypto_scanner_runs where started_at<now()-interval '180 days';
    get diagnostics v_scanner=row_count;
    delete from public.crypto_signal_notification_outbox
    where status in('sent','dead') and created_at<now()-interval '180 days';
    get diagnostics v_outbox=row_count;

    delete from public.crypto_operational_http_requests q
    where q.processed_at is not null
      and q.processed_at<now()-interval '30 days'
      and not exists(
        select 1 from public.crypto_operational_incidents i
        where i.status='open' and i.source_type='edge' and i.last_observation_id=q.request_id::text
      );
    get diagnostics v_operational_requests=row_count;

    delete from public.crypto_operational_observations
    where observed_at<now()-interval '90 days';
    get diagnostics v_operational_observations=row_count;

    delete from public.crypto_operational_incidents
    where status='resolved' and resolved_at<now()-interval '180 days';
    get diagnostics v_operational_incidents=row_count;

    delete from public.crypto_operational_cursors
    where source_type='cron' and updated_at<now()-interval '30 days'
      and source_name not in(
        'crypto-signal-monitor-every-minute','crypto-market-scanner-every-15-minutes',
        'crypto-lab-daily-maintenance','crypto-lab-subscription-lifecycle',
        'crypto-lab-billing-event-retry','crypto-lab-billing-reconciliation',
        'crypto-lab-incident-reconciliation'
      );
    get diagnostics v_operational_cursors=row_count;

    delete from public.crypto_maintenance_runs
    where started_at<now()-interval '180 days' and id<>v_run_id;
    get diagnostics v_old_runs=row_count;

    update public.crypto_maintenance_runs
    set completed_at=now(),status='completed',
        stale_ai_marked=v_ai,stale_backtests_marked=v_backtests,
        expired_leases_deleted=v_leases,registration_attempts_deleted=v_registration,
        recovery_attempts_deleted=v_recovery,rate_events_deleted=v_rate_events,
        scanner_runs_deleted=v_scanner,notification_outbox_deleted=v_outbox,
        operational_requests_deleted=v_operational_requests,
        operational_observations_deleted=v_operational_observations,
        operational_incidents_deleted=v_operational_incidents,
        resolved_incidents_deleted=v_operational_incidents,
        operational_cursors_deleted=v_operational_cursors,
        old_maintenance_rows_deleted=v_old_runs
    where id=v_run_id;

    return jsonb_build_object(
      'success',true,'run_id',v_run_id,
      'stale_ai_marked',v_ai,'stale_backtests_marked',v_backtests,
      'expired_leases_deleted',v_leases,'registration_attempts_deleted',v_registration,
      'recovery_attempts_deleted',v_recovery,'rate_events_deleted',v_rate_events,
      'scanner_runs_deleted',v_scanner,'notification_outbox_deleted',v_outbox,
      'operational_requests_deleted',v_operational_requests,
      'operational_observations_deleted',v_operational_observations,
      'operational_incidents_deleted',v_operational_incidents,
      'operational_cursors_deleted',v_operational_cursors,
      'old_maintenance_rows_deleted',v_old_runs,
      'open_incidents_deleted',0,'active_cursors_deleted',0
    );
  exception when others then
    get stacked diagnostics v_error=message_text;
    update public.crypto_maintenance_runs
    set completed_at=now(),status='failed',error_message=left(v_error,2000)
    where id=v_run_id;
    return jsonb_build_object('success',false,'run_id',v_run_id,'error',left(v_error,500));
  end;
end;
$$;