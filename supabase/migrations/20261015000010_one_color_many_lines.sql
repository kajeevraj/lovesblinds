-- Migration 10: one color, one name, several product lines (simplifies migration 9).
-- Safe to re-run. Run it in the SQL Editor after migrations 1 to 9.
--
--  * A color has ONE display name, code and image everywhere. swatch_links no longer has a display name: a link only says
--    "this color is also in that line, priced by that price group". Existing links keep the color's main name.
--  * Names (and codes) stay unique within each line, counting the color's own line and its links. Adding a color to a line
--    where another color already has that name is refused, and the message names that color.
--  * set_swatch_lines(): one call ticks and unticks lines (the admin multi-select). Adding a line uses that line's default
--    price group unless one is given. Audit-logged through the existing triggers.
--  * swatches.extra_cost: dollars added to the customer price AFTER the markup. Starts at 0 for every color.
--  * Price groups (the fabrics table) are admin-only. The customer site reads through public_catalog(), which has no price
--    group names or ids, no supplier color names, no grade and no extra cost. (Closing the old direct table reads is migration 11.)
--  * estimate_price_for_swatch(): the customer price for a picked color and size (returns only price / custom size /
--    price on request). The admin price checker gets estimate_price_debug_for_swatch() with price group and extra cost apart.

-- ---------------------------------------------------------------------------------------------
-- 1. columns
-- ---------------------------------------------------------------------------------------------
alter table public.fabrics add column if not exists public_key text;
update public.fabrics set public_key = substr(md5(random()::text || clock_timestamp()::text || id), 1, 12) where public_key is null;
alter table public.fabrics alter column public_key set default substr(md5(random()::text || clock_timestamp()::text), 1, 12);
alter table public.fabrics alter column public_key set not null;
create unique index if not exists fabrics_public_key_key on public.fabrics (public_key);

