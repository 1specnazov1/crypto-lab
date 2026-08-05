#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BUILD = "7930"
PROJECT_REF = "txhzxbizjpinowepfjkm"

MAIL_SCHEMA = ROOT / "docs/schemas/crypto-mail-relay-request-v1.schema.json"
MAIL_CONTRACT = ROOT / "docs/release-manifests/crypto-lab-v79-mail-relay-contract.json"
BACKUP_PLAN = ROOT / "docs/release-manifests/crypto-lab-v79-backup-restore-plan.json"
DEVICE_PLAN = ROOT / "docs/release-manifests/crypto-lab-v79-device-beta-plan.json"
BACKUP_SCRIPT = ROOT / "scripts/backup/crypto-lab-logical-backup.sh"
RESTORE_SCRIPT = ROOT / "scripts/backup/crypto-lab-restore-rehearsal.sh"
MAIL_DOC = ROOT / "docs/MAIL_RELAY_DEPLOYMENT_CONTRACT_7930.md"
BACKUP_DOC = ROOT / "docs/BACKUP_RESTORE_RUNBOOK_7930.md"
DEVICE_DOC = ROOT / "docs/PHYSICAL_DEVICE_BETA_EVIDENCE_7930.md"

ERRORS: list[str] = []


def fail(message: str) -> None:
    ERRORS.append(message)


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        fail(f"missing file: {path.relative_to(ROOT)}")
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        fail(f"invalid JSON {path.relative_to(ROOT)}: {exc}")
        return {}
    if not isinstance(value, dict):
        fail(f"JSON root must be object: {path.relative_to(ROOT)}")
        return {}
    return value


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def require_build_and_project(document: dict[str, Any], name: str) -> None:
    require(document.get("schema_version") == 1, f"{name}: schema_version must be 1")
    require(document.get("build") == BUILD, f"{name}: build mismatch")
    require(document.get("project_ref") == PROJECT_REF, f"{name}: project ref mismatch")


def validate_mail_schema(schema: dict[str, Any]) -> None:
    require(schema.get("additionalProperties") is False, "mail schema must reject additional properties")
    required = set(schema.get("required", []))
    require(required == {"to", "template", "locale", "action_url", "idempotency_key"}, "mail schema required fields mismatch")
    properties = schema.get("properties", {})
    require(set(properties.get("template", {}).get("enum", [])) == {"signup_confirmation", "password_recovery"}, "mail schema templates mismatch")
    require(set(properties.get("locale", {}).get("enum", [])) == {"ru", "uk", "en"}, "mail schema locales mismatch")
    require(properties.get("action_url", {}).get("pattern") == "^https://", "mail schema must require HTTPS")
    require(properties.get("idempotency_key", {}).get("maxLength") == 160, "mail schema idempotency bound mismatch")


def validate_mail_contract(contract: dict[str, Any]) -> None:
    require_build_and_project(contract, "mail contract")
    require(contract.get("mode") == "disabled", "mail relay mode must remain disabled")
    require(contract.get("activation_allowed") is False, "mail relay activation must remain false")
    require(contract.get("provider") == "unselected", "mail provider must remain unselected")
    dispatcher = contract.get("dispatcher", {})
    require(dispatcher.get("slug") == "crypto-lab-mail-dispatch", "dispatcher slug mismatch")
    require(dispatcher.get("version") == 2, "dispatcher version mismatch")
    require(dispatcher.get("verify_jwt") is True, "dispatcher must verify JWT")
    request = contract.get("request_contract", {})
    require(request.get("arbitrary_subject_allowed") is False, "arbitrary subject must be forbidden")
    require(request.get("arbitrary_html_allowed") is False, "arbitrary HTML must be forbidden")
    require(request.get("arbitrary_text_allowed") is False, "arbitrary text must be forbidden")
    security = contract.get("security_invariants", {})
    for key in (
        "service_to_service_only",
        "relay_requires_separate_private_secret",
        "https_action_url_only",
        "provider_credentials_server_only",
        "secrets_never_returned",
        "secrets_never_logged",
        "raw_auth_tokens_never_logged",
        "idempotency_required",
        "duplicate_delivery_sends_once",
        "recipient_enumeration_safe",
        "open_redirects_forbidden",
    ):
        require(security.get(key) is True, f"mail security invariant missing: {key}")
    tests = set(contract.get("required_tests", []))
    require(len(tests) == 16, "mail contract must define exactly 16 unique required tests")
    require({"DUPLICATE_IDEMPOTENCY_KEY", "NO_SECRET_OR_ACTION_TOKEN_IN_LOGS", "PROVIDER_TIMEOUT"} <= tests, "mail contract critical tests missing")


def validate_backup_plan(plan: dict[str, Any]) -> None:
    require_build_and_project(plan, "backup plan")
    require(plan.get("current_plan") == "free", "backup plan current tier mismatch")
    require(plan.get("managed_automatic_backup_available") is False, "managed backup must not be claimed available")
    require(plan.get("pitr_available") is False, "PITR must not be claimed available")
    require(plan.get("purchase_authorized") is False, "purchase must remain unauthorized")
    require(plan.get("production_backup_execution_authorized") is False, "production backup must remain unauthorized")
    require(plan.get("restore_execution_authorized") is False, "restore must remain unauthorized")
    logical = plan.get("logical_backup", {})
    require(logical.get("encryption_required") is True, "logical backup encryption required")
    require(logical.get("plaintext_retained") is False, "plaintext retention forbidden")
    require(logical.get("automatic_upload") is False, "automatic upload forbidden")
    restore = plan.get("restore_rehearsal", {})
    require(restore.get("production_target_forbidden") is True, "production restore target must be forbidden")
    require(PROJECT_REF in restore.get("production_project_ref_denylist", []), "production project ref must be denied")
    require(restore.get("explicit_guard_value") == "CRYPTO_LAB_NONPROD_ONLY", "restore guard mismatch")


