import { supabase } from '../../lib/supabase.js';

const must = ({ data, error }) => { if (error) throw error; return data; };
const GRID_COLS = 'id,grid_key,line_id,systems,variant,lining,scope,special,multiplier,label,roll_widths,rows_are,row_axis,col_axis,source_file,source_sheet,source_title,origin_row,origin_col,anomalies,active';

// Everything the pricing screens need except the cost cells themselves (those load per grid).
export async function loadPricing() {
  const [lines, markups, flags, adders, grids, gridFabrics, productLines, groups, values, rules, hardware, dTiers, dFabrics] = await Promise.all([
    supabase.from('pricing_lines').select('*').order('id').then(must),
    supabase.from('collection_markups').select('*').then(must),
    supabase.from('price_flags').select('*').order('created_at').then(must),
    supabase.from('price_adders').select('*').order('line_id').order('adder_key').then(must),
    supabase.from('price_grids').select(GRID_COLS).order('line_id').order('label').then(must),
    supabase.from('grid_fabrics').select('*').then(must),
    supabase.from('product_lines').select('*').order('sort_order').then(must),
    supabase.from('option_groups').select('*').order('line_id').order('sort_order').then(must),
    supabase.from('option_values').select('*').order('group_id').order('sort_order').then(must),
    supabase.from('size_rules').select('*').order('line_id').order('created_at').then(must),
    supabase.from('hardware_rates').select('*').order('sort_order').then((r) => (r.error ? null : r.data)),      // null until migration 20 has been run
    supabase.from('drapery_tiers').select('*').order('tier').then((r) => (r.error ? null : r.data)),
    supabase.from('drapery_fabrics').select('*').order('code').limit(2000).then((r) => (r.error ? null : r.data)),
  ]);
  return { lines, markups, flags, adders, grids, gridFabrics, productLines, groups, values, rules, hardware, dTiers, dFabrics };
}
export const loadGridCost = async (id) => must(await supabase.from('price_grids').select('cost').eq('id', id).single()).cost;
// Full grids (with cost) for one line, for the re-import comparison
export async function loadLineGridsWithCost(lineId) {
  const grids = must(await supabase.from('price_grids').select(`${GRID_COLS},cost`).eq('line_id', lineId));
  const gf = must(await supabase.from('grid_fabrics').select('grid_id,fabric_id').in('grid_id', grids.map((g) => g.id).concat(['00000000-0000-0000-0000-000000000000'])));
  const byGrid = new Map(); for (const r of gf) { if (!byGrid.has(r.grid_id)) byGrid.set(r.grid_id, []); byGrid.get(r.grid_id).push(r.fabric_id); }
  return grids.map((g) => ({ ...g, fabrics: byGrid.get(g.id) || [] }));
}
export const estimate = async (fn, args) => must(await supabase.rpc(fn, args));
export const patch = async (table, match, values) => {
  let q = supabase.from(table).update(values); for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const data = must(await q.select()); if (!data.length) throw new Error('Nothing was saved. You may have been signed out.'); return data[0];
};
export const upsertMarkup = async (fabricId, markup) => must(await supabase.from('collection_markups').upsert({ fabric_id: fabricId, markup }, { onConflict: 'fabric_id' }).select());
export const removeMarkup = async (fabricId) => must(await supabase.from('collection_markups').delete().eq('fabric_id', fabricId).select());
export const applyImport = async (args) => must(await supabase.rpc('price_import_apply', args));
