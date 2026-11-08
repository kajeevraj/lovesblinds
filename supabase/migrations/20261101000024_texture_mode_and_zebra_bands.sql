-- Migration 24: per-color fabric texture setting and Zebra band widths. Safe to run more than once. Paste the whole file into the Supabase SQL Editor.
-- Needs migration 20 (public_catalog with preview_color).
--
--  1. swatches.texture_mode: how the fabric is drawn in the picker tiles, the "This blind" chip and the 3D preview.
--       'photo'   the flattest part of the supplier photo, cut out and made to tile (tex256/<line>/<name>.webp)
--       'pattern' a weave generated from the color's preview color by fabric type (solar basketweave, blackout smooth, screen view mesh, linen slubs,
--                 cellular pleats); used when the photo has folds, is a whole shade, is too small or has strong shading
--       null      not decided yet: the site looks at the photo itself (src/lib/textureAnalysis.js). scripts/backfill-textures.mjs --apply fills it in.
--     A Zebra color is always drawn as the pattern, whatever this says. Set per color in Products > Colors > Texture.
--  2. Zebra band widths, in inches: product_lines.band_solid_in / band_sheer_in are the DEFAULT for every color of that line (empty = 3 in and 2 in),
--     swatches.zebra_solid_in / zebra_sheer_in are an optional per-color OVERRIDE (empty = use the line's default). Set in Products > Zebra and Colors.
--  3. public_catalog() also returns these fields (customer-safe, same as preview_color).

alter table public.swatches add column if not exists texture_mode text;
alter table public.swatches drop constraint if exists swatches_texture_mode_check;
alter table public.swatches add constraint swatches_texture_mode_check check (texture_mode is null or texture_mode in ('photo','pattern'));
comment on column public.swatches.texture_mode is 'photo = flat crop of the supplier photo; pattern = generated weave in the preview color; null = decided by looking at the photo. Zebra is always pattern.';

alter table public.swatches add column if not exists zebra_solid_in numeric;
alter table public.swatches add column if not exists zebra_sheer_in numeric;
alter table public.swatches drop constraint if exists swatches_zebra_bands_check;
alter table public.swatches add constraint swatches_zebra_bands_check check (
  (zebra_solid_in is null or (zebra_solid_in >= 0.5 and zebra_solid_in <= 12))
  and (zebra_sheer_in is null or (zebra_sheer_in >= 0.5 and zebra_sheer_in <= 12)));
comment on column public.swatches.zebra_solid_in is 'Zebra: this color''s own solid band width in inches (0.5 to 12). Empty = the line''s default.';
comment on column public.swatches.zebra_sheer_in is 'Zebra: this color''s own sheer band width in inches (0.5 to 12). Empty = the line''s default.';

alter table public.product_lines add column if not exists band_solid_in numeric;
alter table public.product_lines add column if not exists band_sheer_in numeric;
alter table public.product_lines drop constraint if exists product_lines_bands_check;
alter table public.product_lines add constraint product_lines_bands_check check (
  (band_solid_in is null or (band_solid_in >= 0.5 and band_solid_in <= 12))
  and (band_sheer_in is null or (band_sheer_in >= 0.5 and band_sheer_in <= 12)));
comment on column public.product_lines.band_solid_in is 'Default solid band width in inches for the colors of this line (Zebra). Empty = 3.';
comment on column public.product_lines.band_sheer_in is 'Default sheer band width in inches for the colors of this line (Zebra). Empty = 2.';

create or replace function public.public_catalog(p_scope text[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t.g order by t.pl, t.so, t.pk), '[]'::jsonb)
    from (
      select f.product_line as pl, f.sort_order as so, f.public_key as pk,
        jsonb_build_object(
          'id', f.public_key, 'product_line', f.product_line, 'shown_in', f.shown_in, 'family', f.family,
          'width', f.width, 'composition', f.composition, 'weight', f.weight, 'thickness', f.thickness,
          'openness', f.openness, 'opacity', f.opacity, 'use_area', f.use_area, 'extra_specs', f.extra_specs,
          'sort_order', f.sort_order, 'line_band_solid_in', pl.band_solid_in, 'line_band_sheer_in', pl.band_sheer_in,
          'swatches', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'id', s.id, 'fabric_id', f.public_key, 'product_line', f.product_line, 'shown_in', f.shown_in, 'family', x.family,
                     'display_name', s.display_name, 'supplier_code', s.supplier_code, 'color_family', s.color_family,
                     'image_path', s.image_path, 'thumb_path', s.thumb_path, 'image_kind', s.image_kind, 'preview_color', s.preview_color,
                     'texture_mode', s.texture_mode, 'zebra_solid_in', s.zebra_solid_in, 'zebra_sheer_in', s.zebra_sheer_in,
                     'width', s.width, 'composition', s.composition, 'roman_styles', s.roman_styles, 'styles', s.styles,
                     'sort_order', x.sort_order) order by x.sort_order, s.id)
              from (select sw.id, sw.family, sw.sort_order from public.swatches sw where sw.fabric_id = f.id
                    union all
                    select l.swatch_id, l.family, l.sort_order from public.swatch_links l where l.fabric_id = f.id and l.active) x
              join public.swatches s on s.id = x.id and s.active
          ), '[]'::jsonb)
        ) as g
        from public.fabrics f left join public.product_lines pl on pl.id = f.product_line
       where f.active and f.shown_in && p_scope
    ) t;
$$;
revoke all on function public.public_catalog(text[]) from public;
grant execute on function public.public_catalog(text[]) to anon, authenticated;
