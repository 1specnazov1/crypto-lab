alter table public.crypto_legal_documents
  drop constraint if exists crypto_legal_documents_key_check;
alter table public.crypto_legal_documents
  add constraint crypto_legal_documents_key_check
  check (document_key = any (array['terms'::text,'privacy'::text,'risk'::text,'refund'::text]));

alter table public.crypto_legal_documents
  drop constraint if exists crypto_legal_documents_url_check;
alter table public.crypto_legal_documents
  add constraint crypto_legal_documents_url_check
  check (url_path ~ '^\./(terms|privacy|risk-disclosure|refund)\.html$'::text);

insert into public.crypto_legal_documents(document_key, version, effective_at, url_path, active)
values
  ('terms','2026-08-07-draft1','2026-08-07 00:00:00+00','./terms.html',false),
  ('privacy','2026-08-07-draft1','2026-08-07 00:00:00+00','./privacy.html',false),
  ('risk','2026-08-07-draft1','2026-08-07 00:00:00+00','./risk-disclosure.html',false),
  ('refund','2026-08-07-draft1','2026-08-07 00:00:00+00','./refund.html',false)
on conflict (document_key, version) do update
set url_path = excluded.url_path,
    active = false;

create table if not exists public.crypto_legal_readiness (
  singleton boolean primary key default true check (singleton),
  candidate text not null default 'v79',
  draft_version text not null,
  terms_draft_ready boolean not null default false,
  privacy_draft_ready boolean not null default false,
  refund_draft_ready boolean not null default false,
  risk_draft_ready boolean not null default false,
  operator_legal_name text,
  operator_registration_id text,
  operator_legal_address text,
  support_email text,
  privacy_contact text,
  governing_law text,
  served_markets_reviewed boolean not null default false,
  legal_review_complete boolean not null default false,
  publication_authorized boolean not null default false,
  missing_fields jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint crypto_legal_readiness_publication_gate check (
    not publication_authorized or (
      terms_draft_ready and privacy_draft_ready and refund_draft_ready and risk_draft_ready
      and nullif(btrim(operator_legal_name),'') is not null
      and nullif(btrim(operator_legal_address),'') is not null
      and nullif(btrim(support_email),'') is not null
      and nullif(btrim(privacy_contact),'') is not null
      and nullif(btrim(governing_law),'') is not null
      and served_markets_reviewed
      and legal_review_complete
    )
  )
);

alter table public.crypto_legal_readiness enable row level security;
revoke all on table public.crypto_legal_readiness from public, anon, authenticated;
grant select, insert, update, delete on table public.crypto_legal_readiness to service_role;

insert into public.crypto_legal_readiness(
  singleton, candidate, draft_version,
  terms_draft_ready, privacy_draft_ready, refund_draft_ready, risk_draft_ready,
  served_markets_reviewed, legal_review_complete, publication_authorized, missing_fields, updated_at
)
values (
  true, 'v79', '2026-08-07-draft1',
  true, true, true, true,
  false, false, false,
  '["operator_legal_name","operator_registration_id_if_applicable","operator_legal_address","support_email","privacy_contact","governing_law","served_markets_legal_review","final_legal_review"]'::jsonb,
  now()
)
on conflict (singleton) do update
set candidate = excluded.candidate,
    draft_version = excluded.draft_version,
    terms_draft_ready = excluded.terms_draft_ready,
    privacy_draft_ready = excluded.privacy_draft_ready,
    refund_draft_ready = excluded.refund_draft_ready,
    risk_draft_ready = excluded.risk_draft_ready,
    served_markets_reviewed = false,
    legal_review_complete = false,
    publication_authorized = false,
    missing_fields = excluded.missing_fields,
    updated_at = now();

update public.crypto_launch_requirements
set evidence = coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
      'candidate_refund_page','v79/refund.html',
      'commercial_legal_draft_version','2026-08-07-draft1',
      'publication_authorized',false,
      'refund_execution_authorized',false,
      'operator_details_complete',false,
      'final_legal_review_complete',false
    ),
    operator_note = 'Owner-approved Refund Policy v1 is now rendered in the unpublished v79 legal draft set. Operator identity, governing law, served-market review and final legal review remain blockers. Refund execution and real payments remain disabled.',
    updated_at = now()
where code = 'REFUND_POLICY';