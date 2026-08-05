create or replace function private.crypto_validate_onchain_address(p_network text,p_address text)
returns boolean language sql immutable set search_path to 'pg_catalog','pg_temp'
as $$ select case p_network when 'TRON' then p_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' when 'BSC' then p_address ~ '^0x[0-9a-fA-F]{40}$' when 'SOLANA' then p_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' else false end $$;

create or replace function private.crypto_normalize_onchain_value(p_network text,p_value text)
returns text language sql immutable set search_path to 'pg_catalog','pg_temp'
as $$ select case when p_network='BSC' then lower(trim(p_value)) else trim(p_value) end $$;

create or replace function private.crypto_onchain_invoice_expire()
returns integer language plpgsql security definer set search_path to 'public','private','pg_temp'
as $$
declare v_count integer;
begin
 update public.crypto_onchain_invoices set status='expired',updated_at=now() where status in('awaiting_payment','observed','confirming') and expires_at<=now();
 get diagnostics v_count=row_count;
 update public.crypto_billing_orders set status='expired',updated_at=now() where provider='onchain' and status in('created','pending') and expires_at<=now();
 return v_count;
end $$;

create or replace function private.service_create_crypto_onchain_invoice(p_user_id uuid,p_plan text,p_network_code text)
returns jsonb language plpgsql security definer set search_path to 'public','private','extensions','pg_temp'
as $$
declare
 v_network public.crypto_onchain_networks%rowtype;
 v_asset public.crypto_onchain_assets%rowtype;
 v_na public.crypto_onchain_network_assets%rowtype;
 v_address public.crypto_onchain_receiving_addresses%rowtype;
 v_price public.crypto_onchain_plan_pricing%rowtype;
 v_quote public.crypto_onchain_fx_quotes%rowtype;
 v_invoice_id uuid:=gen_random_uuid();
 v_order_id uuid:=gen_random_uuid();
 v_base numeric(78,0);
 v_disc integer;
 v_expires timestamptz;
begin
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found' using errcode='P0002'; end if;
 if p_plan not in('BASIC','PRO') then raise exception 'Paid plan required' using errcode='22023'; end if;
 select * into v_network from public.crypto_onchain_networks where network_code=p_network_code and status='active' and approved_by_owner;
 if not found then raise exception 'On-chain network is not active' using errcode='55000'; end if;
 select * into v_asset from public.crypto_onchain_assets where selected and status='active';
 if not found then raise exception 'Settlement asset is not active' using errcode='55000'; end if;
 select * into v_na from public.crypto_onchain_network_assets where network_code=p_network_code and asset_code=v_asset.asset_code and enabled and availability_status='available_verified' and verified_at is not null;
 if not found then raise exception 'Settlement asset is unavailable on selected network' using errcode='55000'; end if;
 select * into v_address from public.crypto_onchain_receiving_addresses where network_code=p_network_code and active and verified;
 if not found or not private.crypto_validate_onchain_address(p_network_code,v_address.address) then raise exception 'Receiving address is not ready' using errcode='55000'; end if;
 select * into v_price from public.crypto_onchain_plan_pricing where plan=p_plan and asset_code=v_asset.asset_code and active and approved_at is not null;
 if not found then raise exception 'On-chain pricing is not active' using errcode='55000'; end if;
 if v_price.pricing_mode='fixed_asset' then
   v_base:=v_price.fixed_asset_base_units;
 else
   select * into v_quote from public.crypto_onchain_fx_quotes where fiat_currency=v_price.accounting_currency and asset_code=v_asset.asset_code and expires_at>now() order by observed_at desc limit 1;
   if not found then raise exception 'Fresh settlement quote is unavailable' using errcode='55000'; end if;
   v_base:=ceil(v_price.accounting_amount_minor::numeric*v_quote.asset_base_units/v_quote.fiat_minor_units);
 end if;
 v_disc:=case when v_price.discriminator_max_base_units=0 then 0 else 1+mod((hashtextextended(v_invoice_id::text,7930)&9223372036854775807),v_price.discriminator_max_base_units)::integer end;
 v_expires:=now()+make_interval(secs=>v_price.invoice_ttl_seconds);
 insert into public.crypto_billing_orders(id,user_id,plan,currency,amount_minor,provider,provider_order_id,status,expires_at,metadata,billing_interval,idempotency_key)
 values(v_order_id,p_user_id,p_plan,v_price.accounting_currency,v_price.accounting_amount_minor,'onchain',v_invoice_id::text,'pending',v_expires,jsonb_build_object('settlement_asset',v_asset.asset_code,'network',p_network_code,'invoice_id',v_invoice_id,'automatic_renewal',false),'month',v_invoice_id::text);
 insert into public.crypto_onchain_invoices(id,billing_order_id,user_id,plan,network_code,asset_code,token_identifier,receiving_address,accounting_currency,accounting_amount_minor,base_amount_base_units,discriminator_base_units,expires_at,metadata)
 values(v_invoice_id,v_order_id,p_user_id,p_plan,p_network_code,v_asset.asset_code,v_na.token_identifier,v_address.address,v_price.accounting_currency,v_price.accounting_amount_minor,v_base,v_disc,v_expires,jsonb_build_object('pricing_mode',v_price.pricing_mode,'asset_decimals',v_asset.decimals,'finality_mode',v_network.finality_mode,'required_confirmations',v_network.required_confirmations));
 return jsonb_build_object('ok',true,'invoice_id',v_invoice_id,'billing_order_id',v_order_id,'network_code',p_network_code,'asset_code',v_asset.asset_code,'amount_due_base_units',(v_base+v_disc)::text,'decimals',v_asset.decimals,'receiving_address',v_address.address,'token_identifier',v_na.token_identifier,'expires_at',v_expires,'native_fee_symbol',v_network.native_fee_symbol,'automatic_renewal',false);
