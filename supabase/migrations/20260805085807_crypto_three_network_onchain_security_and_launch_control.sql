alter table public.crypto_onchain_networks enable row level security;
alter table public.crypto_onchain_assets enable row level security;
alter table public.crypto_onchain_network_assets enable row level security;
alter table public.crypto_onchain_receiving_addresses enable row level security;
alter table public.crypto_onchain_plan_pricing enable row level security;
alter table public.crypto_onchain_fx_quotes enable row level security;
alter table public.crypto_onchain_invoices enable row level security;
alter table public.crypto_onchain_tx_observations enable row level security;

do $$
declare t text;
begin
 foreach t in array array['crypto_onchain_networks','crypto_onchain_assets','crypto_onchain_network_assets','crypto_onchain_receiving_addresses','crypto_onchain_plan_pricing','crypto_onchain_fx_quotes','crypto_onchain_invoices','crypto_onchain_tx_observations'] loop
  execute format('revoke all on table public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on table public.%I to service_role',t);
  execute format('drop policy if exists %I_direct_deny on public.%I',t,t);
  execute format('create policy %I_direct_deny on public.%I as restrictive for all to anon,authenticated using(false) with check(false)',t,t);
 end loop;
end $$;

grant usage,select on all sequences in schema public to service_role;
revoke all on function private.crypto_validate_onchain_address(text,text) from public,anon,authenticated;
revoke all on function private.crypto_normalize_onchain_value(text,text) from public,anon,authenticated;
revoke all on function private.crypto_onchain_invoice_expire() from public,anon,authenticated;
revoke all on function private.service_create_crypto_onchain_invoice(uuid,text,text) from public,anon,authenticated;
revoke all on function private.service_record_crypto_onchain_observation(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.get_crypto_admin_onchain_payment_readiness() from public,anon,authenticated;
revoke all on function public.get_crypto_admin_onchain_payment_readiness() from public,anon;
grant execute on function private.crypto_onchain_invoice_expire() to service_role;
grant execute on function private.service_create_crypto_onchain_invoice(uuid,text,text) to service_role;
grant execute on function private.service_record_crypto_onchain_observation(uuid,jsonb) to service_role;
grant execute on function private.get_crypto_admin_onchain_payment_readiness() to authenticated,service_role;
grant execute on function public.get_crypto_admin_onchain_payment_readiness() to authenticated;

select private.service_update_crypto_launch_requirement(
 'PAYMENT_PROVIDER','in_progress',
 jsonb_build_object('provider','onchain_direct','wallet','trust_wallet_walletconnect','approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),'settlement_asset','pending'),
 jsonb_build_object('foundation_schema',true,'automatic_entitlement_path',true,'private_keys_required',false,'network_activation',false,'bsc_asset_contract_review_required',true),
 'Owner approved three networks. Settlement asset, pricing and receiving addresses remain pending; all on-chain routes are disabled.'
);
select private.service_update_crypto_launch_requirement(
 'MERCHANT_CREDENTIALS','blocked_dependency','{}'::jsonb,
 jsonb_build_object('required_public_addresses',jsonb_build_array('TRON','BSC','SOLANA'),'private_keys_required',false,'addresses_configured',false),
 'For direct on-chain payments this requirement means three verified public receiving addresses plus verifier/RPC configuration. Never provide seed phrases or private keys.'
);
select private.service_update_crypto_launch_requirement(
 'PAYMENT_SANDBOX_E2E','blocked_dependency','{}'::jsonb,
 jsonb_build_object('onchain_foundation',true,'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),'scenarios_extended',jsonb_build_array('wrong_network','wrong_asset','underpayment','overpayment','duplicate_tx_hash','unfinalized_tx','reorg_or_nonfinal_tx','expired_invoice'),'activation',false),
 'Provider-neutral billing matrix will be extended with three-network on-chain verification scenarios after asset, pricing and addresses are approved.'
);
