-- Migration 22: the server key (service_role) can only add and read sent orders, never change or remove them.
-- Safe to run more than once. Paste the whole file into the Supabase SQL Editor. Needs migration 14.
--
-- Migration 14 granted service_role "select, insert" on public.sent_orders, but Supabase's default privileges had already given it everything,
-- so on a fresh project (staging) the server key could also update, delete and truncate sent orders. The live project was tightened by hand at
-- some point and no migration recorded it. This records it, so every project matches.
--
-- Nothing in the code needs more: the order form only inserts (api/quote.js), and an admin changes a status, note or override, or deletes an order,
-- through their own login (the "authenticated" role and the admin policies in migration 14), not the server key.
-- Note: live's service_role also still had TRUNCATE; this removes it there too. References and trigger privileges are left as they are.

revoke update, delete, truncate on public.sent_orders from service_role;
