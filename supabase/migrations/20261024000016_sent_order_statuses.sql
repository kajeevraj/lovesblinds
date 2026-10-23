-- Migration 16: the four statuses of a sent order are new, confirmed, ordered, shipped.
-- Safe to run more than once. Paste the whole file into the Supabase SQL Editor. Needs migration 14.
--
--   new        we have the order and have not looked at it yet
--   confirmed  we have confirmed the details and the final price with the customer
--   ordered    we have placed the order with the manufacturer
--   shipped    it is on its way to the customer
--
-- Migration 14 had a different list (new, in_progress, quoted, done, cancelled). Nothing used it yet, so any row that
-- still carries an old value is moved to the nearest new one first.

alter table public.sent_orders drop constraint if exists sent_orders_status_check;

update public.sent_orders set status = case status
  when 'in_progress' then 'confirmed'
  when 'quoted'      then 'confirmed'
  when 'done'        then 'shipped'
  when 'cancelled'   then 'new'
  else status end
where status not in ('new', 'confirmed', 'ordered', 'shipped');

alter table public.sent_orders add constraint sent_orders_status_check check (status in ('new', 'confirmed', 'ordered', 'shipped'));
