-- Migration 20, STEP A of 2: product page and supplier options. ADDITIVE ONLY, so it is safe to run BEFORE the new site is deployed:
-- the live site never sends the new codes, so none of the new rows are used until the new site is deployed.
-- Run STEP B (migration 21, retire Cordless) only AFTER the new site is deployed.
-- Idempotent: safe to re-run. All costs are before the 1.5x markup.
--
-- What this sets up:
--   1. "Best value" and "Top of the line": option_values.best_value / top_of_line, one of each per product line (movement options only).
--      Best value defaults to Zero gravity where a line has it; Top of the line defaults to Motorized.
--   2. Zero gravity costs +$18 (Roller, Zebra, Roman, Cellular; double-stack prices both shades, so +$18 per shade). The "confirm Zero gravity price" flags are resolved.
--   3. The "2 in 1 motor" (Roller): its own movement value, $70 like every motor. Chain on Roman and Cellular (cord table).
--   4. Every new choice as an admin-editable option group (so the owner can turn each one on or off): chain color, cord loop, bottom bar color,
--      roll direction, bottom rail wrap, curtain styles, return, panels, hardware (track, finish, finial, layers, mount, opening, overlap, power),
--      Dream Curtains install, fit and stack, and the Dream Curtains Motorized and Pull rod controls.
--   5. Drapery hardware prices: hardware_rates (admin-editable $/m, $/kg and weights) and hardware_estimate() (customer price only).
--   6. public_options(): the one read the customer site makes of the option tables (which options are on, and which is Best value).

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Best value: one movement option per line
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.option_values add column if not exists best_value boolean not null default false;
alter table public.option_values add column if not exists top_of_line boolean not null default false;

create or replace function public.option_values_best_value() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_line text; v_key text;
begin
  if new.best_value then
    select g.line_id, g.key into v_line, v_key from public.option_groups g where g.id = new.group_id;
    if v_key <> 'control' then
      raise exception '"Best value" can only be set on a movement option (the Control group)' using errcode = 'check_violation';
    end if;
    -- only one per line: the others lose it
    update public.option_values o set best_value = false
     where o.best_value and o.id <> new.id
       and o.group_id in (select g.id from public.option_groups g where g.line_id = v_line);
  end if;
  if new.top_of_line then
    select g.line_id, g.key into v_line, v_key from public.option_groups g where g.id = new.group_id;
    if v_key <> 'control' then
      raise exception '"Top of the line" can only be set on a movement option (the Control group)' using errcode = 'check_violation';
    end if;
    update public.option_values o set top_of_line = false
     where o.top_of_line and o.id <> new.id
       and o.group_id in (select g.id from public.option_groups g where g.line_id = v_line);
  end if;
  return new;
end $$;
revoke all on function public.option_values_best_value() from public, anon, authenticated;
drop trigger if exists option_values_best_value on public.option_values;
create trigger option_values_best_value before insert or update of best_value, top_of_line on public.option_values for each row execute function public.option_values_best_value();

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. movement values: new ones, order and defaults (Zero gravity first, Chain last)
-- ---------------------------------------------------------------------------------------------------------------------
insert into public.option_values (id, group_id, code, label, explanation, grid_system, active, is_default, sort_order)
values
  ('roller:control:two-in-one', 'roller:control', 'two-in-one', '2 in 1 motor', 'Use the remote, or just move the shade by hand. It stays wherever you leave it.', 'cord', true, false, 22),
  ('roman:control:chain',       'roman:control',  'chain', 'Chain', 'Pull the beaded chain loop to raise and lower.', 'cord', true, false, 30),
  ('cellular:control:chain',    'cellular:control','chain', 'Chain', 'Pull the beaded chain loop to raise and lower.', 'cord', true, false, 30),
  ('drapery:control:motorized', 'drapery:control', 'motorized', 'Motorized', 'Open and close with a remote.', 'motor', true, false, 10),
  ('drapery:control:pull-rod',  'drapery:control', 'pull-rod', 'Pull rod', 'Draw the curtain with a rod. Left or right stack only.', 'manual', true, false, 11)
