-- Migration 17, STEP A of 2: new movement/motor options and the new costs. ADDITIVE ONLY, so it is safe to run
-- while the live site still runs the old code: the old site never sends the new codes, so none of the new rows are used until the new site is deployed.
-- Run STEP B (migration 18) only after the new site is deployed.
-- Idempotent: safe to re-run.
--
-- Pricing rules this sets up (all costs are before the 1.5x markup):
--   Movement "motorized" prices from the plain table of the line (Roller, Zebra, Shangri-La, Cellular: the chain/cord table; Roman: its cordless table) + $70 motor
--   (battery or wired, any of the four controls). "Solar panel" +$30 (battery motors only). Double-stack prices both shades, so it gets two motors and two panels.
--   "zero-gravity" is priced like the plain table with NO extra charge, until the owner confirms the supplier price (see the price flags).

-- 1. movement values (the Control group keeps its old values for now; STEP B retires them)
insert into public.option_values (id, group_id, code, label, explanation, grid_system, active, is_default, sort_order)
select g.line || ':control:' || v.code, g.line || ':control', v.code, v.label, v.expl,
       case when v.code = 'motorized' then g.motor_sys else g.zg_sys end, true, false, v.sort
  from (values ('roller','cord','cord'), ('zebra','cord','cord'), ('shangri-la','cord','cord'), ('roman','cordless','cordless'), ('cellular','cord','cord')) as g(line, motor_sys, zg_sys)
  cross join (values
    ('zero-gravity', 'Zero gravity', 'Grab the bottom rail and move it to any height. Let go and it stays right there.', 20),
    ('motorized', 'Motorized', 'Raise and lower with a remote or your phone, no pulling.', 21)) as v(code, label, expl, sort)
 where not (g.line = 'shangri-la' and v.code = 'zero-gravity')
on conflict (id) do nothing;

-- Shangri-La also gets Chain (priced from its plain table, as the old Remote wand was before the $100)
insert into public.option_values (id, group_id, code, label, explanation, grid_system, active, is_default, sort_order)
values ('shangri-la:control:chain', 'shangri-la:control', 'chain', 'Chain', 'Pull the beaded chain loop to raise and lower.', 'cord', true, false, 22)
on conflict (id) do nothing;

-- 2. the motor choices (the site shows them in code; these rows are for the admin Options tab)
insert into public.option_groups (id, line_id, key, label, note, bound, sort_order)
select l.id || ':' || k.key, l.id, k.key, k.label, k.note, true, k.sort
  from public.product_lines l
  cross join (values
    ('power', 'Motor power', 'Battery motors are recharged about every 6 months. Wired motors never need charging.', 40),
    ('solar', 'Solar panel', 'Battery motors only. A solar panel on the window means the battery never needs charging.', 41),
    ('motor-control', 'Motor control', null, 42),
    ('side', 'Control side', 'Left or right. For battery motors it is the side with the charging port: pick the side closest to an outlet.', 43)) as k(key, label, note, sort)
 where l.id in ('roller','zebra','shangri-la','roman','cellular')
on conflict (id) do nothing;

insert into public.option_values (id, group_id, code, label, explanation, grid_system, active, is_default, sort_order)
select l.id || ':' || v.grp || ':' || v.code, l.id || ':' || v.grp, v.code, v.label, v.expl, null, true, v.dflt, v.sort
  from public.product_lines l
  cross join (values
    ('power', 'battery', 'Battery', 'Rechargeable, about every 6 months.', true, 0),
    ('power', 'wired', 'Wired', 'Plugs in, so it never needs charging.', false, 1),
    ('solar', 'none', 'No solar panel', null, true, 0),
    ('solar', 'panel', 'Solar panel', 'A small panel on the window keeps the battery charged, so it never needs charging.', false, 1),
    ('motor-control', 'app-remote', 'App + Remote', 'Bluetooth motor. Use the Smart Life app or the included remote.', true, 0),
    ('motor-control', 'remote-only', 'Remote control only', 'Radio-remote motor. Works with the included remote.', false, 1),
    ('motor-control', 'zigbee', 'App + Voice + Remote (Zigbee)', 'Needs a Zigbee hub (we sell one for $35 if you do not have one).', false, 2),
    ('motor-control', 'matter', 'App + Voice + Remote (Matter)', 'Works with Alexa, Google Home and Apple Home. No hub needed, but you need a Matter-capable smart speaker or device.', false, 3),
    ('side', 'right', 'Right', null, true, 0),
    ('side', 'left', 'Left', null, false, 1)) as v(grp, code, label, expl, dflt, sort)
 where l.id in ('roller','zebra','shangri-la','roman','cellular')
on conflict (id) do nothing;

-- 3. new costs (before markup). Roller double-stack prices both shades with the same options, so it gets two of each automatically.
insert into public.price_adders (line_id, adder_key, label, kind, amount, unit, applies_when, origin, status, source, note)
select pl, 'motor', 'Motor (any type: battery or wired, any control)', 'add', 70, 'flat', '{"control":["motorized"]}'::jsonb, 'manual', 'from_supplier', 'confirmed by the owner',
       'One $70 motor cost for every motor type. Replaces the motor cost that used to be built into the supplier motor tables and the old motor and remote add-ons.'
  from unnest(array['roller','zebra','shangri-la','roman','cellular']) pl
on conflict (line_id, adder_key) do nothing;

insert into public.price_adders (line_id, adder_key, label, kind, amount, unit, applies_when, origin, status, source, note)
select pl, 'solar-panel', 'Solar panel (battery motors only)', 'add', 30, 'flat', '{"control":["motorized"],"solar":["panel"]}'::jsonb, 'manual', 'from_supplier', 'confirmed by the owner',
       'Only battery motors take a solar panel.'
  from unnest(array['roller','zebra','shangri-la','roman','cellular']) pl
on conflict (line_id, adder_key) do nothing;

-- 4. open questions for the owner
insert into public.price_flags (line_id, flag_key, kind, title, detail) values
 ('roller',   'roller-zero-gravity-price', 'confirm', 'Zero gravity: no supplier price yet', 'Shown at the chain (cord) table price with no extra charge ($0). Confirm the supplier price.'),
 ('zebra',    'zebra-zero-gravity-price', 'confirm', 'Zero gravity: no supplier price yet', 'Shown at the chain (cord) table price with no extra charge ($0). Confirm the supplier price.'),
 ('roman',    'roman-zero-gravity-price', 'confirm', 'Zero gravity: no supplier price yet', 'Shown at the plain (cordless) table price with no extra charge ($0). Confirm the supplier price.'),
 ('cellular', 'cellular-zero-gravity-price', 'confirm', 'Zero gravity: no supplier price yet', 'Was "Freestop lift", priced at the cord table with $0 extra. Confirm the supplier price.'),
 (null, 'motor-wired-install', 'confirm', 'Wired motor: plug-in or hardwired?', 'The preview draws a cord from the motor down the wall to an outlet. Confirm whether the wired motor plugs in or is hardwired.'),
 (null, 'motor-tall-sizes', 'info', 'Tall motorized sizes show "Price by email"', 'Motorized now prices from the plain table plus the $70 motor. Sizes that only the supplier motor table covered (Roller 119-120 in on some fabrics, Zebra Venus and Uranus special sizes up to 154 in) have no plain-table price, so they show "Price by email" until the supplier confirms.')
on conflict (flag_key) do nothing;
