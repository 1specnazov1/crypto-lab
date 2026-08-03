# CRYPTO LAB email safety

## Current production state

- Supabase project: `txhzxbizjpinowepfjkm` (`crypto-lab-ai`).
- Public email sign-up is disabled in Supabase Auth.
- Anonymous sign-in and manual account linking are disabled.
- The v79 account UI hides sign-up and password recovery until protected delivery is enabled.
- Automated tests must never call hosted `/auth/v1/signup`, recovery, OTP, magic-link, invite, or email-change endpoints with fabricated external addresses.

## Protected delivery path

CRYPTO LAB transactional email is routed through the verified Resend domain already used by Lumeria.

1. `crypto-lab-ai` server code calls the service-only Edge Function `crypto-lab-mail-dispatch`.
2. The function reads a shared relay credential from the private database schema.
3. It calls the Lumeria Edge Function `crypto-lab-auth-mail`.
4. `crypto-lab-auth-mail` uses the project-level `RESEND_API_KEY` and the verified domain `lumeria-astro.com.ua`.
5. The sender is fixed to `CRYPTO LAB <crypto-lab@lumeria-astro.com.ua>`.
6. Only predefined transactional templates are accepted: sign-up confirmation, password recovery, security notice, and an owner-only system test.
7. Delivery attempts are logged with a SHA-256 recipient hash rather than a plaintext email address.

## Security controls

- `crypto-lab-mail-dispatch` requires a valid JWT and additionally requires the exact `service_role` token.
- `crypto-lab-auth-mail` requires a valid Lumeria JWT plus a separate server-only relay credential.
- The relay credential is stored only in private database tables and exposed only through RPC functions granted to `service_role`.
- Arbitrary subjects and arbitrary HTML are not accepted by the Resend-facing function.
- The test template can send only to the project owner's monitored mailbox.
- Confirmation and recovery links must use HTTPS and an allow-listed CRYPTO LAB host.

## Release rules

Before enabling public registration:

1. Keep Supabase `Allow new users to sign up` disabled until the final registration flow is ready.
2. Do not re-enable the built-in Supabase SMTP path for automated tests.
3. Use local Supabase Mailpit or a dedicated staging project for email-flow tests.
4. Add CAPTCHA and server-side rate limiting before any unauthenticated registration endpoint is exposed.
5. Keep email confirmation enabled when registration is eventually opened.
6. Check Supabase Auth logs for unexpected `mail.send` events and Resend logs for bounces or suppressions.
7. Use only owned, monitored mailboxes for deliberate production smoke tests.

## Incident note — 2026-08-03

The bounce warning was caused by development tests that submitted realistic but nonexistent Gmail and Outlook addresses to the hosted Supabase Auth sign-up endpoint. The source was removed, public sign-up was disabled, and no later Supabase `mail.send` events were observed.
