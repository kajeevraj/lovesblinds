// Which options the owner has turned on or off, and which movement is "Best value", per product line. Read from the database through
// public_options() (migration 20), the one read the customer site makes of the option tables. If the function is missing (migration 20 not run)
// or the request fails, every option the site knows stays on and Best value falls back to the default (Zero gravity where a line has it).
import { useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const DEFAULT_BEST_VALUE = { roller: 'zero-gravity', zebra: 'zero-gravity', roman: 'zero-gravity', cellular: 'zero-gravity' };

// The movement marked "Top of the line" (the highest-end option): Motorized unless the owner picks another one.
export const DEFAULT_TOP_OF_LINE = { roller: 'motorized', zebra: 'motorized', roman: 'motorized', cellular: 'motorized', 'shangri-la': 'motorized', drapery: 'motorized' };

const cache = new Map();           // line -> Promise<rows | null>
export function fetchLineOptions(line) {
  if (!BASE || !KEY) return Promise.resolve(null);
  if (!cache.has(line)) {
    cache.set(line, fetch(`${BASE}/rest/v1/rpc/public_options`, {
      method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_line: line }),
    }).then((r) => (r.ok ? r.json() : null)).then((rows) => (Array.isArray(rows) ? rows : null)).catch(() => null));
  }
  return cache.get(line);
}

// the answer as two small helpers; `rows` null means "not known"
export function optionsView(line, rows) {
  const off = new Set((rows || []).filter((r) => !r.active).map((r) => `${r.group}:${r.code}`));
  const best = rows ? (rows.find((r) => r.group === 'control' && r.best && r.active)?.code || null) : (DEFAULT_BEST_VALUE[line] || null);
  const top = rows ? (rows.find((r) => r.group === 'control' && r.top && r.active)?.code || null) : (DEFAULT_TOP_OF_LINE[line] || null);
  return { rows, ready: true, isOn: (group, code) => !off.has(`${group}:${code}`), best, top };
}

export function useLineOptions(line) {
  const [rows, setRows] = useState(undefined);       // undefined: still asking
  useEffect(() => {
    let live = true;
    setRows(undefined);
    fetchLineOptions(line).then((r) => { if (live) setRows(r); });
    return () => { live = false; };
  }, [line]);
  if (rows === undefined) return { ...optionsView(line, null), ready: false };
  return optionsView(line, rows);
}
