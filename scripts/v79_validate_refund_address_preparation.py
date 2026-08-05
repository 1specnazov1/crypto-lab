import hashlib
import json
import re
import sys
from pathlib import Path

PROJECT_REF = "txhzxbizjpinowepfjkm"
BUILD = "7930"
V78_SHA = "4a278c891d37b3760ec1ac988690ea9ad587b24e"
REFUND_SHA = "2b88bb0518cce25f24847b31adae688e2a70caeeb45d593f9e128f6fcac15e05"

REFUND_DRAFT = Path("docs/REFUND_POLICY_PROPOSAL_7930.md")
REFUND_MANIFEST = Path("docs/release-manifests/crypto-lab-v79-refund-policy-proposal.json")
SECURITY_ONE = Path("supabase/migrations/20260805193725_harden_crypto_x_internal_triggers_and_service_tables.sql")
REFUND_ADDRESS = Path("supabase/migrations/20260805194211_prepare_refund_policy_and_onchain_address_intake.sql")
SECURITY_TWO = Path("supabase/migrations/20260805194511_harden_crypto_x_source_learning_services.sql")

errors: list[str] = []


def check(value: bool, message: str) -> None:
    if not value:
        errors.append(message)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


required_files = [
    REFUND_DRAFT,
    REFUND_MANIFEST,
    SECURITY_ONE,
    REFUND_ADDRESS,
    SECURITY_TWO,
    Path("docs/release-manifests/crypto-lab-v79-onchain-payments.json"),
    Path("docs/release-manifests/crypto-lab-v79-owner-pricing-decision.json"),
    Path("docs/release-manifests/crypto-lab-v79-7930.json"),
]
for path in required_files:
    check(path.is_file(), f"missing required file: {path}")

