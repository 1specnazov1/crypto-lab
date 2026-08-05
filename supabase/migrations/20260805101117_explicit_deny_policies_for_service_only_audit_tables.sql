do $$
declare t text;
begin
  foreach t in array array[
    'crypto_owner_decision_authority_events',
    'crypto_x_audit_log','crypto_x_content_jobs','crypto_x_event_sources','crypto_x_events',
    'crypto_x_media_assets','crypto_x_post_metrics','crypto_x_publications','crypto_x_publish_queue',
    'crypto_x_raw_news','crypto_x_settings','crypto_x_source_cursors','crypto_x_sources'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('revoke all on table public.%I from public,anon,authenticated',t);
      execute format('drop policy if exists %I_explicit_browser_deny on public.%I',t,t);
      execute format('create policy %I_explicit_browser_deny on public.%I as restrictive for all to anon,authenticated using(false) with check(false)',t,t);
    end if;
  end loop;
end $$;
