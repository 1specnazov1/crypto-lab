import json
from datetime import datetime, timezone
from pathlib import Path

path = Path('docs/release-manifests/crypto-lab-v79-7930.json')
data = json.loads(path.read_text(encoding='utf-8'))
op = data['operational_hardening']

legacy_keys = {
    'onchain_effective_payment_authority_event_count',
    'active_valid_owner_decision_records',
    'superseded_invalid_owner_decision_records',
    'fabricated_owner_text_not_user_content',
    'onchain_last_false_authority_migration_version',
    'onchain_last_false_authority_migration_superseded',
}
for key in legacy_keys:
    op.pop(key, None)

op.update({
    'onchain_manifest_schema_version': 10,
    'onchain_active_owner_decision_record_count': 1,
    'onchain_effective_authority_event_count': 1,
    'onchain_effective_false_supersession_count': 0,
    'onchain_latest_stale_candidate_only_migration': '20260805104812_authoritative_candidate_only_recovery_after_103945',
    'onchain_latest_repair_migration_version': '20260805105743',
    'onchain_authoritative_migration_version': '20260805105743',
    'onchain_authoritative_migration_name': 'restore_exact_owner_three_network_authority_after_104812_stale_cycle',
    'onchain_approved_network_count': 3,
    'onchain_active_network_count': 0,
    'onchain_selected_asset_count': 0,
    'onchain_enabled_network_asset_count': 0,
    'onchain_active_price_count': 0,
    'onchain_receiving_address_count': 0,
    'onchain_invoice_count': 0,
    'onchain_chain_observation_count': 0,
    'onchain_transaction_claim_count': 0,
    'onchain_settlement_asset': 'pending',
    'onchain_provider_mode': 'disabled',
    'onchain_provider_lifecycle': 'draft',
    'onchain_checkout_enabled': False,
    'onchain_webhook_enabled': False,
    'onchain_recurring_enabled': False,
    'onchain_refunds_enabled': False,
    'direct_onchain_payment_activation_allowed': False,
    'onchain_automation_resume_allowed': False,
})

data['updated_at'] = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

for key in legacy_keys:
    assert key not in op, key
assert op['onchain_manifest_schema_version'] == 10
assert op['onchain_active_owner_decision_record_count'] == 1
assert op['onchain_effective_authority_event_count'] == 1
assert op['onchain_effective_false_supersession_count'] == 0
print('Release manifest legacy on-chain keys cleaned: OK')
