-- STAGING ONLY. Run once on a brand-new Supabase project before migration 1 (scripts/staging-setup.mjs does it for you).
-- The live project's `orders` table was created by hand before the migrations began, and migration 13 puts a guard on it, so a fresh project needs it first.
-- It is the same table migration 15 records (every statement is "if not exists", so migration 15 does nothing afterwards).
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
create index if not exists orders_user_idx on public.orders (user_id);
alter table public.orders enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'Users manage own orders') then
    create policy "Users manage own orders" on public.orders for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
