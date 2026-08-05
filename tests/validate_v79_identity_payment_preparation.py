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

IDENTITY_PLAN = ROOT / "docs/release-manifests/crypto-lab-v79-identity-provisioning-plan.json"
PAYMENT_MAP = ROOT / "docs/release-manifests/crypto-lab-v79-payment-adapter-map.json"
BILLING_V1 = ROOT / "docs/schemas/crypto-billing-normalized-event-v1.schema.json"
BILLING_V2 = ROOT / "docs/schemas/crypto-billing-normalized-event-v2.draft.schema.json"
IDENTITY_DOC = ROOT / "docs/TURNSTILE_REAL_ADMIN_RUNBOOK_7930.md"
PAYMENT_DOC = ROOT / "docs/PAYMENT_ADAPTER_MAPPING_7930.md"

ERRORS: list[str] = []


def fail(message: str) -> None:
    ERRORS.append(message)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


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


def validate_common(document: dict[str, Any], name: str) -> None:
    require(document.get("schema_version") == 1, f"{name}: schema_version must be 1")
    require(document.get("project_ref") == PROJECT_REF, f"{name}: project ref mismatch")
    require(document.get("build") == BUILD, f"{name}: build mismatch")


def validate_identity(plan: dict[str, Any]) -> None:
    validate_common(plan, "identity plan")
    require(plan.get("mode") == "preparation_only", "identity mode must be preparation_only")
    require(plan.get("activation_allowed") is False, "identity activation must remain false")
    require(plan.get("hosted_test_user_creation_allowed") is False, "hosted user creation must remain false")
    require(plan.get("test_email_delivery_allowed") is False, "test email must remain false")
    require(plan.get("production_credentials_present") is False, "production credentials must not be claimed present")

    turnstile = plan.get("turnstile", {})
    require(turnstile.get("production_hostname") == "1specnazov1.github.io", "Turnstile hostname mismatch")
    require(turnstile.get("wildcard_hostname_allowed") is False, "Turnstile wildcard must be forbidden")
    require(turnstile.get("siteverify_required") is True, "Siteverify must be required")
    require(turnstile.get("secret_key_server_only") is True, "Turnstile secret must be server-only")
    require(turnstile.get("secret_key_repository_storage_forbidden") is True, "Turnstile secret repository guard missing")
    require(turnstile.get("token_max_length") == 2048, "Turnstile token length mismatch")
    require(turnstile.get("token_ttl_seconds") == 300, "Turnstile TTL mismatch")
    require(turnstile.get("token_single_use") is True, "Turnstile token must be single use")
    require(turnstile.get("validation_timeout_seconds") == 10, "Turnstile timeout mismatch")
    require(turnstile.get("idempotency_key_required") is True, "Turnstile idempotency required")

    flows = {item.get("code"): item for item in turnstile.get("flows", [])}
    require(set(flows) == {"registration", "recovery"}, "Turnstile flow set mismatch")
    registration = flows.get("registration", {})
    recovery = flows.get("recovery", {})
    require(registration.get("edge_version") == 3, "registration edge version mismatch")
    require(registration.get("expected_action") == "crypto_register", "registration action mismatch")
    require(registration.get("enabled") is False, "registration must remain disabled")
    require(recovery.get("edge_version") == 2, "recovery edge version mismatch")
    require(recovery.get("expected_action") == "crypto_recover", "recovery action mismatch")
    require(recovery.get("enabled") is False, "recovery must remain disabled")

    test_environment = turnstile.get("test_environment", {})
    require(test_environment.get("official_dummy_keys_only") is True, "official dummy key rule missing")
    require(test_environment.get("production_key_use_for_automation_forbidden") is True, "production automation key guard missing")
    require(test_environment.get("dummy_key_use_in_production_forbidden") is True, "dummy production key guard missing")

    admin = plan.get("real_admin", {})
    require(admin.get("assignment_allowed") is False, "admin assignment must remain false")
    require(admin.get("synthetic_admin_forbidden") is True, "synthetic admin must be forbidden")
    require(admin.get("owned_email_required") is True, "owned email must be required")
    require(admin.get("confirmed_auth_user_required") is True, "confirmed Auth user must be required")
    require(admin.get("exact_user_id_required") is True, "exact user id must be required")
    require(admin.get("browser_role_write_forbidden") is True, "browser role update must be forbidden")
    require(admin.get("service_or_sql_protected_assignment_only") is True, "protected admin assignment required")
    require(admin.get("revocation_required") is True, "admin revocation test required")

    tests = plan.get("required_e2e_tests", [])
    require(len(tests) == 20 and len(set(tests)) == 20, "identity plan must define exactly 20 unique tests")
    critical = {
        "TURNSTILE_WRONG_ACTION",
        "TURNSTILE_WRONG_HOSTNAME",
        "REGISTRATION_MAIL_ROLLBACK",
        "RECOVERY_ENUMERATION_SAFE",
        "NO_SECRET_IN_BROWSER_OR_LOGS",
        "REAL_ADMIN_EXACT_OWNED_USER_ONLY",
        "ORDINARY_USER_ADMIN_DENIED",
        "ADMIN_REVOCATION",
    }
    require(critical <= set(tests), "identity critical tests missing")


