# CRYPTO LAB v79 — End-to-end commercial release test plan

Target application build: `7928`

This plan is intentionally non-destructive until real sandbox credentials are supplied. No production card, live merchant account, real customer email, or real charge is permitted during the test stages below.

## Gate A — Static and database safety

Required result: PASS.

- GitHub Actions dynamic v79 release gate succeeds.
- Supabase Security Advisor has no security warnings.
- Public v78 root SHA is unchanged.
- BASIC and PRO prices remain inactive until explicit business approval.
- Public registration and recovery return disabled state until Turnstile is configured.
- Billing webhook returns disabled state until the internal webhook secret exists.
- Provider adapters remain `disabled` and `draft` until runtime verification.
- No service-role key, provider private key, webhook secret, Turnstile secret, OpenAI key, Telegram token, or Resend key is present in GitHub Pages assets.

## Gate B — Browser and PWA smoke

Required result: PASS on Chromium mobile profiles and desktop.

Viewports:

- 390 × 844;
- 412 × 915;
- 1440 × 900.

Checks:

- app shell opens without blank screen;
- mobile navigation opens and closes;
- Home, Market, Analytics, Scanner, Portfolio, Calculator, Backtest, Journal and Account routes render;
- iframe modules load local documents;
- no page has unintended horizontal body overflow;
- every visible button has an accessible name;
- focus reaches navigation and primary actions using keyboard only;
- manifest parses and declares standalone display;
- service worker installs on localhost and serves the offline page;
- PWA update changes the cache version and removes obsolete caches;
- offline navigation falls back to `offline.html`;
- language selection persists after reload.

## Gate C — Protected registration sandbox

Dependencies:

- Cloudflare Turnstile site key;
- Cloudflare Turnstile secret key;
- explicit registration flag;
- one owned monitored mailbox.

Sequence:

1. Invalid CAPTCHA is rejected and no Auth user is created.
2. Honeypot submission produces no public error detail and no Auth user.
3. Rate limits reject repeated attempts.
4. Valid registration creates one pending Auth user.
5. Confirmation email is sent only through CRYPTO LAB → Lumeria → Resend.
6. Supabase built-in SMTP is not used.
7. Confirmation link activates the user once.
8. Reopening the link is idempotent or safely rejected.
9. Duplicate registration returns a generic response without account enumeration.
10. Failed email delivery deletes the pending user so retry remains possible.

Evidence:

- Auth user ID;
- registration-attempt outcome;
- Resend delivery ID;
- no bounce or complaint;
- profile and FREE subscription created by trigger.

## Gate D — Protected recovery sandbox

Dependencies are the same as Gate C.

Sequence:

1. Known and unknown email return the same public response.
2. Invalid CAPTCHA and rate-limit paths create no recovery email.
3. Valid request sends one protected recovery link through Resend.
4. Link can set a strong password once.
5. Existing sessions are reviewed according to the approved session policy.
6. Old or reused recovery links fail safely.

## Gate E — Provider adapter sandbox

Run only for the selected provider.

### Common adapter checks

- raw provider signature verification passes for genuine fixture;
- modified body or signature is rejected;
- provider event maps to the normalized JSON schema;
- internal order UUID correlation is exact;
- amount and currency match the stored billing order;
- duplicate provider event is idempotent;
- same event ID with altered payload is rejected as collision;
- unknown status never grants access;
- normalized webhook is called only after provider verification;
- secret values are absent from logs and responses.

### LiqPay-specific checks

- callback form fields `data` and `signature` are preserved exactly;
- decoded `order_id` maps to one billing order;
- status lookup reconciles a missing or delayed callback;
- success, failure, pending, expiration and refund sandbox scenarios map correctly;
- recurring payment is not enabled unless the approved product model uses it.

### Stripe-specific checks

- raw body is preserved for `Stripe-Signature` verification;
- Checkout Session metadata contains the internal billing-order UUID;
- `checkout.session.completed` is safe to process more than once;
- asynchronous success and failure are tested;
- `invoice.paid` provisions or extends access only for an active subscription;
- `invoice.payment_failed` follows the approved grace policy;
- subscription updated/deleted events reconcile access;
- refund event opens the approved access decision flow.

## Gate F — Payment state machine

Create a sandbox billing order with approved test price.

Required sequence:

1. `created` → `pending`.
2. Duplicate pending event changes nothing.
3. Valid success event changes order to `paid`.
4. Subscription becomes active for the purchased plan and exact period.
5. Duplicate success event does not extend the period twice.
6. Late failure after paid is ignored.
7. Refund changes order to `refunded` and opens administrative review.
8. `access_retained` and `access_revoked` are tested as separate scenarios.
9. Review decision writes immutable administrative audit.
10. Reconciliation produces no unresolved anomaly after the scenario is complete.

## Gate G — Subscription lifecycle

Test month and year independently if both are sold.

- initial activation;
- renewal;
- cancellation at period end;
- cancellation revocation;
- pause and resume if supported;
- failed renewal and grace-period behavior;
- expiry after period end;
- scheduled plan change;
- refund decision;
- manual administrative correction with audit note.

Automated jobs to verify:

- subscription lifecycle every 15 minutes;
- billing retry every 5 minutes;
- billing reconciliation hourly.

## Gate H — Data rights and support

- user data export contains profile, subscription, billing summary, legal acceptance, portfolio, journal, AI, backtest and support data;
- raw webhook payloads, signatures and secrets are excluded;
- deletion request enters the admin queue;
- admin cannot delete their own account through the workflow;
- exact target email confirmation is required;
- deletion audit records row counts but not plaintext secret data;
- Auth deletion cascades user-owned records;
- support user sees only own tickets;
- admin queue requires server-side admin role.

## Gate I — Production readiness decision

All items require explicit approval:

- selected provider;
- legal merchant entity and merchant account;
- BASIC price;
- PRO price;
- currency;
- billing interval;
- taxes and receipts responsibility;
- refund rules;
- chargeback rules;
- failed-renewal grace period;
- cancellation behavior;
- customer support SLA;
- registration opening date;
- v79 replacement of v78.

Production activation is prohibited while any required decision is missing.

## Release evidence package

Before replacing v78, archive:

- successful GitHub Actions run IDs;
- Supabase security and performance advisor output;
- provider sandbox event IDs;
- normalized event samples with secrets removed;
- billing order and subscription state transitions;
- reconciliation result;
- mobile/PWA smoke report;
- legal document versions;
- approved pricing and refund policy;
- rollback procedure and v78 root SHA.
