# CRYPTO LAB v79 — Accessibility, session security and administrative audit

Application build: `7929`

Completed and verified on 2026-08-04 for Supabase project `txhzxbizjpinowepfjkm` and the isolated GitHub Pages application under `v79/`.

The working root v78 application was not modified. Its root `index.html` blob SHA remains:

`4a278c891d37b3760ec1ac988690ea9ad587b24e`

## 1. Supabase database hardening

Applied migrations:

- `crypto_lab_v79_admin_audit_session_security`;
- `crypto_lab_v79_admin_audit_noise_control`.

### Append-only administrative audit

Created protected table:

`public.crypto_admin_audit_log`

Recorded fields include:

- immutable audit ID and timestamp;
- authenticated administrator user ID and bounded email snapshot;
- action and entity type;
- entity identifier;
- severity and source;
- correlation UUID;
- bounded old and new state snapshots;
- bounded metadata.

Security characteristics:

- Row Level Security enabled;
- no direct browser insert, update or delete access;
- append-only trigger path;
- protected administrator read RPC;
- no secret values are intentionally persisted;
- audit noise control excludes irrelevant timestamp-only changes.

Audit triggers now cover critical changes to:

- subscriptions;
- support tickets;
- plan prices;
- normalized billing events;
- billing anomalies;
- provider adapter readiness.

Administrator interface RPC:

`get_crypto_admin_audit(p_limit, p_action, p_entity_type)`

The RPC supports bounded retrieval and action/entity filtering after server-side administrator verification.

### Session security state

Created authenticated RPC:

`get_my_crypto_security_state()`

It returns only the current user's bounded security state:

- user ID;
- email-confirmation timestamp;
- account creation timestamp;
- last sign-in timestamp;
- current session expiry;
- Authentication Assurance Level;
- JWT role.

No session token, refresh token, password, provider secret or service-role key is returned.

### Rollback-only verification

A transaction-local Auth user and administrator profile without an email address were used to verify:

- protected session-state retrieval;
- trigger capture of a critical support-ticket transition;
- old/new state recording;
- action, source and severity normalization;
- administrator audit RPC access.

The transaction was rolled back. Final audit-table count after verification is `0`, proving no test audit rows or test users remained. No email was sent.

## 2. Accessibility implementation

New shared files:

- `v79/accessibility.js`;
- `v79/module-accessibility.js`.

### Shell accessibility

Implemented:

- keyboard-visible skip link to the main content;
- visible `:focus-visible` indicators;
- reduced-motion handling;
- correct document language for RU, UA and EN;
- accessible navigation label;
- `aria-current="page"` on the active route;
- menu `aria-label`, `aria-controls` and synchronized `aria-expanded`;
- Escape-key mobile menu close with focus returned to the menu button;
- live route announcements;
- labels for language and scanner filter controls;
- table labels;
- keyboard activation for the interactive BTC chart card;
- route-specific iframe titles;
- `noopener noreferrer` hardening for external-window links.

### Framed module accessibility

For v79 iframe modules, the shared helper adds:

- missing input/select/textarea labels derived from nearby form labels or field names;
- labels for icon-only buttons;
- accessible chart descriptions;
- table descriptions;
- polite live regions for messages and status notices;
- focus-visible styling;
- reduced-motion behavior.

This is a practical accessibility hardening pass, not a formal third-party WCAG certification.

## 3. Account and session security

New account module:

`v79/session-security.js`

The account page now displays:

- email-confirmation state;
- Authentication Assurance Level;
- current session expiry countdown;
- last sign-in time.

Available actions:

- refresh the current session;
- global sign-out across Supabase sessions;
- cross-tab sign-out synchronization using `BroadcastChannel` with a storage-event fallback.

The module does not expose tokens in the interface or application logs.

## 4. Administrator session protection

New module:

`v79/admin-session-security.js`

Implemented:

- local administrator inactivity limit of 30 minutes;
- warning during the final five minutes;
- automatic local sign-out after timeout;
- activity refresh for keyboard, pointer and touch interaction;
- visible remaining-session state in the administrator interface.

This client-side control supplements Supabase session expiry and server-side administrator role verification. It does not replace server authorization.

## 5. Administrative audit interface

New module:

`v79/admin-audit.js`

The administrator dashboard now provides:

