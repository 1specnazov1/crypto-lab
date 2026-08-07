create or replace function private.crypto_paid_entitlement_runtime_guard()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_enabled boolean := false;
begin
  if coalesce(new.plan,'FREE') <> 'FREE'
     and new.status in ('trialing','active','past_due') then
    select paid_entitlement_enabled into v_enabled
    from public.crypto_commercial_runtime_flags
    where singleton=true;

    if not coalesce(v_enabled,false) then
      raise exception 'PAID_ENTITLEMENT_RUNTIME_DISABLED' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.crypto_paid_entitlement_runtime_guard() from public, anon, authenticated;
grant execute on function private.crypto_paid_entitlement_runtime_guard() to service_role;

drop trigger if exists crypto_paid_entitlement_runtime_guard_trg on public.crypto_subscriptions;
create trigger crypto_paid_entitlement_runtime_guard_trg
before insert or update of plan,status,current_period_start,current_period_end
on public.crypto_subscriptions
for each row execute function private.crypto_paid_entitlement_runtime_guard();

comment on function private.crypto_paid_entitlement_runtime_guard() is 'Fail-closed commercial gate: no non-FREE active/trialing/past_due entitlement can exist while crypto_commercial_runtime_flags.paid_entitlement_enabled=false.';
