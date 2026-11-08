-- Migration 23: record the grants live was tightened to by hand, so every project matches (and tighten a little further).
-- Safe to run more than once. Paste the whole file into the Supabase SQL Editor. Needs migrations 4 and 15.
--
-- Supabase's default privileges give every API role everything on a new table. Migrations narrow that table by table, but two places were missed:
--
--  1. audit_log: migration 4 says the server key (service_role) can only read it ("it cannot write either"), but it never revoked the defaults.
--     Live was tightened by hand; a fresh project (staging) was not. The audit triggers are SECURITY DEFINER, so they do not depend on service_role.
--  2. orders: the table was created by hand before the migrations began, so nothing narrowed it. Live was tightened by hand: the public (anon) role and
--     the server key have no access. Customers reach it only through their own login and the "Users manage own orders" policy (src/lib/useAuth.js);
--     guests have no saved orders, and the server never uses it.
--
-- TRUNCATE skips row-level security, so it is removed everywhere it is not needed (live still had it for these roles; the REST API does not expose it,
-- so this closes a gap rather than a hole). References and trigger privileges are left as they are.

revoke insert, update, delete, truncate on public.audit_log from service_role;

revoke select, insert, update, delete, truncate on public.orders from anon, service_role;
revoke truncate on public.orders from authenticated;
