-- CRYPTO LAB v79 build 7930
-- Read-only RPC verifier profiles and an isolated payment sandbox.
-- This migration never activates production networks, assets, prices, addresses, checkout, refunds or entitlements.

create table if not exists public.crypto_onchain_verifier_profiles(
  network_code text not null references public.crypto_onchain_networks(network_code) on update cascade on delete restrict,
  environment text not null check(environment in ('sandbox','mainnet')),
  provider_code text not null check(provider_code ~ '^[a-z0-9][a-z0-9_.-]{1,63}$'),
  chain_reference_expected text not null,
  endpoint_mode text not null check(endpoint_mode in ('public_default','secret_required')),
  public_endpoint text,
  endpoint_secret_name text,
  api_key_secret_name text,
  read_only boolean not null default true check(read_only),
  enabled boolean not null default false,
  status text not null check(status in ('prepared','external_input_required','ready','disabled')),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(network_code,environment),
  check((endpoint_mode='public_default' and public_endpoint is not null) or (endpoint_mode='secret_required' and endpoint_secret_name is not null)),
  check(environment<>'mainnet' or not enabled)
);

create table if not exists public.crypto_onchain_verifier_health_runs(
  id bigint generated always as identity primary key,
  network_code text not null,
  environment text not null,
  provider_code text not null,
  ok boolean not null,
  latency_ms integer check(latency_ms between 0 and 120000),
  chain_reference_observed text,
  latest_block_reference text,
  finality_reference text,
  error_code text,
  evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object'),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key(network_code,environment) references public.crypto_onchain_verifier_profiles(network_code,environment) on update cascade on delete restrict
);
create index if not exists crypto_onchain_verifier_health_latest_idx on public.crypto_onchain_verifier_health_runs(network_code,environment,checked_at desc);

create table if not exists public.crypto_onchain_sandbox_cases(
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'sandbox' check(environment='sandbox'),
  network_code text not null,
  asset_code text not null check(asset_code in ('USDT','USDC')),
  token_identifier text,
  token_decimals integer not null default 6 check(token_decimals between 0 and 18),
  recipient_address text not null,
  expected_amount_base_units numeric(78,0) not null check(expected_amount_base_units>0),
  status text not null check(status in ('template','blocked_provider','blocked_token_identifier','ready_for_funding','ready','observed','passed','failed')),
  tx_hash text,
  evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(environment,network_code,asset_code),
  foreign key(network_code,environment) references public.crypto_onchain_verifier_profiles(network_code,environment) on update cascade on delete restrict
);

create table if not exists public.crypto_onchain_sandbox_runs(
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.crypto_onchain_sandbox_cases(id) on update cascade on delete restrict,
  verifier_version text not null,
  status text not null check(status in ('health_only','fixture_pass','fixture_fail','rpc_observed','passed','failed','blocked')),
  tx_hash text,
  normalized_observation jsonb not null default '{}'::jsonb check(jsonb_typeof(normalized_observation)='object'),
  evidence_hash text not null check(evidence_hash ~ '^[0-9a-f]{64}$'),
  error_code text,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  check(completed_at>=started_at)
);
create index if not exists crypto_onchain_sandbox_runs_case_time_idx on public.crypto_onchain_sandbox_runs(case_id,created_at desc);

alter table public.crypto_onchain_verifier_profiles enable row level security;
alter table public.crypto_onchain_verifier_health_runs enable row level security;
alter table public.crypto_onchain_sandbox_cases enable row level security;
alter table public.crypto_onchain_sandbox_runs enable row level security;

revoke all on table public.crypto_onchain_verifier_profiles from public,anon,authenticated;
revoke all on table public.crypto_onchain_verifier_health_runs from public,anon,authenticated;
revoke all on table public.crypto_onchain_sandbox_cases from public,anon,authenticated;
revoke all on table public.crypto_onchain_sandbox_runs from public,anon,authenticated;
grant select,insert,update on table public.crypto_onchain_verifier_profiles to service_role;
grant select,insert on table public.crypto_onchain_verifier_health_runs to service_role;
grant select,insert,update on table public.crypto_onchain_sandbox_cases to service_role;
grant select,insert on table public.crypto_onchain_sandbox_runs to service_role;
grant usage,select on sequence public.crypto_onchain_verifier_health_runs_id_seq to service_role;

