// Matches the collections named in a parsed workbook to our fabrics, and shapes grids for price_import_apply().
import { parseRollTitle } from './parseSupplier.js';  // eslint-disable-line no-unused-vars

const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

// fabrics: [{ id, product_line, family, collection_name }]. Returns the grids with fabric links, plus what did not match.
export function mapToFabrics(parsed, fabrics, { overrides = {} } = {}) {
  const lineFabrics = fabrics.filter((f) => f.product_line === (parsed.line === 'roman' ? 'drapery' : parsed.line));
  const unmapped = []; const linked = new Set();
  const grids = parsed.grids.map((g) => {
    const fabs = new Map();
    for (const t of g.collections) {
      const ov = overrides[`${norm(t.name)}:${t.family || '*'}`];
      let cands = ov ? lineFabrics.filter((f) => ov.includes(f.id)) : lineFabrics.filter((f) => norm(f.collection_name) === norm(t.name) && (!t.family || f.family === t.family));
      if (!cands.length) { unmapped.push({ name: t.name, family: t.family, grid: g.label, sheet: g.source_sheet }); continue; }
      for (const f of cands) { fabs.set(f.id, { fabric_id: f.id, roll_widths: t.rolls || [], max_drop: t.maxDrop ?? null }); linked.add(f.id); }
    }
    const { _key, _sheet, collections, ...rest } = g;
    return { ...rest, grid_key: _key, fabrics: [...fabs.values()] };
  });
  const noGrid = parsed.grids.every((g) => g.scope === 'line') ? [] : lineFabrics.filter((f) => !linked.has(f.id));
  const seen = new Set(); const unmappedUniq = unmapped.filter((u) => { const k = `${u.name}:${u.family}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { grids, unmapped: unmappedUniq, fabricsWithoutGrid: noGrid };
}