alter table public.swatches add column if not exists extra_cost numeric(10,2) not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'swatches_extra_cost_nonneg') then
    alter table public.swatches add constraint swatches_extra_cost_nonneg check (extra_cost >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. one name everywhere: which other color already has this name (or code) in a line?
--    Looks at every color's own line and its links. Returns a sentence naming that color, or null.
-- ---------------------------------------------------------------------------------------------
create or replace function public.line_clash(p_line text, p_family text, p_name text, p_code text, p_skip_swatch text)
returns text language sql stable security definer set search_path = public as $$
  with placed as (
    select s.id, s.display_name, s.supplier_code, s.product_line as line, s.family
      from public.swatches s
    union all
    select s.id, s.display_name, s.supplier_code, l.product_line, l.family
      from public.swatch_links l join public.swatches s on s.id = l.swatch_id
  )
  select case when lower(p.display_name) = lower(p_name)
              then format('the name "%s" is already used in the %s line by the color with code %s', p.display_name, p_line, p.supplier_code)
              else format('the code "%s" is already used in the %s line by the color named "%s"', p.supplier_code, p_line, p.display_name) end
    from placed p
   where p.line = p_line and p.id is distinct from p_skip_swatch
     and ((lower(p.display_name) = lower(p_name) and (p_line not in ('roller','cellular') or p.family is not distinct from p_family))
          or lower(p.supplier_code) = lower(p_code))
   limit 1;
$$;
revoke all on function public.line_clash(text, text, text, text, text) from public, anon, authenticated;

-- a link: set its line and family from the price group, keep a color out of its own line, refuse name or code clashes
create or replace function public.swatch_links_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare fab record; sw record; clash text;
begin
  select product_line, family into fab from public.fabrics where id = new.fabric_id;
  if fab.product_line is null then raise exception 'price group % not found', new.fabric_id using errcode = 'foreign_key_violation'; end if;
  select product_line, display_name, supplier_code into sw from public.swatches where id = new.swatch_id;
  if fab.product_line = sw.product_line then
    raise exception 'this color already belongs to the % line (its own record)', sw.product_line
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
  clash := public.line_clash(new.product_line, new.family, sw.display_name, sw.supplier_code, new.swatch_id);
  if clash is not null then
    raise exception 'cannot add to this line: %', clash using errcode = 'unique_violation', constraint = 'swatch_links_display_name_per_line';
  end if;
  return new;
end $$;

-- a color's own rules, now also against its links and other colors' links
create or replace function public.swatches_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hit text; fabric_line text; fabric_family text; clash text; l record;
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

  if exists (select 1 from public.swatch_links k where k.swatch_id = new.id and k.product_line = new.product_line) then
    raise exception 'this color is already linked into the % line; remove that line first', new.product_line
      using errcode = 'check_violation', constraint = 'swatch_links_not_home_line';
  end if;
  -- the name and code must be free in every line this color is in
  clash := public.line_clash(new.product_line, new.family, new.display_name, new.supplier_code, new.id);
  if clash is null then
    for l in select product_line, family from public.swatch_links where swatch_id = new.id loop
      clash := public.line_clash(l.product_line, l.family, new.display_name, new.supplier_code, new.id);
      exit when clash is not null;
    end loop;
  end if;
  if clash is not null then
    raise exception '%', clash using errcode = 'unique_violation', constraint = 'swatches_display_name_per_line';
  end if;
  return new;
end $$;

-- a new or renamed price group may not appear inside a color name (links no longer have names)
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

-- ---------------------------------------------------------------------------------------------
-- 3. links lose their own name
-- ---------------------------------------------------------------------------------------------
alter table public.swatch_links drop column if exists display_name;
drop function if exists public.placement_name_taken(text, text, text, text, uuid);

-- links that already clash with another color's name in their line (so you can fix them): reported, not deleted
do $$
declare r record; msg text;
begin
  for r in select l.id, l.swatch_id, l.product_line, l.family, s.display_name, s.supplier_code
             from public.swatch_links l join public.swatches s on s.id = l.swatch_id loop
    msg := public.line_clash(r.product_line, r.family, r.display_name, r.supplier_code, r.swatch_id);
    if msg is not null then raise notice 'link % (color %) clashes: %', r.id, r.swatch_id, msg; end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. default price group for a line (its first group by sort order; roller needs a family) and the product-lines call
-- ---------------------------------------------------------------------------------------------
create or replace function public.default_price_group(p_line text, p_family text default null) returns text
language sql stable security definer set search_path = public as $$
  select f.id from public.fabrics f
   where f.product_line = p_line and f.active and (p_family is null or f.family = p_family)
   order by f.sort_order, f.collection_name limit 1;
$$;
revoke all on function public.default_price_group(text, text) from public, anon;
grant execute on function public.default_price_group(text, text) to authenticated, service_role;

-- p_lines: [{"product_line":"drapery","fabric_id":null,"family":null}, ...]  = the lines the color should be in.
-- fabric_id (the price group for that line) is optional: an existing placement keeps its group, a new one gets the default.
-- Removing the color's own line promotes another line to be its main one. At least one line must remain.
create or replace function public.set_swatch_lines(p_swatch text, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  s public.swatches; want jsonb := '[]'::jsonb; w jsonb; ln text; fid text; fam text; fab public.fabrics;
  cur public.swatch_links; nh jsonb; added text[] := '{}'; removed text[] := '{}'; sort_n int;
begin
  if not (public.is_admin() or coalesce(claims ->> 'role', '') = 'service_role') then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into s from public.swatches where id = p_swatch for update;
  if not found then raise exception 'color % not found', p_swatch; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'a color needs at least one product line' using errcode = 'check_violation';
  end if;

  -- resolve every wanted line to a price group (and family)
  for w in select * from jsonb_array_elements(p_lines) loop
    ln := w ->> 'product_line';
    if ln is null or ln not in ('roller','zebra','shangri-la','cellular','dream-curtains','drapery') then raise exception 'unknown product line %', ln; end if;
    if exists (select 1 from jsonb_array_elements(want) x where x ->> 'product_line' = ln) then continue; end if;
    fid := nullif(w ->> 'fabric_id', ''); fam := nullif(w ->> 'family', '');
    if fid is null then
      select l.fabric_id into fid from public.swatch_links l where l.swatch_id = p_swatch and l.product_line = ln;   -- keep what it has
      if fid is null and s.product_line = ln then fid := s.fabric_id; end if;
    end if;
    if fid is null then
      fid := public.default_price_group(ln, case when ln = 'roller' then coalesce(fam, case when s.family in ('screen-view','solar','blackout') then s.family end, 'solar') end);
      if fid is null then raise exception 'there is no price group in the % line yet', ln; end if;
    end if;
    select * into fab from public.fabrics where id = fid;
    if not found or fab.product_line <> ln then raise exception 'price group % is not in the % line', fid, ln; end if;
    if ln = 'roller' then fam := fab.family;
    elsif ln = 'cellular' then
      fam := coalesce(fam, (select l.family from public.swatch_links l where l.swatch_id = p_swatch and l.product_line = 'cellular'),
                      case when s.product_line = 'cellular' then s.family end, 'light-filtering');
    else fam := null; end if;
    want := want || jsonb_build_array(jsonb_build_object('product_line', ln, 'fabric_id', fid, 'family', fam, 'shown_in', to_jsonb(fab.shown_in)));
  end loop;

  -- unlink the lines that were unticked
  for cur in select * from public.swatch_links where swatch_id = p_swatch loop
    if not exists (select 1 from jsonb_array_elements(want) x where x ->> 'product_line' = cur.product_line) then
      delete from public.swatch_links where id = cur.id; removed := removed || cur.product_line;
    end if;
  end loop;

  -- the color's own line: keep it (and its price group), or hand over to another wanted line
  select x into nh from jsonb_array_elements(want) x where x ->> 'product_line' = s.product_line;
  if nh is null then
    removed := removed || s.product_line;
    select x into nh from jsonb_array_elements(want) x
     where exists (select 1 from public.swatch_links l where l.swatch_id = p_swatch and l.product_line = x ->> 'product_line') limit 1;
    if nh is null then nh := want -> 0; end if;
    delete from public.swatch_links where swatch_id = p_swatch and product_line = nh ->> 'product_line';
  end if;
  if (nh ->> 'product_line') <> s.product_line or (nh ->> 'fabric_id') <> s.fabric_id or (nh ->> 'family') is distinct from s.family then
    update public.swatches
       set product_line = nh ->> 'product_line', fabric_id = nh ->> 'fabric_id', family = nh ->> 'family',
           shown_in = (select array_agg(v) from jsonb_array_elements_text(nh -> 'shown_in') v)
     where id = p_swatch;
    select * into s from public.swatches where id = p_swatch;
  end if;

  -- link the rest
  for w in select x from jsonb_array_elements(want) x where x ->> 'product_line' <> s.product_line loop
    ln := w ->> 'product_line';
    select * into cur from public.swatch_links where swatch_id = p_swatch and product_line = ln;
    if found then
      if cur.fabric_id <> (w ->> 'fabric_id') or cur.family is distinct from (w ->> 'family') then
        update public.swatch_links set fabric_id = w ->> 'fabric_id', family = w ->> 'family' where id = cur.id;
      end if;
    else
      select coalesce(max(x), -1) + 1 into sort_n from (
        select sort_order x from public.swatches where fabric_id = w ->> 'fabric_id'
        union all select sort_order from public.swatch_links where fabric_id = w ->> 'fabric_id') t;
      insert into public.swatch_links (swatch_id, fabric_id, family, sort_order) values (p_swatch, w ->> 'fabric_id', w ->> 'family', sort_n);
      added := added || ln;
    end if;
  end loop;

  return jsonb_build_object('main', s.product_line, 'added', to_jsonb(added), 'removed', to_jsonb(removed),
    'lines', (select coalesce(jsonb_agg(l order by l), '[]'::jsonb) from (select s.product_line l union select product_line from public.swatch_links where swatch_id = p_swatch) t));
end $$;
revoke all on function public.set_swatch_lines(text, jsonb) from public, anon;
grant execute on function public.set_swatch_lines(text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. the customer catalog: no price group names or ids, no supplier color names, no grade, no extra cost
-- ---------------------------------------------------------------------------------------------
create or replace function public.public_catalog(p_scope text[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t.g order by t.pl, t.so, t.pk), '[]'::jsonb)
    from (
      select f.product_line as pl, f.sort_order as so, f.public_key as pk,
        jsonb_build_object(
          'id', f.public_key, 'product_line', f.product_line, 'shown_in', f.shown_in, 'family', f.family,
          'width', f.width, 'composition', f.composition, 'weight', f.weight, 'thickness', f.thickness,
          'openness', f.openness, 'opacity', f.opacity, 'use_area', f.use_area, 'extra_specs', f.extra_specs,
          'sort_order', f.sort_order,
          'swatches', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'id', s.id, 'fabric_id', f.public_key, 'product_line', f.product_line, 'shown_in', f.shown_in, 'family', x.family,
                     'display_name', s.display_name, 'supplier_code', s.supplier_code, 'color_family', s.color_family,
                     'image_path', s.image_path, 'thumb_path', s.thumb_path, 'image_kind', s.image_kind,
                     'width', s.width, 'composition', s.composition, 'roman_styles', s.roman_styles, 'styles', s.styles,
                     'sort_order', x.sort_order) order by x.sort_order, s.id)
              from (select sw.id, sw.family, sw.sort_order from public.swatches sw where sw.fabric_id = f.id
                    union all
                    select l.swatch_id, l.family, l.sort_order from public.swatch_links l where l.fabric_id = f.id and l.active) x
              join public.swatches s on s.id = x.id and s.active
          ), '[]'::jsonb)
        ) as g
        from public.fabrics f
       where f.active and f.shown_in && p_scope
    ) t;
