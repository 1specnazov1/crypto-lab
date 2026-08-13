-- CRYPTO LAB v79 — signal quality gate
-- Applied to production on 2026-08-13.
-- Historical evidence for 1H SHORT and 4H SHORT is insufficient for public/live delivery.
-- Shadow analysis may continue, but registration and Telegram publication are fail-closed.

create or replace function public.register_crypto_signal(
  p_symbol text,
  p_timeframe text,
  p_direction text,
  p_strength integer,
  p_entry_low numeric,
  p_entry_high numeric,
  p_stop numeric,
  p_tp1 numeric,
  p_tp2 numeric default null,
  p_tp3 numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  existing_id uuid;
  new_id uuid;
  clean_symbol text := upper(trim(p_symbol));
  clean_timeframe text := upper(trim(p_timeframe));
  clean_direction text := upper(trim(p_direction));
begin
  if clean_symbol !~ '^[A-Z0-9]{2,20}$' then raise exception 'Некорректная монета'; end if;
  if clean_timeframe not in ('5M','1H','4H','1D','1W','1MO','MULTI') then raise exception 'Некорректный таймфрейм'; end if;
  if clean_direction not in ('LONG','SHORT') then raise exception 'Некорректное направление'; end if;
  if p_strength is not null and (p_strength < 0 or p_strength > 100) then raise exception 'Некорректная сила сигнала'; end if;
  if least(p_entry_low,p_entry_high,p_stop,p_tp1) <= 0 then raise exception 'Уровни должны быть больше нуля'; end if;

  if clean_direction='SHORT' and clean_timeframe in ('1H','4H') then
    return jsonb_build_object(
      'success',true,
      'inserted',false,
      'blocked',true,
      'reason','QUALITY_GATE_SHORT_DISABLED',
      'timeframe',clean_timeframe,
      'direction',clean_direction
    );
  end if;

  select id into existing_id
  from public.crypto_signal_monitors
  where symbol=clean_symbol and timeframe=clean_timeframe and direction=clean_direction
    and status in ('WAITING','ACTIVE') and created_at > now()-interval '4 hours'
  order by created_at desc limit 1;

  if existing_id is not null then
    return jsonb_build_object('success',true,'inserted',false,'id',existing_id);
  end if;

  insert into public.crypto_signal_monitors(
    symbol,timeframe,direction,strength,entry_low,entry_high,stop,initial_stop,managed_stop,
    management_stage,tp1,tp2,tp3,status
  ) values (
    clean_symbol,clean_timeframe,clean_direction,p_strength,
    least(p_entry_low,p_entry_high),greatest(p_entry_low,p_entry_high),p_stop,p_stop,p_stop,
    'ORIGINAL',p_tp1,p_tp2,p_tp3,'WAITING'
  ) returning id into new_id;

  return jsonb_build_object('success',true,'inserted',true,'id',new_id);
end;
$function$;
