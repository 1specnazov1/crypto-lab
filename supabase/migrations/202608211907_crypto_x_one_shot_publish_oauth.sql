create table if not exists public.crypto_x_publish_oauth_requests (
  id uuid primary key default gen_random_uuid(),
  init_hash text not null unique,
  request_token_hash text unique,
  request_secret_ciphertext text,
  request_secret_iv text,
  content_job_id uuid not null references public.crypto_x_content_jobs(id) on delete cascade,
  expires_at timestamptz not null,
  init_used_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crypto_x_publish_oauth_requests enable row level security;
revoke all on public.crypto_x_publish_oauth_requests from public, anon, authenticated;
grant select, insert, update, delete on public.crypto_x_publish_oauth_requests to service_role;
comment on table public.crypto_x_publish_oauth_requests is
  'Short-lived owner-authorized X write OAuth requests for one-shot publication. No access token is persisted.';
