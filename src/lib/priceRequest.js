// What to ask the database for when pricing a window. Pure code with no imports: the browser (product pages, order page)
// and api/quote.js (which recomputes every estimate on the server before it goes into an email) use the same rules.
import { pricingOptions } from './drive.js';
import { styleById, styleIdFromSaved, cleanHardware, hardwareRequest } from './hardware.js';

// A curtain: the fabric price (style, fullness, liner, size; the database knows the fabric by its supplier code) plus the optional track or rod.
// Both come back as one answer from runEstimate(). Null until the choices and the size are in.
function curtainRequest(c, w, h, sized) {
  const st = styleById(c.styleId);
  if (!c.pick || !st || !c.fullness || !c.lining || !sized || c.hardwareIncomplete) return null;
  const hw = cleanHardware(c.hardware, c.styleId);
  return {
    kind: 'curtain', line: 'drapery', swatchId: c.pick.swatchId, width: w, height: h, sized: true,
    options: { fullness: parseFloat(c.fullness), style_family: st.family, lining: c.lining },
    hardware: hw ? hardwareRequest(hw, c.styleId, w) : null,
  };
}

// Asks the database for one request: { price } | { price_on_request } | { custom_size }. A curtain asks for its fabric and (if it has one) its track or rod, and adds them.
export async function runEstimate(req, base, key, fetchFn = fetch, signal) {
  const call = async (fn, body) => {
    const res = await fetchFn(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', signal, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${fn} failed (${res.status})`);
    return res.json();
  };
  if (req.kind === 'curtain') {
    const fab = await call('drapery_estimate', { p_swatch: req.swatchId, p_options: req.options, p_width: req.width, p_height: req.height });
    if (fab.price == null) return { price_on_request: true };
    if (!req.hardware) return { price: fab.price };
    const hw = await call('hardware_estimate', { p_options: req.hardware.options, p_width: req.hardware.width });
    return hw.price == null ? { price_on_request: true } : { price: fab.price + hw.price };
  }
  return call('estimate_price_for_swatch', { p_line: req.line, p_swatch_id: req.swatchId, p_options: req.options, p_width: req.width, p_height: req.height });
}

// What to ask for, or null while the customer has not picked a color (and entered a size) yet.
export function priceRequest(line, c, mech, width, height) {
  const w = parseFloat(width), h = parseFloat(height);
  const sized = w > 0 && h > 0;
  const base = (pick, extra = {}, siteLine = line.id) => (pick ? { line: siteLine, swatchId: pick.swatchId, options: { ...pricingOptions(line.id, mech, { double: c.mode === 'double-stack' }), ...extra }, width: sized ? w : null, height: sized ? h : null, sized } : null);
  let r = null;
  switch (line.id) {
    case 'roller':
      // "No fabric wrap" is the supplier's deduction, applied to cost before the markup by the database
      if (c.mode === 'double-stack') r = c.front && c.back ? base(c.front, { mode: 'double-stack', back_swatch_id: c.back.swatchId, ...(c.wrap === 'none' ? { wrap_cassette: 'none' } : {}), ...(c.bottomWrap === 'none' ? { wrap_bottom_rail: 'none' } : {}) }) : null;
      else r = base(c.front, { mode: 'single', ...(c.wrap === 'none' ? { wrap_cassette: 'none' } : {}) });
      break;
    case 'zebra': r = base(c.pick, c.wrap === 'none' ? { wrap_cassette: 'none' } : {}); break;     // same supplier deduction as Roller
    case 'shangri-la': r = base(c.pick); break;
    case 'cellular':
      // Day & Night is priced from the second (night) color's block; both colors' extra costs count
      r = c.type === 'day-night' ? (c.day && c.night ? base(c.night, { type: 'day-night', day_swatch_id: c.day.swatchId }) : null) : base(c.pick, { type: c.type });
      break;
    case 'roman': r = c.lining ? base(c.pick, { lining: c.lining }) : null; break;
    case 'drapery':
      if (c.section === 'curtains') return curtainRequest(c, w, h, sized);
      r = base(c.dream, {}, 'dream-curtains');
      break;
    default: break;
  }
  // everything waits for a size
  if (r && !r.sized) return null;
  return r;
}

// The same request, rebuilt from a saved order item ({ selection, mech, width, length }; `line` is { id }).
// Returns null when the item has no picked color, or no size where one is needed.
export function priceRequestFromItem(line, item) {
  const sel = item.selection;
  if (!sel || !Array.isArray(sel.picks) || sel.picks.length === 0) return null;
  const [p0, p1] = sel.picks;
  const wrap = sel.cover === 'none' ? 'none' : 'wrapped';
  const c = {
    mode: sel.mode, front: p0, back: p1, wrap, bottomWrap: sel.extras?.bottomWrap,
    pick: p0, type: sel.type, day: p0, night: p1,
    lining: sel.lining, section: sel.section, dream: p0,
    styleId: styleIdFromSaved(sel.pleat), fullness: sel.fullness, hardware: sel.hardware,
  };
  return priceRequest(line, c, item.mech ?? item.mechId, item.width, item.length ?? item.height);
}
