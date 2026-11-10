-- Migration 26: headrail, rail and cassette color as a $0 option on Cellular, Roman and Shangri-La. ADDITIVE ONLY: two inserts, no change to any existing row,
-- so it is safe to run before or after the new site is deployed (the site shows the four colors either way; these rows put them in admin Products > Options,
-- where the owner can hide, rename and reorder them). Idempotent: safe to re-run. Paste the whole file into the Supabase SQL Editor. Needs migration 20.
--
-- The colors are the supplier's four (the same names as the Roller and Zebra bottom bar): Pearl White (default), Sand Beige, Iron Gray, Night Black.
-- Saved on the order line as selection.extras.headColor. No price change.

insert into public.option_groups (id, line_id, key, label, note, bound, sort_order)
values
  ('cellular:head-color', 'cellular', 'head-color', 'Rail color', null, true, 55),
  ('roman:head-color', 'roman', 'head-color', 'Headrail color', null, true, 55),
  ('shangri-la:head-color', 'shangri-la', 'head-color', 'Cassette color', null, true, 55)
on conflict (id) do nothing;

insert into public.option_values (id, group_id, code, label, explanation, grid_system, active, is_default, sort_order)
select v.grp || ':' || v.code, v.grp, v.code, v.label, v.expl, null, true, v.dflt, v.sort
  from (values
    ('cellular:head-color','pearl-white','Pearl White',null,true,0), ('cellular:head-color','sand-beige','Sand Beige',null,false,1),
    ('cellular:head-color','iron-gray','Iron Gray',null,false,2), ('cellular:head-color','night-black','Night Black',null,false,3),
    ('roman:head-color','pearl-white','Pearl White',null,true,0), ('roman:head-color','sand-beige','Sand Beige',null,false,1),
    ('roman:head-color','iron-gray','Iron Gray',null,false,2), ('roman:head-color','night-black','Night Black',null,false,3),
    ('shangri-la:head-color','pearl-white','Pearl White',null,true,0), ('shangri-la:head-color','sand-beige','Sand Beige',null,false,1),
    ('shangri-la:head-color','iron-gray','Iron Gray',null,false,2), ('shangri-la:head-color','night-black','Night Black',null,false,3)
  ) as v(grp, code, label, expl, dflt, sort)
on conflict (id) do nothing;
