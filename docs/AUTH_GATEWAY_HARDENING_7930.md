# CRYPTO LAB v79 — Protected Auth Gateway Hardening

Date: 2026-08-05  
Build: 7930  
Public activation: disabled

## Defect closed

The account page contained legacy direct calls to `supabase.auth.signUp` and `resetPasswordForEmail`. Those calls would bypass the protected registration and recovery Edge Functions after public Auth was enabled.

A new `auth-gateway.js` overrides only the signup request and recovery-link request. Login and setting a new password after a valid recovery session continue to use Supabase Auth normally.

## Registration Edge v3

- remains `verify_jwt=false` because it is a pre-auth public endpoint;
- exact GitHub Pages origin allowlist;
- registration feature flag required;
- Turnstile site key and secret required;
- mail relay URL, publishable key and private DB relay secret required;
- exactly three current legal documents required;
- bounded request and token size;
- IP/email rate limits using HMAC hashes;
- honeypot;
- password policy: 10–72 chars, upper/lower case and number;
- server-side Turnstile Siteverify;
- exact hostname and action `crypto_register` checks;
- 10-second Siteverify timeout and idempotency key;
- protected legal-acceptance writes;
- confirmation link generated server-side;
- confirmation mail sent only through the protected mail dispatcher;
- newly generated user is deleted if legal acceptance or mail dispatch fails;
- duplicate-email response does not expose account existence.

## Recovery Edge v2

- remains `verify_jwt=false` because it is a pre-auth public endpoint;
- exact origin allowlist;
- separate recovery feature flag required;
- Turnstile and mail relay readiness required;
- IP/email rate limits using HMAC hashes;
- honeypot;
- bounded email and CAPTCHA input;
- exact hostname and action `crypto_recover` checks;
- server-side recovery-link generation;
- mail only through the protected dispatcher;
- generic 202 response for existing, absent and downstream-failure account cases to reduce account enumeration;
- internal outcome remains available in the protected recovery-attempt ledger.

## Client gateway

- obtains readiness and public site keys from the Edge GET endpoints;
- loads Cloudflare Turnstile only when a protected flow is enabled;
- renders distinct signup and recovery actions;
- routes signup and reset requests to the Edge Functions;
- retains the legal-document injection from `registration-consent.js`;
- enforces the server password minimum in the UI;
- exposes only a bounded non-secret diagnostics object;
- is included in the PWA shell cache `crypto-lab-v79-7930-auth1`.

## Controlled verification completed

- Registration GET: HTTP 200, enabled false, feature flag false, Turnstile false, mail relay false, legal documents 3/3.
- Recovery GET: HTTP 200, enabled false, feature flag false, Turnstile false, mail relay false, enumeration-safe true.
- Auth users after verification: 0.
- Registration attempts after verification: 0.
- Recovery attempts after verification: 0.
- No email sent.
- No hosted signup/recovery request made.

## Remaining activation inputs

- production Turnstile site key and secret;
- configured mail relay and verified sender;
- owned mailbox for one controlled test;
- real admin assignment decision;
- explicit registration and recovery enablement after E2E evidence.
