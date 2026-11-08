alter table public.sent_orders add column if not exists remote_overrides jsonb not null default '{}'::jsonb;
alter table public.sent_orders drop constraint if exists sent_orders_remote_overrides_object;
alter table public.sent_orders add constraint sent_orders_remote_overrides_object check (jsonb_typeof(remote_overrides) = 'object');
