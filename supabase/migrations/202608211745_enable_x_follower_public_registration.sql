update public.crypto_commercial_runtime_flags
set public_registration_enabled=true
where singleton=true and production_launch_authorized=true;

update public.crypto_account_portal_config
set registration_enabled=true, mode='public_free'
where singleton=true;
