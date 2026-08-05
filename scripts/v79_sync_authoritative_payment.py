import json,subprocess
from datetime import datetime,timezone
from pathlib import Path
exact='Три сети утверждаю.'
digest='57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be'
networks=['TRON','BSC','SOLANA']
version='20260805103945'
name='restore_exact_owner_three_network_authority_after_103527_stale_cycle'
source='supabase/migrations/20260805103945_restore_exact_owner_three_network_authority_after_103527_stale_cycle.sql'
source_commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
now=datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
stable='4a278c891d37b3760ec1ac988690ea9ad587b24e'
authority={'version':version,'name':name,'source':source,'source_commit':source_commit}

onchain={
  'schema_version':10,'project_ref':'txhzxbizjpinowepfjkm','build':'7930','updated_at':now,
  'provider':'onchain_direct','wallet_client':'trust_wallet_walletconnect',
  'status':'disabled_pending_remaining_decisions','activation_allowed':False,'publication_allowed':False,
  'approved_networks':networks,'owner_network_approval_recorded':True,'owner_provider_approval_recorded':False,
  'owner_decision':{'decision_code':'ONCHAIN_THREE_NETWORK_SELECTION','decision_text_exact':exact,'decision_hash_sha256':digest,'decision_scope':'network_selection_only','network_activation_authorized':False,'active':True,'source_channel':'owner_chat'},
  'networks':[
    {'code':'TRON','standard':'TRC20','finality_mode':'solidified','required_confirmations':19,'approved_by_owner':True,'active':False},
    {'code':'BSC','standard':'BEP20','finality_mode':'finalized','required_confirmations':2,'approved_by_owner':True,'active':False},
    {'code':'SOLANA','standard':'SPL','finality_mode':'finalized','required_confirmations':0,'approved_by_owner':True,'active':False}],
  'asset_candidates':{
    'USDT':{'selected':False,'status':'decision_required','network_status':{'TRON':'official_direct_issuer_contract_confirmed','SOLANA':'official_direct_issuer_contract_confirmed','BSC':'verified_pegged_contract_requires_separate_owner_acceptance'}},
    'USDC':{'selected':False,'status':'decision_required','network_status':{'SOLANA':'official_issuer_support','TRON':'official_issuer_support_not_available','BSC':'official_issuer_support_not_available'}}},
  'pricing':{'basic_configured':False,'pro_configured':False},
  'receiving_addresses':{'TRON':None,'BSC':None,'SOLANA':None,'private_keys_required':False},
  'automatic_entitlement':{'prepared':True,'enabled':False,'period_days':30,'source_of_truth':'independently_verified_final_chain_state','browser_cannot_mark_paid':True,'duplicate_transaction_claim_blocked':True,'automatic_wallet_debit':False},
  'database':{'active_valid_owner_decision_records':1,'effective_payment_authority_events':1,'effective_false_supersessions':0,'canonical_owner_decision_constraint':True,'canonical_three_network_constraint':True,'payment_provider_owner_decision_constraint':True,'network_guard_trigger_enabled':True,'provider_guard_trigger_enabled':True,'owner_record_immutable_trigger_enabled':True,'authority_event_immutable_trigger_enabled':True,'correction_history_immutable_trigger_enabled':True,'all_tables_rls':True,'direct_browser_table_access':False},
  'runtime_state':{'approved_network_count':3,'active_network_count':0,'selected_asset_count':0,'enabled_network_asset_count':0,'active_price_count':0,'receiving_address_count':0,'invoice_count':0,'transaction_claim_count':0,'chain_observation_count':0,'auth_user_count':0,'registration_attempt_count':0,'recovery_attempt_count':0,'provider_status':'in_progress_disabled','provider_desired_mode':'disabled','provider_lifecycle_status':'draft','checkout_enabled':False,'webhook_enabled':False,'recurring_enabled':False,'refunds_enabled':False},
  'provenance_incident':{'overlapping_automation_runs_confirmed':True,'recurring_automation_disabled':True,'exact_owner_text_preserved':True,'stale_candidate_only_migration_superseded':'20260805103527','historical_false_migrations_preserved_for_audit':True,'autonomous_owner_decision_bypass_available':False},
  'authoritative_migration':authority,
  'remaining_decisions_and_inputs':['SETTLEMENT_ASSET_USDT_OR_USDC','BSC_PEGGED_USDT_ACCEPTANCE_IF_USDT','BASIC_AND_PRO_PRICE_POLICY','PUBLIC_RECEIVING_ADDRESS_FOR_EACH_APPROVED_NETWORK','RPC_OR_INDEXER_CONFIGURATION','WALLETCONNECT_PROJECT_ID_IF_USED','CONTROLLED_SANDBOX_EVIDENCE','PAYMENT_ACTIVATION_APPROVAL'],
  'repository_sync':{'sandbox_matrix_schema_version':10,'release_manifest_aligned':True,'foundation_workflow_aligned':True,'stale_candidate_only_artifacts_removed':True,'automation_resume_allowed':False},
  'stable_root_v78_sha':stable,'public_application_commit':'e1cbe2eb1cb9d97295ecfc9836d0f9bac9cfc191','pwa_cache':'crypto-lab-v79-7930-auth1'}
