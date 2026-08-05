create table if not exists public.crypto_launch_requirements (
  code text primary key,
  phase text not null,
  title text not null,
  description text not null,
  owner_type text not null,
  status text not null,
  weight integer not null,
  dependencies text[] not null default '{}',
  decision_required boolean not null default false,
  sensitive_input_required boolean not null default false,
  physical_action_required boolean not null default false,
  decision_summary jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  operator_note text,
  decided_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_launch_requirements_code_check check(code ~ '^[A-Z][A-Z0-9_]{2,80}$'),
  constraint crypto_launch_requirements_phase_check check(phase in ('identity','commercial','reliability','validation','release')),
  constraint crypto_launch_requirements_owner_check check(owner_type in ('user_decision','external_configuration','physical_validation','autonomous')),
  constraint crypto_launch_requirements_status_check check(status in ('decision_required','external_input_required','blocked_dependency','ready','in_progress','verified','waived')),
  constraint crypto_launch_requirements_weight_check check(weight between 1 and 100),
  constraint crypto_launch_requirements_decision_json_check check(jsonb_typeof(decision_summary)='object'),
  constraint crypto_launch_requirements_evidence_json_check check(jsonb_typeof(evidence)='object'),
  constraint crypto_launch_requirements_note_check check(operator_note is null or char_length(operator_note)<=1000),
  constraint crypto_launch_requirements_verified_time_check check(status<>'verified' or verified_at is not null)
);

alter table public.crypto_launch_requirements enable row level security;
revoke all on table public.crypto_launch_requirements from public,anon,authenticated;
grant select on table public.crypto_launch_requirements to service_role;

create or replace function private.set_crypto_launch_requirement_updated_at()
returns trigger language plpgsql security definer
set search_path to 'public','pg_catalog','pg_temp'
as $$ begin new.updated_at:=now(); return new; end $$;
revoke all on function private.set_crypto_launch_requirement_updated_at() from public,anon,authenticated;

drop trigger if exists crypto_launch_requirements_updated_at on public.crypto_launch_requirements;
create trigger crypto_launch_requirements_updated_at before update on public.crypto_launch_requirements
for each row execute function private.set_crypto_launch_requirement_updated_at();

insert into public.crypto_launch_requirements
(code,phase,title,description,owner_type,status,weight,dependencies,decision_required,sensitive_input_required,physical_action_required)
values
('TURNSTILE_CONFIG','identity','Cloudflare Turnstile','Получить и установить site key и secret key до публичной регистрации и recovery.','external_configuration','external_input_required',6,'{}',false,true,false),
('MAIL_RELAY','identity','Почтовый relay','Настроить relay и провести контролируемый тест на принадлежащем владельцу email.','external_configuration','external_input_required',6,'{}',false,true,false),
('REAL_ADMIN','identity','Реальный администратор','Назначить принадлежащий владельцу Auth-аккаунт ролью admin.','user_decision','decision_required',4,'{}',true,false,false),
('AUTH_E2E','identity','Регистрация и recovery E2E','Включить и проверить регистрацию, подтверждение email, вход и восстановление пароля.','autonomous','blocked_dependency',8,array['TURNSTILE_CONFIG','MAIL_RELAY','REAL_ADMIN'],false,false,false),
('PRICING_MODEL','commercial','Тарифы BASIC и PRO','Утвердить суммы, валюту и период оплаты.','user_decision','decision_required',8,'{}',true,false,false),
('PAYMENT_PROVIDER','commercial','Платёжный провайдер','Выбрать LiqPay или Stripe и режим запуска.','user_decision','decision_required',7,'{}',true,false,false),
('MERCHANT_CREDENTIALS','commercial','Merchant credentials','Установить merchant credentials и webhook secrets выбранного провайдера.','external_configuration','blocked_dependency',5,array['PAYMENT_PROVIDER'],false,true,false),
('REFUND_POLICY','commercial','Политика возвратов','Утвердить возврат, chargeback, отмену и failed renewal.','user_decision','decision_required',6,'{}',true,false,false),
('PAYMENT_SANDBOX_E2E','commercial','Платёжный sandbox E2E','Проверить success, failure, duplicate webhook, renewal, cancellation и refund.','autonomous','blocked_dependency',10,array['PRICING_MODEL','PAYMENT_PROVIDER','MERCHANT_CREDENTIALS','REFUND_POLICY'],false,false,false),
('BACKUP_PITR','reliability','Backup и PITR','Подтвердить managed backup/PITR и выполнить безопасную репетицию восстановления.','external_configuration','external_input_required',8,'{}',false,false,false),
('IOS_PWA_REVIEW','validation','Проверка iPhone','Проверить физический iPhone, установку PWA, offline и ключевые сценарии.','physical_validation','external_input_required',5,'{}',false,false,true),
('ANDROID_PWA_REVIEW','validation','Проверка Android','Проверить физический Android, установку PWA, offline и ключевые сценарии.','physical_validation','external_input_required',5,'{}',false,false,true),
('CONTROLLED_BETA','validation','Закрытая beta','Провести ограниченный beta-тест с реальными пользователями.','physical_validation','blocked_dependency',8,array['AUTH_E2E','IOS_PWA_REVIEW','ANDROID_PWA_REVIEW'],false,false,true),
('BETA_UX_FIXES','validation','Исправления beta/UX','Зафиксировать и устранить подтверждённые проблемы закрытой beta.','autonomous','blocked_dependency',5,array['CONTROLLED_BETA'],false,false,false),
('PUBLISH_V79','release','Решение о публикации v79','Принять отдельное решение о замене стабильной v78.','user_decision','blocked_dependency',4,array['PAYMENT_SANDBOX_E2E','BACKUP_PITR','BETA_UX_FIXES'],true,false,false),
('FINAL_LAUNCH_SMOKE','release','Финальный launch smoke','После публикации проверить вход, оплату, AI, сканер, Telegram и rollback readiness.','autonomous','blocked_dependency',5,array['PUBLISH_V79'],false,false,false)
on conflict(code) do update set
  phase=excluded.phase,title=excluded.title,description=excluded.description,
  owner_type=excluded.owner_type,weight=excluded.weight,dependencies=excluded.dependencies,
  decision_required=excluded.decision_required,sensitive_input_required=excluded.sensitive_input_required,
  physical_action_required=excluded.physical_action_required;

