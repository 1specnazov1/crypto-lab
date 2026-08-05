-- CRYPTO LAB v79: harden newly added internal source-learning services.

revoke execute on function public.crypto_x_apply_blended_source_ranking() from public, anon, authenticated;
revoke execute on function public.crypto_x_refresh_source_performance() from public, anon, authenticated;
grant execute on function public.crypto_x_apply_blended_source_ranking() to service_role;
grant execute on function public.crypto_x_refresh_source_performance() to service_role;

revoke all on table public.crypto_x_source_performance from public, anon, authenticated;

drop policy if exists crypto_x_source_performance_service_only_deny on public.crypto_x_source_performance;
create policy crypto_x_source_performance_service_only_deny
on public.crypto_x_source_performance
for all to anon, authenticated
using (false)
with check (false);

do $$
begin
  if has_function_privilege('anon','public.crypto_x_apply_blended_source_ranking()','EXECUTE')
     or has_function_privilege('authenticated','public.crypto_x_apply_blended_source_ranking()','EXECUTE')
     or has_function_privilege('anon','public.crypto_x_refresh_source_performance()','EXECUTE')
     or has_function_privilege('authenticated','public.crypto_x_refresh_source_performance()','EXECUTE') then
    raise exception 'Internal source-learning functions remain externally executable';
  end if;

  if not has_function_privilege('service_role','public.crypto_x_apply_blended_source_ranking()','EXECUTE')
     or not has_function_privilege('service_role','public.crypto_x_refresh_source_performance()','EXECUTE') then
    raise exception 'Service-role function privileges missing';
  end if;

  if not exists(
    select 1 from pg_policy p
    join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='crypto_x_source_performance'
      and p.polname='crypto_x_source_performance_service_only_deny'
      and pg_get_expr(p.polqual,p.polrelid)='false'
      and pg_get_expr(p.polwithcheck,p.polrelid)='false'
  ) then
    raise exception 'Explicit service-only deny policy missing';
  end if;
end $$;
