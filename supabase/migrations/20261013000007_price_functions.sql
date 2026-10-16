-- Price lookup and import. Cost data never leaves the database except through estimate_price_debug(), which checks is_admin().
-- Customers (later) call estimate_price(), which returns only {price, custom_size, price_on_request}.

-- numbers inside a text like '98 in / 118 in'
create or replace function public.roll_numbers(t text) returns numeric[]
language sql immutable as $$
  select coalesce(array_agg(m[1]::numeric), '{}') from regexp_matches(coalesce(t, ''), '(\d+(?:\.\d+)?)', 'g') as m;
$$;

revoke all on function public.roll_numbers(text) from public, anon, authenticated;

-- one lookup in one grid: round both sizes UP to the next axis value
create or replace function public.grid_lookup(g public.price_grids, p_w numeric, p_h numeric) returns jsonb
language plpgsql immutable set search_path = public as $$
declare rv numeric; cv numeric; ri int; ci int; v numeric;
begin
  if g.rows_are = 'width' then rv := p_w; cv := p_h; else rv := p_h; cv := p_w; end if;
  select min(i) into ri from generate_subscripts(g.row_axis, 1) i where g.row_axis[i] >= rv - 0.0001;
  select min(i) into ci from generate_subscripts(g.col_axis, 1) i where g.col_axis[i] >= cv - 0.0001;
  if ri is null or ci is null then return jsonb_build_object('ok', false, 'reason', 'outside_grid'); end if;
  v := g.cost[(ri - 1) * cardinality(g.col_axis) + ci];
  if v is null then
    return jsonb_build_object('ok', false, 'reason', 'no_price_in_grid', 'row_index', ri, 'col_index', ci);
  end if;
  return jsonb_build_object('ok', true, 'row_index', ri, 'col_index', ci, 'cost', v,
    'row_value', g.row_axis[ri], 'col_value', g.col_axis[ci],
    'width_used',  case when g.rows_are = 'width' then g.row_axis[ri] else g.col_axis[ci] end,
    'height_used', case when g.rows_are = 'width' then g.col_axis[ci] else g.row_axis[ri] end);
end $$;

revoke all on function public.grid_lookup(public.price_grids, numeric, numeric) from public, anon, authenticated;

