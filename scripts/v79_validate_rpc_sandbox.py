import json
import re
import sys
from pathlib import Path

ROOT_SHA = "4a278c891d37b3760ec1ac988690ea9ad587b24e"
DECISION_CODE = "SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1"
DECISION_HASH = "5b43613baf3fa255e1c9c1b430d70c65cc534532492adcb64bb412599f792a2e"

paths = {
    "manifest": Path("docs/release-manifests/crypto-lab-v79-rpc-sandbox.json"),
    "foundation": Path("supabase/migrations/20260805204216_prepare_multichain_rpc_verifier_and_isolated_sandbox.sql"),
    "index": Path("supabase/migrations/20260805204521_index_multichain_sandbox_profile_fk.sql"),
    "sepolia": Path("supabase/migrations/20260805210454_configure_publicnode_ethereum_sepolia_sandbox.sql"),
    "proposal": Path("supabase/migrations/20260805211218_prepare_owner_scoped_usdc_sandbox_transfer_decision.sql"),
    "approval": Path("supabase/migrations/20260806053020_record_scoped_usdc_sandbox_transfer_approval.sql"),
    "finalize": Path("supabase/migrations/20260806053053_finalize_scoped_usdc_sandbox_approval_evidence.sql"),
    "function": Path("supabase/functions/crypto-lab-v79-chain-verifier/index.ts"),
    "tests": Path("supabase/functions/crypto-lab-v79-chain-verifier/index_test.ts"),
    "deno": Path("supabase/functions/crypto-lab-v79-chain-verifier/deno.json"),
}

errors: list[str] = []


def check(value: bool, message: str) -> None:
    if not value:
        errors.append(message)


for name, path in paths.items():
    check(path.is_file(), f"missing {name}: {path}")

