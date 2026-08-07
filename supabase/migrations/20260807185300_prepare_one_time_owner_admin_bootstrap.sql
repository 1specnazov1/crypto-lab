create table if not exists private.crypto_admin_bootstrap_config (
  singleton boolean primary key default true check (singleton),
  allowed_email text not null,
  authorized boolean not null default false,
  consumed_at timestamptz,
  consumed_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (allowed_email = lower(btrim(allowed_email)))
);

revoke all on table private.crypto_admin_bootstrap_config from public, anon, authenticated;

insert into private.crypto_admin_bootstrap_config(singleton,allowed_email,authorized,consumed_at,consumed_user_id)
values (true,'1specnazov1@gmail.com',true,null,null)
on conflict (singleton) do update
set allowed_email=excluded.allowed_email,
    authorized=true,
    updated_at=now()
where private.crypto_admin_bootstrap_config.consumed_at is null;

create or replace function private.crypto_promote_owner_admin_on_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  cfg private.crypto_admin_bootstrap_config%rowtype;
begin
  if new.email_confirmed_at is null or old.email_confirmed_at is not null then
    return new;
  end if;

  select * into cfg
  from private.crypto_admin_bootstrap_config
  where singleton = true
  for update;

  if not found or not cfg.authorized or cfg.consumed_at is not null then
    return new;
  end if;

  if lower(coalesce(new.email,'')) <> cfg.allowed_email then
    return new;
  end if;

  if exists(select 1 from public.crypto_user_profiles where role='admin') then
    raise exception 'Owner admin bootstrap refused: an admin already exists';
  end if;

  update public.crypto_user_profiles
  set role='admin', updated_at=now()
  where user_id=new.id;

  if not found then
    raise exception 'Owner admin bootstrap refused: profile missing';
  end if;

  update private.crypto_admin_bootstrap_config
  set consumed_at=now(), consumed_user_id=new.id, authorized=false, updated_at=now()
  where singleton=true and consumed_at is null;

  return new;
end;
$$;

revoke all on function private.crypto_promote_owner_admin_on_confirmation() from public, anon, authenticated;

drop trigger if exists crypto_owner_admin_bootstrap_after_confirmation on auth.users;
create trigger crypto_owner_admin_bootstrap_after_confirmation
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function private.crypto_promote_owner_admin_on_confirmation();

comment on table private.crypto_admin_bootstrap_config is 'One-time owner-only admin bootstrap. Does not create Auth users or credentials.';
comment on function private.crypto_promote_owner_admin_on_confirmation() is 'Promotes the exact pre-authorized owner email to first admin only after Auth email confirmation; one-time and self-disabling.';
