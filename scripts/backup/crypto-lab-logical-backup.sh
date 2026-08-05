#!/usr/bin/env bash
set -euo pipefail

# CRYPTO LAB v79 logical backup template.
# This script does not know or fetch credentials. Run only from an approved secure host.

PRODUCTION_PROJECT_REF="txhzxbizjpinowepfjkm"
BUILD="7930"
OUTPUT_DIR="${OUTPUT_DIR:-./crypto-lab-backups}"
RETENTION_LABEL="${RETENTION_LABEL:-manual}"

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

require_command pg_dump
require_command age
require_command sha256sum
require_command python3
require_nonempty PG_DUMP_URL
require_nonempty BACKUP_ENCRYPTION_RECIPIENT
require_nonempty SOURCE_PROJECT_REF

if [[ "$SOURCE_PROJECT_REF" != "$PRODUCTION_PROJECT_REF" ]]; then
  printf 'SOURCE_PROJECT_REF does not match the controlled CRYPTO LAB production project.\n' >&2
  exit 3
fi

if [[ "${ALLOW_PRODUCTION_LOGICAL_BACKUP:-}" != "CRYPTO_LAB_BACKUP_APPROVED" ]]; then
  printf 'Production backup guard is not approved. Set ALLOW_PRODUCTION_LOGICAL_BACKUP only for an explicitly authorized run.\n' >&2
  exit 3
fi

if [[ "$PG_DUMP_URL" != postgresql://* && "$PG_DUMP_URL" != postgres://* ]]; then
  printf 'PG_DUMP_URL must use a PostgreSQL connection URI.\n' >&2
  exit 3
fi

umask 077
mkdir -p "$OUTPUT_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="crypto-lab-${BUILD}-${SOURCE_PROJECT_REF}-${timestamp}-${RETENTION_LABEL}"
plain="$(mktemp "${TMPDIR:-/tmp}/${base}.XXXXXX.dump")"
encrypted="${OUTPUT_DIR}/${base}.dump.age"
checksum="${encrypted}.sha256"
manifest="${OUTPUT_DIR}/${base}.manifest.json"

cleanup() {
  rm -f "$plain"
}
trap cleanup EXIT INT TERM

printf 'Creating bounded PostgreSQL custom-format dump...\n'
pg_dump "$PG_DUMP_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$plain"

if [[ ! -s "$plain" ]]; then
  printf 'pg_dump produced an empty archive.\n' >&2
  exit 4
fi

printf 'Encrypting archive...\n'
age --recipient "$BACKUP_ENCRYPTION_RECIPIENT" --output "$encrypted" "$plain"
rm -f "$plain"
trap - EXIT INT TERM

if [[ ! -s "$encrypted" ]]; then
  printf 'Encrypted archive is empty.\n' >&2
  exit 4
fi

sha256sum "$encrypted" > "$checksum"
archive_sha="$(awk '{print $1}' "$checksum")"
archive_size="$(wc -c < "$encrypted" | tr -d ' ')"
pg_dump_version="$(pg_dump --version | head -n1)"
age_version="$(age --version 2>/dev/null | head -n1 || true)"

python3 - "$manifest" "$BUILD" "$SOURCE_PROJECT_REF" "$timestamp" "$RETENTION_LABEL" "$encrypted" "$archive_sha" "$archive_size" "$pg_dump_version" "$age_version" <<'PY'
import json
import pathlib
import sys

(
    output,
    build,
    project_ref,
    timestamp,
    retention_label,
    encrypted_path,
    archive_sha,
    archive_size,
    pg_dump_version,
    age_version,
) = sys.argv[1:]

payload = {
    "schema_version": 1,
    "build": build,
    "source_project_ref": project_ref,
    "created_at_utc": timestamp,
    "retention_label": retention_label,
    "archive_file": pathlib.Path(encrypted_path).name,
    "archive_sha256": archive_sha,
    "archive_size_bytes": int(archive_size),
    "archive_encrypted": True,
    "plaintext_retained": False,
    "pg_dump_version": pg_dump_version,
    "encryption_tool_version": age_version,
    "automatic_upload_performed": False,
    "contains_credentials": False,
}
pathlib.Path(output).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY

sha256sum "$manifest" > "${manifest}.sha256"

printf 'Encrypted backup created. No upload was performed.\n'
printf 'Archive: %s\n' "$encrypted"
printf 'Manifest: %s\n' "$manifest"
