alter table public.crypto_x_timing_performance enable row level security;
alter table public.crypto_x_status_incident_updates enable row level security;

revoke all on table public.crypto_x_timing_performance from anon, authenticated;
revoke all on table public.crypto_x_status_incident_updates from anon, authenticated;

comment on table public.crypto_x_timing_performance is
  'CRYPTO LAB X timing analytics. Service-role/server-only access; browser roles denied.';
comment on table public.crypto_x_status_incident_updates is
  'CRYPTO LAB X status lifecycle data. Service-role/server-only access; browser roles denied.';
