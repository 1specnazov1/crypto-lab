# CRYPTO LAB v79 — Admin account deletion workflow

Build: `7922`

Implemented on 2026-08-03 for Supabase project `txhzxbizjpinowepfjkm` and the isolated `v79` GitHub Pages application. The working v78 application was not modified.

## User-side request

Authenticated users can:

- export a protected JSON copy of their account data;
- create one pending deletion request with an optional bounded reason;
- cancel their own request while it remains pending.

A request does not immediately disable or delete the account.

## Admin processing endpoint

Edge Function: `crypto-lab-v79-admin-deletions`.

Security controls:

- mandatory valid Supabase JWT;
- server-side verification of the current Auth user;
- server-side verification that `crypto_user_profiles.role = admin`;
- browser origin restricted to `https://1specnazov1.github.io`;
- service-role credentials remain only inside the Edge Function;
- an administrator cannot process their own account;
- irreversible deletion requires the exact target email as a confirmation value;
- no email is sent by this workflow.

Supported actions:

- `reject` — closes the request while leaving the account active;
- `complete` — hard-deletes the Auth user through the server-only Supabase Admin API.

All user-owned tables reference `auth.users` with `ON DELETE CASCADE`. Deleting the Auth user therefore removes profile, subscription, usage, portfolio, favorites, plan requests, billing orders, feature leases/rate events, journal entries, backtests and AI runs.

## Privacy-preserving audit

Table: `crypto_account_deletion_audit`.

The audit intentionally does not store plaintext email addresses or user UUIDs. It stores:

- HMAC-SHA256 user hash;
- HMAC-SHA256 email hash;
- HMAC-SHA256 administrator hash;
- original request time and decision time;
- action status;
- bounded reason and internal note;
- row counts observed before deletion;
- bounded technical error code when processing fails.

Direct access is denied to `anon` and `authenticated`. Only server-side service-role code can read or update the audit.

## Admin interface

File: `v79/admin-deletions.js`.

The admin panel displays:

- pending deletion requests;
- irreversible-delete warnings;
- exact-email double confirmation;
- recent privacy-preserving audit decisions;
- commercial launch readiness without exposing secret values.

Readiness currently reports:

- protected email relay availability;
- Cloudflare Turnstile key availability;
- registration activation state;
- password recovery activation state;
- paid plan price/provider configuration.

## Current release state

- Protected mail relay: configured.
- Turnstile keys: pending.
- Public registration: disabled.
- Password recovery: disabled.
- BASIC and PRO payment configuration: pending.
- No test email was sent.
- No user or deletion request was created for verification.
- The admin deletion endpoint returns HTTP 401 without an authorization header.
- Supabase Security Advisor reports no security lints after the migration.

## Production operation rule

Before completing any deletion request, the administrator should verify the request context, export any legally required billing record, enter the exact account email in the confirmation prompt and add a short internal decision note. Completed account deletion is irreversible.