on conflict (id) do nothing;

-- the movement groups' labels and order. Zero gravity 0, Motorized 1, 2 in 1 2, everything else after, Chain last.
update public.option_values set sort_order = case code when 'zero-gravity' then 0 when 'motorized' then 1 when 'two-in-one' then 2 when 'chain' then 90 else sort_order end
 where group_id in ('roller:control','zebra:control','roman:control','cellular:control','shangri-la:control')
   and code in ('zero-gravity','motorized','two-in-one','chain');
update public.option_values set sort_order = 0 where id = 'drapery:control:manual';

-- defaults: Zero gravity wherever the line has it (clear the old default first: one default per group)
update public.option_values set is_default = false
 where group_id in ('roller:control','zebra:control','roman:control','cellular:control') and is_default and code <> 'zero-gravity';
update public.option_values set is_default = true
 where id in ('roller:control:zero-gravity','zebra:control:zero-gravity','roman:control:zero-gravity','cellular:control:zero-gravity')
   and not exists (select 1 from public.option_values o where o.group_id = option_values.group_id and o.is_default and o.id <> option_values.id);
-- Shangri-La has no Zero gravity: it stays on Chain

-- Best value starts on Zero gravity wherever a line has it; none on Shangri-La and Dream Curtains until the owner picks one
update public.option_values set best_value = true
 where id in ('roller:control:zero-gravity','zebra:control:zero-gravity','roman:control:zero-gravity','cellular:control:zero-gravity')
   and not exists (select 1 from public.option_groups g join public.option_values o on o.group_id = g.id
                    where g.line_id = (select line_id from public.option_groups where id = option_values.group_id) and o.best_value);

-- Top of the line starts on Motorized on every line that has it (Dream Curtains too)
update public.option_values set top_of_line = true
 where id in ('roller:control:motorized','zebra:control:motorized','shangri-la:control:motorized','roman:control:motorized','cellular:control:motorized','drapery:control:motorized')
   and not exists (select 1 from public.option_groups g join public.option_values o on o.group_id = g.id
                    where g.line_id = (select line_id from public.option_groups where id = option_values.group_id) and o.top_of_line);

-- the motor-side group is now called "Motor side"
update public.option_groups set label = 'Motor side',
       note = 'The motor sits on this side, and so does the charging port. Pick the side closest to an outlet.'
 where key = 'side' and line_id in ('roller','zebra','shangri-la','roman','cellular');

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. costs
-- ---------------------------------------------------------------------------------------------------------------------
-- Zero gravity: +$18 on the plain table (Roller, Zebra, Roman, Cellular). Double-stack prices front and back separately: +$18 per shade.
insert into public.price_adders (line_id, adder_key, label, kind, amount, unit, applies_when, origin, status, source, note)
select pl, 'zero-gravity', 'Zero gravity', 'add', 18, 'flat', '{"control":["zero-gravity"]}'::jsonb, 'manual', 'from_supplier', 'confirmed by the owner',
       'Zero gravity = the plain table + $18 (replaces Cordless). Double-stack: +$18 per shade.'
  from unnest(array['roller','zebra','roman','cellular']) pl
on conflict (line_id, adder_key) do nothing;

-- the 2 in 1 motor: $70 like every motor (Roller only)
insert into public.price_adders (line_id, adder_key, label, kind, amount, unit, applies_when, origin, status, source, note)
values ('roller', 'motor-two-in-one', '2 in 1 motor', 'add', 70, 'flat', '{"control":["two-in-one"]}'::jsonb, 'manual', 'from_supplier', 'confirmed by the owner',
        'Every new motor type costs $70. Remote included.')
on conflict (line_id, adder_key) do nothing;

