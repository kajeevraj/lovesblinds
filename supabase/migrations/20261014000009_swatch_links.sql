-- Migration 9: one swatch, several product lines.
--
-- A swatch stays ONE record (one code, one photo, one active flag, its own Roman/Dream details). Where it is also sold
-- in another line, a row in swatch_links says: "this swatch is also in THAT collection, under THIS display name".
-- The collection is the line's own price collection (price grids hang off fabrics), so each line prices it separately.
--   * display names stay unique per line (per family for Roller and Cellular), counting swatches AND links together
--   * a swatch can be placed once per product line (its home line counts)
--   * hiding or deleting the swatch hides or deletes every placement
--   * every link and unlink is written to audit_log, like any other catalog change
-- Safe to re-run.

create table if not exists public.swatch_links (
  id            uuid primary key default gen_random_uuid(),
  swatch_id     text not null references public.swatches(id) on delete cascade,
  fabric_id     text not null references public.fabrics(id) on delete restrict,
  product_line  text not null                                        -- filled from the fabric by the trigger below
                check (product_line in ('roller','zebra','shangri-la','cellular','dream-curtains','drapery')),
  family        text check (family in ('screen-view','solar','blackout','light-filtering')),   -- roller: the fabric's; cellular: chosen; else null
  display_name  text not null,
  sort_order    integer not null default 0,
  active        boolean not null default true,                       -- hide just this placement
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint swatch_links_name_trimmed  check (display_name = btrim(display_name) and display_name <> ''),
  constraint swatch_links_name_spacing  check (display_name !~ '\s{2,}'),
  constraint swatch_links_name_no_digit check (display_name !~ '[0-9]'),
  unique (swatch_id, product_line)
);
create index if not exists swatch_links_fabric_idx on public.swatch_links (fabric_id);
drop trigger if exists swatch_links_updated_at on public.swatch_links;
create trigger swatch_links_updated_at before update on public.swatch_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Is this display name already used in that line (and family, where the picker shows one family at a time)?
-- Looks at swatches and links together. Returns the clashing name, or null.
-- ---------------------------------------------------------------------------------------------
create or replace function public.placement_name_taken(p_line text, p_family text, p_name text, p_skip_swatch text, p_skip_link uuid)
returns text language sql stable security definer set search_path = public as $$
  select n from (
    select s.display_name as n from public.swatches s
     where s.product_line = p_line and lower(s.display_name) = lower(p_name)
       and (p_line not in ('roller','cellular') or s.family is not distinct from p_family)
       and s.id is distinct from p_skip_swatch
    union all
    select l.display_name from public.swatch_links l
     where l.product_line = p_line and lower(l.display_name) = lower(p_name)
       and (p_line not in ('roller','cellular') or l.family is not distinct from p_family)
       and l.id is distinct from p_skip_link
  ) t limit 1;
