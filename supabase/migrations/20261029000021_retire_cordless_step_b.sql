-- Migration 21, STEP B of 2: retire Cordless. RUN ONLY AFTER the new site is deployed and migration 20 (step A) has been applied.
-- "Cordless" and "Zero gravity" are the same thing: Zero gravity is the only one (priced from the supplier Cordless / Free-stop table). The new site never sends the
-- cordless code; saved carts, quotes and orders that say cordless load and show as Zero gravity (the site translates the old code on read).
-- If this ran while the old site is live, the old site's Cordless choice would stop pricing. Idempotent: safe to re-run.

-- 1. the Cordless movement is retired (codes are permanent, so the rows stay, inactive)
update public.option_values set active = false, is_default = false, best_value = false, top_of_line = false
 where code = 'cordless' and group_id in ('roller:control','zebra:control','roman:control','cellular:control');

-- 2. Zero gravity is the default on every line that has it
update public.option_values set is_default = true
 where id in ('roller:control:zero-gravity','zebra:control:zero-gravity','roman:control:zero-gravity','cellular:control:zero-gravity')
   and not exists (select 1 from public.option_values o where o.group_id = option_values.group_id and o.is_default and o.id <> option_values.id);

-- 3. Dream Curtains: the old Motorized (remote) and Motorized (Matter) controls are replaced by Motorized and Pull rod
update public.option_values set active = false, is_default = false where id in ('drapery:control:remote','drapery:control:matter');
update public.price_adders set applies_when = '{"control":["motorized"]}'::jsonb where line_id = 'dream-curtains' and adder_key = 'motor-cost';
-- (Woven wood has its own "cordless" control and size rule; it is hidden and is not touched here.)
