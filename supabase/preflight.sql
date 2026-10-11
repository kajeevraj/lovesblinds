-- READ-ONLY preflight. Run before the migrations; every query only reads.
-- Expected result: every count is 0. If any is not, STOP and report it; do not run the migrations.
select 'public tables named fabrics / swatches / admins' as what, count(*) as found
  from information_schema.tables
 where table_schema = 'public' and table_name in ('fabrics', 'swatches', 'admins')
union all
select 'storage bucket "swatches"', count(*) from storage.buckets where id = 'swatches'
union all
select 'functions public.is_admin / set_updated_at / swatches_validate / fabrics_validate / bind_admin_to_user', count(*)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('is_admin', 'set_updated_at', 'swatches_validate', 'fabrics_validate', 'bind_admin_to_user')
union all
select 'trigger bind_admin_on_signup on auth.users', count(*)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'bind_admin_on_signup'
union all
select 'storage.objects policies whose name mentions swatch', count(*)
  from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%swatch%';

-- For information (not a stop condition): the existing orders table the site already uses
select 'public.orders exists (it is not touched by the migrations)' as what, count(*) as found
  from information_schema.tables where table_schema = 'public' and table_name = 'orders';
