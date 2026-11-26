-- Migration 28: the Dream Curtains pull rod gets its own price row, so the owner can set it in admin (Products > Pricing > Adders and flags > Dream Curtains > "Pull rod").
-- ADDITIVE ONLY: one insert, no existing row changes, safe to run before or after the new site is deployed. Idempotent: safe to re-run. Paste the whole file into the Supabase
-- SQL Editor (staging first).
--
-- The supplier has not confirmed a pull rod price. Today the site prices a pull rod like Manual ($0 extra); this row keeps exactly that ($0, status "confirm") until the owner
-- types a real amount. Every price calculation already reads adders whose applies_when matches the order's control, so no code changes when the amount is set.
-- Dream Curtains motor cost is untouched ($100).
insert into public.price_adders (line_id, adder_key, label, kind, amount, unit, applies_when, origin, status, source, note)
values ('dream-curtains', 'pull-rod', 'Pull rod', 'add', 0, 'flat', '{"control":["pull-rod"]}'::jsonb, 'manual', 'confirm', 'placeholder: priced like Manual until the supplier confirms',
        'The supplier has not confirmed a pull rod price. $0 keeps it priced like Manual. Type the real cost here once known (cost before markup).')
on conflict (line_id, adder_key) do nothing;
