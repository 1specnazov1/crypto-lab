#!/usr/bin/env python3
"""Validate BASIC/PRO pricing and access logic without enabling commerce."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs/release-manifests/crypto-lab-v79-inactive-paid-entitlements.json"
MIGRATION_PATH = ROOT / "supabase/migrations/20260806191330_prepare_inactive_paid_plan_entitlements.sql"

manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
sql = MIGRATION_PATH.read_text(encoding="utf-8")

assert manifest["scope"] == "inactive_paid_plan_entitlements"
assert manifest["status"] == "prepared_owner_activation_required"
assert manifest["stable_root_v78_sha"] == "4a278c891d37b3760ec1ac988690ea9ad587b24e"
assert manifest["migration"]["version"] == "20260806191330"

plans = {item["plan"]: item for item in manifest["plans"]}
assert set(plans) == {"BASIC", "PRO"}
assert plans["BASIC"]["amount_minor"] == 2000
assert plans["PRO"]["amount_minor"] == 4900
for plan in plans.values():
    assert plan["currency"] == "USD"
    assert plan["billing_interval"] == "month"
    assert plan["access_period"] == "1 month"
    assert plan["renewal_mode"] == "manual"
    assert plan["cancellation_effect"] == "period_end"
    assert plan["price_active"] is False
    assert plan["entitlement_activation_enabled"] is False

assert all(value is False for value in manifest["runtime_flags"].values())
assert all(value == 0 for value in manifest["runtime_counts"].values())
assert all(value is False for value in manifest["safety_boundary"].values())

actual = manifest["contract_tests"]["actual_basic_future_period"]
assert actual == {
    "access_granted": False,
    "effective_plan": "FREE",
    "reason": "launch_gate_closed",
}
assert manifest["contract_tests"]["simulated_future_basic_period"]["effective_plan"] == "BASIC"
assert manifest["contract_tests"]["simulated_expired_pro_period"]["reason"] == "period_expired"

integrity = manifest["launch_integrity"]
assert integrity["state"] == "healthy"
assert integrity["expected_requirement_count"] == integrity["actual_requirement_count"] == 17
assert integrity["expected_weight_total"] == integrity["actual_weight_total"] == 120
assert integrity["dependency_violations"] == 0
assert integrity["verified_evidence_violations"] == 0
assert integrity["secret_like_value_violations"] == 0

required_sql_fragments = (
    "crypto_commercial_runtime_flags",
    "check (not paid_checkout_enabled)",
    "check (not paid_entitlement_enabled)",
    "check (not public_registration_enabled)",
    "crypto_plan_access_policies",
    "interval '1 month'",
    "crypto_evaluate_subscription_access",
    "launch_gate_closed",
    "period_expired",
    "crypto_paid_subscription_activation_guard",
    "Paid entitlement activation is disabled",
    "scheduled_paid_blocked",
    "get_crypto_commercial_plan_catalog",
    "crypto_launch_integrity_baseline",
    "if exists(select 1 from public.crypto_onchain_invoices)",
)
for fragment in required_sql_fragments:
    assert fragment in sql, f"Missing paid-plan safety contract fragment: {fragment}"

for forbidden in (
    "paid_checkout_enabled=true",
    "paid_entitlement_enabled=true",
    "public_registration_enabled=true",
    "recurring_billing_enabled=true",
    "refund_execution_enabled=true",
    "production_launch_authorized=true",
    "set active=true",
):
    assert forbidden not in sql.replace(" ", "").lower(), f"Forbidden activation fragment: {forbidden}"

print("inactive BASIC/PRO entitlement contract: OK")
