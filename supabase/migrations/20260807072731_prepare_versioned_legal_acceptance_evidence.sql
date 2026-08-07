create table if not exists public.crypto_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  terms_revision text not null check (length(btrim(terms_revision)) between 1 and 120),
  privacy_notice_revision text not null check (length(btrim(privacy_notice_revision)) between 1 and 120),
  refund_policy_revision text not null check (length(btrim(refund_policy_revision)) between 1 and 120),
  risk_disclosure_revision text not null check (length(btrim(risk_disclosure_revision)) between 1 and 120),
  terms_accepted boolean not null check (terms_accepted = true),
  privacy_notice_acknowledged boolean not null check (privacy_notice_acknowledged = true),
  refund_policy_acknowledged boolean not null check (refund_policy_acknowledged = true),
  risk_disclosure_acknowledged boolean not null check (risk_disclosure_acknowledged = true),
  acceptance_source text not null check (acceptance_source in ('closed_beta','registration','checkout','account_update')),
  locale text not null default 'uk' check (locale in ('uk','ru','en')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists crypto_legal_acceptances_user_accepted_idx
  on public.crypto_legal_acceptances(user_id, accepted_at desc);

alter table public.crypto_legal_acceptances enable row level security;

revoke all on table public.crypto_legal_acceptances from public, anon, authenticated;
grant select, insert on table public.crypto_legal_acceptances to service_role;

create policy crypto_legal_acceptances_deny_anon
  on public.crypto_legal_acceptances
  for all to anon
  using (false) with check (false);

create policy crypto_legal_acceptances_deny_authenticated
  on public.crypto_legal_acceptances
  for all to authenticated
  using (false) with check (false);

create or replace function private.crypto_record_legal_acceptance(
  p_user_id uuid,
  p_terms_revision text,
  p_privacy_notice_revision text,
  p_refund_policy_revision text,
  p_risk_disclosure_revision text,
  p_acceptance_source text,
  p_locale text default 'uk',
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_id uuid;
  v_evidence_text text;
begin
  if p_user_id is null or not exists (select 1 from auth.users u where u.id=p_user_id) then
    raise exception 'verified auth user required';
  end if;

  if coalesce(jsonb_typeof(p_evidence),'null') <> 'object' then
    raise exception 'evidence must be a json object';
  end if;

  v_evidence_text := lower(coalesce(p_evidence::text,''));
  if v_evidence_text ~ '"(private_key|privatekey|seed|seed_phrase|seedphrase|mnemonic|password|wallet_password|walletpassword|secret)"[[:space:]]*:' then
    raise exception 'secret material is forbidden in legal acceptance evidence';
  end if;

  insert into public.crypto_legal_acceptances(
    user_id,terms_revision,privacy_notice_revision,refund_policy_revision,risk_disclosure_revision,
    terms_accepted,privacy_notice_acknowledged,refund_policy_acknowledged,risk_disclosure_acknowledged,
    acceptance_source,locale,evidence
  ) values (
    p_user_id,btrim(p_terms_revision),btrim(p_privacy_notice_revision),btrim(p_refund_policy_revision),btrim(p_risk_disclosure_revision),
    true,true,true,true,p_acceptance_source,p_locale,p_evidence
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.crypto_record_legal_acceptance(uuid,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function private.crypto_record_legal_acceptance(uuid,text,text,text,text,text,text,jsonb) to service_role;

comment on table public.crypto_legal_acceptances is 'Prelaunch versioned legal acknowledgement evidence. Does not activate registration, checkout, subscriptions, refunds, or production launch.';
comment on function private.crypto_record_legal_acceptance(uuid,text,text,text,text,text,text,jsonb) is 'Service-only recorder for future authenticated legal acknowledgement evidence; rejects secret-like evidence keys.';