create or replace function private.assert_crypto_launch_json_safe(p_value jsonb)
returns void language plpgsql immutable security definer
set search_path to 'pg_catalog','pg_temp'
as $$
begin
  if p_value is null or jsonb_typeof(p_value)<>'object' then
    raise exception 'Launch data must be a JSON object' using errcode='22023';
  end if;
  if length(p_value::text)>12000 then
    raise exception 'Launch data is too large' using errcode='22023';
  end if;
  if p_value::text ~* '"(secret|password|private[_-]?key|access[_-]?token|refresh[_-]?token|authorization|signature|webhook[_-]?secret|bot[_-]?token)"\s*:' then
    raise exception 'Sensitive launch data must not be stored' using errcode='22023';
  end if;
end $$;
revoke all on function private.assert_crypto_launch_json_safe(jsonb) from public,anon,authenticated;
grant execute on function private.assert_crypto_launch_json_safe(jsonb) to service_role;

create or replace function private.service_update_crypto_launch_requirement(
  p_code text,
  p_status text,
  p_decision_summary jsonb default '{}'::jsonb,
  p_evidence jsonb default '{}'::jsonb,
  p_operator_note text default null
)
returns jsonb language plpgsql security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare v_row public.crypto_launch_requirements%rowtype;
begin
  if p_status not in ('decision_required','external_input_required','blocked_dependency','ready','in_progress','verified','waived') then
    raise exception 'Invalid launch requirement status' using errcode='22023';
  end if;
  if p_operator_note is not null and char_length(p_operator_note)>1000 then
    raise exception 'Operator note too long' using errcode='22023';
  end if;
  perform private.assert_crypto_launch_json_safe(coalesce(p_decision_summary,'{}'::jsonb));
  perform private.assert_crypto_launch_json_safe(coalesce(p_evidence,'{}'::jsonb));
  select * into v_row from public.crypto_launch_requirements where code=p_code for update;
  if v_row.code is null then raise exception 'Launch requirement not found' using errcode='P0002'; end if;
  if p_status='verified' and coalesce(p_evidence,'{}'::jsonb)='{}'::jsonb then
    raise exception 'Verified requirement needs evidence' using errcode='22023';
  end if;
  update public.crypto_launch_requirements set
    status=p_status,
    decision_summary=coalesce(p_decision_summary,'{}'::jsonb),
    evidence=coalesce(p_evidence,'{}'::jsonb),
    operator_note=p_operator_note,
    decided_at=case when decision_required and coalesce(p_decision_summary,'{}'::jsonb)<>'{}'::jsonb then coalesce(decided_at,now()) else decided_at end,
    verified_at=case when p_status='verified' then coalesce(verified_at,now()) else null end
  where code=p_code returning * into v_row;
  return jsonb_build_object('code',v_row.code,'status',v_row.status,'decided_at',v_row.decided_at,'verified_at',v_row.verified_at,'updated_at',v_row.updated_at);
