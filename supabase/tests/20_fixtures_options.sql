-- LOCAL TESTING ONLY (throwaway Postgres, after migrations 1 to 11). The live project got these rows from scripts/seed-options.mjs and the
-- supplier import; this recreates just enough of them for the option and hardware migrations (20, 21) to run and be tested.
insert into public.product_lines (id, name) values ('roller','Roller'),('zebra','Zebra'),('shangri-la','Shangri-La'),('roman','Roman'),('cellular','Cellular'),('drapery','Drapery')
on conflict (id) do nothing;
insert into public.pricing_lines (id, name, product_line_id, markup) values
  ('roller','Roller','roller',0.5),('zebra','Zebra','zebra',0.5),('shangri-la','Shangri-La','shangri-la',0.5),('roman','Roman','roman',0.5),
  ('cellular','Cellular','cellular',0.5),('dream-curtains','Dream Curtains','drapery',0.5),('drapery','Drapery','drapery',0.5)
on conflict (id) do nothing;
insert into public.option_groups (id, line_id, key, label, bound, sort_order)
select l || ':' || k, l, k, k, false, 0 from unnest(array['roller','zebra','shangri-la','roman','cellular']) l cross join unnest(array['control','side']) k
on conflict (id) do nothing;
insert into public.option_groups (id, line_id, key, label, bound, sort_order) values ('drapery:control','drapery','control','Control (track)',false,0)
on conflict (id) do nothing;
insert into public.option_values (id, group_id, code, label, grid_system, active, is_default, sort_order) values
  ('roller:control:chain','roller:control','chain','Continuous chain','cord',true,true,0),
  ('roller:control:cordless','roller:control','cordless','Cordless spring','cordless',true,false,1),
  ('roller:control:zero-gravity','roller:control','zero-gravity','Zero gravity','cord',true,false,20),
  ('roller:control:motorized','roller:control','motorized','Motorized','cord',true,false,21),
  ('zebra:control:chain','zebra:control','chain','Continuous chain','cord',true,true,0),
  ('zebra:control:cordless','zebra:control','cordless','Cordless spring','cordless',true,false,1),
  ('zebra:control:zero-gravity','zebra:control','zero-gravity','Zero gravity','cord',true,false,20),
  ('zebra:control:motorized','zebra:control','motorized','Motorized','cord',true,false,21),
  ('shangri-la:control:motorized','shangri-la:control','motorized','Motorized','cord',true,false,21),
  ('shangri-la:control:chain','shangri-la:control','chain','Chain','cord',true,true,22),
  ('roman:control:cordless','roman:control','cordless','Cordless spring','cordless',true,true,0),
  ('roman:control:zero-gravity','roman:control','zero-gravity','Zero gravity','cordless',true,false,20),
  ('roman:control:motorized','roman:control','motorized','Motorized','cordless',true,false,21),
  ('cellular:control:cordless','cellular:control','cordless','Cordless spring','cordless',true,true,0),
  ('cellular:control:zero-gravity','cellular:control','zero-gravity','Zero gravity','cord',true,false,20),
  ('cellular:control:motorized','cellular:control','motorized','Motorized','cord',true,false,21),
  ('drapery:control:manual','drapery:control','manual','Manual track','manual',true,true,0),
  ('drapery:control:remote','drapery:control','remote','Motorized track (remote)','motor',true,false,1),
  ('drapery:control:matter','drapery:control','matter','Motorized track (Matter)','motor',true,false,2)
on conflict (id) do nothing;
insert into public.price_adders (line_id, adder_key, label, kind, amount, unit, applies_when, origin, status) values
  ('dream-curtains','motor-cost','Motor','add',100,'flat','{"control":["remote","matter"]}','manual','from_supplier')
on conflict (line_id, adder_key) do nothing;
insert into public.price_flags (line_id, flag_key, kind, title) values
  ('roller','roller-zero-gravity-price','confirm','x'),('zebra','zebra-zero-gravity-price','confirm','x'),
  ('roman','roman-zero-gravity-price','confirm','x'),('cellular','cellular-zero-gravity-price','confirm','x')
on conflict (flag_key) do nothing;
