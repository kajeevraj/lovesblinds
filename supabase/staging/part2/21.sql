update public.option_values set active = false, is_default = false, best_value = false, top_of_line = false
 where code = 'cordless' and group_id in ('roller:control','zebra:control','roman:control','cellular:control');

update public.option_values set is_default = true
 where id in ('roller:control:zero-gravity','zebra:control:zero-gravity','roman:control:zero-gravity','cellular:control:zero-gravity')
   and not exists (select 1 from public.option_values o where o.group_id = option_values.group_id and o.is_default and o.id <> option_values.id);

update public.option_values set active = false, is_default = false where id in ('drapery:control:remote','drapery:control:matter');
update public.price_adders set applies_when = '{"control":["motorized"]}'::jsonb where line_id = 'dream-curtains' and adder_key = 'motor-cost';
