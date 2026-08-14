-- CRYPTO LAB v79 — exact Scanner v15 market-universe archive.
-- Production applied on 2026-08-14. This archive is required by SCANNER_V15_EXACT backtests.

create table if not exists public.crypto_scanner_market_snapshot_batches (
  batch_id uuid primary key,
  captured_at timestamptz not null,
  scanner_version integer not null check (scanner_version > 0),
  market_limit integer not null check (market_limit between 1 and 100),
  eligible_count integer not null check (eligible_count between 0 and market_limit),
  created_at timestamptz not null default now()
);

create index if not exists crypto_scanner_market_snapshot_batches_captured_idx
  on public.crypto_scanner_market_snapshot_batches(captured_at desc);

alter table public.crypto_scanner_market_snapshot_batches enable row level security;
revoke all on public.crypto_scanner_market_snapshot_batches from anon, authenticated;

create or replace function public.service_store_crypto_scanner_market_snapshot(
  p_batch_id uuid,
  p_captured_at timestamptz,
  p_scanner_version integer,
  p_market_limit integer,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_count integer;
begin
  if p_batch_id is null or p_captured_at is null then raise exception 'snapshot batch metadata required' using errcode='22023'; end if;
  if p_scanner_version <> 15 then raise exception 'unsupported scanner version' using errcode='22023'; end if;
  if p_market_limit <> 20 then raise exception 'market_limit must match Scanner v15 production limit' using errcode='22023'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be a JSON array' using errcode='22023'; end if;
  v_count := jsonb_array_length(p_rows);
  if v_count > p_market_limit then raise exception 'snapshot rows exceed market limit' using errcode='22023'; end if;

  insert into public.crypto_scanner_market_snapshot_batches(batch_id,captured_at,scanner_version,market_limit,eligible_count)
  values(p_batch_id,p_captured_at,p_scanner_version,p_market_limit,v_count);

  insert into public.crypto_scanner_market_snapshots(batch_id,captured_at,symbol,liquidity_rank,quote_volume,range_pct,change_pct,eligible)
  select
    p_batch_id,
    p_captured_at,
    upper(trim(x.symbol)),
    x.liquidity_rank,
    x.quote_volume,
    x.range_pct,
    x.change_pct,
    true
  from jsonb_to_recordset(p_rows) as x(
    symbol text,
    liquidity_rank integer,
    quote_volume numeric,
    range_pct numeric,
    change_pct numeric
  )
  where upper(trim(x.symbol)) ~ '^[A-Z0-9]{2,20}$'
    and x.liquidity_rank between 1 and p_market_limit
    and x.quote_volume > 0;

  if (select count(*) from public.crypto_scanner_market_snapshots where batch_id=p_batch_id) <> v_count then
    raise exception 'snapshot row validation mismatch' using errcode='23514';
  end if;

  return jsonb_build_object('ok',true,'batch_id',p_batch_id,'captured_at',p_captured_at,'eligible_count',v_count);
end;
$function$;

revoke all on function public.service_store_crypto_scanner_market_snapshot(uuid,timestamptz,integer,integer,jsonb) from public, anon, authenticated;
grant execute on function public.service_store_crypto_scanner_market_snapshot(uuid,timestamptz,integer,integer,jsonb) to service_role;
