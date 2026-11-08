-- READ-ONLY. One row per public table and role (anon, authenticated, service_role), with the privileges that role effectively has on it
-- (direct grants plus anything granted to everyone). Run it on live and on staging and compare the two results.
-- Column-level grants are not included. Tables are ordinary and partitioned tables in the public schema (views and sequences are not).
select c.relname as table_name,
       r.rolname as role,
       coalesce(nullif(concat_ws(', ',
         case when has_table_privilege(r.rolname, c.oid, 'SELECT')     then 'SELECT'     end,
         case when has_table_privilege(r.rolname, c.oid, 'INSERT')     then 'INSERT'     end,
         case when has_table_privilege(r.rolname, c.oid, 'UPDATE')     then 'UPDATE'     end,
         case when has_table_privilege(r.rolname, c.oid, 'DELETE')     then 'DELETE'     end,
         case when has_table_privilege(r.rolname, c.oid, 'TRUNCATE')   then 'TRUNCATE'   end,
         case when has_table_privilege(r.rolname, c.oid, 'REFERENCES') then 'REFERENCES' end,
         case when has_table_privilege(r.rolname, c.oid, 'TRIGGER')    then 'TRIGGER'    end), ''), '(none)') as privileges
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (select rolname from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) r
 where n.nspname = 'public' and c.relkind in ('r', 'p')
 order by c.relname, r.rolname;
