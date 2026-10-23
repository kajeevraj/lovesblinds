-- Migration 15: a written record of the `orders` table as it exists today. It changes nothing in the live database.
-- The table was created by hand before the migrations began. Every statement below is "if not exists", so on the live project
-- this file does nothing; on a fresh project it creates the same table, so the migrations alone can rebuild the database.
-- Column names, types and defaults were read from the live project on 2026-10-23; "not null" and the user_id link are best guesses.
--
-- Not recorded here: the row-level-security policies on `orders` (customers see and change only their own rows, with the
-- sent-order guard from migration 13 on top). They were set up by hand. Before rebuilding from scratch, export them from the
-- live project (Authentication > Policies, or `select * from pg_policies where tablename = 'orders'`) and add them to this file.

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  name        text default 'New Order',
  items       jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  status      text default 'draft',
  customer    jsonb
);
comment on column public.orders.customer is 'Customer details and shipping address as sent with the order (set when the order is sent).';
create index if not exists orders_user_idx on public.orders (user_id);