create policy crypto_onchain_verifier_profiles_service_only_deny on public.crypto_onchain_verifier_profiles for all to anon,authenticated using(false) with check(false);
create policy crypto_onchain_verifier_health_service_only_deny on public.crypto_onchain_verifier_health_runs for all to anon,authenticated using(false) with check(false);
create policy crypto_onchain_sandbox_cases_service_only_deny on public.crypto_onchain_sandbox_cases for all to anon,authenticated using(false) with check(false);
create policy crypto_onchain_sandbox_runs_service_only_deny on public.crypto_onchain_sandbox_runs for all to anon,authenticated using(false) with check(false);

create or replace function private.crypto_onchain_sandbox_immutable()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','pg_temp' as $$
begin raise exception 'Sandbox evidence is immutable' using errcode='55000'; end $$;
revoke all on function private.crypto_onchain_sandbox_immutable() from public,anon,authenticated;
create trigger crypto_onchain_verifier_health_immutable before update or delete on public.crypto_onchain_verifier_health_runs for each row execute function private.crypto_onchain_sandbox_immutable();
create trigger crypto_onchain_sandbox_runs_immutable before update or delete on public.crypto_onchain_sandbox_runs for each row execute function private.crypto_onchain_sandbox_immutable();

insert into public.crypto_onchain_verifier_profiles(network_code,environment,provider_code,chain_reference_expected,endpoint_mode,public_endpoint,endpoint_secret_name,api_key_secret_name,enabled,status,metadata) values
 ('ETHEREUM','sandbox','ethereum_json_rpc','11155111','secret_required',null,'ETHEREUM_SEPOLIA_RPC_URL',null,false,'external_input_required',jsonb_build_object('network_name','Sepolia','official_reference','https://ethereum.org/developers/docs/networks/')),
 ('TRON','sandbox','trongrid','nile','public_default','https://nile.trongrid.io',null,'TRONGRID_API_KEY',true,'ready',jsonb_build_object('network_name','Nile','api_key_optional_on_testnet',true,'official_reference','https://developers.tron.network/docs/connect-to-the-tron-network')),
 ('SOLANA','sandbox','solana_json_rpc','devnet','public_default','https://api.devnet.solana.com',null,null,true,'ready',jsonb_build_object('network_name','Devnet','official_reference','https://solana.com/docs/references/clusters')),
 ('ETHEREUM','mainnet','ethereum_json_rpc','1','secret_required',null,'ETHEREUM_MAINNET_RPC_URL',null,false,'external_input_required','{"production_use":false}'::jsonb),
 ('TRON','mainnet','trongrid','mainnet','secret_required',null,'TRON_MAINNET_RPC_URL','TRONGRID_API_KEY',false,'external_input_required','{"production_use":false}'::jsonb),
 ('SOLANA','mainnet','solana_json_rpc','mainnet-beta','secret_required',null,'SOLANA_MAINNET_RPC_URL',null,false,'external_input_required','{"production_use":false}'::jsonb)
on conflict(network_code,environment) do update set provider_code=excluded.provider_code,chain_reference_expected=excluded.chain_reference_expected,endpoint_mode=excluded.endpoint_mode,public_endpoint=excluded.public_endpoint,endpoint_secret_name=excluded.endpoint_secret_name,api_key_secret_name=excluded.api_key_secret_name,enabled=case when excluded.environment='mainnet' then false else excluded.enabled end,status=excluded.status,metadata=excluded.metadata,updated_at=now();

