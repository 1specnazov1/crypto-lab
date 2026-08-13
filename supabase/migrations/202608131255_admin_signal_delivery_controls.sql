-- CRYPTO LAB v79 — protected admin control plane for signal delivery.
-- Production applied 2026-08-13.

create table if not exists private.crypto_signal_delivery_settings (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'SHADOW' check (mode in ('SHADOW','LIVE')),
  updated_at timestamptz not null default now(),
  updated_by uuid null
);
insert into private.crypto_signal_delivery_settings(singleton,mode)
values (true,'SHADOW') on conflict (singleton) do nothing;
revoke all on private.crypto_signal_delivery_settings from public,anon,authenticated;

create or replace function public.get_crypto_signal_delivery_admin()
returns jsonb language plpgsql stable security definer
set search_path=public,private,cron,vault,pg_temp
as $$
declare
  v_mode text:='SHADOW'; v_updated_at timestamptz;
  v_scanner_active boolean:=false; v_monitor_active boolean:=false;
  v_open integer:=0; v_waiting integer:=0; v_active integer:=0; v_pending integer:=0;
  v_last jsonb:='{}'::jsonb; v_secret boolean:=false; v_historical_delivery boolean:=false;
begin
  if not public.crypto_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select mode,updated_at into v_mode,v_updated_at from private.crypto_signal_delivery_settings where singleton=true;
  select coalesce(active,false) into v_scanner_active from cron.job where jobname='crypto-market-scanner-every-15-minutes' limit 1;
  select coalesce(active,false) into v_monitor_active from cron.job where jobname='crypto-signal-monitor-every-minute' limit 1;
  select count(*) filter(where status='WAITING'),count(*) filter(where status='ACTIVE'),count(*) filter(where status in ('WAITING','ACTIVE')) into v_waiting,v_active,v_open from public.crypto_signal_monitors;
  select count(*) into v_pending from public.crypto_signal_notification_outbox where status in ('pending','failed');
  select jsonb_build_object('id',id,'finished_at',finished_at,'success',success,'dry_run',dry_run,'symbols_checked',symbols_checked,'timeframes',timeframes,'class_a_found',class_a_found,'registered',registered,'telegram_sent',telegram_sent,'scanner_version',scanner_version,'duration_ms',duration_ms) into v_last from public.crypto_scanner_runs order by id desc limit 1;
  select exists(select 1 from vault.decrypted_secrets where name='MONITOR_SECRET' and nullif(decrypted_secret,'') is not null) into v_secret;
  select exists(select 1 from public.crypto_scanner_runs where telegram_sent>0 and finished_at>now()-interval '30 days') into v_historical_delivery;
  return jsonb_build_object(
    'mode',coalesce(v_mode,'SHADOW'),'updated_at',v_updated_at,
    'scanner_active',coalesce(v_scanner_active,false),'monitor_active',coalesce(v_monitor_active,false),
    'telegram_auto',coalesce(v_mode,'SHADOW')='LIVE','open_signals',coalesce(v_open,0),
    'waiting_signals',coalesce(v_waiting,0),'active_signals',coalesce(v_active,0),
    'pending_notifications',coalesce(v_pending,0),'monitor_secret_configured',v_secret,
    'telegram_runtime_secrets','EDGE_RUNTIME','historical_telegram_delivery',v_historical_delivery,
    'last_run',coalesce(v_last,'{}'::jsonb),'timeframes',jsonb_build_array('5M','1H','4H'),
    'quality_gate','1H/4H SHORT disabled; v15 shadow evidence required before broad live rollout',
    'management','TP1 -> breakeven; TP2 -> TP1'
  );
end;$$;

create or replace function public.set_crypto_signal_delivery_admin(p_mode text,p_ack text default null)
returns jsonb language plpgsql security definer
set search_path=public,private,cron,vault,pg_temp
as $$
declare
  v_mode text:=upper(trim(coalesce(p_mode,''))); v_scanner_job bigint; v_monitor_job bigint;
  v_open integer:=0; v_monitor_secret boolean:=false;
