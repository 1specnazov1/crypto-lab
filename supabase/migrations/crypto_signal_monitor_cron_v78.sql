-- CRYPTO LAB v78
-- Backup / recovery script for the server monitor Cron job.
-- Secret values are NOT stored here.
-- Before running, Vault must contain a secret named MONITOR_SECRET.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'crypto-signal-monitor-every-minute'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'crypto-signal-monitor-every-minute',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-signal-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-monitor-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'MONITOR_SECRET'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
