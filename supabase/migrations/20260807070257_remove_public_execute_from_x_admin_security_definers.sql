revoke execute on function public.crypto_x_cancel_held_event_queue() from public;
revoke execute on function public.crypto_x_promote_priority_regulatory_events() from public;
grant execute on function public.crypto_x_cancel_held_event_queue() to service_role;
grant execute on function public.crypto_x_promote_priority_regulatory_events() to service_role;
