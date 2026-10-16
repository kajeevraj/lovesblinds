-- Local tests for migration 10 (one color, one name, several lines; price groups admin-only; customer prices).
-- Run after the stubs and migrations 1 to 7, 9 and 10 in a throwaway database. Each test prints what the database answered.
\set ON_ERROR_STOP off
\set VERBOSITY terse
\pset pager off
\pset format unaligned
\pset tuples_only on

insert into fabrics (id, product_line, shown_in, family, collection_name, sort_order) values
  ('roller:solar:aries',   'roller',  '{roller}', 'solar',   'Aries', 0),
  ('roller:solar:leo',     'roller',  '{roller}', 'solar',   'Leo',   1),
  ('roller:blackout:stone','roller',  '{roller}', 'blackout','Stone', 2),
  ('drapery:orsay',        'drapery', '{roman,drapery}', null, 'Orsay', 0),
  ('drapery:lyon',         'drapery', '{roman,drapery}', null, 'Lyon',  1),
  ('cellular:-:cs',        'cellular','{cellular}', null, 'Cellular Shades', 0),
  ('zebra:-:neptune',      'zebra',   '{zebra}',  null, 'Neptune', 0);
insert into swatches (id, fabric_id, product_line, shown_in, family, display_name, supplier_code, supplier_color_name, color_family, image_path, thumb_path, grade) values
  ('roller:solar:S1', 'roller:solar:aries', 'roller', '{roller}', 'solar', 'Linen', 'S1', 'Beige 12', 'Beige/Tan', 'a.jpg', 'a.webp', null),
  ('roller:solar:S2', 'roller:solar:aries', 'roller', '{roller}', 'solar', 'Sand',  'S2', 'Sand', 'Beige/Tan', 'b.jpg', 'b.webp', null),
  ('drapery:D1', 'drapery:orsay', 'drapery', '{roman,drapery}', null, 'Oatmeal', 'D1', 'Oat', 'Beige/Tan', 'c.jpg', 'c.webp', 'C'),
  ('roller:solar:S3', 'roller:solar:aries', 'roller', '{roller}', 'solar', 'Mist', 'S3', 'Mist', 'Gray', 'g.jpg', 'g.webp', null),
  ('zebra:ABC', 'zebra:-:neptune', 'zebra', '{zebra}', null, 'Pebble', 'ABC', 'Pebble', 'Gray', 'e.jpg', 'e.webp', null);

-- admin identity for the RPCs: service role
select set_config('request.jwt.claims', '{"role":"service_role"}', false);

\echo '1. tick Roman & Drapery on a roller color (default price group = first in that line; expect added=[drapery], group orsay):'
select set_swatch_lines('roller:solar:S1', '[{"product_line":"roller"},{"product_line":"drapery"}]'::jsonb);
select fabric_id from swatch_links where swatch_id = 'roller:solar:S1';
\echo '2. the link has no name of its own (expect: no display_name column):'
select count(*) from information_schema.columns where table_name = 'swatch_links' and column_name = 'display_name';
\echo '3. another color with that NAME in Roman (expect: refused, naming the color with code S1):'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('drapery:D2', 'drapery:lyon', 'drapery', '{roman,drapery}', 'linen', 'D2', 'Beige/Tan', 'd.jpg', 'd.webp');
\echo '4. adding a color to a line where its name is taken (expect: refused, naming the color with code D3):'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('drapery:D3', 'drapery:lyon', 'drapery', '{roman,drapery}', 'Sand', 'D3', 'Beige/Tan', 'f.jpg', 'f.webp');
select set_swatch_lines('roller:solar:S2', '[{"product_line":"roller"},{"product_line":"drapery"}]'::jsonb);
\echo '5. renaming a color to a name taken in ANY of its lines (expect: refused):'
update swatches set display_name = 'Oatmeal' where id = 'roller:solar:S1';
\echo '6. unticking a line removes the link (expect removed=[drapery], then 0 links):'
select set_swatch_lines('roller:solar:S1', '[{"product_line":"roller"}]'::jsonb) ->> 'removed';
select count(*) from swatch_links where swatch_id = 'roller:solar:S1';
select set_swatch_lines('roller:solar:S1', '[{"product_line":"roller"},{"product_line":"drapery"}]'::jsonb) ->> 'added';
\echo '7. unticking the MAIN line promotes another (a different color: expect main=drapery, product_line drapery, fabric drapery:orsay, 0 links):'
select set_swatch_lines('roller:solar:S3', '[{"product_line":"roller"},{"product_line":"drapery"}]'::jsonb) ->> 'added';
select set_swatch_lines('roller:solar:S3', '[{"product_line":"drapery"}]'::jsonb) ->> 'main';
select product_line || ' ' || fabric_id || ' links=' || (select count(*) from swatch_links where swatch_id = 'roller:solar:S3') from swatches where id = 'roller:solar:S3';
\echo '8. a color must keep one line (expect: refused):'
select set_swatch_lines('roller:solar:S1', '[]'::jsonb);
\echo '9. an explicit price group for a line, then change it, then remove it (expect lyon, then orsay, then 0):'
select set_swatch_lines('zebra:ABC', '[{"product_line":"zebra"},{"product_line":"drapery","fabric_id":"drapery:lyon"}]'::jsonb) ->> 'added';
select fabric_id from swatch_links where swatch_id = 'zebra:ABC';
select set_swatch_lines('zebra:ABC', '[{"product_line":"zebra"},{"product_line":"drapery","fabric_id":"drapery:orsay"}]'::jsonb) ->> 'added';
select fabric_id from swatch_links where swatch_id = 'zebra:ABC';
select set_swatch_lines('zebra:ABC', '[{"product_line":"zebra"}]'::jsonb) ->> 'removed';
select count(*) from swatch_links where swatch_id = 'zebra:ABC';
\echo '10. a price group from the wrong line (expect: refused):'
select set_swatch_lines('roller:solar:S2', '[{"product_line":"roller"},{"product_line":"zebra","fabric_id":"drapery:orsay"}]'::jsonb);
\echo '11. cellular needs a family; default light-filtering (expect cellular family light-filtering):'
select set_swatch_lines('zebra:ABC', '[{"product_line":"zebra"},{"product_line":"cellular"}]'::jsonb) ->> 'added';
select family from swatch_links where swatch_id = 'zebra:ABC';
\echo '12. audit log: adds and removes of lines are recorded (expect INSERT and DELETE rows for swatch_links):'
select string_agg(distinct action, ',' order by action) from audit_log where table_name = 'swatch_links';
\echo '13. extra cost starts at 0, cannot be negative:'
select distinct extra_cost from swatches;
update swatches set extra_cost = -1 where id = 'zebra:ABC';
update swatches set extra_cost = 12.5 where id = 'zebra:ABC';

