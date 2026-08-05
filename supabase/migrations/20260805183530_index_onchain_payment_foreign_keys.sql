create index if not exists crypto_onchain_fx_quotes_asset_code_idx
  on public.crypto_onchain_fx_quotes(asset_code);
create index if not exists crypto_onchain_invoices_asset_code_idx
  on public.crypto_onchain_invoices(asset_code);
create index if not exists crypto_onchain_invoices_plan_idx
  on public.crypto_onchain_invoices(plan);
create index if not exists crypto_onchain_network_assets_asset_code_idx
  on public.crypto_onchain_network_assets(asset_code);
create index if not exists crypto_onchain_plan_pricing_asset_code_idx
  on public.crypto_onchain_plan_pricing(asset_code);
create index if not exists crypto_onchain_tx_observations_invoice_id_idx
  on public.crypto_onchain_tx_observations(invoice_id);
create index if not exists crypto_onchain_tx_observations_network_asset_idx
  on public.crypto_onchain_tx_observations(network_code,asset_code);

do $$
begin
  if (select count(*) from pg_indexes where schemaname='public' and indexname in(
    'crypto_onchain_fx_quotes_asset_code_idx','crypto_onchain_invoices_asset_code_idx',
    'crypto_onchain_invoices_plan_idx','crypto_onchain_network_assets_asset_code_idx',
    'crypto_onchain_plan_pricing_asset_code_idx','crypto_onchain_tx_observations_invoice_id_idx',
    'crypto_onchain_tx_observations_network_asset_idx'))<>7 then
    raise exception 'On-chain foreign-key index assertion failed';
  end if;
end $$;
