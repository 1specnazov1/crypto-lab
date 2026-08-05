import json
import re
import sys
from pathlib import Path

EXACT = "USDT, USDC утверждаю для Ethereum TRON и Solana. Активацию платежей не разрешаю."
DIGEST = "df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750"
DECISION = "ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION"
NETWORKS = ["ETHEREUM", "TRON", "SOLANA"]
ASSETS = ["USDT", "USDC"]
OWNER_MIGRATION = "supabase/migrations/20260805180435_record_owner_ethereum_tron_solana_usdt_usdc_selection.sql"
PREP_MIGRATION = "supabase/migrations/20260805183433_prepare_multi_asset_onchain_checkout_and_draft_pricing.sql"
INDEX_MIGRATION = "supabase/migrations/20260805183530_index_onchain_payment_foreign_keys.sql"
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
owner_sql = Path(OWNER_MIGRATION).read_text(encoding="utf-8")
prep_sql = Path(PREP_MIGRATION).read_text(encoding="utf-8")
index_sql = Path(INDEX_MIGRATION).read_text(encoding="utf-8")

check(onchain["schema_version"] == 12, "on-chain manifest schema")
check(matrix["schema_version"] == 12, "sandbox matrix schema")
check(onchain["project_ref"] == "txhzxbizjpinowepfjkm" and onchain["build"] == "7930", "project/build")
check(onchain["approved_networks"] == NETWORKS, "approved networks")
check(onchain["selected_assets"] == ASSETS, "selected assets")
check(onchain["superseded_networks"] == ["BSC"], "BSC supersession")
check(onchain["activation_allowed"] is False and onchain["publication_allowed"] is False, "activation/publication boundary")

decision = onchain["owner_decision"]
check(decision["decision_code"] == DECISION, "decision code")
check(decision["decision_text_exact"] == EXACT, "decision exact text")
check(decision["decision_hash_sha256"] == DIGEST, "decision digest")
check(decision["payment_activation_authorized"] is False, "payment activation denial")

networks = {item["code"]: item for item in onchain["networks"]}
check(all(networks[n]["approved_by_owner"] and not networks[n]["active"] for n in NETWORKS), "selected networks inactive")
check(not networks["BSC"]["approved_by_owner"] and not networks["BSC"]["active"], "BSC inactive/unapproved")

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
    if item:
        check(item["token_identifier"] == identifier, f"identifier {pair}")
        check(item["availability_status"] == "available_verified", f"availability {pair}")
        check(item["enabled"] is False, f"disabled pair {pair}")
tron_usdc = pairs[("TRON", "USDC")]
check(tron_usdc["availability_status"] == "unsupported_official", "TRON USDC unsupported")
check(tron_usdc["token_identifier"] is None and tron_usdc["enabled"] is False, "TRON USDC disabled")

routing = onchain["routing_policy"]
check(routing["explicit_network_and_asset_selection"] is True, "explicit routing")
check(routing["silent_fallback_allowed"] is False, "no silent fallback")
check(routing["invoice_pair_immutable"] is True, "immutable invoice pair")
check(routing["official_supported_pair_count"] == 5, "supported pair count")

pricing = onchain["pricing"]
check(pricing["proposal_prepared"] is True and pricing["owner_approved"] is False, "draft pricing boundary")
check(pricing["currency"] == "UAH" and pricing["billing_interval"] == "month", "draft pricing units")
check(pricing["basic_amount_minor"] == 39900 and pricing["pro_amount_minor"] == 79900, "draft amounts")
check(pricing["draft_row_count"] == 4 and pricing["active_row_count"] == 0, "draft price rows")

runtime = onchain["runtime_state"]
check(runtime["approved_network_count"] == 3, "approved network count")
check(runtime["active_network_count"] == 0, "active network count")
check(runtime["selected_asset_count"] == 2, "selected asset count")
check(runtime["official_supported_pair_count"] == 5, "runtime pair count")
check(runtime["draft_price_count"] == 4, "runtime draft prices")
for key in ["enabled_network_asset_count", "active_price_count", "receiving_address_count", "invoice_count", "transaction_claim_count", "chain_observation_count"]:
    check(runtime[key] == 0, f"runtime zero {key}")
