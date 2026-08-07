insert into public.crypto_closed_beta_scenarios(code,area,title,execution_mode,status,requires_auth_activation,requires_wallet_signature,requires_real_user,destructive,steps,expected_result)
values
('BETA-AUTH-04','auth','Four-document frontend/backend registration contract','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Verify frontend requires exact Terms/Privacy/Refund/Risk set','Verify backend requires the same four legal keys','Verify stale three-document logic is absent','Verify public registration flag remains false'),
 'Frontend and backend agree on the exact four-document legal contract while public registration remains disabled.'),
('BETA-MAIL-02','mail','Direct Resend provider fail-closed contract','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Verify only signup_confirmation/password_recovery templates are allowed','Verify arbitrary subject/html are rejected by construction','Verify Supabase auth action URL host/type binding','Verify idempotency header and service-role caller gate'),
 'Direct Resend delivery is production-prepared but remains disabled until secrets are installed.'),
('BETA-AUTH-05','auth','One-time real-owner admin bootstrap contract','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Verify no synthetic auth user is created','Verify exact pre-authorized owner email only','Verify email confirmation is required before admin promotion','Verify first-admin-only and one-time self-disable','Verify public registration is not required'),
 'A real owner account can become the first admin only after confirmation, without opening public registration or creating synthetic credentials.')
on conflict (code) do update set title=excluded.title,execution_mode=excluded.execution_mode,status=excluded.status,steps=excluded.steps,expected_result=excluded.expected_result;

insert into public.crypto_closed_beta_checklist(persona_slot,scenario_code,status,evidence,checked_at)
select p.slot,s.code,'passed',
  case s.code
    when 'BETA-AUTH-04' then jsonb_build_object('auth_ci_run_id','31196704153','conclusion','success','required_legal_keys',jsonb_build_array('terms','privacy','refund','risk'),'public_registration_enabled',false)
    when 'BETA-MAIL-02' then jsonb_build_object('auth_ci_run_id','31196704153','conclusion','success','provider','resend','mail_dispatch_version',5,'provider_secrets_installed',false,'arbitrary_template_input',false)
    when 'BETA-AUTH-05' then jsonb_build_object('auth_ci_run_id','31196704153','conclusion','success','owner_bootstrap_ready',true,'synthetic_user_created',false,'public_registration_required',false,'bootstrap_consumed',false)
    else '{}'::jsonb end,
  now()
from public.crypto_closed_beta_test_personas p
cross join (select code from public.crypto_closed_beta_scenarios where code in ('BETA-AUTH-04','BETA-MAIL-02','BETA-AUTH-05')) s
on conflict (persona_slot,scenario_code) do update set status='passed',evidence=excluded.evidence,checked_at=excluded.checked_at;
