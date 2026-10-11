-- Catalog schema: fabrics (supplier collections), swatches (colors) and admins.
-- Run in order; safe to read top to bottom. Nothing here touches the existing orders table.

-- ---------------------------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- fabrics: one row per supplier fabric / collection
-- ---------------------------------------------------------------------------------------------
create table public.fabrics (
  id               text primary key,                         -- current ids, e.g. roller:screen-view:purity
  product_line     text not null
                   check (product_line in ('roller','zebra','shangri-la','cellular','dream-curtains','drapery')),
  shown_in         text[] not null                           -- site lines that list it (Roman and Drapery share records)
                   check (shown_in <@ array['roller','zebra','shangri-la','roman','cellular','drapery','dream-curtains']::text[]
                          and cardinality(shown_in) >= 1),
  family           text check (family in ('screen-view','solar','blackout','light-filtering')),
  collection_name  text not null check (btrim(collection_name) <> ''),   -- supplier name: internal only, never shown to customers
  -- specs, stored exactly as the supplier gave them; null means "do not display"
  width            text,
  composition      text,
  weight           text,
  thickness        text,
  openness         text,                                     -- Screen View, e.g. "3%"
  opacity          text,                                     -- Solar, Blackout, Zebra, Shangri-La
  use_area         text,                                     -- "Indoor", "Indoor & outdoor"
  extra_specs      jsonb not null default '{}'::jsonb,       -- vaneSize, care, weightStyleA/B ...
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Roller fabrics belong to one family; Cellular's single fabric spans both, so it has none.
  constraint fabrics_family_matches_line check (
    (product_line = 'roller' and family in ('screen-view','solar','blackout'))
    or (product_line <> 'roller' and family is null)
  )
);
create index fabrics_line_idx on public.fabrics (product_line, sort_order);
create trigger fabrics_updated_at before update on public.fabrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- swatches: one row per color
-- Per-swatch attributes that the supplier data keeps on the swatch (Roman and Curtains fabrics carry their own
-- composition, width, grade and style availability) live here, not on fabrics.
-- ---------------------------------------------------------------------------------------------
create table public.swatches (
  id                   text primary key,                     -- current ids, so saved orders still resolve; never changes
  fabric_id            text not null references public.fabrics(id) on delete restrict,
  product_line         text not null
                       check (product_line in ('roller','zebra','shangri-la','cellular','dream-curtains','drapery')),
  shown_in             text[] not null
                       check (shown_in <@ array['roller','zebra','shangri-la','roman','cellular','drapery','dream-curtains']::text[]
                              and cardinality(shown_in) >= 1),
  family               text check (family in ('screen-view','solar','blackout','light-filtering')),
  display_name         text not null,                        -- what customers see
  supplier_code        text not null,                        -- exactly as the supplier prints it
  supplier_color_name  text,                                 -- supplier's own name: internal only
  color_family         text not null
                       check (color_family in ('White','Cream/Ivory','Beige/Tan','Gray','Charcoal/Black','Brown','Blue','Green','Pink/Red','Purple','Pattern/Multi')),
  image_path           text not null,                        -- object path in the "swatches" storage bucket
  thumb_path           text not null,                        -- small WebP (320 px) in the same bucket
  image_kind           text not null default 'swatch' check (image_kind in ('swatch','hero')),
  grade                text check (grade in ('A','B','C','D','E')),          -- Roman / Curtains; never shown to customers
  width                text,                                 -- per-swatch override of the fabric spec
  composition          text,                                 -- per-swatch override of the fabric spec
  roman_styles         jsonb,                                -- { relax: { available, linings: [...] }, flat: ... }
  styles               jsonb,                                -- Dream Curtains: [{ style, code, image_path, thumb_path }]
  active               boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Roller and Cellular swatches carry a family; every other line has none.
  constraint swatches_family_matches_line check (
    (product_line = 'roller'   and family in ('screen-view','solar','blackout'))
    or (product_line = 'cellular' and family in ('light-filtering','blackout'))
    or (product_line not in ('roller','cellular') and family is null)
  ),
  -- Display name rules that need no other table
  constraint swatches_display_name_trimmed  check (display_name = btrim(display_name) and display_name <> ''),
  constraint swatches_display_name_spacing  check (display_name !~ '\s{2,}'),
  constraint swatches_display_name_no_digit check (display_name !~ '[0-9]'),
  constraint swatches_supplier_code_trimmed check (supplier_code = btrim(supplier_code) and supplier_code <> '')
);
create index swatches_line_idx on public.swatches (product_line, active, sort_order);
create index swatches_fabric_idx on public.swatches (fabric_id);

-- Uniqueness, matching the old validator
--   supplier code: unique inside the product line
create unique index swatches_supplier_code_per_line
  on public.swatches (product_line, lower(supplier_code));
--   display name: unique inside line + family for Roller and Cellular (their picker shows one family at a time) ...
create unique index swatches_display_name_per_family
  on public.swatches (product_line, family, lower(display_name))
  where product_line in ('roller','cellular');
--   ... and inside the line for every other line (Roman and Curtains share the drapery records)
create unique index swatches_display_name_per_line
  on public.swatches (product_line, lower(display_name))
  where product_line not in ('roller','cellular');

create trigger swatches_updated_at before update on public.swatches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Rules that look at other rows (a CHECK constraint cannot): run as a trigger so they apply to every writer,
-- including the admin page.
--   * a swatch id never changes (saved orders point at it)
--   * the swatch's product line matches its fabric's
--   * display_name contains no supplier collection name (any fabric) and no supplier code (any swatch)
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
  -- a Roller fabric belongs to one family and so do its swatches (Cellular's single fabric spans both)
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

  return new;
end $$;

create trigger swatches_validate before insert or update on public.swatches
  for each row execute function public.swatches_validate();

-- The other direction: a new or renamed collection may not appear inside an existing display name.
create or replace function public.fabrics_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare hit text;
begin
  select s.display_name into hit
    from swatches s
   where lower(s.display_name) ~ ('\m' || regexp_replace(lower(new.collection_name), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M')
   limit 1;
  if hit is not null then
    raise exception 'collection name "%" appears in the display name "%"', new.collection_name, hit
      using errcode = 'check_violation', constraint = 'fabrics_collection_not_in_display_names';
  end if;
  return new;
end $$;

create trigger fabrics_validate before insert or update of collection_name on public.fabrics
  for each row execute function public.fabrics_validate();

-- ---------------------------------------------------------------------------------------------
-- admins: who may write. Bound to an auth user the first time that person signs in.
-- ---------------------------------------------------------------------------------------------
create table public.admins (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email = lower(btrim(email)) and email <> ''),
  user_id     uuid unique references auth.users(id) on delete cascade,   -- null until that person has signed in
  created_at  timestamptz not null default now()
);
create unique index admins_email_key on public.admins (email);

-- True only for a signed-in user who is listed in admins.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
