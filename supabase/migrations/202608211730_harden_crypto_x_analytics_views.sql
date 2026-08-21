alter view public.crypto_x_growth_topic_mix_baseline set (security_invoker = true);
alter view public.crypto_x_clean_follower_correlation_v1 set (security_invoker = true);

revoke all on public.crypto_x_growth_topic_mix_baseline from anon, authenticated;
revoke all on public.crypto_x_clean_follower_correlation_v1 from anon, authenticated;

grant select on public.crypto_x_growth_topic_mix_baseline to service_role;
grant select on public.crypto_x_clean_follower_correlation_v1 to service_role;
