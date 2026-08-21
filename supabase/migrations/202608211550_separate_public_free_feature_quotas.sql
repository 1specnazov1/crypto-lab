alter table public.crypto_plan_limits
  add column if not exists daily_chart_views integer not null default -1 check (daily_chart_views >= -1),
  add column if not exists daily_exact_backtests integer not null default -1 check (daily_exact_backtests >= -1);

alter table public.crypto_user_usage_daily
  add column if not exists chart_views integer not null default 0 check (chart_views >= 0),
  add column if not exists exact_backtests integer not null default 0 check (exact_backtests >= 0);

alter table public.crypto_feature_rate_events
  drop constraint if exists crypto_feature_rate_events_feature_check;
alter table public.crypto_feature_rate_events
  add constraint crypto_feature_rate_events_feature_check
  check (feature = any (array['ai'::text,'backtest'::text,'scanner'::text,'chart'::text,'exact_backtest'::text,'smart_money'::text,'onchain'::text]));

update public.crypto_plan_limits
set daily_ai_requests = case when plan='FREE' then 5 else daily_ai_requests end,
    daily_scanner_views = -1,
    daily_chart_views = case when plan='FREE' then 100 else daily_chart_views end,
    daily_exact_backtests = case when plan='FREE' then 25 else daily_exact_backtests end,
    updated_at = now();

create or replace function private.get_crypto_feature_status(p_feature text)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp'
as $$
declare v_user uuid:=auth.uid(); v_plan text; v_limit integer; v_used integer:=0; v_remaining integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_feature not in ('ai','backtest','scanner','chart','exact_backtest') then raise exception 'Unknown feature'; end if;
  v_plan:=public.crypto_effective_plan(v_user);
  select case p_feature when 'ai' then daily_ai_requests when 'backtest' then daily_backtests when 'scanner' then daily_scanner_views when 'chart' then daily_chart_views when 'exact_backtest' then daily_exact_backtests end into v_limit from public.crypto_plan_limits where plan=v_plan;
  select coalesce(case p_feature when 'ai' then ai_requests when 'backtest' then backtests when 'scanner' then scanner_views when 'chart' then chart_views when 'exact_backtest' then exact_backtests end,0) into v_used from public.crypto_user_usage_daily where user_id=v_user and usage_date=current_date;
  v_used:=coalesce(v_used,0); v_remaining:=case when v_limit<0 then null else greatest(v_limit-v_used,0) end;
  return jsonb_build_object('feature',p_feature,'plan',v_plan,'limit',v_limit,'used',v_used,'remaining',v_remaining,'allowed',v_limit<0 or v_used<v_limit);
end;$$;

