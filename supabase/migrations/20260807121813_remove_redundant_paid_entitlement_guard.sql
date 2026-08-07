drop trigger if exists crypto_paid_entitlement_runtime_guard_trg on public.crypto_subscriptions;
drop function if exists private.crypto_paid_entitlement_runtime_guard();
comment on function private.guard_crypto_paid_subscription_activation() is 'Authoritative fail-closed guard for BASIC/PRO entitlement activation and scheduled paid-plan changes. Enforces crypto_commercial_runtime_flags.paid_entitlement_enabled and requires a future paid period end.';
