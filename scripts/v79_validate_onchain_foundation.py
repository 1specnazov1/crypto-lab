import json
import re
import sys
from pathlib import Path

NETWORK_DECISION = "ONCHAIN_ETHEREUM_TRON_SOLANA_USDT_USDC_SELECTION"
NETWORK_TEXT = "USDT, USDC утверждаю для Ethereum TRON и Solana. Активацию платежей не разрешаю."
NETWORK_HASH = "df7a3a536fc641c961f0f54187d76f44aecc2b8ccd0edbfdd33623cc32773750"
PRICING_DECISION = "ONCHAIN_BASIC_PRO_USD_MONTHLY_PRICING"
PRICING_TEXT = "BASIC — 20 грн/месяц;\nPRO — 40 грн/месяц - внеси изменения для крипто лаб пиши в долларах. И напиши для мен ниже кратко по пунктам что включают в себя эти тарифы"
PRICING_HASH = "db8ef6f56587b0aa05c602c838dc94acc06d6dca5a42d6f2e76130a7c7e198c0"
NETWORKS = ["ETHEREUM", "TRON", "SOLANA"]
ASSETS = ["USDT", "USDC"]
OWNER_MIGRATION = "supabase/migrations/20260805180435_record_owner_ethereum_tron_solana_usdt_usdc_selection.sql"
PREP_MIGRATION = "supabase/migrations/20260805183433_prepare_multi_asset_onchain_checkout_and_draft_pricing.sql"
INDEX_MIGRATION = "supabase/migrations/20260805183530_index_onchain_payment_foreign_keys.sql"
PRICING_MIGRATION = "supabase/migrations/20260805185155_record_owner_basic_pro_usd_monthly_pricing.sql"
PRICING_MANIFEST = "docs/release-manifests/crypto-lab-v79-owner-pricing-decision.json"
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
pricing_owner = load(PRICING_MANIFEST)
release = load("docs/release-manifests/crypto-lab-v79-7930.json")
owner_sql = Path(OWNER_MIGRATION).read_text(encoding="utf-8")
prep_sql = Path(PREP_MIGRATION).read_text(encoding="utf-8")
index_sql = Path(INDEX_MIGRATION).read_text(encoding="utf-8")
pricing_sql = Path(PRICING_MIGRATION).read_text(encoding="utf-8")
overlay_js = Path("v79/pricing-overlay.js").read_text(encoding="utf-8")
extension_js = Path("v79/commercial-extension.js").read_text(encoding="utf-8")

check(onchain["schema_version"] == 13, "on-chain manifest schema")
check(matrix["schema_version"] == 12, "sandbox matrix schema")
check(onchain["project_ref"] == "txhzxbizjpinowepfjkm" and onchain["build"] == "7930", "project/build")
check(onchain["approved_networks"] == NETWORKS, "approved networks")
check(onchain["selected_assets"] == ASSETS, "selected assets")
check(onchain["superseded_networks"] == ["BSC"], "BSC supersession")
check(onchain["activation_allowed"] is False and onchain["publication_allowed"] is False, "activation/publication boundary")

network_decision = onchain["owner_decision"]
check(network_decision["decision_code"] == NETWORK_DECISION, "network decision code")
check(network_decision["decision_text_exact"] == NETWORK_TEXT, "network decision text")
check(network_decision["decision_hash_sha256"] == NETWORK_HASH, "network decision hash")
check(network_decision["payment_activation_authorized"] is False, "network activation denial")

pricing_decision = onchain["pricing_decision"]
check(pricing_decision["decision_code"] == PRICING_DECISION, "pricing decision code")
check(pricing_decision["decision_hash_sha256"] == PRICING_HASH, "pricing decision hash")
check(pricing_decision["currency"] == "USD" and pricing_decision["billing_interval"] == "month", "pricing units")
check(pricing_decision["basic_amount_minor"] == 2000 and pricing_decision["pro_amount_minor"] == 4000, "pricing amounts")
check(pricing_decision["payment_activation_authorized"] is False, "pricing payment activation denial")
check(pricing_decision["pricing_activation_authorized"] is False, "pricing activation denial")

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

pricing = onchain["pricing"]
check(pricing["owner_approved"] is True and pricing["activation_authorized"] is False, "approved inactive pricing")
check(pricing["currency"] == "USD" and pricing["billing_interval"] == "month", "approved pricing units")
check(pricing["basic_amount_minor"] == 2000 and pricing["pro_amount_minor"] == 4000, "approved pricing amounts")
check(pricing["basic_display"] == "$20/month" and pricing["pro_display"] == "$40/month", "approved pricing display")
check(pricing["approved_row_count"] == 4 and pricing["active_row_count"] == 0, "approved inactive price rows")
check(pricing["obsolete_uah_rows_removed"] is True, "obsolete UAH removal")

basic = onchain["plan_entitlements"]["BASIC"]
pro = onchain["plan_entitlements"]["PRO"]
check((basic["daily_ai_requests"], basic["daily_backtests"], basic["daily_scanner_views"]) == (30, 20, 100), "BASIC daily limits")
check((basic["max_portfolio_assets"], basic["max_favorites"]) == (50, 100), "BASIC storage limits")
check(basic["telegram"] and basic["portfolio_sync"] and basic["advanced_backtest"] and not basic["priority_ai"], "BASIC features")
check(all(pro[key] == -1 for key in ["daily_ai_requests", "daily_backtests", "daily_scanner_views", "max_portfolio_assets", "max_favorites"]), "PRO unlimited limits")
check(pro["telegram"] and pro["portfolio_sync"] and pro["advanced_backtest"] and pro["priority_ai"], "PRO features")

