-- Migration 11: the public stops reading the catalog tables directly. RUN THIS WHEN THE BRANCH IS MERGED, not before.
--
-- Price group names (fabrics.collection_name) and the ids that carry them live in these tables. The new customer site reads
-- only through public_catalog() (migration 10), which leaves them out. The CURRENT live site on main still reads fabrics and
-- swatches directly, so running this while main is deployed makes its pages say "Colors are temporarily unavailable".
-- Safe to re-run. To undo: re-create the three policies from migrations 2 and 9 and grant select to anon again.

drop policy if exists "anyone reads active fabrics" on public.fabrics;
drop policy if exists "anyone reads active swatches" on public.swatches;
drop policy if exists "anyone reads active links" on public.swatch_links;
revoke select on public.fabrics, public.swatches, public.swatch_links from anon;
