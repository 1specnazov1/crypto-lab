create table if not exists public.crypto_x_follower_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  x_user_id text not null unique,
  x_username text,
  follows_target boolean not null default false,
  verified_at timestamptz,
  last_checked_at timestamptz,
  revoked_at timestamptz,
  oauth_token_ciphertext text,
  oauth_token_iv text,
  oauth_secret_ciphertext text,
  oauth_secret_iv text,
  check_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crypto_x_follower_access enable row level security;
revoke all on public.crypto_x_follower_access from anon, authenticated;
grant all on public.crypto_x_follower_access to service_role;

create table if not exists public.crypto_x_oauth_requests (
  request_token_hash text primary key,
  request_secret_ciphertext text not null,
  request_secret_iv text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists crypto_x_oauth_requests_user_created_idx
  on public.crypto_x_oauth_requests(user_id,created_at desc);
alter table public.crypto_x_oauth_requests enable row level security;
revoke all on public.crypto_x_oauth_requests from anon, authenticated;
grant all on public.crypto_x_oauth_requests to service_role;

alter table public.crypto_support_tickets
  drop constraint if exists crypto_support_tickets_category_check;
alter table public.crypto_support_tickets
  add constraint crypto_support_tickets_category_check
  check (category = any (array[
    'account'::text,'billing'::text,'technical'::text,
    'signals'::text,'product_idea'::text,'other'::text
  ]));

create or replace function private.create_crypto_support_ticket(
  p_category text,p_subject text,p_message text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_ticket uuid;
  v_category text := lower(trim(coalesce(p_category,'')));
  v_subject text := trim(regexp_replace(coalesce(p_subject,''), '[\r\n\t]+', ' ', 'g'));
  v_message text := trim(coalesce(p_message,''));
  v_open integer;
  v_recent integer;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if v_category not in ('account','billing','technical','signals','product_idea','other') then raise exception 'invalid category'; end if;
  if char_length(v_subject)<3 or char_length(v_subject)>120 then raise exception 'invalid subject'; end if;
  if char_length(v_message)<10 or char_length(v_message)>4000 then raise exception 'invalid message'; end if;
  select count(*) into v_open from public.crypto_support_tickets where user_id=v_user and status in ('open','in_progress');
  if v_open>=5 then raise exception 'too many open tickets'; end if;
  select count(*) into v_recent from public.crypto_support_tickets where user_id=v_user and created_at>now()-interval '10 minutes';
  if v_recent>=2 then raise exception 'support rate limit'; end if;
  insert into public.crypto_support_tickets(user_id,category,subject)
  values(v_user,v_category,v_subject) returning id into v_ticket;
  insert into public.crypto_support_messages(ticket_id,author_user_id,author_role,body)
  values(v_ticket,v_user,'user',v_message);
  return jsonb_build_object('ok',true,'ticket_id',v_ticket);
end;
$$;

comment on table public.crypto_x_follower_access is
  'CRYPTO LAB follower entitlement; server-only. Links an authenticated CRYPTO LAB account to verified X identity.';
comment on table public.crypto_x_oauth_requests is
  'Short-lived X OAuth 1.0a handshake state; server-only.';
