drop function if exists private.crypto_record_legal_acceptance(uuid,text,text,text,text,text,text,jsonb);

drop policy if exists crypto_legal_acceptances_select_own on public.crypto_legal_acceptances;
drop index if exists public.crypto_legal_acceptances_user_accepted_idx;

revoke all on table public.crypto_legal_acceptances from public, anon, authenticated;
revoke update, delete, truncate, references, trigger on table public.crypto_legal_acceptances from service_role;
grant select, insert on table public.crypto_legal_acceptances to service_role;

create or replace function public.service_accept_crypto_legal(
  p_user_id uuid,
  p_document_key text,
  p_document_version text,
  p_locale text,
  p_source text,
  p_ip_hash text default null,
  p_user_agent_hash text default null
) returns bigint
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_id bigint;
begin
  if p_user_id is null or not exists (select 1 from auth.users u where u.id=p_user_id) then
    raise exception 'Verified Auth user is required';
  end if;

  if p_locale not in ('ru','uk','en') then
    raise exception 'Invalid locale';
  end if;

  if p_source not in ('closed_beta','registration','account','commercial_waitlist','checkout') then
    raise exception 'Invalid source';
  end if;

  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'ip_hash must be a SHA-256/HMAC-style hex digest';
  end if;

  if p_user_agent_hash is not null and p_user_agent_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'user_agent_hash must be a SHA-256/HMAC-style hex digest';
  end if;

  if not exists(
    select 1 from public.crypto_legal_documents
    where document_key=p_document_key
      and version=p_document_version
      and active
  ) then
    raise exception 'Document version is not active';
  end if;

  insert into public.crypto_legal_acceptances(
    user_id,document_key,document_version,locale,source,ip_hash,user_agent_hash
  ) values (
    p_user_id,p_document_key,p_document_version,p_locale,p_source,
    nullif(lower(p_ip_hash),''),nullif(lower(p_user_agent_hash),'')
  )
  on conflict(user_id,document_key,document_version) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.crypto_legal_acceptances
    where user_id=p_user_id
      and document_key=p_document_key
      and document_version=p_document_version;
  end if;

  return v_id;
end;
$function$;

revoke all on function public.service_accept_crypto_legal(uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.service_accept_crypto_legal(uuid,text,text,text,text,text,text) to service_role;

comment on function public.service_accept_crypto_legal(uuid,text,text,text,text,text,text) is 'Service-only, first-acceptance-preserving legal document acknowledgement recorder. Requires an existing Auth user and an active legal document; optional IP/UA evidence must already be hashed.';
