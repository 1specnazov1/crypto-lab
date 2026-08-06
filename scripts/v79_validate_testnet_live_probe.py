import json
import re
import sys
from pathlib import Path

ROOT_SHA = "4a278c891d37b3760ec1ac988690ea9ad587b24e"
ETH_SENDER = "0x4eadfbe9665265527e9a5d6bde6fb15a70f05555"
SOL_SENDER = "4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4"
ETH_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
SOL_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
TOKEN_PROGRAM = "TokenkegQfeZyiNwAJBNbGKPFXCWuBvf9Ss623VQ5DA"
ETH_CALLDATA = (
    "0xa9059cbb000000000000000000000000"
    "bcd27864ea603643bc8aebb3fe2cec2ffdb39eb9"
    "0000000000000000000000000000000000000000000000000000000000002710"
)

paths = {
    "manifest": Path("docs/release-manifests/crypto-lab-v79-testnet-live-probe.json"),
    "document": Path("docs/commercial-readiness/2026-08-06-1900-testnet-payment-contour.md"),
    "fixture": Path("supabase/migrations/20260806160423_complete_testnet_payment_contour_fixture_v1.sql"),
    "live": Path("supabase/migrations/20260806170314_finalize_testnet_payment_contour_live_probe_v1.sql"),
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

    check(manifest["schema_version"] == 1, "manifest schema")
    check(manifest["project_ref"] == "txhzxbizjpinowepfjkm", "project ref")
    check(manifest["build"] == "7930", "build")
    check(manifest["scope"] == "isolated_testnet_payment_contour", "scope")
    check(manifest["status"] == "rpc_ready_funding_required", "status")
    check(manifest["stable_root_v78_sha"] == ROOT_SHA, "stable v78 root")

    expected_versions = ["20260806160423", "20260806170314"]
    migrations = manifest["migrations"]
    check([item["version"] for item in migrations] == expected_versions, "migration versions")
    for item in migrations:
        check(Path(item["source"]).is_file(), f"missing migration source: {item['source']}")

    assets = manifest["official_assets"]
    check(assets["ethereum_sepolia_usdc"] == ETH_USDC, "Ethereum USDC")
    check(assets["solana_devnet_usdc"] == SOL_USDC, "Solana USDC")
    check(assets["solana_token_program"] == TOKEN_PROGRAM, "Solana token program")
    check(assets["decimals"] == 6, "USDC decimals")

    observations = {item["network_code"]: item for item in manifest["live_observations"]}
    check(set(observations) == {"ETHEREUM", "SOLANA"}, "observation networks")
    eth_obs = observations["ETHEREUM"]
    sol_obs = observations["SOLANA"]
    check(eth_obs["sender_address"] == ETH_SENDER, "Ethereum sender")
    check(sol_obs["sender_address"] == SOL_SENDER, "Solana sender")
    check(eth_obs["chain_reference"] == "11155111" and eth_obs["chain_id_hex"] == "0xaa36a7", "Ethereum chain")
    check(sol_obs["chain_reference"] == "devnet", "Solana chain")
    check(eth_obs["request_ids"] == [18330, 18331, 18332], "Ethereum request IDs")
    check(sol_obs["request_ids"] == [18333, 18334], "Solana request IDs")
    for network, obs in observations.items():
        check(obs["environment"] == "sandbox", f"{network} environment")
        check(obs["rpc_success"] is True, f"{network} RPC")
        check(obs["funding_ready"] is False, f"{network} funding boundary")
        check(obs["native_balance_base_units"] == "0", f"{network} native balance")
        check(obs["test_usdc_balance_base_units"] == "0", f"{network} USDC balance")
        check(re.fullmatch(r"[0-9a-f]{64}", obs["evidence_hash"]) is not None, f"{network} evidence hash")

    templates = {item["network_code"]: item for item in manifest["transfer_templates"]}
    check(set(templates) == {"ETHEREUM", "SOLANA"}, "template networks")
    eth_template = templates["ETHEREUM"]
    sol_template = templates["SOLANA"]
    check(eth_template["sender_address"] == ETH_SENDER, "Ethereum template sender")
    check(eth_template["transaction_to"] == ETH_USDC, "Ethereum template token")
    check(eth_template["amount_base_units"] == "10000", "Ethereum amount")
    check(eth_template["transaction_data"] == ETH_CALLDATA, "Ethereum calldata")
    check(sol_template["sender_address"] == SOL_SENDER, "Solana template sender")
    check(sol_template["mint"] == SOL_USDC, "Solana template mint")
    check(sol_template["token_program"] == TOKEN_PROGRAM, "Solana template program")
    check(sol_template["instruction"] == "transfer_checked", "Solana instruction")
    check(sol_template["amount_base_units"] == "10000", "Solana amount")
    for network, template in templates.items():
        check(template["environment"] == "sandbox", f"{network} template environment")
        check(template["owner_signature_required"] is True, f"{network} owner signature")
        check(template["broadcast_allowed"] is False, f"{network} broadcast boundary")

    fixture = manifest["fixture_results"]
    for key in [
        "ethereum_pass",
        "solana_pass",
        "wrong_amount_rejected",
        "wrong_recipient_rejected",
        "wrong_network_rejected",
        "non_final_rejected",
    ]:
        check(fixture[key] is True, f"fixture result: {key}")

    runtime = manifest["runtime_counts"]
    check(runtime["health_runs"] == 6, "health run count")
    check(runtime["sandbox_sender_accounts"] == 2, "sender count")
    check(runtime["sandbox_runs"] == 4, "sandbox run count")
    for key in [
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

    check(manifest["remaining_blockers"] == [
        "TESTNET_USDC_FUNDING",
        "TESTNET_NATIVE_GAS",
        "OWNER_WALLET_SIGNATURE",
    ], "remaining blockers")

    safety = manifest["safety_boundary"]
    for key, value in safety.items():
        check(value is False, f"safety boundary: {key}")

    fixture_markers = [
        "crypto_validate_onchain_sandbox_fixture",
        "Wrong amount fixture was accepted",
        "Wrong recipient fixture was accepted",
        "Wrong network fixture was accepted",
        "Non-final fixture was accepted",
        "sandbox-fixture-v1",
    ]
    for marker in fixture_markers:
        check(marker in text["fixture"], f"fixture marker: {marker}")

    live_markers = [
        "live-funding-probe-v1",
        "18330",
        "18334",
        ETH_CALLDATA,
        TOKEN_PROGRAM,
        "transaction_broadcast",
        "FUNDING_REQUIRED",
    ]
    for marker in live_markers:
        check(marker in text["live"], f"live marker: {marker}")

    doc_markers = [
        "Final probe time: 2026-08-06 17:00:15–17:00:16 UTC",
        ETH_CALLDATA,
        TOKEN_PROGRAM,
        "Active production networks: `0`",
        "Test transfers executed: `0`",
    ]
    for marker in doc_markers:
        check(marker in text["document"], f"document marker: {marker}")

    combined = "\n".join(text.values())
    for pattern in [
        r"sb_secret_",
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        r"Bearer\s+eyJ",
        r'"(?:seed|mnemonic|private_key)"\s*:\s*"[^"\n]{20,}"',
    ]:
        check(re.search(pattern, combined, re.I) is None, f"secret-like material: {pattern}")

if errors:
    print("\n".join(f"ERROR: {error}" for error in errors))
    sys.exit(1)

print("Testnet live probe, exact transfer templates, and fail-closed boundaries: OK")
