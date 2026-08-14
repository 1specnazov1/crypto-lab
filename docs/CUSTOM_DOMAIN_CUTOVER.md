# CRYPTO LAB — Custom Domain Cutover

Current public host: `1specnazov1.github.io/crypto-lab/v79/`.

This document is intentionally domain-neutral. Do not change production routing until the owner has selected and controls the target domain.

## Goal

Move CRYPTO LAB to a clean HTTPS host such as `app.<domain>` or `<domain>` without breaking authentication, invitations, password recovery, PWA installation, Telegram links, Edge Function CORS, or existing GitHub Pages access.

## Phase 0 — inventory (safe now)

Run:

```bash
node scripts/custom-domain-readiness.mjs
```

This reports every repository reference to the current GitHub Pages host or legacy `localhost:3000` redirects. It is inventory-only and makes no changes.

## Phase 1 — after a domain is selected

1. Confirm ownership and DNS access.
2. Decide canonical host: apex domain or `app.` subdomain.
3. Add a `CNAME` file containing only the canonical host.
4. Configure DNS for GitHub Pages and wait for verification.
5. Enable HTTPS in GitHub Pages before redirecting users.
6. Add the new origin to every protected Edge Function CORS allowlist while retaining the old GitHub Pages origin during migration.
7. Update generated Telegram action URLs and browser canonical URLs.
8. Add the new origin/redirect URLs to Supabase Auth configuration for login, invitations, confirmation and password recovery.
9. Update recovery/invite mail templates to the canonical CRYPTO LAB host.
10. Update PWA `id`, `start_url`, scope assumptions and service-worker origin tests only after the canonical path is final.

## Phase 2 — dual-origin verification

Before making the new domain canonical, verify both old and new hosts:

- Home / News / Scanner / AI / Portfolio / Backtest / Journal / Account.
- Existing login session and clean login.
- Invitation request and invitation activation.
- Email confirmation.
- Password recovery; no redirect to localhost.
- Admin and Admin → Signals & Telegram.
- Telegram pre-flight and one explicit TEST message.
- PWA install, update and offline shell.
- Binance live-price consensus and chart interaction.
- Scanner/SHADOW jobs and operational watchdog.

## Phase 3 — cutover gate

Set the target host in CI and run:

```bash
CRYPTO_TARGET_DOMAIN=example.com node scripts/custom-domain-readiness.mjs
```

The gate fails if:

- `CNAME` does not equal the target host;
- runtime files still contain the old GitHub Pages origin;
- runtime files still contain legacy localhost recovery redirects.

Only after this gate, browser smoke, PWA contract and Preview validation are green should public links be changed to the new domain.

## Rollback

Keep the GitHub Pages origin valid during the first production period. If auth, mail or CORS fails after cutover, restore the previous canonical links and remove the redirect while leaving the database and signal system unchanged.

## Non-goals

- This repository does not purchase domains.
- No DNS record is created until the owner provides a domain under their control.
- LIVE Telegram is not enabled as part of a domain migration.
