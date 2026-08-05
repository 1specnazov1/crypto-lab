from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "20260805103527"
NAME = "authoritative_candidate_only_recovery_after_103010"
SOURCE = "supabase/migrations/20260805103527_authoritative_candidate_only_recovery_after_103010.sql"
SOURCE_COMMIT = "acd3dd1c2af698e98cb74c7c70538f298d1dab94"
FALSE_VERSION = "20260805103010"
FALSE_NAME = "restore_exact_owner_three_network_authority_after_stale_cycle"


def load_json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def write_json(relative: str, value: dict) -> None:
    (ROOT / relative).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


onchain = load_json("docs/release-manifests/crypto-lab-v79-onchain-payments.json")
onchain["schema_version"] = 13
onchain["updated_at"] = "2026-08-05T10:43:00Z"
onchain["approved_networks"] = []
onchain["owner_network_approval_recorded"] = False
onchain["owner_provider_approval_recorded"] = False
onchain["authoritative_migration"] = {
    "version": VERSION,
    "name": NAME,
    "source": SOURCE,
    "source_commit": SOURCE_COMMIT,
}
incident = onchain.setdefault("provenance_incident", {})
incident.update(
    {
        "last_false_authority_migration": f"{FALSE_VERSION}_{FALSE_NAME}",
        "last_false_authority_migration_superseded": True,
        "invalid_reconstructed_record_active": False,
        "invalid_reconstructed_authority_event_effective": False,
    }
)
onchain["database"]["active_valid_owner_decision_records"] = 0
onchain["database"]["effective_payment_authority_events"] = 0
onchain["runtime_state"]["approved_network_count"] = 0
onchain["runtime_state"]["active_network_count"] = 0
onchain["runtime_state"]["provider_status"] = "decision_required"
write_json("docs/release-manifests/crypto-lab-v79-onchain-payments.json", onchain)

matrix = load_json("docs/release-manifests/crypto-lab-v79-payment-sandbox-matrix.json")
matrix["schema_version"] = 10
matrix["updated_at"] = "2026-08-05T10:43:00Z"
matrix["approved_networks"] = []
matrix["owner_network_approval_recorded"] = False
matrix["authoritative_migration"] = {
    "version": VERSION,
    "name": NAME,
    "source": SOURCE,
    "source_commit": SOURCE_COMMIT,
}
write_json("docs/release-manifests/crypto-lab-v79-payment-sandbox-matrix.json", matrix)

repair_path = ROOT / "docs/ONCHAIN_OWNER_DECISION_PROVENANCE_REPAIR_7930.md"
repair = repair_path.read_text(encoding="utf-8")
for old, new in {
    "20260805100805_final_lock_explicit_owner_three_network_selection": f"{FALSE_VERSION}_{FALSE_NAME}",
    "20260805101600_authoritative_candidate_only_recovery_after_100805": f"{VERSION}_{NAME}",
    "supabase/migrations/20260805101600_authoritative_candidate_only_recovery_after_100805.sql": SOURCE,
    "09dfd70b1ee55fc48023b019309e6e5f41798fc6": SOURCE_COMMIT,
}.items():
    repair = repair.replace(old, new)
repair_path.write_text(repair, encoding="utf-8")

replacements = {
    "20260805101600_authoritative_candidate_only_recovery_after_100805.sql": "20260805103527_authoritative_candidate_only_recovery_after_103010.sql",
    "20260805101600_authoritative_candidate_only_recovery_after_100805": "20260805103527_authoritative_candidate_only_recovery_after_103010",
    "20260805101600": VERSION,
    "09dfd70b1ee55fc48023b019309e6e5f41798fc6": SOURCE_COMMIT,
    "20260805100805_final_lock_explicit_owner_three_network_selection": f"{FALSE_VERSION}_{FALSE_NAME}",
    "onchain['schema_version']==12": "onchain['schema_version']==13",
    "matrix['schema_version']==9": "matrix['schema_version']==10",
    "manifest.get('schema_version')==12": "manifest.get('schema_version')==13",
}
for relative in (
    ".github/workflows/v79-onchain-payment-foundation-validation.yml",
    ".github/workflows/v79-owner-decision-failclosed-validation.yml",
):
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    for old, new in replacements.items():
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")

manifest = load_json("docs/release-manifests/crypto-lab-v79-7930.json")
additions = [
    {"version": FALSE_VERSION, "name": FALSE_NAME},
    {
        "version": VERSION,
        "name": NAME,
        "source": SOURCE,
        "source_commit": SOURCE_COMMIT,
    },
]
keyed = {(item.get("version"), item.get("name")): item for item in manifest.setdefault("migrations", [])}
for addition in additions:
    key = (addition["version"], addition["name"])
    if key in keyed:
        keyed[key].update(addition)
    else:
        manifest["migrations"].append(addition)
for migration in manifest["migrations"]:
    for key in list(migration):
        if key not in {"version", "name", "source", "source_commit"}:
            migration.pop(key, None)
manifest["updated_at"] = "2026-08-05T10:43:00Z"
release = manifest.setdefault("release_evidence", {})
allowed_release = {
    "release_gate_run_id",
    "maintenance_evidence_gate_run_id",
    "browser_smoke_run_id",
    "pages_run_id",
    "technical_score",
    "commercial_score",
}
for key in list(release):
    if key not in allowed_release:
        release.pop(key, None)
release["release_gate_run_id"] = "pending"
release["browser_smoke_run_id"] = "pending"
release["pages_run_id"] = "pending"
operational = manifest.setdefault("operational_hardening", {})
operational.update(
    {
        "onchain_authoritative_migration_version": VERSION,
        "onchain_authoritative_migration_name": NAME,
        "onchain_authoritative_migration_source_commit": SOURCE_COMMIT,
        "onchain_last_false_authority_migration_version": FALSE_VERSION,
        "onchain_last_false_authority_migration_superseded": True,
        "onchain_approved_network_count": 0,
        "onchain_active_network_count": 0,
        "onchain_active_owner_decision_record_count": 0,
        "onchain_effective_payment_authority_event_count": 0,
        "onchain_owner_approval_recorded": False,
        "onchain_provider_decision_recorded": False,
        "onchain_validated_candidate_only_constraint_count": 5,
        "direct_onchain_payment_activation_allowed": False,
        "onchain_sandbox_scenario_count": 30,
    }
)
boundaries = manifest.setdefault("boundaries", {})
boundaries["payment_provider_active"] = False
boundaries["paid_prices_active"] = False
boundaries["v79_published_over_v78"] = False
write_json("docs/release-manifests/crypto-lab-v79-7930.json", manifest)
