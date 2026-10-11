-- Helpers for the admin color manager.
--  1. swatch_order_count(id)      admin only: how many saved orders use this swatch (the page offers Hide instead of Delete)
--  2. a BEFORE DELETE trigger     the database itself refuses to delete a swatch that a saved order uses
--  3. swatch_display_names(ids)   anyone: customer-facing names for the swatch ids in old saved orders (hidden swatches included)

-- How many saved orders refer to a swatch. Matches the pick's swatchId, and for orders saved before picks existed,
-- the item's colorCode against the swatch's supplier code (this can only over-block, never under-block).
create or replace function public.swatch_order_count_internal(p_id text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.orders o
   where exists (
     select 1
       from jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) it
      where jsonb_path_exists(it, '$.selection.picks[*] ? (@.swatchId == $id)', jsonb_build_object('id', p_id))
         or lower(it ->> 'colorCode') = (select lower(s.supplier_code) from public.swatches s where s.id = p_id)
   );
$$;
revoke all on function public.swatch_order_count_internal(text) from public, anon, authenticated;

create or replace function public.swatch_order_count(p_id text) returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  return public.swatch_order_count_internal(p_id);
end $$;
revoke all on function public.swatch_order_count(text) from public, anon;
grant execute on function public.swatch_order_count(text) to authenticated;

create or replace function public.swatches_block_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  n := public.swatch_order_count_internal(old.id);
  if n > 0 then
    raise exception 'swatch % is used in % saved order(s); hide it instead of deleting it', old.id, n
      using errcode = 'check_violation', constraint = 'swatches_in_saved_order';
  end if;
  return old;
end $$;
revoke all on function public.swatches_block_delete() from public, anon, authenticated;

create trigger swatches_block_delete before delete on public.swatches
  for each row execute function public.swatches_block_delete();

-- Customer-facing names only (nothing about codes, collections or suppliers), for up to 200 ids at a time.
create or replace function public.swatch_display_names(ids text[]) returns table (id text, display_name text)
language sql stable security definer set search_path = public as $$
  select s.id, s.display_name
    from public.swatches s
   where cardinality(ids) <= 200 and s.id = any (ids);
$$;
revoke all on function public.swatch_display_names(text[]) from public;
grant execute on function public.swatch_display_names(text[]) to anon, authenticated;
