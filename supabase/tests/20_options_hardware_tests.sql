-- LOCAL throwaway Postgres only: migrations 1 to 11, 20_fixtures_options.sql, then migrations 20 and 21. Prints one line per check; any failure raises.
do $$
declare r jsonb; n int; ok boolean;
  procedure_ok text;
begin
  -- Zero gravity = Cordless = Free-stop: priced from the cordless table on each line, with no adder anywhere; Shangri-La has none
  if exists (select 1 from public.price_adders where adder_key = 'zero-gravity') then raise exception 'there must be no zero gravity adder'; end if;
  select count(*) into n from public.option_values where code = 'zero-gravity' and grid_system = 'cordless' and group_id in ('roller:control','zebra:control','roman:control','cellular:control');
  if n <> 4 then raise exception 'zero gravity grid: % (want 4 on the cordless table)', n; end if;
  if exists (select 1 from public.option_values where code = 'zero-gravity' and group_id = 'shangri-la:control') then raise exception 'shangri-la has no zero gravity'; end if;
  raise notice 'ok: Zero gravity uses the cordless table on Roller, Zebra, Roman and Cellular, no adder, none on Shangri-La';

  -- the 2 in 1 motor costs $70 like every motor; its grid is the plain (cord) table
  if not exists (select 1 from public.price_adders where line_id = 'roller' and adder_key = 'motor-two-in-one' and amount = 70) then raise exception '2 in 1 motor adder'; end if;
  if (select grid_system from public.option_values where id = 'roller:control:two-in-one') <> 'cord' then raise exception '2 in 1 grid'; end if;
  raise notice 'ok: 2 in 1 motor $70 on the cord table';

  -- Cordless retired (step B), Zero gravity is the default, and Best value is on Zero gravity wherever it exists
  if exists (select 1 from public.option_values where code = 'cordless' and active) then raise exception 'cordless still active'; end if;
  for procedure_ok in select unnest(array['roller','zebra','roman','cellular']) loop
    if not (select is_default from public.option_values where id = procedure_ok || ':control:zero-gravity') then raise exception '% default', procedure_ok; end if;
    if not (select best_value from public.option_values where id = procedure_ok || ':control:zero-gravity') then raise exception '% best value', procedure_ok; end if;
  end loop;
  if exists (select 1 from public.option_values where best_value and (group_id like 'shangri-la:%' or group_id like 'drapery:%')) then raise exception 'best value on shangri-la or drapery'; end if;
  raise notice 'ok: Cordless retired, Zero gravity default and Best value on the four lines, none on Shangri-La / Dream Curtains';

  -- one Best value per line: setting another clears the first
  update public.option_values set best_value = true where id = 'roller:control:motorized';
  select count(*) into n from public.option_values where best_value and group_id = 'roller:control';
  if n <> 1 or not (select best_value from public.option_values where id = 'roller:control:motorized') then raise exception 'one best value per line: %', n; end if;
  update public.option_values set best_value = true where id = 'roller:control:zero-gravity';
  if (select best_value from public.option_values where id = 'roller:control:motorized') then raise exception 'old best value not cleared'; end if;
  begin
    update public.option_values set best_value = true where id = 'roller:chain-color:white';
    raise exception 'best value outside the movement group was accepted';
  exception when check_violation then null; end;
  raise notice 'ok: one Best value per line, movement options only';

  -- Top of the line: Motorized by default, one per line, movement options only, independent of Best value
  for procedure_ok in select unnest(array['roller','zebra','shangri-la','roman','cellular','drapery']) loop
    if not (select top_of_line from public.option_values where id = procedure_ok || ':control:motorized') then raise exception '% top of the line', procedure_ok; end if;
  end loop;
  update public.option_values set top_of_line = true where id = 'roller:control:two-in-one';
  select count(*) into n from public.option_values where top_of_line and group_id = 'roller:control';
  if n <> 1 or (select top_of_line from public.option_values where id = 'roller:control:motorized') then raise exception 'one top of the line per line'; end if;
  update public.option_values set top_of_line = true where id = 'roller:control:motorized';
  begin update public.option_values set top_of_line = true where id = 'roller:chain-color:white'; raise exception 'top of the line outside movement'; exception when check_violation then null; end;
  if not (select best_value from public.option_values where id = 'roller:control:zero-gravity') then raise exception 'best value disturbed'; end if;
  raise notice 'ok: Top of the line defaults to Motorized, one per line, movement options only';

  -- curtain fabric prices: the supplier's own quotes (fabric / shipping) within $1
  declare q record; x jsonb; begin
    for q in select * from (values
      ('SP26057003', 2.6, 'pleated', 'none', 87, 84, 98.61, 56.11), ('SP26047001', 3.5, 'pleated', 'none', 130, 100, 291.84, 161.42),
      ('SP26015008', 2, 'grommet', 'none', 66, 90, 122.63, 69.75), ('SP26029001', 4, 'pleated', 'none', 200, 150, 767.71, 361.90),
      ('SP2605001', 3, 'pleated', 'blackout', 100, 96, 204.23, 104.10), ('SP2605001', 2.8, 'ripple-hook', 'none', 150, 96, 169.15, 67.03)) as t(code, f, fam, lin, w, h, fab, shp) loop
      x := public.drapery_parts(null, jsonb_build_object('code', q.code, 'fullness', q.f, 'style_family', q.fam, 'lining', q.lin), q.w, q.h);
      if x ->> 'status' <> 'ok' then raise exception 'curtain price % : %', q.code, x; end if;
      -- the supplier's "fabric" figure includes the liner when there is one
      if abs((x ->> 'fabric')::numeric + (x ->> 'liner')::numeric - q.fab) > 1 or abs((x ->> 'shipping')::numeric - q.shp) > 1 then
        raise exception 'quote % %x %x%: fabric %+% (want %), shipping % (want %)', q.code, q.f, q.w, q.h, x ->> 'fabric', x ->> 'liner', q.fab, x ->> 'shipping', q.shp;
      end if;
      raise notice 'quote % % % x %: fabric % + liner % (supplier %), shipping % (supplier %)', q.code, q.f, q.w, q.h, x ->> 'fabric', x ->> 'liner', q.fab, x ->> 'shipping', q.shp;
    end loop;
  end;
  -- sizes outside 40 to 236 wide and 42 to 236 high are by email; a code with no price is by email; the answer has only the price
  if not (public.drapery_estimate(null, '{"code":"SP26057003","fullness":2.6}', 39, 84) ->> 'price_on_request')::boolean or not (public.drapery_estimate(null, '{"code":"SP26057003","fullness":2.6}', 87, 41) ->> 'price_on_request')::boolean
     or not (public.drapery_estimate(null, '{"code":"SP26057003","fullness":2.6}', 237, 84) ->> 'price_on_request')::boolean or not (public.drapery_estimate(null, '{"code":"SP26057003","fullness":2.6}', 87, 237) ->> 'price_on_request')::boolean
     or not (public.drapery_estimate(null, '{"code":"SP26030004","fullness":2.6}', 87, 84) ->> 'price_on_request')::boolean then raise exception 'drapery limits'; end if;
  if public.drapery_estimate(null, '{"code":"SP26057003","fullness":2.6}', 87, 84) - 'price' <> '{}'::jsonb then raise exception 'drapery estimate leaks'; end if;
  if (public.drapery_estimate(null, '{"code":"SP26057003","fullness":2.6,"lining":"blackout"}', 87, 84) ->> 'price')::numeric <> (public.drapery_estimate(null, '{"code":"SP26057003","fullness":2.6,"lining":"light-filtering"}', 87, 84) ->> 'price')::numeric then raise exception 'liners cost the same'; end if;
  if (select count(*) from public.drapery_fabrics) <> 129 or (select count(*) from public.drapery_tiers) <> 8 then raise exception 'drapery tables'; end if;
  raise notice 'ok: curtain fabric prices reproduce the six supplier quotes within $1, limits and privacy hold';

  -- the Zigbee hub: a flat $35 selling price, editable, readable by customers only through zigbee_hub_price(), no markup
  if (public.zigbee_hub_price() ->> 'price')::numeric <> 35 or public.zigbee_hub_price() - 'price' <> '{}'::jsonb then raise exception 'hub price'; end if;
  update public.hardware_rates set amount = 40 where id = 'zigbee_hub';
  if (public.zigbee_hub_price() ->> 'price')::numeric <> 40 then raise exception 'hub price not editable'; end if;
  update public.hardware_rates set amount = 35 where id = 'zigbee_hub';
  raise notice 'ok: the Zigbee hub is a flat $35 customer price in the database, editable, no markup';

  -- the four zero gravity flags are resolved
  if exists (select 1 from public.price_flags where flag_key like '%zero-gravity-price' and not resolved) then raise exception 'zero gravity flags open'; end if;

  -- hardware: the owner's two check numbers (cost before markup)
  r := public.hardware_parts('{"track":"arc-rail","style_family":"pleated"}', 100);
  raise notice 'arc rail 100 in: len % m, track $%, weight % kg, shipping $%, cost $%, customer price $%', r->>'meters', r->>'track_cost', r->>'weight_kg', r->>'shipping', r->>'cost', r->>'price';
  if abs((r->>'cost')::numeric - 90) > 0.05 then raise exception 'arc rail 100 in should cost about $90, got %', r->>'cost'; end if;
  r := public.hardware_parts('{"track":"motorized-rail","style_family":"pleated"}', 100);
  raise notice 'motorized rail 100 in (pleated): track $%, motor $%, weight % kg, shipping $%, cost $%', r->>'track_cost', r->>'motor', r->>'weight_kg', r->>'shipping', r->>'cost';
  r := public.hardware_parts('{"track":"motorized-rail","style_family":"ripple-hook"}', 100);
  raise notice 'motorized rail 100 in (ripple): cost $%', r->>'cost';

  -- rules: elegance adds 0.35 m; 2 tubes above 4.5 m; double = two tracks; finial $18 once; motorized refuses grommet and rod pocket
  r := public.hardware_parts('{"track":"elegance-rod","style_family":"pleated"}', 100);
  if abs((r->>'meters')::numeric - 2.89) > 0.0001 then raise exception 'elegance length %', r->>'meters'; end if;
  r := public.hardware_parts('{"track":"arc-rail","style_family":"pleated"}', 200);       -- 5.08 m
  if (r->>'tubes')::int <> 2 then raise exception 'tubes %', r->>'tubes'; end if;
  if (public.hardware_parts('{"track":"arc-rail","style_family":"pleated","layers":"double"}', 100)->>'cost')::numeric
     <> 2 * (public.hardware_parts('{"track":"arc-rail","style_family":"pleated"}', 100)->>'cost')::numeric then raise exception 'double'; end if;
  if (public.hardware_parts('{"track":"elegance-rod","style_family":"pleated","finial":"premium"}', 100)->>'finial')::numeric <> 18 then raise exception 'finial'; end if;
  if (public.hardware_parts('{"track":"elegance-rod","style_family":"pleated","finial":"classic"}', 100)->>'finial')::numeric <> 0 then raise exception 'plain finial'; end if;
  if not (public.hardware_estimate('{"track":"motorized-rail","style_family":"grommet"}', 100) ->> 'not_available')::boolean then raise exception 'motorized grommet'; end if;
  raise notice 'ok: elegance +0.35 m, 2 tubes over 4.5 m, double = two tracks, finial $18 once, no motorized grommet / rod pocket';

  -- what a customer gets back is only the price
  r := public.hardware_estimate('{"track":"arc-rail","style_family":"pleated"}', 100);
  if r - 'price' <> '{}'::jsonb then raise exception 'estimate leaks: %', r; end if;
  raise notice 'ok: hardware_estimate returns only {price}: %', r;

  -- the admin-editable rates change the price
  update public.hardware_rates set amount = 11.03 * 2 where id = 'ship_per_kg';
  if (public.hardware_parts('{"track":"arc-rail","style_family":"pleated"}', 100)->>'cost')::numeric < 120 then raise exception 'rate edit ignored'; end if;
  update public.hardware_rates set amount = 11.03 where id = 'ship_per_kg';

  -- customers read the options only through public_options(): on/off and Best value
  r := public.public_options('roller');
  if not exists (select 1 from jsonb_array_elements(r) e where e->>'group' = 'control' and e->>'code' = 'zero-gravity' and (e->>'best')::boolean) then raise exception 'public_options best'; end if;
  if not exists (select 1 from jsonb_array_elements(r) e where e->>'code' = 'motorized' and (e->>'top')::boolean) then raise exception 'public_options top'; end if;
  if exists (select 1 from jsonb_array_elements(r) e where e->>'code' = 'cordless' and (e->>'active')::boolean) then raise exception 'public_options cordless'; end if;
  raise notice 'ok: public_options shows Zero gravity as Best value and Cordless off';
