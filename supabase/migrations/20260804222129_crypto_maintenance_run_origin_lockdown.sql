revoke insert,update,delete,truncate,references,trigger
on table public.crypto_maintenance_runs
from service_role,anon,authenticated;

grant select on table public.crypto_maintenance_runs to service_role;

revoke usage,select,update
on sequence public.crypto_maintenance_runs_id_seq
from service_role,anon,authenticated;

revoke execute on function public.run_crypto_maintenance()
from public,anon,authenticated,service_role;
revoke execute on function private.service_seal_latest_crypto_maintenance(text,timestamptz)
from public,anon,authenticated,service_role;

grant execute on function public.run_crypto_maintenance() to postgres;
grant execute on function private.service_seal_latest_crypto_maintenance(text,timestamptz) to postgres;

comment on table public.crypto_maintenance_runs is
'CRYPTO LAB maintenance audit log. Direct writes are restricted to the database owner; scheduled maintenance and evidence sealing run as postgres through protected functions.';
