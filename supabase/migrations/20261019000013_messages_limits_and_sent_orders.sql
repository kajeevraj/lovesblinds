-- Migration 13: contact messages, rate limits, size limits and read-only sent orders.
-- Safe to run more than once. Paste the whole file into the Supabase SQL Editor. Needs migrations 1 to 12 (12 adds orders.customer).
--
--  1. messages        every contact-form message, readable and changeable only by admins (the site writes it through its server).
--  2. rate_limits     a tiny counter table behind the order and contact forms (5 an hour per IP address, 3 an hour per email).
--                     The site stores only a hash of the address, never the address itself.
--  3. size_limits()   the smallest and largest width and height for a line: a verified size rule from Products (if any), else the
--                     supplier grid's smallest and largest sizes. Returns only four numbers. Callable by the public.
--  4. sent orders     the database refuses to change the items, the customer details or the owner of a sent order, or to turn
--                     it back into a draft. (Renaming and deleting stay possible.)

-- ---------------------------------------------------------------------------------------------
-- 1. messages
-- ---------------------------------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (btrim(name) <> '' and char_length(name) <= 200),
  email       text not null check (btrim(email) <> '' and char_length(email) <= 320),
  phone       text check (phone is null or char_length(phone) <= 60),
  topic       text check (topic is null or char_length(topic) <= 100),
  subject     text check (subject is null or char_length(subject) <= 300),
  message     text not null check (btrim(message) <> '' and char_length(message) <= 5000),
  status      text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  emailed     boolean not null default false,         -- true once the email to us went out
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at desc);
create index if not exists messages_status_idx on public.messages (status);

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select, update, delete on public.messages to authenticated;      -- only what the policies below let an admin do
grant select, insert, update, delete on public.messages to service_role;

drop policy if exists "admins read messages" on public.messages;
create policy "admins read messages" on public.messages for select to authenticated using (public.is_admin());
drop policy if exists "admins update messages" on public.messages;
create policy "admins update messages" on public.messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete messages" on public.messages;
create policy "admins delete messages" on public.messages for delete to authenticated using (public.is_admin());

drop trigger if exists messages_updated_at on public.messages;
create trigger messages_updated_at before update on public.messages for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- 2. rate limits
-- ---------------------------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant select, insert, update, delete on public.rate_limits to service_role;

-- Counts one hit for the key in the current window and says whether it is still within the limit.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare ws timestamptz; n integer;
begin
  if p_window_seconds < 1 then raise exception 'window must be at least a second'; end if;
  ws := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, hits) values (left(p_key, 200), ws, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into n;
  if random() < 0.02 then delete from public.rate_limits where window_start < now() - interval '2 days'; end if;   -- tidy up now and then
  return n <= p_limit;
end $$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. size limits
-- ---------------------------------------------------------------------------------------------
create or replace function public.size_limits(p_line text, p_options jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  rule record; g record;
  minw numeric; maxw numeric; minh numeric; maxh numeric;
  gminw numeric; gmaxw numeric; gminh numeric; gmaxh numeric;
  wax numeric[]; hax numeric[];
  src text := 'none';
begin
  -- a verified, active rule from Products whose conditions all match (the most specific rule wins)
  select s.* into rule from public.size_rules s
   where s.line_id = p_line and s.active and s.verified
     and not exists (select 1 from jsonb_each(s.when_values) c
                      where not coalesce((coalesce(p_options, '{}'::jsonb) ->> c.key) in (select jsonb_array_elements_text(c.value)), false))
   order by (select count(*) from jsonb_object_keys(s.when_values)) desc, s.updated_at desc
   limit 1;
  if found then
    minw := rule.min_width; maxw := rule.max_width; minh := rule.min_height; maxh := rule.max_height;
    src := 'rule';
  end if;

  -- the supplier grids: the smallest and largest width and height on any grid of the line
  for g in select rows_are, row_axis, col_axis from public.price_grids where line_id = p_line and active loop
    if g.rows_are = 'width' then wax := g.row_axis; hax := g.col_axis; else wax := g.col_axis; hax := g.row_axis; end if;
    gminw := least(coalesce(gminw, wax[1]), (select min(x) from unnest(wax) x));
    gmaxw := greatest(coalesce(gmaxw, wax[1]), (select max(x) from unnest(wax) x));
    gminh := least(coalesce(gminh, hax[1]), (select min(x) from unnest(hax) x));
    gmaxh := greatest(coalesce(gmaxh, hax[1]), (select max(x) from unnest(hax) x));
  end loop;
  if gminw is not null then
    if src = 'none' then src := 'grid'; end if;
    minw := coalesce(minw, gminw); maxw := coalesce(maxw, gmaxw); minh := coalesce(minh, gminh); maxh := coalesce(maxh, gmaxh);
  end if;

  return jsonb_build_object('min_width', minw, 'max_width', maxw, 'min_height', minh, 'max_height', maxh, 'source', src);
end $$;
revoke all on function public.size_limits(text, jsonb) from public;
grant execute on function public.size_limits(text, jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. a sent order cannot be changed
-- ---------------------------------------------------------------------------------------------
create or replace function public.orders_sent_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status = 'sent' then
    if new.items is distinct from old.items or new.customer is distinct from old.customer or new.user_id is distinct from old.user_id then
      raise exception 'a sent order cannot be changed' using errcode = 'check_violation';
    end if;
    if new.status = 'draft' then
      raise exception 'a sent order cannot go back to a draft' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.orders_sent_guard() from public, anon, authenticated;
drop trigger if exists orders_sent_guard on public.orders;
create trigger orders_sent_guard before update on public.orders for each row execute function public.orders_sent_guard();