\echo '=== PUBLIC CATALOG (what the customer site reads)'
\echo '14. no price group names or ids, no supplier color names, no grade, no extra cost anywhere in the payload (expect 0 hits):'
select count(*) from (select public_catalog('{roller,roman,drapery,zebra,cellular}') j) t
 where j::text ~* '(aries|leo|stone|orsay|lyon|neptune|collection_name|supplier_color_name|"grade"|extra_cost|beige 12|roller:solar:aries|drapery:orsay)';
\echo '15. the linked color S1 appears in both lines under the same name (expect 1 and 1):'
select count(*) from jsonb_array_elements(public_catalog('{roman}')) g, jsonb_array_elements(g -> 'swatches') s where s ->> 'id' = 'roller:solar:S1';
select count(*) from jsonb_array_elements(public_catalog('{roller}')) g, jsonb_array_elements(g -> 'swatches') s where s ->> 'id' = 'roller:solar:S1';
\echo '16. hiding the color hides it in every line (expect 2 before, 0 after):'
select count(*) from (select s ->> 'id' n from jsonb_array_elements(public_catalog('{roller,roman,drapery}')) g, jsonb_array_elements(g -> 'swatches') s) t where n = 'roller:solar:S1';
update swatches set active = false where id = 'roller:solar:S1';
select count(*) from (select s ->> 'id' n from jsonb_array_elements(public_catalog('{roller,roman,drapery}')) g, jsonb_array_elements(g -> 'swatches') s) t where n = 'roller:solar:S1';
update swatches set active = true where id = 'roller:solar:S1';
\echo '17. anon and signed-in non-admin cannot read the tables, can call the catalog:'
set role anon; select count(*) from swatches; reset role;
set role anon; select count(*) from fabrics; reset role;
set role anon; select jsonb_array_length(public_catalog('{zebra}')); reset role;
set role authenticated; select count(*) from fabrics; select count(*) from swatch_links; reset role;

\echo '=== CUSTOMER PRICE'
insert into pricing_lines (id, name, markup) values ('zebra', 'Zebra', 0.5), ('roman', 'Roman', 0.5);
insert into price_grids (grid_key, line_id, systems, scope, label, rows_are, row_axis, col_axis, cost) values
  ('t-zebra', 'zebra', '{cord}', 'line', 'zebra test', 'width', '{40}', '{60}', '{100}'),
  ('t-roman', 'roman', '{cord}', 'line', 'roman test', 'width', '{40}', '{60}', '{200}');
\echo '18. price = round(cost x 1.5) + extra cost AFTER the markup: 100 x 1.5 = 150, + 12.5 = 163 (expect 163):'
select estimate_price_for_swatch('zebra', 'zebra:ABC', '{"control":"cord"}', 40, 60);
\echo '19. the answer has only price / custom_size / price_on_request (expect 3 keys):'
select count(*) from jsonb_object_keys(estimate_price_for_swatch('zebra', 'zebra:ABC', '{"control":"cord"}', 40, 60));
\echo '20. extra 0 -> 150; a size past the grid -> custom size; unknown or hidden color -> custom size:'
update swatches set extra_cost = 0 where id = 'zebra:ABC';
select estimate_price_for_swatch('zebra', 'zebra:ABC', '{"control":"cord"}', 40, 60) ->> 'price';
select estimate_price_for_swatch('zebra', 'zebra:ABC', '{"control":"cord"}', 400, 60) ->> 'custom_size';
select estimate_price_for_swatch('zebra', 'nope', '{"control":"cord"}', 40, 60) ->> 'custom_size';
\echo '21. the same color priced in another line uses that line\x27s price group (Roman via link; expect 300):'
select set_swatch_lines('zebra:ABC', '[{"product_line":"zebra"},{"product_line":"drapery"}]'::jsonb) ->> 'added';
select estimate_price_for_swatch('roman', 'zebra:ABC', '{"control":"cord"}', 40, 60) ->> 'price';
\echo '22. the admin version shows group and extra apart; a signed-in non-admin cannot call it:'
select (price_for_swatch('roman', 'zebra:ABC', '{"control":"cord"}', 40, 60)) -> 'price_group' ->> 'name';
set role authenticated; select estimate_price_debug_for_swatch('roman', 'zebra:ABC', '{"control":"cord"}', 40, 60); reset role;
set role anon; select price_for_swatch('roman', 'zebra:ABC', '{"control":"cord"}', 40, 60); reset role;