def validate_v2_schema(schema: dict[str, Any]) -> None:
    require(schema.get("additionalProperties") is False, "billing v2 root must reject additional properties")
    require(schema.get("properties", {}).get("schema_version", {}).get("const") == 2, "billing v2 schema version mismatch")
    provider_enum = set(schema.get("properties", {}).get("provider", {}).get("enum", []))
    require(provider_enum == {"liqpay", "stripe", "onchain"}, "billing v2 providers mismatch")
    event_enum = set(schema.get("properties", {}).get("event_type", {}).get("enum", []))
    require({"payment.confirming", "payment.partially_refunded", "payment.disputed"} <= event_enum, "billing v2 event types incomplete")
    payload = schema.get("properties", {}).get("payload", {}).get("properties", {})
    for key in (
        "asset_symbol",
        "amount_atomic",
        "asset_decimals",
        "network_namespace",
        "network_reference",
        "token_contract",
        "transaction_hash",
        "recipient_address",
    ):
        require(key in payload, f"billing v2 payload missing {key}")
    verification = schema.get("properties", {}).get("verification", {}).get("properties", {})
    require({"chain_finality_verified", "confirmation_count", "required_confirmations"} <= set(verification), "billing v2 finality fields missing")


def validate_payment(mapping: dict[str, Any], v1: dict[str, Any], v2: dict[str, Any]) -> None:
    validate_common(mapping, "payment adapter map")
    require(mapping.get("mode") == "disabled", "payment mode must remain disabled")
    for key in (
        "provider_selected",
        "checkout_activation_allowed",
        "real_money_allowed",
        "prices_active",
        "recurring_billing_active",
        "refund_execution_allowed",
    ):
        require(mapping.get(key) is False, f"payment activation flag must remain false: {key}")

    schema_link = mapping.get("normalized_event_schema", {})
    require(schema_link.get("runtime_v2_migration_applied") is False, "billing v2 migration must remain unapplied")
    require(schema_link.get("onchain_activation_blocked_until_v2") is True, "onchain schema block required")
    reasons = set(schema_link.get("blocking_reasons", []))
    require({"V1_PROVIDER_ENUM_EXCLUDES_ONCHAIN", "V1_HAS_NO_CHAIN_FINALITY_FIELDS", "DATABASE_CONSTRAINTS_NOT_MIGRATED"} <= reasons, "onchain blocking reasons incomplete")

    v1_providers = set(v1.get("properties", {}).get("provider", {}).get("enum", []))
    require("onchain" not in v1_providers, "runtime v1 unexpectedly includes onchain")
    validate_v2_schema(v2)

    invariants = mapping.get("security_invariants", {})
    for key in (
        "browser_never_sets_paid_status",
        "entitlement_changes_server_side_only",
        "transaction_hash_unique_for_onchain",
        "redirect_not_source_of_truth",
        "seed_phrase_never_requested",
        "private_key_never_requested",
        "wallet_signature_never_treated_as_payment",
        "network_and_asset_allowlist_required",
        "token_contract_allowlist_required",
        "recipient_address_allowlist_required",
        "amount_and_expiry_bound_to_invoice",
    ):
        require(invariants.get(key) is True, f"payment invariant missing: {key}")

    adapters = {item.get("code"): item for item in mapping.get("candidate_adapters", [])}
    require(set(adapters) == {"liqpay", "stripe", "onchain_walletconnect"}, "candidate adapter set mismatch")
    for code, adapter in adapters.items():
        require(adapter.get("selected") is False, f"adapter {code} must remain unselected")
        require(adapter.get("activation_allowed") is False, f"adapter {code} activation must remain false")
    onchain = adapters.get("onchain_walletconnect", {})
    require(onchain.get("wallet_client_is_payment_processor") is False, "wallet client must not be payment processor")
    require(onchain.get("source_of_truth") == "server_verified_blockchain_transaction", "onchain source of truth mismatch")
    require(onchain.get("network_selected") is False, "network must remain unselected")
    require(onchain.get("asset_selected") is False, "asset must remain unselected")
    require(onchain.get("recipient_address_selected") is False, "recipient address must remain unselected")
    require(onchain.get("supports_recurring_candidate") is False, "direct onchain recurring must not be claimed")
    require(onchain.get("launch_billing_model") == "prepaid_30d_candidate", "onchain launch billing model mismatch")
    invoice = set(onchain.get("invoice_requirements", []))
    require({"EXACT_AMOUNT_ATOMIC", "EXPIRY_TIME", "REQUIRED_CONFIRMATIONS"} <= invoice, "onchain invoice requirements incomplete")
    verification = set(onchain.get("verification_requirements", []))
    require({"TRANSACTION_HASH_UNUSED", "CONFIRMATIONS_REACHED", "CHAIN_REORG_POLICY_PASSED"} <= verification, "onchain verification incomplete")

    scenarios = mapping.get("sandbox_scenario_mapping", [])
    codes = [item.get("code") for item in scenarios]
    require(len(codes) == 14 and len(set(codes)) == 14, "payment mapping must contain exactly 14 unique scenarios")
    required_codes = {
        "CHECKOUT_SUCCESS",
        "DUPLICATE_WEBHOOK",
        "OUT_OF_ORDER_WEBHOOK",
        "LATE_SUCCESS_AFTER_REDIRECT_FAILURE",
        "FULL_REFUND",
        "PARTIAL_REFUND",
        "CHARGEBACK_OR_DISPUTE",
        "UNKNOWN_PROVIDER_EVENT",
    }
    require(required_codes <= set(codes), "payment critical scenario mapping missing")


