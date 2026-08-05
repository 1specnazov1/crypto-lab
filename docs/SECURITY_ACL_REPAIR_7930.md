# CRYPTO LAB v79 — SECURITY DEFINER ACL Repair

Date: 2026-08-05  
Build: 7930  
Status: repaired and verified

## Finding

The continuous data-integrity control detected one public `SECURITY DEFINER` function executable by browser roles: `public.crypto_x_claim_publish_job()`.

The function performs an atomic claim and state transition on the X publication queue. It is a worker operation and must not be callable by `PUBLIC`, `anon` or `authenticated`.

## Repair

Migration `20260805085208_harden_crypto_x_claim_publish_job_execution`:

- revoked all function privileges from `PUBLIC`;
- revoked `EXECUTE` from `anon` and `authenticated`;
- retained `EXECUTE` only for `service_role` and the database owner;
- changed the function search path to `public, pg_temp`;
- documented the service-only boundary.

## Verification

Post-repair privilege state:

- `PUBLIC`: no execute;
- `anon`: no execute;
- `authenticated`: no execute;
- `service_role`: execute;
- public browser-executable `SECURITY DEFINER` count: zero;
- data-integrity state: healthy.

## X automation boundary

At verification time:

- automation was disabled;
- live publishing was disabled;
- dry-run mode was enabled;
- AI, image and video generation were disabled;
- publication, content-job and publish-queue tables contained no rows.

No X content or external publication was created by this repair.
