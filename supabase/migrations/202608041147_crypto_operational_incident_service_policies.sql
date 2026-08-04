drop policy if exists crypto_operational_http_requests_service_all on public.crypto_operational_http_requests;
create policy crypto_operational_http_requests_service_all
on public.crypto_operational_http_requests
for all
to service_role
using(true)
with check(true);

drop policy if exists crypto_operational_incidents_service_all on public.crypto_operational_incidents;
create policy crypto_operational_incidents_service_all
on public.crypto_operational_incidents
for all
to service_role
using(true)
with check(true);