Path('docs/release-manifests/crypto-lab-v79-onchain-payments.json').write_text(json.dumps(onchain,ensure_ascii=False,indent=2)+'\n')

codes=['INVOICE_CREATED_SELECTED_NETWORK','TRUST_WALLET_OR_WALLETCONNECT_REQUEST','PAYMENT_SUCCESS_FINALIZED','USER_ABANDONED_PAYMENT','WRONG_NETWORK','WRONG_ASSET_OR_CONTRACT','WRONG_RECIPIENT','UNDERPAYMENT','OVERPAYMENT','UNFINALIZED_TRANSACTION','FAILED_OR_REVERTED_TRANSACTION','DUPLICATE_TRANSACTION_HASH','DUPLICATE_CHAIN_OBSERVATION','LATE_PAYMENT_AFTER_EXPIRY','REORG_OR_FINALITY_REGRESSION','CONFLICTING_CHAIN_OBSERVATION','PRICE_QUOTE_EXPIRED','RECEIVING_ADDRESS_NOT_VERIFIED','TOKEN_CONTRACT_NOT_VERIFIED','REPEAT_PURCHASE_EXTENDS_ACCESS','NETWORK_APPROVAL_REMOVAL_ATTEMPT','NETWORK_SET_EXPANSION_ATTEMPT','OWNER_DECISION_MUTATION_ATTEMPT','FALSE_SUPERSESSION_REACTIVATION_ATTEMPT','PREMATURE_NETWORK_ACTIVATION_ATTEMPT','FULL_REFUND','PARTIAL_REFUND','VERIFIER_UNAVAILABLE','MALFORMED_OR_SECRET_BEARING_OBSERVATION']
matrix={'schema_version':10,'project_ref':'txhzxbizjpinowepfjkm','build':'7930','updated_at':now,'provider':'onchain_direct','wallet_client':'trust_wallet_walletconnect','mode':'disabled','activation_allowed':False,'publication_allowed':False,'approved_networks':networks,'owner_network_approval_recorded':True,'owner_decision':onchain['owner_decision'],'settlement_asset':'pending','authoritative_migration':authority,'runtime_state':onchain['runtime_state'],'scenarios':[{'code':c,'required':True,'expected':['deterministic_fail_closed_assertions','no_unauthorized_entitlement','zero_secret_logs']} for c in codes],'scenario_count':len(codes),'stable_root_v78_sha':stable}
Path('docs/release-manifests/crypto-lab-v79-payment-sandbox-matrix.json').write_text(json.dumps(matrix,ensure_ascii=False,indent=2)+'\n')

