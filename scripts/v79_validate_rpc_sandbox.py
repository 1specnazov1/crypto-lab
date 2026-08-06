import json
import re
import sys
from pathlib import Path

ROOT_SHA = "4a278c891d37b3760ec1ac988690ea9ad587b24e"
DECISION_CODE = "SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1"
DECISION_HASH = "5b43613baf3fa255e1c9c1b430d70c65cc534532492adcb64bb412599f792a2e"
ETH_SENDER = "0x4eadfbe9665265527e9a5d6bde6fb15a70f05555"
SOL_SENDER = "4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4"

paths = {
    "manifest": Path("docs/release-manifests/crypto-lab-v79-rpc-sandbox.json"),
    "foundation": Path("supabase/migrations/20260805204216_prepare_multichain_rpc_verifier_and_isolated_sandbox.sql"),
    "index": Path("supabase/migrations/20260805204521_index_multichain_sandbox_profile_fk.sql"),
    "sepolia": Path("supabase/migrations/20260805210454_configure_publicnode_ethereum_sepolia_sandbox.sql"),
    "proposal": Path("supabase/migrations/20260805211218_prepare_owner_scoped_usdc_sandbox_transfer_decision.sql"),
    "approval": Path("supabase/migrations/20260806053020_record_scoped_usdc_sandbox_transfer_approval.sql"),
    "finalize": Path("supabase/migrations/20260806053053_finalize_scoped_usdc_sandbox_approval_evidence.sql"),
    "eth_sender": Path("supabase/migrations/20260806055345_register_ethereum_sepolia_test_sender.sql"),
    "sol_sender": Path("supabase/migrations/20260806070941_register_solana_devnet_test_sender.sql"),
    "airdrop": Path("supabase/migrations/20260806071522_record_solana_devnet_airdrop_attempt.sql"),
    "funding_audit": Path("supabase/migrations/20260806144638_record_testnet_funding_route_audit.sql"),
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

    check(manifest["schema_version"] == 5, "manifest schema")
    check(manifest["project_ref"] == "txhzxbizjpinowepfjkm", "project ref")
    check(manifest["build"] == "7930", "build")
    check(
        manifest["status"] == "test_senders_registered_waiting_testnet_funding",
        "manifest status",
    )
    check(manifest["stable_root_v78_sha"] == ROOT_SHA, "stable v78 root")

    expected_versions = [
        "20260805204216",
        "20260805204521",
        "20260805210454",
        "20260805211218",
        "20260806053020",
        "20260806053053",
        "20260806055345",
        "20260806070941",
        "20260806071522",
        "20260806144638",
    ]
    versions = [item["version"] for item in manifest["migrations"]]
    check(versions == expected_versions, "migration inventory")
    for item in manifest["migrations"]:
        check(Path(item["source"]).is_file(), f"missing migration source: {item['source']}")

    edge = manifest["edge_function"]
    check(edge["slug"] == "crypto-lab-v79-chain-verifier", "edge slug")
    check(edge["verify_jwt"] is True and edge["admin_only"] is True, "edge auth")
    check(edge["read_only_chain_access"] is True, "read-only chain access")

    profiles = {item["network_code"]: item for item in manifest["profiles"]}
    check(set(profiles) == {"ETHEREUM", "TRON", "SOLANA"}, "sandbox profile set")
    for network, profile in profiles.items():
        check(profile["environment"] == "sandbox", f"{network} sandbox environment")
        check(profile["enabled"] is True, f"{network} sandbox enabled")
        check(profile["status"] == "ready", f"{network} sandbox ready")
    check(manifest["production_profiles"]["enabled_count"] == 0, "production RPC disabled")

    senders = {item["network_code"]: item for item in manifest["sender_accounts"]}
    check(set(senders) == {"ETHEREUM", "SOLANA"}, "test sender set")
    check(senders["ETHEREUM"]["address"] == ETH_SENDER, "Ethereum sender")
    check(senders["SOLANA"]["address"] == SOL_SENDER, "Solana sender")
    for network, sender in senders.items():
        check(sender["environment"] == "sandbox", f"{network} sender environment")
        check(sender["verified"] is True and sender["configured"] is True, f"{network} sender verified")
        check(sender["custody_model"] == "owner_signed_external_wallet", f"{network} custody")
        check(sender["allowed_asset"] == "USDC", f"{network} asset")
        check(sender["allowed_amount_base_units"] == "10000", f"{network} amount")
        for key in ["mainnet_authorized", "entitlement_capable", "secret_material_received"]:
            check(sender[key] is False, f"{network} sender boundary: {key}")
        check(sender["native_gas_funded"] is False, f"{network} gas remains pending")
        check(sender["test_usdc_funded"] is False, f"{network} USDC remains pending")

    cases = {(item["network_code"], item["asset_code"]): item for item in manifest["sandbox_cases"]}
    check(len(cases) == 5, "sandbox case count")
    check(cases[("ETHEREUM", "USDC")]["source_address"] == ETH_SENDER, "Ethereum case sender")
    check(cases[("SOLANA", "USDC")]["source_address"] == SOL_SENDER, "Solana case sender")
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
    check(approval["authority_state"] == "effective" and approval["owner_approved"] is True, "decision authority")
    check(len(approval["transfers"]) == 2, "approved transfer count")
    check(
        [item["amount_base_units"] for item in approval["transfers"]] == ["10000", "10000"],
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

    funding = manifest["testnet_funding"]
    check(funding["tokens_have_no_financial_value"] is True, "testnet value boundary")
    check(funding["background_balance_watch_enabled"] is True, "background funding watch")
    check(funding["background_retry_interval_hours"] == 4, "background retry interval")
    check(funding["solana_latest_official_rpc_request_id"] == "18008", "latest Solana request")
    check(funding["solana_latest_official_rpc_result"] == "internal_error", "latest Solana result")
    check(funding["solana_foundation_web_faucet_result"] == "github_account_too_new", "web faucet result")
    check(funding["direct_faucet_to_recipient_not_authorized"] is True, "faucet recipient boundary")
    check("rate_limit_bypass" in funding["rejected_routes"], "rate-limit bypass rejected")
    check("mainnet_sol_exchange_faucet" in funding["rejected_routes"], "mainnet faucet rejected")

    runtime = manifest["runtime_counts"]
    check(runtime["sandbox_sender_accounts"] == 2, "sender count")
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

    check("TEST_SENDER_WALLET" not in manifest["remaining_external_inputs"], "sender dependency cleared")
    for dependency in ["TESTNET_USDC_FUNDING", "TESTNET_NATIVE_GAS", "OWNER_WALLET_SIGNATURE"]:
        check(dependency in manifest["remaining_external_inputs"], f"remaining dependency: {dependency}")

    migration_markers = {
        "eth_sender": [ETH_SENDER, "crypto_onchain_sandbox_sender_accounts", "mainnet_authorized=false", "entitlement_capable=false"],
        "sol_sender": [SOL_SENDER, "source_wallet_network','Devnet'", "native_gas_funding_pending',true"],
        "airdrop": ["16853", "16854", "internal_error", "api_key_required"],
        "funding_audit": ["18008", "github_account_too_new", "background_balance_watch_enabled", "rate_limit_bypass"],
    }
    for file_name, markers in migration_markers.items():
        for marker in markers:
            check(marker in text[file_name], f"{file_name} marker: {marker}")

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

print("Registered sandbox senders, funding watch, and fail-closed boundaries: OK")