end $$;

create or replace function private.service_record_crypto_onchain_observation(p_invoice_id uuid,p_observation jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','private','extensions','pg_temp'
as $$
declare
 v_invoice public.crypto_onchain_invoices%rowtype;
 v_network public.crypto_onchain_networks%rowtype;
 v_order public.crypto_billing_orders%rowtype;
 v_tx text;v_sender text;v_recipient text;v_token text;v_amount numeric(78,0);v_finality text;v_success boolean;v_block text;v_source text;v_hash text;v_status text;v_billing jsonb;v_observed_at timestamptz;
begin
 if p_observation is null or jsonb_typeof(p_observation)<>'object' or length(p_observation::text)>16000 then raise exception 'Invalid chain observation' using errcode='22023'; end if;
 if p_observation::text ~* '"(secret|private[_-]?key|seed|mnemonic|authorization|access[_-]?token)"\s*:' then raise exception 'Sensitive chain data rejected' using errcode='22023'; end if;
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
 v_success=coalesce((p_observation->>'execution_success')::boolean,false);
 if coalesce(p_observation->>'amount_base_units','') !~ '^[0-9]{1,78}$' then raise exception 'Invalid observed amount' using errcode='22023'; end if;
 v_amount=(p_observation->>'amount_base_units')::numeric;
 if v_source !~ '^[a-z0-9][a-z0-9_.-]{1,63}$' then raise exception 'Invalid verifier source' using errcode='22023'; end if;
 if (v_invoice.network_code='BSC' and v_tx !~ '^0x[0-9a-fA-F]{64}$') or (v_invoice.network_code='TRON' and v_tx !~ '^[0-9a-fA-F]{64}$') or (v_invoice.network_code='SOLANA' and v_tx !~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$') then raise exception 'Invalid transaction identifier' using errcode='22023'; end if;
 begin v_observed_at:=coalesce(nullif(p_observation->>'observed_at','')::timestamptz,now()); exception when others then raise exception 'Invalid observation time' using errcode='22023'; end;
 v_hash=encode(extensions.digest(p_observation::text,'sha256'),'hex');
 if exists(select 1 from public.crypto_onchain_tx_observations where network_code=v_invoice.network_code and tx_hash=v_tx and invoice_id<>p_invoice_id) then raise exception 'Transaction already claimed' using errcode='23505'; end if;
 if not v_success then v_status='failed';
 elsif private.crypto_normalize_onchain_value(v_invoice.network_code,v_recipient)<>private.crypto_normalize_onchain_value(v_invoice.network_code,v_invoice.receiving_address) then v_status='wrong_recipient';
 elsif private.crypto_normalize_onchain_value(v_invoice.network_code,v_token)<>private.crypto_normalize_onchain_value(v_invoice.network_code,v_invoice.token_identifier) then v_status='wrong_asset';
 elsif v_finality<>v_network.finality_mode then v_status='confirming';
 elsif v_amount<v_invoice.amount_due_base_units then v_status='underpaid';
 elsif v_amount>v_invoice.amount_due_base_units then v_status='overpaid';
 else v_status='paid'; end if;
 insert into public.crypto_onchain_tx_observations(invoice_id,network_code,tx_hash,sender_address,recipient_address,asset_code,token_identifier,amount_base_units,block_reference,finality_status,execution_success,verifier_source,verifier_evidence_hash,observed_at)
 values(p_invoice_id,v_invoice.network_code,v_tx,v_sender,v_recipient,v_invoice.asset_code,v_token,v_amount,v_block,v_finality,v_success,v_source,v_hash,v_observed_at)
 on conflict(network_code,tx_hash) do nothing;
 update public.crypto_onchain_invoices set status=v_status,tx_hash=v_tx,sender_address=v_sender,block_reference=v_block,finality_status=v_finality,observed_amount_base_units=v_amount,observed_at=v_observed_at,verified_at=case when v_status='paid' then now() else verified_at end,updated_at=now() where id=p_invoice_id;
 if v_status='paid' then
   v_billing:=private.ingest_crypto_billing_event('onchain',lower(v_invoice.network_code)||':'||lower(v_tx),'payment.succeeded',v_invoice.billing_order_id,jsonb_build_object('amount_minor',v_order.amount_minor,'currency',v_order.currency,'provider_order_id',v_invoice.id::text,'period_start',now(),'period_end',now()+interval '30 days','network_code',v_invoice.network_code,'asset_code',v_invoice.asset_code,'tx_hash',v_tx,'sender_address',v_sender,'recipient_address',v_invoice.receiving_address,'token_identifier',v_invoice.token_identifier,'amount_base_units',v_amount::text,'finality_status',v_finality,'block_reference',v_block),now(),true);
   if not coalesce((v_billing->>'ok')::boolean,false) then update public.crypto_onchain_invoices set status='review',updated_at=now() where id=p_invoice_id; end if;
 end if;
 return jsonb_build_object('ok',true,'invoice_id',p_invoice_id,'status',(select status from public.crypto_onchain_invoices where id=p_invoice_id),'billing',coalesce(v_billing,'{}'::jsonb));
end $$;

create or replace function private.get_crypto_admin_onchain_payment_readiness()
returns jsonb language plpgsql stable security definer set search_path to 'public','private','pg_temp'
as $$
begin
 if not public.crypto_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return jsonb_build_object(
  'generated_at',now(),
  'provider',(select to_jsonb(a)-'required_secret_names' from public.crypto_billing_provider_adapters a where provider='onchain'),
  'networks',(select coalesce(jsonb_agg(to_jsonb(n) order by display_order),'[]'::jsonb) from public.crypto_onchain_networks n),
  'assets',(select coalesce(jsonb_agg(to_jsonb(a) order by asset_code),'[]'::jsonb) from public.crypto_onchain_assets a),
  'network_assets',(select coalesce(jsonb_agg(to_jsonb(na) order by network_code,asset_code),'[]'::jsonb) from public.crypto_onchain_network_assets na),
  'receiving_addresses',(select coalesce(jsonb_agg(jsonb_build_object('network_code',network_code,'configured',true,'verified',verified,'active',active,'address_suffix',right(address,6),'updated_at',updated_at) order by network_code),'[]'::jsonb) from public.crypto_onchain_receiving_addresses),
  'pricing',(select coalesce(jsonb_agg(to_jsonb(p) order by plan,asset_code),'[]'::jsonb) from public.crypto_onchain_plan_pricing p),
  'invoice_counts',(select jsonb_build_object('total',count(*),'open',count(*) filter(where status in('awaiting_payment','observed','confirming')),'paid',count(*) filter(where status='paid'),'review',count(*) filter(where status in('underpaid','overpaid','wrong_asset','wrong_recipient','review'))) from public.crypto_onchain_invoices),
  'activation_allowed',false,
  'missing_decisions',jsonb_build_array('SETTLEMENT_ASSET_USDT_OR_USDC','BASIC_PRO_CRYPTO_PRICING','THREE_PUBLIC_RECEIVING_ADDRESSES'),
  'private_keys_required',false
 );
end $$;

create or replace function public.get_crypto_admin_onchain_payment_readiness()
returns jsonb language sql stable security invoker set search_path to 'public','private','pg_temp'
as $$ select private.get_crypto_admin_onchain_payment_readiness(); $$;

create or replace function private.crypto_onchain_immutable_observation()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','pg_temp'
as $$ begin raise exception 'On-chain observation is immutable' using errcode='55000'; end $$;
drop trigger if exists crypto_onchain_observation_immutable on public.crypto_onchain_tx_observations;
create trigger crypto_onchain_observation_immutable before update or delete on public.crypto_onchain_tx_observations for each row execute function private.crypto_onchain_immutable_observation();

create or replace function private.crypto_onchain_receiving_address_guard()
returns trigger language plpgsql security definer set search_path to 'private','pg_catalog','pg_temp'
as $$
begin
 if not private.crypto_validate_onchain_address(new.network_code,new.address) then raise exception 'Invalid receiving address for network' using errcode='22023'; end if;
 if new.active and (not new.verified or new.verified_at is null) then raise exception 'Receiving address must be verified before activation' using errcode='22023'; end if;
 new.updated_at=now();
 return new;
end $$;
drop trigger if exists crypto_onchain_receiving_address_guard on public.crypto_onchain_receiving_addresses;
create trigger crypto_onchain_receiving_address_guard before insert or update on public.crypto_onchain_receiving_addresses for each row execute function private.crypto_onchain_receiving_address_guard();

create or replace function private.crypto_onchain_updated_at()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','pg_temp'
as $$ begin new.updated_at=now();return new;end $$;
do $$
declare t text;
begin
 foreach t in array array['crypto_onchain_networks','crypto_onchain_assets','crypto_onchain_network_assets','crypto_onchain_plan_pricing','crypto_onchain_invoices'] loop
  execute format('drop trigger if exists %I_updated_at on public.%I',t,t);
  execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.crypto_onchain_updated_at()',t,t);
 end loop;
end $$;
