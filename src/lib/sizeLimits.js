// The smallest and largest sizes for a line, from the database (size_limits(): a verified Products size rule, else the supplier
// grid's smallest and largest sizes). Four numbers only. If the function is not there yet, or fails, there are no limits and
// nothing is blocked here (the price function still says "larger than our standard range" for what it cannot price).
import { useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const cache = new Map();

export { limitLineFor } from './limits.js';

export function fetchLimits(line, control) {
  const k = `${line}|${control || ''}`;
  if (!cache.has(k)) {
    cache.set(k, fetch(`${BASE}/rest/v1/rpc/size_limits`, {
      method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_line: line, p_options: control ? { control } : {} }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return cache.get(k);
}

export function useSizeLimits(line, control) {
  const [limits, setLimits] = useState(null);
  useEffect(() => {
    let live = true;
    setLimits(null);
    fetchLimits(line, control).then((l) => { if (live) setLimits(l); });
    return () => { live = false; };
  }, [line, control]);
  return limits;
}
