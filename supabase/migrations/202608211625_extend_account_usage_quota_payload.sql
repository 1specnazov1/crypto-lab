create or replace function private.get_my_crypto_account()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_plan text;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  v_plan := public.crypto_effective_plan(v_user);
  select jsonb_build_object(
    'profile',to_jsonb(p),
    'subscription',to_jsonb(s),
    'effective_plan',v_plan,
    'limits',to_jsonb(l),
    'usage_today',coalesce(to_jsonb(u),jsonb_build_object(
      'usage_date',current_date,
      'ai_requests',0,
      'backtests',0,
      'exact_backtests',0,
      'chart_views',0,
      'scanner_views',0
    )),
    'counts',jsonb_build_object(
      'portfolio_assets',(select count(*) from public.crypto_user_portfolio where user_id=v_user),
      'favorites',(select count(*) from public.crypto_user_favorites where user_id=v_user)
    )
  ) into v_result
  from public.crypto_user_profiles p
  left join public.crypto_subscriptions s on s.user_id=p.user_id
  join public.crypto_plan_limits l on l.plan=v_plan
  left join public.crypto_user_usage_daily u on u.user_id=p.user_id and u.usage_date=current_date
  where p.user_id=v_user;
  if v_result is null then
    insert into public.crypto_user_profiles(user_id) values(v_user) on conflict do nothing;
    insert into public.crypto_subscriptions(user_id) values(v_user) on conflict do nothing;
    return public.get_my_crypto_account();
  end if;
  return v_result;
end;$$;
