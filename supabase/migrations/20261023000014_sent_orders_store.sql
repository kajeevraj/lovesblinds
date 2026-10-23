-- Migration 14: keep a copy of every order that is sent (guests included).
-- Safe to run more than once. Paste the whole file into the Supabase SQL Editor. Needs migration 1 (is_admin()).
--
-- Until now a sent order existed only as an email (and, for signed-in customers, as a row in `orders`). This adds
-- `sent_orders`: one row per order the site accepted, written by the site's server (api/quote.js) after our email went out.
--   * Only admins can read it. Customers (signed in or not) have no access at all.
--   * The row is never changed by the site; admins can change `status` and `admin_note`, and delete.
--   * It holds the customer's details, the items with the estimate each was sent with, the totals, and the internal
--     (supplier) descriptions, which is why it must stay admin-only.

create table if not exists public.sent_orders (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  customer       jsonb not null,                       -- name, email, phone, address, shipTo
  lines          jsonb not null,                       -- every item as sent, with its estimate and internal description
  notes          text,
  total          numeric,                              -- sum of the estimates in dollars (null when nothing was priced)
  by_email_count integer not null default 0,           -- items whose price is sent by email
  customer_copy  boolean not null default false,      -- true when the customer's confirmation email went out
  status         text not null default 'new' check (status in ('new', 'in_progress', 'quoted', 'done', 'cancelled')),
  admin_note     text check (admin_note is null or char_length(admin_note) <= 5000)
);
create index if not exists sent_orders_created_idx on public.sent_orders (created_at desc);
create index if not exists sent_orders_status_idx on public.sent_orders (status);
create index if not exists sent_orders_email_idx on public.sent_orders ((lower(customer->>'email')));

alter table public.sent_orders enable row level security;
revoke all on public.sent_orders from anon, authenticated;
grant select, update, delete on public.sent_orders to authenticated;       -- only what the policies below let an admin do
grant select, insert on public.sent_orders to service_role;

drop policy if exists "admins read sent orders" on public.sent_orders;
create policy "admins read sent orders" on public.sent_orders for select to authenticated using (public.is_admin());
drop policy if exists "admins update sent orders" on public.sent_orders;
create policy "admins update sent orders" on public.sent_orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete sent orders" on public.sent_orders;
create policy "admins delete sent orders" on public.sent_orders for delete to authenticated using (public.is_admin());

-- Admins can only change the status and the note, never the order itself.
create or replace function public.sent_orders_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.customer is distinct from old.customer or new.lines is distinct from old.lines or new.notes is distinct from old.notes
     or new.total is distinct from old.total or new.created_at is distinct from old.created_at then
    raise exception 'a sent order cannot be changed (only its status and note)' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.sent_orders_guard() from public, anon, authenticated;
drop trigger if exists sent_orders_guard on public.sent_orders;
create trigger sent_orders_guard before update on public.sent_orders for each row execute function public.sent_orders_guard();