def validate_docs() -> None:
    markers = {
        IDENTITY_DOC: [
            "Execution status: not authorized",
            "Registration and recovery: disabled",
            "A synthetic user or browser-side role update is forbidden",
            "Public registration and recovery are separate owner decisions",
        ],
        PAYMENT_DOC: [
            "Provider: unselected",
            "Checkout and real-money operation: disabled",
            "Trust Wallet is a self-custody wallet client",
            "direct crypto payment is explicitly blocked",
            "No seed phrase or private key should ever be supplied",
        ],
    }
    for path, expected in markers.items():
        if not path.is_file():
            fail(f"missing document: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8")
        for marker in expected:
            require(marker in text, f"{path.name}: missing marker {marker!r}")


def scan_for_secrets() -> None:
    paths = [IDENTITY_PLAN, PAYMENT_MAP, BILLING_V2, IDENTITY_DOC, PAYMENT_DOC]
    forbidden = {
        "Supabase secret": re.compile(r"sb_secret_[A-Za-z0-9_-]{12,}"),
        "JWT": re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"),
        "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "database credential": re.compile(r"postgres(?:ql)?://[^\s\"']+:[^\s\"']+@"),
        "wallet seed phrase": re.compile(r"(?:\b[a-z]{3,10}\b\s+){11,23}\b[a-z]{3,10}\b", re.I),
    }
    for path in paths:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for label, pattern in forbidden.items():
            if pattern.search(text):
                fail(f"{path.relative_to(ROOT)}: possible {label} detected")


def main() -> int:
    identity = load_json(IDENTITY_PLAN)
    payment = load_json(PAYMENT_MAP)
    v1 = load_json(BILLING_V1)
    v2 = load_json(BILLING_V2)
    validate_identity(identity)
    validate_payment(payment, v1, v2)
    validate_docs()
    scan_for_secrets()
    if ERRORS:
        for error in ERRORS:
            print(f"ERROR: {error}")
        return 1
    print("CRYPTO LAB v79 identity and payment preparation contracts passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
