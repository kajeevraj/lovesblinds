// The customer price, calculated in the database. The browser sends the picked colors, the options and the size, and gets back
// only { price, custom_size, price_on_request }: no supplier cost, grid, price group or extra cost ever reaches the page.
import { useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

import { priceRequest } from './priceRequest.js';
export { priceRequest };

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

// The track or rod for curtains ("Add a track or rod"): the database works the price out (hardware_estimate, migration 20) and answers only
// { price } (or { not_available } for a motorized rail with grommet or rod pocket, or { price_on_request }).
export async function estimateHardware(req, signal) {
  const res = await fetch(`${BASE}/rest/v1/rpc/hardware_estimate`, {
    method: 'POST', signal,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_options: req.options, p_width: req.width }),
  });
  if (!res.ok) throw new Error(`hardware estimate failed (${res.status})`);
  return res.json();
}

// { loading, result } for exactly this request (never an earlier answer)
export function useHardwareState(req) {
  const [state, setState] = useState({ key: '', res: null });
  const key = req ? JSON.stringify(req) : '';
  useEffect(() => {
    if (!req) return undefined;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      estimateHardware(req, ctl.signal).then((res) => setState({ key, res })).catch((e) => { if (e.name !== 'AbortError') setState({ key, res: { error: true } }); });
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!req) return { loading: false, result: null };
  return state.key === key ? { loading: false, result: state.res } : { loading: true, result: null };
}