end $$;
revoke all on function private.service_update_crypto_launch_requirement(text,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function private.service_update_crypto_launch_requirement(text,text,jsonb,jsonb,text) to service_role;

create or replace function private.crypto_full_launch_control_snapshot()
returns jsonb language plpgsql stable security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$
declare
  v_prices_ready boolean;
  v_provider_ready boolean;
  v_admin_ready boolean;
  v_items jsonb;
  v_blockers jsonb;
  v_decisions jsonb;
  v_external jsonb;
  v_physical jsonb;
  v_verified_weight integer;
  v_total_weight integer;
begin
  select count(*)=2 into v_prices_ready from public.crypto_plan_prices
    where plan in('BASIC','PRO') and active and amount_minor>0 and provider<>'unconfigured';
  select exists(select 1 from public.crypto_billing_provider_adapters
    where desired_mode in('test','live') and lifecycle_status in('verified','active')
      and checkout_enabled and webhook_enabled) into v_provider_ready;
  select exists(select 1 from public.crypto_user_profiles where role='admin') into v_admin_ready;

  with base as (
    select r.*,
      case
        when r.code='PRICING_MODEL' and v_prices_ready then 'verified'
        when r.code='PAYMENT_PROVIDER' and v_provider_ready then 'verified'
        when r.code='REAL_ADMIN' and v_admin_ready then 'verified'
        else r.status
      end as actual_status
    from public.crypto_launch_requirements r
  ), resolved as (
    select b.*,
      coalesce((select array_agg(d order by d) from unnest(b.dependencies) d
        where not exists(select 1 from base x where x.code=d and x.actual_status in('verified','waived'))),'{}'::text[]) unresolved_dependencies
    from base b
  ), final as (
    select r.*,
      case when cardinality(unresolved_dependencies)>0 and actual_status not in('verified','waived') then 'blocked_dependency' else actual_status end effective_status
    from resolved r
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'code',code,'phase',phase,'title',title,'description',description,'owner_type',owner_type,
      'status',effective_status,'stored_status',status,'weight',weight,'dependencies',dependencies,
      'unresolved_dependencies',unresolved_dependencies,'decision_required',decision_required,
      'sensitive_input_required',sensitive_input_required,'physical_action_required',physical_action_required,
      'decision_summary',decision_summary,'evidence',evidence,'operator_note',operator_note,
      'decided_at',decided_at,'verified_at',verified_at,'updated_at',updated_at
    ) order by case phase when 'identity' then 1 when 'commercial' then 2 when 'reliability' then 3 when 'validation' then 4 else 5 end, code),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('code',code,'phase',phase,'title',title,'status',effective_status,'owner_type',owner_type,'unresolved_dependencies',unresolved_dependencies,'decision_required',decision_required,'sensitive_input_required',sensitive_input_required,'physical_action_required',physical_action_required) order by weight desc) filter(where effective_status not in('verified','waived')),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('code',code,'title',title,'status',effective_status,'unresolved_dependencies',unresolved_dependencies) order by weight desc) filter(where decision_required and effective_status not in('verified','waived')),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('code',code,'title',title,'status',effective_status,'sensitive_input_required',sensitive_input_required,'unresolved_dependencies',unresolved_dependencies) order by weight desc) filter(where owner_type='external_configuration' and effective_status not in('verified','waived')),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('code',code,'title',title,'status',effective_status,'unresolved_dependencies',unresolved_dependencies) order by weight desc) filter(where physical_action_required and effective_status not in('verified','waived')),'[]'::jsonb),
    coalesce(sum(weight) filter(where effective_status in('verified','waived')),0),
    coalesce(sum(weight),0)
  into v_items,v_blockers,v_decisions,v_external,v_physical,v_verified_weight,v_total_weight
  from final;

  return jsonb_build_object(
    'generated_at',now(),
    'state',case when jsonb_array_length(v_blockers)=0 then 'ready_for_final_launch' when jsonb_array_length(v_decisions)>0 then 'decision_required' else 'work_remaining' end,
    'progress_pct',case when v_total_weight=0 then 0 else round(100.0*v_verified_weight/v_total_weight,1) end,
    'verified_weight',v_verified_weight,'total_weight',v_total_weight,
    'remaining_count',jsonb_array_length(v_blockers),
    'decision_count',jsonb_array_length(v_decisions),
    'external_input_count',jsonb_array_length(v_external),
    'physical_action_count',jsonb_array_length(v_physical),
    'actual_state',jsonb_build_object('prices_ready',v_prices_ready,'provider_ready',v_provider_ready,'real_admin_ready',v_admin_ready),
    'items',v_items,'blockers',v_blockers,'decision_queue',v_decisions,'external_input_queue',v_external,'physical_action_queue',v_physical,
    'stores_sensitive_values',false
  );
end $$;
revoke all on function private.crypto_full_launch_control_snapshot() from public,anon,authenticated;
grant execute on function private.crypto_full_launch_control_snapshot() to service_role;

