# CRYPTO LAB v79 — Release drift and rollback readiness

Build: `7930`

Verification date: 2026-08-04

## Scope

This block adds a protected release-drift boundary between the expected v79 release state and the connected GitHub/Supabase state. It also records a metadata-only rollback-readiness rehearsal.

The working root v78 was not modified, repointed or replaced.

## Versioned release manifest

Manifest:

- `docs/release-manifests/crypto-lab-v79-7930.json`;
- manifest key in Supabase: `crypto-lab-v79-7930-drift1`;
- build: `7930`;
- stable root v78 SHA: `4a278c891d37b3760ec1ac988690ea9ad587b24e`;
- v79 application commit: `908868da709e2303ce6dc78ac6216f1a5c1cb821`;
- PWA cache: `crypto-lab-v79-7930-drift1`.

The manifest contains no credentials. It records only bounded release metadata:

- expected Supabase migration versions and names;
- expected Edge Function slug, version, JWT setting and active status;
- selected v79 asset Git blob SHAs and non-secret markers;
- successful release evidence IDs;
- stable-root and commercial enablement boundaries.

## Drift inventory

The protected snapshot validates forty controls:

- eight expected migrations are present in `supabase_migrations.schema_migrations`;
- the latest observation is fresh;
- stable root v78 SHA matches;
- v79 application commit matches;
- PWA cache matches;
- twenty Edge Functions match expected versions, JWT settings and active status;
- seven selected public assets match Git blob SHA and marker;
- latest protected release checkpoint matches the manifest evidence.

Final state:

- checks: `40`;
- critical mismatches: `0`;
- warnings: `0`;
- state: `healthy`.

## Protected storage and RPC boundary

Tables:

- `crypto_release_manifests`;
- `crypto_release_drift_observations`;
- `crypto_rollback_rehearsals`.

All three tables:

- have RLS enabled;
- deny direct `anon` and `authenticated` access;
- allow service-role writes only.

Browser-compatible reads use private implementations and public `SECURITY INVOKER` wrappers:

- `get_crypto_admin_release_drift()`;
- `get_crypto_admin_rollback_readiness()`.

Both require an authenticated profile with role `admin`.

## Automatic GO / WATCH / NO-GO integration

Release drift is now an independent operational indicator:

- healthy drift preserves `TECHNICAL_GO`;
- warning drift produces `WATCH`;
- critical drift produces `NO_GO`.

A rollback-only test changed the observed `crypto-market-scanner` version from 12 to 11 inside a transaction.

Verified result:

- normal drift state: `healthy`;
- normal operational decision: `TECHNICAL_GO`;
- synthetic drift state: `critical`;
- mismatch detected: `edge:crypto-market-scanner`;
- operational decision changed to `NO_GO`;
- `release_drift` appeared in active alerts;
- ordinary user received SQLSTATE `42501` / `Admin access required`.

The transaction was rolled back. No persistent test user or modified observation remained.

## Metadata-only rollback rehearsal

The latest rehearsal result is `passed` and `metadata_only=true`.

Verified checks:

- stable v78 root SHA is known;
- candidate release checkpoint exists;
- release drift is healthy;
- continuous data integrity is healthy;
- rollback target is separate from v79 assets;
- no publication source, branch ref or root file was switched;
- no application or production data was changed.

Rollback target:

`4a278c891d37b3760ec1ac988690ea9ad587b24e`

This was not a real rollback. It was a readiness rehearsal at manifest/checkpoint metadata level only.

## Administrative interface

File `v79/admin-drift.js` adds a protected RU/UA/EN panel showing:

- drift state;
- active mismatches;
- all release checks;
- rollback-readiness state;
- rollback target;
- metadata-only status and rehearsal checks.

It does not display credentials, request bodies, webhook signatures, Telegram identifiers or trading levels.

PWA cache:

`crypto-lab-v79-7930-drift1`

## GitHub release gate

The v79 release workflow now validates:

- release-manifest JSON;
- stable root Git blob SHA;
- selected v79 asset Git blob SHAs;
- expected asset markers;
- migration source-file presence;
- Edge inventory uniqueness and completeness;
- PWA cache alignment;
- existing syntax, PWA, local-reference and secret-marker controls.

Successful evidence:

- final application release gate: `30927974993`;
- Chromium browser/PWA smoke: `30927975044`;
- application Pages deployment: `30927974279`;
- manifest-aware release gate: `30928316860`;
- finalized manifest release gate: `30928593683`;
- finalized manifest Pages deployment: `30928588886`.

The Chromium smoke is automated browser validation, not a physical iPhone/Android review.

## Final release checkpoint

Protected checkpoint: `18`.

- status: `candidate`;
- technical score: `100`;
- commercial score: `60`;
- drift state: healthy;
- integrity state: healthy;
- root v78 unchanged.

## Boundaries retained

This block did not:

- modify or publish v78;
- create a manual production signal;
- send a test Telegram message or email;
- create a persistent external test user;
- enable registration or recovery;
- assign paid prices;
- enable checkout, provider adapters, billing webhooks, recurring billing or refunds.

The next time-dependent verification remains the next real daily maintenance after 2026-08-05 03:17 UTC.
