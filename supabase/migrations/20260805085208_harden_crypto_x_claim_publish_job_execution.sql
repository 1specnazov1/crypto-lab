-- CRYPTO LAB v79
-- Restrict the atomic X publishing queue claim to the service worker.
-- Public browser roles must never execute SECURITY DEFINER queue mutations.

revoke all on function public.crypto_x_claim_publish_job() from public;
revoke all on function public.crypto_x_claim_publish_job() from anon;
revoke all on function public.crypto_x_claim_publish_job() from authenticated;

grant execute on function public.crypto_x_claim_publish_job() to service_role;

alter function public.crypto_x_claim_publish_job()
  set search_path = public, pg_temp;

comment on function public.crypto_x_claim_publish_job() is
  'Service-role-only atomic claim for the X publishing worker. Browser execution is forbidden.';
