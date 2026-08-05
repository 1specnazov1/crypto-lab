import json
import re
import sys
from pathlib import Path

EXACT = "USDT, USDC утверждаю для Ethereum TRON и Solana. Активацию платежей не разрешаю."
DIGEST = "df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750"
DECISION = "ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION"
NETWORKS = ["ETHEREUM", "TRON", "SOLANA"]
ASSETS = ["USDT", "USDC"]
MIGRATION_VERSION = "20260805180435"
MIGRATION_PATH = "supabase/migrations/20260805180435_record_owner_ethereum_tron_solana_usdt_usdc_selection.sql"
V78_SHA = "4a278c891d37b3760ec1ac988690ea9ad587b24e"

errors: list[str] = []


def check(value: bool, message: str) -> None:
    if not value:
        errors.append(message)


def load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


onchain = load("docs/release-manifests/crypto-lab-v79-onchain-payments.json")
matrix = load("docs/release-manifests/crypto-lab-v79-payment-sandbox-matrix.json")
owner = load("docs/release-manifests/crypto-lab-v79-owner-network-decision.json")
release = load("docs/release-manifests/crypto-lab-v79-7930.json")
migration = Path(MIGRATION_PATH).read_text(encoding="utf-8")

check(onchain["schema_version"] == 11, "on-chain manifest schema")
check(onchain["project_ref"] == "txhzxbizjpinowepfjkm" and onchain["build"] == "7930", "project/build")
check(onchain["provider"] == "onchain_direct", "provider")
check(onchain["approved_networks"] == NETWORKS, "approved networks")
check(onchain["selected_assets"] == ASSETS, "selected assets")
check(onchain["superseded_networks"] == ["BSC"], "BSC supersession")
check(onchain["owner_network_approval_recorded"] is True, "network approval record")
check(onchain["owner_asset_selection_recorded"] is True, "asset selection record")
check(onchain["activation_allowed"] is False and onchain["publication_allowed"] is False, "activation/publication boundary")

decision = onchain["owner_decision"]
check(decision["decision_code"] == DECISION, "decision code")
check(decision["decision_text_exact"] == EXACT, "decision exact text")
check(decision["decision_hash_sha256"] == DIGEST, "decision digest")
check(decision["decision_scope"] == "network_and_settlement_asset_selection", "decision scope")
check(decision["payment_activation_authorized"] is False, "payment activation denial")
check(decision["active"] is True and decision["source_channel"] == "owner_chat", "decision authority")

networks = {item["code"]: item for item in onchain["networks"]}
check(set(NETWORKS).issubset(networks), "selected network inventory")
check(all(networks[n]["approved_by_owner"] is True and networks[n]["active"] is False for n in NETWORKS), "selected networks inactive")
check(networks["BSC"]["approved_by_owner"] is False and networks["BSC"]["active"] is False, "BSC inactive/unapproved")

pairs = {(item["network_code"], item["asset_code"]): item for item in onchain["asset_matrix"]}
expected_identifiers = {
    ("ETHEREUM", "USDT"): "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    ("ETHEREUM", "USDC"): "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    ("TRON", "USDT"): "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    ("SOLANA", "USDT"): "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    ("SOLANA", "USDC"): "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
}
for pair, identifier in expected_identifiers.items():
    item = pairs.get(pair)
    check(item is not None, f"missing pair {pair}")
    if item is not None:
        check(item["token_identifier"] == identifier, f"identifier {pair}")
        check(item["availability_status"] == "available_verified", f"availability {pair}")
        check(item["enabled"] is False, f"disabled pair {pair}")

tron_usdc = pairs.get(("TRON", "USDC"))
check(tron_usdc is not None, "TRON USDC record")
if tron_usdc is not None:
    check(tron_usdc["availability_status"] == "unsupported_official", "TRON USDC unsupported status")
    check(tron_usdc["token_identifier"] is None and tron_usdc["enabled"] is False, "TRON USDC disabled boundary")

runtime = onchain["runtime_state"]
check(runtime["approved_network_count"] == 3, "approved network count")
check(runtime["active_network_count"] == 0, "active network count")
check(runtime["selected_asset_count"] == 2, "selected asset count")
for key in [
    "enabled_network_asset_count",
    "active_price_count",
    "receiving_address_count",
    "invoice_count",
    "transaction_claim_count",
    "chain_observation_count",
    "auth_user_count",
    "registration_attempt_count",
    "recovery_attempt_count",
]:
    check(runtime[key] == 0, f"runtime zero {key}")
