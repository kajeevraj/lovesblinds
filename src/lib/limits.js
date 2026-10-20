// Size and quantity limits shared by the product pages and api/quote.js (pure code, no imports).
export const MAX_QTY = 99;
export const clampQty = (v) => Math.min(MAX_QTY, Math.max(1, parseInt(v, 10) || 1));

// The numbers go into messages as written by people: 23 or 23.5, never 23.000.
const fmt = (n) => String(Math.round(Number(n) * 1000) / 1000);

// limits = { min_width, max_width, min_height, max_height } (any may be null). Returns:
//   tooSmall: [{ dim: 'width' | 'height', min, text }]  below the smallest we can make: block the order
//   tooBig:   true when above the largest size: the price comes by email ("larger than our standard range"), never blocked
//   typo:     true when a size looks like a slip of the finger (under 12 inches, or over 300): warn, never block
export function checkSize(limits, width, height) {
  const w = parseFloat(width), h = parseFloat(height);
  const out = { tooSmall: [], tooBig: false, typo: false };
  if (!(w > 0) || !(h > 0)) return out;
  const L = limits || {};
  if (L.min_width != null && w < Number(L.min_width)) out.tooSmall.push({ dim: 'width', min: Number(L.min_width), text: `The smallest we can make is ${fmt(L.min_width)} inches wide.` });
  if (L.min_height != null && h < Number(L.min_height)) out.tooSmall.push({ dim: 'height', min: Number(L.min_height), text: `The smallest we can make is ${fmt(L.min_height)} inches high.` });
  if ((L.max_width != null && w > Number(L.max_width)) || (L.max_height != null && h > Number(L.max_height))) out.tooBig = true;
  out.typo = !out.tooSmall.length && (w < 12 || h < 12 || w > 300 || h > 300);
  return out;
}
// The product page line (roller, zebra, ..., drapery) and section to the pricing line that has sizes.
export const limitLineFor = (lineId, section) => (lineId === 'drapery' ? (section === 'dream-curtains' ? 'dream-curtains' : 'drapery') : lineId);

export const TYPO_TEXT = 'Double-check this size.';
