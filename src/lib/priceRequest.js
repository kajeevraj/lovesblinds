// What to ask the database for when pricing a window. Pure code with no imports: the browser (product pages, order page)
// and api/quote.js (which recomputes every estimate on the server before it goes into an email) use the same rules.

// What to ask for, or null while the customer has not picked a color (and entered a size) yet.
export function priceRequest(line, c, mech, width, height) {
  const w = parseFloat(width), h = parseFloat(height);
  const sized = w > 0 && h > 0;
  const base = (pick, extra = {}, siteLine = line.id) => (pick ? { line: siteLine, swatchId: pick.swatchId, options: { control: mech, ...extra }, width: sized ? w : null, height: sized ? h : null, sized } : null);
  let r = null;
  switch (line.id) {
    case 'roller':
      // "No fabric wrap" is the supplier's deduction, applied to cost before the markup by the database
      if (c.mode === 'double-stack') r = c.front && c.back ? base(c.front, { mode: 'double-stack', back_swatch_id: c.back.swatchId, ...(c.wrap === 'none' ? { wrap_cassette: 'none' } : {}) }) : null;
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
      r = c.section === 'curtains' ? base(c.pick, {}, 'drapery') : base(c.dream, {}, 'dream-curtains');
      break;
    default: break;
  }
  // curtains are quoted by us: no size needed to say so; everything else waits for a size
  if (r && !r.sized && r.line !== 'drapery') return null;
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
    mode: sel.mode, front: p0, back: p1, wrap,
    pick: p0, type: sel.type, day: p0, night: p1,
    lining: sel.lining, section: sel.section, dream: p0,
  };
  return priceRequest(line, c, item.mech ?? item.mechId, item.width, item.length ?? item.height);
}
