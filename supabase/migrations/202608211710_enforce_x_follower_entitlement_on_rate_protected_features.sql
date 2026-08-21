create or replace function public.reserve_crypto_feature_rate(
  p_user_id uuid,p_feature text,p_limit integer,p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_window interval;
  v_count integer;
  v_oldest timestamptz;
  v_retry integer:=0;
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  if p_feature not in ('ai','backtest','scanner','chart','exact_backtest','smart_money','onchain') then raise exception 'Unknown feature'; end if;
  if not private.crypto_launch_access_allowed(p_user_id) then
    return jsonb_build_object('allowed',false,'feature',p_feature,'entitled',false,'code','X_FOLLOWER_REQUIRED','retry_after_seconds',0);
  end if;
  if p_limit<1 or p_limit>120 then raise exception 'Invalid rate limit'; end if;
  if p_window_seconds<10 or p_window_seconds>3600 then raise exception 'Invalid rate window'; end if;
  v_window:=make_interval(secs=>p_window_seconds);
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_feature,79017));
  select count(*),min(created_at) into v_count,v_oldest
  from public.crypto_feature_rate_events
  where user_id=p_user_id and feature=p_feature and created_at>v_now-v_window;
  if v_count>=p_limit then
    v_retry:=greatest(1,ceil(extract(epoch from ((v_oldest+v_window)-v_now)))::integer);
    return jsonb_build_object('allowed',false,'feature',p_feature,'entitled',true,'code','RATE_LIMITED','limit',p_limit,'window_seconds',p_window_seconds,'used',v_count,'remaining',0,'retry_after_seconds',v_retry);
  end if;
  insert into public.crypto_feature_rate_events(user_id,feature,created_at)
  values(p_user_id,p_feature,v_now);
  return jsonb_build_object('allowed',true,'feature',p_feature,'entitled',true,'code','OK','limit',p_limit,'window_seconds',p_window_seconds,'used',v_count+1,'remaining',greatest(p_limit-v_count-1,0),'retry_after_seconds',0);
end;
$$;