def validate_device_plan(plan: dict[str, Any]) -> None:
    require_build_and_project(plan, "device plan")
    require(plan.get("mode") == "preparation_only", "device plan must remain preparation-only")
    require(plan.get("physical_execution_authorized") is False, "physical execution must remain unauthorized")
    require(plan.get("beta_execution_authorized") is False, "beta execution must remain unauthorized")
    require(plan.get("publication_authorized") is False, "publication must remain unauthorized")
    platforms = {item.get("platform") for item in plan.get("platforms", [])}
    require(platforms == {"iOS", "Android"}, "device plan platforms mismatch")
    scenarios = set(plan.get("device_scenarios", []))
    require(len(scenarios) >= 20, "device plan requires at least 20 scenarios")
    require({"INSTALL_PWA", "OFFLINE_SHELL_START", "NO_V78_ROOT_CHANGE"} <= scenarios, "device plan critical scenarios missing")
    beta = plan.get("beta", {})
    require(beta.get("payments_enabled") is False, "beta payments must remain disabled")
    require(beta.get("real_money_forbidden") is True, "real-money beta must be forbidden")
    require(beta.get("manual_real_signal_creation_forbidden") is True, "manual real signals must be forbidden")
    thresholds = beta.get("success_thresholds", {})
    require(thresholds.get("critical_open_issues") == 0, "beta must require zero critical issues")
    require(thresholds.get("high_open_issues") == 0, "beta must require zero high issues")


def validate_scripts() -> None:
    for path in (BACKUP_SCRIPT, RESTORE_SCRIPT):
        if not path.is_file():
            fail(f"missing script: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8")
        require("set -euo pipefail" in text, f"{path.name}: strict shell mode missing")
        require("umask 077" in text, f"{path.name}: restrictive umask missing")
        require("curl " not in text and "wget " not in text, f"{path.name}: automatic network upload/download forbidden")
        require("sb_secret_" not in text, f"{path.name}: secret-shaped value forbidden")
        require(not re.search(r"postgres(?:ql)?://[^\s\"']+:[^\s\"']+@", text), f"{path.name}: embedded database credential detected")
    backup = BACKUP_SCRIPT.read_text(encoding="utf-8") if BACKUP_SCRIPT.exists() else ""
    restore = RESTORE_SCRIPT.read_text(encoding="utf-8") if RESTORE_SCRIPT.exists() else ""
    require("ALLOW_PRODUCTION_LOGICAL_BACKUP" in backup and "CRYPTO_LAB_BACKUP_APPROVED" in backup, "backup authorization guard missing")
    require("age --recipient" in backup, "backup encryption command missing")
    require("--no-owner" in backup and "--no-privileges" in backup, "backup privilege replay must be disabled")
    require("ALLOW_NONPROD_RESTORE" in restore and "CRYPTO_LAB_NONPROD_ONLY" in restore, "restore non-production guard missing")
    require("TARGET_PROJECT_REF" in restore and "PRODUCTION_PROJECT_REF" in restore, "restore target denial guard missing")
    require("CONFIRM_TARGET_IS_DISPOSABLE" in restore, "restore disposable-target guard missing")
    require("--exit-on-error" in restore, "restore must stop on first error")


def validate_docs() -> None:
    markers = {
        MAIL_DOC: ["Activation: disabled", "Arbitrary subject, HTML and text bodies are forbidden", "No hosted test is permitted"],
        BACKUP_DOC: ["Execution status: not authorized", "must never target `txhzxbizjpinowepfjkm`", "does not purchase a plan"],
        DEVICE_DOC: ["Execution: not started", "payments disabled and real-money testing forbidden", "publication remains a separate owner decision"],
    }
    for path, expected in markers.items():
        if not path.is_file():
            fail(f"missing document: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8")
        for marker in expected:
            require(marker in text, f"{path.name}: missing marker {marker!r}")


def scan_for_secret_values() -> None:
    paths = [MAIL_SCHEMA, MAIL_CONTRACT, BACKUP_PLAN, DEVICE_PLAN, BACKUP_SCRIPT, RESTORE_SCRIPT, MAIL_DOC, BACKUP_DOC, DEVICE_DOC]
    forbidden_patterns = {
        "Supabase secret key": re.compile(r"sb_secret_[A-Za-z0-9_-]{12,}"),
        "JWT-shaped token": re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"),
        "private key block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "database URI credential": re.compile(r"postgres(?:ql)?://[^\s\"']+:[^\s\"']+@"),
    }
    for path in paths:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for label, pattern in forbidden_patterns.items():
            if pattern.search(text):
                fail(f"{path.relative_to(ROOT)}: {label} detected")


def main() -> int:
    mail_schema = load_json(MAIL_SCHEMA)
    mail_contract = load_json(MAIL_CONTRACT)
    backup_plan = load_json(BACKUP_PLAN)
    device_plan = load_json(DEVICE_PLAN)
    validate_mail_schema(mail_schema)
    validate_mail_contract(mail_contract)
    validate_backup_plan(backup_plan)
    validate_device_plan(device_plan)
    validate_scripts()
    validate_docs()
    scan_for_secret_values()
    if ERRORS:
        for error in ERRORS:
            print(f"ERROR: {error}")
        return 1
    print("CRYPTO LAB v79 launch-preparation contracts passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
