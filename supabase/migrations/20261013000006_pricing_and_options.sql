-- Stage 1: supplier pricing and product options, admin only.
-- Every table here is readable and writable by admins only (Row Level Security). Anonymous visitors and signed-in non-admins
-- get nothing, not even a row count. Customers will get prices only through estimate_price() (migration 7), which returns
-- the final price and never a cost, a grid cell or a markup.

-- ---------------------------------------------------------------------------------------------
-- audit trigger: keep the history readable for tables without an "id" column and keep cost arrays out of it
-- ---------------------------------------------------------------------------------------------
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb;
  n jsonb;
  rid text;
begin
  if tg_op in ('UPDATE','DELETE') then o := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then n := to_jsonb(new); end if;
  -- a grid's thousands of cost cells would drown the log: keep their count and a fingerprint instead
  if tg_table_name = 'price_grids' then
    if o is not null then o := (o - 'cost') || jsonb_build_object('cost_cells', cardinality(old.cost), 'cost_md5', md5(old.cost::text)); end if;
    if n is not null then n := (n - 'cost') || jsonb_build_object('cost_cells', cardinality(new.cost), 'cost_md5', md5(new.cost::text)); end if;
  end if;
  if tg_op = 'UPDATE' and (o - 'updated_at') = (n - 'updated_at') then return null; end if;
  rid := coalesce(n ->> 'id', o ->> 'id');
  if rid is null then
    rid := coalesce(n ->> 'fabric_id', o ->> 'fabric_id');
    if tg_table_name = 'grid_fabrics' then rid := coalesce(n ->> 'grid_id', o ->> 'grid_id') || ':' || rid; end if;
  end if;
  insert into public.audit_log (actor_id, actor_email, table_name, row_id, action, old_row, new_row)
  values (
    auth.uid(),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    tg_table_name, coalesce(rid, '?'), tg_op, o, n
  );
  return null;
