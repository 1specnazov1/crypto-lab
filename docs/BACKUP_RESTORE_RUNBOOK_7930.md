# CRYPTO LAB v79 — Encrypted Logical Backup and Restore Runbook

Date: 2026-08-05  
Build: 7930  
Current production project: `txhzxbizjpinowepfjkm`  
Execution status: not authorized

## Scope

This runbook prepares an independent logical-backup path while the Supabase organization remains on the Free plan. It does not purchase a plan, access production credentials, create a backup, upload data or restore a database during preparation.

Managed backup/PITR remains a separate owner cost decision. A logical backup is not a replacement for provider-managed point-in-time recovery, but it provides an independently encrypted recovery artifact and a testable restore process.

## Safety model

The supplied scripts have two different explicit guards:

- backup requires `ALLOW_PRODUCTION_LOGICAL_BACKUP=CRYPTO_LAB_BACKUP_APPROVED` and exact production `SOURCE_PROJECT_REF`;
- restore requires `ALLOW_NONPROD_RESTORE=CRYPTO_LAB_NONPROD_ONLY`, a target project ref different from production, and `CONFIRM_TARGET_IS_DISPOSABLE=YES_DESTROY_NONPROD_DATA`.

Neither script fetches secrets, uploads files or changes Supabase plan settings. Database and encryption credentials are supplied only in the approved secure execution environment.

## Required tools on the secure execution host

- PostgreSQL client tools compatible with the production database major version;
- `age` for public-key encryption;
- `sha256sum`;
- Python 3;
- secure temporary storage with restrictive permissions;
- an approved off-site destination operated outside the repository.

Tool versions are captured in evidence. GitHub-hosted runners must not be used for a production data backup unless the owner separately approves that threat model and secrets configuration.

## Backup procedure

1. Select an execution host with encrypted disk and controlled operator access.
2. Generate or select an `age` recipient. Keep the private identity offline from GitHub and from the database host.
3. Supply the database URI in `PG_DUMP_URL` through the host secret mechanism.
4. Supply:
   - `SOURCE_PROJECT_REF=txhzxbizjpinowepfjkm`;
   - `BACKUP_ENCRYPTION_RECIPIENT`;
   - `ALLOW_PRODUCTION_LOGICAL_BACKUP=CRYPTO_LAB_BACKUP_APPROVED` only after explicit authorization;
   - optional `OUTPUT_DIR` and `RETENTION_LABEL`.
5. Run `scripts/backup/crypto-lab-logical-backup.sh`.
6. Confirm that only the encrypted `.dump.age`, checksum and non-secret manifest remain.
7. Copy the encrypted artifact and manifest to at least one approved off-site destination.
8. Verify checksums after transfer.
9. Record operator, UTC timestamps, destination class and retention label without recording credentials or personal data.

The script uses PostgreSQL custom format, excludes ownership/privilege replay, encrypts before persistence in the output directory and deletes its temporary plaintext file.

## Retention proposal

Until managed backups are approved:

- daily: 7 days;
- weekly: 4 weeks;
- monthly: 3 months;
- at least three copies total;
- at least one copy off-site;
- deletion must be logged by artifact digest, not by database content.

Retention is a proposal, not an activated policy. Storage location and cost remain external decisions.

## Restore rehearsal procedure

A restore rehearsal must never target `txhzxbizjpinowepfjkm`.

1. Create or select a separate non-production PostgreSQL/Supabase target.
2. Ensure the target contains no valuable data and is approved for destructive clean restore.
3. Supply:
   - `RESTORE_DATABASE_URL` through the secure host secret mechanism;
   - `TARGET_PROJECT_REF` different from production;
   - `BACKUP_IDENTITY_FILE` pointing to the local `age` private identity;
   - `ALLOW_NONPROD_RESTORE=CRYPTO_LAB_NONPROD_ONLY`;
   - `CONFIRM_TARGET_IS_DISPOSABLE=YES_DESTROY_NONPROD_DATA`.
4. Run `scripts/backup/crypto-lab-restore-rehearsal.sh <archive.dump.age>`.
5. The script verifies checksum when available, decrypts to a restrictive temporary file, validates the archive, performs clean restore and runs bounded post-restore assertions.
6. Review the generated JSON report.
7. Execute an isolated application smoke against the non-production target only after separate authorization and isolated Auth configuration.
8. Record whether the target is destroyed or retained under an approved non-production retention policy.

## Mandatory post-restore assertions

- expected CRYPTO LAB tables exist;
- all CRYPTO LAB tables have RLS enabled;
- no unvalidated constraints;
- no orphan user profiles;
- no orphan subscriptions;
- release manifest and checkpoint tables exist;
- database is reachable and restore completed without ignored errors;
- target is not production;
- credentials and decrypted archive are absent from evidence.

## Evidence record

The restore report contains only:

- build and non-production target ref;
- start/completion times and duration;
- encrypted archive SHA-256;
- aggregate assertion counts;
- pass/fail state;
- no connection URI, password, private encryption identity, raw rows or user data.

## Failure handling

- Empty or unreadable dump: stop and preserve only redacted tool error plus artifact digest.
- Encryption failure: delete plaintext temporary file and do not upload anything.
- Checksum mismatch: quarantine the artifact and do not decrypt.
- Restore assertion failure: keep the target isolated, record the failed assertions and open an operational issue before another attempt.
- Any possibility that the target is production: stop immediately; the script also refuses the known production project ref.

## Completion condition

`BACKUP_PITR` may move to verified only after:

1. the owner approves either managed backups or the documented logical-backup alternative;
2. one real encrypted production backup is created under explicit authorization;
3. checksum is verified after off-site transfer;
4. one clean restore into a separate non-production target passes;
5. evidence is reviewed for secret and personal-data leakage;
6. RPO/RTO result is accepted.
