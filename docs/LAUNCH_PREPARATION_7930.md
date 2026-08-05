# CRYPTO LAB v79 — Launch Preparation (build 7930)

## Result

The remaining launch work now has a read-only preparation snapshot with:

- six structured owner decision packets;
- a provider-neutral payment sandbox contract with 21 scenarios;
- Turnstile, mail-relay, backup/restore and physical-device checklists;
- a six-check integrity validator for the launch-control registry;
- no activation of registration, recovery, paid plans, payment adapters or v79 publication.

## Decision packets

### REAL_ADMIN

Required decision data:

- an email account owned by the project owner;
- the corresponding existing Supabase Auth user ID.

Acceptance criteria:

- the Auth user exists and owns the confirmed email;
- `crypto_user_profiles.role` is `admin`;
- admin-only read RPCs succeed;
- no service identity or invented account is used as the human administrator.

### PRICING_MODEL

Required decision data:

- BASIC amount in minor currency units;
- PRO amount in minor currency units;
- ISO 4217 currency;
- billing interval: month or year.

Safety boundary:

- prices remain inactive;
- amounts must be positive integers;
- the provider remains `unconfigured` until provider verification;
- activation is blocked until the selected payment adapter and signed webhook are verified.

### PAYMENT_PROVIDER

Allowed owner choice:

- `liqpay`, initial mode `test`;
- `stripe`, initial mode `test`.

Current adapters are still `disabled/draft`. Both adapters support one-time payment, recurring payment and refund flows in the internal contract. LiqPay uses hosted redirect plus signed form callback. Stripe uses Checkout Session plus signed raw-body webhook.

No merchant key, private key, webhook secret or shared adapter key is stored in the launch registry or repository.

### REFUND_POLICY

Required decision fields:

- refund window;
- eligible payment states;
- whether partial refunds are allowed;
- access behavior after refund;
- cancellation effective time;
- failed-renewal grace period;
- chargeback access action;
- whether support review is mandatory.

Current technical boundary: `payment.refunded` moves the order to `refunded`, marks the billing event for review, and does not automatically revoke subscription access. The policy decision must define the final access action.

### BACKUP_PITR

The Supabase organization is currently on the Free plan. Managed automatic backups and PITR are therefore unavailable in the current configuration.

The owner must choose one strategy:

1. paid managed backups, optionally with PITR, followed by a restore rehearsal; or
2. a formally approved logical off-site backup process with an isolated restore rehearsal.

Required decision fields:

- selected strategy;
- target recovery point objective (RPO);
- target recovery time objective (RTO).

The launch requirement remains unresolved until restore evidence is recorded.

### PUBLISH_V79

Default: `false`.

The publication decision remains blocked by:

- payment sandbox E2E;
- backup/restore verification;
- controlled beta and confirmed UX fixes.

## Provider-neutral payment sandbox contract

The contract contains 21 scenarios and remains non-executable until pricing, provider, credentials and refund policy are resolved.

### Edge rejection cases

- webhook disabled → HTTP 503, `WEBHOOK_DISABLED`, no writes;
- wrong adapter key → HTTP 401, no writes;
- malformed JSON → HTTP 400, no writes;
- unsupported provider → HTTP 400, no writes;
- unsupported event type → HTTP 400, no writes;
- invalid provider event identity or order UUID → HTTP 400, no writes;
- missing verified amount/currency for success, refund or renewal → HTTP 400, no writes.

### Payment state cases

- `payment.pending`: created → pending;
- `payment.succeeded`: created/pending/failed/expired/canceled → paid and active subscription;
- `payment.failed`: created/pending → failed;
- `payment.expired`: created/pending → expired;
- `payment.canceled`: created/pending → canceled;
- identical provider event replay: duplicate accepted with no second mutation;
- same provider event ID with different payload: HTTP 409 `EVENT_COLLISION`;
- invalid state transition: event processed as ignored without retry;
- amount or currency mismatch: failed event with bounded retry schedule.

### Subscription and refund cases

- renewal: order paid, subscription active, valid bounded period;
- cancel at period end: flag set without immediate access revocation;
- provider cancellation: subscription canceled with `ended_at`;
- refund: order refunded, review required, no automatic access revocation before policy approval.

## External configuration checklists

### Turnstile

- restrict widget hostname to `1specnazov1.github.io`;
- store site and secret keys only in Supabase Edge secrets;
- keep public registration disabled until mail and admin prerequisites pass;
- verify missing, invalid, wrong-hostname, replay/idempotency and valid-token paths.

### Mail relay

- configure relay URL and publishable key only in Edge secrets;
- store the shared relay secret only in the private service-secret store;
- test signup confirmation and password recovery only on an owned mailbox;
- verify idempotency, bounce handling, sender-domain alignment and log redaction.

### Backup and restore

- record approved strategy and RPO/RTO;
- create an encrypted off-site artifact or enable managed backup;
- restore to an isolated non-production target;
- validate schema, row counts, Auth/profile linkage, functions, cron definitions and RLS;
- retain or destroy the target according to the evidence policy.

### Physical devices

- iPhone Safari: PWA install, login, offline shell, chart, account and logout;
- Android Chrome: PWA install, login, offline shell, chart, account and logout;
- record device/browser versions and screenshots without credentials or personal data.

## Validation

Migration `20260805064110` installs:

- `private.crypto_launch_control_integrity_snapshot()`;
- `private.crypto_launch_preparation_snapshot()`;
- admin-only read wrapper `public.get_crypto_admin_launch_preparation()`;
- the corrected BACKUP/PITR decision classification.

Current preparation state: `prepared_waiting_decisions`.

Current launch-control integrity:

- 16 requirements;
- total weight 100;
- no missing dependencies;
- no self-dependencies;
- no verified item without evidence;
- no secret-like values in decision or evidence JSON.

Stable v78 remains unchanged.
