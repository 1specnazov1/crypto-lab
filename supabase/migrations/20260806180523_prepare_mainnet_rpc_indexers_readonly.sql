-- Prepare Ethereum, Solana, and TRON mainnet verification infrastructure.
-- This migration is intentionally read-only and inactive: no payment acceptance,
-- transaction broadcast, pricing, registration, or entitlement activation.

create table if not exists public.crypto_onchain_rpc_method_policies (
  network_code text not null references public.crypto_onchain_networks(network_code) on update cascade on delete restrict,
  environment text not null check (environment in ('sandbox','mainnet')),
  rpc_method text not null,
  access_mode text not null check (access_mode in ('allow_read','deny_write')),
  enabled boolean not null default true,
  rationale text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (network_code,environment,rpc_method)
);

alter table public.crypto_onchain_rpc_method_policies enable row level security;
revoke all on public.crypto_onchain_rpc_method_policies from anon, authenticated;
grant select,insert,update,delete on public.crypto_onchain_rpc_method_policies to service_role;

create table if not exists public.crypto_onchain_indexer_profiles (
  network_code text not null references public.crypto_onchain_networks(network_code) on update cascade on delete restrict,
  environment text not null check (environment in ('sandbox','mainnet')),
  provider_code text not null check (provider_code ~ '^[a-z0-9][a-z0-9_.-]{1,63}$'),
  strategy text not null check (strategy in ('rpc_polling','provider_webhook','hybrid')),
  endpoint_secret_name text,
  api_key_secret_name text,
  read_only boolean not null default true check (read_only),
  enabled boolean not null default false,
  status text not null check (status in ('prepared','external_input_required','ready','disabled')),
  poll_interval_seconds integer not null default 30 check (poll_interval_seconds between 5 and 3600),
  confirmation_policy jsonb not null default '{}'::jsonb check (jsonb_typeof(confirmation_policy)='object'),
  cursor_state jsonb not null default '{}'::jsonb check (jsonb_typeof(cursor_state)='object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (network_code,environment),
  check (environment <> 'mainnet' or enabled = false)
);

alter table public.crypto_onchain_indexer_profiles enable row level security;
revoke all on public.crypto_onchain_indexer_profiles from anon, authenticated;
grant select,insert,update,delete on public.crypto_onchain_indexer_profiles to service_role;

insert into public.crypto_onchain_rpc_method_policies
(network_code,environment,rpc_method,access_mode,rationale,metadata)
values
('ETHEREUM','mainnet','eth_chainId','allow_read','Verify expected Ethereum mainnet chain id.','{"category":"identity"}'),
('ETHEREUM','mainnet','eth_blockNumber','allow_read','Read the latest block height.','{"category":"head"}'),
('ETHEREUM','mainnet','eth_getBlockByNumber','allow_read','Read block metadata for confirmation depth.','{"category":"finality"}'),
('ETHEREUM','mainnet','eth_getTransactionByHash','allow_read','Read transaction identity and payload.','{"category":"transaction"}'),
('ETHEREUM','mainnet','eth_getTransactionReceipt','allow_read','Read execution result and block inclusion.','{"category":"receipt"}'),
('ETHEREUM','mainnet','eth_getLogs','allow_read','Read ERC-20 Transfer events.','{"category":"token_transfer"}'),
('ETHEREUM','mainnet','eth_call','allow_read','Read token metadata and balances without mutation.','{"category":"contract_read"}'),
('ETHEREUM','mainnet','eth_sendRawTransaction','deny_write','Transaction broadcast is forbidden.','{"hard_deny":true}'),
('ETHEREUM','mainnet','eth_sendTransaction','deny_write','Wallet-managed transfer submission is forbidden.','{"hard_deny":true}'),
('ETHEREUM','mainnet','personal_sendTransaction','deny_write','Personal namespace transaction submission is forbidden.','{"hard_deny":true}'),
('SOLANA','mainnet','getGenesisHash','allow_read','Verify Solana mainnet identity.','{"category":"identity"}'),
('SOLANA','mainnet','getHealth','allow_read','Read RPC health state.','{"category":"health"}'),
('SOLANA','mainnet','getSlot','allow_read','Read finalized slot progress.','{"category":"head"}'),
('SOLANA','mainnet','getBlock','allow_read','Read finalized block metadata.','{"category":"finality"}'),
('SOLANA','mainnet','getTransaction','allow_read','Read confirmed transaction details.','{"category":"transaction"}'),
('SOLANA','mainnet','getSignatureStatuses','allow_read','Read signature finality.','{"category":"finality"}'),
('SOLANA','mainnet','getSignaturesForAddress','allow_read','Discover candidate transfers.','{"category":"indexing"}'),
('SOLANA','mainnet','getTokenAccountsByOwner','allow_read','Resolve token accounts.','{"category":"token_account"}'),
('SOLANA','mainnet','sendTransaction','deny_write','Transaction broadcast is forbidden.','{"hard_deny":true}'),
('SOLANA','mainnet','requestAirdrop','deny_write','Airdrop is forbidden in commercial mainnet infrastructure.','{"hard_deny":true}'),
('TRON','mainnet','wallet/getnowblock','allow_read','Read current full-node block.','{"category":"head"}'),
('TRON','mainnet','walletsolidity/getnowblock','allow_read','Read confirmed solidified block.','{"category":"finality"}'),
('TRON','mainnet','wallet/gettransactionbyid','allow_read','Read transaction payload.','{"category":"transaction"}'),
('TRON','mainnet','walletsolidity/gettransactioninfobyid','allow_read','Read confirmed transaction result.','{"category":"receipt"}'),
('TRON','mainnet','wallet/triggerconstantcontract','allow_read','Execute constant contract reads only.','{"category":"contract_read"}'),
('TRON','mainnet','wallet/broadcasttransaction','deny_write','Transaction broadcast is forbidden.','{"hard_deny":true}'),
('TRON','mainnet','wallet/broadcasthex','deny_write','Raw transaction broadcast is forbidden.','{"hard_deny":true}'),
('TRON','mainnet','wallet/createtransaction','deny_write','Value-transfer construction is forbidden.','{"hard_deny":true}'),
('TRON','mainnet','wallet/triggersmartcontract','deny_write','State-changing contract construction is forbidden.','{"hard_deny":true}')
on conflict (network_code,environment,rpc_method) do update
set access_mode=excluded.access_mode,rationale=excluded.rationale,metadata=excluded.metadata,enabled=true,updated_at=now();

insert into public.crypto_onchain_indexer_profiles
(network_code,environment,provider_code,strategy,endpoint_secret_name,api_key_secret_name,read_only,enabled,status,poll_interval_seconds,confirmation_policy,metadata)
values
('ETHEREUM','mainnet','ethereum_json_rpc','rpc_polling','ETHEREUM_MAINNET_RPC_URL',null,true,false,'external_input_required',30,
 '{"finality":"finalized_tag_plus_depth","required_confirmations":64}',
 '{"production_use":false,"write_rpc_forbidden":true,"activation_authorized":false,"required_external_input":["dedicated_rpc_url"]}'),
('SOLANA','mainnet','solana_json_rpc','rpc_polling','SOLANA_MAINNET_RPC_URL',null,true,false,'external_input_required',20,
 '{"commitment":"finalized","required_confirmations":32}',
 '{"production_use":false,"write_rpc_forbidden":true,"activation_authorized":false,"required_external_input":["dedicated_rpc_url"]}'),
('TRON','mainnet','trongrid','rpc_polling','TRON_MAINNET_RPC_URL','TRONGRID_API_KEY',true,false,'external_input_required',30,
 '{"state":"walletsolidity","required_confirmations":20}',
 '{"production_use":false,"write_rpc_forbidden":true,"activation_authorized":false,"required_external_input":["trongrid_api_key","dedicated_rpc_url"]}')
on conflict (network_code,environment) do update
set provider_code=excluded.provider_code,strategy=excluded.strategy,
    endpoint_secret_name=excluded.endpoint_secret_name,api_key_secret_name=excluded.api_key_secret_name,
    read_only=true,enabled=false,status='external_input_required',
    poll_interval_seconds=excluded.poll_interval_seconds,confirmation_policy=excluded.confirmation_policy,
    metadata=excluded.metadata,updated_at=now();

update public.crypto_onchain_verifier_profiles
set metadata = metadata || case network_code
  when 'ETHEREUM' then '{"production_use":false,"activation_authorized":false,"write_rpc_forbidden":true,"public_smoke_only":true,"public_smoke_endpoint":"https://ethereum-rpc.publicnode.com","public_smoke_method":"eth_chainId","public_smoke_observed":"1","public_smoke_http_status":200,"dedicated_endpoint_required":true,"official_rpc_reference":"https://ethereum.org/en/developers/apis/json-rpc/"}'::jsonb
  when 'SOLANA' then '{"production_use":false,"activation_authorized":false,"write_rpc_forbidden":true,"public_smoke_only":true,"public_smoke_endpoint":"https://api.mainnet.solana.com","public_smoke_method":"getGenesisHash","public_smoke_observed":"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d","public_smoke_http_status":200,"dedicated_endpoint_required":true,"official_rpc_reference":"https://solana.com/docs/core/clusters"}'::jsonb
  when 'TRON' then '{"production_use":false,"activation_authorized":false,"write_rpc_forbidden":true,"public_smoke_only":true,"public_smoke_endpoint":"https://api.trongrid.io","public_smoke_method":"walletsolidity/getnowblock","public_smoke_observed_block":"80516084","public_smoke_http_status":200,"dedicated_endpoint_required":true,"api_key_required_for_production":true,"official_rpc_reference":"https://developers.tron.network/docs/trongrid"}'::jsonb
  else '{}'::jsonb end,
  read_only=true,enabled=false,status='external_input_required',updated_at=now()
where environment='mainnet' and network_code in ('ETHEREUM','SOLANA','TRON');

insert into public.crypto_onchain_verifier_health_runs
(network_code,environment,provider_code,ok,latency_ms,chain_reference_observed,latest_block_reference,finality_reference,error_code,evidence,checked_at)
values
('ETHEREUM','mainnet','ethereum_json_rpc',true,null,'1',null,null,null,
 '{"probe_class":"public_smoke","method":"eth_chainId","http_status":200,"result":"0x1","production_endpoint_used":false,"write_method_used":false}',now()),
('SOLANA','mainnet','solana_json_rpc',true,null,'mainnet-beta',null,'genesis_hash',null,
 '{"probe_class":"public_smoke","method":"getGenesisHash","http_status":200,"result":"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d","production_endpoint_used":false,"write_method_used":false}',now()),
('TRON','mainnet','trongrid',true,null,'mainnet','80516084','walletsolidity',null,
 '{"probe_class":"public_smoke","method":"walletsolidity/getnowblock","http_status":200,"block_id":"0000000004cc93f4ba507793ce4011112c5a68606e8684fb25a0361ed9bcaa7a","production_endpoint_used":false,"write_method_used":false}',now());

do $$
begin
  if exists (select 1 from public.crypto_onchain_verifier_profiles where environment='mainnet' and (enabled or not read_only or status <> 'external_input_required')) then
    raise exception 'Mainnet verifier boundary changed';
  end if;
  if exists (select 1 from public.crypto_onchain_indexer_profiles where environment='mainnet' and (enabled or not read_only)) then
    raise exception 'Mainnet indexer boundary changed';
  end if;
  if exists (select 1 from public.crypto_onchain_networks where network_code in ('ETHEREUM','TRON','SOLANA') and (status <> 'inactive' or coalesce((metadata->>'activation_authorized')::boolean,false))) then
    raise exception 'Network activation boundary changed';
  end if;
  if exists (select 1 from public.crypto_onchain_plan_pricing where active) then
    raise exception 'Plan pricing activation boundary changed';
  end if;
  if exists (select 1 from public.crypto_onchain_receiving_addresses where active) then
    raise exception 'Receiving address activation boundary changed';
  end if;
end $$;
