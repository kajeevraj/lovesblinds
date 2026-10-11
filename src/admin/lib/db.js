import { supabase } from '../../lib/supabase.js';
import { storageUrl } from '../../data/catalogQuery.js';

const BASE = import.meta.env.VITE_SUPABASE_URL;
export const imgUrl = (path) => (path ? storageUrl(BASE, path) : '');

const must = ({ data, error }) => { if (error) throw error; return data; };

export async function loadCatalog() {
  const [fabrics, swatches] = await Promise.all([
    supabase.from('fabrics').select('*').order('product_line').order('sort_order').then(must),
    supabase.from('swatches').select('*').order('product_line').order('sort_order').then(must),
  ]);
  return { fabrics, swatches };
}

// Updates a row and checks that something actually changed (an update the database refuses silently returns no rows).
export async function updateRow(table, id, patch) {
  const data = must(await supabase.from(table).update(patch).eq('id', id).select());
  if (!data.length) throw new Error('Nothing was saved. You may have been signed out, or the row no longer exists.');
  return data[0];
}
export const insertRow = async (table, row) => must(await supabase.from(table).insert(row).select()).at(0);
export const deleteRow = async (table, id) => {
  const data = must(await supabase.from(table).delete().eq('id', id).select());
  if (!data.length) throw new Error('Nothing was deleted. You may have been signed out, or the row no longer exists.');
};
export const swatchOrderCount = async (id) => must(await supabase.rpc('swatch_order_count', { p_id: id }));
export const loadHistory = async (table, rowId, limit = 10) =>
  must(await supabase.from('audit_log').select('id,at,actor_email,action,old_row,new_row').eq('table_name', table).eq('row_id', rowId)
    .order('at', { ascending: false }).limit(limit));