create or replace function private.consume_crypto_feature(p_feature text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$
declare v_user uuid:=auth.uid(); v_plan text; v_limit integer; v_used integer; v_remaining integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_feature not in ('ai','backtest','scanner','chart','exact_backtest') then raise exception 'Unknown feature'; end if;
  insert into public.crypto_user_profiles(user_id) values(v_user) on conflict do nothing;
  insert into public.crypto_subscriptions(user_id) values(v_user) on conflict do nothing;
  insert into public.crypto_user_usage_daily(user_id,usage_date) values(v_user,current_date) on conflict(user_id,usage_date) do nothing;
  v_plan:=public.crypto_effective_plan(v_user);
  select case p_feature when 'ai' then daily_ai_requests when 'backtest' then daily_backtests when 'scanner' then daily_scanner_views when 'chart' then daily_chart_views when 'exact_backtest' then daily_exact_backtests end into v_limit from public.crypto_plan_limits where plan=v_plan;
  select case p_feature when 'ai' then ai_requests when 'backtest' then backtests when 'scanner' then scanner_views when 'chart' then chart_views when 'exact_backtest' then exact_backtests end into v_used from public.crypto_user_usage_daily where user_id=v_user and usage_date=current_date for update;
  if v_limit>=0 and v_used>=v_limit then return jsonb_build_object('allowed',false,'feature',p_feature,'plan',v_plan,'limit',v_limit,'used',v_used,'remaining',0); end if;
  update public.crypto_user_usage_daily set ai_requests=ai_requests+case when p_feature='ai' then 1 else 0 end,backtests=backtests+case when p_feature='backtest' then 1 else 0 end,scanner_views=scanner_views+case when p_feature='scanner' then 1 else 0 end,chart_views=chart_views+case when p_feature='chart' then 1 else 0 end,exact_backtests=exact_backtests+case when p_feature='exact_backtest' then 1 else 0 end,updated_at=now() where user_id=v_user and usage_date=current_date;
  v_remaining:=case when v_limit<0 then null else greatest(v_limit-v_used-1,0) end;
  return jsonb_build_object('allowed',true,'feature',p_feature,'plan',v_plan,'limit',v_limit,'used',v_used+1,'remaining',v_remaining);
end;$$;

create or replace function public.refund_crypto_feature_for_user(p_user_id uuid,p_feature text,p_usage_date date default current_date)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$
declare v_ai integer; v_backtests integer; v_scanner integer; v_chart integer; v_exact integer;
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  if p_feature not in ('ai','backtest','scanner','chart','exact_backtest') then raise exception 'Unknown feature'; end if;
  if p_usage_date<current_date-2 or p_usage_date>current_date then raise exception 'Invalid usage date'; end if;
  update public.crypto_user_usage_daily set ai_requests=greatest(ai_requests-case when p_feature='ai' then 1 else 0 end,0),backtests=greatest(backtests-case when p_feature='backtest' then 1 else 0 end,0),scanner_views=greatest(scanner_views-case when p_feature='scanner' then 1 else 0 end,0),chart_views=greatest(chart_views-case when p_feature='chart' then 1 else 0 end,0),exact_backtests=greatest(exact_backtests-case when p_feature='exact_backtest' then 1 else 0 end,0),updated_at=now() where user_id=p_user_id and usage_date=p_usage_date returning ai_requests,backtests,scanner_views,chart_views,exact_backtests into v_ai,v_backtests,v_scanner,v_chart,v_exact;
  return jsonb_build_object('refunded',found,'feature',p_feature,'usage_date',p_usage_date,'ai_requests',v_ai,'backtests',v_backtests,'scanner_views',v_scanner,'chart_views',v_chart,'exact_backtests',v_exact);
end;$$;

create or replace function public.reserve_crypto_feature_rate(p_user_id uuid,p_feature text,p_limit integer,p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$
declare v_now timestamptz:=clock_timestamp(); v_window interval; v_count integer; v_oldest timestamptz; v_retry integer:=0;
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  if p_feature not in ('ai','backtest','scanner','chart','exact_backtest','smart_money','onchain') then raise exception 'Unknown feature'; end if;
  if p_limit<1 or p_limit>120 then raise exception 'Invalid rate limit'; end if;
  if p_window_seconds<10 or p_window_seconds>3600 then raise exception 'Invalid rate window'; end if;
  v_window:=make_interval(secs=>p_window_seconds); perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_feature,79017));
  select count(*),min(created_at) into v_count,v_oldest from public.crypto_feature_rate_events where user_id=p_user_id and feature=p_feature and created_at>v_now-v_window;
  if v_count>=p_limit then v_retry:=greatest(1,ceil(extract(epoch from ((v_oldest+v_window)-v_now)))::integer); return jsonb_build_object('allowed',false,'feature',p_feature,'limit',p_limit,'window_seconds',p_window_seconds,'used',v_count,'remaining',0,'retry_after_seconds',v_retry); end if;
  insert into public.crypto_feature_rate_events(user_id,feature,created_at) values(p_user_id,p_feature,v_now);
  return jsonb_build_object('allowed',true,'feature',p_feature,'limit',p_limit,'window_seconds',p_window_seconds,'used',v_count+1,'remaining',greatest(p_limit-v_count-1,0),'retry_after_seconds',0);
end;$$;
