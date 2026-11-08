alter table public.orders add column if not exists customer jsonb;

comment on column public.orders.customer is 'Customer details and shipping address as sent with the order (set when the order is sent).';