end $$;

-- the public cannot read the rates or the breakdown
set role anon;
do $$ begin
  begin perform 1 from public.drapery_fabrics; raise exception 'anon read drapery_fabrics'; exception when insufficient_privilege then null; end;
  begin perform public.drapery_parts(null, '{}', 1, 1); raise exception 'anon ran drapery_parts'; exception when insufficient_privilege then null; end;
  begin perform public.drapery_breakdown(null, '{}', 1, 1); raise exception 'anon ran drapery_breakdown'; exception when insufficient_privilege then null; end;
  perform public.drapery_estimate(null, '{}', 100, 100);
  perform public.zigbee_hub_price();
  begin perform 1 from public.hardware_rates; raise exception 'anon read hardware_rates'; exception when insufficient_privilege then null; end;
  begin perform public.hardware_breakdown('{}', 1); raise exception 'anon ran hardware_breakdown'; exception when insufficient_privilege then null; end;
  begin perform public.hardware_parts('{}', 1); raise exception 'anon ran hardware_parts'; exception when insufficient_privilege then null; end;
  perform public.hardware_estimate('{"track":"arc-rail"}', 100);
  perform public.public_options('roller');
  raise notice 'ok: anon cannot read the rates, the breakdown or the cost parts; can call hardware_estimate and public_options';
