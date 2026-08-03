# CRYPTO LAB v79 — Accessibility, session security, admin audit and offline resilience

Application build: `7929`

Implemented and verified on 2026-08-04 for Supabase project `txhzxbizjpinowepfjkm` and the isolated `v79` GitHub Pages application. The working v78 root application was not modified.

## Accessibility layer

Created:

- `v79/accessibility.js`;
- `v79/module-accessibility.js`.

The shell accessibility layer adds:

- a keyboard skip link to the main application content;
- focusable main content target;
- RU / UK / EN accessible labels;
- primary-navigation semantics;
- route-specific `aria-current` state;
- `aria-controls` and `aria-expanded` for the mobile menu;
- an accessible label for the language selector;
- route announcements through a polite live region;
- route-aware iframe titles;
- Escape-key closing of the mobile menu with focus returned to the menu button;
- high-visibility keyboard focus outlines;
- reduced-motion behavior for users who request it.

The module accessibility layer is injected into same-origin iframe modules and normalizes:

- form-control labels;
- unnamed button labels;
- canvas image roles and labels;
- table labels;
- status/live-region semantics;
- focus indicators and reduced-motion behavior.

## User session security

Created `v79/session-security.js` and the protected RPC `get_my_crypto_security_state()`.

The account interface now displays only non-secret session metadata:

- last sign-in time;
- email confirmation time;
- session expiry time;
- authentication assurance level;
- account role.

It also provides:

- safe session refresh;
- explicit global sign-out on all devices;
- cross-tab logout propagation with `BroadcastChannel`;
- session validation when the page becomes visible;
- periodic session validation every five minutes.

Access tokens, refresh tokens and password material are never displayed or written to the audit log.

## Administrator inactivity protection

Created `v79/admin-session-security.js`.

When the administrator dashboard is active:

- inactivity is tracked locally;
- a warning is shown during the final five minutes;
- the admin session is locked after 30 minutes without interaction;
- pointer, keyboard, touch and scroll activity reset the local inactivity timer;
- the local Supabase session is ended when the inactivity limit is reached.

This is an additional client-side protection. Server-side authorization and the `admin` role check remain authoritative for every privileged RPC.

## Critical administrative audit trail

Migrations:

- `crypto_lab_v79_admin_audit_session_security`;
- `crypto_lab_v79_admin_audit_noise_control`.

Created protected table `public.crypto_admin_audit_log` with RLS and no direct `anon` or `authenticated` access.

The audit records:

- actor user ID and bounded role information;
- source: administrator RPC or protected service process;
- operation, entity type and entity ID;
- severity;
- compact before and after state;
- correlation UUID;
- bounded user-agent and client metadata when available.

The audit deliberately excludes:

- email addresses from captured row state;
- passwords and authentication tokens;
- payment-provider secret values;
- billing event payloads;
- support message bodies;
- registration and recovery secrets.

Only allow-listed compact state is stored for:

- plan prices;
- subscriptions;
- plan requests;
- support-ticket status and priority;
- billing-event processing state;
- billing anomalies;
- provider-adapter readiness;
- account-deletion requests;
- user-role changes.

Normal user inserts are excluded. Audit triggers run only for update or delete operations. Human-only resources such as support tickets and plan requests record only authenticated administrator changes; service lifecycle resources can also record protected service transitions.

Created protected RPC `get_crypto_admin_audit(...)` with a public `SECURITY INVOKER` wrapper. Non-admin users cannot read the journal.

Created `v79/admin-audit.js` with filters, 24-hour counters, actor/source/severity, compact state changes and correlation IDs.

## Transactional database verification

A rollback-only test created one local user and one local administrator without email addresses and without sending mail.

Verified:

1. the user created a support ticket;
2. the user read their own session-security state;
3. the administrator changed the ticket from `open` to `resolved` and priority to `high`;
4. an `admin_rpc` audit entry recorded the compact old and new states;
5. the administrator could read the audit journal;
6. the regular user was denied audit access;
7. the complete test transaction rolled back.

After verification:

- temporary Auth users remaining: `0`;
- persistent test audit rows: `0`;
- emails sent: `0`.

## PWA and offline resilience

The service worker now uses cache `crypto-lab-v79-7929` and includes all new accessibility, session and audit assets.

Improvements:

- query-string-insensitive cache lookup;
- app-shell fallback for `/v79/`, `index.html` and `app.html` navigation;
- cached-module navigation while offline;
- network-first document navigation;
- cache-first static assets;
- controlled old-cache cleanup message;
- retained explicit update and `SKIP_WAITING` flow.

## Automated browser verification

The Playwright suite was expanded from 9 to 15 tests across:

- mobile Chromium 390 × 844;
- mobile Chromium 412 × 915;
- desktop Chromium 1440 × 900.

Verified scenarios:

- application shell and module routing;
- responsive mobile menu;
- no body-level horizontal overflow;
- visible buttons have accessible names;
- skip-link keyboard operation;
- navigation, menu and language semantics;
- Escape-key menu behavior and focus return;
- iframe module accessible-name normalization;
- PWA manifest and service-worker registration;
- build-7929 cache contents;
- cached Calculator module available while offline;
- language persistence after reload.

Final verified workflow:

- workflow: `V79 Browser Smoke`;
- run ID: `30854617205`;
- commit: `90c0312b7d74861ea10db5729b095f6edcffa541`;
- result: `15 passed`;
- conclusion: `success`.

Release gate:

- workflow: `Validate v79 Preview`;
- run ID: `30854617385`;
- conclusion: `success`.

GitHub Pages deployment:

- run ID: `30854616170`;
- conclusion: `success`.

## Public build verification

The following public build-7929 assets returned HTTP 200 and the expected markers:

- `index.html`;
- `app.html`;
- `commercial-extension.js`;
- `accessibility.js`;
- `module-accessibility.js`;
- `session-security.js`;
- `admin-audit.js`;
- `admin-session-security.js`;
- `service-worker.js`.

## Security and performance review

Supabase Security Advisor reports zero security lints.

The audit table has:

- RLS enabled;
- explicit deny policies for `anon` and `authenticated`;
- no direct client `SELECT` privilege;
- service-role access only;
- covering indexes for time, actor, entity and action queries.

Performance Advisor reports only informational `unused_index` notices for new or currently low-traffic tables. No missing foreign-key index warning remains for this block. These indexes are retained until real production query statistics are available.

## Commercial boundary retained

This block did not:

- enable public registration or password recovery;
- configure Cloudflare Turnstile;
- select LiqPay or Stripe for production;
- configure BASIC or PRO prices;
- install merchant credentials or webhook secrets;
- enable checkout, recurring billing or refunds;
- send any email;
- replace v78 with v79.

The root v78 `index.html` blob SHA remains `4a278c891d37b3760ec1ac988690ea9ad587b24e`.
