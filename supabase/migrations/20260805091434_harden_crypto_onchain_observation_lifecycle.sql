create or replace function private.crypto_onchain_finality_rank(p_network text,p_status text)
returns integer
language sql
immutable
set search_path to 'pg_catalog','pg_temp'
as $$
  select case
    when p_network='TRON' and p_status='unconfirmed' then 0
    when p_network='TRON' and p_status='confirmed' then 1
    when p_network='TRON' and p_status='solidified' then 2
    when p_network in('BSC','SOLANA') and p_status='unconfirmed' then 0
    when p_network in('BSC','SOLANA') and p_status='confirmed' then 1
    when p_network in('BSC','SOLANA') and p_status='finalized' then 2
    else -1
  end
$$;

create table if not exists public.crypto_onchain_tx_claims(
  network_code text not null references public.crypto_onchain_networks(network_code) on update cascade on delete restrict,
  tx_hash text not null,
  invoice_id uuid not null references public.crypto_onchain_invoices(id) on delete restrict,
  sender_address text,
  recipient_address text not null,
  asset_code text not null,
  token_identifier text not null,
  amount_base_units numeric(78,0) not null,
  latest_finality_status text not null,
  latest_finality_rank integer not null,
  latest_execution_success boolean not null,
  latest_evidence_hash text not null,
  observation_count integer not null default 0,
  state text not null default 'observed',
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  credited_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(network_code,tx_hash),
  constraint crypto_onchain_tx_claim_amount_check check(amount_base_units>=0),
  constraint crypto_onchain_tx_claim_finality_check check(latest_finality_status in('unconfirmed','confirmed','solidified','finalized')),
  constraint crypto_onchain_tx_claim_rank_check check(latest_finality_rank between 0 and 2),
  constraint crypto_onchain_tx_claim_evidence_hash_check check(latest_evidence_hash ~ '^[0-9a-f]{64}$'),
  constraint crypto_onchain_tx_claim_observation_count_check check(observation_count>=0),
  constraint crypto_onchain_tx_claim_state_check check(state in('observed','review','credited')),
  constraint crypto_onchain_tx_claim_time_check check(last_observed_at>=first_observed_at),
  constraint crypto_onchain_tx_claim_credit_check check((state='credited' and credited_at is not null) or (state<>'credited' and credited_at is null))
);

create unique index if not exists crypto_onchain_tx_claim_active_invoice_idx
on public.crypto_onchain_tx_claims(invoice_id)
where state in('observed','credited');

alter table public.crypto_onchain_tx_observations
  add column if not exists validation_status text not null default 'accepted',
  add column if not exists validation_reason text;

alter table public.crypto_onchain_tx_observations
  drop constraint if exists crypto_onchain_tx_observations_network_code_tx_hash_key;

drop index if exists public.crypto_onchain_tx_observations_network_code_tx_hash_key;

create unique index if not exists crypto_onchain_observation_evidence_unique_idx
on public.crypto_onchain_tx_observations(network_code,tx_hash,verifier_evidence_hash);

alter table public.crypto_onchain_tx_observations
  drop constraint if exists crypto_onchain_observation_validation_status_check;
alter table public.crypto_onchain_tx_observations
  add constraint crypto_onchain_observation_validation_status_check
  check(validation_status in('accepted','review'));

alter table public.crypto_onchain_tx_observations
  drop constraint if exists crypto_onchain_tx_observations_claim_fkey;
alter table public.crypto_onchain_tx_observations
  add constraint crypto_onchain_tx_observations_claim_fkey
  foreign key(network_code,tx_hash)
  references public.crypto_onchain_tx_claims(network_code,tx_hash)
  on update cascade on delete restrict;

alter table public.crypto_onchain_tx_observations
  drop constraint if exists crypto_onchain_tx_observations_network_asset_fkey;
alter table public.crypto_onchain_tx_observations
  add constraint crypto_onchain_tx_observations_network_asset_fkey
  foreign key(network_code,asset_code)
  references public.crypto_onchain_network_assets(network_code,asset_code)
  on update cascade on delete restrict;

