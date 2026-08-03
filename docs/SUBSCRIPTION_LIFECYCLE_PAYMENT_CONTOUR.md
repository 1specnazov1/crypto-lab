# CRYPTO LAB v79 — Subscription lifecycle and payment contour

Build: `7925`

Implemented on 2026-08-03 for Supabase project `txhzxbizjpinowepfjkm` and the isolated `v79` GitHub Pages application. The working v78 application was not modified.

## Commercial boundary

No BASIC or PRO price was invented or activated.

Current paid-plan records remain:

- BASIC: amount `NULL`, provider `unconfigured`, inactive;
- PRO: amount `NULL`, provider `unconfigured`, inactive.

The system therefore cannot create a charge or expose a checkout URL. The new payment contour stores configuration and payment intent metadata only after an administrator explicitly provides a real amount and provider.

## Subscription lifecycle model

`crypto_subscriptions` now also records:

- scheduled plan and scheduled change time;
- cancellation-request time;
- pause time;
- end time;
- lifecycle version;
- last lifecycle event time.

New private audit table: `crypto_subscription_events`.

It records bounded lifecycle events such as:

- trial started;
- activation and plan change;
- cancellation requested or revoked;
- pause and resume;
- immediate cancellation or expiry;
- payment intent creation;
- scheduled plan change.

The table uses RLS with explicit client-deny policies. Browser clients receive only their own bounded history through protected RPC functions.

## User operations

New RPC functions:

- `get_my_crypto_subscription_lifecycle()`;
- `request_crypto_subscription_cancellation()`;
- `resume_crypto_subscription()`;
- `create_crypto_checkout_intent(plan, currency, billing_interval)`.

The checkout-intent function requires:

- an authenticated user;
- current legal-document acceptance;
- BASIC or PRO;
- an active price with a positive amount;
- a configured provider.

When these conditions are absent, it returns `checkout_unavailable` and creates no order.

Even after a price is configured, the current contour returns `provider_adapter_pending` with no checkout URL until a real provider adapter is deployed. No payment is captured by this stage.

## Payment-order foundation

`crypto_billing_orders` now includes:

- billing interval;
- source plan-request ID;
- idempotency key;
- completion and failure timestamps;
- bounded failure code.

A unique partial index prevents duplicate payment intents for the same idempotency key. Created intents expire after 30 minutes.

## Automated lifecycle processing

Private function: `run_crypto_subscription_lifecycle()`.

Scheduled job:

- name: `crypto-lab-subscription-lifecycle`;
- schedule: every 15 minutes;
- active: yes.

The job:

- marks expired payment intents as expired;
- expires paid access whose period has ended;
- applies future scheduled plan changes;
- writes lifecycle audit events.

A deliberate manual run completed with:

- expired subscriptions: 0;
- scheduled changes applied: 0;
- expired payment intents: 0.

## Administrative operations

New protected RPC functions:

- `get_crypto_admin_commercial_dashboard()`;
- `admin_configure_crypto_plan_price(...)`;
- `admin_transition_crypto_subscription(...)`.

The administrator can explicitly configure:

- plan;
- currency;
- month or year interval;
- amount in minor currency units;
- provider: unconfigured, manual, LiqPay or Stripe;
- active or inactive state.

An active price is rejected unless a positive amount and non-unconfigured provider are supplied.

Lifecycle actions include:

- start trial;
- activate;
- pause;
- resume;
- cancel at period end;
- revoke cancellation;
- cancel immediately;
- expire.

Starting or activating BASIC/PRO is rejected by the server unless a future period-end date is supplied.

The old one-click admin plan buttons are hidden in the new commercial operations panel so that paid access is not granted with an implicit duration.

## User and admin interface

New files:

- `v79/subscription-lifecycle.js`;
- `v79/admin-commercial.js`.

The account page now displays:

- effective plan and subscription status;
- period end and cancellation state;
- cancellation and resume controls;
- pending plan request;
- configured or blocked checkout state;
- payment-intent history;
- subscription event history.

The admin panel now displays:

- lifecycle counts;
- explicit price configuration forms;
- explicit subscription-transition form;
- pending requests;
- recent payment intents;
- subscription event audit.

## Data portability and deletion

`crypto-lab-v79-data-export` version 3 includes:

- expanded subscription lifecycle fields;
- subscription event history;
- expanded payment-order state;
- all previously exported profile, portfolio, journal, AI, backtest, legal and support data.

`crypto-lab-v79-admin-deletions` version 3 includes subscription-event rows in the pre-deletion audit count. Subscription events reference Auth users with `ON DELETE CASCADE`.

## Operational monitoring

The protected admin health RPC now reports:

- active, trialing and past-due subscriptions;
- cancellation-at-period-end count;
- paid subscriptions already due for expiry;
- open and overdue payment intents;
- number of configured paid prices;
- subscription lifecycle cron status.

## Verification

- Local-only transactional Auth rows were used; no hosted sign-up endpoint and no email delivery were used.
- Cancellation, cancellation revocation, checkout-unavailable, admin pause/resume and event creation completed inside a rolled-back transaction.
- The transaction produced four lifecycle events before rollback.
- After rollback: 0 temporary Auth users, 0 subscription events and 0 billing orders.
- Public build validation confirmed HTTP 200 and valid JavaScript for index, app shell, commercial extension, user lifecycle module, admin commercial module and service worker.
- The validator was restored to mandatory JWT.
- Unauthenticated export and account-deletion requests return HTTP 401.
- Supabase Performance Advisor has no unindexed foreign-key or RLS initialization warning for this block; remaining notices are informational unused-index reports on new or empty tables.

## Remaining dependencies

Commercial charging remains intentionally blocked until the user provides business decisions and secrets for:

- BASIC price;
- PRO price;
- billing interval and currency;
- payment provider choice;
- provider merchant credentials and webhook secret;
- refund and cancellation policy details.

Public registration and password recovery remain disabled until Cloudflare Turnstile keys and explicit activation flags are configured. No email was sent during this block.
