-- Migration 19: admin override of the remote on a sent order's line. ADDITIVE and safe to run now (the live site never touches the column).
-- The remote and its channel count are decided on the server for each order and saved inside each line (`lines[i].remote`).
-- Admins can pick a different remote per line; that choice is kept apart in `remote_overrides` ({"0": "ch16", "2": "dual-multi"}, keyed by the
-- line's position), because a sent order's lines can never be changed (migration 14).
alter table public.sent_orders add column if not exists remote_overrides jsonb not null default '{}'::jsonb;
alter table public.sent_orders drop constraint if exists sent_orders_remote_overrides_object;
alter table public.sent_orders add constraint sent_orders_remote_overrides_object check (jsonb_typeof(remote_overrides) = 'object');
