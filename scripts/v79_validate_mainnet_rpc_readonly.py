#!/usr/bin/env python3
"""Validate the inactive, read-only mainnet RPC/indexer preparation contract."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs/release-manifests/crypto-lab-v79-mainnet-rpc-readonly.json"
MIGRATION_PATH = ROOT / "supabase/migrations/20260806180523_prepare_mainnet_rpc_indexers_readonly.sql"

manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
sql = MIGRATION_PATH.read_text(encoding="utf-8")

assert manifest["scope"] == "mainnet_rpc_indexer_readonly_preparation"
assert manifest["status"] == "prepared_external_input_required"
assert manifest["stable_root_v78_sha"] == "4a278c891d37b3760ec1ac988690ea9ad587b24e"

networks = {item["network_code"]: item for item in manifest["networks"]}
assert set(networks) == {"ETHEREUM", "SOLANA", "TRON"}
assert networks["ETHEREUM"]["chain_reference"] == "1"
assert networks["SOLANA"]["chain_reference"] == "mainnet-beta"
assert networks["TRON"]["chain_reference"] == "mainnet"
assert all(item["read_only"] is True for item in networks.values())
assert all(item["production_enabled"] is False for item in networks.values())
assert all(item["public_smoke"]["ok"] is True for item in networks.values())

assert manifest["rpc_policy_counts"] == {"allow_read": 20, "deny_write": 9}
assert all(value == 0 for value in manifest["runtime_counts"].values())
assert all(value is False for value in manifest["safety_boundary"].values())

required_sql_fragments = (
    "crypto_onchain_rpc_method_policies",
    "crypto_onchain_indexer_profiles",
    "check (read_only)",
    "environment <> 'mainnet' or enabled = false",
    "eth_sendRawTransaction",
    "sendTransaction",
    "wallet/broadcasttransaction",
    "enabled=false",
    "status='external_input_required'",
    "Mainnet verifier boundary changed",
    "Mainnet indexer boundary changed",
    "Plan pricing activation boundary changed",
    "Receiving address activation boundary changed",
)
for fragment in required_sql_fragments:
    assert fragment in sql, f"Missing safety contract fragment: {fragment}"

for forbidden in (
    "private_key",
    "seed_phrase",
    "service_role_key",
    "transaction_broadcast\": true",
    "mainnet_authorized\": true",
    "real_payments_authorized\": true",
):
    assert forbidden not in MANIFEST_PATH.read_text(encoding="utf-8").lower()

print("mainnet RPC/indexer read-only contract: OK")
