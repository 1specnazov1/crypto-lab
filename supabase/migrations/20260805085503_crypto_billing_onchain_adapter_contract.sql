alter table public.crypto_billing_provider_adapters drop constraint if exists crypto_billing_provider_adapters_provider_check;
alter table public.crypto_billing_provider_adapters add constraint crypto_billing_provider_adapters_provider_check check(provider in('manual','liqpay','stripe','onchain'));
alter table public.crypto_billing_provider_adapters drop constraint if exists crypto_billing_provider_adapters_checkout_strategy_check;
alter table public.crypto_billing_provider_adapters add constraint crypto_billing_provider_adapters_checkout_strategy_check check(checkout_strategy in('manual_review','hosted_redirect','checkout_session','wallet_transaction'));
alter table public.crypto_billing_provider_adapters drop constraint if exists crypto_billing_provider_adapters_webhook_strategy_check;
alter table public.crypto_billing_provider_adapters add constraint crypto_billing_provider_adapters_webhook_strategy_check check(webhook_strategy in('none','signed_form_callback','signed_raw_body','verified_chain_observation'));
