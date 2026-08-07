revoke execute on function public.crypto_x_cancel_held_event_queue() from anon, authenticated;
revoke execute on function public.crypto_x_promote_priority_regulatory_events() from anon, authenticated;
grant execute on function public.crypto_x_cancel_held_event_queue() to service_role;
grant execute on function public.crypto_x_promote_priority_regulatory_events() to service_role;
