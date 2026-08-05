#!/usr/bin/env bash
set -euo pipefail

# CRYPTO LAB v79 restore rehearsal template.
# The production project is explicitly denied. Destructive restore is allowed only
# against a separately supplied non-production target after all guards pass.

PRODUCTION_PROJECT_REF="txhzxbizjpinowepfjkm"
BUILD="7930"
ARCHIVE_PATH="${1:-}"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$1" >&2
    exit 2
  }
}

require_nonempty() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Required environment variable is missing: %s\n' "$name" >&2
    exit 2
  fi
}

require_command age
require_command pg_restore
require_command psql
require_command sha256sum
require_nonempty RESTORE_DATABASE_URL
require_nonempty TARGET_PROJECT_REF
require_nonempty BACKUP_IDENTITY_FILE

if [[ -z "$ARCHIVE_PATH" || ! -f "$ARCHIVE_PATH" ]]; then
  printf 'Usage: %s <encrypted-backup.dump.age>\n' "$0" >&2
  exit 2
fi

if [[ "${ALLOW_NONPROD_RESTORE:-}" != "CRYPTO_LAB_NONPROD_ONLY" ]]; then
  printf 'Restore guard is not approved.\n' >&2
  exit 3
fi

if [[ "$TARGET_PROJECT_REF" == "$PRODUCTION_PROJECT_REF" ]]; then
  printf 'Refusing restore: production project ref is forbidden.\n' >&2
  exit 3
fi

if [[ ${#TARGET_PROJECT_REF} -lt 8 ]]; then
  printf 'TARGET_PROJECT_REF is not a valid bounded non-production identifier.\n' >&2
  exit 3
fi

if [[ "$RESTORE_DATABASE_URL" != postgresql://* && "$RESTORE_DATABASE_URL" != postgres://* ]]; then
  printf 'RESTORE_DATABASE_URL must use a PostgreSQL connection URI.\n' >&2
  exit 3
fi

if [[ ! -f "$BACKUP_IDENTITY_FILE" ]]; then
  printf 'BACKUP_IDENTITY_FILE does not exist.\n' >&2
  exit 3
fi

if [[ "${CONFIRM_TARGET_IS_DISPOSABLE:-}" != "YES_DESTROY_NONPROD_DATA" ]]; then
  printf 'Disposable-target confirmation is missing.\n' >&2
  exit 3
fi

umask 077
plain="$(mktemp "${TMPDIR:-/tmp}/crypto-lab-${BUILD}-restore.XXXXXX.dump")"
report="${RESTORE_REPORT_PATH:-./crypto-lab-${BUILD}-${TARGET_PROJECT_REF}-restore-report.json}"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
started_epoch="$(date +%s)"

cleanup() {
  rm -f "$plain"
}
trap cleanup EXIT INT TERM

printf 'Verifying encrypted archive checksum when companion file exists...\n'
if [[ -f "${ARCHIVE_PATH}.sha256" ]]; then
  (cd "$(dirname "$ARCHIVE_PATH")" && sha256sum --check "$(basename "${ARCHIVE_PATH}.sha256")")
fi

printf 'Decrypting into a temporary local file...\n'
age --decrypt --identity "$BACKUP_IDENTITY_FILE" --output "$plain" "$ARCHIVE_PATH"

if [[ ! -s "$plain" ]]; then
  printf 'Decrypted archive is empty.\n' >&2
  exit 4
fi

printf 'Testing archive readability...\n'
pg_restore --list "$plain" >/dev/null

printf 'Restoring only into the guarded non-production target...\n'
pg_restore \
  --dbname="$RESTORE_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "$plain"

printf 'Running bounded post-restore assertions...\n'
assertions_json="$(psql "$RESTORE_DATABASE_URL" --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 <<'SQL'
with crypto_tables as (
  select count(*)::int as total
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'crypto\_%' escape '\'
), rls_missing as (
  select count(*)::int as total
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'crypto\_%' escape '\' and not c.relrowsecurity
), invalid_constraints as (
  select count(*)::int as total
  from pg_constraint con
  join pg_class c on c.oid=con.conrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname like 'crypto\_%' escape '\' and not con.convalidated
), profile_orphans as (
  select case when to_regclass('public.crypto_user_profiles') is null then 0 else (
    select count(*)::int from public.crypto_user_profiles p left join auth.users u on u.id=p.user_id where u.id is null
  ) end as total
), subscription_orphans as (
  select case when to_regclass('public.crypto_subscriptions') is null then 0 else (
    select count(*)::int from public.crypto_subscriptions s left join auth.users u on u.id=s.user_id where u.id is null
  ) end as total
)
select jsonb_build_object(
  'crypto_tables',(select total from crypto_tables),
  'rls_missing',(select total from rls_missing),
  'invalid_constraints',(select total from invalid_constraints),
  'profile_orphans',(select total from profile_orphans),
  'subscription_orphans',(select total from subscription_orphans),
  'release_manifest_present',to_regclass('public.crypto_release_manifests') is not null,
  'release_checkpoint_present',to_regclass('public.crypto_release_checkpoints') is not null
)::text;
SQL
)"

completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
duration_seconds="$(( $(date +%s) - started_epoch ))"
archive_sha="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"

python3 - "$report" "$BUILD" "$TARGET_PROJECT_REF" "$started_at" "$completed_at" "$duration_seconds" "$archive_sha" "$assertions_json" <<'PY'
import json
import pathlib
import sys

output, build, target_ref, started, completed, duration, archive_sha, assertions = sys.argv[1:]
data = json.loads(assertions)
data.update({
    "schema_version": 1,
    "build": build,
    "target_project_ref": target_ref,
    "production_target": False,
    "started_at": started,
    "completed_at": completed,
    "duration_seconds": int(duration),
    "encrypted_archive_sha256": archive_sha,
    "plaintext_retained": False,
    "credentials_recorded": False,
})
errors = []
if data.get("crypto_tables", 0) < 10:
    errors.append("insufficient_crypto_tables")
for key in ("rls_missing", "invalid_constraints", "profile_orphans", "subscription_orphans"):
    if data.get(key) != 0:
        errors.append(key)
if not data.get("release_manifest_present"):
    errors.append("release_manifest_missing")
if not data.get("release_checkpoint_present"):
    errors.append("release_checkpoint_missing")
data["passed"] = not errors
data["errors"] = errors
pathlib.Path(output).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
if errors:
    raise SystemExit("Restore assertions failed: " + ", ".join(errors))
PY

rm -f "$plain"
trap - EXIT INT TERM
printf 'Non-production restore rehearsal passed. Report: %s\n' "$report"
printf 'The script does not destroy or retain the target automatically; record that decision separately.\n'
