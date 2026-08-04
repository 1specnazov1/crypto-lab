create or replace function public.run_crypto_maintenance()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_lock_acquired boolean:=false;
  v_run_id bigint;
  v_started_at timestamptz:=clock_timestamp();
  v_completed_at timestamptz;
  v_ai integer:=0; v_backtests integer:=0; v_leases integer:=0;
  v_registration integer:=0; v_recovery integer:=0; v_rate_events integer:=0;
  v_scanner integer:=0; v_old_runs integer:=0; v_outbox integer:=0; v_error text;
  v_operational_requests integer:=0; v_operational_observations integer:=0;
  v_operational_incidents integer:=0; v_operational_cursors integer:=0;
begin
  select pg_catalog.pg_try_advisory_xact_lock(7930000005::bigint)
  into v_lock_acquired;

  if not v_lock_acquired then
    return jsonb_build_object(
      'success',false,
      'status','skipped',
      'reason','maintenance_already_running'
    );
  end if;

  v_started_at:=clock_timestamp();
  insert into public.crypto_maintenance_runs(started_at,status)
  values(v_started_at,'started') returning id into v_run_id;

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

    delete from public.crypto_maintenance_runs r
    where r.started_at<now()-interval '180 days'
      and r.id<>v_run_id
      and not exists(
        select 1
        from public.crypto_maintenance_evidence_seals s
        where s.maintenance_run_id=r.id
      );
    get diagnostics v_old_runs=row_count;

    v_completed_at:=clock_timestamp();
    update public.crypto_maintenance_runs
    set completed_at=v_completed_at,status='completed',
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
      'started_at',v_started_at,'completed_at',v_completed_at,
      'duration_ms',greatest(0,floor(extract(epoch from(v_completed_at-v_started_at))*1000)::bigint),
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
    v_completed_at:=clock_timestamp();
    update public.crypto_maintenance_runs
    set completed_at=v_completed_at,status='failed',error_message=left(v_error,2000)
    where id=v_run_id;
    return jsonb_build_object(
      'success',false,'run_id',v_run_id,'error',left(v_error,500),
      'started_at',v_started_at,'completed_at',v_completed_at,
      'duration_ms',greatest(0,floor(extract(epoch from(v_completed_at-v_started_at))*1000)::bigint)
    );
  end;
end;
$$;

