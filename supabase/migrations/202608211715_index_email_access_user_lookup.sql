create index if not exists crypto_email_access_grants_user_id_idx
  on public.crypto_email_access_grants(user_id)
  where user_id is not null;
