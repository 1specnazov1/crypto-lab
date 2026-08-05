import json
import re
import sys
from pathlib import Path

ROOT_SHA = "4a278c891d37b3760ec1ac988690ea9ad587b24e"
MANIFEST = Path("docs/release-manifests/crypto-lab-v79-rpc-sandbox.json")
MIGRATION = Path("supabase/migrations/20260805204216_prepare_multichain_rpc_verifier_and_isolated_sandbox.sql")
INDEX_MIGRATION = Path("supabase/migrations/20260805204521_index_multichain_sandbox_profile_fk.sql")
SEPOLIA_MIGRATION = Path("supabase/migrations/20260805210454_configure_publicnode_ethereum_sepolia_sandbox.sql")
DECISION_MIGRATION = Path("supabase/migrations/20260805211218_prepare_owner_scoped_usdc_sandbox_transfer_decision.sql")
FUNCTION = Path("supabase/functions/crypto-lab-v79-chain-verifier/index.ts")
FUNCTION_TEST = Path("supabase/functions/crypto-lab-v79-chain-verifier/index_test.ts")
DENO_CONFIG = Path("supabase/functions/crypto-lab-v79-chain-verifier/deno.json")

errors: list[str] = []


def check(value: bool, message: str) -> None:
    if not value:
        errors.append(message)


for path in [
    MANIFEST,
    MIGRATION,
    INDEX_MIGRATION,
    SEPOLIA_MIGRATION,
    DECISION_MIGRATION,
    FUNCTION,
    FUNCTION_TEST,
    DENO_CONFIG,
]:
    check(path.is_file(), f"missing file: {path}")

