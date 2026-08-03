# CRYPTO LAB v79 — Provider adapter contracts

Target application build: `7928`
Contract version: `1`

This document defines the boundary between a real payment provider and the existing CRYPTO LAB normalized billing webhook. It does not enable payments, set prices, or contain credentials.

## Architecture

A provider adapter has five mandatory stages:

1. Receive the raw provider callback without modifying its body or encoded fields.
2. Verify the provider-specific signature using server-only credentials.
3. Retrieve or reconcile authoritative provider state when the callback is not sufficient.
4. Map the verified provider object to `crypto-billing-normalized-event-v1`.
5. Send the normalized event to `crypto-lab-v79-billing-webhook` using the internal `CRYPTO_BILLING_WEBHOOK_SECRET`.

The provider adapter must never call subscription tables directly. Access changes are made only by the existing normalized event state machine.

Machine-readable schema:

- `docs/schemas/crypto-billing-normalized-event-v1.schema.json`

## Common normalized envelope

Required fields:

- `provider`: `liqpay`, `stripe`, or `manual`;
- `provider_event_id`: immutable provider event identity;
- `event_type`: one supported normalized type;
- `order_id`: CRYPTO LAB billing-order UUID;
- `source_created_at`: provider event time when available;
- `payload`: verified provider data required for reconciliation.

For `payment.succeeded`, `payment.refunded`, and `subscription.renewed`, the payload must include integer `amount_minor` and an uppercase three-letter `currency`.

The adapter must preserve the provider order ID separately from the internal CRYPTO LAB order UUID.

## Idempotency

The same provider event can be delivered more than once. The adapter must produce the same `provider_event_id` and normalized payload every time.

The normalized webhook already rejects:

- a reused provider event ID with different content;
- unsupported event types;
- invalid internal order IDs;
- missing verified amount or currency for monetary terminal events.

Adapters must return a successful provider acknowledgement after the normalized endpoint accepts the event or identifies it as a duplicate.

## LiqPay adapter

### Raw callback

LiqPay sends a POST callback with form parameters:

- `data`: base64-encoded JSON;
- `signature`: callback signature.

The adapter must verify the signature against the exact received `data` value before decoding and normalizing it. The LiqPay private key is server-only.

Required runtime secret names:

- `LIQPAY_PUBLIC_KEY`;
- `LIQPAY_PRIVATE_KEY`;
- `CRYPTO_BILLING_WEBHOOK_SECRET`.

Checkout strategy: hosted redirect.
Webhook strategy: signed form callback.

### Internal order correlation

The LiqPay `order_id` must carry or map to the CRYPTO LAB billing-order UUID. The mapping must be established before redirecting the user to checkout and must not be inferred from email, amount, or description.

### Recommended status mapping

Provider status mapping must be implemented from the merchant account's actual LiqPay status set and tested in sandbox before activation.

Minimum normalized outcomes:

- non-final processing status → `payment.pending`;
- verified successful final status → `payment.succeeded`;
- verified failed final status → `payment.failed`;
- provider cancellation → `payment.canceled`;
- expired payment → `payment.expired`;
- verified refund → `payment.refunded`;
- successful recurring debit → `subscription.renewed`.

Unknown or contradictory statuses must not grant access. They must be stored as failed/review-required adapter diagnostics.

### Reconciliation

The adapter must support an authoritative status lookup by LiqPay `order_id`. Reconciliation is required when:

- callback delivery is delayed;
- the callback is non-final;
- a duplicate event has different provider metadata;
- the internal order remains pending beyond its expected payment window.

Official references:

- `https://www.liqpay.ua/doc/api/callback`
- `https://www.liqpay.ua/doc/api/information/status_payment`

## Stripe adapter

### Raw webhook

Stripe signature verification must use:

- the unmodified raw request body;
- the `Stripe-Signature` header;
- the endpoint-specific webhook secret.

Required runtime secret names:

- `STRIPE_SECRET_KEY`;
- `STRIPE_WEBHOOK_SECRET`;
- `CRYPTO_BILLING_WEBHOOK_SECRET`.

Checkout strategy: Checkout Session.
Webhook strategy: signed raw body.

### Internal order correlation

The Checkout Session or subscription metadata must contain the CRYPTO LAB billing-order UUID. The adapter must reject any event that cannot be correlated to exactly one internal order.

### Minimum event mapping

One-time or initial checkout:

- `checkout.session.completed` with paid state → `payment.succeeded`;
- `checkout.session.async_payment_succeeded` → `payment.succeeded`;
- `checkout.session.async_payment_failed` → `payment.failed`;
- incomplete or unpaid Checkout Session → `payment.pending`.

Subscriptions:

- `invoice.paid` with active subscription → `subscription.renewed` or initial `payment.succeeded` according to internal order state;
- `invoice.payment_failed` → `payment.failed` without immediate access revocation unless the approved business policy requires it;
- `customer.subscription.updated` → cancellation scheduling or status reconciliation;
- `customer.subscription.deleted` → `subscription.canceled`;
- verified refund or credit event → `payment.refunded` and administrative access review.

The adapter must retrieve the authoritative Checkout Session, invoice, or subscription before granting access when the event does not contain enough verified information.

Official references:

- `https://docs.stripe.com/webhooks`
- `https://docs.stripe.com/checkout/fulfillment`
- `https://docs.stripe.com/billing/subscriptions/webhooks`

## Database readiness registry

Table: `crypto_billing_provider_adapters`.

It stores only non-secret readiness metadata:

- contract version;
- desired mode;
- lifecycle status;
- checkout and webhook strategies;
- capabilities;
- names of required secrets;
- enabled flags;
- last verification timestamp and bounded diagnostics.

It never stores secret values.

Initial providers are all disabled and in `draft` status:

- LiqPay;
- Stripe;
- manual review.

Only `service_role` can record successful runtime verification. An administrator cannot mark an adapter verified from the browser.

## Activation gate

A real adapter can be enabled only when all conditions are true:

- the user has chosen the provider;
- BASIC and PRO prices are approved and active;
- merchant credentials are installed as Edge Function secrets;
- provider signature verification passes;
- internal normalized webhook secret is installed;
- sandbox checkout and webhook tests pass;
- duplicate and out-of-order delivery tests pass;
- refund and cancellation policy is approved;
- release gate and browser smoke tests pass.

Until then, checkout and webhook flags remain false and no payment can grant access.
