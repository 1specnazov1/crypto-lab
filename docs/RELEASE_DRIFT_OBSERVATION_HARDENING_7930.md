# CRYPTO LAB v79 — Drift observation hardening and maintenance panel

Build: `7930`

Verification date: 2026-08-04

## Scope

This block hardens the protected release-drift observation writer and adds an authenticated administrative maintenance-evidence panel. The stable v78 root is not modified or repointed.

## Confirmed defect

A release observation accidentally copied manifest asset objects with `marker` instead of reporting observed asset objects with boolean `marker_ok`. PostgreSQL JSON null semantics allowed the missing boolean to bypass the original comparison and the malformed observation was stored. The drift snapshot correctly treated those assets as mismatches and changed the release state to critical.

The malformed observation was superseded by a correctly shaped observation. Current drift returned to healthy with no ignored mismatch.

## Database hardening

Applied migrations:

- `20260804171048` — `crypto_release_drift_observation_shape_hardening`;
- `20260804171147` — `crypto_release_drift_observation_null_shape_fix`.

The protected service writer now validates:

- SHA-1-shaped Git identifiers;
- bounded PWA cache marker;
- Edge observation array size, unique slugs, numeric versions, boolean JWT flags and bounded status;
- asset observation array size, unique v79 paths, Git blob SHA and mandatory boolean `marker_ok`;
- bounded source and note values.

The final validators use `IS DISTINCT FROM` for JSON types so missing keys and SQL NULL cannot bypass type checks.

Direct browser execution remains denied. Only `service_role` may call the protected observation writer and helper validators.

## Rollback-only verification

A transaction-only test attempted two observations:

1. manifest-shaped asset object with `marker` and no `marker_ok` — rejected with `Malformed asset observation item`;
2. valid observed asset object with `marker_ok: true` — accepted inside the transaction.

The transaction was rolled back. No test observation or test user remained.

## Administrative interface

`v79/admin-maintenance.js` reads only the authenticated admin RPC `get_crypto_admin_maintenance_evidence()` and displays:

- expected maintenance time;
- collecting, warning, critical or healthy state;
- real maintenance run ID and timestamps;
- error flag;
- evidence seal ID and status;
- deterministic SHA-256 evidence hash;
- consolidated retention counters.

Before the scheduled maintenance time, a missing run and seal are explicitly shown as expected. The panel does not expose credentials, raw payloads, email addresses, Telegram identifiers, trading levels or payment secrets.

The panel is loaded only inside the v79 admin page and is included in the versioned PWA shell.

## Boundaries retained

This block does not:

- create an artificial maintenance run or evidence seal;
- publish v79 over v78;
- enable registration or password recovery;
- activate prices, payment providers, checkout, webhooks, recurring billing or refunds;
- send Telegram messages or email;
- create manual production signals or persistent external test users.
