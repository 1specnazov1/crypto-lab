select setval('public.crypto_release_checkpoints_id_seq', greatest((select coalesce(max(id),1) from public.crypto_release_checkpoints),1), true);

create or replace function private.sync_crypto_release_checkpoint_sequence()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog','pg_temp'
as $$
declare
  v_last bigint;
begin
  select last_value into v_last from public.crypto_release_checkpoints_id_seq;
  if new.id>v_last then
    perform setval('public.crypto_release_checkpoints_id_seq',new.id,true);
  end if;
  return new;
end $$;

revoke all on function private.sync_crypto_release_checkpoint_sequence() from public,anon,authenticated;
grant execute on function private.sync_crypto_release_checkpoint_sequence() to service_role;

drop trigger if exists crypto_release_checkpoint_sequence_sync on public.crypto_release_checkpoints;
create trigger crypto_release_checkpoint_sequence_sync
after insert on public.crypto_release_checkpoints
for each row execute function private.sync_crypto_release_checkpoint_sequence();