-- one shade: full breakdown (internal)
create or replace function public.price_single(p_line text, p_fabric text, p_opts jsonb, p_w numeric, p_h numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pl public.pricing_lines; pr public.product_lines;
  v_control text; sys text; v_variant text; v_lining text;
  g public.price_grids; sp public.price_grids; lk jsonb; used_special boolean := false;
  ext jsonb; a record; adders jsonb := '[]'::jsonb; add_total numeric := 0; sub_total numeric := 0; missing text[] := '{}';
  amt numeric; sqft numeric; mk numeric; mk_src text; cost numeric; subtotal numeric; exact numeric;
  sheet_rolls numeric[]; our_rolls numeric[]; eff numeric; roll_info jsonb; gfab public.grid_fabrics;
begin
  select * into pl from public.pricing_lines where id = p_line;
  if not found then return jsonb_build_object('status', 'unknown_line'); end if;
  select * into pr from public.product_lines where id = pl.product_line_id;
  if found and pr.price_on_request and pl.id = pl.product_line_id then return jsonb_build_object('status', 'price_on_request'); end if;
  if p_w is null or p_h is null or p_w <= 0 or p_h <= 0 then return jsonb_build_object('status', 'custom_size', 'reason', 'no_size'); end if;

  v_control := p_opts ->> 'control';
  select ov.grid_system into sys
    from public.option_values ov join public.option_groups og on og.id = ov.group_id
   where og.line_id = pl.product_line_id and og.key = 'control' and ov.code = v_control;
  if sys is null and v_control in ('cord','cordless','motor','manual') then sys := v_control; end if;
  if sys is null then return jsonb_build_object('status', 'no_control_mapping', 'control', v_control); end if;
  v_variant := coalesce(nullif(p_opts ->> 'type', ''), 'all');
  v_lining := nullif(p_opts ->> 'lining', '');

  -- the standard grid for this collection, system, variant and lining
  select gg.* into g
    from public.price_grids gg
   where gg.line_id = p_line and gg.active and not gg.special and sys = any (gg.systems)
     and (gg.variant = 'all' or gg.variant = v_variant)
     and (gg.lining is null or gg.lining = v_lining)
     and (gg.scope = 'line' or exists (select 1 from public.grid_fabrics gf where gf.grid_id = gg.id and gf.fabric_id = p_fabric))
   order by (gg.scope = 'fabric') desc limit 1;
  if g.id is null then return jsonb_build_object('status', 'no_grid', 'system', sys, 'variant', v_variant, 'lining', v_lining); end if;

  lk := public.grid_lookup(g, p_w, p_h);
  if not (lk ->> 'ok')::boolean then
    -- past the standard grid: a special-size grid may cover it (Zebra x1.1)
    select gg.* into sp
      from public.price_grids gg
     where gg.line_id = p_line and gg.active and gg.special and sys = any (gg.systems)
       and (gg.variant = 'all' or gg.variant = v_variant) and (gg.lining is null or gg.lining = v_lining)
       and (gg.scope = 'line' or exists (select 1 from public.grid_fabrics gf where gf.grid_id = gg.id and gf.fabric_id = p_fabric))
     limit 1;
    if sp.id is not null then
      lk := public.grid_lookup(sp, p_w, p_h);
      if (lk ->> 'ok')::boolean then g := sp; used_special := true; end if;
    end if;
  end if;
  if not (lk ->> 'ok')::boolean then
    return jsonb_build_object('status', 'custom_size', 'reason', lk ->> 'reason', 'grid_id', g.id, 'grid_label', g.label);
  end if;

  -- the supplier's own limit for this collection (Shangri-La "Max Length")
  select * into gfab from public.grid_fabrics where grid_id = g.id and fabric_id = p_fabric;
  if gfab.max_drop is not null and (lk ->> 'height_used')::numeric > gfab.max_drop and p_h > gfab.max_drop then
    return jsonb_build_object('status', 'custom_size', 'reason', 'max_length', 'max_drop', gfab.max_drop, 'grid_id', g.id, 'grid_label', g.label);
  end if;

  -- roll width: the smaller of what the sheet says and what our catalog says
  select public.roll_numbers(f.width) into our_rolls from public.fabrics f where f.id = p_fabric;
  sheet_rolls := coalesce(nullif(gfab.sheet_rolls, '{}'), g.roll_widths);
  select min(x) into eff from unnest(coalesce(sheet_rolls, '{}') || coalesce(our_rolls, '{}')) x;
  roll_info := jsonb_build_object('sheet', to_jsonb(sheet_rolls), 'ours', to_jsonb(coalesce(our_rolls, '{}')), 'effective', eff);
  if eff is not null and pl.roll_rule is not null then
    if (pl.roll_rule = 'width' and p_w > eff) or (pl.roll_rule = 'either' and p_w > eff and p_h > eff) then
      return jsonb_build_object('status', 'custom_size', 'reason', 'roll_width', 'roll', roll_info, 'grid_id', g.id, 'grid_label', g.label);
    end if;
  end if;

  cost := (lk ->> 'cost')::numeric * g.multiplier;
  ext := coalesce(p_opts, '{}'::jsonb) || jsonb_build_object('grid_system', sys);
  sqft := ((lk ->> 'width_used')::numeric * (lk ->> 'height_used')::numeric) / 144.0;
  for a in select * from public.price_adders pa where pa.line_id = p_line and pa.active order by pa.adder_key loop
    -- every condition must match; an option that was not supplied never matches (NULL counts as no)
    if not exists (select 1 from jsonb_each(a.applies_when) c
                    where not coalesce((ext ->> c.key) in (select jsonb_array_elements_text(c.value)), false)) then
      if a.amount is null then
        missing := missing || a.label;
        adders := adders || jsonb_build_array(jsonb_build_object('label', a.label, 'kind', a.kind, 'amount', null, 'status', a.status, 'missing', true));
      else
        amt := a.amount * case when a.unit = 'per_sqft' then sqft else 1 end;
        if a.kind = 'add' then add_total := add_total + amt; else sub_total := sub_total + amt; end if;
        adders := adders || jsonb_build_array(jsonb_build_object('label', a.label, 'kind', a.kind, 'amount', round(amt, 2), 'unit', a.unit, 'status', a.status));
      end if;
    end if;
  end loop;
  subtotal := greatest(cost + add_total - sub_total, 0);

  select cm.markup, 'collection' into mk, mk_src from public.collection_markups cm where cm.fabric_id = p_fabric;
  if mk is null then mk := pl.markup; mk_src := 'line'; end if;
  exact := subtotal * (1 + mk);

  return jsonb_build_object(
    'status', case when cardinality(missing) > 0 then 'incomplete' else 'ok' end,
    'missing', to_jsonb(missing),
    'price', round(exact), 'price_exact', round(exact, 4),
    'grid_cost', (lk ->> 'cost')::numeric, 'multiplier', g.multiplier, 'cost', round(cost, 4),
    'adders', adders, 'adders_add', round(add_total, 4), 'adders_subtract', round(sub_total, 4),
    'subtotal', round(subtotal, 4), 'markup', mk, 'markup_source', mk_src,
    'system', sys, 'variant', v_variant, 'lining', v_lining, 'used_special_grid', used_special,
    'size_used', jsonb_build_object('width', lk -> 'width_used', 'height', lk -> 'height_used', 'asked_width', p_w, 'asked_height', p_h),
    'roll', roll_info,
    'grid', jsonb_build_object('id', g.id, 'label', g.label, 'source_file', g.source_file, 'source_sheet', g.source_sheet,
       'rows_are', g.rows_are, 'row_index', lk -> 'row_index', 'col_index', lk -> 'col_index',
       'row_value', lk -> 'row_value', 'col_value', lk -> 'col_value', 'origin_row', g.origin_row, 'origin_col', g.origin_col));
end $$;
revoke all on function public.price_single(text, text, jsonb, numeric, numeric) from public, anon, authenticated;

-- one order line: a roller double-stack is the front shade plus the back shade
create or replace function public.price_breakdown(p_line text, p_fabric text, p_opts jsonb, p_w numeric, p_h numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare front jsonb; back jsonb;
begin
  front := public.price_single(p_line, p_fabric, p_opts, p_w, p_h);
  if coalesce(p_opts ->> 'mode', '') = 'double-stack' and nullif(p_opts ->> 'back_fabric_id', '') is not null then
    back := public.price_single(p_line, p_opts ->> 'back_fabric_id', p_opts, p_w, p_h);
    if front ->> 'status' <> 'ok' then return front || jsonb_build_object('which', 'front'); end if;
    if back ->> 'status' <> 'ok' then return back || jsonb_build_object('which', 'back'); end if;
    return jsonb_build_object('status', 'ok', 'double_stack', true,
      'price', (front ->> 'price')::numeric + (back ->> 'price')::numeric, 'front', front, 'back', back);
  end if;
  return front;
end $$;
revoke all on function public.price_breakdown(text, text, jsonb, numeric, numeric) from public, anon, authenticated;

-- what a customer may learn: the final price, or that the size needs a quote. Nothing else.
create or replace function public.estimate_price(p_line text, p_fabric_id text, p_options jsonb, p_width numeric, p_height numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  r := public.price_breakdown(p_line, p_fabric_id, coalesce(p_options, '{}'::jsonb), p_width, p_height);
  if r ->> 'status' = 'ok' then
    return jsonb_build_object('price', (r ->> 'price')::numeric, 'custom_size', false, 'price_on_request', false);
  elsif r ->> 'status' = 'price_on_request' then
    return jsonb_build_object('price', null, 'custom_size', false, 'price_on_request', true);
  end if;
  return jsonb_build_object('price', null, 'custom_size', true, 'price_on_request', false);
end $$;
revoke all on function public.estimate_price(text, text, jsonb, numeric, numeric) from public;
grant execute on function public.estimate_price(text, text, jsonb, numeric, numeric) to anon, authenticated;

-- the price checker: cost, grid cell, adders, markup, final price. Admins only.
create or replace function public.estimate_price_debug(p_line text, p_fabric_id text, p_options jsonb, p_width numeric, p_height numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  return public.price_breakdown(p_line, p_fabric_id, coalesce(p_options, '{}'::jsonb), p_width, p_height);
end $$;
revoke all on function public.estimate_price_debug(text, text, jsonb, numeric, numeric) from public, anon;
grant execute on function public.estimate_price_debug(text, text, jsonb, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Import: the admin page (is_admin) and the one-time import script (service role) both call this.
-- Grids are matched by grid_key, so a re-import updates them in place. Large imports arrive in several calls.
-- ---------------------------------------------------------------------------------------------
create or replace function public.price_import_apply(p_line text, p_grids jsonb, p_remove_keys text[], p_adders jsonb, p_meta jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  g jsonb; gf jsonb; gid uuid; n_new int := 0; n_upd int := 0; n_del int := 0; n_add int := 0; n_fab int := 0;
  seen_keys text[] := '{}';
begin
  if not (public.is_admin() or coalesce(claims ->> 'role', '') = 'service_role') then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.pricing_lines where id = p_line) then raise exception 'unknown pricing line %', p_line; end if;

  for g in select * from jsonb_array_elements(coalesce(p_grids, '[]'::jsonb)) loop
    seen_keys := seen_keys || (g ->> 'grid_key');
  end loop;
  -- release the collections of the grids being replaced, so collections can move between grids in one import
  delete from public.grid_fabrics where grid_id in (select id from public.price_grids where line_id = p_line and grid_key = any (seen_keys));

  for g in select * from jsonb_array_elements(coalesce(p_grids, '[]'::jsonb)) loop
    select id into gid from public.price_grids where grid_key = g ->> 'grid_key';
    if gid is null then
      insert into public.price_grids (grid_key, line_id, systems, variant, lining, scope, special, multiplier, label, roll_widths, rows_are,
                                      row_axis, col_axis, cost, source_file, source_sheet, source_title, origin_row, origin_col, anomalies)
      values (g ->> 'grid_key', p_line, array(select jsonb_array_elements_text(g -> 'systems')), coalesce(g ->> 'variant', 'all'), nullif(g ->> 'lining', ''),
              coalesce(g ->> 'scope', 'fabric'), coalesce((g ->> 'special')::boolean, false), coalesce((g ->> 'multiplier')::numeric, 1), g ->> 'label',
              coalesce(array(select x::numeric from jsonb_array_elements_text(g -> 'roll_widths') x), '{}'), g ->> 'rows_are',
              array(select x::numeric from jsonb_array_elements_text(g -> 'row_axis') x),
              array(select x::numeric from jsonb_array_elements_text(g -> 'col_axis') x),
              (select array_agg(x::numeric order by ord) from jsonb_array_elements_text(g -> 'cost') with ordinality t(x, ord)),
              g ->> 'source_file', g ->> 'source_sheet', g ->> 'source_title', (g ->> 'origin_row')::int, (g ->> 'origin_col')::int,
              coalesce(g -> 'anomalies', '[]'::jsonb))
      returning id into gid;
      n_new := n_new + 1;
    else
      update public.price_grids set
        systems = array(select jsonb_array_elements_text(g -> 'systems')), variant = coalesce(g ->> 'variant', 'all'), lining = nullif(g ->> 'lining', ''),
        scope = coalesce(g ->> 'scope', 'fabric'), special = coalesce((g ->> 'special')::boolean, false), multiplier = coalesce((g ->> 'multiplier')::numeric, 1),
        label = g ->> 'label', roll_widths = coalesce(array(select x::numeric from jsonb_array_elements_text(g -> 'roll_widths') x), '{}'),
        rows_are = g ->> 'rows_are', row_axis = array(select x::numeric from jsonb_array_elements_text(g -> 'row_axis') x),
        col_axis = array(select x::numeric from jsonb_array_elements_text(g -> 'col_axis') x),
        cost = (select array_agg(x::numeric order by ord) from jsonb_array_elements_text(g -> 'cost') with ordinality t(x, ord)),
        source_file = g ->> 'source_file', source_sheet = g ->> 'source_sheet', source_title = g ->> 'source_title',
        origin_row = (g ->> 'origin_row')::int, origin_col = (g ->> 'origin_col')::int, anomalies = coalesce(g -> 'anomalies', '[]'::jsonb)
       where id = gid;
      n_upd := n_upd + 1;
    end if;
    for gf in select * from jsonb_array_elements(coalesce(g -> 'fabrics', '[]'::jsonb)) loop
      insert into public.grid_fabrics (grid_id, fabric_id, sheet_rolls, max_drop)
      values (gid, gf ->> 'fabric_id', coalesce(array(select x::numeric from jsonb_array_elements_text(gf -> 'roll_widths') x), '{}'), (gf ->> 'max_drop')::numeric)
      on conflict (grid_id, fabric_id) do update set sheet_rolls = excluded.sheet_rolls, max_drop = excluded.max_drop;
      n_fab := n_fab + 1;
    end loop;
  end loop;

  if p_remove_keys is not null and cardinality(p_remove_keys) > 0 then
    delete from public.price_grids where line_id = p_line and grid_key = any (p_remove_keys);
    get diagnostics n_del = row_count;
  end if;

  if p_adders is not null then
    for g in select * from jsonb_array_elements(p_adders) loop
      insert into public.price_adders (line_id, adder_key, label, kind, amount, unit, applies_when, origin, status, source, note)
      values (p_line, g ->> 'adder_key', g ->> 'label', g ->> 'kind', (g ->> 'amount')::numeric, coalesce(g ->> 'unit', 'flat'),
              coalesce(g -> 'applies_when', '{}'::jsonb), 'sheet', 'from_sheet', g ->> 'source', g ->> 'note')
      on conflict (line_id, adder_key) do update set
        label = excluded.label, kind = excluded.kind, amount = excluded.amount, unit = excluded.unit,
        applies_when = excluded.applies_when, source = excluded.source, note = excluded.note, status = 'from_sheet'
        where public.price_adders.origin = 'sheet';
      n_add := n_add + 1;
    end loop;
    delete from public.price_adders
     where line_id = p_line and origin = 'sheet' and adder_key <> all (array(select a ->> 'adder_key' from jsonb_array_elements(p_adders) a));
  end if;

  if p_meta is not null then
    insert into public.price_imports (line_id, file_name, file_sha256, summary, created_by)
    values (p_line, p_meta ->> 'file_name', p_meta ->> 'sha256', coalesce(p_meta -> 'summary', '{}'::jsonb), auth.uid());
  end if;
  return jsonb_build_object('grids_added', n_new, 'grids_updated', n_upd, 'grids_removed', n_del, 'collections_linked', n_fab, 'adders', n_add);
end $$;
revoke all on function public.price_import_apply(text, jsonb, text[], jsonb, jsonb) from public, anon;
grant execute on function public.price_import_apply(text, jsonb, text[], jsonb, jsonb) to authenticated, service_role;
