# CRYPTO LAB v79 — Feature enforcement, security and PWA recovery

Applied on 2026-08-02 to Supabase project `txhzxbizjpinowepfjkm` and GitHub repository `1specnazov1/crypto-lab`.

## Database migration

Migration: `crypto_lab_v79_feature_enforcement_security`

### Added

- `crypto_feature_access_leases` — short-lived authenticated scanner access leases.
- `get_crypto_feature_status(feature)` — reads the caller's plan, usage and remaining daily quota without consuming it.
- `acquire_crypto_feature_lease('scanner', minutes)` — consumes one scanner view only when no active lease exists. Repeated refreshes during the lease do not spend quota again.

### Security hardening

Anonymous execution was revoked for:

- `consume_crypto_feature`
- `get_crypto_feature_status`
- `acquire_crypto_feature_lease`
- `get_my_crypto_account`
- `request_crypto_plan`
- `get_crypto_admin_summary`
- `admin_set_crypto_subscription`

`crypto_is_admin()` is not executable by browser roles. Admin RPC functions remain executable by authenticated users but enforce the server-side admin role before returning or changing any data.

## Edge Functions

### `crypto-ai-advisor` v7

- JWT required.
- Daily AI quota is consumed server-side before the OpenAI request.
- Returns structured quota information.
- Supports RU / UA / EN response language.
- Keeps per-minute abuse protection and strict input limits.

### `crypto-lab-v79-backtest-data` v1

- JWT required.
- Consumes the backtest quota server-side.
- Validates symbol, interval and candle count.
- Returns only closed Binance candles.
- Uses Binance Data API with Binance API fallback.

### `crypto-lab-v79-scanner` v1

- JWT required.
- Acquires a 15-minute scanner lease through the database.
- Proxies the v79 dashboard only after the access check.
- Automatic 30-second refresh does not consume a new view during the lease.

## Frontend build 7905

- `v79/scanner.html` — authenticated quota-protected scanner.
- `v79/ai.html` — authenticated AI analysis UI.
- `v79/backtest.html` — rebuilt to request protected closed-candle data from the Edge Function.
- `v79/app-extension.js` — routes Scanner, AI, Backtest and Account through framed modules.
- `v79/manifest.webmanifest`, `service-worker.js`, `offline.html`, `icon.svg` — installable PWA shell and offline fallback.
- `v79/platform.css` — safe-area, mobile and standalone-mode improvements.
- `privacy.html`, `terms.html`, `risk-disclosure.html` — pre-launch legal drafts requiring counsel review.

## Verified tests

- All 22 v79 files returned HTTP 200 from GitHub Pages.
- All JavaScript and inline scripts passed syntax parsing.
- The PWA manifest parsed as JSON.
- FREE backtest quota: calls 1–3 allowed, call 4 denied.
- Scanner lease: first call consumed one view; immediate second call reused the lease and did not consume another view.
- Anonymous execution grants were removed from protected RPC functions.
- All three protected Edge Functions returned HTTP 401 without an Authorization header.
- The temporary Auth test user and all related profile, usage and lease rows were deleted.

The working v78 site was not modified.
