# CRYPTO LAB v79 — Maintenance evidence and completion plan

Build: `7930`

Verification date: 2026-08-04

## Completed in this block

A protected maintenance evidence seal has been installed before the next real daily maintenance run.

Migration:

- applied version: `20260804163552`;
- migration name: `crypto_maintenance_evidence_seal`;
- source file: `supabase/migrations/202608041635_crypto_maintenance_evidence_seal.sql`;
- source commit: `e932a6676becd5e80fd73e91f9cfe4b355bea836`.

The stable root v78 was not modified or repointed.

## Protected evidence seal

Table `crypto_maintenance_evidence_seals` stores bounded evidence only:

- maintenance run ID;
- release manifest and checkpoint references;
- retention counters;
- integrity and release-drift states;
- passed or failed seal result;
- bounded failure codes;
- deterministic SHA-256 evidence hash.

RLS is enabled. Browser roles cannot read or write the table directly. Service-role execution is required to create a seal.

The evidence does not contain credentials, emails, raw payloads, Telegram identifiers, trading levels or payment secrets.

## Scheduled behavior

The next qualifying real daily maintenance is expected after:

`2026-08-05 03:17:00 UTC` / `2026-08-05 06:17:00 Europe/Kyiv`.

An idempotent hourly cron check at minute 27 will:

1. wait until the real maintenance run exists;
2. confirm status `completed`, a completion timestamp and no error;
3. verify every retention counter is a non-negative integer;
4. require continuous data integrity to remain healthy;
5. require release drift to remain healthy;
6. create one immutable evidence seal per maintenance run;
7. attach the seal ID, evidence hash and retention counters to the latest release checkpoint.

Before the scheduled run, `pending` is the expected state and does not create an operational warning.

After the expected time, the operational summary progresses through bounded states:

- collecting during the normal grace period;
- warning when the run or seal is delayed;
- critical / `NO_GO` when maintenance fails, contains an error, remains absent too long or produces a failed seal.

## Verification

Rollback-only admin verification confirmed:

- current operational decision: `TECHNICAL_GO`;
- current overall state: `healthy`;
- current maintenance-evidence state: `healthy` before the due time;
- active operational alerts: `0`;
- persistent test users: `0`.

The pre-due service call returns `pending / maintenance_run_not_available`, which is correct because the real run has not happened yet. No artificial maintenance run or evidence seal was created.

Current evidence-seal rows: `0`.

## Release state

Protected release checkpoint: `20`.

- technical score: `100`;
- commercial score: `60`;
- release status: `candidate`;
- continuous data integrity: `45/45`, healthy;
- release drift: `41/41`, healthy;
- Security Advisor findings: `0`.

Manifest:

- key: `crypto-lab-v79-7930-drift1`;
- source commit: `48a961bd69b9c89bb0b1fa5405ddcd23f9ca9e45`;
- migrations recorded: `9`;
- maintenance evidence status: `pending` until the real scheduled run.

Successful release evidence:

- release gate for maintenance manifest: `30930287335`;
- Pages deployment for maintenance manifest: `30930285691`;
- finalized manifest gate: `30930470955`;
- finalized manifest Pages deployment: `30930469359`;
- latest Chromium browser/PWA smoke retained from the unchanged application assets: `30927975044`.

The browser smoke is automated Chromium validation, not physical iPhone or Android testing.

Stable root v78 SHA:

`4a278c891d37b3760ec1ac988690ea9ad587b24e`

## Remaining work to complete the full commercial version

### 1. Time-dependent technical closure

- verify the real daily maintenance after 06:17 Kyiv;
- require a passed maintenance evidence seal;
- review every consolidated retention counter;
- update the release manifest and checkpoint from maintenance `pending` to `passed`;
- continue 24–72 hour and then multi-day observation of SLO, outbox, scanner v12, incidents, drift and integrity.

### 2. Production identity and anti-abuse

- create and assign the real production admin account;
- create Cloudflare Turnstile site and secret keys;
- configure public registration and password recovery only after Turnstile is verified;
- configure the protected mail relay;
- run one controlled end-to-end email test using an owned mailbox;
- validate confirmation, recovery, global logout, account export and deletion using production-like accounts.

### 3. Commercial decisions

The owner must approve:

- BASIC price;
- PRO price;
- currency;
- monthly or other billing interval;
- LiqPay or Stripe;
- refund, cancellation and chargeback policy.

No prices or provider values should be invented by the implementation.

### 4. Payment activation

After the business decisions and credentials are available:

- configure merchant credentials and provider-specific webhook secrets;
- implement and activate the selected provider adapter;
- validate provider signature verification;
- run sandbox checkout end to end;
- verify duplicate webhooks, late success, failure, expiration, renewal and cancellation;
- verify refund review and access-retention/revocation decisions;
- activate live mode only after sandbox evidence passes.

### 5. Backup and disaster recovery

- confirm the Supabase managed backup/PITR capability for the production plan;
- define RPO and RTO targets;
- perform an isolated restore rehearsal without touching production;
- verify release manifest, migration inventory and critical row counts after restore;
- document the approved real rollback and restore authority.

### 6. Product and release acceptance

- complete manual visual review on a real iPhone and Android device;
- test install, offline start, update, language switching, authentication and key modules on physical devices;
- conduct a small controlled beta with real users;
- review support workflow and operator runbook during the beta;
- resolve observed UX defects;
- obtain final legal review of Terms, Privacy, risk disclosure and retention policy for the chosen jurisdiction.

### 7. Final production release

Only after all prior gates pass:

- freeze the Release Candidate;
- create the final manifest and checkpoint;
- require `TECHNICAL_GO`, healthy integrity, healthy drift and passed maintenance evidence;
- verify real admin, backup, registration, mail and payment readiness;
- record an explicit owner decision to publish v79;
- switch the public root from v78 to the approved v79 release under a documented rollback window;
- perform immediate post-release smoke, payment and operational checks.

Until that explicit release decision, v78 remains the working public version and v79 remains an isolated candidate.