insert into public.crypto_onchain_sandbox_cases(environment,network_code,asset_code,token_identifier,token_decimals,recipient_address,expected_amount_base_units,status,evidence)
select 'sandbox','ETHEREUM','USDC','0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',6,address,10000,'blocked_provider',jsonb_build_object('amount_display','0.01 USDC','token_source','Circle official testnet address','funding_required',true,'real_value',false) from public.crypto_onchain_receiving_addresses where network_code='ETHEREUM'
on conflict(environment,network_code,asset_code) do update set recipient_address=excluded.recipient_address,token_identifier=excluded.token_identifier,status=excluded.status,evidence=excluded.evidence,updated_at=now();
insert into public.crypto_onchain_sandbox_cases(environment,network_code,asset_code,token_identifier,token_decimals,recipient_address,expected_amount_base_units,status,evidence)
select 'sandbox','ETHEREUM','USDT',null,6,address,10000,'blocked_token_identifier',jsonb_build_object('amount_display','0.01 test USDT','official_test_token_pending',true,'real_value',false) from public.crypto_onchain_receiving_addresses where network_code='ETHEREUM'
on conflict(environment,network_code,asset_code) do update set recipient_address=excluded.recipient_address,status=excluded.status,evidence=excluded.evidence,updated_at=now();
insert into public.crypto_onchain_sandbox_cases(environment,network_code,asset_code,token_identifier,token_decimals,recipient_address,expected_amount_base_units,status,evidence)
select 'sandbox','TRON','USDT',null,6,address,10000,'blocked_token_identifier',jsonb_build_object('amount_display','0.01 test USDT','official_test_token_pending',true,'real_value',false) from public.crypto_onchain_receiving_addresses where network_code='TRON'
on conflict(environment,network_code,asset_code) do update set recipient_address=excluded.recipient_address,status=excluded.status,evidence=excluded.evidence,updated_at=now();
insert into public.crypto_onchain_sandbox_cases(environment,network_code,asset_code,token_identifier,token_decimals,recipient_address,expected_amount_base_units,status,evidence)
select 'sandbox','SOLANA','USDC','4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',6,address,10000,'ready_for_funding',jsonb_build_object('amount_display','0.01 USDC','token_source','Circle official Solana Devnet mint','funding_required',true,'real_value',false) from public.crypto_onchain_receiving_addresses where network_code='SOLANA'
on conflict(environment,network_code,asset_code) do update set recipient_address=excluded.recipient_address,token_identifier=excluded.token_identifier,status=excluded.status,evidence=excluded.evidence,updated_at=now();
insert into public.crypto_onchain_sandbox_cases(environment,network_code,asset_code,token_identifier,token_decimals,recipient_address,expected_amount_base_units,status,evidence)
select 'sandbox','SOLANA','USDT',null,6,address,10000,'blocked_token_identifier',jsonb_build_object('amount_display','0.01 test USDT','official_test_token_pending',true,'real_value',false) from public.crypto_onchain_receiving_addresses where network_code='SOLANA'
on conflict(environment,network_code,asset_code) do update set recipient_address=excluded.recipient_address,status=excluded.status,evidence=excluded.evidence,updated_at=now();

