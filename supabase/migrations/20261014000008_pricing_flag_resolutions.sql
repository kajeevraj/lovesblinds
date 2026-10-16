-- Migration 8: supplier answers to the Stage 1 flags.
-- Adds a 'from_supplier' adder status and a resolution note on flags, then records the six answers.
-- Idempotent: safe to re-run (and safe if the same data changes were already made through the API).

alter table public.price_adders drop constraint if exists price_adders_status_check;
alter table public.price_adders add constraint price_adders_status_check
  check (status in ('from_sheet','from_supplier','placeholder','confirm'));
alter table public.price_flags add column if not exists resolution_note text;

-- 2. Dream Curtains motor: the supplier confirmed about $90 (was a $110 placeholder)
update public.price_adders
   set amount = 90, status = 'from_supplier', source = 'confirmed by the supplier',
       label = 'Motor (not in the supplier sheet)',
       note = 'The Dream Curtains MOTOR sheet says: "The above quotation does not include the cost of the motor." The supplier confirmed about $90 (added to cost, before markup).'
 where line_id = 'dream-curtains' and adder_key = 'motor-cost';

-- 6. Shangri-La: the remote wand costs the same as motorized, so it gets the sheet's "Remote control +$100".
--    The control code is remote_wand (Matter stays +$140).
update public.price_adders
   set applies_when = '{"control":["remote_wand"]}'::jsonb, status = 'from_supplier',
       note = 'Supplier confirmed the Remote wand costs the same as motorized: the sheet''s "Remote control +$100" applies to the Remote wand control.'
 where line_id = 'shangri-la' and adder_key = 'remote-control';

-- the six flags
update public.price_flags set resolved = true, resolution_note = 'Follows sheet labels; confirmed by owner.'
 where flag_key = 'axis-orientation';
update public.price_flags set resolved = true, title = 'Motor cost: +$90 (confirmed by the supplier)',
       detail = 'The motor sheet excludes the motor. The supplier confirmed about $90, added to cost before markup.',
       resolution_note = 'Supplier confirmed about $90; the placeholder $110 was replaced.'
 where flag_key = 'dream-motor-placeholder';
update public.price_flags set resolved = true,
       resolution_note = 'Kept: the price block matches the second fabric the customer picks (light filtering or blackout). The sheer is always white. Blocks are not added together. Confirmed by owner.'
 where flag_key = 'cellular-day-night';
update public.price_flags set resolved = true, resolution_note = 'Supplier will add double-stack prices to their portal later.'
 where flag_key = 'roller-double-stack';
update public.price_flags set resolved = true, resolution_note = 'Kept the ×1.1 multiplier. Confirmed by owner.'
 where flag_key = 'zebra-special-sizes';
update public.price_flags set resolved = true, title = 'Remote wand priced like motorized (Remote control +$100)',
       detail = 'The site offers "Remote wand" and "Matter". Remote wand = base grid + the sheet''s "Remote control +$100"; Matter = base + $140.',
       resolution_note = 'Supplier confirmed the remote wand costs the same as motorized. Matter stays +$140.'
 where flag_key = 'shangri-remote-wand';
