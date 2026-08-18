create table if not exists public.crypto_email_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  locale text not null default 'ru' check (locale in ('ru','uk','en')),
  token_hash text not null unique,
  device_hash text not null,
  request_ip_hash text,
  request_user_agent_hash text,
  legal_acceptances jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  email_sent_at timestamptz,
  redeem_started_at timestamptz,
  redeem_attempts integer not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_email_access_email_normalized check (email = lower(trim(email))),
  constraint crypto_email_access_device_hash check (device_hash ~ '^[0-9a-f]{64}$'),
  constraint crypto_email_access_token_hash check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint crypto_email_access_legal_array check (jsonb_typeof(legal_acceptances) = 'array')
);

create index if not exists crypto_email_access_email_created_idx
  on public.crypto_email_access_grants(email, created_at desc);

create index if not exists crypto_email_access_expires_idx
  on public.crypto_email_access_grants(expires_at)
  where used_at is null and revoked_at is null;

create index if not exists crypto_email_access_ip_created_idx
  on public.crypto_email_access_grants(request_ip_hash, created_at desc)
  where request_ip_hash is not null;

alter table public.crypto_email_access_grants enable row level security;
revoke all on public.crypto_email_access_grants from anon, authenticated;
grant select, insert, update, delete on public.crypto_email_access_grants to service_role;

comment on table public.crypto_email_access_grants is
  'Device-bound one-time email access grants for CRYPTO LAB v79. Tokens are stored only as SHA-256 hashes.';

comment on column public.crypto_email_access_grants.device_hash is
  'SHA-256 of a random browser secret. The raw secret never appears in the email link or database.';
