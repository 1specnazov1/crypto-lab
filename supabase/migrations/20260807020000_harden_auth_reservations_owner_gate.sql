create or replace function public.reserve_crypto_registration_attempt(p_ip_hash text, p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_ip_hour integer;
  v_ip_day integer;
  v_email_hour integer;
  v_email_day integer;
  v_global_hour integer;
  v_reason text;
  v_registration_enabled boolean := false;
  v_portal_registration_enabled boolean := false;
  v_launch_authorized boolean := false;
begin
  select coalesce(public_registration_enabled,false), coalesce(production_launch_authorized,false)
    into v_registration_enabled, v_launch_authorized
  from public.crypto_commercial_runtime_flags
  where singleton=true;

  select coalesce(registration_enabled,false)
    into v_portal_registration_enabled
  from public.crypto_account_portal_config
  where singleton=true;

  if not coalesce(v_registration_enabled,false)
     or not coalesce(v_portal_registration_enabled,false)
     or not coalesce(v_launch_authorized,false) then
    return jsonb_build_object(
      'allowed', false,
      'request_id', null,
      'reason', 'registration_disabled',
      'owner_gate', true
    );
  end if;

  if coalesce(length(p_ip_hash),0) < 32 or coalesce(length(p_email_hash),0) < 32 then
    raise exception 'invalid registration hashes';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 79015));
  perform pg_advisory_xact_lock(hashtextextended(p_email_hash, 79016));

  select count(*) into v_ip_hour from public.crypto_registration_attempts where ip_hash=p_ip_hash and created_at >= v_now - interval '1 hour';
  select count(*) into v_ip_day from public.crypto_registration_attempts where ip_hash=p_ip_hash and created_at >= v_now - interval '24 hours';
  select count(*) into v_email_hour from public.crypto_registration_attempts where email_hash=p_email_hash and created_at >= v_now - interval '1 hour';
  select count(*) into v_email_day from public.crypto_registration_attempts where email_hash=p_email_hash and created_at >= v_now - interval '24 hours';
  select count(*) into v_global_hour from public.crypto_registration_attempts where created_at >= v_now - interval '1 hour';

  if v_global_hour >= 100 then v_reason := 'global_hour';
  elsif v_ip_hour >= 5 then v_reason := 'ip_hour';
  elsif v_ip_day >= 20 then v_reason := 'ip_day';
  elsif v_email_hour >= 3 then v_reason := 'email_hour';
  elsif v_email_day >= 5 then v_reason := 'email_day';
  end if;

  insert into public.crypto_registration_attempts(request_id,ip_hash,email_hash,outcome,reason)
  values(v_request_id,p_ip_hash,p_email_hash,case when v_reason is null then 'reserved' else 'rate_limited' end,v_reason);

  return jsonb_build_object(
    'allowed', v_reason is null,
    'request_id', v_request_id,
    'reason', v_reason,
    'limits', jsonb_build_object('ip_hour',5,'ip_day',20,'email_hour',3,'email_day',5,'global_hour',100),
    'owner_gate', true
  );
end;
$$;

create or replace function public.reserve_crypto_recovery_attempt(p_ip_hash text, p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_ip_hour integer;
  v_ip_day integer;
  v_email_hour integer;
  v_email_day integer;
  v_global_hour integer;
  v_reason text;
  v_recovery_enabled boolean := false;
begin
  select coalesce(recovery_enabled,false)
    into v_recovery_enabled
  from public.crypto_account_portal_config
  where singleton=true;

  if not coalesce(v_recovery_enabled,false) then
    return jsonb_build_object(
      'allowed', false,
      'request_id', null,
      'reason', 'recovery_disabled',
      'owner_gate', true
    );
  end if;

  if coalesce(length(p_ip_hash),0) < 32 or coalesce(length(p_email_hash),0) < 32 then
    raise exception 'invalid recovery hashes';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 79201));
  perform pg_advisory_xact_lock(hashtextextended(p_email_hash, 79202));

  select count(*) into v_ip_hour from public.crypto_recovery_attempts where ip_hash=p_ip_hash and created_at >= v_now - interval '1 hour';
  select count(*) into v_ip_day from public.crypto_recovery_attempts where ip_hash=p_ip_hash and created_at >= v_now - interval '24 hours';
  select count(*) into v_email_hour from public.crypto_recovery_attempts where email_hash=p_email_hash and created_at >= v_now - interval '1 hour';
  select count(*) into v_email_day from public.crypto_recovery_attempts where email_hash=p_email_hash and created_at >= v_now - interval '24 hours';
  select count(*) into v_global_hour from public.crypto_recovery_attempts where created_at >= v_now - interval '1 hour';

  if v_global_hour >= 100 then v_reason := 'global_hour';
  elsif v_ip_hour >= 5 then v_reason := 'ip_hour';
  elsif v_ip_day >= 20 then v_reason := 'ip_day';
  elsif v_email_hour >= 3 then v_reason := 'email_hour';
  elsif v_email_day >= 5 then v_reason := 'email_day';
  end if;

  insert into public.crypto_recovery_attempts(request_id,ip_hash,email_hash,outcome,reason)
  values(v_request_id,p_ip_hash,p_email_hash,case when v_reason is null then 'reserved' else 'rate_limited' end,v_reason);

  return jsonb_build_object('allowed',v_reason is null,'request_id',v_request_id,'reason',v_reason,'owner_gate',true);
end;
$$;

revoke all on function public.reserve_crypto_registration_attempt(text,text) from public, anon, authenticated;
revoke all on function public.reserve_crypto_recovery_attempt(text,text) from public, anon, authenticated;
grant execute on function public.reserve_crypto_registration_attempt(text,text) to service_role;
grant execute on function public.reserve_crypto_recovery_attempt(text,text) to service_role;