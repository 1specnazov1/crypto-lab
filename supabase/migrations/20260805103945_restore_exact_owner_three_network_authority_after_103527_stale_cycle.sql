-- CRYPTO LAB v79 build 7930
-- Restore the exact owner decision after stale concurrent migration 20260805103527.
-- Exact text: «Три сети утверждаю.»
-- UTF-8 SHA-256: 57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be
-- Scope: exactly TRON, BSC and SOLANA are approved but inactive.
-- No asset, pricing, address, sandbox transfer, checkout, recurring debit, refund or publication is enabled.

drop trigger if exists crypto_payment_owner_authority_event_fail_closed on public.crypto_owner_decision_authority_events;
alter table public.crypto_owner_decision_authority_events drop constraint if exists crypto_owner_authority_event_payment_fail_closed;
drop function if exists private.block_crypto_payment_owner_authority_event();

do $$
declare v_sql text;
begin
  select statements[1] into v_sql
  from supabase_migrations.schema_migrations
  where version='20260805100805'
    and name='final_lock_explicit_owner_three_network_selection';
  if v_sql is null then
    raise exception 'Canonical migration 20260805100805 not found';
  end if;
  execute v_sql;
end $$;

update public.crypto_billing_provider_adapters
set desired_mode='disabled', lifecycle_status='draft', checkout_enabled=false,
    webhook_enabled=false, recurring_enabled=false, refunds_enabled=false,
    last_verified_at=null, last_error_code=null,
    last_verification=jsonb_build_object(
      'state','owner_approved_networks_inactive',
      'decision_code','ONCHAIN_THREE_NETWORK_SELECTION',
      'decision_hash','57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be',
      'approved_networks',jsonb_build_array('TRON','BSC','SOLANA'),
      'owner_network_decision_recorded',true,
      'owner_provider_decision_recorded',false,
      'settlement_asset_selected',false,
      'pricing_active',false,
      'receiving_addresses_active',false,
      'automatic_entitlement_enabled',false,
      'activation_allowed',false,
      'concurrency_race_repaired',true,
      'superseded_stale_migration','20260805103527_authoritative_candidate_only_recovery_after_103010',
      'canonical_authority_migration','restore_exact_owner_three_network_authority_after_103527_stale_cycle'
    ), updated_at=now()
where provider='onchain';

do $$
declare v_bad integer;
begin
  select count(*) into v_bad from public.crypto_onchain_networks
  where network_code in('TRON','BSC','SOLANA') and not (approved_by_owner and status='inactive');
  if v_bad<>0 then raise exception 'Network state assertion failed: %',v_bad; end if;
  if (select count(*) from public.crypto_owner_decision_records where decision_code='ONCHAIN_THREE_NETWORK_SELECTION' and active)<>1 then raise exception 'Owner decision assertion failed'; end if;
  if (select count(*) from public.crypto_owner_decision_authority_events where decision_code='ONCHAIN_THREE_NETWORK_SELECTION' and authority_state='effective')<>1 then raise exception 'Authority event assertion failed'; end if;
  if exists(select 1 from public.crypto_billing_provider_adapters where provider='onchain' and (desired_mode<>'disabled' or lifecycle_status<>'draft' or checkout_enabled or webhook_enabled or recurring_enabled or refunds_enabled)) then raise exception 'Adapter boundary assertion failed'; end if;
  if (select count(*) from public.crypto_onchain_networks where status='active')<>0
     or (select count(*) from public.crypto_onchain_assets where selected)<>0
     or (select count(*) from public.crypto_onchain_plan_pricing where active)<>0
     or (select count(*) from public.crypto_onchain_receiving_addresses)<>0
     or (select count(*) from public.crypto_onchain_invoices)<>0
     or (select count(*) from public.crypto_onchain_tx_claims)<>0
     or (select count(*) from public.crypto_onchain_tx_observations)<>0 then
    raise exception 'Zero-payment-data assertion failed';
  end if;
end $$;
