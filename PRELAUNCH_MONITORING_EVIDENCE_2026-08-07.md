# CRYPTO LAB — Prelaunch Monitoring Evidence

Date: 2026-08-07
Scope: passive monitoring only. No registration, production billing, mainnet execution, refunds, recurring billing, or paid entitlement activation.

## Observed state

- Last 24h operational HTTP requests: 644
- Successful: 643
- Failed: 1
- 5xx: 1
- 429: 0
- Existing operational incident: resolved
- Billing orders: 0
- Billing events: 0
- Open billing anomalies: 0
- On-chain transaction claims: 0
- Registration attempts: 0
- Recovery attempts: 0
- Suspicious prelaunch activity: none detected

## Monitoring installed

Migration: `20260807000355_install_prelaunch_commercial_monitoring.sql`

Adds `crypto_prelaunch_monitor_snapshots` and service-role-only function `crypto_capture_prelaunch_monitor_snapshot(integer)`.

Fail-closed rule: while CRYPTO LAB remains in `closed_prelaunch`, any billing order/event, on-chain payment claim, registration/recovery attempt, open billing anomaly, or high/critical admin action from a non-service actor produces `status=alert`.

The first 60-minute snapshot returned:

- status: `clean`
- suspicious_score: `0`
- open_incidents: `0`
- billing_orders: `0`
- billing_events: `0`
- onchain_claims: `0`
- registration_attempts: `0`
- recovery_attempts: `0`
- risky_admin_actions: `0`

## Access control validation

- anon SELECT on monitoring snapshots: denied
- authenticated SELECT on monitoring snapshots: denied
- anon EXECUTE on capture function: denied
- authenticated EXECUTE on capture function: denied
- service_role EXECUTE: allowed

## Commercial safety flags verified

All remain false:

- `paid_checkout_enabled`
- `paid_entitlement_enabled`
- `refund_execution_enabled`
- `recurring_billing_enabled`
- `public_registration_enabled`
- `production_launch_authorized`

Stable v78 was not modified by this monitoring work.
