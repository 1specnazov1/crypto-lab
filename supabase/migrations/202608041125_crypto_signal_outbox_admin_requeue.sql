create or replace function private.admin_requeue_crypto_signal_notification(
  p_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text;
  v_row public.crypto_signal_notification_outbox%rowtype;
  v_audit_id bigint;
  v_correlation uuid := gen_random_uuid();
begin
  if not public.crypto_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  if p_id is null then
    raise exception 'Notification id is required' using errcode='22023';
  end if;

  v_reason := trim(regexp_replace(coalesce(p_reason,''),'[\u0000-\u001f\u007f]+',' ','g'));
  if char_length(v_reason) < 5 then
    raise exception 'Requeue reason must contain at least 5 characters' using errcode='22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Requeue reason exceeds 500 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.crypto_signal_notification_outbox
  where id=p_id
  for update;

  if not found then
    raise exception 'Notification not found' using errcode='P0002';
  end if;

  if v_row.status not in ('dead','retry') then
    raise exception 'Only dead or retry notifications can be requeued; current status: %',v_row.status using errcode='22023';
  end if;

  update public.crypto_signal_notification_outbox
  set status='retry',
      attempts=0,
      available_at=now(),
      claimed_at=null,
      sent_at=null,
      telegram_message_id=null,
      last_error=null,
      updated_at=now()
  where id=v_row.id;

  insert into public.crypto_admin_audit_log(
    actor_user_id,actor_role,source,action,entity_type,entity_id,severity,summary,old_state,new_state,correlation_id,request_context
  ) values (
    v_actor,'admin','admin_rpc','signal_notification_requeue','crypto_signal_notification_outbox',v_row.id::text,'high',
    left('Manual signal notification requeue approved: '||v_reason,1000),
    jsonb_build_object(
      'status',v_row.status,
      'attempts',v_row.attempts,
      'available_at',v_row.available_at,
      'claimed_at',v_row.claimed_at,
      'sent_at',v_row.sent_at,
      'telegram_message_id',v_row.telegram_message_id,
      'last_error',left(coalesce(v_row.last_error,''),160),
      'event_type',v_row.event_type,
      'signal_id',v_row.signal_id
    ),
    jsonb_build_object(
      'status','retry',
      'attempts',0,
      'available_at',now(),
      'manual_requeue',true,
      'automatic_send',false,
      'event_type',v_row.event_type,
      'signal_id',v_row.signal_id
    ),
    v_correlation,
    jsonb_build_object('reason',v_reason,'delivery_triggered',false)
  ) returning id into v_audit_id;

  return jsonb_build_object(
    'requeued',true,
    'id',v_row.id,
    'signal_id',v_row.signal_id,
    'event_type',v_row.event_type,
    'previous_status',v_row.status,
    'previous_attempts',v_row.attempts,
    'status','retry',
    'attempts',0,
    'available_at',now(),
    'audit_id',v_audit_id,
    'correlation_id',v_correlation,
    'delivery_triggered',false
  );
end;
$$;

create or replace function public.admin_requeue_crypto_signal_notification(
  p_id uuid,
  p_reason text
)
returns jsonb
language sql
volatile
security invoker
set search_path to 'public','private','pg_temp'
as $$
  select private.admin_requeue_crypto_signal_notification(p_id,p_reason)
$$;

revoke all on function private.admin_requeue_crypto_signal_notification(uuid,text) from public,anon;
revoke all on function public.admin_requeue_crypto_signal_notification(uuid,text) from public,anon;
grant execute on function private.admin_requeue_crypto_signal_notification(uuid,text) to authenticated,service_role;
grant execute on function public.admin_requeue_crypto_signal_notification(uuid,text) to authenticated,service_role;