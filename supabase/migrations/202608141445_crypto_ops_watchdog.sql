-- CRYPTO LAB production watchdog — applied 2026-08-14.
create or replace function private.set_crypto_watchdog_incident(p_fingerprint text,p_source_name text,p_bad boolean,p_severity text,p_error text)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
 if p_bad then
  insert into public.crypto_operational_incidents(fingerprint,source_type,source_name,status,severity,first_seen_at,last_seen_at,occurrences,last_error,created_at,updated_at)
  values(p_fingerprint,'cron',p_source_name,'open',p_severity,now(),now(),1,left(p_error,2000),now(),now())
  on conflict(fingerprint) do update set status='open',severity=excluded.severity,last_seen_at=now(),occurrences=public.crypto_operational_incidents.occurrences+1,last_error=excluded.last_error,resolved_at=null,resolution_note=null,updated_at=now();
 else
  update public.crypto_operational_incidents set status='resolved',resolved_at=coalesce(resolved_at,now()),resolution_note='Automatic health recovery',updated_at=now() where fingerprint=p_fingerprint and status='open';
 end if;
end $$;
revoke all on function private.set_crypto_watchdog_incident(text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function private.set_crypto_watchdog_incident(text,text,boolean,text,text) to service_role;

create or replace function private.run_crypto_ops_watchdog()
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_scanner timestamptz;v_news_run timestamptz;v_news_status text;v_shadow timestamptz;v_pending integer;v_failed integer;v_open integer;
begin
 select max(finished_at) into v_scanner from public.crypto_scanner_runs where success=true;
 select last_finished_at,status into v_news_run,v_news_status from public.crypto_market_news_state where singleton=true limit 1;
 select max(processed_at) into v_shadow from public.crypto_operational_http_requests where source_name='crypto-shadow-signal-monitor' and success=true;
 select count(*) into v_pending from public.crypto_signal_notification_outbox where status in('pending','failed') and available_at<now()-interval '10 minutes';
 select count(*) into v_failed from public.crypto_operational_http_requests where requested_at>now()-interval '15 minutes' and processed_at is not null and coalesce(success,false)=false;
 perform private.set_crypto_watchdog_incident('watchdog:scanner-stale','crypto-market-scanner',v_scanner is null or v_scanner<now()-interval '30 minutes','high',format('Scanner last success: %s',coalesce(v_scanner::text,'never')));
 perform private.set_crypto_watchdog_incident('watchdog:news-stale','crypto-market-news',v_news_run is null or v_news_run<now()-interval '20 minutes' or coalesce(v_news_status,'')<>'ok','high',format('News collector last run: %s, status=%s',coalesce(v_news_run::text,'never'),coalesce(v_news_status,'unknown')));
 perform private.set_crypto_watchdog_incident('watchdog:shadow-monitor-stale','crypto-shadow-signal-monitor',v_shadow is null or v_shadow<now()-interval '10 minutes','medium',format('SHADOW monitor last success: %s',coalesce(v_shadow::text,'never')));
 perform private.set_crypto_watchdog_incident('watchdog:telegram-queue-stale','crypto-signal-monitor',v_pending>0,'high',format('Stale Telegram notifications: %s',v_pending));
 perform private.set_crypto_watchdog_incident('watchdog:edge-http-failures','crypto-operational-http',v_failed>=3,'high',format('Operational HTTP failures in 15m: %s',v_failed));
 select count(*) into v_open from public.crypto_operational_incidents where status='open';
 return jsonb_build_object('ok',true,'checked_at',now(),'scanner_last',v_scanner,'news_run_last',v_news_run,'news_status',v_news_status,'shadow_last',v_shadow,'stale_notifications',v_pending,'http_failures_15m',v_failed,'open_incidents',v_open);
end $$;
revoke all on function private.run_crypto_ops_watchdog() from public,anon,authenticated;
grant execute on function private.run_crypto_ops_watchdog() to service_role;
-- Production cron: crypto-ops-watchdog-5m => */5 * * * *
