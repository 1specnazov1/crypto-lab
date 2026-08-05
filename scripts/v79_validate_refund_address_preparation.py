import hashlib, json, re, sys
from pathlib import Path

V78='4a278c891d37b3760ec1ac988690ea9ad587b24e'
REFUND_SHA='2b88bb0518cce25f24847b31adae688e2a70caeeb45d593f9e128f6fcac15e05'
paths={
 'draft':Path('docs/REFUND_POLICY_PROPOSAL_7930.md'),
 'manifest':Path('docs/release-manifests/crypto-lab-v79-refund-policy-proposal.json'),
 'onchain':Path('docs/release-manifests/crypto-lab-v79-onchain-payments.json'),
 'pricing':Path('docs/release-manifests/crypto-lab-v79-owner-pricing-decision.json'),
 'release':Path('docs/release-manifests/crypto-lab-v79-7930.json'),
 's1':Path('supabase/migrations/20260805193725_harden_crypto_x_internal_triggers_and_service_tables.sql'),
 'addr':Path('supabase/migrations/20260805194211_prepare_refund_policy_and_onchain_address_intake.sql'),
 's2':Path('supabase/migrations/20260805194511_harden_crypto_x_source_learning_services.sql'),
}
errors=[]
def check(ok,msg):
    if not ok: errors.append(msg)
for name,path in paths.items(): check(path.is_file(),f'missing {name}: {path}')
if not errors:
    text={k:p.read_text(encoding='utf-8') for k,p in paths.items()}
    data={k:json.loads(text[k]) for k in ('manifest','onchain','pricing','release')}
    m,o,p,r=data['manifest'],data['onchain'],data['pricing'],data['release']
    check(hashlib.sha256(text['draft'].encode()).hexdigest()==REFUND_SHA,'refund draft SHA')
    check((m['schema_version'],m['project_ref'],m['build'])==(2,'txhzxbizjpinowepfjkm','7930'),'refund identity')
    check(m['status']=='decision_required_not_published','refund status')
    check(m['proposal_code']=='REFUND_POLICY_V1_APPROVAL' and m['proposal_sha256']==REFUND_SHA,'refund proposal authority')
    check(not m['owner_approved'] and not m['published'] and not m['payments_enabled'],'refund approval boundary')
    check(not m['refund_execution_enabled'] and not m['automatic_refunds_enabled'],'refund execution boundary')
    check(m['maximum_processing_days_when_legally_required']==14 and m['statutory_rights_preserved'],'refund legal boundary')
    a=m['address_intake']
    check(a['required_networks']==['ETHEREUM','TRON','SOLANA'],'address networks')
    check((a['configured_count'],a['verified_inactive_count'],a['active_count'])==(0,0,0),'address counts')
    check(not a['sensitive_material_required'] and a['staged_addresses_forced_inactive'],'address safety')
    check(m['security_hardening']['security_advisor_lints']==0,'security advisor')
    check(m['security_hardening']['service_only_deny_policy_count']==5,'deny policy count')
    check(m['database_runtime']=={
      'receiving_address_count':0,'active_price_count':0,'invoice_count':0,
      'transaction_claim_count':0,'chain_observation_count':0,
      'configuration_ready':False,'activation_ready':False},'database runtime')
    b=m['activation_boundary']
    check(not any([b['checkout_enabled'],b['refunds_enabled'],b['recurring_enabled'],b['real_transfers_allowed']]),'activation boundary')
    check(b['receiving_addresses_active']==0,'active address boundary')
    check(m['next_owner_decision']=='REFUND_POLICY_V1_APPROVAL' and m['stable_root_v78_sha']==V78,'next decision/root')
    check(o['schema_version']==14 and not o['activation_allowed'] and not o['publication_allowed'],'onchain boundary')
    check(o['pricing']['basic_amount_minor']==2000 and o['pricing']['pro_amount_minor']==4900 and o['pricing']['active_row_count']==0,'onchain pricing')
    for key in ('active_network_count','enabled_network_asset_count','active_price_count','receiving_address_count','invoice_count','transaction_claim_count','chain_observation_count'):
        check(o['runtime_state'][key]==0,f'onchain runtime {key}')
    check(not o['runtime_state']['configuration_ready'] and not o['runtime_state']['activation_ready'] and not o['runtime_state']['payment_activation_authorized'],'onchain readiness')
    check([x['amount_minor'] for x in p['plans']]==[2000,4900] and all(not x['active'] for x in p['plans']),'pricing manifest')
    check(not p['payment_activation_authorized'] and not p['checkout_enabled'],'pricing activation')
    check(r['stable_root']['sha']==V78 and not r['boundaries']['v79_published_over_v78'],'release root')
    markers={
      's1':['crypto_x_recap_runs_content_job_id_idx','crypto_x_account_metrics_service_only_deny','crypto_x_apply_source_attribution()'],
      'addr':['service_stage_crypto_onchain_receiving_address','service_verify_crypto_onchain_receiving_address','REFUND_POLICY_V1_APPROVAL','active=false','refunds_enabled'],
      's2':['crypto_x_source_performance_service_only_deny','crypto_x_apply_blended_source_ranking()','crypto_x_refresh_source_performance()'],
    }
    for key,items in markers.items():
        for item in items: check(item in text[key],f'{key} marker {item}')
    combined='\n'.join(text.values())
    for pattern in (r'sb_secret_',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'Bearer\s+eyJ'):
        check(re.search(pattern,combined,re.I) is None,'possible secret material')
if errors:
    print('\n'.join('ERROR: '+e for e in errors)); sys.exit(1)
print('Refund decision package, address intake, and security hardening: OK')
