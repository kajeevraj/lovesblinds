import { cellName } from '../../lib/pricing/parseSupplier.js';

export const money = (n, d = 2) => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`);
export const pct = (m) => `${Math.round(Number(m) * 1000) / 10}%`;
// The workbook cell a lookup used
export const sheetCell = (grid) => (grid && grid.origin_row ? cellName(grid.origin_row + grid.row_index - 1, grid.origin_col + grid.col_index - 1) : '');
export const SYSTEM_LABEL = { cord: 'Cord', cordless: 'Cordless', motor: 'Motor', manual: 'Manual' };
export const roman = (n) => n;
// the pricing line a catalog fabric belongs to
export const fabricsOf = (catalogFabrics, priceLine) => {
  const pl = { roman: 'drapery', drapery: 'drapery', 'dream-curtains': 'dream-curtains' }[priceLine] || priceLine;
  return catalogFabrics.filter((f) => f.product_line === pl && (priceLine !== 'roman' || (f.shown_in || []).includes('roman')) && (priceLine !== 'drapery' || (f.shown_in || []).includes('drapery')));
};
export const familyLabel = { 'light-filtering': 'Light-filtering', blackout: 'Blackout' };
export function gridLimits(g) {
  const w = g.rows_are === 'width' ? g.row_axis : g.col_axis; const h = g.rows_are === 'width' ? g.col_axis : g.row_axis;
  return { minW: w[0], maxW: w[w.length - 1], minH: h[0], maxH: h[h.length - 1] };
}
