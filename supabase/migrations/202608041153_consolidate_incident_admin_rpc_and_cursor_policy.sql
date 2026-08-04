drop function if exists public.get_crypto_admin_incident_health();
drop function if exists private.get_crypto_admin_incident_health();

drop policy if exists crypto_operational_cursors_service_all on public.crypto_operational_cursors;
create policy crypto_operational_cursors_service_all
on public.crypto_operational_cursors
for all
to service_role
using(true)
with check(true);

notify pgrst,'reload schema';