check(runtime["configuration_ready"] is False and runtime["activation_ready"] is False, "readiness fail-closed")
check(runtime["payment_activation_authorized"] is False, "runtime activation denial")
for key in ["checkout_enabled", "webhook_enabled", "recurring_enabled", "refunds_enabled"]:
    check(runtime[key] is False, f"disabled {key}")

prep = onchain["preactivation_preparation"]
check(prep["multi_asset_invoice_service_prepared"] is True, "multi-asset service")
check(prep["ethereum_address_validation_prepared"] is True, "Ethereum address validation")
check(prep["ethereum_transaction_validation_prepared"] is True, "Ethereum tx validation")
check(prep["transaction_identity_triggers_enabled"] is True, "tx identity triggers")
check(prep["foreign_key_indexes_added"] == 7, "foreign-key indexes")

check(owner["decision_code"] == DECISION, "owner decision code")
check(owner["decision_text_exact"] == EXACT and owner["decision_hash_sha256"] == DIGEST, "owner decision authority")
check([item["network_code"] for item in owner["approved_networks"]] == NETWORKS, "owner networks")
check([item["asset_code"] for item in owner["selected_assets"]] == ASSETS, "owner assets")
for key in ["activation_allowed", "publication_allowed", "checkout_enabled", "webhook_enabled", "recurring_enabled", "refunds_enabled"]:
    check(owner[key] is False, f"owner fail-closed {key}")

check(matrix["approved_networks"] == NETWORKS and matrix["selected_assets"] == ASSETS, "matrix scope")
check(matrix["scenario_count"] == 35, "matrix scenario count")
codes = [item["code"] for item in matrix["scenarios"]]
check(len(codes) == len(set(codes)) == 35, "matrix scenario uniqueness")
for code in ["MULTI_ASSET_SELECTION_WITHOUT_ROUTING", "TRON_USDC_UNSUPPORTED_OFFICIAL", "ETHEREUM_ADDRESS_VALIDATION", "ETHEREUM_TRANSACTION_HASH_VALIDATION", "DRAFT_PRICE_ACTIVATION_ATTEMPT", "AMBIGUOUS_LEGACY_INVOICE_ROUTE"]:
    check(code in codes, f"matrix scenario {code}")

for path in [OWNER_MIGRATION, PREP_MIGRATION, INDEX_MIGRATION]:
    check(Path(path).is_file(), f"migration file {path}")

owner_markers = [EXACT, DIGEST, DECISION, "crypto_onchain_owner_selected_network_state_check", "crypto_onchain_adapter_owner_activation_denied_check"]
for marker in owner_markers:
    check(marker in owner_sql, f"owner migration marker {marker}")
prep_markers = ["service_create_crypto_onchain_invoice", "p_asset_code text", "crypto_validate_onchain_tx_hash", "ETHEREUM", "crypto_onchain_pricing_activation_denied_by_owner", "ONCHAIN_ASSET_ROUTING", "39900", "79900"]
for marker in prep_markers:
    check(marker in prep_sql, f"prep migration marker {marker}")
for marker in ["crypto_onchain_fx_quotes_asset_code_idx", "crypto_onchain_tx_observations_network_asset_idx"]:
    check(marker in index_sql, f"index migration marker {marker}")

combined = owner_sql + prep_sql + index_sql + json.dumps(onchain, ensure_ascii=False) + json.dumps(owner, ensure_ascii=False) + json.dumps(matrix, ensure_ascii=False)
for pattern in [r"sb_secret_", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", r"Bearer\s+eyJ", r"\bseed phrase\b"]:
    check(re.search(pattern, combined, re.I) is None, "possible secret material")

check(onchain["stable_root_v78_sha"] == V78_SHA, "on-chain v78 boundary")
check(owner["stable_root_v78_sha"] == V78_SHA, "owner v78 boundary")
check(matrix["stable_root_v78_sha"] == V78_SHA, "matrix v78 boundary")
check(release["stable_root"]["sha"] == V78_SHA, "release v78 boundary")
check(release["boundaries"]["v79_published_over_v78"] is False, "v79 publication boundary")

if errors:
    print("\n".join(f"ERROR: {error}" for error in errors))
    sys.exit(1)
print("Inactive Ethereum/TRON/Solana USDT/USDC preactivation foundation: OK")
