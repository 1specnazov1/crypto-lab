create or replace function private.crypto_launch_access_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select case
    when exists(
      select 1 from public.crypto_user_profiles p
      where p.user_id=p_user_id and p.role='admin'
    ) then true
    else exists(
      select 1 from public.crypto_x_follower_access x
      where x.user_id=p_user_id
        and x.follows_target=true
        and x.revoked_at is null
        and x.verified_at is not null
        and x.verified_at >= now()-interval '7 days'
    )
  end
$$;

create or replace function public.crypto_launch_access_for_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path='public','private','pg_temp'
as $$ select private.crypto_launch_access_allowed(p_user_id) $$;
revoke all on function public.crypto_launch_access_for_user(uuid) from public,anon,authenticated;
grant execute on function public.crypto_launch_access_for_user(uuid) to service_role;

create or replace function private.get_crypto_feature_status(p_feature text)
returns jsonb
language plpgsql
stable
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_user uuid:=auth.uid();
  v_plan text;
  v_limit integer;
  v_used integer:=0;
  v_remaining integer;
  v_entitled boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_feature not in ('ai','backtest','scanner','chart','exact_backtest') then raise exception 'Unknown feature'; end if;
  v_entitled:=private.crypto_launch_access_allowed(v_user);
  v_plan:=public.crypto_effective_plan(v_user);
  select case p_feature
    when 'ai' then daily_ai_requests
    when 'backtest' then daily_backtests
    when 'scanner' then daily_scanner_views
    when 'chart' then daily_chart_views
    when 'exact_backtest' then daily_exact_backtests
  end into v_limit
  from public.crypto_plan_limits where plan=v_plan;
  select coalesce(case p_feature
    when 'ai' then ai_requests
    when 'backtest' then backtests
    when 'scanner' then scanner_views
    when 'chart' then chart_views
    when 'exact_backtest' then exact_backtests
  end,0) into v_used
  from public.crypto_user_usage_daily
  where user_id=v_user and usage_date=current_date;
  v_used:=coalesce(v_used,0);
  v_remaining:=case when v_limit<0 then null else greatest(v_limit-v_used,0) end;
  return jsonb_build_object(
    'feature',p_feature,'plan',v_plan,'limit',v_limit,'used',v_used,
    'remaining',v_remaining,
    'allowed',v_entitled and (v_limit<0 or v_used<v_limit),
    'entitled',v_entitled,
    'code',case
      when not v_entitled then 'X_FOLLOWER_REQUIRED'
      when v_limit>=0 and v_used>=v_limit then 'QUOTA_EXCEEDED'
      else 'OK'
    end
  );
end;
$$;

create or replace function private.consume_crypto_feature(p_feature text)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_user uuid:=auth.uid();
  v_plan text;
  v_limit integer;
  v_used integer;
  v_remaining integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_feature not in ('ai','backtest','scanner','chart','exact_backtest') then raise exception 'Unknown feature'; end if;
  insert into public.crypto_user_profiles(user_id) values(v_user) on conflict do nothing;
  insert into public.crypto_subscriptions(user_id) values(v_user) on conflict do nothing;
  if not private.crypto_launch_access_allowed(v_user) then
    return jsonb_build_object('allowed',false,'feature',p_feature,'entitled',false,'code','X_FOLLOWER_REQUIRED');
  end if;
  insert into public.crypto_user_usage_daily(user_id,usage_date)
  values(v_user,current_date) on conflict(user_id,usage_date) do nothing;
  v_plan:=public.crypto_effective_plan(v_user);
  select case p_feature
    when 'ai' then daily_ai_requests
    when 'backtest' then daily_backtests
    when 'scanner' then daily_scanner_views
    when 'chart' then daily_chart_views
    when 'exact_backtest' then daily_exact_backtests
  end into v_limit
  from public.crypto_plan_limits where plan=v_plan;
  select case p_feature
    when 'ai' then ai_requests
    when 'backtest' then backtests
    when 'scanner' then scanner_views
    when 'chart' then chart_views
    when 'exact_backtest' then exact_backtests
  end into v_used
  from public.crypto_user_usage_daily
  where user_id=v_user and usage_date=current_date for update;
  if v_limit>=0 and v_used>=v_limit then
    return jsonb_build_object('allowed',false,'feature',p_feature,'plan',v_plan,'limit',v_limit,'used',v_used,'remaining',0,'entitled',true,'code','QUOTA_EXCEEDED');
  end if;
  update public.crypto_user_usage_daily set
    ai_requests=ai_requests+case when p_feature='ai' then 1 else 0 end,
    backtests=backtests+case when p_feature='backtest' then 1 else 0 end,
    scanner_views=scanner_views+case when p_feature='scanner' then 1 else 0 end,
    chart_views=chart_views+case when p_feature='chart' then 1 else 0 end,
    exact_backtests=exact_backtests+case when p_feature='exact_backtest' then 1 else 0 end,
    updated_at=now()
  where user_id=v_user and usage_date=current_date;
  v_remaining:=case when v_limit<0 then null else greatest(v_limit-v_used-1,0) end;
  return jsonb_build_object('allowed',true,'feature',p_feature,'plan',v_plan,'limit',v_limit,'used',v_used+1,'remaining',v_remaining,'entitled',true,'code','OK');
end;
$$;