$$;
revoke all on function public.placement_name_taken(text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.swatch_links_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  fab record; home text; hit text;
begin
  select product_line, family into fab from public.fabrics where id = new.fabric_id;
  if fab.product_line is null then raise exception 'collection % not found', new.fabric_id using errcode = 'foreign_key_violation'; end if;
  select product_line into home from public.swatches where id = new.swatch_id;
  if fab.product_line = home then
    raise exception 'swatch % already belongs to the % line (its own record); link it to a different line', new.swatch_id, home
      using errcode = 'check_violation', constraint = 'swatch_links_not_home_line';
  end if;
  new.product_line := fab.product_line;
  if fab.product_line = 'roller' then new.family := fab.family;
  elsif fab.product_line = 'cellular' then
    if new.family is null or new.family not in ('light-filtering','blackout') then
      raise exception 'a Cellular placement needs a family (light-filtering or blackout)' using errcode = 'check_violation', constraint = 'swatch_links_family';
    end if;
  else new.family := null;
  end if;

  select f.collection_name into hit from public.fabrics f
   where lower(new.display_name) ~ ('\m' || regexp_replace(lower(f.collection_name), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M') limit 1;
  if hit is not null then
    raise exception 'display name "%" contains the supplier collection name "%"', new.display_name, hit
      using errcode = 'check_violation', constraint = 'swatches_display_name_no_collection';
  end if;
  select s.supplier_code into hit from public.swatches s
   where lower(new.display_name) ~ ('\m' || regexp_replace(lower(s.supplier_code), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M') limit 1;
  if hit is not null then
    raise exception 'display name "%" contains the supplier code "%"', new.display_name, hit
      using errcode = 'check_violation', constraint = 'swatches_display_name_no_code';
  end if;

  if public.placement_name_taken(new.product_line, new.family, new.display_name, null, new.id) is not null then
    raise exception 'the display name "%" is already used in this line', new.display_name
      using errcode = 'unique_violation', constraint = 'swatch_links_display_name_per_line';
  end if;
  return new;
end $$;
revoke all on function public.swatch_links_validate() from public, anon, authenticated;
drop trigger if exists swatch_links_validate on public.swatch_links;
create trigger swatch_links_validate before insert or update on public.swatch_links
  for each row execute function public.swatch_links_validate();

-- ---------------------------------------------------------------------------------------------
-- The existing rules now also look at links:
--   * a swatch's own display name may not equal a link's name in the same line
--   * a swatch may not move into a line where it already has a link
--   * a new or renamed collection may not appear inside a link's display name
-- ---------------------------------------------------------------------------------------------
create or replace function public.swatches_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hit text;
  fabric_line text;
  fabric_family text;
begin
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'swatch ids are permanent (saved orders refer to them)'
      using errcode = 'check_violation', constraint = 'swatches_id_permanent';
  end if;

  select product_line, family into fabric_line, fabric_family from fabrics where id = new.fabric_id;
  if fabric_line is distinct from new.product_line then
    raise exception 'swatch % is in line %, but its fabric % is in line %', new.id, new.product_line, new.fabric_id, fabric_line
      using errcode = 'check_violation', constraint = 'swatches_line_matches_fabric';
  end if;
  if fabric_family is not null and new.family is distinct from fabric_family then
    raise exception 'swatch % is in family %, but its fabric % is in family %', new.id, new.family, new.fabric_id, fabric_family
      using errcode = 'check_violation', constraint = 'swatches_family_matches_fabric';
  end if;

  select f.collection_name into hit
    from fabrics f
   where lower(new.display_name) ~ ('\m' || regexp_replace(lower(f.collection_name), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M')
   limit 1;
  if hit is not null then
    raise exception 'display name "%" contains the supplier collection name "%"', new.display_name, hit
      using errcode = 'check_violation', constraint = 'swatches_display_name_no_collection';
  end if;

  select s.supplier_code into hit
    from (select supplier_code from swatches where id <> new.id
          union all select new.supplier_code) s
   where lower(new.display_name) ~ ('\m' || regexp_replace(lower(s.supplier_code), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M')
   limit 1;
  if hit is not null then
    raise exception 'display name "%" contains the supplier code "%"', new.display_name, hit
      using errcode = 'check_violation', constraint = 'swatches_display_name_no_code';
  end if;

  if exists (select 1 from public.swatch_links l where l.swatch_id = new.id and l.product_line = new.product_line) then
    raise exception 'swatch % is already linked into the % line; remove that link first', new.id, new.product_line
      using errcode = 'check_violation', constraint = 'swatch_links_not_home_line';
  end if;
  if exists (select 1 from public.swatch_links l
              where l.product_line = new.product_line and lower(l.display_name) = lower(new.display_name)
                and (new.product_line not in ('roller','cellular') or l.family is not distinct from new.family)) then
    raise exception 'the display name "%" is already used in this line (by a linked color)', new.display_name
      using errcode = 'unique_violation', constraint = 'swatches_display_name_per_line';
  end if;

  return new;
end $$;

create or replace function public.fabrics_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare hit text;
begin
  select n into hit from (
    select s.display_name as n from swatches s
     where lower(s.display_name) ~ ('\m' || regexp_replace(lower(new.collection_name), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M')
    union all
    select l.display_name from swatch_links l
     where lower(l.display_name) ~ ('\m' || regexp_replace(lower(new.collection_name), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M')
  ) t limit 1;
  if hit is not null then
    raise exception 'collection name "%" appears in the display name "%"', new.collection_name, hit
      using errcode = 'check_violation', constraint = 'fabrics_collection_not_in_display_names';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Security: same shape as swatches. Anyone reads active placements of active swatches in active collections; only admins write.
-- ---------------------------------------------------------------------------------------------
revoke all on public.swatch_links from anon, authenticated;
grant select on public.swatch_links to anon, authenticated;
grant insert, update, delete on public.swatch_links to authenticated;      -- still gated by the policies below
grant select, insert, update, delete on public.swatch_links to service_role;
alter table public.swatch_links enable row level security;

drop policy if exists "anyone reads active links" on public.swatch_links;
create policy "anyone reads active links" on public.swatch_links
  for select to anon, authenticated
  using (active and exists (select 1 from public.fabrics f where f.id = fabric_id and f.active));
drop policy if exists "admins read all links" on public.swatch_links;
create policy "admins read all links" on public.swatch_links for select to authenticated using (public.is_admin());
drop policy if exists "admins insert links" on public.swatch_links;
create policy "admins insert links" on public.swatch_links for insert to authenticated with check (public.is_admin());
drop policy if exists "admins update links" on public.swatch_links;
create policy "admins update links" on public.swatch_links for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete links" on public.swatch_links;
create policy "admins delete links" on public.swatch_links for delete to authenticated using (public.is_admin());

-- links and unlinks go to the audit log (the trigger records new_row/old_row, which carry swatch_id and fabric_id)
drop trigger if exists swatch_links_audit on public.swatch_links;
create trigger swatch_links_audit after insert or update or delete on public.swatch_links
  for each row execute function public.audit_row_change();
create index if not exists audit_log_link_swatch_idx on public.audit_log ((coalesce(new_row ->> 'swatch_id', old_row ->> 'swatch_id')))
  where table_name = 'swatch_links';

-- a saved order that picked a swatch counts for every placement of it (the picks carry the swatch id); the
-- existing delete guard on swatches already covers deleting the swatch, and deleting it removes its links.
