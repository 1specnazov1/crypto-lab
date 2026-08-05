-- CRYPTO LAB v79
-- Prevent cost-bearing or live X activation without an explicitly authorized SQL transaction.

create or replace function private.guard_crypto_x_activation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_authorized boolean := coalesce(current_setting('app.crypto_x_activation_authorized', true), 'false') = 'true';
  v_enabling boolean;
begin
  if tg_op = 'INSERT' then
    v_enabling := new.automation_enabled
      or new.live_publish_enabled
      or new.ai_generation_enabled
      or new.image_generation_enabled
      or new.video_generation_enabled;
  else
    v_enabling := (new.automation_enabled and not old.automation_enabled)
      or (new.live_publish_enabled and not old.live_publish_enabled)
      or (new.ai_generation_enabled and not old.ai_generation_enabled)
      or (new.image_generation_enabled and not old.image_generation_enabled)
      or (new.video_generation_enabled and not old.video_generation_enabled);
  end if;

  if v_enabling and not v_authorized then
    raise exception 'CRYPTO X activation requires an explicit authorized transaction'
      using errcode = '42501';
  end if;

  if new.live_publish_enabled and (not new.automation_enabled or new.dry_run) then
    raise exception 'Live publication requires automation enabled and dry_run disabled'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_crypto_x_activation() from public;
revoke all on function private.guard_crypto_x_activation() from anon;
revoke all on function private.guard_crypto_x_activation() from authenticated;
revoke all on function private.guard_crypto_x_activation() from service_role;

drop trigger if exists crypto_x_settings_activation_guard on public.crypto_x_settings;
create trigger crypto_x_settings_activation_guard
before insert or update of automation_enabled, live_publish_enabled, dry_run,
  ai_generation_enabled, image_generation_enabled, video_generation_enabled
on public.crypto_x_settings
for each row execute function private.guard_crypto_x_activation();

comment on function private.guard_crypto_x_activation() is
  'Blocks cost-bearing or live CRYPTO X activation unless the SQL transaction explicitly sets app.crypto_x_activation_authorized=true.';
