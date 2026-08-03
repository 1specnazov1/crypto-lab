# CRYPTO LAB v79 — build 7921

Release date: 2026-08-03

This build changes only the v79 preview and the CRYPTO LAB Supabase project. The working v78 application is unchanged.

## Legal and privacy readiness

The Privacy Notice, Terms of Use and Risk Disclosure now share a hardened renderer and support Russian, Ukrainian and English.

Controls added to the legal pages:

- restrictive Content Security Policy;
- no-referrer policy;
- preview-only noindex/nofollow;
- mobile and print layouts;
- language-aware links from the application shell;
- explicit statements about market-data limitations, AI uncertainty, backtest assumptions, leverage and user responsibility;
- documentation of data export and queued account-deletion requests.

These pages remain working drafts. Before accepting payments, the operator identity, contact details, governing law, refund terms, payment-provider rules, deletion-processing period and mandatory-retention exceptions must be approved and published.

## Data portability

The existing protected Edge Function `crypto-lab-v79-data-export` remains the only public export path. It validates the signed-in user and exports only that user's CRYPTO LAB records.

A redundant database export RPC was briefly created during implementation and removed after the Supabase security advisor identified unnecessary authenticated access to a SECURITY DEFINER function. The final security advisor result is clean.

## Password recovery foundation

The built-in Supabase password-recovery email method remains blocked in the browser.

Prepared components:

- table `crypto_recovery_attempts` with RLS and explicit deny policies;
- service-role-only atomic reservation and completion RPC functions;
- HMAC-based IP and email identifiers rather than plaintext values;
- hourly and daily IP/email limits plus a global hourly ceiling;
- v79 client panel with separate CAPTCHA state, honeypot field, generic anti-enumeration response and RU/UA/EN copy;
- Edge Function `crypto-lab-v79-recover` with strict GitHub Pages origin restriction.

Current release behavior:

- recovery configuration returns `enabled=false`;
- recovery POST returns `RECOVERY_DISABLED` before parsing user data or reserving an attempt;
- the recovery button remains hidden;
- no recovery email is sent;
- the protected CRYPTO LAB → Lumeria → Resend channel is not invoked.

Activation dependencies:

- `CRYPTO_TURNSTILE_SITE_KEY`;
- `CRYPTO_TURNSTILE_SECRET_KEY`;
- explicit recovery activation flag;
- final protected server handler and a deliberate smoke test using an owned, monitored mailbox.

Public registration remains independently disabled and still requires its own explicit activation flag.

## PWA build

Build `7921` invalidates the previous application cache and loads the updated account controls. The existing service-worker update prompt and offline shell remain in place.

## Verification

- recovery GET: HTTP 200, `enabled=false`;
- recovery POST: HTTP 503, `RECOVERY_DISABLED`;
- recovery-attempt rows after disabled-flow verification: 0;
- no email was sent and no external test address was used;
- GitHub Pages index, app shell, app extension, service worker, account actions and all legal files returned HTTP 200;
- JavaScript syntax validation passed for all checked files;
- build markers for `7921` were present after GitHub Pages propagation;
- temporary public validator was restored to mandatory JWT;
- Supabase security advisor: no findings.

Performance advisor entries are currently informational unused-index notices. The new recovery indexes are intentionally retained because the recovery endpoint is not yet active and therefore has no production query history.
