// The customer price, calculated in the database. The browser sends the picked colors, the options and the size, and gets back
// only { price, custom_size, price_on_request }: no supplier cost, grid, price group or extra cost ever reaches the page.
import { useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

export async function estimatePrice(req, signal) {
  const res = await fetch(`${BASE}/rest/v1/rpc/estimate_price_for_swatch`, {
    method: 'POST', signal,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_line: req.line, p_swatch_id: req.swatchId, p_options: req.options, p_width: req.width, p_height: req.height }),
  });
  if (!res.ok) throw new Error(`estimate failed (${res.status})`);
  return res.json();
}

// Live: asks again (after a short pause) whenever the colors, options or size change.
export function usePrice(req) {
  const [state, setState] = useState(null);
  const key = req ? JSON.stringify(req) : '';
  useEffect(() => {
    if (!req) { setState(null); return undefined; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      estimatePrice(req, ctl.signal).then(setState).catch((e) => { if (e.name !== 'AbortError') setState(null); });
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

// Same request, but never shows an answer for an earlier request: { loading, result }.
// `result` is { price, custom_size, price_on_request } once the answer for exactly this request is in.
export function usePriceState(req) {
  const [state, setState] = useState({ key: '', res: null });
  const key = req ? JSON.stringify(req) : '';
  useEffect(() => {
    if (!req) return undefined;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      estimatePrice(req, ctl.signal).then((res) => setState({ key, res })).catch((e) => { if (e.name !== 'AbortError') setState({ key, res: { error: true } }); });
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!req) return { loading: false, result: null };
  return state.key === key ? { loading: false, result: state.res } : { loading: true, result: null };
}