create or replace function private.get_crypto_admin_full_launch_control()
returns jsonb language plpgsql stable security definer
set search_path to 'public','private','pg_catalog','pg_temp'
as $$ begin
  if not public.crypto_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return private.crypto_full_launch_control_snapshot();
end $$;
revoke all on function private.get_crypto_admin_full_launch_control() from public,anon,authenticated;
grant execute on function private.get_crypto_admin_full_launch_control() to authenticated,service_role;

create or replace function public.get_crypto_admin_full_launch_control()
returns jsonb language sql stable security invoker
set search_path to 'public','private','pg_temp'
as $$ select private.get_crypto_admin_full_launch_control(); $$;
revoke all on function public.get_crypto_admin_full_launch_control() from public,anon;
grant execute on function public.get_crypto_admin_full_launch_control() to authenticated;

create or replace function private.crypto_admin_audit_compact(p_table text,p_row jsonb)
returns jsonb language sql immutable
set search_path to 'public','pg_temp'
as $$
  select case p_table
    when 'crypto_plan_prices' then jsonb_strip_nulls(jsonb_build_object('plan',p_row->'plan','currency',p_row->'currency','billing_interval',p_row->'billing_interval','amount_minor',p_row->'amount_minor','provider',p_row->'provider','active',p_row->'active'))
    when 'crypto_subscriptions' then jsonb_strip_nulls(jsonb_build_object('user_id',p_row->'user_id','plan',p_row->'plan','status',p_row->'status','provider',p_row->'provider','current_period_end',p_row->'current_period_end','cancel_at_period_end',p_row->'cancel_at_period_end','scheduled_plan',p_row->'scheduled_plan','scheduled_change_at',p_row->'scheduled_change_at','ended_at',p_row->'ended_at'))
    when 'crypto_plan_requests' then jsonb_strip_nulls(jsonb_build_object('id',p_row->'id','user_id',p_row->'user_id','requested_plan',p_row->'requested_plan','status',p_row->'status','source',p_row->'source','admin_note',p_row->'admin_note'))
    when 'crypto_support_tickets' then jsonb_strip_nulls(jsonb_build_object('id',p_row->'id','user_id',p_row->'user_id','category',p_row->'category','status',p_row->'status','priority',p_row->'priority','assigned_admin_id',p_row->'assigned_admin_id','closed_at',p_row->'closed_at'))
    when 'crypto_billing_events' then jsonb_strip_nulls(jsonb_build_object('id',p_row->'id','provider',p_row->'provider','event_type',p_row->'event_type','order_id',p_row->'order_id','user_id',p_row->'user_id','event_status',p_row->'event_status','processed',p_row->'processed','review_required',p_row->'review_required','review_reason',p_row->'review_reason','reviewed_by',p_row->'reviewed_by','error_code',p_row->'error_code'))
    when 'crypto_billing_anomalies' then jsonb_strip_nulls(jsonb_build_object('id',p_row->'id','anomaly_type',p_row->'anomaly_type','severity',p_row->'severity','status',p_row->'status','user_id',p_row->'user_id','order_id',p_row->'order_id','event_id',p_row->'event_id','resolved_by',p_row->'resolved_by'))
    when 'crypto_billing_provider_adapters' then jsonb_strip_nulls(jsonb_build_object('provider',p_row->'provider','contract_version',p_row->'contract_version','desired_mode',p_row->'desired_mode','lifecycle_status',p_row->'lifecycle_status','checkout_enabled',p_row->'checkout_enabled','webhook_enabled',p_row->'webhook_enabled','recurring_enabled',p_row->'recurring_enabled','refunds_enabled',p_row->'refunds_enabled','last_verified_at',p_row->'last_verified_at','last_error_code',p_row->'last_error_code'))
    when 'crypto_account_deletion_requests' then jsonb_strip_nulls(jsonb_build_object('id',p_row->'id','user_id',p_row->'user_id','status',p_row->'status','decision_by',p_row->'decision_by','decision_at',p_row->'decision_at','completed_at',p_row->'completed_at'))
    when 'crypto_user_profiles' then jsonb_strip_nulls(jsonb_build_object('user_id',p_row->'user_id','role',p_row->'role'))
    when 'crypto_launch_requirements' then jsonb_strip_nulls(jsonb_build_object('code',p_row->'code','status',p_row->'status','decision_summary',p_row->'decision_summary','evidence',p_row->'evidence','operator_note',p_row->'operator_note','decided_at',p_row->'decided_at','verified_at',p_row->'verified_at'))
    else '{}'::jsonb end
$$;

drop trigger if exists crypto_launch_requirements_admin_audit on public.crypto_launch_requirements;
create trigger crypto_launch_requirements_admin_audit after insert or update or delete on public.crypto_launch_requirements
for each row execute function private.crypto_admin_audit_trigger('include_service');