rp=Path('docs/release-manifests/crypto-lab-v79-7930.json'); release=json.loads(rp.read_text())
for k in ('payment_activation_allowed','publication_allowed','stable_root_v78_sha'): release.pop(k,None)
allowed={'version','name','source','source_commit'}; found=False
for item in release.setdefault('migrations',[]):
  for k in list(item):
    if k not in allowed: item.pop(k,None)
  if item.get('version')==version:
    item.update(authority); found=True
if not found: release['migrations'].append(authority)
release['migrations']=sorted(release['migrations'],key=lambda x:(x.get('version',''),x.get('name','')))
release['updated_at']=now
op=release.setdefault('operational_hardening',{})
for k in list(op):
  if k in {'candidate_only_payment_repair_verified','candidate_only_manifest_contract_repaired','authoritative_payment_recovery_migration','authoritative_payment_recovery_source_commit','fabricated_text_was_not_user_content','onchain_candidate_networks','onchain_reconstructed_owner_record_inactive','onchain_validated_candidate_only_constraint_count','owner_decision_failclosed_gate_run_id','onchain_payment_gate_run_id','release_manifest_contract_run_id','onchain_observation_count','onchain_sandbox_manifest','onchain_provenance_document'}: op.pop(k,None)
op.update({'payment_provider_status':'in_progress_disabled','payment_sandbox_matrix_schema_version':10,'automatic_wallet_debit':False,'registration_enabled':False,'recovery_enabled':False,'v79_publication_authorized':False,'onchain_payment_manifest':'docs/release-manifests/crypto-lab-v79-onchain-payments.json','onchain_payment_sandbox_matrix':'docs/release-manifests/crypto-lab-v79-payment-sandbox-matrix.json','onchain_owner_decision_manifest':'docs/release-manifests/crypto-lab-v79-owner-network-decision.json','onchain_authoritative_migration_version':version,'onchain_authoritative_migration_name':name,'onchain_authoritative_migration_source_commit':source_commit,'onchain_payment_provider':'onchain_direct','onchain_wallet_client':'trust_wallet_walletconnect','onchain_owner_decision_code':'ONCHAIN_THREE_NETWORK_SELECTION','onchain_owner_decision_text_exact':exact,'onchain_owner_decision_hash':digest,'onchain_approved_networks':networks,'onchain_approved_network_count':3,'onchain_active_network_count':0,'onchain_selected_asset_count':0,'onchain_enabled_network_asset_count':0,'onchain_active_price_count':0,'onchain_receiving_address_count':0,'onchain_invoice_count':0,'onchain_chain_observation_count':0,'onchain_transaction_claim_count':0,'onchain_active_owner_decision_record_count':1,'onchain_effective_authority_event_count':1,'onchain_effective_false_supersession_count':0,'onchain_owner_approval_recorded':True,'onchain_owner_network_approval_recorded':True,'onchain_owner_provider_approval_recorded':False,'onchain_network_activation_authorized':False,'onchain_owner_approval_fail_closed':True,'onchain_transaction_lifecycle_hardened':True,'onchain_automatic_entitlement_prepared':True,'onchain_automatic_entitlement_enabled':False,'onchain_automatic_wallet_debit':False,'onchain_settlement_asset':'pending','onchain_provider_mode':'disabled','onchain_provider_lifecycle':'draft','onchain_checkout_enabled':False,'onchain_webhook_enabled':False,'onchain_recurring_enabled':False,'onchain_refunds_enabled':False,'onchain_sandbox_scenario_count':29,'direct_onchain_payment_activation_allowed':False,'onchain_concurrency_race_confirmed':True,'onchain_recurring_automation_disabled':True,'onchain_automation_resume_allowed':False,'onchain_false_supersession_invalidated':True,'service_only_audit_tables_explicit_deny_policies':True,'service_only_audit_policy_migration_version':'20260805101117'})
rp.write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
