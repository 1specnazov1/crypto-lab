#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESTORE="$ROOT/scripts/backup/crypto-lab-restore-rehearsal.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/bin"
for cmd in age pg_restore psql sha256sum; do
  cat >"$TMP/bin/$cmd" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$(basename "$0") invoked" >>"${FAKE_CALL_LOG:?}"
exit 99
SH
  chmod +x "$TMP/bin/$cmd"
done

archive="$TMP/test.dump.age"
identity="$TMP/identity.txt"
: >"$archive"
: >"$identity"

run_guard_case() {
  local name="$1" expected="$2"
  shift 2
  : >"$TMP/calls.log"
  set +e
  env PATH="$TMP/bin:$PATH" \
    FAKE_CALL_LOG="$TMP/calls.log" \
    BACKUP_IDENTITY_FILE="$identity" \
    ALLOW_NONPROD_RESTORE="CRYPTO_LAB_NONPROD_ONLY" \
    CONFIRM_TARGET_IS_DISPOSABLE="YES_DESTROY_NONPROD_DATA" \
    "$@" \
    bash "$RESTORE" "$archive" >"$TMP/$name.out" 2>&1
  code=$?
  set -e
  if [[ "$code" -ne "$expected" ]]; then
    cat "$TMP/$name.out" >&2
    printf 'Guard case %s expected exit %s but got %s\n' "$name" "$expected" "$code" >&2
    exit 1
  fi
  if [[ -s "$TMP/calls.log" ]]; then
    cat "$TMP/calls.log" >&2
    printf 'Guard case %s invoked an external restore command before denial\n' "$name" >&2
    exit 1
  fi
}

run_guard_case production_ref 3 \
  TARGET_PROJECT_REF="txhzxbizjpinowepfjkm" \
  RESTORE_DATABASE_URL="postgresql://example.invalid/db"

grep -q 'production project ref is forbidden' "$TMP/production_ref.out"

run_guard_case invalid_database_uri 3 \
  TARGET_PROJECT_REF="nonprod-check-7930" \
  RESTORE_DATABASE_URL="https://example.invalid/db"

grep -q 'must use a PostgreSQL connection URI' "$TMP/invalid_database_uri.out"

: >"$TMP/calls.log"
set +e
env PATH="$TMP/bin:$PATH" \
  FAKE_CALL_LOG="$TMP/calls.log" \
  BACKUP_IDENTITY_FILE="$identity" \
  ALLOW_NONPROD_RESTORE="CRYPTO_LAB_NONPROD_ONLY" \
  CONFIRM_TARGET_IS_DISPOSABLE="NO" \
  TARGET_PROJECT_REF="nonprod-check-7930" \
  RESTORE_DATABASE_URL="postgresql://example.invalid/db" \
  bash "$RESTORE" "$archive" >"$TMP/disposable.out" 2>&1
code=$?
set -e
[[ "$code" -eq 3 ]] || { cat "$TMP/disposable.out" >&2; exit 1; }
[[ ! -s "$TMP/calls.log" ]] || { cat "$TMP/calls.log" >&2; exit 1; }
grep -q 'Disposable-target confirmation is missing' "$TMP/disposable.out"

printf 'Restore rehearsal guard contract passed.\n'
