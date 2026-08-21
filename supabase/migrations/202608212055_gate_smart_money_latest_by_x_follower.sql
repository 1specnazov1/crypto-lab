create or replace function public.get_crypto_smart_money_latest(p_symbol text, p_timeframe text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    if auth.uid() is null then
      raise exception 'authentication required' using errcode='42501';
    end if;
    if not public.crypto_launch_access_for_user(auth.uid()) then
      raise exception 'X follower access required' using errcode='42501';
    end if;
  end if;

  return coalesce((select to_jsonb(x) from (
    select symbol,timeframe,captured_at,source,mark_price,price_change_pct,
           whale_threshold_usd,whale_buy_usd,whale_sell_usd,whale_delta_usd,whale_pressure,
           cvd_usd,cvd_pressure,taker_buy_sell_ratio,open_interest_usd,open_interest_change_pct,
           funding_rate,orderbook_imbalance,top_position_ratio,top_account_ratio,
           smart_score,smart_direction,data_quality
    from public.crypto_smart_money_snapshots
    where symbol=upper(regexp_replace(coalesce(p_symbol,''),'USDT$','','i'))
      and (p_timeframe is null or timeframe=upper(p_timeframe))
    order by captured_at desc
    limit 1
  ) x),'{}'::jsonb);
end;
$$;

revoke all on function public.get_crypto_smart_money_latest(text,text) from public, anon;
grant execute on function public.get_crypto_smart_money_latest(text,text) to authenticated, service_role;
