-- CRYPTO LAB v79 — unify SHADOW lifecycle on public.crypto_shadow_signals.
-- Production applied on 2026-08-14.

comment on table public.crypto_shadow_signal_monitors is
  'DEPRECATED: legacy intermediate SHADOW table. Canonical lifecycle source is public.crypto_shadow_signals.';
revoke all on table public.crypto_shadow_signal_monitors from anon, authenticated;

create index if not exists crypto_shadow_signals_lifecycle_idx
  on public.crypto_shadow_signals(status,created_at);
create index if not exists crypto_shadow_signals_symbol_check_idx
  on public.crypto_shadow_signals(symbol,last_checked_at)
  where status in ('WAITING','ACTIVE');

create or replace function public.get_crypto_shadow_quality_admin(p_hours integer default 168)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_hours integer:=greatest(1,least(coalesce(p_hours,168),24*365));
  v_result jsonb;
begin
  if not public.crypto_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;

  with base as (
    select id,timeframe,direction,status,close_type,realized_r,
      entry_at,tp1_at,tp2_at,tp3_at,closed_at,created_at
    from public.crypto_shadow_signals
    where created_at>=now()-make_interval(hours=>v_hours)
  ), agg as (
    select timeframe,direction,
      count(*)::int signals,
      count(*) filter(where entry_at is not null)::int entered,
      count(*) filter(where status='CLOSED')::int closed,
      count(*) filter(where tp1_at is not null)::int tp1,
      count(*) filter(where tp2_at is not null)::int tp2,
      count(*) filter(where tp3_at is not null)::int tp3,
      count(*) filter(where close_type='BREAKEVEN')::int breakeven,
      count(*) filter(where close_type='PROTECTED_TP1')::int protected_profit,
      count(*) filter(where close_type='STOP')::int stops,
      count(*) filter(where close_type='EXPIRED' or status='EXPIRED')::int expired,
      round(100.0*count(*) filter(where close_type in('TP3','PROTECTED_TP1'))/
        nullif(count(*) filter(where status='CLOSED' and close_type in('TP3','PROTECTED_TP1','BREAKEVEN','STOP')),0),2) win_rate,
      round(avg(realized_r) filter(where status='CLOSED' and realized_r is not null)::numeric,4) avg_r,
      round((sum(greatest(realized_r,0)) filter(where status='CLOSED' and realized_r is not null)/
        nullif(abs(sum(least(realized_r,0)) filter(where status='CLOSED' and realized_r is not null)),0))::numeric,4) profit_factor
    from base
    group by timeframe,direction
  ), buckets as (
    select *,
      (closed>=30 and coalesce(avg_r,0)>0 and coalesce(profit_factor,0)>=1.15) release_ready,
      case
        when closed<30 then format('need %s more closed',30-closed)
        when coalesce(avg_r,0)<=0 then 'expectancy <= 0'
        when coalesce(profit_factor,0)<1.15 then 'profit factor < 1.15'
        else 'ready'
      end release_reason
    from agg
  ), ordered as (
    select id,closed_at,realized_r,
      sum(realized_r) over(order by closed_at,id rows between unbounded preceding and current row) equity_r
    from base
    where status='CLOSED' and closed_at is not null and realized_r is not null
  ), drawdowns as (
    select max(peak_r-equity_r) max_drawdown_r
    from (
      select equity_r,max(equity_r) over(order by closed_at,id rows between unbounded preceding and current row) peak_r
      from ordered
    ) q
  )
  select jsonb_build_object(
    'hours',v_hours,
    'generated_at',now(),
    'source','crypto_shadow_signals',
    'criteria',jsonb_build_object('min_closed',30,'min_profit_factor',1.15,'positive_expectancy',true),
    'buckets',coalesce((select jsonb_agg(to_jsonb(buckets) order by case timeframe when '5M' then 1 when '1H' then 2 else 3 end,direction) from buckets),'[]'::jsonb),
    'max_drawdown_r',coalesce((select round(max_drawdown_r::numeric,4) from drawdowns),0),
    'totals',jsonb_build_object(
      'signals',(select count(*) from base),
      'entered',(select count(*) from base where entry_at is not null),
      'closed',(select count(*) from base where status='CLOSED'),
      'open',(select count(*) from base where status in('WAITING','ACTIVE')),
      'tp1',(select count(*) from base where tp1_at is not null),
      'tp2',(select count(*) from base where tp2_at is not null),
      'tp3',(select count(*) from base where tp3_at is not null),
      'breakeven',(select count(*) from base where close_type='BREAKEVEN'),
      'protected_profit',(select count(*) from base where close_type='PROTECTED_TP1'),
      'stops',(select count(*) from base where close_type='STOP'),
      'expired',(select count(*) from base where close_type='EXPIRED' or status='EXPIRED'),
      'avg_r',(select round(avg(realized_r)::numeric,4) from base where status='CLOSED' and realized_r is not null),
      'profit_factor',(select round((sum(greatest(realized_r,0))/nullif(abs(sum(least(realized_r,0))),0))::numeric,4) from base where status='CLOSED' and realized_r is not null)
    )
  ) into v_result;
  return v_result;
end;
$function$;

grant execute on function public.get_crypto_shadow_quality_admin(integer) to authenticated;
revoke all on function public.get_crypto_shadow_quality_admin(integer) from anon;
