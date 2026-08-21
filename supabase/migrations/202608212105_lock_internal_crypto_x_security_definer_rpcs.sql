do $$
declare r record;
declare sig text;
begin
  for r in
    select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and p.proname like 'crypto_x_%'
      and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
  loop
    sig := format('%I.%I(%s)',r.nspname,r.proname,r.args);
    execute format('revoke all on function %s from public',sig);
    execute format('revoke all on function %s from anon',sig);
    execute format('revoke all on function %s from authenticated',sig);
    execute format('grant execute on function %s to service_role',sig);
  end loop;
end
$$;