create or replace function private.crypto_onchain_activation_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_asset text;
  v_selected integer;
  v_active_networks integer;
  v_enabled_network_assets integer;
  v_active_addresses integer;
  v_active_prices integer;
  v_required_launch integer;
  v_refund_verified boolean;
  v_configuration_ready boolean;
  v_activation_ready boolean;
begin
  select count(*),min(asset_code) filter(where selected and status='active')
    into v_selected,v_asset
  from public.crypto_onchain_assets
  where selected and status='active';
  select count(*) into v_active_networks
  from public.crypto_onchain_networks
  where approved_by_owner and status='active' and network_code in('TRON','BSC','SOLANA');
  select count(*) into v_enabled_network_assets
  from public.crypto_onchain_network_assets
  where asset_code=v_asset and enabled and availability_status='available_verified'
    and verified_at is not null and token_identifier is not null
    and network_code in('TRON','BSC','SOLANA');
  select count(*) into v_active_addresses
  from public.crypto_onchain_receiving_addresses
  where active and verified and verified_at is not null
    and network_code in('TRON','BSC','SOLANA');
  select count(*) into v_active_prices
  from public.crypto_onchain_plan_pricing
  where asset_code=v_asset and active and approved_at is not null and plan in('BASIC','PRO');
  select count(*) into v_required_launch
  from public.crypto_launch_requirements
  where code in('PAYMENT_PROVIDER','PRICING_MODEL','MERCHANT_CREDENTIALS','PAYMENT_SANDBOX_E2E')
    and status='verified';
  select coalesce(status='verified',false) into v_refund_verified
  from public.crypto_launch_requirements where code='REFUND_POLICY';
  v_refund_verified:=coalesce(v_refund_verified,false);
  v_configuration_ready:=v_selected=1 and v_active_networks=3 and v_enabled_network_assets=3
    and v_active_addresses=3 and v_active_prices=2;
  v_activation_ready:=v_configuration_ready and v_required_launch=4;
  return jsonb_build_object(
    'selected_asset',v_asset,
    'selected_asset_count',v_selected,
    'active_networks',v_active_networks,
    'enabled_network_assets',v_enabled_network_assets,
    'active_receiving_addresses',v_active_addresses,
    'active_plan_prices',v_active_prices,
    'verified_launch_requirements',v_required_launch,
    'refund_policy_verified',v_refund_verified,
    'configuration_ready',v_configuration_ready,
    'activation_ready',v_activation_ready
  );
end $$;

create or replace function private.crypto_onchain_integrity_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_checks jsonb;
  v_critical integer;
  v_readiness jsonb;
