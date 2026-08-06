#!/usr/bin/env python3
"""Validate the closed CRYPTO LAB account/billing/support contract."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs/release-manifests/crypto-lab-v79-account-billing-support-contract.json"
MIGRATION = ROOT / "supabase/migrations/20260806210728_prepare_account_billing_support_contract.sql"
BASELINE = ROOT / "supabase/migrations/20260806210907_repair_launch_integrity_baseline_after_account_portal.sql"

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
sql = MIGRATION.read_text(encoding="utf-8")
baseline_sql = BASELINE.read_text(encoding="utf-8")

assert manifest["candidate"] == "v79"
assert manifest["stable_public_version"] == "v78"
assert manifest["stable_root_v78_sha"] == "4a278c891d37b3760ec1ac988690ea9ad587b24e"

assert manifest["pricing"]["BASIC"] == {
    "currency": "USD", "amount_minor": 2000, "billing_interval": "month", "active": False
}
assert manifest["pricing"]["PRO"] == {
    "currency": "USD", "amount_minor": 4900, "billing_interval": "month", "active": False
}
for plan in ("BASIC", "PRO"):
    policy = manifest["access_policy"][plan]
    assert policy["access_period"] == "1 month"
    assert policy["renewal_mode"] == "manual"
    assert policy["cancellation_effect"] == "period_end"
    assert policy["activation_enabled"] is False

security = manifest["security"]
assert security["commercial_account_anon_execute"] is False
assert security["commercial_account_authenticated_execute"] is True
assert security["subscription_lifecycle_anon_execute"] is False
assert security["cancellation_anon_execute"] is False
assert security["resume_anon_execute"] is False
assert security["authentication_guard"] == "AUTHENTICATION_REQUIRED"

assert all(value is False for value in manifest["runtime_state"].values() if isinstance(value, bool))
assert manifest["runtime_state"]["portal_mode"] == "closed_prelaunch"
assert all(value == 0 for value in manifest["runtime_counts"].values())
assert all(value is False for value in manifest["safety_boundary"].values())

integrity = manifest["launch_integrity"]
assert integrity["state"] == "healthy"
assert integrity["requirement_count"] == integrity["expected_requirement_count"] == 18
assert integrity["weight_total"] == integrity["expected_weight_total"] == 126
assert integrity["dependency_violations"] == 0
assert integrity["self_dependency_violations"] == 0
assert integrity["verified_evidence_violations"] == 0
assert integrity["secret_like_value_violations"] == 0

for fragment in (
    "crypto_my_commercial_account",
    "payment_history",
    "request_crypto_subscription_cancellation",
    "resume_crypto_subscription",
    "get_my_crypto_support_tickets",
    "create_crypto_support_ticket",
    "reply_crypto_support_ticket",
    "from public, anon",
    "COMMERCIAL_RUNTIME_MUST_REMAIN_INACTIVE",
    "ACCOUNT_PORTAL_MUST_REMAIN_CLOSED",
    "PAID_PRICES_MUST_REMAIN_INACTIVE",
):
    assert fragment in sql, f"Missing contract fragment: {fragment}"

assert "expected_requirement_count = 18" in baseline_sql
assert "expected_weight_total = 126" in baseline_sql
assert "LAUNCH_INTEGRITY_NOT_HEALTHY_AFTER_BASELINE_REPAIR" in baseline_sql

normalized = (sql + baseline_sql).replace(" ", "").lower()
for forbidden in (
    "paid_checkout_enabled=true",
    "paid_entitlement_enabled=true",
    "public_registration_enabled=true",
    "recurring_billing_enabled=true",
    "refund_execution_enabled=true",
    "production_launch_authorized=true",
    "setactive=true",
):
    assert forbidden not in normalized, f"Forbidden activation fragment: {forbidden}"

print("account billing support contract: OK")
