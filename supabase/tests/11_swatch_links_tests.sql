-- Local tests for migration 9 (swatch_links). Run after the stubs, migrations 1 to 5 and 9, in a throwaway database.
\set ON_ERROR_STOP off
\set VERBOSITY terse
\pset pager off
\pset format unaligned
\pset tuples_only on

insert into fabrics (id, product_line, shown_in, family, collection_name) values
  ('roller:solar:aries',   'roller',  '{roller}', 'solar',   'Aries'),
  ('roller:blackout:stone','roller',  '{roller}', 'blackout','Stone'),
  ('drapery:orsay',        'drapery', '{roman,drapery}', null, 'Orsay'),
  ('drapery:lyon',         'drapery', '{roman,drapery}', null, 'Lyon'),
  ('cellular:-:cellular-shades','cellular','{cellular}', null, 'Cellular Shades'),
  ('zebra:-:neptune',      'zebra',   '{zebra}',  null, 'Neptune');
insert into swatches (id, fabric_id, product_line, shown_in, family, display_name, supplier_code, color_family, image_path, thumb_path) values
  ('roller:solar:S1', 'roller:solar:aries', 'roller', '{roller}', 'solar', 'Linen', 'S1', 'Beige/Tan', 'a.jpg', 'a.webp'),
  ('roller:solar:S2', 'roller:solar:aries', 'roller', '{roller}', 'solar', 'Sand',  'S2', 'Beige/Tan', 'b.jpg', 'b.webp'),
  ('drapery:D1', 'drapery:orsay', 'drapery', '{roman,drapery}', null, 'Oatmeal', 'D1', 'Beige/Tan', 'c.jpg', 'c.webp'),
  ('zebra:ABC', 'zebra:-:neptune', 'zebra', '{zebra}', null, 'Pebble', 'ABC', 'Gray', 'e.jpg', 'e.webp');

\echo '1. link a roller swatch into Roman (drapery) under its own name (expect: inserted, product_line=drapery):'
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S1', 'drapery:orsay', 'Natural Linen') returning product_line;
\echo '2. the same swatch into the same line again (expect: unique violation):'
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S1', 'drapery:lyon', 'Other Linen');
\echo '3. link into its own home line (expect: refused):'
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S2', 'roller:blackout:stone', 'Sand Dark');
\echo '4. a name already used in that line by another swatch (expect: refused):'
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S2', 'drapery:lyon', 'oatmeal');
\echo '5. a name already used by another LINK in that line (expect: refused):'
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S2', 'drapery:lyon', 'natural linen');
\echo '6. name with a digit / with the collection name / with a supplier code (expect: 3 refusals):'
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S2', 'drapery:lyon', 'Sand 2');
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S2', 'drapery:lyon', 'Orsay Sand');
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S2', 'drapery:lyon', 'Sand ABC');
\echo '7. a different name in the same line is fine (expect: inserted):'
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S2', 'drapery:lyon', 'Warm Sand') returning display_name;
\echo '8. Cellular needs a family (expect: refused), with one it works:'
insert into swatch_links (swatch_id, fabric_id, display_name) values ('roller:solar:S1', 'cellular:-:cellular-shades', 'Linen Cell');
insert into swatch_links (swatch_id, fabric_id, display_name, family) values ('roller:solar:S1', 'cellular:-:cellular-shades', 'Linen Cell', 'light-filtering') returning family;
\echo '9. a new swatch whose name equals a link name in that line (expect: refused):'
insert into swatches (id, fabric_id, product_line, shown_in, display_name, supplier_code, color_family, image_path, thumb_path)
values ('drapery:D2', 'drapery:lyon', 'drapery', '{roman,drapery}', 'Natural Linen', 'D2', 'Beige/Tan', 'd.jpg', 'd.webp');
\echo '10. renaming a collection into a link name (expect: refused):'
update fabrics set collection_name = 'Natural' where id = 'zebra:-:neptune';
\echo '11. audit log has the links (expect: 3 INSERTs):'
select count(*) from audit_log where table_name = 'swatch_links' and action = 'INSERT';
\echo '12. unlink is logged (expect DELETE 1):'
delete from swatch_links where swatch_id = 'roller:solar:S2' and product_line = 'drapery';
select action || ' ' || (old_row ->> 'swatch_id') from audit_log where table_name = 'swatch_links' and action = 'DELETE';
\echo '13. deleting a swatch deletes its links (expect 0 left for S1):'
delete from swatches where id = 'roller:solar:S1';
select count(*) from swatch_links where swatch_id = 'roller:solar:S1';
\echo '14. anonymous: links of an inactive swatch/fabric are invisible; no writes:'
set role anon; select count(*) from swatch_links; insert into swatch_links (swatch_id, fabric_id, display_name) values ('drapery:D1', 'roller:solar:aries', 'Hack'); reset role;
\echo '15. signed-in non-admin cannot write:'
set role authenticated; insert into swatch_links (swatch_id, fabric_id, display_name) values ('drapery:D1', 'roller:solar:aries', 'Hack'); delete from swatch_links; reset role;
