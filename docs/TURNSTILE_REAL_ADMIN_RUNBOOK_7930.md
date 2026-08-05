# CRYPTO LAB v79 — Turnstile and Real Administrator Runbook

Date: 2026-08-05  
Build: 7930  
Execution status: not authorized  
Registration and recovery: disabled

## 1. Purpose

This runbook defines the controlled path from the current disabled identity contour to verified registration, password recovery and assignment of one real administrator. It does not create a Cloudflare widget, install keys, create an Auth user, send email, assign a role or enable a feature flag.

## 2. Turnstile provisioning boundary

Create one production Cloudflare Turnstile widget for the exact hostname `1specnazov1.github.io`. Do not enter a URL scheme, port, wildcard or path. The application continues to enforce the exact hostname and separate action values server-side:

- registration action: `crypto_register`;
- recovery action: `crypto_recover`.

The public site key may be returned by the readiness endpoint only when the complete flow is ready. The secret key must exist only in the Supabase secret interface. It must never appear in GitHub, public assets, database evidence, logs, screenshots or chat messages.

Required production secrets and flags:

- `CRYPTO_TURNSTILE_SITE_KEY`;
- `CRYPTO_TURNSTILE_SECRET_KEY`;
- `CRYPTO_PUBLIC_REGISTRATION_ENABLED`;
- `CRYPTO_PUBLIC_RECOVERY_ENABLED`.

The feature flags remain `false` until Turnstile, mail relay, legal documents and owned-user test prerequisites are verified.

## 3. Automated non-production testing

Cloudflare's official dummy keys are permitted only in an isolated test environment. Production keys must not be used in Playwright or CI, and dummy keys must not be installed in production.

The evidence package must cover success, deterministic failure, duplicate token, missing token, token over 2,048 characters, wrong action, wrong hostname, Siteverify timeout, rate limits, honeypots and absence of credentials or raw tokens in logs.

A successful widget response is not sufficient. Both Edge Functions must perform Siteverify server-side, enforce a ten-second timeout, validate hostname and action, and reject expired or replayed tokens.

## 4. Controlled hosted identity test

A hosted test may start only after the owner identifies an email mailbox that the owner controls and explicitly authorizes one registration and one recovery email.

Sequence:

1. Confirm Turnstile and mail relay readiness while both public feature flags remain disabled.
2. Temporarily enable registration for the controlled test window.
3. Register the owned email through the public protected gateway.
4. Confirm that one legal-consent set and one confirmation message were recorded.
5. Confirm the email and sign in.
6. Disable registration again unless public activation was separately approved.
7. Temporarily enable recovery for the same owned account.
8. Request one recovery message, complete password reset and confirm generic responses remain identical for unknown addresses.
9. Disable recovery again unless public activation was separately approved.
10. Seal redacted evidence without storing email action tokens.

No fabricated, disposable or third-party address is permitted.

## 5. Real administrator assignment

The administrator must be the exact confirmed Auth user selected by the owner. A synthetic user or browser-side role update is forbidden.

Pre-assignment assertions:

- Auth user exists and `email_confirmed_at` is present;
- profile and default subscription exist;
- the selected UUID corresponds to the owned email;
- there is no conflicting administrator;
- the owner decision is recorded without the mailbox password or token.

Assignment must use a protected SQL/service operation with an audit entry. Afterwards verify:

- the selected profile has the exact `admin` role;
- the selected user can read protected admin RPCs;
- an ordinary authenticated user receives permission denied;
- anonymous access remains denied;
- revocation returns the account to an ordinary role and is audited.

## 6. Evidence fields

Each test record must include: test code, environment, UTC time, release commit, Edge versions, HTTP status, bounded outcome, redacted evidence reference and reviewer. It must not include site secrets, mail tokens, passwords, session tokens, database credentials or complete CAPTCHA tokens.

## 7. Activation gate

`TURNSTILE_CONFIG`, `MAIL_RELAY`, `REAL_ADMIN` and `AUTH_E2E` remain unverified until every required test passes. Public registration and recovery are separate owner decisions and do not become enabled merely because the technical tests pass.

## 8. Official references

- Cloudflare Turnstile setup: https://developers.cloudflare.com/turnstile/get-started/
- Server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Official test keys: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
- Hostname management: https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/