if not errors:
    text = {name: path.read_text(encoding="utf-8") for name, path in paths.items()}
    manifest = json.loads(text["manifest"])

    check(manifest["schema_version"] == 4, "manifest schema")
    check(manifest["project_ref"] == "txhzxbizjpinowepfjkm", "project ref")
    check(manifest["build"] == "7930", "build")
    check(
        manifest["status"] == "scoped_transfer_approved_waiting_funding_and_signer",
        "manifest status",
    )
    check(manifest["stable_root_v78_sha"] == ROOT_SHA, "stable v78 root")

    versions = [item["version"] for item in manifest["migrations"]]
    check(
        versions
        == [
            "20260805204216",
            "20260805204521",
            "20260805210454",
            "20260805211218",
            "20260806053020",
            "20260806053053",
        ],
        "migration inventory",
    )
    for item in manifest["migrations"]:
        check(Path(item["source"]).is_file(), f"missing migration source: {item['source']}")

    edge = manifest["edge_function"]
    check(edge["slug"] == "crypto-lab-v79-chain-verifier", "edge slug")
    check(edge["verify_jwt"] is True and edge["admin_only"] is True, "edge auth")
    check(edge["read_only_chain_access"] is True, "read-only chain access")

    profiles = {item["network_code"]: item for item in manifest["profiles"]}
    check(set(profiles) == {"ETHEREUM", "TRON", "SOLANA"}, "sandbox profile set")
    for network in profiles:
        check(profiles[network]["environment"] == "sandbox", f"{network} sandbox environment")
        check(profiles[network]["enabled"] is True, f"{network} sandbox enabled")
        check(profiles[network]["status"] == "ready", f"{network} sandbox ready")
    check(manifest["production_profiles"]["enabled_count"] == 0, "production RPC disabled")

    health = {item["network_code"]: item for item in manifest["health_evidence"]}
    for network in ["ETHEREUM", "TRON", "SOLANA"]:
        check(health[network]["healthy"] is True, f"{network} health")
        check(health[network]["http_status"] == 200, f"{network} HTTP status")
    check(health["ETHEREUM"]["chain_reference"] == "11155111", "Sepolia chain ID")

    cases = {(item["network_code"], item["asset_code"]): item for item in manifest["sandbox_cases"]}
    check(len(cases) == 5, "sandbox case count")
    for pair in [("ETHEREUM", "USDC"), ("SOLANA", "USDC")]:
        case = cases[pair]
        check(case["status"] == "ready_for_funding", f"{pair} ready for funding")
        check(case["expected_amount_base_units"] == "10000", f"{pair} amount")
        check(case["scoped_execution_authorized"] is True, f"{pair} scoped authorization")
    for pair in [("ETHEREUM", "USDT"), ("TRON", "USDT"), ("SOLANA", "USDT")]:
        check(cases[pair]["status"] == "blocked_token_identifier", f"{pair} remains blocked")

    approval = manifest["owner_transfer_approval"]
    check(approval["decision_code"] == DECISION_CODE, "decision code")
    check(approval["decision_hash_sha256"] == DECISION_HASH, "decision hash")
    check(approval["authority_state"] == "effective", "decision authority")
    check(approval["owner_approved"] is True, "owner approval")
    check(approval["owner_confirmation_required"] is False, "owner confirmation cleared")
    check(len(approval["transfers"]) == 2, "approved transfer count")
    check(
        [item["amount_base_units"] for item in approval["transfers"]]
        == ["10000", "10000"],
        "approved transfer amounts",
    )
    for key in [
        "mainnet_authorized",
        "real_payments_authorized",
        "production_payment_activation_authorized",
        "subscription_activation_authorized",
        "refund_execution_authorized",
        "wallet_secret_access_required",
    ]:
        check(approval[key] is False, f"approval boundary: {key}")

    boundary = manifest["activation_boundary"]
    check(boundary["payment_sandbox_status"] == "blocked_dependency", "sandbox remains blocked")
    check(boundary["scoped_test_transfer_execution_authorized"] is True, "scoped execution authorized")
    check(boundary["general_live_transfer_execution_authorized"] is False, "general execution denied")
    for key in [
        "payment_activation_authorized",
        "checkout_enabled",
        "webhook_enabled",
        "recurring_enabled",
        "refunds_enabled",
        "v79_published_over_v78",
    ]:
        check(boundary[key] is False, f"disabled boundary: {key}")

    runtime = manifest["runtime_counts"]
    for key in [
        "sandbox_runs",
        "production_invoices",
        "production_claims",
        "production_observations",
        "active_addresses",
        "active_prices",
        "active_networks",
        "enabled_network_asset_pairs",
        "active_subscriptions",
    ]:
        check(runtime[key] == 0, f"runtime zero: {key}")

    funding = manifest["testnet_funding"]
    check(funding["testnet_tokens_have_no_financial_value"] is True, "testnet value boundary")
    check(funding["direct_faucet_to_recipient_not_authorized"] is True, "faucet amount boundary")

    for marker in [
        DECISION_CODE,
        "two_testnet_usdc_transfers_only",
        "amount_base_units','10000",
        "mainnet_authorized',false",
        "payment_activation_authorized',false",
        "refund_execution_authorized',false",
        "source_wallet_pending',true",
        "native_gas_funding_pending',true",
    ]:
        check(marker in text["approval"], f"approval migration marker: {marker}")

    for marker in [
        "testnet_transfer_execution_pending_owner_approval",
        "owner_confirmation_required",
        "owner_approved",
        "remaining_execution_dependencies",
        "OWNER_WALLET_SIGNATURE_OR_CONTROLLED_TEST_SIGNER",
    ]:
        check(marker in text["finalize"], f"finalization marker: {marker}")

    for marker in [
        "parseEthereumTransfer",
        "parseTronTransfer",
        "parseSolanaTransfer",
        "verify_sandbox_transaction",
        "service_record_crypto_onchain_sandbox_run",
    ]:
        check(marker in text["function"], f"function marker: {marker}")
    check(re.search(r"production_touched\s*:\s*false", text["function"]) is not None, "production boundary")
    check(re.search(r"entitlement_changed\s*:\s*false", text["function"]) is not None, "entitlement boundary")

    for marker in [
        "fixture self-test passes without wallet access",
        "Wrong Ethereum recipient was accepted",
        "Solana parser uses positive recipient token delta",
        "Modified TRON address was accepted",
    ]:
        check(marker in text["tests"], f"fixture marker: {marker}")

    combined = "\n".join(text.values())
    for pattern in [
        r"sb_secret_",
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        r"Bearer\s+eyJ",
        r"seed phrase",
    ]:
        check(re.search(pattern, combined, re.I) is None, f"secret-like material: {pattern}")

if errors:
    print("\n".join(f"ERROR: {error}" for error in errors))
    sys.exit(1)

print("Effective scoped USDC sandbox authorization and fail-closed boundaries: OK")
