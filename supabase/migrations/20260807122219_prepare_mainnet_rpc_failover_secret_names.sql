update public.crypto_onchain_verifier_profiles
set metadata = metadata || case network_code
  when 'ETHEREUM' then jsonb_build_object(
    'primary_endpoint_secret_name','ETHEREUM_MAINNET_RPC_URL',
    'fallback_endpoint_secret_name','ETHEREUM_MAINNET_RPC_FALLBACK_URL',
    'health_probe_version','7930-mainnet-health2',
    'failover_mode','read_only_health_prelaunch',
    'failover_activation_authorized',false
  )
  when 'SOLANA' then jsonb_build_object(
    'primary_endpoint_secret_name','SOLANA_MAINNET_RPC_URL',
    'fallback_endpoint_secret_name','SOLANA_MAINNET_RPC_FALLBACK_URL',
    'health_probe_version','7930-mainnet-health2',
    'failover_mode','read_only_health_prelaunch',
    'failover_activation_authorized',false
  )
  when 'TRON' then jsonb_build_object(
    'primary_endpoint_secret_name','TRON_MAINNET_RPC_URL',
    'fallback_endpoint_secret_name','TRON_MAINNET_RPC_FALLBACK_URL',
    'api_key_secret_name','TRONGRID_API_KEY',
    'health_probe_version','7930-mainnet-health2',
    'failover_mode','read_only_health_prelaunch',
    'failover_activation_authorized',false
  ) else '{}'::jsonb end,
  updated_at=now()
where environment='mainnet' and network_code in ('ETHEREUM','SOLANA','TRON');
