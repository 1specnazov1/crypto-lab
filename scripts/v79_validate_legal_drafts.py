#!/usr/bin/env python3
"""Validate CRYPTO LAB v79 commercial legal drafts without enabling production."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs/release-manifests/crypto-lab-v79-legal-draft-contract.json"
MIGRATION = ROOT / "supabase/migrations/20260806220823_prepare_commercial_legal_drafts.sql"
COPY = ROOT / "v79/legal-commercial-draft.js"
PAGES = {
    "terms": ROOT / "v79/terms.html",
    "privacy": ROOT / "v79/privacy.html",
    "refund": ROOT / "v79/refund.html",
    "risk": ROOT / "v79/risk-disclosure.html",
}

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
sql = MIGRATION.read_text(encoding="utf-8")
copy = COPY.read_text(encoding="utf-8")

assert manifest["candidate"] == "v79"
assert manifest["stable_public_version"] == "v78"
assert manifest["stable_root_v78_sha"] == "4a278c891d37b3760ec1ac988690ea9ad587b24e"
assert manifest["draft_version"] == "2026-08-07-draft1"
assert manifest["supabase_migration"]["version"] == "20260806220823"
assert manifest["supabase_migration"]["applied"] is True

for key, page_path in PAGES.items():
    html = page_path.read_text(encoding="utf-8")
    assert 'noindex,nofollow' in html, f"{key}: draft must remain noindex"
    assert 'legal-commercial-draft.js?v=7931' in html, f"{key}: wrong legal copy bundle"
    assert 'data-legal-link href="./refund.html"' in html, f"{key}: refund navigation missing"
    assert manifest["candidate_documents"][key]["draft_ready"] is True
    assert manifest["candidate_documents"][key]["published_final"] is False

for token in ("terms:{", "privacy:{", "refund:{", "risk:{"):
    assert token in copy, f"copy bundle missing {token}"
for text in ("BASIC — 20 USD", "PRO — 49 USD", "Refund Policy", "не обещает прибыль", "does not promise profit"):
    assert text in copy, f"required legal wording missing: {text}"

readiness = manifest["legal_readiness"]
assert readiness["publication_authorized"] is False
assert readiness["legal_review_complete"] is False
assert readiness["served_markets_reviewed"] is False
for required in (
    "operator_legal_name",
    "operator_legal_address",
    "support_email",
    "privacy_contact",
    "governing_law",
    "served_markets_legal_review",
    "final_legal_review",
):
    assert required in readiness["missing_fields"]

for fragment in (
    "crypto_legal_readiness",
    "publication_authorized boolean not null default false",
    "legal_review_complete boolean not null default false",
    "served_markets_reviewed boolean not null default false",
    "('refund','2026-08-07-draft1'",
    "active = false",
    "revoke all on table public.crypto_legal_readiness from public, anon, authenticated",
):
    assert fragment in sql, f"migration missing safety fragment: {fragment}"

for key, value in manifest["safety_boundary"].items():
    assert value is False, f"safety boundary activated: {key}"

normalized = (sql + copy).replace(" ", "").lower()
for forbidden in (
    "paid_checkout_enabled=true",
    "paid_entitlement_enabled=true",
    "public_registration_enabled=true",
    "recurring_billing_enabled=true",
    "refund_execution_enabled=true",
    "production_launch_authorized=true",
):
    assert forbidden not in normalized, f"forbidden activation fragment: {forbidden}"

print("commercial legal draft contract: OK")