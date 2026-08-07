insert into public.crypto_closed_beta_scenarios(code,area,title,execution_mode,status,requires_auth_activation,requires_wallet_signature,requires_real_user,destructive,steps,expected_result)
values
('BETA-AUTH-03','auth','Full commercial legal set gates registration','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Call registration readiness endpoint','Verify required legal keys are terms/privacy/refund/risk','Verify enabled=false while full legal set or external auth dependencies are missing'),
 'Registration remains fail-closed until all four commercial legal documents and external auth dependencies are ready.'),
('BETA-BILL-04','billing','Paid entitlement runtime hard gate','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Inspect authoritative subscription activation trigger','Verify BASIC/PRO active states require paid_entitlement_enabled=true','Verify future period_end is required for active paid access'),
 'No BASIC/PRO active entitlement can be created while the paid entitlement runtime flag is disabled.'),
('BETA-RPC-01','payments','Mainnet RPC primary/fallback prelaunch contract','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Verify mainnet health edge is JWT/admin-only','Verify only read methods are used','Verify primary/fallback secret names are prepared','Verify all mainnet profiles remain disabled'),
 'Primary/fallback health infrastructure is deployed without enabling mainnet payment execution.')
on conflict (code) do update set
 title=excluded.title,execution_mode=excluded.execution_mode,status=excluded.status,
 steps=excluded.steps,expected_result=excluded.expected_result;

insert into public.crypto_closed_beta_checklist(persona_slot,scenario_code,status,evidence,checked_at)
select p.slot,s.code,'passed',
  case s.code
    when 'BETA-AUTH-03' then jsonb_build_object('registration_probe_request_id',21281,'required_legal_keys',jsonb_build_array('terms','privacy','refund','risk'),'registration_enabled',false)
    when 'BETA-BILL-04' then jsonb_build_object('authoritative_guard','private.guard_crypto_paid_subscription_activation','paid_entitlement_enabled',false)
    when 'BETA-RPC-01' then jsonb_build_object('edge_function','crypto-lab-v79-mainnet-rpc-health','edge_version',2,'mainnet_profiles_enabled',0,'write_methods_allowed',false)
    else '{}'::jsonb end,
  now()
from public.crypto_closed_beta_test_personas p
cross join (select code from public.crypto_closed_beta_scenarios where code in ('BETA-AUTH-03','BETA-BILL-04','BETA-RPC-01')) s
on conflict (persona_slot,scenario_code) do update set status='passed',evidence=excluded.evidence,checked_at=excluded.checked_at;