begin
  v_readiness:=private.crypto_onchain_activation_readiness();
  with checks(code,detail,violations) as (
    select 'claim_without_observation','Transaction claim has no immutable observation',count(*)
      from public.crypto_onchain_tx_claims c
      where not exists(select 1 from public.crypto_onchain_tx_observations o where o.network_code=c.network_code and o.tx_hash=c.tx_hash)
    union all
    select 'observation_without_claim','Observation has no transaction claim',count(*)
      from public.crypto_onchain_tx_observations o
      where not exists(select 1 from public.crypto_onchain_tx_claims c where c.network_code=o.network_code and c.tx_hash=o.tx_hash)
    union all
    select 'observation_claim_invoice_mismatch','Observation and claim point to different invoices',count(*)
      from public.crypto_onchain_tx_observations o join public.crypto_onchain_tx_claims c using(network_code,tx_hash)
      where o.invoice_id<>c.invoice_id
    union all
    select 'claim_observation_count_mismatch','Claim observation counter differs from immutable history',count(*)
      from public.crypto_onchain_tx_claims c
      where c.observation_count<>(select count(*) from public.crypto_onchain_tx_observations o where o.network_code=c.network_code and o.tx_hash=c.tx_hash)
    union all
    select 'paid_invoice_without_credited_claim','Paid invoice has no credited transaction claim',count(*)
      from public.crypto_onchain_invoices i
      where i.status='paid' and not exists(select 1 from public.crypto_onchain_tx_claims c where c.invoice_id=i.id and c.state='credited')
    union all
    select 'credited_claim_invoice_not_paid','Credited transaction claim points to non-paid invoice',count(*)
      from public.crypto_onchain_tx_claims c join public.crypto_onchain_invoices i on i.id=c.invoice_id
      where c.state='credited' and i.status<>'paid'
    union all
    select 'paid_invoice_order_not_paid','Paid invoice billing order is not paid',count(*)
      from public.crypto_onchain_invoices i join public.crypto_billing_orders b on b.id=i.billing_order_id
      where i.status='paid' and b.status<>'paid'
    union all
    select 'invoice_claim_tx_mismatch','Invoice and credited claim transaction identifiers disagree',count(*)
      from public.crypto_onchain_invoices i join public.crypto_onchain_tx_claims c on c.invoice_id=i.id and c.state='credited'
      where i.tx_hash is distinct from c.tx_hash or i.network_code<>c.network_code
    union all
    select 'onchain_browser_table_privileges','Anon or authenticated has direct on-chain table privileges',count(*)
      from information_schema.role_table_grants
      where table_schema='public' and table_name like 'crypto_onchain_%' and grantee in('anon','authenticated')
    union all
    select 'active_provider_without_readiness','On-chain provider is enabled before readiness',count(*)
      from public.crypto_billing_provider_adapters a
      where a.provider='onchain'
        and (a.checkout_enabled or a.desired_mode='live' or a.lifecycle_status='active')
        and not coalesce((v_readiness->>'activation_ready')::boolean,false)
    union all
    select 'unsupported_onchain_recurring_or_webhook','Direct on-chain adapter has unsupported recurring or webhook enabled',count(*)
      from public.crypto_billing_provider_adapters a
      where a.provider='onchain' and (a.recurring_enabled or a.webhook_enabled)
  )
  select coalesce(jsonb_agg(jsonb_build_object('code',code,'detail',detail,'violations',violations,'passed',violations=0,'severity','critical') order by code),'[]'::jsonb),
         coalesce(sum(case when violations>0 then 1 else 0 end),0)
    into v_checks,v_critical
  from checks;
  return jsonb_build_object(
    'state',case when v_critical=0 then 'healthy' else 'critical' end,
    'generated_at',now(),
    'total_checks',jsonb_array_length(v_checks),
    'critical_checks',v_critical,
    'checks',v_checks,
    'readiness',v_readiness
  );
end $$;

create or replace function private.crypto_onchain_adapter_activation_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_ready jsonb;
begin
  if new.provider<>'onchain' then return new; end if;
  v_ready:=private.crypto_onchain_activation_readiness();
  if new.webhook_enabled then
    raise exception 'Direct on-chain adapter does not use provider webhooks' using errcode='55000';
  end if;
  if new.recurring_enabled then
    raise exception 'Direct on-chain recurring debit is not supported' using errcode='55000';
  end if;
  if new.desired_mode='test' or new.lifecycle_status in('configured','verified') then
    if not coalesce((v_ready->>'configuration_ready')::boolean,false) then
      raise exception 'On-chain adapter configuration prerequisites are incomplete' using errcode='55000';
    end if;
  end if;
  if new.desired_mode='live' or new.checkout_enabled or new.lifecycle_status='active' then
    if not coalesce((v_ready->>'activation_ready')::boolean,false) then
      raise exception 'On-chain adapter activation prerequisites are incomplete' using errcode='55000';
    end if;
  end if;
  if new.refunds_enabled and not coalesce((v_ready->>'refund_policy_verified')::boolean,false) then
    raise exception 'Refund policy must be verified before enabling refunds' using errcode='55000';
  end if;
  return new;
end $$;

drop trigger if exists crypto_onchain_adapter_activation_guard on public.crypto_billing_provider_adapters;
create trigger crypto_onchain_adapter_activation_guard
before insert or update on public.crypto_billing_provider_adapters
for each row execute function private.crypto_onchain_adapter_activation_guard();

