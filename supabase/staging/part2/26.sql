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