check(runtime["provider_desired_mode"] == "disabled" and runtime["provider_lifecycle_status"] == "draft", "adapter state")
for key in ["checkout_enabled", "webhook_enabled", "recurring_enabled", "refunds_enabled"]:
    check(runtime[key] is False, f"disabled {key}")

check(owner["schema_version"] == 7, "owner manifest schema")
check(owner["decision_code"] == DECISION, "owner decision code")
check(owner["decision_text_exact"] == EXACT and owner["decision_hash_sha256"] == DIGEST, "owner decision authority")
check(owner["approved_networks"] == [
    {"network_code": "ETHEREUM", "standard": "ERC20", "approved_by_owner": True, "active": False},
    {"network_code": "TRON", "standard": "TRC20", "approved_by_owner": True, "active": False},
    {"network_code": "SOLANA", "standard": "SPL", "approved_by_owner": True, "active": False},
], "owner approved networks")
check([item["asset_code"] for item in owner["selected_assets"]] == ASSETS, "owner selected assets")
check(all(item["selected"] and item["status"] == "selected_inactive" for item in owner["selected_assets"]), "owner assets inactive")
check(owner["unsupported_official_pairs"][0]["pair"] == "TRON_USDC", "owner unsupported pair")
for key in ["activation_allowed", "publication_allowed", "checkout_enabled", "webhook_enabled", "recurring_enabled", "refunds_enabled"]:
    check(owner[key] is False, f"owner fail-closed {key}")

check(matrix["schema_version"] == 11, "matrix schema")
check(matrix["approved_networks"] == NETWORKS and matrix["selected_assets"] == ASSETS, "matrix scope")
check(matrix["scenario_count"] == 31, "matrix scenario count")
codes = [item["code"] for item in matrix["scenarios"]]
check(len(codes) == len(set(codes)) == 31, "matrix scenario uniqueness")
check("MULTI_ASSET_SELECTION_WITHOUT_ROUTING" in codes, "multi-asset routing test")
check("TRON_USDC_UNSUPPORTED_OFFICIAL" in codes, "TRON USDC test")

for manifest in [onchain, owner, matrix]:
    authoritative = manifest["authoritative_migration"]
    check(authoritative["version"] == MIGRATION_VERSION, "authoritative migration version")
    check(authoritative["source"] == MIGRATION_PATH, "authoritative migration source")

check(Path(MIGRATION_PATH).is_file(), "migration file")
required_markers = [
    EXACT,
    DIGEST,
    DECISION,
    "crypto_onchain_owner_selected_network_state_check",
    "crypto_onchain_owner_selected_asset_state_check",
    "crypto_onchain_owner_selected_pairs_disabled_check",
    "crypto_owner_decision_current_network_asset_check",
    "crypto_payment_current_owner_decision_check",
    "crypto_onchain_adapter_owner_activation_denied_check",
    "drop index if exists public.crypto_onchain_one_selected_asset_idx",
    "TRON','USDC','TRC20',null,'not_available','unsupported_official'",
]
for marker in required_markers:
    check(marker in migration, f"missing migration marker: {marker}")

combined = migration + json.dumps(onchain, ensure_ascii=False) + json.dumps(owner, ensure_ascii=False) + json.dumps(matrix, ensure_ascii=False)
for pattern in [
    r"sb_secret_",
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    r"Bearer\s+eyJ",
    r"\bseed phrase\b",
]:
    check(re.search(pattern, combined, re.I) is None, "possible secret material")

check(onchain["stable_root_v78_sha"] == V78_SHA, "on-chain v78 boundary")
check(owner["stable_root_v78_sha"] == V78_SHA, "owner v78 boundary")
check(matrix["stable_root_v78_sha"] == V78_SHA, "matrix v78 boundary")
check(release["stable_root"]["sha"] == V78_SHA, "release v78 boundary")
check(release["boundaries"]["v79_published_over_v78"] is False, "v79 publication boundary")

if errors:
    print("\n".join(f"ERROR: {error}" for error in errors))
    sys.exit(1)

print("Owner-selected Ethereum/TRON/Solana and inactive USDT/USDC foundation: OK")