create or replace function private.service_record_crypto_onchain_observation(p_invoice_id uuid,p_observation jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','extensions','pg_temp'
as $$
declare
  v_invoice public.crypto_onchain_invoices%rowtype;
  v_network public.crypto_onchain_networks%rowtype;
  v_order public.crypto_billing_orders%rowtype;
  v_claim public.crypto_onchain_tx_claims%rowtype;
  v_tx text;v_sender text;v_recipient text;v_token text;v_amount numeric(78,0);
  v_finality text;v_success boolean;v_block text;v_source text;v_hash text;
  v_status text;v_reason text;v_validation text:='accepted';v_billing jsonb;
  v_observed_at timestamptz;v_rank integer;v_period_start timestamptz;v_period_end timestamptz;v_existing_end timestamptz;
  v_duplicate boolean:=false;v_conflict boolean:=false;
begin
  if p_observation is null or jsonb_typeof(p_observation)<>'object' or length(p_observation::text)>16000 then
    raise exception 'Invalid chain observation' using errcode='22023';
  end if;
  if p_observation::text ~* '"(secret|private[_-]?key|seed|mnemonic|authorization|access[_-]?token)"\s*:' then
    raise exception 'Sensitive chain data rejected' using errcode='22023';
  end if;
  select * into v_invoice from public.crypto_onchain_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  select * into v_network from public.crypto_onchain_networks where network_code=v_invoice.network_code;
  select * into v_order from public.crypto_billing_orders where id=v_invoice.billing_order_id for update;
  v_tx=trim(coalesce(p_observation->>'tx_hash',''));
  v_sender=nullif(trim(coalesce(p_observation->>'sender_address','')),'');
  v_recipient=trim(coalesce(p_observation->>'recipient_address',''));
  v_token=trim(coalesce(p_observation->>'token_identifier',''));
  v_finality=lower(trim(coalesce(p_observation->>'finality_status','unconfirmed')));
  v_block=nullif(left(trim(coalesce(p_observation->>'block_reference','')),200),'');
  v_source=lower(trim(coalesce(p_observation->>'verifier_source','')));
  begin v_success=coalesce((p_observation->>'execution_success')::boolean,false); exception when others then raise exception 'Invalid execution status' using errcode='22023'; end;
  if coalesce(p_observation->>'amount_base_units','') !~ '^[0-9]{1,78}$' then raise exception 'Invalid observed amount' using errcode='22023'; end if;
  v_amount=(p_observation->>'amount_base_units')::numeric;
  if v_source !~ '^[a-z0-9][a-z0-9_.-]{1,63}$' then raise exception 'Invalid verifier source' using errcode='22023'; end if;
  if (v_invoice.network_code='BSC' and v_tx !~ '^0x[0-9a-fA-F]{64}$')
     or (v_invoice.network_code='TRON' and v_tx !~ '^[0-9a-fA-F]{64}$')
     or (v_invoice.network_code='SOLANA' and v_tx !~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$') then
    raise exception 'Invalid transaction identifier' using errcode='22023';
  end if;
  begin v_observed_at:=coalesce(nullif(p_observation->>'observed_at','')::timestamptz,now()); exception when others then raise exception 'Invalid observation time' using errcode='22023'; end;
  if v_observed_at>now()+interval '5 minutes' then raise exception 'Observation time is in the future' using errcode='22023'; end if;
  v_rank:=private.crypto_onchain_finality_rank(v_invoice.network_code,v_finality);
  if v_rank<0 then raise exception 'Unsupported finality state for network' using errcode='22023'; end if;
  v_hash=encode(extensions.digest(p_observation::text,'sha256'),'hex');
  if v_invoice.status='paid' and v_invoice.tx_hash is distinct from v_tx then
    raise exception 'Invoice is already paid by another transaction' using errcode='23505';
  end if;
  insert into public.crypto_onchain_tx_claims(
    network_code,tx_hash,invoice_id,sender_address,recipient_address,asset_code,token_identifier,amount_base_units,
    latest_finality_status,latest_finality_rank,latest_execution_success,latest_evidence_hash,observation_count,state,
    first_observed_at,last_observed_at
  ) values(
    v_invoice.network_code,v_tx,p_invoice_id,v_sender,v_recipient,v_invoice.asset_code,v_token,v_amount,
    v_finality,v_rank,v_success,v_hash,0,'observed',v_observed_at,v_observed_at
  ) on conflict(network_code,tx_hash) do nothing;
  select * into v_claim from public.crypto_onchain_tx_claims
  where network_code=v_invoice.network_code and tx_hash=v_tx for update;
  if v_claim.invoice_id<>p_invoice_id then raise exception 'Transaction already claimed by another invoice' using errcode='23505'; end if;
  if exists(select 1 from public.crypto_onchain_tx_observations where network_code=v_invoice.network_code and tx_hash=v_tx and verifier_evidence_hash=v_hash) then
    v_duplicate:=true;
    return jsonb_build_object('ok',true,'duplicate',true,'invoice_id',p_invoice_id,'tx_hash',v_tx,'status',v_invoice.status,'claim_state',v_claim.state);
  end if;
  if v_claim.observation_count>0 then
    if private.crypto_normalize_onchain_value(v_invoice.network_code,v_claim.recipient_address)<>private.crypto_normalize_onchain_value(v_invoice.network_code,v_recipient)
       or private.crypto_normalize_onchain_value(v_invoice.network_code,v_claim.token_identifier)<>private.crypto_normalize_onchain_value(v_invoice.network_code,v_token)
       or v_claim.amount_base_units<>v_amount
       or v_claim.latest_execution_success<>v_success then
      v_conflict:=true;v_reason:='conflicting_transaction_observation';
    elsif v_rank<v_claim.latest_finality_rank then
      v_conflict:=true;v_reason:='finality_regression';
    end if;
  end if;
  if v_conflict then
    v_status:='review';v_validation:='review';
  elsif v_observed_at<v_invoice.created_at-interval '2 minutes' then
    v_status:='review';v_validation:='review';v_reason:='transaction_precedes_invoice';
  elsif v_observed_at>v_invoice.expires_at then
    v_status:='review';v_validation:='review';v_reason:='transaction_after_invoice_expiry';
  elsif v_invoice.status in('expired','canceled') or v_order.status in('expired','canceled') then
    v_status:='review';v_validation:='review';v_reason:='terminal_invoice_requires_review';
  elsif not v_success then
    v_status:='failed';v_validation:='review';v_reason:='transaction_execution_failed';
  elsif private.crypto_normalize_onchain_value(v_invoice.network_code,v_recipient)<>private.crypto_normalize_onchain_value(v_invoice.network_code,v_invoice.receiving_address) then
    v_status:='wrong_recipient';v_validation:='review';v_reason:='recipient_mismatch';
  elsif private.crypto_normalize_onchain_value(v_invoice.network_code,v_token)<>private.crypto_normalize_onchain_value(v_invoice.network_code,v_invoice.token_identifier) then
    v_status:='wrong_asset';v_validation:='review';v_reason:='token_identifier_mismatch';
  elsif v_amount<v_invoice.amount_due_base_units then
    v_status:='underpaid';v_validation:='review';v_reason:='amount_below_invoice';
  elsif v_amount>v_invoice.amount_due_base_units then
    v_status:='overpaid';v_validation:='review';v_reason:='amount_above_invoice';
  elsif v_finality<>v_network.finality_mode then
    v_status:='confirming';
  else
    v_status:='paid';
  end if;
  insert into public.crypto_onchain_tx_observations(
    invoice_id,network_code,tx_hash,sender_address,recipient_address,asset_code,token_identifier,amount_base_units,
    block_reference,finality_status,execution_success,verifier_source,verifier_evidence_hash,observed_at,
    validation_status,validation_reason
  ) values(
    p_invoice_id,v_invoice.network_code,v_tx,v_sender,v_recipient,v_invoice.asset_code,v_token,v_amount,
    v_block,v_finality,v_success,v_source,v_hash,v_observed_at,v_validation,v_reason
  );
  update public.crypto_onchain_tx_claims set
    sender_address=coalesce(sender_address,v_sender),
    latest_finality_status=case when v_conflict then latest_finality_status else v_finality end,
    latest_finality_rank=case when v_conflict then latest_finality_rank else greatest(latest_finality_rank,v_rank) end,
    latest_execution_success=case when v_conflict then latest_execution_success else v_success end,
    latest_evidence_hash=v_hash,
    observation_count=observation_count+1,
    state=case when v_validation='review' then 'review' else state end,
    review_reason=case when v_validation='review' then v_reason else review_reason end,
    last_observed_at=greatest(last_observed_at,v_observed_at),
    updated_at=now()
  where network_code=v_invoice.network_code and tx_hash=v_tx;
  if v_invoice.status='paid' and v_status='paid' then
    return jsonb_build_object('ok',true,'duplicate',false,'invoice_id',p_invoice_id,'tx_hash',v_tx,'status','paid','observation_recorded',true);
  end if;
  if v_status='paid' then
    select current_period_end into v_existing_end from public.crypto_subscriptions where user_id=v_order.user_id for update;
    v_period_start:=greatest(now(),coalesce(v_existing_end,now()));
    v_period_end:=v_period_start+interval '30 days';
    v_billing:=private.ingest_crypto_billing_event(
      'onchain',lower(v_invoice.network_code)||':'||lower(v_tx),'payment.succeeded',v_invoice.billing_order_id,
      jsonb_build_object(
        'amount_minor',v_order.amount_minor,'currency',v_order.currency,'provider_order_id',v_invoice.id::text,
        'period_start',v_period_start,'period_end',v_period_end,'network_code',v_invoice.network_code,
        'asset_code',v_invoice.asset_code,'tx_hash',v_tx,'sender_address',v_sender,
        'recipient_address',v_invoice.receiving_address,'token_identifier',v_invoice.token_identifier,
        'amount_base_units',v_amount::text,'finality_status',v_finality,'block_reference',v_block
      ),v_observed_at,true
    );
    if coalesce((v_billing->>'ok')::boolean,false) then
      update public.crypto_onchain_invoices set status='paid',tx_hash=v_tx,sender_address=v_sender,block_reference=v_block,
        finality_status=v_finality,observed_amount_base_units=v_amount,observed_at=v_observed_at,verified_at=now(),updated_at=now()
      where id=p_invoice_id;
      update public.crypto_onchain_tx_claims set state='credited',credited_at=coalesce(credited_at,now()),review_reason=null,updated_at=now()
      where network_code=v_invoice.network_code and tx_hash=v_tx;
    else
      v_status:='review';v_reason:='billing_entitlement_processing_failed';
      update public.crypto_onchain_invoices set status='review',tx_hash=v_tx,sender_address=v_sender,block_reference=v_block,
        finality_status=v_finality,observed_amount_base_units=v_amount,observed_at=v_observed_at,updated_at=now()
      where id=p_invoice_id;
      update public.crypto_onchain_tx_claims set state='review',review_reason=v_reason,updated_at=now()
      where network_code=v_invoice.network_code and tx_hash=v_tx;
    end if;
  else
    update public.crypto_onchain_invoices set status=v_status,tx_hash=v_tx,sender_address=v_sender,block_reference=v_block,
      finality_status=v_finality,observed_amount_base_units=v_amount,observed_at=v_observed_at,updated_at=now()
    where id=p_invoice_id and status<>'paid';
  end if;
  return jsonb_build_object('ok',true,'duplicate',v_duplicate,'invoice_id',p_invoice_id,'tx_hash',v_tx,
    'status',(select status from public.crypto_onchain_invoices where id=p_invoice_id),
    'claim_state',(select state from public.crypto_onchain_tx_claims where network_code=v_invoice.network_code and tx_hash=v_tx),
    'reason',v_reason,'billing',coalesce(v_billing,'{}'::jsonb));
end $$;

create or replace function private.get_crypto_admin_onchain_payment_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_readiness jsonb;
  v_integrity jsonb;
begin
  if not public.crypto_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  v_readiness:=private.crypto_onchain_activation_readiness();
  v_integrity:=private.crypto_onchain_integrity_snapshot();
  return jsonb_build_object(
    'generated_at',now(),
    'provider',(select to_jsonb(a)-'required_secret_names' from public.crypto_billing_provider_adapters a where provider='onchain'),
    'networks',(select coalesce(jsonb_agg(to_jsonb(n) order by display_order),'[]'::jsonb) from public.crypto_onchain_networks n),
    'assets',(select coalesce(jsonb_agg(to_jsonb(a) order by asset_code),'[]'::jsonb) from public.crypto_onchain_assets a),
    'network_assets',(select coalesce(jsonb_agg(to_jsonb(na) order by network_code,asset_code),'[]'::jsonb) from public.crypto_onchain_network_assets na),
    'receiving_addresses',(select coalesce(jsonb_agg(jsonb_build_object('network_code',network_code,'configured',true,'verified',verified,'active',active,'address_suffix',right(address,6),'updated_at',updated_at) order by network_code),'[]'::jsonb) from public.crypto_onchain_receiving_addresses),
    'pricing',(select coalesce(jsonb_agg(to_jsonb(p) order by plan,asset_code),'[]'::jsonb) from public.crypto_onchain_plan_pricing p),
    'invoice_counts',(select jsonb_build_object('total',count(*),'open',count(*) filter(where status in('awaiting_payment','observed','confirming')),'paid',count(*) filter(where status='paid'),'review',count(*) filter(where status in('underpaid','overpaid','wrong_asset','wrong_recipient','review'))) from public.crypto_onchain_invoices),
    'claim_counts',(select jsonb_build_object('total',count(*),'observed',count(*) filter(where state='observed'),'credited',count(*) filter(where state='credited'),'review',count(*) filter(where state='review')) from public.crypto_onchain_tx_claims),
    'readiness',v_readiness,
    'integrity',v_integrity,
    'activation_allowed',coalesce((v_readiness->>'activation_ready')::boolean,false) and coalesce(v_integrity->>'state','critical')='healthy',
    'private_keys_required',false
  );
end $$;

alter table public.crypto_onchain_tx_claims enable row level security;
revoke all on table public.crypto_onchain_tx_claims from public,anon,authenticated;
grant select,insert,update,delete on table public.crypto_onchain_tx_claims to service_role;
drop policy if exists crypto_onchain_tx_claims_direct_deny on public.crypto_onchain_tx_claims;
create policy crypto_onchain_tx_claims_direct_deny on public.crypto_onchain_tx_claims
as restrictive for all to anon,authenticated using(false) with check(false);

revoke all on function private.crypto_onchain_finality_rank(text,text) from public,anon,authenticated;
revoke all on function private.crypto_onchain_activation_readiness() from public,anon,authenticated;
revoke all on function private.crypto_onchain_integrity_snapshot() from public,anon,authenticated;
revoke all on function private.crypto_onchain_adapter_activation_guard() from public,anon,authenticated;
revoke all on function private.service_record_crypto_onchain_observation(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.crypto_onchain_activation_readiness() to service_role;
grant execute on function private.crypto_onchain_integrity_snapshot() to service_role;
grant execute on function private.service_record_crypto_onchain_observation(uuid,jsonb) to service_role;

select private.service_update_crypto_launch_requirement(
  'PAYMENT_PROVIDER','in_progress',
  jsonb_build_object('provider','onchain_direct','wallet','trust_wallet_walletconnect','approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),'settlement_asset','pending'),
  jsonb_build_object('foundation_schema',true,'automatic_entitlement_path',true,'private_keys_required',false,'network_activation',false,'bsc_asset_contract_review_required',true,'transaction_claim_lifecycle_hardened',true,'finality_history_immutable',true,'late_payment_auto_credit_blocked',true,'existing_subscription_extension_preserved',true),
  'Three-network foundation and transaction lifecycle are hardened but disabled. Asset, pricing, addresses, verifier configuration and sandbox evidence remain pending.'
);

select private.service_update_crypto_launch_requirement(
  'PAYMENT_SANDBOX_E2E','blocked_dependency','{}'::jsonb,
  jsonb_build_object('onchain_foundation',true,'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),'transaction_claim_lifecycle_hardened',true,'scenarios_extended',jsonb_build_array('wrong_network','wrong_asset','underpayment','overpayment','duplicate_tx_hash','duplicate_evidence','unfinalized_tx','finality_progression','finality_regression','conflicting_observation','expired_invoice','late_transaction','existing_period_extension'),'activation',false),
  'Provider-neutral matrix now includes immutable finality progression and duplicate-claim controls. Execution remains blocked by asset, pricing, addresses and verifier configuration.'
);
