alter table public.sent_orders drop constraint if exists sent_orders_status_check;

update public.sent_orders set status = case status
  when 'in_progress' then 'confirmed'
  when 'quoted'      then 'confirmed'
  when 'done'        then 'shipped'
  when 'cancelled'   then 'new'
  else status end
where status not in ('new', 'confirmed', 'ordered', 'shipped');

alter table public.sent_orders add constraint sent_orders_status_check check (status in ('new', 'confirmed', 'ordered', 'shipped'));
