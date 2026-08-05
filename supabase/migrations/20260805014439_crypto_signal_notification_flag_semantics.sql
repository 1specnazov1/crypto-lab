create or replace function public.service_apply_crypto_signal_monitor_batch(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_price numeric;
  v_signal public.crypto_signal_monitors%rowtype;
  v_previous numeric;
  v_event text;
  v_now timestamptz:=now();
  v_payload jsonb;
  v_outbox_id uuid;
  v_checked integer:=0;
  v_missing integer:=0;
  v_transitioned integer:=0;
  v_queued integer:=0;
begin
  if jsonb_typeof(p_updates) <> 'array' then raise exception 'updates must be an array'; end if;
  if jsonb_array_length(p_updates) > 100 then raise exception 'too many updates'; end if;

  for v_item in select value from jsonb_array_elements(p_updates) loop
    begin
      v_id := nullif(v_item->>'id','')::uuid;
      v_price := nullif(v_item->>'price','')::numeric;
    exception when others then
      continue;
    end;
    if v_id is null or v_price is null or v_price <= 0 then continue; end if;

    select * into v_signal from public.crypto_signal_monitors where id=v_id for update;
    if not found then v_missing:=v_missing+1; continue; end if;
    if v_signal.status not in ('WAITING','ACTIVE') then continue; end if;

    v_checked:=v_checked+1;
    v_previous:=v_signal.last_price;
    v_event:=null;

    if v_signal.status='WAITING' then
      if (v_price between least(v_signal.entry_low,v_signal.entry_high) and greatest(v_signal.entry_low,v_signal.entry_high))
         or (v_previous is not null and least(v_previous,v_price)<=greatest(v_signal.entry_low,v_signal.entry_high) and greatest(v_previous,v_price)>=least(v_signal.entry_low,v_signal.entry_high)) then
        v_event:='ENTRY';
        update public.crypto_signal_monitors set
          status='ACTIVE',entry_notified=true,activated_at=coalesce(activated_at,v_now),
          last_price=v_price,last_checked_at=v_now,updated_at=v_now
        where id=v_id;
      else
        update public.crypto_signal_monitors set last_price=v_price,last_checked_at=v_now,updated_at=v_now where id=v_id;
      end if;
    else
      if v_signal.stop is not null and not v_signal.stop_notified and
         ((v_signal.direction='LONG' and v_price<=v_signal.stop) or (v_signal.direction='SHORT' and v_price>=v_signal.stop)) then
        v_event:='STOP';
        update public.crypto_signal_monitors set
          status='CLOSED',stop_notified=true,closed_at=v_now,close_type='STOP',
          last_price=v_price,last_checked_at=v_now,updated_at=v_now
        where id=v_id;
      elsif v_signal.tp3 is not null and not v_signal.tp3_notified and
         ((v_signal.direction='LONG' and v_price>=v_signal.tp3) or (v_signal.direction='SHORT' and v_price<=v_signal.tp3)) then
        v_event:='TP3';
        update public.crypto_signal_monitors set
          status='CLOSED',tp3_notified=true,closed_at=v_now,close_type='TP3',
          last_price=v_price,last_checked_at=v_now,updated_at=v_now
        where id=v_id;
      elsif v_signal.tp2 is not null and not v_signal.tp2_notified and
         ((v_signal.direction='LONG' and v_price>=v_signal.tp2) or (v_signal.direction='SHORT' and v_price<=v_signal.tp2)) then
        v_event:='TP2';
        update public.crypto_signal_monitors set
          tp2_notified=true,last_price=v_price,last_checked_at=v_now,updated_at=v_now
        where id=v_id;
      elsif v_signal.tp1 is not null and not v_signal.tp1_notified and
         ((v_signal.direction='LONG' and v_price>=v_signal.tp1) or (v_signal.direction='SHORT' and v_price<=v_signal.tp1)) then
        v_event:='TP1';
        update public.crypto_signal_monitors set
          tp1_notified=true,last_price=v_price,last_checked_at=v_now,updated_at=v_now
        where id=v_id;
      else
        update public.crypto_signal_monitors set last_price=v_price,last_checked_at=v_now,updated_at=v_now where id=v_id;
      end if;
    end if;

    if v_event is not null then
      v_transitioned:=v_transitioned+1;
      v_payload:=jsonb_build_object(
        'signal_id',v_signal.id,'symbol',v_signal.symbol,'timeframe',v_signal.timeframe,'direction',v_signal.direction,
        'event_type',v_event,'price',v_price,'entry_low',v_signal.entry_low,'entry_high',v_signal.entry_high,
        'stop',v_signal.stop,'tp1',v_signal.tp1,'tp2',v_signal.tp2,'tp3',v_signal.tp3,
        'tp1_previously_reached',v_signal.tp1_notified,'tp2_previously_reached',v_signal.tp2_notified,
        'occurred_at',v_now
      );
      v_outbox_id:=null;
      insert into public.crypto_signal_notification_outbox(signal_id,event_type,payload)
      values(v_signal.id,v_event,v_payload)
      on conflict(signal_id,event_type) do nothing
      returning id into v_outbox_id;
      if v_outbox_id is not null then v_queued:=v_queued+1; end if;
    end if;
  end loop;

  return jsonb_build_object('success',true,'checked',v_checked,'missing',v_missing,'transitioned',v_transitioned,'queued',v_queued,'checked_at',v_now);
end;
$$;

revoke all on function public.service_apply_crypto_signal_monitor_batch(jsonb)
  from public,anon,authenticated;
grant execute on function public.service_apply_crypto_signal_monitor_batch(jsonb)
  to service_role;

update public.crypto_signal_monitors s
set tp2_notified=false,
    updated_at=clock_timestamp()
where s.id='b6dfcb7b-a6d3-47b6-9070-80afa301bd5e'::uuid
  and s.status='CLOSED'
  and s.close_type='TP3'
  and s.tp2_notified
  and not exists (
    select 1 from public.crypto_signal_notification_outbox o
    where o.signal_id=s.id and upper(o.event_type)='TP2' and o.status='sent'
  );
