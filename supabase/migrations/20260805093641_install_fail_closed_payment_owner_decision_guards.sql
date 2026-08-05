create or replace function private.block_crypto_onchain_owner_approval_until_explicit_decision()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private','pg_temp'
as $$
begin
  if new.network_code in('TRON','BSC','SOLANA') then
    if new.approved_by_owner then raise exception 'On-chain owner approval requires a new explicit owner-decision migration' using errcode='42501'; end if;
    if new.status='active' then raise exception 'On-chain network activation is not authorized' using errcode='42501'; end if;
    if exists(select 1 from jsonb_object_keys(coalesce(new.metadata,'{}'::jsonb)) k where k ~* '(owner|approval|decision|activation)') then
      raise exception 'Owner approval metadata is not allowed without a new explicit owner-decision migration' using errcode='42501';
    end if;
  end if;
  return new;
end $$;

create trigger crypto_onchain_network_owner_approval_guard
before insert or update of approved_by_owner,status,metadata on public.crypto_onchain_networks
for each row execute function private.block_crypto_onchain_owner_approval_until_explicit_decision();

create or replace function private.block_crypto_payment_owner_claim_until_explicit_decision()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private','pg_temp'
as $$
declare v_owner_claim boolean:=false;v_approved_count integer:=0;
begin
  if new.code not in('PAYMENT_PROVIDER','PAYMENT_SANDBOX_E2E') then return new; end if;
  if jsonb_typeof(new.decision_summary->'approved_networks')='array' then v_approved_count:=v_approved_count+jsonb_array_length(new.decision_summary->'approved_networks'); end if;
  if jsonb_typeof(new.evidence->'approved_networks')='array' then v_approved_count:=v_approved_count+jsonb_array_length(new.evidence->'approved_networks'); end if;
  v_owner_claim:=v_approved_count>0
    or coalesce((new.decision_summary->>'owner_approval_recorded')::boolean,false)
    or coalesce((new.decision_summary->>'network_approval_recorded')::boolean,false)
    or coalesce((new.evidence->>'owner_approval_recorded')::boolean,false)
    or coalesce((new.evidence->>'network_approval_recorded')::boolean,false)
    or new.decision_summary ?| array['decision_code','decision_hash']
    or new.evidence ?| array['decision_code','decision_hash'];
  if v_owner_claim then raise exception 'Payment owner approval claims require a new explicit owner-decision migration' using errcode='42501'; end if;
  if new.code='PAYMENT_PROVIDER' and (new.status<>'decision_required' or new.decided_at is not null or new.verified_at is not null) then
    raise exception 'PAYMENT_PROVIDER must remain decision_required without an explicit owner decision' using errcode='42501';
  end if;
  return new;
end $$;

create trigger crypto_payment_owner_decision_provenance_guard
before insert or update of status,decision_summary,evidence,operator_note,decided_at,verified_at on public.crypto_launch_requirements
for each row execute function private.block_crypto_payment_owner_claim_until_explicit_decision();

create or replace function private.block_crypto_owner_decision_record_insert()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private','pg_temp'
as $$ begin raise exception 'Owner decision records require a new explicit manual migration containing exact owner text' using errcode='42501'; end $$;

drop trigger if exists crypto_owner_decision_record_insert_guard on public.crypto_owner_decision_records;
create trigger crypto_owner_decision_record_insert_guard before insert on public.crypto_owner_decision_records
for each row execute function private.block_crypto_owner_decision_record_insert();

create or replace function private.crypto_owner_decision_supersession_immutable()
returns trigger language plpgsql security definer set search_path='pg_catalog','pg_temp'
as $$ begin raise exception 'Owner decision supersession evidence is immutable' using errcode='55000'; end $$;

create trigger crypto_owner_decision_supersession_immutable before update or delete on public.crypto_owner_decision_supersessions
for each row execute function private.crypto_owner_decision_supersession_immutable();

revoke all on function private.block_crypto_onchain_owner_approval_until_explicit_decision() from public,anon,authenticated,service_role;
revoke all on function private.block_crypto_payment_owner_claim_until_explicit_decision() from public,anon,authenticated,service_role;
revoke all on function private.block_crypto_owner_decision_record_insert() from public,anon,authenticated,service_role;
revoke all on function private.crypto_owner_decision_supersession_immutable() from public,anon,authenticated,service_role;
revoke insert,update,delete on table public.crypto_owner_decision_records from service_role;
