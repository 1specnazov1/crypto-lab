-- CRYPTO LAB v79 — exact forward SHADOW lifecycle for Scanner v15 candidates.
-- Applied to production 2026-08-14. LIVE Telegram remains independent and OFF by default.

create table if not exists public.crypto_shadow_signal_monitors (
  id uuid primary key default gen_random_uuid(),
  scanner_version integer not null default 15,
  symbol text not null,
  timeframe text not null,
  direction text not null,
  setup text,
  strength integer,
  entry_low numeric not null,
  entry_high numeric not null,
  initial_stop numeric not null,
  managed_stop numeric not null,
  tp1 numeric not null,
  tp2 numeric,
  tp3 numeric,
  status text not null default 'WAITING',
  management_stage text not null default 'ORIGINAL',
  tp1_reached boolean not null default false,
  tp2_reached boolean not null default false,
  tp3_reached boolean not null default false,
  entry_at timestamptz,
  tp1_at timestamptz,
  tp2_at timestamptz,
  tp3_at timestamptz,
  closed_at timestamptz,
  close_type text,
  last_price numeric,
  last_checked_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  news jsonb not null default '{}'::jsonb,
  source_run_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_shadow_signal_timeframe_chk check (timeframe in ('5M','1H','4H')),
  constraint crypto_shadow_signal_direction_chk check (direction in ('LONG','SHORT')),
  constraint crypto_shadow_signal_status_chk check (status in ('WAITING','ACTIVE','CLOSED')),
  constraint crypto_shadow_signal_stage_chk check (management_stage in ('ORIGINAL','BREAKEVEN','PROTECTED_TP1','CLOSED')),
  constraint crypto_shadow_signal_close_chk check (close_type is null or close_type in ('TP3','STOP','BREAKEVEN','PROTECTED_TP1','EXPIRED'))
);

create index if not exists crypto_shadow_signal_open_idx on public.crypto_shadow_signal_monitors(status,timeframe,direction,created_at desc);
create index if not exists crypto_shadow_signal_symbol_idx on public.crypto_shadow_signal_monitors(symbol,timeframe,direction,created_at desc);
create index if not exists crypto_shadow_signal_closed_idx on public.crypto_shadow_signal_monitors(closed_at desc) where status='CLOSED';
create unique index if not exists crypto_shadow_signal_source_unique on public.crypto_shadow_signal_monitors(source_run_id,symbol,timeframe,direction) where source_run_id is not null;

alter table public.crypto_shadow_signal_monitors enable row level security;
revoke all on public.crypto_shadow_signal_monitors from public,anon,authenticated;
grant select,insert,update,delete on public.crypto_shadow_signal_monitors to service_role;

create or replace function public.get_crypto_shadow_quality_admin(p_hours integer default 168)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_hours integer:=greatest(1,least(coalesce(p_hours,168),24*365));v_result jsonb;
begin
  if not public.crypto_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  with raw as (
    select *, (entry_low+entry_high)/2.0 entry_mid, abs(((entry_low+entry_high)/2.0)-initial_stop) initial_risk
    from public.crypto_shadow_signal_monitors where created_at>=now()-make_interval(hours=>v_hours)
  ), base as (
    select *,case when close_type='TP3' and initial_risk>0 then abs(tp3-entry_mid)/initial_risk when close_type='PROTECTED_TP1' and initial_risk>0 then abs(tp1-entry_mid)/initial_risk when close_type='BREAKEVEN' then 0.0 when close_type='STOP' then -1.0 else null end r_value from raw
  ), buckets as (
    select timeframe,direction,count(*)::int signals,count(*) filter(where entry_at is not null)::int entered,count(*) filter(where tp1_reached)::int tp1,count(*) filter(where tp2_reached)::int tp2,count(*) filter(where tp3_reached)::int tp3,count(*) filter(where close_type='BREAKEVEN')::int breakeven,count(*) filter(where close_type='PROTECTED_TP1')::int protected_profit,count(*) filter(where close_type='STOP')::int stops,count(*) filter(where close_type='EXPIRED')::int expired,count(*) filter(where status='CLOSED')::int closed,round(100.0*count(*) filter(where close_type in('TP3','PROTECTED_TP1'))/nullif(count(*) filter(where close_type in('TP3','PROTECTED_TP1','BREAKEVEN','STOP')),0),2) win_rate,round(avg(r_value)::numeric,4) avg_r,round((sum(greatest(r_value,0))/nullif(abs(sum(least(r_value,0))),0))::numeric,4) profit_factor from base group by timeframe,direction
  ), ordered as (
    select id,coalesce(closed_at,created_at) event_time,r_value,sum(coalesce(r_value,0)) over(order by coalesce(closed_at,created_at),id) equity_r from base where status='CLOSED' and r_value is not null
  ), dd as (
    select max(peak_r-equity_r) max_drawdown_r from (select equity_r,max(equity_r) over(order by event_time,id rows between unbounded preceding and current row) peak_r from ordered) q
  )
  select jsonb_build_object('hours',v_hours,'generated_at',now(),'buckets',coalesce((select jsonb_agg(to_jsonb(buckets) order by case timeframe when '5M' then 1 when '1H' then 2 else 3 end,direction) from buckets),'[]'::jsonb),'max_drawdown_r',coalesce((select round(max_drawdown_r::numeric,4) from dd),0),'totals',jsonb_build_object('signals',(select count(*) from base),'entered',(select count(*) from base where entry_at is not null),'closed',(select count(*) from base where status='CLOSED'),'open',(select count(*) from base where status<>'CLOSED'),'tp1',(select count(*) from base where tp1_reached),'tp2',(select count(*) from base where tp2_reached),'tp3',(select count(*) from base where tp3_reached),'breakeven',(select count(*) from base where close_type='BREAKEVEN'),'protected_profit',(select count(*) from base where close_type='PROTECTED_TP1'),'stops',(select count(*) from base where close_type='STOP'),'expired',(select count(*) from base where close_type='EXPIRED'),'avg_r',(select round(avg(r_value)::numeric,4) from base where r_value is not null),'profit_factor',(select round((sum(greatest(r_value,0))/nullif(abs(sum(least(r_value,0))),0))::numeric,4) from base where r_value is not null))) into v_result;
  return v_result;
