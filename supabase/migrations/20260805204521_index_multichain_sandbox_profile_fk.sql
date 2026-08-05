create index if not exists crypto_onchain_sandbox_cases_profile_idx
on public.crypto_onchain_sandbox_cases(network_code,environment);

do $$
begin
  if to_regclass('public.crypto_onchain_sandbox_cases_profile_idx') is null then
    raise exception 'Sandbox profile FK index missing';
  end if;
end $$;
