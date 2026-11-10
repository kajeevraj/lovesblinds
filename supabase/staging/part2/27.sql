alter table public.swatches add column if not exists texture_type text;
alter table public.swatches drop constraint if exists swatches_texture_type_check;
alter table public.swatches add constraint swatches_texture_type_check check (texture_type is null or texture_type in ('slub','mesh','twill','linen','tweed','motif','print','stripe','smooth'));
comment on column public.swatches.texture_type is 'What kind of cloth the photo shows: slub, mesh, twill, linen, tweed, motif, print, stripe or smooth. Empty = the measured type in the site data.';

alter table public.swatches add column if not exists texture_source text;
alter table public.swatches drop constraint if exists swatches_texture_source_check;
alter table public.swatches add constraint swatches_texture_source_check check (texture_source is null or texture_source in ('generated','photo'));
comment on column public.swatches.texture_source is 'generated = drawn using the photo''s measurements; photo = cut out of the photo; empty = by texture type.';

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
                     'texture_mode', s.texture_mode, 'texture_type', s.texture_type, 'texture_source', s.texture_source, 'weave', s.weave, 'weave_strength', s.weave_strength, 'zebra_solid_in', s.zebra_solid_in, 'zebra_sheer_in', s.zebra_sheer_in,
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
