# CRYPTO LAB v79 — Decision Packets for Full Launch

Date: 2026-08-05  
Build: 7930  
Status: recommendations only; no business decision is activated by this document.

## 1. Payment provider

### Recommended first-launch decision

Use **LiqPay in sandbox and then live mode for the Ukrainian launch**. Keep Stripe as a later adapter for a future legal entity in a Stripe-supported country.

### Rationale

- LiqPay supports UAH, checkout, server callbacks, subscriptions, cancellation, card tokens, sandbox operation and full or partial refunds.
- The current Stripe global-availability page does not list Ukraine as a country where a Ukrainian business can directly open a payments account. Stripe remains technically valuable, but eligibility would require a supported legal entity or a future availability change.
- CRYPTO LAB already has a provider-neutral billing state machine, so choosing LiqPay first does not remove the Stripe adapter.

### Official references

- LiqPay checkout: https://www.liqpay.ua/en/doc/api/internet_acquiring/checkout
- LiqPay callback: https://www.liqpay.ua/doc/api/callback
- LiqPay subscription: https://www.liqpay.ua/en/doc/api/internet_acquiring/subscription
- LiqPay refund: https://www.liqpay.ua/en/doc/api/internet_acquiring/refund
- Stripe global availability: https://stripe.com/global

### Owner decision required

- `LIQPAY_FIRST`
- `STRIPE_FIRST`
- `DEFER_PAYMENT_PROVIDER`

No provider is enabled until the owner records one of these decisions and the merchant credentials are installed in the provider/Supabase secret interface.

## 2. BASIC and PRO pricing

### Recommended launch configuration

Launch with monthly UAH billing only:

- BASIC — **399 UAH/month**
- PRO — **799 UAH/month**
- FREE — remains available with current server limits
- annual billing — defer until at least 30 days of stable paid operation

### Why this configuration

- Monthly-only launch minimizes recurring, cancellation, refund and accounting complexity.
- The BASIC-to-PRO price ratio is simple and leaves room for a clear feature distinction.
- UAH avoids customer exchange-rate uncertainty for the primary Ukrainian audience and matches the recommended LiqPay-first launch.
- Annual discounts should be introduced only after churn, support load, refund rate and real feature usage are measured.

### Owner decision required

Confirm or replace:

- BASIC amount
- PRO amount
- currency
- billing interval
- whether annual billing is deferred

Prices remain `NULL/inactive` until explicit approval.

## 3. Refund, cancellation and chargeback policy

### Recommended operating policy

1. The user may disable future renewal at any time; access remains until the paid period ends unless a legally required immediate termination applies.
2. Refunds are reviewed and processed for duplicate charges, unauthorized charges, failure to provide the service, or material nonconformity that is not corrected within a reasonable period.
3. Where a prepaid digital service is validly terminated, refunds are calculated according to applicable law, including proportional treatment of an unused or nonconforming period where required.
4. A full or partial provider refund must be recorded through the normalized billing event and reconciliation contour before entitlement is changed.
5. A chargeback opens a high-severity billing review. Paid entitlement is not silently extended while the dispute is unresolved.
6. The public policy must not claim that all digital subscriptions are categorically non-refundable.
7. Final Ukrainian legal text requires review before paid public launch.

### Legal basis used for the draft

Ukraine's Law `On Digital Content and Digital Services` provides remedies for non-delivery and nonconformity, including bringing the service into conformity, proportional price reduction, contract termination and refund consequences.

Official source: https://zakon.rada.gov.ua/laws/show/3321-20

### Owner decision required

Approve the operating principles and authorize preparation of the final legal wording, or provide different business rules for:

- cancellation timing
- failed renewal
- duplicate charge
- unauthorized charge
- full refund
- partial refund
- chargeback handling

## 4. Cloudflare Turnstile

### Already prepared autonomously

- Registration Edge Function requires Turnstile, current legal documents, rate limits, honeypot and mail relay readiness.
- Recovery Edge Function requires Turnstile, rate limits, generic anti-enumeration responses and mail relay readiness.
- Siteverify is server-only.
- Hostname and action are checked.
- Token length is bounded to 2,048 characters.
- Validation has a 10-second timeout and idempotency key.
- Client signup and recovery are routed through the protected gateway instead of direct Supabase Auth methods.
- Registration and recovery remain disabled.

### Remaining external input

Create a production Turnstile widget restricted to `1specnazov1.github.io`, then install:

- `CRYPTO_TURNSTILE_SITE_KEY`
- `CRYPTO_TURNSTILE_SECRET_KEY`

After installation, the controlled test suite will cover success, failure, expired/duplicate token, wrong hostname and wrong action. Cloudflare states that server-side Siteverify is mandatory, tokens expire after five minutes and are single-use.

Official references:

- https://developers.cloudflare.com/turnstile/get-started/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/

## 5. Mail relay

### Already prepared autonomously

- Public registration/recovery never call an email provider directly.
- A protected service-to-service dispatch function forwards bounded template requests to a dedicated relay.
- The relay requires both service-role authentication and a separate private relay secret.
- Registration rolls back a newly created user if confirmation mail cannot be dispatched.
- Recovery returns a generic response to prevent account enumeration.

### Remaining external input

Install only in secret/configuration interfaces:

- `CRYPTO_MAIL_RELAY_URL`
- `CRYPTO_MAIL_RELAY_PUBLISHABLE_KEY`
- private DB secret `crypto_lab_mail_relay`
- verified sender/domain configuration at the mail provider
- one owned mailbox for the controlled confirmation and recovery tests

No fabricated email address may be used for hosted authentication tests.

## 6. Backup and PITR

### Confirmed current state

The Supabase organization is currently on the **Free** plan. Supabase documents that Free projects do not include automatic backups or PITR. Pro includes seven days of daily backups; PITR is a separately billed add-on, currently starting at approximately USD 100/month for seven-day retention.

Official references:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery
- https://supabase.com/pricing

### Recommended decision

Minimum paid-launch requirement:

1. upgrade the production organization to Pro;
2. confirm daily backups are visible;
3. maintain a separate logical off-site dump and restore runbook;
4. perform restore-to-new-project rehearsal before paid public launch.

PITR decision:

- enable seven-day PITR if the business accepts the additional cost and requires an RPO substantially below one day;
- otherwise launch with Pro daily backups plus frequent encrypted off-site logical dumps, then enable PITR when paid usage justifies it.

No paid plan or PITR add-on is activated without the owner's cost decision.

## 7. Real administrator

A real Auth user does not yet exist. The owner must identify an owned email account. Only after controlled registration and confirmation will that exact user be assigned `admin` through the protected service/admin contour. No synthetic administrator will be created.

## 8. Physical devices and beta

The automated Chromium/PWA suite does not replace physical review. Required evidence remains:

- iPhone installation, reload, offline start and main flows;
- Android installation, reload, offline start and main flows;
- controlled beta participants using real accounts;
- issue ledger with severity, reproduction steps and evidence;
- autonomous fixes followed by regression gates.

## 9. Publication boundary

The stable root v78 remains immutable. The decision to publish v79 over v78 is requested only after the following are verified:

- registration/recovery E2E;
- mail delivery E2E;
- payment sandbox matrix;
- backup/restore rehearsal;
- physical-device review;
- controlled beta and UX fixes;
- final technical GO.