end $$;
revoke all on function public.audit_row_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- PRODUCT OPTIONS
-- ---------------------------------------------------------------------------------------------
create table public.product_lines (
  id               text primary key,                       -- roller, zebra, shangri-la, roman, cellular, drapery, woven-wood, wood, shutters, zipscreen, outdoor
  name             text not null check (btrim(name) <> ''),
  blurb            text not null default '',               -- short description
  description      text not null default '',
  good_to_know     text[] not null default '{}',
  location         text not null default 'indoor' check (location in ('indoor','outdoor')),
  active           boolean not null default true,
  price_on_request boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger product_lines_updated_at before update on public.product_lines for each row execute function public.set_updated_at();

create table public.option_groups (
  id          text primary key,                            -- roller:control
  line_id     text not null references public.product_lines(id) on delete cascade,
  key         text not null check (key ~ '^[a-z][a-z-]*$'),  -- control, mount, mode, family, format, type, style, lining, pleat, section, dream-style
  label       text not null check (btrim(label) <> ''),    -- heading the customer sees
  note        text,
  bound       boolean not null default false,              -- true: values are tied to code or catalog data, so none can be added
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (line_id, key)
);
create trigger option_groups_updated_at before update on public.option_groups for each row execute function public.set_updated_at();

create table public.option_values (
  id           text primary key,                           -- roller:control:chain
  group_id     text not null references public.option_groups(id) on delete cascade,
  code         text not null check (btrim(code) <> ''),    -- what saved orders store; never changes
  label        text not null check (btrim(label) <> ''),
  explanation  text,                                       -- one line
  image_key    text,                                        -- existing picture under public/explainers
  image_path   text,                                        -- uploaded picture in the option-images bucket (wins over image_key)
  grid_system  text check (grid_system in ('cord','cordless','motor','manual')),   -- controls: which price grid system this uses
  active       boolean not null default true,
  is_default   boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (group_id, code)
);
create unique index option_values_one_default on public.option_values (group_id) where is_default;
create trigger option_values_updated_at before update on public.option_values for each row execute function public.set_updated_at();

create table public.size_rules (
  id                  uuid primary key default gen_random_uuid(),
  line_id             text not null references public.product_lines(id) on delete cascade,
  subject             text not null check (btrim(subject) <> ''),      -- "Cordless Roman shades"
  when_values         jsonb not null default '{}'::jsonb,              -- {"control":["cordless"]}; empty = always
  min_width numeric, max_width numeric, min_height numeric, max_height numeric,
  note                text,
  note_if_width_over  numeric,
  note_if_height_over numeric,
  message_override    text,
  severity            text not null default 'block' check (severity in ('block','warn')),
  use_fabric_width    boolean not null default false,
  source              text not null default 'manual' check (source in ('manual','grid')),
  verified            boolean not null default false,                  -- unverified rules are not shown to customers
  verified_note       text,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (min_width  is null or max_width  is null or min_width  <= max_width),
  check (min_height is null or max_height is null or min_height <= max_height)
);
create trigger size_rules_updated_at before update on public.size_rules for each row execute function public.set_updated_at();

-- option values: the code never changes; bound groups take no new values
create or replace function public.option_values_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.code <> old.code then
    raise exception 'option codes are permanent (saved orders store them)' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and exists (select 1 from public.option_groups g where g.id = new.group_id and g.bound)
     and current_setting('request.jwt.claims', true) is not null and current_setting('request.jwt.claims', true) <> ''
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'this option group is tied to the catalog or the site''s code, so values cannot be added to it' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.option_values_guard() from public, anon, authenticated;
create trigger option_values_guard before insert or update on public.option_values for each row execute function public.option_values_guard();

-- ---------------------------------------------------------------------------------------------
-- SUPPLIER PRICING
-- ---------------------------------------------------------------------------------------------
create table public.pricing_lines (
  id               text primary key,                       -- roller, zebra, shangri-la, roman, cellular, dream-curtains, drapery, woven-wood
  name             text not null,
  product_line_id  text references public.product_lines(id) on delete set null,
  markup           numeric(7,4) not null default 0.5000 check (markup >= 0 and markup <= 10),   -- 0.5 = price is cost x 1.5
  roll_rule        text check (roll_rule in ('either','width')),    -- either: a size is possible if one side fits the roll; width: the width must fit the roll
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger pricing_lines_updated_at before update on public.pricing_lines for each row execute function public.set_updated_at();

create table public.collection_markups (
  fabric_id   text primary key references public.fabrics(id) on delete cascade,
  markup      numeric(7,4) not null check (markup >= 0 and markup <= 10),
  updated_at  timestamptz not null default now()
);
create trigger collection_markups_updated_at before update on public.collection_markups for each row execute function public.set_updated_at();

create table public.price_grids (
  id            uuid primary key default gen_random_uuid(),
  grid_key      text not null unique,                      -- stable identity, so a re-import updates the same grid
  line_id       text not null references public.pricing_lines(id) on delete cascade,
  systems       text[] not null check (systems <@ array['cord','cordless','motor','manual']::text[] and cardinality(systems) >= 1),
  variant       text not null default 'all',                -- cellular: standard | top-down-bottom-up | day-night; else all
  lining        text check (lining in ('light-filtering','blackout')),
  scope         text not null default 'fabric' check (scope in ('fabric','line')),   -- line: one grid for every collection in the line
  special       boolean not null default false,             -- Zebra special sizes
  multiplier    numeric(6,3) not null default 1,
  label         text not null,
  roll_widths   numeric[] not null default '{}',            -- what the sheet says (inches); more than one when the sheet gives alternatives
  rows_are      text not null check (rows_are in ('width','height')),   -- which quantity the sheet's row axis is (the sheet's columns are the other)
  row_axis      numeric[] not null,
  col_axis      numeric[] not null,
  cost          numeric[] not null,                         -- row-major, row_axis x col_axis; NULL = the sheet has no price here
  source_file   text, source_sheet text, source_title text,
  origin_row    integer, origin_col integer,                -- sheet position of the first cost cell (1-based), for "grid cell used"
  anomalies     jsonb not null default '[]'::jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (cardinality(cost) = cardinality(row_axis) * cardinality(col_axis))
);
create index price_grids_line_idx on public.price_grids (line_id);
create trigger price_grids_updated_at before update on public.price_grids for each row execute function public.set_updated_at();

create table public.grid_fabrics (
  grid_id      uuid not null references public.price_grids(id) on delete cascade,
  fabric_id    text not null references public.fabrics(id) on delete cascade,
  sheet_rolls  numeric[] not null default '{}',   -- roll width(s) the sheet gives this collection (inches)
  max_drop     numeric,                           -- Shangri-La "Max Length": the longest drop the supplier allows for this collection
  primary key (grid_id, fabric_id)
);
create index grid_fabrics_fabric_idx on public.grid_fabrics (fabric_id);

create table public.price_adders (
  id          uuid primary key default gen_random_uuid(),
  line_id     text not null references public.pricing_lines(id) on delete cascade,
  adder_key   text not null,                                -- stable identity for re-imports
  label       text not null,
  kind        text not null check (kind in ('add','subtract')),
  amount      numeric(10,3) check (amount >= 0),             -- cost, before markup; NULL = not known yet
  unit        text not null default 'flat' check (unit in ('flat','per_sqft')),
  applies_when jsonb not null default '{}'::jsonb,           -- {"control":["matter"]}; every key must match
  origin      text not null default 'sheet' check (origin in ('sheet','manual')),
  status      text not null default 'from_sheet' check (status in ('from_sheet','placeholder','confirm')),
  source      text,
  note        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (line_id, adder_key)
);
create trigger price_adders_updated_at before update on public.price_adders for each row execute function public.set_updated_at();

create table public.price_flags (
  id          uuid primary key default gen_random_uuid(),
  line_id     text references public.pricing_lines(id) on delete cascade,
  flag_key    text not null unique,
  kind        text not null check (kind in ('confirm','placeholder','anomaly','info')),
  title       text not null,
  detail      text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger price_flags_updated_at before update on public.price_flags for each row execute function public.set_updated_at();

create table public.price_imports (
  id          uuid primary key default gen_random_uuid(),
  line_id     text not null references public.pricing_lines(id) on delete cascade,
  file_name   text,
  file_sha256 text,
  summary     jsonb not null default '{}'::jsonb,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

-- one grid per collection, system, variant and lining
create or replace function public.grid_fabrics_unique() returns trigger
language plpgsql security definer set search_path = public as $$
declare g public.price_grids; clash text;
begin
  select * into g from public.price_grids where id = new.grid_id;
  select o.label into clash
    from public.grid_fabrics gf join public.price_grids o on o.id = gf.grid_id
   where gf.fabric_id = new.fabric_id and o.id <> g.id and o.line_id = g.line_id and o.active and g.active
     and o.special = g.special and o.systems && g.systems
     and (o.variant = g.variant or o.variant = 'all' or g.variant = 'all')
     and (o.lining is null or g.lining is null or o.lining = g.lining)
   limit 1;
  if clash is not null then
    raise exception 'collection % already has a price grid for this system and variant (%)', new.fabric_id, clash using errcode = 'unique_violation';
  end if;
  return new;
end $$;
revoke all on function public.grid_fabrics_unique() from public, anon, authenticated;
create trigger grid_fabrics_unique before insert or update on public.grid_fabrics for each row execute function public.grid_fabrics_unique();

-- ---------------------------------------------------------------------------------------------
-- Security: admins only, nothing for anon
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['product_lines','option_groups','option_values','size_rules','pricing_lines','collection_markups',
                           'price_grids','grid_fabrics','price_adders','price_flags','price_imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('create policy "admins read %1$s" on public.%1$I for select to authenticated using (public.is_admin())', t);
    execute format('create policy "admins insert %1$s" on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admins update %1$s" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admins delete %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$I for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Storage: pictures for option cards. Public read, admin write, like the swatches bucket.
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('option-images', 'option-images', true, 5242880, array['image/jpeg','image/webp','image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "option images are public" on storage.objects for select to anon, authenticated using (bucket_id = 'option-images');
create policy "admins upload option images" on storage.objects for insert to authenticated with check (bucket_id = 'option-images' and public.is_admin());
create policy "admins replace option images" on storage.objects for update to authenticated
  using (bucket_id = 'option-images' and public.is_admin()) with check (bucket_id = 'option-images' and public.is_admin());
create policy "admins delete option images" on storage.objects for delete to authenticated using (bucket_id = 'option-images' and public.is_admin());
