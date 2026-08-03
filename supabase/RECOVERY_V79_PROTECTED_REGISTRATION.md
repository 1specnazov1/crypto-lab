# CRYPTO LAB v79 — Protected registration foundation

Applied to Supabase project `txhzxbizjpinowepfjkm` and GitHub Pages build `7915` on 2026-08-03.

## Current release state

Public registration remains **disabled**. Existing users can sign in, but the registration tab stays hidden until all required Turnstile settings are present and the explicit registration flag is enabled.

The built-in Supabase Auth signup and password-recovery email methods remain locked in the v79 client. New registration email must use the protected CRYPTO LAB → Lumeria → Resend relay.

## Database rate-limit foundation

Migration: `crypto_lab_v79_registration_rate_limits`.

Table `crypto_registration_attempts` stores only:

- HMAC-derived IP and email hashes;
- request timestamp and final outcome;
- optional created user ID;
- short technical reason.

Plaintext recipient email and IP addresses are not stored in this table.

Atomic RPC functions:

- `reserve_crypto_registration_attempt(ip_hash, email_hash)`;
- `finish_crypto_registration_attempt(request_id, outcome, reason, user_id)`.

Limits applied before CAPTCHA and account creation:

- 5 attempts per IP per hour;
- 20 attempts per IP per 24 hours;
- 3 attempts per email per hour;
- 5 attempts per email per 24 hours;
- 100 registration attempts globally per hour.

The table and both RPC functions are inaccessible to `anon` and `authenticated`; only `service_role` can use them.

## Protected registration Edge Function

Function: `crypto-lab-v79-register`.

- `verify_jwt=false` is intentional because this is a pre-authentication endpoint.
- Browser origin is restricted to `https://1specnazov1.github.io`.
- Registration is enabled only when all three server settings exist:
  - `CRYPTO_PUBLIC_REGISTRATION_ENABLED=true`;
  - `CRYPTO_TURNSTILE_SITE_KEY`;
  - `CRYPTO_TURNSTILE_SECRET_KEY`.
- Cloudflare Turnstile is verified server-side with the client IP and expected hostname.
- Input size, email format, password strength, honeypot and rate limits are validated before account creation.
- Password requirement: 10–72 characters with lowercase, uppercase and a digit.
- `admin.generateLink(type=signup)` creates the Supabase confirmation link without using Supabase SMTP.
- Confirmation email is sent through `crypto-lab-mail-dispatch` using the predefined `signup_confirmation` template.
- If email delivery fails, the newly created Auth user is deleted so the user can safely retry.
- Existing-email responses remain generic to reduce account enumeration.

## Frontend

`v79/account-actions.js` now:

- reads registration status from the Edge Function;
- keeps the registration form hidden when server activation is incomplete;
- permanently blocks direct `client.auth.signUp` and built-in recovery email calls;
- dynamically loads Cloudflare Turnstile only when registration is enabled;
- submits registration only to the protected Edge Function;
- supports RU / UA / EN status and error messages.

PWA build `7915` invalidates the previous cache and loads the new registration controls.

## Verification

- Registration config GET returned HTTP 200 with `enabled=false` while Turnstile settings are absent.
- Registration POST returned HTTP 503 `REGISTRATION_DISABLED` before parsing or reserving an attempt.
- No registration-attempt row was created by the disabled-flow test.
- No email was sent and no Auth user was created by this verification.
- Public validator confirmed HTTP 200 and valid JavaScript for index, app shell, app extension, service worker, account page and account actions.
- The validator was restored to mandatory JWT after verification.

## Activation dependency

To activate public registration, create a Cloudflare Turnstile widget for `1specnazov1.github.io`, add its site key and secret key to the CRYPTO LAB Supabase Edge Function secrets, then set `CRYPTO_PUBLIC_REGISTRATION_ENABLED=true`.

Do not enable public registration or built-in Supabase SMTP before these three settings are configured and a deliberate smoke test is performed using an owned, monitored mailbox.

The working v78 root application was not modified.
