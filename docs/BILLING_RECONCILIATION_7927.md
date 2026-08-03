# CRYPTO LAB v79 — Billing reconciliation and refund review

Build: `7927`

Implemented on 2026-08-03 for Supabase project `txhzxbizjpinowepfjkm` and the isolated `v79` GitHub Pages application. The working `v78` application was not modified.

## Commercial boundary

No paid price, merchant account, provider credential or webhook secret was introduced.

Current pricing remains:

- BASIC: amount `NULL`, provider `unconfigured`, inactive;
- PRO: amount `NULL`, provider `unconfigured`, inactive;
- FREE: amount `0`, provider `internal`, active.

The normalized billing webhook remains disabled because `CRYPTO_BILLING_WEBHOOK_SECRET` is not configured. Its GET status reports `enabled=false`; no event can be accepted or trigger access without the missing secret.

## Reconciliation model

New table: `crypto_billing_anomalies`.

It records deterministic fingerprints for:

- a paid order without matching active access;
- provider-managed paid access without a paid order;
- an unresolved refund/access decision;
- retry exhaustion;
- a stale processing lock;
- an invalid active subscription period.

Each anomaly stores severity, bounded details, first and last detection time, occurrence count, status and administrative resolution. RLS denies direct browser access.

New hourly job:

- name: `crypto-lab-billing-reconciliation`;
- schedule: minute 7 of every hour;
- active: yes.

The job releases stale event locks, detects billing/subscription mismatches and automatically resolves findings that no longer exist. Ignored fingerprints remain suppressed unless an administrator explicitly changes the decision.

## Administrative decision audit

New table: `crypto_billing_review_actions`.

It records:

- billing event and order references;
- affected user;
- administrator;
- resolution;
- mandatory note;
- bounded before/after state;
- timestamp.

The table is protected with RLS and direct client denial.

## Atomic refund decisions

`admin_review_crypto_billing_event(...)` now performs the access decision instead of only recording a note.

For a refund event:

- `access_retained` keeps the subscription active, removes the open refund flag, creates a lifecycle event and records an ignored exception;
- `access_revoked` cancels access atomically, clears cancellation scheduling, removes the refund flag and creates a lifecycle event;
- generic acknowledgement is rejected until an explicit access decision is selected.

New lifecycle events:

- `refund_access_retained`;
- `refund_access_revoked`;
- `billing_reconciled`.

Manual retry requests are also written to the decision audit.

## Administrative interface

`v79/admin-billing-events.js` now includes:

- webhook, retry-cron and reconciliation-cron readiness badges;
- event, review and anomaly counts;
- atomic refund decision controls;
- anomaly resolution and intentional-exception controls;
- recent normalized events;
- administrative decision history;
- responsive mobile layouts.

`v79/admin-health.js` now includes billing failures, retries, unresolved reviews, anomalies and critical anomalies in operational health.

## Data portability and deletion

`crypto-lab-v79-data-export` version 4 exports normalized user-owned billing summaries, review decisions and reconciliation anomalies. Raw provider webhook payloads, signatures and private identifiers remain excluded.

`crypto-lab-v79-admin-deletions` version 4 includes billing events, review actions and anomalies in the pre-deletion row audit. Related rows use cascading user deletion.

## Reliability verification

A rollback-only database test created local Auth rows without email addresses and verified:

- reconciliation detected the refund/access mismatch;
- `access_revoked` changed the subscription to `canceled` atomically;
- the refund metadata flag was removed;
- one review action was written;
- `refund_access_revoked` was written to lifecycle history;
- related anomalies were resolved;
- the transaction was rolled back.

After rollback and final reconciliation:

- Auth users: 0;
- billing events: 0;
- billing orders: 0;
- billing anomalies: 0;
- billing review actions: 0;
- registration attempts: 0;
- recovery attempts: 0.

No registration, recovery or transactional email was sent.

## Public build verification

GitHub Pages returned HTTP 200 for:

- `index.html`;
- `app.html`;
- `commercial-extension.js`;
- `admin-billing-events.js`;
- `service-worker.js`.

JavaScript syntax checks passed and build markers were confirmed as `7927`. The temporary validator was restored to mandatory JWT.

Unauthenticated data export and administrative deletion requests return HTTP 401.

## Remaining dependencies

Commercial charging remains blocked until the user supplies:

- BASIC and PRO prices;
- billing currency and interval;
- provider choice;
- merchant credentials;
- provider webhook secret and adapter-specific signature rules;
- refund/access policy and cancellation policy.

Public registration and password recovery remain blocked until Cloudflare Turnstile keys and explicit activation flags are supplied.
