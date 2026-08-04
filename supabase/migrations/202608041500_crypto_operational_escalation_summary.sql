create or replace function private.get_crypto_admin_operational_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','cron','pg_catalog','pg_temp'
as $$
declare
  v_result jsonb;
begin
  if not public.crypto_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  with source_config(source_type,source_name,code,owner,min_success,max_p95_ms,warn_age_minutes,critical_age_minutes,min_samples,critical_success) as (
    values
      ('edge'::text,'crypto-signal-monitor'::text,'signal_monitor'::text,'operations'::text,99.0::numeric,5000::numeric,3::numeric,10::numeric,30::bigint,90.0::numeric),
      ('edge','crypto-market-scanner','market_scanner','operations',95.0,120000,30,60,3,80.0),
      ('cron','crypto-lab-incident-reconciliation','incident_reconciliation','operations',95.0,30000,15,30,6,80.0)
  ),
  source_stats as (
    select c.*,
      count(o.id) as samples_24h,
      count(o.id) filter(where o.success) as successes_24h,
      count(o.id) filter(where o.observed_at>=now()-interval '1 hour') as samples_1h,
      count(o.id) filter(where o.observed_at>=now()-interval '1 hour' and not o.success) as failures_1h,
      percentile_cont(0.95) within group(order by o.duration_ms) filter(where o.id is not null) as p95_ms,
      greatest(
        max(o.observed_at),
        case
          when c.source_type='edge' then (
            select max(q.requested_at)
            from public.crypto_operational_http_requests q
            where q.source_name=c.source_name
          )
          else (
            select max(d.start_time)
            from cron.job j
            join cron.job_run_details d on d.jobid=j.jobid
            where j.jobname=c.source_name
              and d.status in('succeeded','failed')
              and d.start_time is not null
          )
        end
      ) as last_observed_at
    from source_config c
    left join public.crypto_operational_observations o
      on o.source_type=c.source_type and o.source_name=c.source_name
     and o.observed_at>=now()-interval '24 hours'
    group by c.source_type,c.source_name,c.code,c.owner,c.min_success,c.max_p95_ms,c.warn_age_minutes,c.critical_age_minutes,c.min_samples,c.critical_success
  ),
  source_indicators as (
    select code,
      case
        when last_observed_at is null then 'critical'
        when extract(epoch from(now()-last_observed_at))/60.0>critical_age_minutes then 'critical'
        when samples_24h>=min_samples and successes_24h*100.0/nullif(samples_24h,0)<critical_success then 'critical'
        when samples_24h<min_samples then 'collecting'
        when extract(epoch from(now()-last_observed_at))/60.0>warn_age_minutes then 'warning'
        when failures_1h>0 then 'warning'
        when successes_24h*100.0/nullif(samples_24h,0)<min_success then 'warning'
        when p95_ms>max_p95_ms then 'warning'
        else 'healthy'
      end as state,
      owner,
      code||'_review' as action_code,
      jsonb_build_object(
        'samples_24h',samples_24h,
        'success_pct_24h',case when samples_24h=0 then null else round(successes_24h*100.0/samples_24h,2) end,
        'samples_1h',samples_1h,
        'failures_1h',failures_1h,
        'p95_ms',case when p95_ms is null then null else round(p95_ms::numeric,1) end,
        'age_minutes',case when last_observed_at is null then null else round((extract(epoch from(now()-last_observed_at))/60.0)::numeric,1) end,
        'last_observed_at',last_observed_at,
        'thresholds',jsonb_build_object('min_success_pct',min_success,'max_p95_ms',max_p95_ms,'warn_age_minutes',warn_age_minutes,'critical_age_minutes',critical_age_minutes,'min_samples',min_samples)
      ) as metrics
    from source_stats
  ),
  outbox_stats as (
    select count(*) as total,
      count(*) filter(where status='sent') as sent,
      count(*) filter(where status<>'sent') as unsent,
      count(*) filter(where status='dead') as dead,
      min(created_at) filter(where status<>'sent') as oldest_unsent
    from public.crypto_signal_notification_outbox
  ),
  request_stats as (
    select count(*) filter(where processed_at is null) as pending,
      min(requested_at) filter(where processed_at is null) as oldest_pending
    from public.crypto_operational_http_requests
  ),
  cursor_lag as (
    select c.source_name,c.last_observation_id,
      coalesce(max(d.runid),c.last_observation_id) as latest_terminal_runid,
      count(d.runid) filter(where d.runid>c.last_observation_id) as pending_runs,
      min(d.start_time) filter(where d.runid>c.last_observation_id) as oldest_pending
    from public.crypto_operational_cursors c
    left join cron.job j on j.jobname=c.source_name
    left join cron.job_run_details d on d.jobid=j.jobid and d.status in('succeeded','failed') and d.start_time is not null
    where c.source_type='cron'
      and c.source_name in(
        'crypto-signal-monitor-every-minute','crypto-market-scanner-every-15-minutes',
        'crypto-lab-daily-maintenance','crypto-lab-subscription-lifecycle',
        'crypto-lab-billing-event-retry','crypto-lab-billing-reconciliation',
        'crypto-lab-incident-reconciliation'
      )
    group by c.source_name,c.last_observation_id
  ),
  cursor_stats as (
    select coalesce(max(pending_runs),0) as max_pending_runs,
      min(oldest_pending) as oldest_pending,
      count(*) filter(where pending_runs>0) as lagging_sources
    from cursor_lag
  ),
  cron_terminal as (
    select j.jobname,r.status,r.start_time
    from cron.job j
    left join lateral(
      select status,start_time from cron.job_run_details d
      where d.jobid=j.jobid and d.status in('succeeded','failed') and d.start_time is not null
      order by d.runid desc limit 1
    ) r on true
    where j.jobname in(
      'crypto-signal-monitor-every-minute','crypto-market-scanner-every-15-minutes',
      'crypto-lab-daily-maintenance','crypto-lab-subscription-lifecycle',
      'crypto-lab-billing-event-retry','crypto-lab-billing-reconciliation',
      'crypto-lab-incident-reconciliation'
    )
  ),
  cron_stats as (
    select count(*) as expected,
      count(*) filter(where status='succeeded') as succeeded,
      count(*) filter(where status='failed') as failed,
      count(*) filter(where status is null) as missing
    from cron_terminal
  ),
  incident_stats as (
    select count(*) filter(where status='open') as open,
      count(*) filter(where status='open' and severity in('high','critical')) as high_open,
      count(*) filter(where status='resolved' and resolved_at>=now()-interval '24 hours') as resolved_24h
    from public.crypto_operational_incidents
  ),
  maintenance_stats as (
    select completed_at,status,error_message
    from public.crypto_maintenance_runs
    order by started_at desc limit 1
  ),
  security_stats as (
    select
      (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname ~ '^crypto_' and not c.relrowsecurity) as tables_without_rls,
      (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))) as browser_public_definers
  ),
  fixed_indicators as (
    select 'open_incidents'::text as code,
      case when high_open>0 then 'critical' when open>0 then 'warning' else 'healthy' end as state,
      'operations'::text as owner,'incident_runbook'::text as action_code,
      jsonb_build_object('open',open,'high_open',high_open,'resolved_24h',resolved_24h) as metrics
    from incident_stats
    union all
    select 'telegram_outbox',
      case
        when dead>0 or unsent>=500 or (oldest_unsent is not null and now()-oldest_unsent>interval '15 minutes') then 'critical'
        when unsent>=100 or unsent>0 or (oldest_unsent is not null and now()-oldest_unsent>interval '5 minutes') then 'warning'
        else 'healthy'
      end,
      'operations','outbox_runbook',
      jsonb_build_object('total',total,'sent',sent,'unsent',unsent,'dead',dead,'oldest_unsent_minutes',case when oldest_unsent is null then null else round((extract(epoch from(now()-oldest_unsent))/60.0)::numeric,1) end)
    from outbox_stats
    union all
    select 'operational_http_backlog',
      case
        when pending>=500 or (oldest_pending is not null and now()-oldest_pending>interval '30 minutes') then 'critical'
        when pending>=100 or (oldest_pending is not null and now()-oldest_pending>interval '10 minutes') then 'warning'
        else 'healthy'
      end,
      'operations','http_backlog_runbook',
      jsonb_build_object('pending',pending,'oldest_pending_minutes',case when oldest_pending is null then null else round((extract(epoch from(now()-oldest_pending))/60.0)::numeric,1) end)
    from request_stats
    union all
    select 'cron_cursor_lag',
      case
        when max_pending_runs>30 or (oldest_pending is not null and now()-oldest_pending>interval '30 minutes') then 'critical'
        when max_pending_runs>10 or (oldest_pending is not null and now()-oldest_pending>interval '15 minutes') then 'warning'
        else 'healthy'
      end,
      'operations','cursor_lag_runbook',
      jsonb_build_object('lagging_sources',lagging_sources,'max_pending_runs',max_pending_runs,'oldest_pending_minutes',case when oldest_pending is null then null else round((extract(epoch from(now()-oldest_pending))/60.0)::numeric,1) end)
    from cursor_stats
    union all
    select 'cron_terminal_state',
      case when failed>0 then 'critical' when missing>0 or succeeded<expected then 'warning' else 'healthy' end,
      'operations','cron_runbook',
      jsonb_build_object('expected',expected,'succeeded',succeeded,'failed',failed,'missing',missing)
    from cron_stats
    union all
    select 'maintenance_freshness',
      case
        when completed_at is null or status<>'completed' or now()-completed_at>interval '48 hours' then 'critical'
        when now()-completed_at>interval '26 hours' then 'warning'
        else 'healthy'
      end,
      'operations','maintenance_runbook',
      jsonb_build_object('status',status,'completed_at',completed_at,'age_hours',case when completed_at is null then null else round((extract(epoch from(now()-completed_at))/3600.0)::numeric,1) end,'has_error',error_message is not null)
    from maintenance_stats
    union all
    select 'security_boundary',
      case when tables_without_rls>0 or browser_public_definers>0 then 'critical' else 'healthy' end,
      'security','security_runbook',
      jsonb_build_object('tables_without_rls',tables_without_rls,'browser_public_definers',browser_public_definers)
    from security_stats
  ),
  all_indicators as (
    select * from source_indicators
    union all
    select * from fixed_indicators
  ),
  ranked as (
    select *,case state when 'critical' then 3 when 'warning' then 2 when 'collecting' then 1 else 0 end as severity_rank
    from all_indicators
  ),
  summary as (
    select max(severity_rank) as max_rank,
      count(*) filter(where state='critical') as critical_count,
      count(*) filter(where state='warning') as warning_count,
      count(*) filter(where state='collecting') as collecting_count,
      count(*) filter(where state='healthy') as healthy_count
    from ranked
  ),
  latest_release as (
    select id,build,technical_score,commercial_score,blockers,created_at
    from public.crypto_release_checkpoints order by id desc limit 1
  )
  select jsonb_build_object(
    'generated_at',now(),
    'overall_state',case s.max_rank when 3 then 'critical' when 2 then 'warning' when 1 then 'collecting' else 'healthy' end,
    'decision',case when s.max_rank=3 then 'NO_GO' when s.max_rank in(1,2) then 'WATCH' else 'TECHNICAL_GO' end,
    'external_notifications',false,
    'next_review_minutes',5,
    'counts',jsonb_build_object('critical',s.critical_count,'warning',s.warning_count,'collecting',s.collecting_count,'healthy',s.healthy_count),
    'indicators',coalesce((select jsonb_agg(jsonb_build_object('code',code,'state',state,'owner',owner,'action_code',action_code,'metrics',metrics) order by severity_rank desc,code) from ranked),'[]'::jsonb),
    'alerts',coalesce((select jsonb_agg(jsonb_build_object('code',code,'state',state,'owner',owner,'action_code',action_code,'metrics',metrics) order by severity_rank desc,code) from ranked where state in('critical','warning')),'[]'::jsonb),
    'release',coalesce((select jsonb_build_object('checkpoint_id',id,'build',build,'technical_score',technical_score,'commercial_score',commercial_score,'external_blockers',coalesce(blockers,'[]'::jsonb),'created_at',created_at) from latest_release),'{}'::jsonb)
  ) into v_result
  from summary s;

  return v_result;
end;
$$;

create or replace function public.get_crypto_admin_operational_summary()
returns jsonb
language sql
stable
security invoker
set search_path to 'public','private','pg_temp'
as $$
  select private.get_crypto_admin_operational_summary()
$$;

revoke all on function private.get_crypto_admin_operational_summary() from public,anon;
revoke all on function public.get_crypto_admin_operational_summary() from public,anon;
grant execute on function private.get_crypto_admin_operational_summary() to authenticated,service_role;
grant execute on function public.get_crypto_admin_operational_summary() to authenticated,service_role;

notify pgrst,'reload schema';