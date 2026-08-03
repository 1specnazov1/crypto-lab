# CRYPTO LAB v79 — Normalized billing webhook state machine

Build: `7926`

Implemented on 2026-08-03 for Supabase project `txhzxbizjpinowepfjkm` and the isolated `v79` GitHub Pages application. The working v78 application was not modified.

## Commercial boundary

No real payment provider, merchant credential, webhook secret, BASIC price or PRO price was configured.

The public normalized webhook endpoint therefore reports `enabled=false` and rejects POST requests with `WEBHOOK_DISABLED` before an event or order can be created. This block cannot charge money.

## Normalized webhook endpoint

Edge Function: `crypto-lab-v79-billing-webhook`.

It is intentionally deployed with `verify_jwt=false` because payment callbacks occur before a user JWT is available. Access is instead protected by the server-only `CRYPTO_BILLING_WEBHOOK_SECRET` header credential.

Controls:

- secret must contain at least 32 characters;
- timing-safe secret comparison;
- 40 KB request limit;
- normalized provider allow-list: Manual, LiqPay and Stripe;
- strict UUID, provider-event ID and event-type validation;
- amount and ISO currency required for successful payment, renewal and refund events;
- provider adapter must validate the original provider signature before forwarding a normalized event;
- no browser CORS flow is exposed.

Supported normalized event types:

- `payment.pending`;
- `payment.succeeded`;
- `payment.failed`;
- `payment.expired`;
- `payment.canceled`;
- `payment.refunded`;
- `subscription.renewed`;
- `subscription.cancel_at_period_end`;
- `subscription.canceled`.

## Idempotent event ledger

`crypto_billing_events` now stores:

- linked billing order and user;
- event processing state;
- signature-verification state;
- canonical SHA-256 payload hash;
- processing attempts and retry time;
- source, normalization and processing timestamps;
- bounded error codes;
- manual-review state and decision metadata.

The existing unique key `(provider, provider_event_id)` prevents duplicate provider events. A duplicate with the same canonical payload returns the original event result. Reuse of the same event ID with a different payload is rejected as a collision.

The ledger remains private: RLS is enabled, direct `anon` and `authenticated` table access is denied, and ingestion is granted only to `service_role`.

## Order state machine

Allowed order progressions include:

- created → pending, failed, expired, canceled or paid;
- pending → failed, expired, canceled or paid;
- a delayed verified success may reconcile failed, expired or canceled to paid;
- paid → refunded;
- refunded is terminal.

Regressive events are preserved in the ledger but marked `ignored`. Example: a late `payment.failed` event after a verified paid event cannot downgrade the paid order or subscription.

Before state mutation, the processor verifies:

- event provider equals order provider;
- event user equals order user;
- amount equals the stored order amount;
- currency equals the stored order currency;
- provider-order identifier does not conflict with an existing value.

## Subscription effects

A verified successful payment or renewal:

- marks the order paid;
- activates the purchased plan;
- sets the current billing period;
- records provider customer and subscription identifiers when supplied;
- clears pause, cancellation and scheduled-change flags;
- approves the linked pending plan request;
- writes a subscription lifecycle event.

A provider cancellation event updates the subscription lifecycle through the same bounded audit model.

A refund marks the order refunded but does **not** automatically revoke access because refund-access policy has not yet been approved. Instead it:

- flags the billing event for manual review;
- marks the subscription metadata as requiring refund review;
- creates a `payment_refunded_review_required` lifecycle event.

The administrator must separately apply the approved access policy and then record the review result.

## Retry and dead-letter behavior

Private function: `retry_crypto_billing_events(25)`.

Scheduled job:

- name: `crypto-lab-billing-event-retry`;
- schedule: every 5 minutes;
- active: yes.

Failed events use progressive retry delays of 1, 5, 15 and 60 minutes. After five unsuccessful attempts, the event leaves automatic retry and moves to the manual-review queue.

## Administrative interface

New file: `v79/admin-billing-events.js`.

The admin panel displays:

- webhook-secret readiness without revealing the secret;
- retry-cron state;
- event counts by processing status;
- recent normalized events;
- order, user, amount, event status and bounded errors;
- retry-required and refund-review queues.

Admin operations:

- retry a failed or ignored event;
- record that access was retained;
- record that access was revoked separately;
- record provider reconciliation;
- require a bounded explanatory note for every review decision.

Marking a review as `access_revoked` does not silently change the subscription. The actual subscription transition remains an explicit, separately audited administrative operation.

## Verification

A direct database test used a temporary local-only Auth user and a Manual billing order. No hosted signup endpoint and no email delivery were used.

Verified sequence:

1. `payment.pending` changed the order to pending;
2. replaying the same event returned the original processed event as a duplicate;
3. `payment.succeeded` changed the order to paid and activated BASIC for one month;
4. a late `payment.failed` event was marked ignored and did not downgrade the paid state;
5. `payment.refunded` changed the order to refunded while leaving the subscription active and creating a manual-review requirement;
6. all temporary users, orders, events and lifecycle rows were removed after the test.

Additional checks:

- webhook GET returned HTTP 200 with `enabled=false`;
- webhook POST returned HTTP 503 `WEBHOOK_DISABLED`;
- the disabled test created zero billing-event rows;
- the retry cron completed with zero failed events;
- GitHub Pages build validation returned HTTP 200 and valid JavaScript for index, app shell, commercial extension, admin billing panel and service worker;
- the temporary validator was restored to mandatory JWT;
- the PWA cache was updated to `crypto-lab-v79-7926`.

## Remaining dependencies

Real payment processing remains blocked until the owner approves and supplies:

- payment provider;
- BASIC and PRO prices;
- currency and billing interval;
- merchant credentials;
- provider-specific webhook signature secret;
- internal normalized-webhook secret;
- refund, chargeback and cancellation access policy;
- production test mailbox and deliberate end-to-end test plan.

Public registration and password recovery remain disabled until Cloudflare Turnstile keys and explicit activation flags are configured. No email was sent during this block.
