import json
import re
import sys
from pathlib import Path

ROOT_SHA = "4a278c891d37b3760ec1ac988690ea9ad587b24e"
MANIFEST = Path("docs/release-manifests/crypto-lab-v79-rpc-sandbox.json")
MIGRATION = Path("supabase/migrations/20260805204216_prepare_multichain_rpc_verifier_and_isolated_sandbox.sql")
INDEX_MIGRATION = Path("supabase/migrations/20260805204521_index_multichain_sandbox_profile_fk.sql")
FUNCTION = Path("supabase/functions/crypto-lab-v79-chain-verifier/index.ts")
DENO_CONFIG = Path("supabase/functions/crypto-lab-v79-chain-verifier/deno.json")

errors: list[str] = []


def check(value: bool, message: str) -> None:
    if not value:
        errors.append(message)


for path in [MANIFEST, MIGRATION, INDEX_MIGRATION, FUNCTION, DENO_CONFIG]:
    check(path.is_file(), f"missing file: {path}")

if not errors:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    migration = MIGRATION.read_text(encoding="utf-8")
    index_sql = INDEX_MIGRATION.read_text(encoding="utf-8")
    function = FUNCTION.read_text(encoding="utf-8")

    check(manifest["schema_version"] == 1, "manifest schema")
    check(manifest["project_ref"] == "txhzxbizjpinowepfjkm", "project ref")
    check(manifest["build"] == "7930", "build")
    check(manifest["status"] == "prepared_blocked_by_owner_boundary", "status")
    check(manifest["stable_root_v78_sha"] == ROOT_SHA, "stable root")

    edge = manifest["edge_function"]
    check(edge["slug"] == "crypto-lab-v79-chain-verifier", "edge slug")
    check(edge["version"] == 1 and edge["verify_jwt"] is True, "edge auth")
    check(
        edge["admin_only"] is True and edge["read_only_chain_access"] is True,
        "edge boundary",
    )
    check(edge["verifier_version"] == "7930-rpc1", "verifier version")

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
    check(
        profiles[("ETHEREUM", "sandbox")]["enabled"] is False,
        "Ethereum sandbox disabled",
    )
    check(
        profiles[("TRON", "sandbox")]["enabled"] is True,
        "TRON sandbox enabled",
    )
    check(
        profiles[("SOLANA", "sandbox")]["enabled"] is True,
        "Solana sandbox enabled",
    )
    check(
        manifest["production_profiles"]["enabled_count"] == 0,
        "production profiles disabled",
    )

    health = {item["network_code"]: item for item in manifest["health_evidence"]}
    check(health["ETHEREUM"]["healthy"] is False, "Ethereum health state")
    check(
        health["TRON"]["healthy"] is True
        and health["TRON"]["http_status"] == 200,
        "TRON health",
    )
    check(
        health["SOLANA"]["healthy"] is True
        and health["SOLANA"]["health"] == "ok",
        "Solana health",
    )
    check(len(manifest["sandbox_cases"]) == 5, "sandbox case count")
    check(
        manifest["isolation"]["can_grant_entitlement"] is False,
        "entitlement isolation",
    )
    check(manifest["isolation"]["billing_foreign_keys"] == 0, "billing FK isolation")
    check(
        manifest["isolation"]["subscription_foreign_keys"] == 0,
        "subscription FK isolation",
    )

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
    check(runtime["health_runs"] == 3, "health run count")

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

    combined = migration + index_sql + function + json.dumps(
        manifest,
        ensure_ascii=False,
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

print("Isolated multichain RPC sandbox and fail-closed boundaries: OK")