end $$;
revoke all on function public.get_crypto_shadow_quality_admin(integer) from public,anon;
grant execute on function public.get_crypto_shadow_quality_admin(integer) to authenticated,service_role;

-- Dispatcher support for the minute-by-minute SHADOW monitor.
alter table public.crypto_operational_http_requests drop constraint if exists crypto_operational_http_requests_source_name_check;
alter table public.crypto_operational_http_requests add constraint crypto_operational_http_requests_source_name_check check(source_name in('crypto-signal-monitor','crypto-market-scanner','crypto-shadow-signal-monitor'));

create or replace function private.track_crypto_operational_http_request(p_source_name text,p_request_id bigint)
returns bigint language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_existing_source text;
begin
 if p_source_name not in('crypto-signal-monitor','crypto-market-scanner','crypto-shadow-signal-monitor') then raise exception 'Unsupported operational source' using errcode='22023';end if;
 if p_request_id is null then raise exception 'Request id is required' using errcode='22023';end if;
 insert into public.crypto_operational_http_requests(request_id,source_name) values(p_request_id,p_source_name) on conflict(request_id) do nothing;
 select source_name into v_existing_source from public.crypto_operational_http_requests where request_id=p_request_id for update;
 if v_existing_source is null then raise exception 'Operational request tracking failed' using errcode='55000';end if;
 if v_existing_source<>p_source_name then raise exception 'Operational request id is already tracked for a different source' using errcode='23514';end if;
 return p_request_id;
end $$;

create or replace function private.dispatch_crypto_operational_edge(p_source_name text)
returns jsonb language plpgsql security definer set search_path=public,private,vault,net,pg_temp as $$
declare v_pending_source bigint;v_pending_total bigint;v_retained_total bigint;v_source_limit integer;v_secret text;v_request_id bigint;v_url text;v_body jsonb;v_timeout integer;
begin
 if p_source_name not in('crypto-signal-monitor','crypto-market-scanner','crypto-shadow-signal-monitor') then raise exception 'Unsupported operational source' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtext('crypto_operational_dispatch:'||p_source_name));
 select count(*) filter(where processed_at is null and source_name=p_source_name),count(*) filter(where processed_at is null),count(*) into v_pending_source,v_pending_total,v_retained_total from public.crypto_operational_http_requests;
 v_source_limit:=case when p_source_name in('crypto-signal-monitor','crypto-shadow-signal-monitor') then 300 else 50 end;
 if v_pending_source>=v_source_limit or v_pending_total>=500 or v_retained_total>=100000 then return jsonb_build_object('success',false,'skipped',true,'reason','capacity_guard','source',p_source_name);end if;
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='MONITOR_SECRET' order by updated_at desc,created_at desc limit 1;
 if nullif(v_secret,'') is null then raise exception 'MONITOR_SECRET is unavailable' using errcode='55000';end if;
 if p_source_name='crypto-signal-monitor' then v_url:='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-signal-monitor';v_body:='{}'::jsonb;v_timeout:=15000;
 elsif p_source_name='crypto-shadow-signal-monitor' then v_url:='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-shadow-signal-monitor';v_body:='{}'::jsonb;v_timeout:=15000;
 else v_url:='https://txhzxbizjpinowepfjkm.supabase.co/functions/v1/crypto-market-scanner';v_body:=jsonb_build_object('dry_run',true,'limit',20,'timeframes',jsonb_build_array('5M','1H','4H'));v_timeout:=120000;end if;
 v_request_id:=net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','x-monitor-secret',v_secret),body:=v_body,timeout_milliseconds:=v_timeout);
 perform private.track_crypto_operational_http_request(p_source_name,v_request_id);
 return jsonb_build_object('success',true,'skipped',false,'source',p_source_name,'request_id',v_request_id,'shadow_mode',p_source_name<>'crypto-signal-monitor');
end $$;

-- Production job is named crypto-shadow-signal-monitor-every-minute and runs every minute.