create or replace function private.service_record_crypto_onchain_verifier_health(p_network text,p_environment text,p_result jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','private','pg_catalog','pg_temp' as $$
declare v_profile public.crypto_onchain_verifier_profiles%rowtype;v_id bigint;v_ok boolean;v_latency integer;v_checked timestamptz;
begin
 if p_result is null or jsonb_typeof(p_result)<>'object' or length(p_result::text)>16000 then raise exception 'Invalid verifier health result' using errcode='22023'; end if;
 if p_result::text ~* '\"(secret|private[_-]?key|seed|mnemonic|authorization|access[_-]?token|api[_-]?key)\"\s*:' then raise exception 'Sensitive verifier data rejected' using errcode='22023'; end if;
 select * into v_profile from public.crypto_onchain_verifier_profiles where network_code=upper(trim(p_network)) and environment=lower(trim(p_environment));
 if not found then raise exception 'Verifier profile not found' using errcode='P0002'; end if;
 v_ok=(p_result->>'ok')::boolean;v_latency=nullif(p_result->>'latency_ms','')::integer;v_checked=coalesce(nullif(p_result->>'checked_at','')::timestamptz,now());
 insert into public.crypto_onchain_verifier_health_runs(network_code,environment,provider_code,ok,latency_ms,chain_reference_observed,latest_block_reference,finality_reference,error_code,evidence,checked_at)
 values(v_profile.network_code,v_profile.environment,v_profile.provider_code,v_ok,v_latency,left(nullif(p_result->>'chain_reference_observed',''),120),left(nullif(p_result->>'latest_block_reference',''),200),left(nullif(p_result->>'finality_reference',''),200),left(nullif(p_result->>'error_code',''),80),coalesce(p_result->'evidence','{}'::jsonb),v_checked) returning id into v_id;
 return jsonb_build_object('ok',true,'health_run_id',v_id,'network_code',v_profile.network_code,'environment',v_profile.environment,'healthy',v_ok);
end $$;

create or replace function private.service_record_crypto_onchain_sandbox_run(p_case_id uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','private','extensions','pg_catalog','pg_temp' as $$
declare v_case public.crypto_onchain_sandbox_cases%rowtype;v_status text;v_tx text;v_started timestamptz;v_completed timestamptz;v_hash text;v_id uuid;
begin
 if p_result is null or jsonb_typeof(p_result)<>'object' or length(p_result::text)>32000 then raise exception 'Invalid sandbox result' using errcode='22023'; end if;
 if p_result::text ~* '\"(secret|private[_-]?key|seed|mnemonic|authorization|access[_-]?token|api[_-]?key)\"\s*:' then raise exception 'Sensitive sandbox data rejected' using errcode='22023'; end if;
 select * into v_case from public.crypto_onchain_sandbox_cases where id=p_case_id for update;if not found then raise exception 'Sandbox case not found' using errcode='P0002'; end if;
 v_status=lower(trim(coalesce(p_result->>'status','blocked')));if v_status not in('health_only','fixture_pass','fixture_fail','rpc_observed','passed','failed','blocked') then raise exception 'Invalid sandbox run status' using errcode='22023'; end if;
 v_tx=nullif(trim(coalesce(p_result->>'tx_hash','')),'');if v_tx is not null and not private.crypto_validate_onchain_tx_hash(v_case.network_code,v_tx) then raise exception 'Invalid sandbox transaction identifier' using errcode='22023'; end if;
 v_started=coalesce(nullif(p_result->>'started_at','')::timestamptz,now());v_completed=coalesce(nullif(p_result->>'completed_at','')::timestamptz,now());if v_completed<v_started or v_completed>now()+interval '5 minutes' then raise exception 'Invalid sandbox run interval' using errcode='22023'; end if;
 v_hash=encode(extensions.digest(convert_to(p_result::text,'UTF8'),'sha256'),'hex');
 insert into public.crypto_onchain_sandbox_runs(case_id,verifier_version,status,tx_hash,normalized_observation,evidence_hash,error_code,started_at,completed_at)
 values(p_case_id,left(coalesce(nullif(p_result->>'verifier_version',''),'unknown'),80),v_status,v_tx,coalesce(p_result->'normalized_observation','{}'::jsonb),v_hash,left(nullif(p_result->>'error_code',''),80),v_started,v_completed) returning id into v_id;
 update public.crypto_onchain_sandbox_cases set status=case when v_status='passed' then 'passed' when v_status in('failed','fixture_fail') then 'failed' when v_status='rpc_observed' then 'observed' else status end,tx_hash=coalesce(v_tx,tx_hash),updated_at=now() where id=p_case_id;
 return jsonb_build_object('ok',true,'sandbox_run_id',v_id,'case_id',p_case_id,'status',v_status,'entitlement_changed',false,'billing_changed',false);
end $$;

create or replace function private.get_crypto_admin_onchain_sandbox_readiness()
returns jsonb language plpgsql stable security definer set search_path to 'public','private','pg_temp' as $$
begin
 if not public.crypto_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return jsonb_build_object('generated_at',now(),'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.environment,n.display_order,p.network_code),'[]'::jsonb) from public.crypto_onchain_verifier_profiles p join public.crypto_onchain_networks n using(network_code)),'latest_health',(select coalesce(jsonb_agg(to_jsonb(x) order by x.environment,x.network_code),'[]'::jsonb) from(select distinct on(network_code,environment)* from public.crypto_onchain_verifier_health_runs order by network_code,environment,checked_at desc)x),'cases',(select coalesce(jsonb_agg(to_jsonb(c) order by c.network_code,c.asset_code),'[]'::jsonb) from public.crypto_onchain_sandbox_cases c),'run_counts',(select jsonb_build_object('total',count(*),'passed',count(*) filter(where status='passed'),'failed',count(*) filter(where status in('failed','fixture_fail'))) from public.crypto_onchain_sandbox_runs),'boundaries',jsonb_build_object('production_profiles_enabled',false,'payment_activation_authorized',false,'checkout_enabled',false,'real_invoices_touched',false,'subscriptions_touched',false,'private_keys_required',false));
end $$;

create or replace function public.service_record_crypto_onchain_verifier_health(p_network text,p_environment text,p_result jsonb) returns jsonb language sql security invoker set search_path to 'public','private','pg_temp' as $$select private.service_record_crypto_onchain_verifier_health(p_network,p_environment,p_result)$$;
create or replace function public.service_record_crypto_onchain_sandbox_run(p_case_id uuid,p_result jsonb) returns jsonb language sql security invoker set search_path to 'public','private','pg_temp' as $$select private.service_record_crypto_onchain_sandbox_run(p_case_id,p_result)$$;
create or replace function public.get_crypto_admin_onchain_sandbox_readiness() returns jsonb language sql stable security invoker set search_path to 'public','private','pg_temp' as $$select private.get_crypto_admin_onchain_sandbox_readiness()$$;

revoke all on function private.service_record_crypto_onchain_verifier_health(text,text,jsonb) from public,anon,authenticated;
revoke all on function private.service_record_crypto_onchain_sandbox_run(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.get_crypto_admin_onchain_sandbox_readiness() from public,anon,authenticated;
revoke all on function public.service_record_crypto_onchain_verifier_health(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.service_record_crypto_onchain_sandbox_run(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.get_crypto_admin_onchain_sandbox_readiness() from public,anon;
grant execute on function public.service_record_crypto_onchain_verifier_health(text,text,jsonb) to service_role;
grant execute on function public.service_record_crypto_onchain_sandbox_run(uuid,jsonb) to service_role;
grant execute on function public.get_crypto_admin_onchain_sandbox_readiness() to authenticated,service_role;

update public.crypto_launch_requirements set evidence=evidence||jsonb_build_object('isolated_sandbox_prepared',true,'sandbox_tables_separate_from_billing',true,'sandbox_cannot_grant_entitlement',true,'ethereum_sandbox_network','Sepolia','ethereum_rpc_secret_required','ETHEREUM_SEPOLIA_RPC_URL','tron_sandbox_network','Nile','tron_public_rpc','https://nile.trongrid.io','solana_sandbox_network','Devnet','solana_public_rpc','https://api.devnet.solana.com','sandbox_case_count',(select count(*) from public.crypto_onchain_sandbox_cases),'official_test_usdc_pairs',jsonb_build_array('ETHEREUM_SEPOLIA_USDC','SOLANA_DEVNET_USDC'),'live_transfer_execution_authorized',false,'production_payment_activation',false),operator_note='Isolated read-only RPC verifier and sandbox case registry are prepared. The sandbox remains blocked by the owner activation boundary. Ethereum Sepolia RPC URL and test-token funding are still external inputs. Sandbox runs cannot create billing events or subscriptions.',updated_at=now() where code='PAYMENT_SANDBOX_E2E';
update public.crypto_launch_requirements set evidence=evidence||jsonb_build_object('rpc_verifier_profiles_prepared',true,'sandbox_profiles',3,'mainnet_profiles_disabled',3,'rpc_or_indexer_configuration_pending',true,'ethereum_sepolia_rpc_pending',true,'tron_nile_profile_ready',true,'solana_devnet_profile_ready',true),operator_note='All receiving addresses are verified inactive. Read-only verifier profiles are prepared; Ethereum Sepolia and all production RPC endpoints still require external provider configuration.',updated_at=now() where code='MERCHANT_CREDENTIALS';

do $$begin
 if exists(select 1 from public.crypto_onchain_verifier_profiles where environment='mainnet' and enabled) then raise exception 'Mainnet verifier profile activated'; end if;
 if exists(select 1 from public.crypto_onchain_receiving_addresses where active) or exists(select 1 from public.crypto_onchain_plan_pricing where active) or exists(select 1 from public.crypto_onchain_networks where status='active') or exists(select 1 from public.crypto_onchain_network_assets where enabled) then raise exception 'Payment activation boundary changed'; end if;
 if exists(select 1 from public.crypto_billing_provider_adapters where provider='onchain' and(checkout_enabled or webhook_enabled or recurring_enabled or refunds_enabled)) then raise exception 'Payment adapter activation boundary changed'; end if;
 if exists(select 1 from public.crypto_onchain_invoices) or exists(select 1 from public.crypto_onchain_tx_claims) or exists(select 1 from public.crypto_onchain_tx_observations) then raise exception 'Production payment records unexpectedly exist'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name in('crypto_onchain_sandbox_cases','crypto_onchain_sandbox_runs') and column_name in('user_id','billing_order_id','invoice_id','subscription_id')) then raise exception 'Sandbox is coupled to billing or entitlement tables'; end if;
end $$;