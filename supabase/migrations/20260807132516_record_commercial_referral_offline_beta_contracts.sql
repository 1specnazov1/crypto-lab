insert into public.crypto_closed_beta_scenarios(code,area,title,execution_mode,status,requires_auth_activation,requires_wallet_signature,requires_real_user,destructive,steps,expected_result)
values
('BETA-COMM-01','commercial','Inactive sales landing contract','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Validate BASIC $20 and PRO $49 pricing copy','Verify payments/subscriptions are explicitly disabled','Verify Terms/Privacy/Refund/Risk links and risk disclaimer','Verify no receiving wallet address is embedded'),
 'Commercial landing is ready as an inactive candidate and cannot collect payment.'),
('BETA-COMM-02','commercial','Referral and funnel fail-closed contract','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Verify referral config defaults disabled','Attempt activation without owner authorization and expect DB rejection','Verify reward economics remain owner_decision_required','Verify zero codes/attributions/funnel events'),
 'Referral/funnel infrastructure is prepared but cannot activate or create payouts before a separate owner decision.')
on conflict (code) do update set title=excluded.title,execution_mode=excluded.execution_mode,status=excluded.status,steps=excluded.steps,expected_result=excluded.expected_result;

insert into public.crypto_closed_beta_checklist(persona_slot,scenario_code,status,evidence,checked_at)
select p.slot,s.code,'passed',
  case s.code
    when 'BETA-COMM-01' then jsonb_build_object('workflow','Validate v79 Commercial Landing Contract','run_id','31182309138','conclusion','success','payments_enabled',false)
    when 'BETA-COMM-02' then jsonb_build_object('referral_enabled',false,'activation_authorized',false,'reward_model','owner_decision_required','codes',0,'attributions',0,'payouts_created',0)
    else '{}'::jsonb end,
  now()
from public.crypto_closed_beta_test_personas p
cross join (select code from public.crypto_closed_beta_scenarios where code in ('BETA-COMM-01','BETA-COMM-02')) s
on conflict (persona_slot,scenario_code) do update set status='passed',evidence=excluded.evidence,checked_at=excluded.checked_at;