end $$;
reset role;

-- the Zigbee hub choice is saved with the account's order, and neither it nor the price it was sent at can change once the order is sent.
-- (The local orders table is a two-column stub, so the columns migration 13 relies on are added here and the guard trigger is attached.)
do $$
declare v_hub boolean;
begin
  alter table public.orders add column if not exists status text default 'draft', add column if not exists customer jsonb, add column if not exists user_id uuid;
  drop trigger if exists orders_sent_guard on public.orders;
  create trigger orders_sent_guard before update on public.orders for each row execute function public.orders_sent_guard();
  if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'hub' and data_type = 'boolean') then raise exception 'orders.hub missing'; end if;
  insert into public.orders (id, items, status) values ('00000000-0000-0000-0000-0000000000a1', '[]', 'draft');
  update public.orders set hub = true where id = '00000000-0000-0000-0000-0000000000a1';
  select hub into v_hub from public.orders where id = '00000000-0000-0000-0000-0000000000a1';
  if v_hub is not true then raise exception 'the hub tick was not saved'; end if;
  update public.orders set hub = false where id = '00000000-0000-0000-0000-0000000000a1';
  update public.orders set status = 'sent', hub = true, hub_price = 35 where id = '00000000-0000-0000-0000-0000000000a1';
  begin update public.orders set hub = false where id = '00000000-0000-0000-0000-0000000000a1'; raise exception 'a sent order lost its hub'; exception when check_violation then null; end;
  begin update public.orders set hub_price = 1 where id = '00000000-0000-0000-0000-0000000000a1'; raise exception 'a sent order changed its hub price'; exception when check_violation then null; end;
  delete from public.orders where id = '00000000-0000-0000-0000-0000000000a1';
  raise notice 'ok: orders.hub saves on a draft, is set with hub_price when sent, and is frozen after sending';
end $$;
