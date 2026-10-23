-- Migration 15: a written record of the `orders` table as it exists today. It changes nothing in the live database.
-- The table was created by hand before the migrations began. Every statement below is "if not exists", so on the live project
-- this file does nothing; on a fresh project it creates the same table, so the migrations alone can rebuild the database.
-- Column names, types and defaults were read from the live project on 2026-10-23; "not null" and the user_id link are best guesses.
--
-- The row-level-security policy was read from the live project on 2026-10-23: one policy, "Users manage own orders", for every
-- command and every role, allowing a row only when auth.uid() = user_id. Migration 13 adds the sent-order guard on top.
-- On the live project the policy already exists, so the block below does nothing there.

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

alter table public.orders enable row level security;      -- already on in the live project

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'Users manage own orders') then
    create policy "Users manage own orders" on public.orders for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
