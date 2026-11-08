revoke insert, update, delete, truncate on public.audit_log from service_role;
revoke select, insert, update, delete, truncate on public.orders from anon, service_role;
revoke truncate on public.orders from authenticated;
