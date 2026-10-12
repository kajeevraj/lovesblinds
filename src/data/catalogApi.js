// Loads a line's catalog from Supabase and turns the rows into the shapes the pickers already use
// (fabric.line / fabric.specs, swatch.code / displayName / image / thumb ...), so nothing downstream changes.
import { catalogPath, edgePath, storageUrl } from './catalogQuery.js';
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
    // own swatches, then swatches linked into this collection (they carry this collection's name for them);
    // a hidden linked swatch comes back as null from Row Level Security and is skipped
    const own = (r.swatches || []).map(s => ({ s, link: null }));
    const linked = (r.swatch_links || []).filter(l => l.swatch).map(l => ({ s: l.swatch, link: l }));
    const all = [...own, ...linked].sort((a, b) => (a.link ? a.link.sort_order : a.s.sort_order) - (b.link ? b.link.sort_order : b.s.sort_order));
    for (const { s: base, link } of all) {
      const s = link ? { ...base, fabric_id: r.id, product_line: r.product_line, shown_in: shownIn, family: r.family || link.family || null, display_name: link.display_name } : base;
      swatches.push({
        key: `${s.id}@${r.id}`,
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

async function getJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`catalog request failed (${res.status})`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

const usable = (rows) => Array.isArray(rows) && rows.some(r => (r.swatches || []).length);

// Straight from Supabase. The key rides in the URL so this is a plain GET: no CORS preflight round trip.
// If the extended query fails (the links table is not in the database yet), the plain one still works.
const fetchDirect = async (lineKey) => {
  try { return await getJson(`${BASE}${catalogPath(lineKey)}&apikey=${KEY}`); }
  catch { return getJson(`${BASE}${catalogPath(lineKey, { links: false })}&apikey=${KEY}`); }
};

// Our edge-cached function first; if it is down, answers badly, or is missing (local dev), Supabase directly.
async function fetchRows(lineKey) {
  try {
    const rows = await getJson(edgePath(lineKey));
    if (usable(rows)) return rows;
  } catch { /* fall through to Supabase */ }
  return fetchDirect(lineKey);
}

const loaded = new Set();
const pending = new Map();

export const isLineLoaded = (lineKey) => loaded.has(lineKey);

// One fetch per line per page load; later calls reuse it. Rejects when the catalog cannot be read.
export function loadLineCatalog(lineKey, { retry = false } = {}) {
  if (loaded.has(lineKey)) return Promise.resolve();
  if (pending.has(lineKey) && !retry) return pending.get(lineKey);
  if (!BASE || !KEY) return Promise.reject(new Error('Supabase is not configured'));

  // index.html asks the edge function before any script has loaded. Use that answer once; if it failed, go to Supabase directly.
  const early = !retry && typeof window !== 'undefined' ? window.__lbCatalog : null;
  const first = early && early.line === lineKey ? early.promise.then(rows => (usable(rows) ? rows : fetchDirect(lineKey))) : fetchRows(lineKey);
  if (early) window.__lbCatalog = null;

  const p = first.then(rows => {
    if (!usable(rows)) throw new Error('catalog is empty');
    registerCatalog(mapRows(rows));
    loaded.add(lineKey);
  }).finally(() => pending.delete(lineKey));
  pending.set(lineKey, p);
  return p;
}
