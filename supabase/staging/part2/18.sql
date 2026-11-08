update public.price_adders set active = false,
       note = coalesce(note || ' ', '') || 'Replaced by the $70 motor (migration 18).'
 where active and (
       (line_id in ('roller','zebra') and adder_key = 'bluetooth-motor')
    or (line_id = 'shangri-la' and adder_key in ('matter-motor','remote-control'))
    or (line_id = 'cellular' and adder_key in ('motor-standard','motor-top-down-bottom-up','motor-day-night')));

update public.price_adders
   set amount = 100, status = 'from_supplier', source = 'confirmed by the owner',
       note = 'The Dream Curtains MOTOR sheet says: "The above quotation does not include the cost of the motor." The owner confirmed $100 (added to cost, before markup).'
 where line_id = 'dream-curtains' and adder_key = 'motor-cost';
update public.price_flags set title = 'Motor cost: +$100 (confirmed by the owner)',
       detail = 'The motor sheet excludes the motor. The owner confirmed $100, added to cost before markup.'
 where flag_key = 'dream-motor-placeholder';

update public.option_values set active = false, is_default = false
 where group_id in ('roller:control','zebra:control','roman:control','cellular:control','shangri-la:control')
   and code in ('remote','matter','motor','freestop','remote_wand');
update public.option_values set is_default = true
 where id in ('shangri-la:control:chain') and not exists (select 1 from public.option_values o where o.group_id = 'shangri-la:control' and o.is_default and o.active);

update public.price_flags set resolved = true, resolution_note = 'Remote wand no longer exists: Shangri-La now offers Chain and Motorized (+$70).'
 where flag_key = 'shangri-remote-wand';
