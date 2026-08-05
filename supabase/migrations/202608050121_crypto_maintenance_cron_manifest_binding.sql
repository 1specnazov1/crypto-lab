create or replace function private.cron_seal_crypto_lab_v79_7930()
returns jsonb
language sql
security definer
set search_path to 'private','pg_catalog','pg_temp'
as $$
  select private.service_seal_latest_crypto_maintenance(
    'crypto-lab-v79-7930-drift1',
    timestamptz '2026-08-05 03:17:00+00'
  )
$$;

revoke all on function private.cron_seal_crypto_lab_v79_7930()
  from public, anon, authenticated, service_role;
grant execute on function private.cron_seal_crypto_lab_v79_7930()
  to postgres;

select cron.alter_job(
  job_id := 14,
  command := 'select private.cron_seal_crypto_lab_v79_7930();'
);