-- Dream Curtains: the new "Motorized" control carries the same $100 motor as the old remote and Matter codes
update public.price_adders set applies_when = '{"control":["remote","matter","motorized"]}'::jsonb
 where line_id = 'dream-curtains' and adder_key = 'motor-cost';

-- the four "confirm Zero gravity price" flags are answered
update public.price_flags set resolved = true, resolution_note = 'Zero gravity = the plain table + $18 (owner, confirmed). Cordless is retired.'
 where flag_key in ('roller-zero-gravity-price','zebra-zero-gravity-price','roman-zero-gravity-price','cellular-zero-gravity-price');

-- questions that are still open
insert into public.price_flags (line_id, flag_key, kind, title, detail) values
 (null, 'drapery-fabric-prices', 'confirm', 'Curtain fabric has no prices yet', 'No supplier price grid exists for any curtain style, so every curtain style shows "Price by email" for the fabric. Send the fabric prices per style and they can be loaded.'),
 (null, 'hardware-finial-price', 'confirm', 'Finial $18: per finial or per pair?', 'The site charges $18 (cost) once per rod or rail, for the pair of finials. If it is $18 each, double the "finial" rate in Hardware.'),
 ('dream-curtains', 'dream-pull-rod-price', 'confirm', 'Dream Curtains pull rod price', 'Pull rod is priced like Manual ($0 extra). Confirm.'),
 (null, 'roll-direction-wording', 'confirm', 'Roll direction wording', 'Standard: fabric hangs behind the roller, close to the glass. Reverse: in front of the roller, closer to the room. Confirm this matches the supplier.')
