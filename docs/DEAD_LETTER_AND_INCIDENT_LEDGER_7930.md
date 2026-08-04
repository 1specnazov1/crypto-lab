# CRYPTO LAB v79 — Dead-letter requeue and operational incident controls

Build: `7930`

Verification date: 2026-08-04

## Scope

This block adds two protected operational controls without modifying or publishing the working root v78 application:

1. audited administrative requeue for signal notification records in `dead` or `retry` state;
2. a protected operational incident ledger for tracked Edge Function HTTP requests and terminal cron failures.

No production signal was created manually, no test Telegram message or email was sent, no external test user was retained, and registration, recovery and billing remain disabled.

## Administrative dead-letter requeue

The protected implementation is `private.admin_requeue_crypto_signal_notification(uuid,text)` with a public `SECURITY INVOKER` wrapper.

The operation requires:

- an authenticated user whose `crypto_user_profiles.role` is `admin`;
- an existing notification in `dead` or `retry` state;
- a mandatory sanitized reason between 5 and 500 characters.

A successful review atomically:

- changes status to `retry`;
- resets attempts to zero;
- sets `available_at = now()`;
- clears claim, delivery, Telegram message ID and prior error fields;
- writes a protected high-severity record to `crypto_admin_audit_log`;
- returns `delivery_triggered = false`.

The administrative RPC never calls Telegram. Delivery remains the responsibility of the normal monitor claim/send/acknowledgement cycle.

Requeue is rejected for `sent`, `pending` and `processing` records. Direct browser SELECT access to the outbox remains prohibited.

### Transactional verification

A rollback-only test proved:

- `dead → retry` succeeds;
- `retry → retry` succeeds and becomes immediately available;
- attempts reset to zero;
- two administrative audit records are produced inside the test transaction;
- an already delivered `sent` event is rejected;
- a one-character reason is rejected;
- no Telegram delivery is initiated;
- all temporary users, profiles, signals, outbox records and audit rows are rolled back.

After the test:

- persistent test users: `0`;
- persistent test audit rows: `0`.

## Administrative interface

The existing v79 operational-health panel now displays a **Requeue** action only for `dead` and `retry` rows.

The action:

- requests the mandatory operator reason;
- calls the protected RPC;
- explains that the monitor performs delivery later;
- reloads the operational state after a successful review;
- supports Russian, Ukrainian and English.

No payload, trade levels, bot token, chat ID, monitor secret or service-role credential is exposed.

Published asset checks:

- `v79/admin-health.js`: HTTP 200 with the protected RPC/action markers;
- `v79/service-worker.js`: HTTP 200 with cache `crypto-lab-v79-7930-requeue1`;
- root v78 file: unchanged SHA `4a278c891d37b3760ec1ac988690ea9ad587b24e`.

## Operational incident ledger

Two protected RLS tables were added:

- `crypto_operational_http_requests` — maps pg_net request IDs to the monitored Edge source;
- `crypto_operational_incidents` — stores deduplicated open/resolved incident state.

Browser roles have no direct table privileges. Service-only RLS policies are present.

Tracked Edge sources:

- `crypto-signal-monitor`;
- `crypto-market-scanner`.

Tracked cron sources:

- signal monitor;
- market scanner;
- daily maintenance;
- subscription lifecycle;
- billing retry;
- billing reconciliation.

Edge failure conditions are bounded to operational metadata:

- no response after two minutes;
- timeout;
- transport error;
- non-2xx status;
- JSON response containing `success: false`.

Response payloads and secrets are not copied into the incident table. The stored error is a generic bounded classification.

Incidents use one fingerprint per source. A new observation increments the occurrence count, while repeated reconciliation of the same observation is ignored. A later successful observation resolves the open incident.

Processed request mappings are retained for 30 days. Resolved incidents are retained for 180 days.

## Cron integration

The monitor and scanner jobs were recreated through the supported `cron.unschedule` / `cron.schedule` API so each pg_net request ID is recorded before reconciliation.

A reconciliation job runs every five minutes.

The first natural reconciliation exposed a defect: pg_cron can temporarily report a `connecting` row without `start_time`. The reconciler was corrected to consider only terminal `succeeded` or `failed` rows with non-null start times.

Natural verification at `2026-08-04 11:45 UTC`:

- signal-monitor cron: succeeded;
- market-scanner cron: succeeded;
- incident-reconciliation cron: succeeded.

The next reconciliation processed successful tracked Edge responses and reported:

- open incidents: `0`;
- resolved incidents: `0`;
- incidents opened: `0`.

### Transactional incident verification

A rollback-only test proved the full lifecycle:

1. synthetic HTTP 503 opens one incident;
2. reconciling the same observation again does not increment it;
3. a later HTTP 200 resolves the incident;
4. all synthetic request, response and incident rows are rolled back.

No external request was issued by this test.

## Natural monitor and outbox state

After deployment, natural v6 cycles continued successfully.

Latest sampled cycle:

- live WAITING + ACTIVE signals: `65`;
- `source_count = fetched = checked = 65`;
- HTTP 200;
- missing rows: `0`;
- notification failures: `0`.

Latest tracked scanner request returned HTTP 200 with `success = true`.

Outbox snapshot during this block:

- sent: `30`;
- pending: `0`;
- processing: `0`;
- retry: `0`;
- dead: `0`;
- unique `signal_id + event_type` pairs: `30`.

## Security and boundaries

- Supabase Security Advisor: zero lints after both migrations and service-only policies.
- `anon` cannot execute the requeue RPC.
- authenticated users can reach the public wrapper, but the private function rejects non-admin users.
- `anon` and `authenticated` cannot SELECT the outbox or incident tables.
- service-role-only functions and tables remain unavailable to browser roles.
- no persistent authentication user exists in the project at the end of the test block.
- maintenance run 5 remains completed without error.

The following remain unchanged and disabled: public registration, password recovery, plan prices, payment-provider adapters, checkout, webhooks, recurring billing, refunds and replacement of v78 by v79.
