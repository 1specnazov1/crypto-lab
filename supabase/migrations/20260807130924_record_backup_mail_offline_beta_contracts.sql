insert into public.crypto_closed_beta_scenarios(code,area,title,execution_mode,status,requires_auth_activation,requires_wallet_signature,requires_real_user,destructive,steps,expected_result)
values
('BETA-BACKUP-01','reliability','Restore rehearsal fail-closed guard contract','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Run backup restore guard CI','Verify production project ref is denied','Verify disposable confirmation is mandatory','Verify denial occurs before restore commands execute'),
 'Restore rehearsal cannot target production and cannot proceed without explicit disposable non-production confirmation.'),
('BETA-MAIL-01','notifications','Versioned auth mail template contract','offline_contract','passed',false,false,false,false,
 jsonb_build_array('Validate signup/recovery templates in RU/UK/EN','Verify only action_url placeholder is allowed','Verify arbitrary subject/body and secret-like placeholders are forbidden'),
 'Auth mail content is versioned and bounded before any real relay is connected.')
on conflict (code) do update set title=excluded.title,execution_mode=excluded.execution_mode,status=excluded.status,steps=excluded.steps,expected_result=excluded.expected_result;

insert into public.crypto_closed_beta_checklist(persona_slot,scenario_code,status,evidence,checked_at)
select p.slot,s.code,'passed',
  case s.code
    when 'BETA-BACKUP-01' then jsonb_build_object('workflow','Validate v79 Backup Restore Guards','run_id','31179217180','conclusion','success','production_restore_executed',false)
    when 'BETA-MAIL-01' then jsonb_build_object('workflow','Validate v79 Mail Template Contract','run_id','31179338961','conclusion','success','real_email_sent',false)
    else '{}'::jsonb end,
  now()
from public.crypto_closed_beta_test_personas p
cross join (select code from public.crypto_closed_beta_scenarios where code in ('BETA-BACKUP-01','BETA-MAIL-01')) s
on conflict (persona_slot,scenario_code) do update set status='passed',evidence=excluded.evidence,checked_at=excluded.checked_at;
