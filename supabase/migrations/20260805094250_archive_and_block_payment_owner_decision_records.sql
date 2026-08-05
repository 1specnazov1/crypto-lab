-- CRYPTO LAB v79
-- Preserve invalid reconstructed decisions as inactive audit evidence and block new payment/on-chain records.

alter table public.crypto_owner_decision_records
  add column if not exists active boolean not null default true;

drop trigger if exists crypto_owner_decision_record_immutable on public.crypto_owner_decision_records;

update public.crypto_owner_decision_records r
set active=false
where r.decision_code ~* '^(ONCHAIN|PAYMENT)_'
  and exists(select 1 from public.crypto_owner_decision_supersessions s where s.decision_id=r.id);

alter table public.crypto_owner_decision_records
  drop constraint if exists crypto_owner_decision_payment_record_fail_closed;
alter table public.crypto_owner_decision_records
  add constraint crypto_owner_decision_payment_record_fail_closed
  check (decision_code !~* '^(ONCHAIN|PAYMENT)_' or active=false) not valid;
alter table public.crypto_owner_decision_records
  validate constraint crypto_owner_decision_payment_record_fail_closed;

create or replace function private.block_crypto_payment_owner_decision_record()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if new.decision_code ~* '^(ONCHAIN|PAYMENT)_' then
    raise exception 'Payment and on-chain owner-decision records are fail-closed until an explicit manual migration follows a real user decision'
      using errcode='42501';
  end if;
  return new;
end;
$$;

revoke all on function private.block_crypto_payment_owner_decision_record() from public,anon,authenticated,service_role;

drop trigger if exists crypto_payment_owner_decision_record_fail_closed on public.crypto_owner_decision_records;
create trigger crypto_payment_owner_decision_record_fail_closed
before insert or update of decision_code,decision_text,decision_hash,source_channel,scope,activation_authorized,active
on public.crypto_owner_decision_records
for each row execute function private.block_crypto_payment_owner_decision_record();

create trigger crypto_owner_decision_record_immutable
before update or delete on public.crypto_owner_decision_records
for each row execute function private.crypto_owner_decision_record_immutable();

revoke insert,update,delete,truncate on table public.crypto_owner_decision_records from public,anon,authenticated,service_role;
