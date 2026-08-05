create or replace function private.crypto_maintenance_counter_snapshot(p_run_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_catalog','pg_temp'
as $$
declare
  v_counters jsonb;
  v_key_count integer;
begin
  select jsonb_build_object(
    'stale_ai_marked',stale_ai_marked,
    'stale_backtests_marked',stale_backtests_marked,
    'expired_leases_deleted',expired_leases_deleted,
    'registration_attempts_deleted',registration_attempts_deleted,
    'recovery_attempts_deleted',recovery_attempts_deleted,
    'rate_events_deleted',rate_events_deleted,
    'scanner_runs_deleted',scanner_runs_deleted,
    'notification_outbox_deleted',notification_outbox_deleted,
    'operational_requests_deleted',operational_requests_deleted,
    'operational_observations_deleted',operational_observations_deleted,
    'resolved_incidents_deleted',resolved_incidents_deleted,
    'operational_incidents_deleted',operational_incidents_deleted,
    'operational_cursors_deleted',operational_cursors_deleted,
    'old_maintenance_rows_deleted',old_maintenance_rows_deleted
  ) into v_counters
  from public.crypto_maintenance_runs
  where id=p_run_id;

  if v_counters is null then
    raise exception 'Maintenance counter snapshot missing for run %',p_run_id using errcode='P0002';
  end if;

  select count(*) into v_key_count from jsonb_each(v_counters);
  if v_key_count<>14 or exists(
    select 1 from jsonb_each(v_counters) e
    where jsonb_typeof(e.value)<>'number'
       or e.value::text !~ '^[0-9]+$'
       or (e.value::text)::numeric<0
       or (e.value::text)::numeric>2147483647
  ) then
    raise exception 'Maintenance counter contract invalid for run %',p_run_id using errcode='22023';
  end if;

  return v_counters;
end;
$$;

revoke all on function private.crypto_maintenance_counter_snapshot(bigint)
from public,anon,authenticated,service_role;
grant execute on function private.crypto_maintenance_counter_snapshot(bigint) to postgres;