if not errors:
    refund_text = REFUND_DRAFT.read_text(encoding="utf-8")
    refund = load_json(REFUND_MANIFEST)
    onchain = load_json(Path("docs/release-manifests/crypto-lab-v79-onchain-payments.json"))
    pricing = load_json(Path("docs/release-manifests/crypto-lab-v79-owner-pricing-decision.json"))
    release = load_json(Path("docs/release-manifests/crypto-lab-v79-7930.json"))
    security_one = SECURITY_ONE.read_text(encoding="utf-8")
    refund_address = REFUND_ADDRESS.read_text(encoding="utf-8")
    security_two = SECURITY_TWO.read_text(encoding="utf-8")

    check(hashlib.sha256(refund_text.encode("utf-8")).hexdigest() == REFUND_SHA, "refund draft SHA")
    check(refund["schema_version"] == 2, "refund manifest schema")
    check(refund["project_ref"] == PROJECT_REF and refund["build"] == BUILD, "refund project/build")
    check(refund["status"] == "decision_required_not_published", "refund status")
    check(refund["proposal_code"] == "REFUND_POLICY_V1_APPROVAL", "refund proposal code")
    check(refund["proposal_sha256"] == REFUND_SHA, "refund manifest SHA")
    check(refund["owner_approved"] is False and refund["published"] is False, "refund approval/publication boundary")
    check(refund["refund_execution_enabled"] is False and refund["automatic_refunds_enabled"] is False, "refund execution boundary")
    check(refund["payments_enabled"] is False, "refund payment boundary")
    check(refund["maximum_processing_days_when_legally_required"] == 14, "refund processing maximum")
    check(refund["statutory_rights_preserved"] is True, "statutory rights")
    check(refund["mandatory_refund_fee_pass_through"] is False, "mandatory refund fee boundary")
    check(refund["activation_boundary"]["checkout_enabled"] is False, "refund checkout disabled")
    check(refund["activation_boundary"]["refunds_enabled"] is False, "refund adapter disabled")
    check(refund["activation_boundary"]["recurring_enabled"] is False, "refund recurring disabled")
    check(refund["activation_boundary"]["real_transfers_allowed"] is False, "refund real transfer disabled")
    check(refund["address_intake"]["required_networks"] == ["ETHEREUM", "TRON", "SOLANA"], "required address networks")
    check(refund["address_intake"]["configured_count"] == 0, "configured address count")
    check(refund["address_intake"]["verified_inactive_count"] == 0, "verified address count")
    check(refund["address_intake"]["active_count"] == 0, "active address count")
    check(refund["address_intake"]["sensitive_material_required"] is False, "sensitive material boundary")
    check(refund["address_intake"]["staged_addresses_forced_inactive"] is True, "staged address inactive boundary")
    check(refund["security_hardening"]["security_advisor_lints"] == 0, "security advisor result")
    check(refund["security_hardening"]["service_only_deny_policy_count"] == 5, "service-only policy count")
    check(refund["security_hardening"]["recap_foreign_key_index_added"] is True, "recap FK index")
    check(refund["database_runtime"] == {
        "receiving_address_count": 0,
        "active_price_count": 0,
        "invoice_count": 0,
        "transaction_claim_count": 0,
        "chain_observation_count": 0,
        "configuration_ready": False,
        "activation_ready": False,
    }, "database runtime boundary")
    check(refund["next_owner_decision"] == "REFUND_POLICY_V1_APPROVAL", "next owner decision")
    check(refund["stable_root_v78_sha"] == V78_SHA, "refund stable root")

    check(onchain["schema_version"] == 14, "on-chain manifest schema")
    check(onchain["activation_allowed"] is False and onchain["publication_allowed"] is False, "on-chain activation boundary")
    check(onchain["approved_networks"] == ["ETHEREUM", "TRON", "SOLANA"], "approved networks")
    check(onchain["selected_assets"] == ["USDT", "USDC"], "selected assets")
    check(onchain["pricing"]["basic_amount_minor"] == 2000, "BASIC price")
    check(onchain["pricing"]["pro_amount_minor"] == 4900, "PRO price")
    check(onchain["pricing"]["active_row_count"] == 0, "active on-chain pricing")
    runtime = onchain["runtime_state"]
    for key in [
        "active_network_count",
        "enabled_network_asset_count",
        "active_price_count",
        "receiving_address_count",
        "invoice_count",
        "transaction_claim_count",
        "chain_observation_count",
    ]:
        check(runtime[key] == 0, f"on-chain runtime zero {key}")
    check(runtime["configuration_ready"] is False and runtime["activation_ready"] is False, "on-chain readiness")
    check(runtime["payment_activation_authorized"] is False, "on-chain payment approval")

    check(pricing["plans"][0]["amount_minor"] == 2000, "pricing manifest BASIC")
    check(pricing["plans"][1]["amount_minor"] == 4900, "pricing manifest PRO")
    check(all(item["active"] is False for item in pricing["plans"]), "pricing manifest inactive")
    check(pricing["payment_activation_authorized"] is False, "pricing payment activation")

    check(release["stable_root"]["sha"] == V78_SHA, "release stable root")
    check(release["boundaries"]["v79_published_over_v78"] is False, "release publication boundary")
    check(release["boundaries"]["payment_provider_active"] is False, "release provider boundary")
    check(release["boundaries"]["paid_prices_active"] is False, "release paid price boundary")

    for marker in [
        "crypto_x_account_activity_history_service_only_deny",
        "crypto_x_account_metrics_service_only_deny",
        "crypto_x_account_watchlist_service_only_deny",
        "crypto_x_recap_runs_service_only_deny",
        "crypto_x_recap_runs_content_job_id_idx",
        "revoke execute on function public.crypto_x_apply_source_attribution()",
        "revoke execute on function public.crypto_x_guard_unverified_content_job()",
    ]:
        check(marker in security_one, f"security migration one marker {marker}")

    for marker in [
        "service_stage_crypto_onchain_receiving_address",
        "service_verify_crypto_onchain_receiving_address",
        "service_crypto_onchain_address_intake_readiness",
        "REFUND_POLICY_V1_APPROVAL",
        REFUND_SHA,
        "Sensitive wallet material is forbidden",
        "active=false",
        "refunds_enabled",
    ]:
        check(marker in refund_address, f"refund/address migration marker {marker}")

    for marker in [
        "crypto_x_source_performance_service_only_deny",
        "revoke execute on function public.crypto_x_apply_blended_source_ranking()",
        "revoke execute on function public.crypto_x_refresh_source_performance()",
    ]:
        check(marker in security_two, f"security migration two marker {marker}")

    combined = "\n".join([
        refund_text,
        security_one,
        refund_address,
        security_two,
        json.dumps(refund, ensure_ascii=Falsb),
    ])
    for pattern in [
        r"sb_secret_",
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        r"Bearer\s+eyJ",
    ]:
        check(re.search(pattern, combined, re.I) is None, "possible secret material")

if errors:
    print("\n".join(f"ERROR: {error}" for error in errors))
    sys.exit(1)

print("Refund decision package, address intake, and security hardening: OK")
