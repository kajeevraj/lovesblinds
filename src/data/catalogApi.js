// Loads a line's catalog from Supabase and turns the rows into the shapes the pickers already use
// (fabric.line / fabric.specs, swatch.code / displayName / image / thumb ...), so nothing downstream changes.
import { catalogPath, storageUrl } from './catalogQuery.js';
import { registerCatalog } from './swatchData.js';

const BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TIMEOUT_MS = 12000;

const nn = (v) => (v === null || v === undefined || v === '' ? undefined : v);
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function mapRows(rows) {
  const fabrics = [];
  const swatches = [];
  for (const r of rows) {
    const shownIn = r.shown_in || [r.product_line];
    fabrics.push({
      id: r.id, line: r.product_line, lines: shownIn, family: r.family || undefined, fabric: r.collection_name,
      specs: compact({
        width: nn(r.width), composition: nn(r.composition), weight: nn(r.weight), thickness: nn(r.thickness),
        openness: nn(r.openness), opacity: nn(r.opacity), use: nn(r.use_area), ...(r.extra_specs || {}),
      }),
    });
    for (const s of r.swatches || []) {
      swatches.push({
        id: s.id, fabricId: s.fabric_id, line: s.product_line, lines: s.shown_in || shownIn, family: s.family || undefined,
        fabric: r.collection_name,                                   // supplier collection: internal only
        code: s.supplier_code, colorName: s.supplier_color_name ?? undefined,   // supplier color name: internal only
        displayName: s.display_name, colorFamily: s.color_family,
        image: storageUrl(BASE, s.image_path), thumb: storageUrl(BASE, s.thumb_path), imageKind: s.image_kind,
        grade: s.grade ?? undefined,                                 // never shown to customers
        specs: compact({ width: nn(s.width), composition: nn(s.composition) }),
        romanStyles: s.roman_styles ?? undefined,
        styles: s.styles ? s.styles.map(st => ({ style: st.style, code: st.code, image: storageUrl(BASE, st.image_path), thumb: storageUrl(BASE, st.thumb_path) })) : undefined,
      });
    }
  }
  return { fabrics, swatches };
}

async function fetchRows(lineKey) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    // The key rides in the URL so this is a plain GET: the browser skips the CORS preflight round trip.
    const res = await fetch(`${BASE}${catalogPath(lineKey)}&apikey=${KEY}`, { signal: ctl.signal });
    if (!res.ok) throw new Error(`catalog request failed (${res.status})`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

const loaded = new Set();
const pending = new Map();

export const isLineLoaded = (lineKey) => loaded.has(lineKey);

// One fetch per line per page load; later calls reuse it. Rejects when the catalog cannot be read.
export function loadLineCatalog(lineKey, { retry = false } = {}) {
  if (loaded.has(lineKey)) return Promise.resolve();
  if (pending.has(lineKey) && !retry) return pending.get(lineKey);
  if (!BASE || !KEY) return Promise.reject(new Error('Supabase is not configured'));

  // index.html starts this request before any script has loaded; use it once, then fall back to our own.
  const early = !retry && typeof window !== 'undefined' ? window.__lbCatalog : null;
  const first = early && early.line === lineKey ? early.promise.then(rows => rows || fetchRows(lineKey)) : fetchRows(lineKey);
  if (early) window.__lbCatalog = null;

  const p = first.then(rows => {
    if (!Array.isArray(rows) || rows.length === 0 || !rows.some(r => (r.swatches || []).length)) throw new Error('catalog is empty');
    registerCatalog(mapRows(rows));
    loaded.add(lineKey);
  }).finally(() => pending.delete(lineKey));
  pending.set(lineKey, p);
  return p;
}
