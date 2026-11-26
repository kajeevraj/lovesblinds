insert into public.price_adders (line_id, adder_key, label, kind, amount, unit, applies_when, origin, status, source, note)
values ('dream-curtains', 'pull-rod', 'Pull rod', 'add', 0, 'flat', '{"control":["pull-rod"]}'::jsonb, 'manual', 'confirm', 'placeholder: priced like Manual until the supplier confirms',
        'The supplier has not confirmed a pull rod price. $0 keeps it priced like Manual. Type the real cost here once known (cost before markup).')
on conflict (line_id, adder_key) do nothing;
