alter view public.crypto_x_account_growth_deltas set (security_invoker = true);

revoke execute on function public.crypto_x_editorial_diversity_penalty(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.crypto_x_editorial_diversity_penalty(uuid,timestamptz) to service_role;

revoke execute on function public.crypto_x_log_account_growth_anomaly() from public, anon, authenticated;
grant execute on function public.crypto_x_log_account_growth_anomaly() to service_role;

drop policy if exists crypto_closed_beta_config_deny_client on public.crypto_closed_beta_config;
create policy crypto_closed_beta_config_deny_client on public.crypto_closed_beta_config for all to anon, authenticated using (false) with check (false);

drop policy if exists crypto_closed_beta_test_personas_deny_client on public.crypto_closed_beta_test_personas;
create policy crypto_closed_beta_test_personas_deny_client on public.crypto_closed_beta_test_personas for all to anon, authenticated using (false) with check (false);

drop policy if exists crypto_closed_beta_scenarios_deny_client on public.crypto_closed_beta_scenarios;
create policy crypto_closed_beta_scenarios_deny_client on public.crypto_closed_beta_scenarios for all to anon, authenticated using (false) with check (false);

drop policy if exists crypto_closed_beta_checklist_deny_client on public.crypto_closed_beta_checklist;
create policy crypto_closed_beta_checklist_deny_client on public.crypto_closed_beta_checklist for all to anon, authenticated using (false) with check (false);

drop policy if exists crypto_prelaunch_monitor_snapshots_deny_client on public.crypto_prelaunch_monitor_snapshots;
create policy crypto_prelaunch_monitor_snapshots_deny_client on public.crypto_prelaunch_monitor_snapshots for all to anon, authenticated using (false) with check (false);

create index if not exists crypto_closed_beta_checklist_scenario_code_idx on public.crypto_closed_beta_checklist(scenario_code);
