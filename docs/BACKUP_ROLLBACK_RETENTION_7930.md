# CRYPTO LAB v79 — Backup, rollback and data retention

Build: `7930`

## Scope

This document defines application rollback procedures and data-retention boundaries. It does not claim that managed database backups or point-in-time recovery are enabled; that capability must be confirmed in the Supabase organization and plan before paid launch.

## Recovery objectives

Target objectives for public paid operation:

- Application rollback decision: within 15 minutes of confirmed release regression.
- Static application rollback: within 30 minutes using a known-good Git commit.
- Edge Function rollback: within 30 minutes using a recorded prior function version/source.
- Database incident triage: within 30 minutes.
- Database recovery point objective: depends on confirmed managed backup/PITR plan and remains a launch blocker until documented.
- Database recovery time objective: depends on managed recovery tooling and remains a launch blocker until tested.

## Release evidence that must be recorded

Every release candidate must record:

- application build;
- immutable Git commit SHA;
- release-gate run ID;
- browser-smoke run ID;
- GitHub Pages deployment run ID;
- technical and commercial readiness scores;
- unresolved blockers;
- database migration list;
- Edge Function versions and source hashes;
- Supabase Security Advisor result;
- rollback target commit and function versions.

The protected `crypto_release_checkpoints` table stores this non-secret evidence. It is not directly readable or writable by browser roles.

## Static application rollback

1. Do not modify root v78 while v79 remains a preview candidate.
2. Identify the last known-good v79 release checkpoint.
3. Verify that the checkpoint Git SHA exists and passed both release-gate and browser-smoke workflows.
4. Move the deployment branch to that commit through a normal, auditable Git commit or approved ref update.
5. Confirm GitHub Pages deployment success.
6. Fetch `v79/index.html`, `app.html`, `commercial-extension.js` and `service-worker.js` with cache-busting parameters.
7. Verify consistent build markers and cache name.
8. Confirm that the working root v78 file SHA remains unchanged.

Do not force-push over release evidence unless repository recovery explicitly requires it.

## Edge Function rollback

For each changed Edge Function, retain:

- function slug;
- previous version number;
- current version number;
- source hash;
- `verify_jwt` state;
- required environment-variable names;
- authorization model;
- test evidence.

Rollback procedure:

1. Disable the affected business capability through its existing feature flag or missing-secret fail-closed state.
2. Redeploy the last known-good source as a new Edge Function version.
3. Preserve `verify_jwt` and server authorization boundaries.
4. Run method, origin, authorization, body-limit and disabled-state tests.
5. Review Edge Function logs for new errors.
6. Record the rollback in the administrative audit and release checkpoint.

Never copy service-role, payment, mail, Turnstile, OpenAI or Telegram secrets into Git history.

## Database migration rollback

Database changes are forward-only by default. Destructive down-migrations are prohibited during an incident unless a tested restore is available.

Preferred response order:

1. Disable the affected feature.
2. Restore compatible application and Edge Function code.
3. Apply a corrective forward migration.
4. Use managed backup/PITR only when data corruption or unrecoverable destructive change requires it.

Before any destructive migration:

- confirm a current managed backup or branch copy;
- record affected row counts and table sizes;
- create reversible data-copy tables where appropriate;
- validate foreign keys, RLS, policies, grants and RPC signatures;
- run Supabase Security and Performance Advisors.

## Managed backup blocker

Before public paid launch, an operator must record:

- Supabase plan and organization;
- backup frequency;
- retention period;
- point-in-time recovery availability;
- last successful restore test date;
- responsible operator;
- documented recovery procedure.

Until this evidence exists, `MANAGED_BACKUP_CONFIRMATION` remains a launch blocker.

## Retention policy

The protected table `crypto_data_retention_policies` records the approved technical defaults.

### Automatically enforced temporary data

| Data class | Retention | Purpose |
|---|---:|---|
| Feature access leases | 1 day after expiry | Temporary access coordination |
| Feature rate events | 2 days | Abuse prevention windows |
| Registration attempts | 30 days | Hashed anti-abuse metadata |
| Recovery attempts | 30 days | Hashed anti-abuse metadata |
| Scanner runs | 180 days | Operational scanner telemetry |
| Maintenance runs | 180 days | Maintenance execution history |

### Manual or policy-dependent data

| Data class | Default | Reason |
|---|---|---|
| Admin audit log | 730 days, manual enforcement | Critical accountability and legal hold support |
| AI/backtest telemetry | 365 days, manual enforcement | User-owned operational history |
| Support and account data | Account deletion workflow | User data portability and deletion rights |
| Billing and legal records | No automatic deletion | Requires tax, chargeback, refund and legal-retention approval |

## Maintenance controls

The daily maintenance job:

- marks stale AI runs failed after 15 minutes;
- marks stale backtests failed after 30 minutes;
- deletes expired feature leases older than one day;
- deletes feature-rate events older than two days;
- deletes registration and recovery attempts older than 30 days;
- deletes scanner and maintenance execution history older than 180 days;
- records deleted counts and errors.

It deliberately does not delete:

- subscriptions;
- billing orders or events;
- legal acceptances;
- support conversations;
- trade journals;
- user portfolios;
- administrative audit records.

## Restore test checklist

A restore exercise must prove:

- authentication users remain mapped to profiles;
- subscription state and events are consistent;
- RLS is enabled on all CRYPTO LAB tables;
- public wrappers remain `SECURITY INVOKER` where designed;
- service-only functions are not executable by browser roles;
- cron jobs are present but reviewed before reactivation;
- Vault secret names exist without exposing values;
- Edge Function environment variables are reinstalled;
- payment, registration and mail remain disabled until verification completes;
- v79 release-gate and browser-smoke tests pass against the restored environment.