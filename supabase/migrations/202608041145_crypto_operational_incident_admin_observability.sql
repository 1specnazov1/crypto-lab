create or replace function private.get_crypto_admin_operational_incidents()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_result jsonb;
begin
  if not public.crypto_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'generated_at',now(),
    'counts',jsonb_build_object(
      'open',count(*) filter(where status='open'),
      'resolved',count(*) filter(where status='resolved'),
      'edge_open',count(*) filter(where status='open' and source_type='edge'),
      'cron_open',count(*) filter(where status='open' and source_type='cron'),
      'critical_open',count(*) filter(where status='open' and severity='critical')
    ),
    'oldest_open_minutes',round(extract(epoch from (now()-min(first_seen_at) filter(where status='open')))/60.0,1),
    'recent',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,
        'fingerprint',left(i.fingerprint,160),
        'source_type',i.source_type,
        'source_name',left(i.source_name,120),
        'status',i.status,
        'severity',i.severity,
        'first_seen_at',i.first_seen_at,
        'last_seen_at',i.last_seen_at,
        'occurrences',i.occurrences,
        'last_status_code',i.last_status_code,
        'last_error',left(regexp_replace(coalesce(i.last_error,''),'[[:cntrl:]]+',' ','g'),240),
        'resolved_at',i.resolved_at,
        'resolution_note',left(regexp_replace(coalesce(i.resolution_note,''),'[[:cntrl:]]+',' ','g'),240)
      ) order by case when i.status='open' then 0 else 1 end,i.last_seen_at desc)
      from (
        select * from public.crypto_operational_incidents
        order by case when status='open' then 0 else 1 end,last_seen_at desc
        limit 50
      ) i
    ),'[]'::jsonb)
  ) into v_result
  from public.crypto_operational_incidents;

  return v_result;
end;
$$;

create or replace function public.get_crypto_admin_operational_incidents()
returns jsonb
language sql
stable
security invoker
set search_path to 'public','private','pg_temp'
as $$
  select private.get_crypto_admin_operational_incidents()
$$;

revoke all on function private.get_crypto_admin_operational_incidents() from public,anon;
revoke all on function public.get_crypto_admin_operational_incidents() from public,anon;
grant execute on function private.get_crypto_admin_operational_incidents() to authenticated,service_role;
grant execute on function public.get_crypto_admin_operational_incidents() to authenticated,service_role;

notify pgrst,'reload schema';