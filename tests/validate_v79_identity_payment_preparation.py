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


def require(condition: bool, message: str) -> None:
    if not condition:
        ERRORS.append(message)


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        ERRORS.append(f"missing file: {path.relative_to(ROOT)}")
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        ERRORS.append(f"invalid JSON {path.relative_to(ROOT)}: {exc}")
        return {}
    require(isinstance(value, dict), f"JSON root must be object: {path.relative_to(ROOT)}")
    return value if isinstance(value, dict) else {}


def common(document: dict[str, Any], name: str) -> None:
    require(document.get("schema_version") == 1, f"{name}: schema_version mismatch")
    require(document.get("project_ref") == PROJECT_REF, f"{name}: project mismatch")
    require(document.get("build") == BUILD, f"{name}: build mismatch")


def validate_identity(plan: dict[str, Any]) -> None:
    common(plan, "identity")
    require(plan.get("mode") == "preparation_only", "identity must be preparation_only")
    for key in ("activation_allowed", "hosted_test_user_creation_allowed", "test_email_delivery_allowed", "production_credentials_present"):
        require(plan.get(key) is False, f"identity flag must remain false: {key}")

    turnstile = plan.get("turnstile", {})
    expected = {
        "production_hostname": "1specnazov1.github.io",
        "wildcard_hostname_allowed": False,
        "siteverify_required": True,
        "secret_key_server_only": True,
        "secret_key_repository_storage_forbidden": True,
        "secret_key_log_storage_forbidden": True,
        "token_max_length": 2048,
        "token_ttl_seconds": 300,
        "token_single_use": True,
        "validation_timeout_seconds": 10,
        "idempotency_key_required": True,
    }
    for key, value in expected.items():
        require(turnstile.get(key) == value, f"Turnstile contract mismatch: {key}")

    flows = {item.get("code"): item for item in turnstile.get("flows", [])}
    require(set(flows) == {"registration", "recovery"}, "Turnstile flow set mismatch")
    require(flows.get("registration", {}).get("edge_version") == 3, "registration edge version mismatch")
    require(flows.get("registration", {}).get("expected_action") == "crypto_register", "registration action mismatch")
    require(flows.get("registration", {}).get("enabled") is False, "registration must remain disabled")
    require(flows.get("recovery", {}).get("edge_version") == 2, "recovery edge version mismatch")
    require(flows.get("recovery", {}).get("expected_action") == "crypto_recover", "recovery action mismatch")
    require(flows.get("recovery", {}).get("enabled") is False, "recovery must remain disabled")

    test_env = turnstile.get("test_environment", {})
    for key in ("official_dummy_keys_only", "production_key_use_for_automation_forbidden", "dummy_key_use_in_production_forbidden", "isolated_environment_required"):
        require(test_env.get(key) is True, f"Turnstile test guard missing: {key}")

    admin = plan.get("real_admin", {})
    require(admin.get("assignment_allowed") is False, "admin assignment must remain disabled")
    for key in ("synthetic_admin_forbidden", "owned_email_required", "confirmed_auth_user_required", "exact_user_id_required", "browser_role_write_forbidden", "service_or_sql_protected_assignment_only", "revocation_required"):
        require(admin.get(key) is True, f"real-admin invariant missing: {key}")

    tests = plan.get("required_e2e_tests", [])
    require(len(tests) == 20 and len(set(tests)) == 20, "identity must define exactly 20 unique tests")
    require({"TURNSTILE_WRONG_ACTION", "TURNSTILE_WRONG_HOSTNAME", "REGISTRATION_MAIL_ROLLBACK", "RECOVERY_ENUMERATION_SAFE", "NO_SECRET_IN_BROWSER_OR_LOGS", "REAL_ADMIN_EXACT_OWNED_USER_ONLY", "ORDINARY_USER_ADMIN_DENIED", "ADMIN_REVOCATION"} <= set(tests), "identity critical tests missing")


def validate_v2(schema: dict[str, Any]) -> None:
    require(schema.get("additionalProperties") is False, "v2 root additionalProperties must be false")
    properties = schema.get("properties", {})
    require(properties.get("schema_version", {}).get("const") == 2, "v2 schema version mismatch")
    require(set(properties.get("provider", {}).get("enum", [])) == {"liqpay", "stripe", "onchain"}, "v2 providers mismatch")
    require({"payment.confirming", "payment.partially_refunded", "payment.disputed"} <= set(properties.get("event_type", {}).get("enum", [])), "v2 events incomplete")
    payload = properties.get("payload", {}).get("properties", {})
    require({"asset_symbol", "amount_atomic", "asset_decimals", "network_namespace", "network_reference", "token_contract", "transaction_hash", "recipient_address"} <= set(payload), "v2 onchain payload incomplete")
    verification = properties.get("verification", {}).get("properties", {})
    require({"chain_finality_verified", "confirmation_count", "required_confirmations"} <= set(verification), "v2 finality fields missing")