on conflict (flag_key) do nothing;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. new option groups and values (all bound to the site's code: the owner can edit, hide and reorder, but not add)
-- ---------------------------------------------------------------------------------------------------------------------
insert into public.option_groups (id, line_id, key, label, note, bound, sort_order)
values
  ('roller:chain-color', 'roller', 'chain-color', 'Chain color', null, true, 50),
  ('zebra:chain-color', 'zebra', 'chain-color', 'Chain color', null, true, 50),
  ('shangri-la:chain-color', 'shangri-la', 'chain-color', 'Chain color', null, true, 50),
  ('roman:chain-color', 'roman', 'chain-color', 'Chain color', null, true, 50),
  ('cellular:chain-color', 'cellular', 'chain-color', 'Chain color', null, true, 50),
  ('roman:cord-type', 'roman', 'cord-type', 'Chain or cord loop', null, true, 51),
  ('cellular:cord-type', 'cellular', 'cord-type', 'Chain or cord loop', null, true, 51),
  ('roman:cord-loop-color', 'roman', 'cord-loop-color', 'Cord loop color', null, true, 52),
  ('cellular:cord-loop-color', 'cellular', 'cord-loop-color', 'Cord loop color', null, true, 52),
  ('roller:bar-color', 'roller', 'bar-color', 'Bottom bar color', null, true, 53),
  ('zebra:bar-color', 'zebra', 'bar-color', 'Bottom bar color', null, true, 53),
  ('roller:roll-direction', 'roller', 'roll-direction', 'Roll direction', null, true, 54),
  ('roman:roll-direction', 'roman', 'roll-direction', 'Roll direction', null, true, 54),
  ('shangri-la:roll-direction', 'shangri-la', 'roll-direction', 'Roll direction', null, true, 54),
  ('roller:bottom-wrap', 'roller', 'bottom-wrap', 'Bottom rail (double-stack)', null, true, 55),
  ('drapery:curtain-style', 'drapery', 'curtain-style', 'Curtain style', 'Only styles we have fabric prices for should stay on. There are no fabric prices yet, so every style shows "Price by email".', true, 20),
  ('drapery:return', 'drapery', 'return', 'Return', null, true, 21),
  ('drapery:panels', 'drapery', 'panels', 'Panels', null, true, 22),
  ('drapery:hardware', 'drapery', 'hardware', 'Add a track or rod', 'The step itself: "I have my own" is always available.', true, 30),
  ('drapery:hw-layers', 'drapery', 'hw-layers', 'Track layers', null, true, 31),
  ('drapery:hw-mount', 'drapery', 'hw-mount', 'Track mount', null, true, 32),
  ('drapery:hw-track', 'drapery', 'hw-track', 'Track or rod', null, true, 33),
  ('drapery:hw-finish', 'drapery', 'hw-finish', 'Metal finish', null, true, 34),
  ('drapery:hw-finial', 'drapery', 'hw-finial', 'Finial', null, true, 35),
  ('drapery:hw-opening', 'drapery', 'hw-opening', 'Motorized rail opening', null, true, 36),
  ('drapery:hw-overlap', 'drapery', 'hw-overlap', 'Center opening overlap', null, true, 37),
  ('drapery:hw-power', 'drapery', 'hw-power', 'Motorized rail power', null, true, 38),
  ('drapery:dream-install', 'drapery', 'dream-install', 'Dream Curtains install', null, true, 40),
  ('drapery:dream-fit', 'drapery', 'dream-fit', 'Dream Curtains inside or outside', null, true, 41),
  ('drapery:dream-stack', 'drapery', 'dream-stack', 'Dream Curtains stack', null, true, 42)
on conflict (id) do nothing;

insert into public.option_values (id, group_id, code, label, explanation, grid_system, active, is_default, sort_order)
select v.grp || ':' || v.code, v.grp, v.code, v.label, v.expl, null, true, v.dflt, v.sort
  from (values
    -- chain colors (same six on every line that has a chain)
    ('roller:chain-color','black','Black',null,false,0), ('roller:chain-color','white','White',null,true,1), ('roller:chain-color','grey','Grey',null,false,2),
    ('roller:chain-color','beige','Beige',null,false,3), ('roller:chain-color','brown','Brown',null,false,4), ('roller:chain-color','stainless-steel','Stainless steel',null,false,5),
    ('zebra:chain-color','black','Black',null,false,0), ('zebra:chain-color','white','White',null,true,1), ('zebra:chain-color','grey','Grey',null,false,2),
    ('zebra:chain-color','beige','Beige',null,false,3), ('zebra:chain-color','brown','Brown',null,false,4), ('zebra:chain-color','stainless-steel','Stainless steel',null,false,5),
    ('shangri-la:chain-color','black','Black',null,false,0), ('shangri-la:chain-color','white','White',null,true,1), ('shangri-la:chain-color','grey','Grey',null,false,2),
    ('shangri-la:chain-color','beige','Beige',null,false,3), ('shangri-la:chain-color','brown','Brown',null,false,4), ('shangri-la:chain-color','stainless-steel','Stainless steel',null,false,5),
    ('roman:chain-color','black','Black',null,false,0), ('roman:chain-color','white','White',null,true,1), ('roman:chain-color','grey','Grey',null,false,2),
    ('roman:chain-color','beige','Beige',null,false,3), ('roman:chain-color','brown','Brown',null,false,4), ('roman:chain-color','stainless-steel','Stainless steel',null,false,5),
    ('cellular:chain-color','black','Black',null,false,0), ('cellular:chain-color','white','White',null,true,1), ('cellular:chain-color','grey','Grey',null,false,2),
    ('cellular:chain-color','beige','Beige',null,false,3), ('cellular:chain-color','brown','Brown',null,false,4), ('cellular:chain-color','stainless-steel','Stainless steel',null,false,5),
    -- cord type and cord loop colors (Roman, Cellular)
    ('roman:cord-type','chain','Chain','A beaded chain loop.',true,0), ('roman:cord-type','cord-loop','Cord loop','A soft cord loop instead of beads.',false,1),
    ('cellular:cord-type','chain','Chain','A beaded chain loop.',true,0), ('cellular:cord-type','cord-loop','Cord loop','A soft cord loop instead of beads.',false,1),
    ('roman:cord-loop-color','white','White',null,true,0), ('roman:cord-loop-color','beige','Beige',null,false,1), ('roman:cord-loop-color','grey','Grey',null,false,2),
    ('roman:cord-loop-color','brown','Brown',null,false,3), ('roman:cord-loop-color','black','Black',null,false,4),
    ('cellular:cord-loop-color','white','White',null,true,0), ('cellular:cord-loop-color','beige','Beige',null,false,1), ('cellular:cord-loop-color','grey','Grey',null,false,2),
    ('cellular:cord-loop-color','brown','Brown',null,false,3), ('cellular:cord-loop-color','black','Black',null,false,4),
    -- bottom bar colors (supplier names)
    ('roller:bar-color','pearl-white','Pearl White',null,true,0), ('roller:bar-color','sand-beige','Sand Beige',null,false,1),
    ('roller:bar-color','iron-gray','Iron Gray',null,false,2), ('roller:bar-color','night-black','Night Black',null,false,3),
    ('zebra:bar-color','pearl-white','Pearl White',null,true,0), ('zebra:bar-color','sand-beige','Sand Beige',null,false,1),
    ('zebra:bar-color','iron-gray','Iron Gray',null,false,2), ('zebra:bar-color','night-black','Night Black',null,false,3),
    -- roll direction
    ('roller:roll-direction','standard','Standard','The fabric hangs behind the roller, close to the glass.',true,0), ('roller:roll-direction','reverse','Reverse','The fabric hangs in front of the roller, closer to the room.',false,1),
    ('roman:roll-direction','standard','Standard','The fabric hangs behind the roller, close to the glass.',true,0), ('roman:roll-direction','reverse','Reverse','The fabric hangs in front of the roller, closer to the room.',false,1),
    ('shangri-la:roll-direction','standard','Standard','The fabric hangs behind the roller, close to the glass.',true,0), ('shangri-la:roll-direction','reverse','Reverse','The fabric hangs in front of the roller, closer to the room.',false,1),
    ('roller:bottom-wrap','wrapped','Wrapped in fabric','The bottom rail is covered in your fabric.',true,0), ('roller:bottom-wrap','none','Plain bottom rail','The bottom rail stays plain, in the bottom bar color.',false,1),
    -- curtain styles, return, panels
    ('drapery:curtain-style','grommet','Grommet',null,false,0), ('drapery:curtain-style','pinch-pleat','Pinch pleat',null,false,1), ('drapery:curtain-style','goblet','Goblet',null,false,2),
    ('drapery:curtain-style','inverted-pleat','Inverted pleat',null,false,3), ('drapery:curtain-style','euro-pleat-2','Euro pleat (2 finger)',null,false,4),
    ('drapery:curtain-style','french-pleat-2','French pleat (2 finger)',null,false,5), ('drapery:curtain-style','korean-pleat-2','Korean pleat (2 finger)',null,false,6),
    ('drapery:curtain-style','out-invert-pleat','Out invert pleat',null,false,7), ('drapery:curtain-style','euro-pleat-3','Euro pleat (3 finger)',null,false,8),
    ('drapery:curtain-style','french-pleat-3','French pleat (3 finger)',null,false,9), ('drapery:curtain-style','korean-pleat-3','Korean pleat (3 finger)',null,false,10),
    ('drapery:curtain-style','ripple-hook','Ripple fold (hook)',null,false,11), ('drapery:curtain-style','ripple-button','Ripple fold (button)',null,false,12),
    ('drapery:curtain-style','rod-pocket','Rod pocket',null,false,13),
    ('drapery:return','pleat','Same as pleat spacing',null,true,0), ('drapery:return','2','2 in',null,false,1), ('drapery:return','3.5','3.5 in',null,false,2),
    ('drapery:panels','single','Single panel',null,true,0), ('drapery:panels','pair','Pair',null,false,1),
    -- hardware
    ('drapery:hardware','own','I have my own','No track or rod from us ($0).',true,0), ('drapery:hardware','add','Add a track or rod','Priced by the meter, plus shipping.',false,1),
    ('drapery:hw-layers','single','Single',null,true,0), ('drapery:hw-layers','double','Double','A sheer in front and a blackout behind, each on its own track.',false,1),
    ('drapery:hw-mount','ceiling','Ceiling',null,true,0), ('drapery:hw-mount','wall','Wall (side)',null,false,1),
    ('drapery:hw-track','classic-rail','Classic rail','Square track.',false,0), ('drapery:hw-track','arc-rail','Arc rail',null,true,1),
    ('drapery:hw-track','elegance-rod','Elegance rod','Plain decorative rod.',false,2), ('drapery:hw-track','elegance-rail','Elegance rail','Grooved decorative rod.',false,3),
    ('drapery:hw-track','motorized-rail','Motorized rail','Motor and remote included.',false,4),
    ('drapery:hw-finish','brushed-bronze','Brushed Bronze',null,true,0), ('drapery:hw-finish','black-matt','Black Matt',null,false,1), ('drapery:hw-finish','antique-tin-matte','Antique Tin Matte',null,false,2),
    ('drapery:hw-finish','brushed-brass','Brushed Brass',null,false,3), ('drapery:hw-finish','brushed-nickel-matte','Brushed Nickel Matte',null,false,4),
    ('drapery:hw-finial','classic','Classic (plain)',null,true,0), ('drapery:hw-finial','spacecraft','Spacecraft',null,false,1), ('drapery:hw-finial','moonstone','Moonstone',null,false,2),
    ('drapery:hw-finial','celestial-oval','Celestial Oval',null,false,3), ('drapery:hw-finial','imperial-crest','Imperial Crest',null,false,4), ('drapery:hw-finial','crystal-diamond','Crystal Diamond',null,false,5),
    ('drapery:hw-finial','crystal-bubble','Crystal Bubble',null,false,6), ('drapery:hw-finial','concave-top-ball','Concave-Top Ball',null,false,7), ('drapery:hw-finial','sculpted-cylinder','Sculpted Cylinder',null,false,8),
    ('drapery:hw-finial','heritage-drum','Heritage Drum',null,false,9), ('drapery:hw-finial','gilded-helix','Gilded Helix',null,false,10),
    ('drapery:hw-opening','left','Left stack',null,false,0), ('drapery:hw-opening','right','Right stack',null,true,1), ('drapery:hw-opening','center','Center opening',null,false,2),
    ('drapery:hw-overlap','return','Same as return',null,true,0), ('drapery:hw-overlap','2','2 in',null,false,1),
    ('drapery:hw-power','battery','Battery',null,true,0), ('drapery:hw-power','wired','Wired',null,false,1),
    -- Dream Curtains
    ('drapery:dream-install','side','Side install','The track goes on the wall beside or above the window.',false,0), ('drapery:dream-install','ceiling','Ceiling install','The track goes on the ceiling.',false,1),
    ('drapery:dream-fit','inside','Inside',null,false,0), ('drapery:dream-fit','outside','Outside',null,false,1),
    ('drapery:dream-stack','left','Left stack',null,false,0), ('drapery:dream-stack','right','Right stack',null,false,1), ('drapery:dream-stack','center','Center opening',null,false,2)
  ) as v(grp, code, label, expl, dflt, sort)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. drapery hardware prices
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.hardware_rates (
  id         text primary key,                                   -- track:arc-rail, ship_per_kg ...
  label      text not null,
  amount     numeric not null check (amount >= 0),
  unit       text not null,                                       -- "$ per m", "$ per kg", "kg per m" ...
  note       text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists hardware_rates_updated_at on public.hardware_rates;
create trigger hardware_rates_updated_at before update on public.hardware_rates for each row execute function public.set_updated_at();

insert into public.hardware_rates (id, label, amount, unit, note, sort_order) values
  ('track:classic-rail:pleated', 'Classic rail (square track), pleated styles', 13, '$ per m', 'cost, before markup', 10),
  ('track:classic-rail:ripple',  'Classic rail, Ripple fold (button)', 14, '$ per m', 'cost, before markup', 11),
  ('track:arc-rail',             'Arc rail', 12.5, '$ per m', 'cost, before markup', 12),
  ('track:elegance-rod',         'Elegance rod (plain decorative rod)', 32, '$ per m', 'cost, before markup; 0.35 m is added to the length for the ends', 13),
  ('track:elegance-rail',        'Elegance rail (grooved decorative rod)', 41, '$ per m', 'cost, before markup; 0.35 m is added to the length for the ends', 14),
  ('track:motorized-rail:pleated','Motorized rail, pleated styles', 18, '$ per m', 'cost, before markup; the motor is extra (below)', 15),
  ('track:motorized-rail:ripple', 'Motorized rail, Ripple fold', 20, '$ per m', 'cost, before markup; the motor is extra (below)', 16),
  ('motor',                      'Rail motor (remote included)', 100, '$ flat', 'cost, before markup', 20),
  ('finial',                     'Finial (any except Classic)', 18, '$ per rod or rail', 'cost, before markup. Charged once, for the pair', 21),
  ('ends_m',                     'Added to an Elegance rod or rail for the ends', 0.35, 'm', null, 30),
  ('ship_per_kg',                'Shipping, charged by weight', 11.03, '$ per kg', 'the supplier charges shipping by weight; it is part of our cost', 40),
  ('kg_per_m',                   'Track weight', 2, 'kg per m', null, 41),
  ('kg_per_tube',                'Shipping tube weight', 0.2, 'kg per tube', null, 42),
  ('tube_max_m',                 'One shipping tube holds up to', 4.5, 'm', 'a longer track needs another tube', 43),
  ('kg_motorized',               'Extra weight of a motorized rail', 3, 'kg', null, 44)
on conflict (id) do nothing;

alter table public.hardware_rates enable row level security;
revoke all on public.hardware_rates from anon, authenticated;
grant select, insert, update, delete on public.hardware_rates to authenticated, service_role;
drop policy if exists "admins read hardware_rates" on public.hardware_rates;
drop policy if exists "admins insert hardware_rates" on public.hardware_rates;
drop policy if exists "admins update hardware_rates" on public.hardware_rates;
drop policy if exists "admins delete hardware_rates" on public.hardware_rates;
create policy "admins read hardware_rates" on public.hardware_rates for select to authenticated using (public.is_admin());
create policy "admins insert hardware_rates" on public.hardware_rates for insert to authenticated with check (public.is_admin());
create policy "admins update hardware_rates" on public.hardware_rates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete hardware_rates" on public.hardware_rates for delete to authenticated using (public.is_admin());
drop trigger if exists hardware_rates_audit on public.hardware_rates;
create trigger hardware_rates_audit after insert or update or delete on public.hardware_rates for each row execute function public.audit_row_change();

-- The cost of the hardware and what the customer pays (internal). p_width_in is the curtain width; the track is as long as the curtain.
--   cost = layers x ( meters x $/m  +  shipping  +  motor  +  finial )
--   shipping = weight x $/kg;  weight = kg/m x meters + kg per tube x tubes (1 per 4.5 m) + 3 kg when motorized
--   price = cost x (1 + the Drapery markup)
create or replace function public.hardware_parts(p_opts jsonb, p_width_in numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  trk text := p_opts ->> 'track'; fam text := coalesce(p_opts ->> 'style_family', 'pleated');
  layers int := case when p_opts ->> 'layers' = 'double' then 2 else 1 end;
  motorized boolean := trk = 'motorized-rail';
  premium boolean := coalesce(p_opts ->> 'finial', 'classic') = 'premium';
  r jsonb; per_m numeric; len numeric; tubes int; weight numeric; ship numeric; track_cost numeric; motor numeric := 0; fin numeric := 0;
  one numeric; cost numeric; mk numeric; exact numeric;
begin
  if trk is null or p_width_in is null or p_width_in <= 0 then return jsonb_build_object('status', 'no_input'); end if;
  select jsonb_object_agg(id, amount) into r from public.hardware_rates;
  if motorized and fam in ('grommet', 'rod-pocket') then return jsonb_build_object('status', 'not_available'); end if;
  per_m := (r ->> ('track:' || trk || ':' || case when fam like 'ripple%' then 'ripple' else 'pleated' end))::numeric;
  if per_m is null then per_m := (r ->> ('track:' || trk))::numeric; end if;
  if per_m is null then return jsonb_build_object('status', 'unknown_track'); end if;
  len := p_width_in * 0.0254 + case when trk in ('elegance-rod', 'elegance-rail') then (r ->> 'ends_m')::numeric else 0 end;
  tubes := greatest(1, ceil(len / (r ->> 'tube_max_m')::numeric));
  weight := (r ->> 'kg_per_m')::numeric * len + (r ->> 'kg_per_tube')::numeric * tubes + case when motorized then (r ->> 'kg_motorized')::numeric else 0 end;
  ship := weight * (r ->> 'ship_per_kg')::numeric;
  track_cost := len * per_m;
  if motorized then motor := (r ->> 'motor')::numeric; end if;
  if premium and trk in ('elegance-rod', 'elegance-rail') then fin := (r ->> 'finial')::numeric; end if;
  one := track_cost + ship + motor + fin;
  cost := one * layers;
  select markup into mk from public.pricing_lines where id = 'drapery';
  exact := cost * (1 + coalesce(mk, 0.5));
  return jsonb_build_object('status', 'ok', 'layers', layers, 'meters', round(len, 4), 'per_m', per_m, 'tubes', tubes, 'weight_kg', round(weight, 3),
    'track_cost', round(track_cost, 4), 'shipping', round(ship, 4), 'motor', motor, 'finial', fin, 'cost_each_track', round(one, 4), 'cost', round(cost, 4),
    'markup', coalesce(mk, 0.5), 'price_exact', round(exact, 4), 'price', round(exact));
end $$;
revoke all on function public.hardware_parts(jsonb, numeric) from public, anon, authenticated;

-- what a customer may learn: the price, or that this track does not go with the style. Nothing else.
create or replace function public.hardware_estimate(p_options jsonb, p_width numeric) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p ->> 'status' = 'ok' then jsonb_build_object('price', (p ->> 'price')::numeric)
              when p ->> 'status' = 'not_available' then jsonb_build_object('not_available', true)
              else jsonb_build_object('price_on_request', true) end
    from (select public.hardware_parts(coalesce(p_options, '{}'::jsonb), p_width) as p) x;
$$;
revoke all on function public.hardware_estimate(jsonb, numeric) from public;
grant execute on function public.hardware_estimate(jsonb, numeric) to anon, authenticated;

-- the full breakdown, for admins (the Hardware panel's checker)
create or replace function public.hardware_breakdown(p_options jsonb, p_width numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return public.hardware_parts(coalesce(p_options, '{}'::jsonb), p_width);
end $$;
revoke all on function public.hardware_breakdown(jsonb, numeric) from public, anon;
grant execute on function public.hardware_breakdown(jsonb, numeric) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. what the customer site reads from the option tables: which options are on, and which one is Best value
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.public_options(p_line text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('group', g.key, 'code', v.code, 'active', v.active, 'best', v.best_value, 'top', v.top_of_line, 'label', v.label) order by g.sort_order, v.sort_order), '[]'::jsonb)
    from public.option_groups g join public.option_values v on v.group_id = g.id
   where g.line_id = p_line;
$$;
revoke all on function public.public_options(text) from public;
grant execute on function public.public_options(text) to anon, authenticated;
