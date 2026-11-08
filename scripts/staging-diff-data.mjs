// Compares the 16 copied catalog/price tables on LIVE and STAGING (read only on both: GET requests), ignoring created_at / updated_at.
// Use it after a rebuild or after a test run to see whether staging still matches live. Exit code 1 if any table differs.
//   node scripts/staging-diff-data.mjs
const e = process.env, L = e.SUPABASE_URL, LK = e.SUPABASE_SERVICE_ROLE_KEY, S = e.STAGING_SUPABASE_URL, SK = e.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const ref = (u) => { try { return new URL(u).hostname.split('.')[0]; } catch { return ''; } };
if (!L || !LK || !S || !SK) { console.error('STOP: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY must all be set.'); process.exit(1); }
if (ref(L) === ref(S)) { console.error('STOP: STAGING_SUPABASE_URL is the live project.'); process.exit(1); }
const T = ['product_lines', 'pricing_lines', 'fabrics', 'swatches', 'swatch_links', 'price_grids', 'grid_fabrics', 'price_adders', 'price_flags', 'collection_markups', 'option_groups', 'option_values', 'size_rules', 'hardware_rates', 'drapery_tiers', 'drapery_fabrics'];
const get = async (u, k, t) => {
  const out = [];
  for (let f = 0; ; f += 1000) {
    const r = await fetch(`${u}/rest/v1/${t}?select=*&offset=${f}&limit=1000`, { method: 'GET', headers: { apikey: k, Authorization: `Bearer ${k}` } });
    const j = await r.json(); if (!r.ok) throw new Error(`${t}: ${JSON.stringify(j)}`);
    out.push(...j); if (j.length < 1000) break;
  }
  return out;
};
const norm = (r) => { const x = { ...r }; delete x.created_at; delete x.updated_at; return JSON.stringify(Object.keys(x).sort().map((k) => [k, x[k]])); };
let bad = 0;
for (const t of T) {
  const a = await get(L, LK, t), b = await get(S, SK, t);
  const A = new Set(a.map(norm)), B = new Set(b.map(norm));
  const onlyL = [...A].filter((s) => !B.has(s)), onlyS = [...B].filter((s) => !A.has(s));
  if (onlyL.length || onlyS.length) {
    bad++; console.log(`${t}: live=${a.length} staging=${b.length}; differing rows: live-only ${onlyL.length}, staging-only ${onlyS.length}`);
    for (const s of onlyS.slice(0, 3)) console.log('   staging:', s.slice(0, 160));
  }
}
console.log(bad ? `${bad} table(s) differ` : 'all 16 tables identical to live (ignoring created_at/updated_at)');
process.exit(bad ? 1 : 0);