if not errors:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    migration = MIGRATION.read_text(encoding="utf-8")
    index_sql = INDEX_MIGRATION.read_text(encoding="utf-8")
    sepolia_sql = SEPOLIA_MIGRATION.read_text(encoding="utf-8")
    decision_sql = DECISION_MIGRATION.read_text(encoding="utf-8")
    function = FUNCTION.read_text(encoding="utf-8")
    function_test = FUNCTION_TEST.read_text(encoding="utf-8")

    check(manifest["schema_version"] == 3, "manifest schema")
    check(manifest["project_ref"] == "txhzxbizjpinowepfjkm", "project ref")
    check(manifest["build"] == "7930", "build")
    check(
        manifest["status"] == "rpc_ready_transfer_execution_blocked",
        "status",
    )
    check(manifest["stable_root_v78_sha"] == ROOT_SHA, "stable root")

    edge = manifest["edge_function"]
    check(edge["slug"] == "crypto-lab-v79-chain-verifier", "edge slug")
    check(edge["version"] == 1 and edge["verify_jwt"] is True, "edge auth")
    check(
        edge["admin_only"] is True and edge["read_only_chain_access"] is True,
        "edge boundary",
    )
    check(edge["verifier_version"] == "7930-rpc1", "verifier version")

    migration_versions = [item["version"] for item in manifest["migrations"]]
    check(
        migration_versions == [
            "20260805204216",
            "20260805204521",
            "20260805210454",
            "20260805211218",
        ],
        "migration inventory",
    )
    for item in manifest["migrations"]:
        check(Path(item["source"]).is_file(), f"migration source: {item['source']}")

    profiles = {
        (profile["network_code"], profile["environment"]): profile
        for profile in manifest["profiles"]
    }
    check(
        set(profiles)
        == {
            ("ETHEREUM", "sandbox"),
            ("TRON", "sandbox"),
            ("SOLANA", "sandbox"),
        },
        "sandbox profiles",
    )
    for network in ["ETHEREUM", "TRON", "SOLANA"]:
        profile = profiles[(network, "sandbox")]
        check(profile["enabled"] is True, f"{network} sandbox enabled")
        check(profile["status"] == "ready", f"{network} sandbox ready")
    check(
        profiles[("ETHEREUM", "sandbox")]["public_endpoint"]
        == "https://ethereum-sepolia-rpc.publicnode.com",
        "Ethereum PublicNode endpoint",
    )
    check(
        profiles[("ETHEREUM", "sandbox")]["chain_reference"] == "11155111",
        "Ethereum Sepolia chain ID",
    )
    check(
        manifest["production_profiles"]["enabled_count"] == 0,
        "production profiles disabled",
    )

    health = {item["network_code"]: item for item in manifest["health_evidence"]}
    for network in ["ETHEREUM", "TRON", "SOLANA"]:
        check(health[network]["healthy"] is True, f"{network} health")
        check(health[network]["http_status"] == 200, f"{network} HTTP status")
    check(health["ETHEREUM"]["chain_reference"] == "11155111", "Ethereum health chain ID")
    check(health["ETHEREUM"]["chain_reference_hex"] == "0xaa36a7", "Ethereum health chain hex")
    check(health["ETHEREUM"]["health_run_id"] == 4, "Ethereum health run")
    check(health["TRON"]["health_run_id"] == 2, "TRON health run")
    check(health["SOLANA"]["health_run_id"] == 3, "Solana health run")

    cases = {
        (item["network_code"], item["asset_code"]): item
        for item in manifest["sandbox_cases"]
    }
    check(len(cases) == 5, "sandbox case count")
    check(
        cases[("ETHEREUM", "USDC")]["status"] == "ready_for_funding",
        "Ethereum USDC case",
    )
    check(
        cases[("ETHEREUM", "USDC")]["recipient_address"]
        == "0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9",
        "Ethereum test recipient",
    )
    check(
        cases[("SOLANA", "USDC")]["status"] == "ready_for_funding",
        "Solana USDC case",
    )
    check(
        cases[("SOLANA", "USDC")]["recipient_address"]
        == "EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F",
        "Solana test recipient",
    )
    for pair in [("ETHEREUM", "USDT"), ("TRON", "USDT"), ("SOLANA", "USDT")]:
        check(
            cases[pair]["status"] == "blocked_token_identifier",
            f"blocked test token: {pair}",
        )

    fixtures = manifest["fixture_testing"]
    check(fixtures["uses_real_wallet"] is False, "fixture wallet boundary")
    check(fixtures["uses_real_transfer"] is False, "fixture transfer boundary")
    check(fixtures["uses_private_keys"] is False, "fixture secret boundary")
    check(fixtures["ethereum_parser_fixture"] is True, "Ethereum fixture")
    check(fixtures["tron_address_checksum_fixture"] is True, "TRON fixture")
    check(fixtures["solana_parser_fixture"] is True, "Solana fixture")
    check(fixtures["ci_passed"] is True, "fixture CI result")

    funding = manifest["testnet_funding"]
    check(funding["provider"] == "Circle Faucet", "testnet funding provider")
    check(funding["url"] == "https://faucet.circle.com/", "Circle faucet URL")
    check(
        funding["testnet_tokens_have_no_financial_value"] is True,
        "testnet value boundary",
    )
    check(funding["ethereum_sepolia_supported"] is True, "Sepolia faucet support")
    check(funding["solana_devnet_supported"] is True, "Solana faucet support")

    proposal = manifest["next_owner_decision_proposal"]
    check(
        proposal["decision_code"] == "SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1",
        "proposal code",
    )
    check(proposal["scope"] == "testnet_usdc_only", "proposal scope")
    check(len(proposal["transfers"]) == 2, "proposal transfer count")
    check(
        [item["amount_base_units"] for item in proposal["transfers"]]
        == ["10000", "10000"],
        "proposal transfer amounts",
    )
    check(proposal["owner_confirmation_required"] is True, "owner decision gate")
    for key in [
        "mainnet_authorized",
        "production_payment_activation_authorized",
        "subscription_activation_authorized",
        "refund_execution_authorized",
        "wallet_secret_access_required",
    ]:
        check(proposal[key] is False, f"proposal disabled boundary: {key}")

    isolation = manifest["isolation"]
    check(isolation["can_grant_entitlement"] is False, "entitlement isolation")
    check(isolation["billing_foreign_keys"] == 0, "billing FK isolation")
    check(isolation["subscription_foreign_keys"] == 0, "subscription FK isolation")

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
    ]:
        check(runtime[key] == 0, f"runtime zero: {key}")
    check(runtime["health_runs"] == 4, "health run count")

    boundary = manifest["activation_boundary"]
    check(
        boundary["payment_sandbox_status"] == "blocked_dependency",
        "sandbox owner boundary",
    )
    for key in [
        "live_transfer_execution_authorized",
        "payment_activation_authorized",
        "checkout_enabled",
        "webhook_enabled",
        "recurring_enabled",
        "refunds_enabled",
        "v79_published_over_v78",
    ]:
        check(boundary[key] is False, f"disabled boundary: {key}")

    migration_markers = [
        "crypto_onchain_verifier_profiles",
        "crypto_onchain_verifier_health_runs",
        "crypto_onchain_sandbox_cases",
        "crypto_onchain_sandbox_runs",
        "sandbox_cannot_grant_entitlement",
        "PAYMENT_SANDBOX_E2E",
        "environment<>'mainnet' or not enabled",
        "Sandbox is coupled to billing or entitlement tables",
        "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    ]
    for marker in migration_markers:
        check(marker in migration, f"migration marker: {marker}")
    check(
        "crypto_onchain_sandbox_cases_profile_idx" in index_sql,
        "FK index marker",
    )
    for marker in [
        "https://ethereum-sepolia-rpc.publicnode.com",
        "0xaa36a7",
        "11155111",
        "ready_for_funding",
        "live_transfer_execution_authorized',false",
        "Mainnet verifier profile activated",
    ]:
        check(marker in sepolia_sql, f"Sepolia migration marker: {marker}")
    for marker in [
        "SANDBOX_USDC_TRANSFER_EXECUTION_APPROVAL_V1",
        "0.01 USDC",
        "test_tokens_have_no_financial_value',true",
        "mainnet_authorized',false",
        "owner_confirmation_required',true",
        "No transfer or production payment evidence may exist at proposal stage",
    ]:
        check(marker in decision_sql, f"decision migration marker: {marker}")

    function_markers = [
        'VERIFIER_VERSION = "7930-rpc1"',
        "crypto_is_admin",
        "service_record_crypto_onchain_verifier_health",
        "service_record_crypto_onchain_sandbox_run",
        "verify_sandbox_transaction",
        "eth_getTransactionReceipt",
        "walletsolidity/gettransactioninfobyid",
        "getTransaction",
        "parseEthereumTransfer",
        "parseTronTransfer",
        "parseSolanaTransfer",
        "fixtureSelfTest",
    ]
    for marker in function_markers:
        check(marker in function, f"function marker: {marker}")

    check(
        re.search(r"production_touched\s*:\s*false", function) is not None,
        "function boundary: production_touched false",
    )
    check(
        re.search(r"entitlement_changed\s*:\s*false", function) is not None,
        "function boundary: entitlement_changed false",
    )

    for marker in [
        "fixture self-test passes without wallet access",
        "Wrong Ethereum recipient was accepted",
        "Solana parser uses positive recipient token delta",
        "Modified TRON address was accepted",
    ]:
        check(marker in function_test, f"fixture test marker: {marker}")

    combined = (
        migration
        + index_sql
        + sepolia_sql
        + decision_sql
        + function
        + function_test
        + json.dumps(manifest, ensure_ascii=False)
    )
    for pattern in [
        r"sb_secret_",
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        r"Bearer\s+eyJ",
        r"seed phrase",
    ]:
        check(
            re.search(pattern, combined, re.I) is None,
            f"secret-like material: {pattern}",
        )

if errors:
    print("\n".join(f"ERROR: {error}" for error in errors))
    sys.exit(1)

print("Scoped no-value USDC sandbox decision and fail-closed boundaries: OK")
