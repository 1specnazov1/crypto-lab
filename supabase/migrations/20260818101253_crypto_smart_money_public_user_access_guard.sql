-- CRYPTO LAB v79 — authenticated SMART MONEY read surface
-- Production migration applied 2026-08-18.

create or replace function public.get_crypto_smart_money_latest(p_symbol text, p_timeframe text default '5M')
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.crypto_smart_money_snapshots%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_row
  from public.crypto_smart_money_snapshots
  where symbol=upper(trim(p_symbol))
    and timeframe=upper(trim(p_timeframe))
  order by captured_at desc
  limit 1;

  if not found then return jsonb_build_object('found',false); end if;

  return jsonb_build_object(
    'found',true,
    'captured_at',v_row.captured_at,
    'symbol',v_row.symbol,
    'timeframe',v_row.timeframe,
    'mark_price',v_row.mark_price,
    'price_change_pct',v_row.price_change_pct,
    'whale_threshold_usd',v_row.whale_threshold_usd,
    'whale_buy_usd',v_row.whale_buy_usd,
    'whale_sell_usd',v_row.whale_sell_usd,
    'whale_delta_usd',v_row.whale_delta_usd,
    'whale_pressure',v_row.whale_pressure,
    'cvd_usd',v_row.cvd_usd,
    'cvd_pressure',v_row.cvd_pressure,
    'taker_buy_sell_ratio',v_row.taker_buy_sell_ratio,
    'open_interest_usd',v_row.open_interest_usd,
    'open_interest_change_pct',v_row.open_interest_change_pct,
    'funding_rate',v_row.funding_rate,
    'orderbook_imbalance',v_row.orderbook_imbalance,
    'top_position_ratio',v_row.top_position_ratio,
    'top_account_ratio',v_row.top_account_ratio,
    'smart_score',v_row.smart_score,
    'smart_direction',v_row.smart_direction,
    'data_quality',v_row.data_quality,
    'metadata',v_row.metadata
  );
end
$function$;

revoke all on function public.get_crypto_smart_money_latest(text,text) from public,anon;
grant execute on function public.get_crypto_smart_money_latest(text,text) to authenticated,service_role;
