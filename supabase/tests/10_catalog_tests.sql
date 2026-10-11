-- Constraint and security tests. Run after the two migrations (and, locally, the stubs).
-- Each test prints what it does and what the database answered.
\set ON_ERROR_STOP off
\set VERBOSITY terse
\set QUIET off
\pset pager off
\pset format unaligned
\pset tuples_only on

-- ---- fixtures (inserted as the table owner) ---------------------------------------------------------------
insert into fabrics (id, product_line, shown_in, family, collection_name, width) values
  ('roller:screen-view:purity', 'roller',  '{roller}',  'screen-view', 'Purity',  '118 in'),
  ('roller:blackout:stone',     'roller',  '{roller}',  'blackout',    'Stone',   '110 in'),
  ('zebra:-:neptune',           'zebra',   '{zebra}',   null,          'Neptune', '118 in'),
  ('zebra:-:jupiter',           'zebra',   '{zebra}',   null,          'Jupiter', '118 in');
insert into swatches (id, fabric_id, product_line, shown_in, family, display_name, supplier_code, supplier_color_name, color_family, image_path, thumb_path) values
  ('roller:screen-view:XSS1', 'roller:screen-view:purity', 'roller', '{roller}', 'screen-view', 'Snow White', 'XSS1', 'White', 'White', 'full/roller/XSS1.jpg', 'thumb/roller/XSS1.webp'),
  ('roller:blackout:YB1',     'roller:blackout:stone',     'roller', '{roller}', 'blackout',    'Snow White', 'YB1',  'White', 'White', 'full/roller/YB1.jpg',  'thumb/roller/YB1.webp'),
  ('zebra:YZB1',              'zebra:-:neptune',           'zebra',  '{zebra}',  null,          'Aspen White','YZB1', 'White', 'White', 'full/zebra/YZB1.jpg',  'thumb/zebra/YZB1.webp');
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path) values
  ('zebra:PLAIN', 'zebra:-:neptune', 'zebra', '{zebra}', 'Dove Gray', 'PLAIN', 'Gray', 'full/zebra/PLAIN.jpg', 'thumb/zebra/PLAIN.webp');
insert into swatches (id, fabric_id, product_line, shown_in, family, display_name, supplier_code, color_family, image_path, thumb_path, active) values
  ('zebra:YZB9', 'zebra:-:jupiter', 'zebra', '{zebra}', null, 'Hidden Gray', 'YZB9', 'Gray', 'full/zebra/YZB9.jpg', 'thumb/zebra/YZB9.webp', false);
select 'fixtures: ' || count(*) || ' swatches (' || count(*) filter (where active) || ' active)' as setup from swatches;

\echo
\echo '=== CONSTRAINTS (these apply to every writer, admin page included) ==='
\echo '1. duplicate display name, same scope (zebra, different case):'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('zebra:YZB2', 'zebra:-:neptune', 'zebra', '{zebra}', 'aspen white', 'YZB2', 'White', 'a.jpg', 'a.webp');
\echo '2a. the same display name in two different Roller families is allowed (fixtures XSS1 screen-view and YB1 blackout are both "Snow White"):'
select string_agg(id || ' = ' || display_name, ' | ') from swatches where product_line = 'roller';
\echo '2b. the same display name again inside one Roller family:'
insert into swatches (id, fabric_id, product_line, shown_in, family, display_name, supplier_code, color_family, image_path, thumb_path)
values ('roller:screen-view:XSS2', 'roller:screen-view:purity', 'roller', '{roller}', 'screen-view', 'snow white', 'XSS2', 'White', 'a.jpg', 'a.webp');
\echo '3. display name with a digit:'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('zebra:YZB3', 'zebra:-:neptune', 'zebra', '{zebra}', 'Gray 5', 'YZB3', 'Gray', 'a.jpg', 'a.webp');
\echo '4a. duplicate supplier code in the same line:'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('zebra:YZB1b', 'zebra:-:neptune', 'zebra', '{zebra}', 'Pebble Gray', 'yzb1', 'Gray', 'a.jpg', 'a.webp');
\echo '4b. the same supplier code in a different line (allowed):'
insert into swatches (id, fabric_id, product_line, shown_in, family, display_name, supplier_code, color_family, image_path, thumb_path)
values ('roller:blackout:YZB1', 'roller:blackout:stone', 'roller', '{roller}', 'blackout', 'Pebble Gray', 'YZB1', 'Gray', 'a.jpg', 'a.webp');
\echo '5. display name containing a supplier collection name ("Neptune"):'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('zebra:YZB4', 'zebra:-:neptune', 'zebra', '{zebra}', 'Neptune Blue', 'YZB4', 'Blue', 'a.jpg', 'a.webp');
\echo '6. display name containing a supplier code (a letter-only code "PLAIN" is already on another swatch):'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('zebra:YZB5', 'zebra:-:neptune', 'zebra', '{zebra}', 'Plain Gray', 'YZB5', 'Gray', 'a.jpg', 'a.webp');
\echo '7. renaming a collection so it appears in an existing display name:'
update fabrics set collection_name = 'Aspen' where id = 'zebra:-:jupiter';
\echo '8. changing a swatch id (saved orders refer to ids):'
update swatches set id = 'zebra:CHANGED' where id = 'zebra:YZB1';
\echo '9. a roller swatch with no family / a zebra swatch with a family:'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('roller:x', 'roller:screen-view:purity', 'roller', '{roller}', 'Pearl White', 'RX', 'White', 'a.jpg', 'a.webp');
insert into swatches (id, fabric_id, product_line, shown_in, family, display_name, supplier_code, color_family, image_path, thumb_path)
values ('zebra:y', 'zebra:-:neptune', 'zebra', '{zebra}', 'solar', 'Pearl White', 'ZY', 'White', 'a.jpg', 'a.webp');
\echo '9b. a roller swatch whose family differs from its fabric (blackout swatch on a screen-view fabric):'
insert into swatches (id, fabric_id, product_line, shown_in, family, display_name, supplier_code, color_family, image_path, thumb_path)
values ('roller:w', 'roller:screen-view:purity', 'roller', '{roller}', 'blackout', 'Pearl White', 'RW', 'White', 'a.jpg', 'a.webp');
\echo '10. a swatch whose product line differs from its fabric:'
insert into swatches (id, fabric_id, product_line, shown_in, family, display_name, supplier_code, color_family, image_path, thumb_path)
values ('roller:z', 'zebra:-:neptune', 'roller', '{roller}', 'blackout', 'Pearl White', 'RZ', 'White', 'a.jpg', 'a.webp');