$$;
revoke all on function public.public_catalog(text[]) from public;
grant execute on function public.public_catalog(text[]) to anon, authenticated;

-- (closing the public's direct reads of the tables is migration 11, to run when this branch is merged: the live site on main
-- still reads them.)

-- ---------------------------------------------------------------------------------------------
-- 6. prices for a picked color
-- ---------------------------------------------------------------------------------------------
-- where a color sits in a catalog line: its price group, family and extra cost. Null when it is not there or is hidden.
create or replace function public.swatch_placement(p_swatch text, p_catline text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('fabric_id', f.id, 'group_name', f.collection_name, 'family', x.family, 'extra', s.extra_cost, 'swatch_id', s.id)
    from public.swatches s
    join lateral (select s.fabric_id as fid, s.family from (select 1) z where s.product_line = p_catline
                  union all
                  select l.fabric_id, l.family from public.swatch_links l where l.swatch_id = s.id and l.product_line = p_catline and l.active) x on true
    join public.fabrics f on f.id = x.fid and f.active
   where s.id = p_swatch and s.active
   limit 1;
$$;
revoke all on function public.swatch_placement(text, text) from public, anon, authenticated;

-- the whole customer price for picked colors, with the parts kept apart (internal)
create or replace function public.price_for_swatch(p_line text, p_swatch text, p_opts jsonb, p_w numeric, p_h numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  catline text := case p_line when 'roman' then 'drapery' else p_line end;
  opts jsonb := coalesce(p_opts, '{}'::jsonb) - 'back_fabric_id';
  front jsonb; back jsonb; day jsonb; r jsonb; extra numeric; base numeric;
begin
  front := public.swatch_placement(p_swatch, catline);
  if front is null then return jsonb_build_object('status', 'no_color'); end if;
  if p_line = 'cellular' and front ->> 'family' is not null then opts := opts || jsonb_build_object('lining', front ->> 'family'); end if;
  if p_line = 'roller' and coalesce(opts ->> 'mode', '') = 'double-stack' and nullif(opts ->> 'back_swatch_id', '') is not null then
    back := public.swatch_placement(opts ->> 'back_swatch_id', 'roller');
    if back is null then return jsonb_build_object('status', 'no_color'); end if;
    opts := opts || jsonb_build_object('back_fabric_id', back ->> 'fabric_id');
  end if;
  if p_line = 'cellular' and nullif(opts ->> 'day_swatch_id', '') is not null then
    day := public.swatch_placement(opts ->> 'day_swatch_id', 'cellular');
  end if;
  r := public.price_breakdown(p_line, front ->> 'fabric_id', opts, p_w, p_h);
  if r ->> 'status' <> 'ok' then return r; end if;
  extra := coalesce((front ->> 'extra')::numeric, 0) + coalesce((back ->> 'extra')::numeric, 0) + coalesce((day ->> 'extra')::numeric, 0);
  base := (r ->> 'price')::numeric;
  return r || jsonb_build_object('price_before_extra', base, 'extra_cost', extra, 'price', round(base + extra),
    'price_group', jsonb_build_object('id', front ->> 'fabric_id', 'name', front ->> 'group_name'),
    'back_price_group', case when back is null then null else jsonb_build_object('id', back ->> 'fabric_id', 'name', back ->> 'group_name') end);
end $$;
revoke all on function public.price_for_swatch(text, text, jsonb, numeric, numeric) from public, anon, authenticated;

-- customers: the price, or that the size needs a quote. Nothing else leaves the database.
create or replace function public.estimate_price_for_swatch(p_line text, p_swatch_id text, p_options jsonb, p_width numeric, p_height numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  r := public.price_for_swatch(p_line, p_swatch_id, p_options, p_width, p_height);
  if r ->> 'status' = 'ok' then
    return jsonb_build_object('price', (r ->> 'price')::numeric, 'custom_size', false, 'price_on_request', false);
  elsif r ->> 'status' = 'price_on_request' then
    return jsonb_build_object('price', null, 'custom_size', false, 'price_on_request', true);
  end if;
  return jsonb_build_object('price', null, 'custom_size', true, 'price_on_request', false);
end $$;
revoke all on function public.estimate_price_for_swatch(text, text, jsonb, numeric, numeric) from public;
grant execute on function public.estimate_price_for_swatch(text, text, jsonb, numeric, numeric) to anon, authenticated;

-- the old price-group route (it takes price group ids, which customers no longer know) is for the admin price checker only
create or replace function public.estimate_price(p_line text, p_fabric_id text, p_options jsonb, p_width numeric, p_height numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  r := public.price_breakdown(p_line, p_fabric_id, coalesce(p_options, '{}'::jsonb), p_width, p_height);
  if r ->> 'status' = 'ok' then
    return jsonb_build_object('price', (r ->> 'price')::numeric, 'custom_size', false, 'price_on_request', false);
  elsif r ->> 'status' = 'price_on_request' then
    return jsonb_build_object('price', null, 'custom_size', false, 'price_on_request', true);
  end if;
  return jsonb_build_object('price', null, 'custom_size', true, 'price_on_request', false);
end $$;
revoke all on function public.estimate_price(text, text, jsonb, numeric, numeric) from public, anon;
grant execute on function public.estimate_price(text, text, jsonb, numeric, numeric) to authenticated;

-- the price checker: the same price, with the price group and the extra cost shown apart. Admins only.
create or replace function public.estimate_price_debug_for_swatch(p_line text, p_swatch_id text, p_options jsonb, p_width numeric, p_height numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  return public.price_for_swatch(p_line, p_swatch_id, p_options, p_width, p_height);
end $$;
revoke all on function public.estimate_price_debug_for_swatch(text, text, jsonb, numeric, numeric) from public, anon;
grant execute on function public.estimate_price_debug_for_swatch(text, text, jsonb, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. order emails and old orders: the server looks up names with the service role (already has table access)
-- ---------------------------------------------------------------------------------------------
grant select, insert, update, delete on public.swatch_links to service_role;
