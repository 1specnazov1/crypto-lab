insert into public.crypto_closed_beta_scenarios(code,area,title,execution_mode,status,requires_auth_activation,requires_wallet_signature,requires_real_user,destructive,steps,expected_result)
values
('BETA-PWA-01','validation','PWA install/offline/legal contract','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Validate standalone manifest','Validate service worker does not perform writes','Validate offline shell includes Refund/Terms/Privacy/Risk surfaces','Validate app bootstrap cache version matches current PWA extension'),
 'v79 PWA install/offline contract is internally consistent; physical iPhone/Android execution remains a separate external validation.')
on conflict (code) do update set title=excluded.title,execution_mode=excluded.execution_mode,status=excluded.status,steps=excluded.steps,expected_result=excluded.expected_result;

insert into public.crypto_closed_beta_checklist(persona_slot,scenario_code,status,evidence,checked_at)
select p.slot,'BETA-PWA-01','passed',
  jsonb_build_object('workflow','Validate v79 PWA Contract','run_id','31181264874','conclusion','success','physical_device_tested',false,'app_extension_cache_version','7930pwa1'),
  now()
from public.crypto_closed_beta_test_personas p
on conflict (persona_slot,scenario_code) do update set status='passed',evidence=excluded.evidence,checked_at=excluded.checked_at;