begin
  if not public.crypto_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if v_mode not in ('SHADOW','LIVE') then raise exception 'Unsupported signal delivery mode' using errcode='22023'; end if;
  if v_mode='LIVE' and coalesce(p_ack,'')<>'ENABLE_LIVE_TELEGRAM' then raise exception 'Live Telegram confirmation required' using errcode='22023'; end if;
  if v_mode='LIVE' then
    select exists(select 1 from vault.decrypted_secrets where name='MONITOR_SECRET' and nullif(decrypted_secret,'') is not null) into v_monitor_secret;
    if not v_monitor_secret then raise exception 'MONITOR_SECRET is unavailable' using errcode='55000'; end if;
  end if;
  update private.crypto_signal_delivery_settings set mode=v_mode,updated_at=now(),updated_by=auth.uid() where singleton=true;
  select jobid into v_scanner_job from cron.job where jobname='crypto-market-scanner-every-15-minutes' limit 1;
  select jobid into v_monitor_job from cron.job where jobname='crypto-signal-monitor-every-minute' limit 1;
  if v_scanner_job is not null then perform cron.alter_job(v_scanner_job,active:=true); end if;
  select count(*) into v_open from public.crypto_signal_monitors where status in ('WAITING','ACTIVE');
  if v_monitor_job is not null then perform cron.alter_job(v_monitor_job,active:=(v_mode='LIVE' or v_open>0)); end if;
  return public.get_crypto_signal_delivery_admin();
end;$$;

revoke all on function public.get_crypto_signal_delivery_admin() from public,anon;
grant execute on function public.get_crypto_signal_delivery_admin() to authenticated,service_role;
revoke all on function public.set_crypto_signal_delivery_admin(text,text) from public,anon;
grant execute on function public.set_crypto_signal_delivery_admin(text,text) to authenticated,service_role;

create or replace function private.dispatch_crypto_operational_edge(p_source_name text)
returns jsonb language plpgsql security definer
set search_path=public,private,vault,net,pg_temp
as $$
declare
  v_pending_source bigint;v_pending_total bigint;v_retained_total bigint;v_source_limit integer;
  v_secret text;v_request_id bigint;v_url text;v_body jsonb;v_timeout integer;
  v_mode text:='SHADOW';v_open integer:=0;
begin
  if p_source_name not in('crypto-signal-monitor','crypto-market-scanner') then raise exception 'Unsupported operational source' using errcode='22023'; end if;
  select mode into v_mode from private.crypto_signal_delivery_settings where singleton=true; v_mode:=coalesce(v_mode,'SHADOW');
  if p_source_name='crypto-signal-monitor' and v_mode<>'LIVE' then
    select count(*) into v_open from public.crypto_signal_monitors where status in ('WAITING','ACTIVE');
    if v_open=0 then return jsonb_build_object('success',true,'skipped',true,'reason','shadow_mode_no_open_signals','source',p_source_name,'mode',v_mode); end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('crypto_operational_dispatch:'||p_source_name));
  select count(*) filter(where processed_at is null and source_name=p_source_name),count(*) filter(where processed_at is null),count(*) into v_pending_source,v_pending_total,v_retained_total from public.crypto_operational_http_requests;
  v_source_limit:=case when p_source_name='crypto-signal-monitor' then 300 else 50 end;
  if v_pending_source>=v_source_limit or v_pending_total>=500 or v_retained_total>=100000 then return jsonb_build_object('success',false,'skipped',true,'reason','capacity_guard','source',p_source_name,'mode',v_mode); end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='MONITOR_SECRET' order by updated_at desc,created_at desc limit 1;
  if nullif(v_secret,'') is null then raise exception 'MONITOR_SECRET is unavailable' using errcode='55000'; end if;
  if p_source_name='crypto-signal-monitor' then
    v_url:='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-signal-monitor';v_body:='{}'::jsonb;v_timeout:=15000;
  else
    v_url:='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-market-scanner';
    v_body:=jsonb_build_object('dry_run',v_mode<>'LIVE','limit',20,'timeframes',jsonb_build_array('5M','1H','4H'));v_timeout:=120000;
  end if;
  v_request_id:=net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','x-monitor-secret',v_secret),body:=v_body,timeout_milliseconds:=v_timeout);
  perform private.track_crypto_operational_http_request(p_source_name,v_request_id);
  return jsonb_build_object('success',true,'skipped',false,'source',p_source_name,'request_id',v_request_id,'mode',v_mode,'shadow_mode',p_source_name='crypto-market-scanner' and v_mode<>'LIVE');
end;$$;
