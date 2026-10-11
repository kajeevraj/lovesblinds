-- The service role bypasses RLS but still needs table privileges. Some Supabase projects do not grant these
-- automatically to tables created from the SQL editor, so the seed script and server-side code get
-- "permission denied" (42501). Grant them explicitly. anon and authenticated are unchanged (see migration 2).
grant select, insert, update, delete on public.fabrics, public.swatches, public.admins to service_role;