runtime = onchain["runtime_state"]
check(runtime["approved_network_count"] == 3 and runtime["active_network_count"] == 0, "network counts")
check(runtime["selected_asset_count"] == 2 and runtime["official_supported_pair_count"] == 5, "asset/pair counts")
check(runtime["approved_price_count"] == 4 and runtime["active_price_count"] == 0, "price counts")
for key in ["enabled_network_asset_count", "receiving_address_count", "invoice_count", "transaction_claim_count", "chain_observation_count"]:
    check(runtime[key] == 0, f"runtime zero {key}")
check(runtime["verified_configuration_requirements"] == 1, "verified pricing requirement")
check(runtime["configuration_ready"] is False and runtime["activation_ready"] is False, "readiness fail-closed")
check(runtime["payment_activation_authorized"] is False, "runtime activation denial")
for key in ["checkout_enabled", "webhook_enabled", "recurring_enabled", "refunds_enabled"]:
    check(runtime[key] is False, f"disabled {key}")

check(owner["decision_code"] == NETWORK_DECISION, "owner network decision code")
check(owner["decision_text_exact"] == NETWORK_TEXT and owner["decision_hash_sha256"] == NETWORK_HASH, "owner network authority")
check([item["network_code"] for item in owner["approved_networks"]] == NETWORKS, "owner networks")
check([item["asset_code"] for item in owner["selected_assets"]] == ASSETS, "owner assets")

check(pricing_owner["decision_code"] == PRICING_DECISION, "pricing manifest code")
check(pricing_owner["decision_text_exact"] == PRICING_TEXT, "pricing manifest exact text")
check(pricing_owner["decision_hash_sha256"] == PRICING_HASH, "pricing manifest hash")
check(pricing_owner["currency"] == "USD" and pricing_owner["billing_interval"] == "month", "pricing manifest units")
check([item["amount_minor"] for item in pricing_owner["plans"]] == [2000, 4000], "pricing manifest amounts")
check(all(item["active"] is False for item in pricing_owner["plans"]), "pricing manifest inactive")
check(pricing_owner["payment_activation_authorized"] is False and pricing_owner["checkout_enabled"] is False, "pricing manifest fail-closed")

check(matrix["approved_networks"] == NETWORKS and matrix["selected_assets"] == ASSETS, "matrix scope")
check(matrix["scenario_count"] == 35, "matrix scenario count")
codes = [item["code"] for item in matrix["scenarios"]]
check(len(codes) == len(set(codes)) == 35, "matrix scenario uniqueness")

for path in [OWNER_MIGRATION, PREP_MIGRATION, INDEX_MIGRATION, PRICING_MIGRATION, PRICING_MANIFEST, "v79/pricing-overlay.js"]:
    check(Path(path).is_file(), f"required file {path}")

for marker in [NETWORK_TEXT, NETWORK_HASH, NETWORK_DECISION]:
    check(marker in owner_sql, f"network migration marker {marker}")
for marker in ["service_create_crypto_onchain_invoice", "p_asset_code text", "crypto_validate_onchain_tx_hash", "ONCHAIN_ASSET_ROUTING"]:
    check(marker in prep_sql, f"prep migration marker {marker}")
for marker in ["crypto_onchain_fx_quotes_asset_code_idx", "crypto_onchain_tx_observations_network_asset_idx"]:
    check(marker in index_sql, f"index migration marker {marker}")
for marker in [PRICING_DECISION, PRICING_HASH, "('BASIC','USD','month',2000", "('PRO','USD','month',4000", "delete from public.crypto_plan_prices", "crypto_onchain_owner_usd_pricing_check"]:
    check(marker in pricing_sql, f"pricing migration marker {marker}")
for marker in ["$20/month", "$40/month", "payment_activation_authorized", "pricing_activation_authorized"]:
    check(marker in json.dumps(pricing_owner, ensure_ascii=False), f"pricing manifest marker {marker}")
for marker in ["pricingOverlayScript", "./pricing-overlay.js", "7930-pricing1"]:
    check(marker in extension_js, f"commercial extension marker {marker}")
for marker in ["get_my_crypto_commercial_state", "Payment is not active yet.", "owner-plan-price"]:
    check(marker in overlay_js, f"pricing overlay marker {marker}")

combined = owner_sql + prep_sql + index_sql + pricing_sql + overlay_js + extension_js
combined += json.dumps(onchain, ensure_ascii=False) + json.dumps(owner, ensure_ascii=False)
combined += json.dumps(pricing_owner, ensure_ascii=False) + json.dumps(matrix, ensure_ascii=False)
for pattern in [r"sb_secret_", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", r"Bearer\s+eyJ", r"\bseed phrase\b"]:
    check(re.search(pattern, combined, re.I) is None, "possible secret material")

check(onchain["stable_root_v78_sha"] == V78_SHA, "on-chain v78 boundary")
check(owner["stable_root_v78_sha"] == V78_SHA, "owner v78 boundary")
check(pricing_owner["stable_root_v78_sha"] == V78_SHA, "pricing v78 boundary")
check(matrix["stable_root_v78_sha"] == V78_SHA, "matrix v78 boundary")
check(release["stable_root"]["sha"] == V78_SHA, "release v78 boundary")
check(release["boundaries"]["v79_published_over_v78"] is False, "v79 publication boundary")

if errors:
    print("\n".join(f"ERROR: {error}" for error in errors))
    sys.exit(1)
print("Owner-approved inactive USD pricing and multi-asset foundation: OK")