def validate_payment(mapping: dict[str, Any], v1: dict[str, Any], v2: dict[str, Any]) -> None:
    common(mapping, "payment")
    require(mapping.get("mode") == "disabled", "payment mode must remain disabled")
    for key in ("provider_selected", "checkout_activation_allowed", "real_money_allowed", "prices_active", "recurring_billing_active", "refund_execution_allowed"):
        require(mapping.get(key) is False, f"payment flag must remain false: {key}")

    schema_link = mapping.get("normalized_event_schema", {})
    require(schema_link.get("runtime_v2_migration_applied") is False, "v2 runtime migration must remain false")
    require(schema_link.get("onchain_activation_blocked_until_v2") is True, "onchain must remain blocked until v2")
    require({"V1_PROVIDER_ENUM_EXCLUDES_ONCHAIN", "V1_HAS_NO_CHAIN_FINALITY_FIELDS", "DATABASE_CONSTRAINTS_NOT_MIGRATED"} <= set(schema_link.get("blocking_reasons", [])), "blocking reasons incomplete")
    require("onchain" not in set(v1.get("properties", {}).get("provider", {}).get("enum", [])), "runtime v1 unexpectedly supports onchain")
    validate_v2(v2)

    invariants = mapping.get("security_invariants", {})
    for key in ("browser_never_sets_paid_status", "entitlement_changes_server_side_only", "transaction_hash_unique_for_onchain", "redirect_not_source_of_truth", "seed_phrase_never_requested", "private_key_never_requested", "wallet_signature_never_treated_as_payment", "network_and_asset_allowlist_required", "token_contract_allowlist_required", "recipient_address_allowlist_required", "amount_and_expiry_bound_to_invoice"):
        require(invariants.get(key) is True, f"payment invariant missing: {key}")

    adapters = {item.get("code"): item for item in mapping.get("candidate_adapters", [])}
    require(set(adapters) == {"liqpay", "stripe", "onchain_walletconnect"}, "candidate adapter set mismatch")
    for code, adapter in adapters.items():
        require(adapter.get("selected") is False, f"adapter must remain unselected: {code}")
        require(adapter.get("activation_allowed") is False, f"adapter activation must remain false: {code}")
    onchain = adapters.get("onchain_walletconnect", {})
    require(onchain.get("wallet_client_is_payment_processor") is False, "wallet client cannot be payment processor")
    require(onchain.get("source_of_truth") == "server_verified_blockchain_transaction", "onchain source of truth mismatch")
    for key in ("network_selected", "asset_selected", "recipient_address_selected", "supports_recurring_candidate"):
        require(onchain.get(key) is False, f"onchain flag must remain false: {key}")
    require(onchain.get("launch_billing_model") == "prepaid_30d_candidate", "onchain launch model mismatch")
    require({"EXACT_AMOUNT_ATOMIC", "EXPIRY_TIME", "REQUIRED_CONFIRMATIONS"} <= set(onchain.get("invoice_requirements", [])), "onchain invoice requirements incomplete")
    require({"TRANSACTION_HASH_UNUSED", "CONFIRMATIONS_REACHED", "CHAIN_REORG_POLICY_PASSED"} <= set(onchain.get("verification_requirements", [])), "onchain verification incomplete")

    scenarios = mapping.get("sandbox_scenario_mapping", [])
    codes = [item.get("code") for item in scenarios]
    require(len(codes) == 14 and len(set(codes)) == 14, "payment map must define exactly 14 unique scenarios")
    require({"CHECKOUT_SUCCESS", "DUPLICATE_WEBHOOK", "OUT_OF_ORDER_WEBHOOK", "LATE_SUCCESS_AFTER_REDIRECT_FAILURE", "FULL_REFUND", "PARTIAL_REFUND", "CHARGEBACK_OR_DISPUTE", "UNKNOWN_PROVIDER_EVENT"} <= set(codes), "critical payment scenarios missing")


def validate_docs() -> None:
    markers = {
        IDENTITY_DOC: ["Execution status: not authorized", "Registration and recovery: disabled", "A synthetic user or browser-side role update is forbidden", "Public registration and recovery are separate owner decisions"],
        PAYMENT_DOC: ["Provider: unselected", "Checkout and real-money operation: disabled", "Trust Wallet is a self-custody wallet client", "direct crypto payment is explicitly blocked", "No seed phrase or private key should ever be supplied"],
    }
    for path, expected in markers.items():
        require(path.is_file(), f"missing document: {path.relative_to(ROOT)}")
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for marker in expected:
            require(marker in text, f"{path.name}: missing marker {marker!r}")


def scan_for_secrets() -> None:
    patterns = {
        "Supabase secret": re.compile(r"sb_secret_[A-Za-z0-9_-]{12,}"),
        "JWT": re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"),
        "private key block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "database credential": re.compile(r"postgres(?:ql)?://[^\s\"']+:[^\s\"']+@"),
    }
    for path in (IDENTITY_PLAN, PAYMENT_MAP, BILLING_V2, IDENTITY_DOC, PAYMENT_DOC):
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for label, pattern in patterns.items():
            require(pattern.search(text) is None, f"{path.relative_to(ROOT)}: possible {label} detected")


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