\echo
\echo '=== SECURITY: what each kind of caller can do ==='
-- an ordinary signed-in customer, and a signed-in admin
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'customer@example.com', now()),
  ('22222222-2222-2222-2222-222222222222', 'loveblindswindows@gmail.com', now());
select 'admin row bound to the signed-in owner: ' || coalesce(user_id::text, 'NOT BOUND') as admins from admins;

\echo
\echo '--- ANONYMOUS (anon key, no sign-in) ---'
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select 'anon can read: ' || count(*) || ' swatches, ' || (select count(*) from fabrics) || ' fabrics (inactive ones hidden)' as reads from swatches;
select 'anon can read hidden swatch YZB9: ' || exists(select 1 from swatches where id = 'zebra:YZB9') as hidden_visible;
\echo 'anon INSERT swatch:'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('zebra:ANON', 'zebra:-:neptune', 'zebra', '{zebra}', 'Anon Gray', 'ZA9', 'Gray', 'a.jpg', 'a.webp');
\echo 'anon UPDATE swatch:'
update swatches set display_name = 'Hacked Name' where id = 'zebra:YZB1';
\echo 'anon DELETE swatch:'
delete from swatches where id = 'zebra:YZB1';
\echo 'anon read admins:'
select * from admins;
\echo 'anon INSERT storage object:'
insert into storage.objects (bucket_id, name) values ('swatches', 'full/anon.jpg');
reset role;

\echo
\echo '--- SIGNED-IN CUSTOMER, NOT AN ADMIN (e.g. signed in with Google) ---'
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'customer can read: ' || count(*) || ' swatches' as reads from swatches;
select 'customer is_admin(): ' || public.is_admin() as admin_check;
\echo 'customer INSERT swatch:'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('zebra:CUST', 'zebra:-:neptune', 'zebra', '{zebra}', 'Customer Gray', 'ZC9', 'Gray', 'a.jpg', 'a.webp');
\echo 'customer UPDATE swatch (the command tag shows how many rows changed):'
update swatches set display_name = 'Hacked Name' where id = 'zebra:YZB1';
\echo 'customer DELETE swatch (the command tag shows how many rows changed):'
delete from swatches where id = 'zebra:YZB1';
\echo 'customer UPDATE fabric:'
update fabrics set collection_name = 'Renamed' where id = 'zebra:-:neptune';
\echo 'customer read admins (own row only):'
select count(*) as rows_visible from admins;
\echo 'customer INSERT storage object:'
insert into storage.objects (bucket_id, name) values ('swatches', 'full/cust.jpg');
reset role;
select 'after the customer attempts, zebra:YZB1 is still: ' || display_name as untouched from swatches where id = 'zebra:YZB1';

\echo
\echo '--- SIGNED-IN ADMIN (listed in admins) ---'
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select 'admin is_admin(): ' || public.is_admin() as admin_check;
select 'admin reads inactive swatches too: ' || count(*) filter (where not active) || ' inactive of ' || count(*) as reads from swatches;
\echo 'admin INSERT swatch:'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('zebra:ADM', 'zebra:-:neptune', 'zebra', '{zebra}', 'Admin Gray', 'ZD9', 'Gray', 'a.jpg', 'a.webp');
\echo 'admin UPDATE swatch (rename):'
update swatches set display_name = 'Renamed By Admin' where id = 'zebra:ADM';
\echo 'admin DUPLICATE name is still refused:'
update swatches set display_name = 'Aspen White' where id = 'zebra:ADM';
\echo 'admin DELETE swatch:'
delete from swatches where id = 'zebra:ADM';
\echo 'admin INSERT storage object:'
insert into storage.objects (bucket_id, name) values ('swatches', 'full/admin.jpg');
reset role;

\echo
\echo '=== ADMIN BINDING: an unconfirmed sign-up with the admin address must not become admin ==='
update admins set user_id = null;
insert into auth.users (id, email, email_confirmed_at) values ('33333333-3333-3333-3333-333333333333', 'loveblindswindows@gmail.com', null) on conflict do nothing;
select 'unconfirmed duplicate-address user bound: ' || (user_id is not null) as bound from admins;