- recent critical administrative events;
- action filter;
- entity-type filter;
- severity, source and timestamp;
- actor identity snapshot;
- correlation UUID;
- bounded state-change summary.

The browser cannot insert or rewrite audit history.

## 6. PWA, offline and update hardening

Build cache:

`crypto-lab-v79-7929`

The service worker now includes the accessibility, account-security and audit assets in its application shell.

Implemented and tested:

- navigation network-first behavior with offline fallback;
- static cache fallback with query-string tolerance using `ignoreSearch`;
- explicit `SKIP_WAITING` support;
- explicit old-cache cleanup message `CLEAR_OLD_CACHES`;
- automatic deletion of prior `crypto-lab-v79-*` caches during activation;
- cached module navigation while the browser context is offline.

## 7. Automated browser verification

Playwright profiles:

- mobile Chromium `390 × 844`;
- mobile Chromium `412 × 915`;
- desktop Chromium `1440 × 900`.

Tests cover:

- application shell and route navigation;
- mobile menu behavior;
- module iframe rendering;
- horizontal overflow;
- unnamed visible buttons;
- skip-link focus transfer;
- active-route semantics;
- Escape-key focus restoration;
- framed-module control labels;
- PWA manifest and service-worker registration;
- offline cached Calculator module;
- language persistence.

An initial expanded run correctly exposed a test-flow issue: after validating Escape-key menu closure, the mobile test attempted to click an off-canvas route without reopening navigation. The test was corrected to reproduce the actual user flow.

Final verified browser result:

- workflow: `V79 Browser Smoke`;
- run ID: `30854617205`;
- commit: `90c0312b7d74861ea10db5729b095f6edcffa541`;
- result: `15 passed`;
- duration: `13.4 seconds`;
- conclusion: `success`.

The report artifact was uploaded by GitHub Actions.

## 8. Static release validation

Final verified static release result:

- workflow: `Validate v79 Preview`;
- run ID: `30854617385`;
- commit: `90c0312b7d74861ea10db5729b095f6edcffa541`;
- conclusion: `success`.

The release gate validates:

- JavaScript syntax, including inline scripts;
- package build version `79.29.0`;
- build-number alignment across entry point, application shell, extension loader and service worker;
- presence of every required accessibility/security/audit asset;
- local HTML references;
- service-worker cache references;
- normalized billing JSON schema;
- browser-test markers;
- absence of known server-secret identifiers from public v79 assets.

## 9. Public deployment verification

GitHub Pages deployment run:

- run ID: `30854616170`;
- conclusion: `success`.

Public HTTP verification returned `200` with the expected build markers for:

- `v79/index.html`;
- `v79/app.html?v=7929`;
- `v79/accessibility.js?v=7929`;
- `v79/session-security.js?v=7929`;
- `v79/admin-audit.js?v=7929`;
- `v79/service-worker.js?v=7929`.

## 10. Security and performance advisors

Supabase Security Advisor result:

- zero security lints.

Performance Advisor result:

- no new missing foreign-key index warning;
- only informational unused-index notices.

No index was removed because the current database is pre-launch and low-volume; an unused index at this stage is not enough evidence that it is unnecessary in production.

## 11. Commercial and activation boundary

This block did not:

- send any email;
- create any external test email account;
- enable public registration;
- enable password recovery;
- install Turnstile keys;
- select LiqPay or Stripe for production;
- configure a paid BASIC or PRO price;
- enable checkout, payment webhooks, recurring payments or refunds;
- add merchant credentials or payment secrets;
- replace v78 with v79.

Provider state remains:

- LiqPay: `disabled / draft`;
- Stripe: `disabled / draft`;
- manual: `disabled / draft`.

All provider checkout, webhook, recurring-payment and refund flags remain false. The only active catalog row is the internal FREE plan at zero cost.

## 12. Remaining independent engineering work

The next autonomous engineering priorities are:

1. expand administrator audit coverage to account-deletion decisions and other critical operational paths where duplication with existing specialized audit tables is avoided;
2. add CSP/reporting and client-error correlation improvements without exposing user data;
3. strengthen data-retention maintenance evidence and restore drills;
4. perform manual visual review on physical Android and iOS devices;
5. prepare the final production cutover and rollback runbook;
6. continue refining the launch-readiness scorecard as hard blockers are removed.
