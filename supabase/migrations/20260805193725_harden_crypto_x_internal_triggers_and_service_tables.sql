-- CRYPTO LAB v79: remove public RPC reachability from internal trigger functions,
-- make service-only RLS intent explicit, and cover the recap FK.

revoke execute on function public.crypto_x_apply_source_attribution() from public, anon, authenticated;
revoke execute on function public.crypto_x_guard_unverified_content_job() from public, anon, authenticated;
grant execute on function public.crypto_x_apply_source_attribution() to service_role;
grant execute on function public.crypto_x_guard_unverified_content_job() to service_role;

revoke all on table public.crypto_x_account_activity_history from public, anon, authenticated;
revoke all on table public.crypto_x_account_metrics from public, anon, authenticated;
revoke all on table public.crypto_x_account_watchlist from public, anon, authenticated;
revoke all on table public.crypto_x_recap_runs from public, anon, authenticated;

drop policy if exists crypto_x_account_activity_history_service_only_deny on public.crypto_x_account_activity_history;
create policy crypto_x_account_activity_history_service_only_deny
on public.crypto_x_account_activity_history
for all to anon, authenticated
using (false)
with check (false);

drop policy if exists crypto_x_account_metrics_service_only_deny on public.crypto_x_account_metrics;
create policy crypto_x_account_metrics_service_only_deny
on public.crypto_x_account_metrics
for all to anon, authenticated
using (false)
with check (false);

drop policy if exists crypto_x_account_watchlist_service_only_deny on public.crypto_x_account_watchlist;
create policy crypto_x_account_watchlist_service_only_deny
on public.crypto_x_account_watchlist
for all to anon, authenticated
using (false)
with check (false);

drop policy if exists crypto_x_recap_runs_service_only_deny on public.crypto_x_recap_runs;
create policy crypto_x_recap_runs_service_only_deny
on public.crypto_x_recap_runs
for all to anon, authenticated
using (false)
with check (false);

create index if not exists crypto_x_recap_runs_content_job_id_idx
on public.crypto_x_recap_runs(content_job_id);

do $$
declare
  v_policy_count integer;
begin
  if has_function_privilege('anon','public.crypto_x_apply_source_attribution()','EXECUTE')
     or has_function_privilege('authenticated','public.crypto_x_apply_source_attribution()','EXECUTE')
     or has_function_privilege('anon','public.crypto_x_guard_unverified_content_job()','EXECUTE')
     or has_function_privilege('authenticated','public.crypto_x_guard_unverified_content_job()','EXECUTE') then
    raise exception 'Internal trigger function remains externally executable';
  end if;

  if not has_function_privilege('service_role','public.crypto_x_apply_source_attribution()','EXECUTE')
     or not has_function_privilege('service_role','public.crypto_x_guard_unverified_content_job()','EXECUTE') then
    raise exception 'Service role trigger function privilege missing';
  end if;

  select count(*) into v_policy_count
  from pg_policy p
  join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in (
      'crypto_x_account_activity_history',
      'crypto_x_account_metrics',
      'crypto_x_account_watchlist',
      'crypto_x_recap_runs'
    );
  if v_policy_count <> 4 then
    raise exception 'Expected four explicit service-only deny policies, found %',v_policy_count;
  end if;

  if to_regclass('public.crypto_x_recap_runs_content_job_id_idx') is null then
    raise exception 'Recap content-job FK index missing';
  end if;
end $$;