create or replace function private.service_seal_latest_crypto_maintenance(
  p_manifest_key text default null,
  p_min_started_at timestamptz default timestamptz '2026-08-05 03:17:00+00'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare
  v_manifest public.crypto_release_manifests%rowtype;
  v_run public.crypto_maintenance_runs%rowtype;
  v_checkpoint_id bigint;
  v_integrity jsonb;
  v_drift jsonb;
  v_counters jsonb;
  v_failures jsonb:='[]'::jsonb;
  v_status text;
  v_payload jsonb;
  v_hash text;
  v_seal_id bigint;
  v_existing public.crypto_maintenance_evidence_seals%rowtype;
  v_verification jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(7930000014::bigint);

  select * into v_manifest
  from public.crypto_release_manifests
  where active and (p_manifest_key is null or manifest_key=p_manifest_key)
  order by created_at desc,id desc limit 1;
  if v_manifest.id is null then
    raise exception 'Active release manifest not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.crypto_maintenance_runs
  where started_at>=p_min_started_at
  order by started_at asc,id asc limit 1;

  if v_run.id is null then
    return jsonb_build_object(
      'sealed',false,'status','pending','reason','maintenance_run_not_available',
      'scope','first_run_after_threshold','manifest_key',v_manifest.manifest_key,
      'expected_after',p_min_started_at
    );
  end if;

  select * into v_existing
  from public.crypto_maintenance_evidence_seals
  where maintenance_run_id=v_run.id;
  if v_existing.id is not null then
    v_verification:=private.verify_crypto_maintenance_evidence(v_existing.id);
    return jsonb_build_object(
      'sealed',true,'id',v_existing.id,'status',v_existing.seal_status,
      'scope','first_run_after_threshold','maintenance_run_id',v_existing.maintenance_run_id,
      'evidence_hash',v_existing.evidence_hash,'hash_algorithm',v_existing.hash_algorithm,
      'sealed_at',v_existing.sealed_at,
      'verified',coalesce((v_verification->>'verified')::boolean,false),
      'verification',v_verification,'idempotent',true
    );
  end if;

  if v_run.status='started' or v_run.completed_at is null then
    return jsonb_build_object(
      'sealed',false,'status','pending','reason','maintenance_run_not_terminal',
      'scope','first_run_after_threshold','maintenance_run_id',v_run.id,
      'run_status',v_run.status,'run_started_at',v_run.started_at,
      'age_seconds',greatest(0,floor(extract(epoch from(now()-v_run.started_at)))::bigint),
      'manifest_key',v_manifest.manifest_key,'expected_after',p_min_started_at
    );
  end if;

  if v_run.status not in('completed','failed') then
    raise exception 'Unsupported maintenance terminal status: %',v_run.status using errcode='22023';
  end if;

  select id into v_checkpoint_id
  from public.crypto_release_checkpoints
  where build=v_manifest.build
  order by id desc limit 1;
  if v_checkpoint_id is null then
    raise exception 'Release checkpoint not found' using errcode='P0002';
  end if;

  v_integrity:=private.crypto_data_integrity_snapshot();
  v_drift:=private.crypto_release_drift_snapshot();
  v_counters:=private.crypto_maintenance_counter_snapshot(v_run.id);

  if v_run.status<>'completed' then v_failures:=v_failures||jsonb_build_array('maintenance_not_completed'); end if;
  if v_run.completed_at is null then v_failures:=v_failures||jsonb_build_array('maintenance_completion_time_missing'); end if;
  if v_run.error_message is not null then v_failures:=v_failures||jsonb_build_array('maintenance_error_present'); end if;
  if coalesce(v_integrity->>'state','critical')<>'healthy' then v_failures:=v_failures||jsonb_build_array('data_integrity_not_healthy'); end if;
  if coalesce(v_drift->>'state','critical')<>'healthy' then v_failures:=v_failures||jsonb_build_array('release_drift_not_healthy'); end if;
  if exists(
    select 1 from jsonb_each_text(v_counters) e
    where e.value !~ '^[0-9]+$' or e.value::numeric<0
  ) then v_failures:=v_failures||jsonb_build_array('invalid_retention_counter'); end if;

  v_status:=case when jsonb_array_length(v_failures)=0 then 'passed' else 'failed' end;
  v_payload:=private.crypto_maintenance_evidence_payload_v2(
    1,v_manifest.id,v_manifest.manifest_key,v_manifest.source_commit,
    v_checkpoint_id,v_run.id,p_min_started_at,v_run.started_at,v_run.completed_at,
    v_run.status,v_counters,coalesce(v_integrity->>'state','critical'),
    coalesce(v_drift->>'state','critical'),v_status,v_failures
  );
  v_hash:=private.crypto_maintenance_evidence_hash(v_payload);

  insert into public.crypto_maintenance_evidence_seals(
    maintenance_run_id,manifest_id,manifest_key,manifest_source_commit,release_checkpoint_id,
    evidence_version,expected_after,run_started_at,run_completed_at,run_status,counters,
    integrity_state,drift_state,seal_status,failure_codes,evidence_payload,hash_algorithm,evidence_hash
  ) values(
    v_run.id,v_manifest.id,v_manifest.manifest_key,v_manifest.source_commit,v_checkpoint_id,
    1,p_min_started_at,v_run.started_at,v_run.completed_at,v_run.status,v_counters,
    coalesce(v_integrity->>'state','critical'),coalesce(v_drift->>'state','critical'),
    v_status,v_failures,v_payload,'sha256-jsonb-v1',v_hash
  ) returning id into v_seal_id;

  update public.crypto_release_checkpoints
  set evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
    'maintenance_evidence',jsonb_build_object(
      'seal_id',v_seal_id,'maintenance_run_id',v_run.id,'status',v_status,
      'scope','first_run_after_threshold',
      'manifest_key',v_manifest.manifest_key,'manifest_source_commit',v_manifest.source_commit,
      'evidence_hash',v_hash,'hash_algorithm','sha256-jsonb-v1','payload_version',1,
      'sealed_at',now(),'counters',v_counters
    )
  )
  where id=v_checkpoint_id;

  v_verification:=private.verify_crypto_maintenance_evidence(v_seal_id);
  if not coalesce((v_verification->>'verified')::boolean,false) then
    raise exception 'Maintenance evidence verification failed' using errcode='55000';
  end if;

  return jsonb_build_object(
    'sealed',true,'id',v_seal_id,'status',v_status,
    'scope','first_run_after_threshold','maintenance_run_id',v_run.id,
    'manifest_key',v_manifest.manifest_key,'manifest_source_commit',v_manifest.source_commit,
    'evidence_hash',v_hash,'hash_algorithm','sha256-jsonb-v1','verified',true,
    'failure_codes',v_failures,'checkpoint_id',v_checkpoint_id,'counters',v_counters
  );
end;
$$;

revoke all on function public.run_crypto_maintenance() from public,anon,authenticated,service_role;
revoke all on function private.service_seal_latest_crypto_maintenance(text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.run_crypto_maintenance() to postgres;
grant execute on function private.service_seal_latest_crypto_maintenance(text,timestamptz) to postgres;

comment on function public.run_crypto_maintenance() is
'CRYPTO LAB daily maintenance. A transaction-scoped advisory lock prevents overlapping runs; duplicate invocations return maintenance_already_running without creating a run row.';
comment on function private.service_seal_latest_crypto_maintenance(text,timestamptz) is
'Creates one immutable maintenance evidence seal for the first terminal run after the release threshold. A transaction-scoped advisory lock guarantees concurrent idempotency.';