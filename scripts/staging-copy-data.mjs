// Copies the catalog and price tables from the LIVE project into STAGING over HTTPS (no direct Postgres connection, so it works where port 5432 is closed).
// Live: GET requests only. Staging: upserts only (POST with merge-duplicates), so it is safe to repeat. No customer data is copied: no orders, sent orders,
// messages, rate limits, users, admins or audit history.
//
//   node scripts/staging-copy-data.mjs pass1        the 13 tables that exist after migrations 1-11 (run BEFORE migrations 12 onward)
//   node scripts/staging-copy-data.mjs pass2        all 16 tables, exactly as live (run AFTER the last migration)
//   node scripts/staging-copy-data.mjs fabrics swatches   only the named tables (in the order given)
//
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (live, read only here) and STAGING_SUPABASE_URL + STAGING_SUPABASE_SERVICE_ROLE_KEY.
// Refuses to run if staging is the live project. Columns that exist on live but not yet on staging (added by a later migration) are skipped, so pass1 works.
// Staging's audit triggers fire on these inserts (REST cannot disable triggers), so staging's audit_log gains rows. That is harmless on staging.
const e = process.env, LIVE = e.SUPABASE_URL, LK = e.SUPABASE_SERVICE_ROLE_KEY, ST = e.STAGING_SUPABASE_URL, SK = e.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const A = ['product_lines', 'pricing_lines', 'fabrics', 'swatches', 'swatch_links', 'price_grids', 'grid_fabrics', 'price_adders', 'price_flags', 'collection_markups', 'option_groups', 'option_values', 'size_rules'];
const B = [...A, 'hardware_rates', 'drapery_tiers', 'drapery_fabrics'];
const ref = (u) => { try { return new URL(u).hostname.split('.')[0]; } catch { return ''; } };
const stop = (m) => { console.error(`STOP: ${m}`); process.exit(1); };
if (!LIVE || !LK || !ST || !SK) stop('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY must all be set.');
if (ref(LIVE) === ref(ST)) stop('STAGING_SUPABASE_URL is the live project.');
const arg = process.argv.slice(2);
const tables = arg[0] === 'pass1' ? A : arg[0] === 'pass2' ? B : arg;
if (!tables.length) stop('say what to copy: pass1, pass2, or table names.');
for (const t of tables) if (!B.includes(t)) stop(`${t} is not one of the copied tables (${B.join(', ')}).`);
const lh = { apikey: LK, Authorization: `Bearer ${LK}` };
const sh = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates' };
const spec = await (await fetch(`${ST}/rest/v1/`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } })).json();
const cols = (t) => Object.keys(spec.definitions?.[t]?.properties || {});
for (const t of tables) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let r = await fetch(`${LIVE}/rest/v1/${t}?select=*&order=created_at.asc&offset=${from}&limit=1000`, { method: 'GET', headers: lh });
    if (r.status === 400) r = await fetch(`${LIVE}/rest/v1/${t}?select=*&offset=${from}&limit=1000`, { method: 'GET', headers: lh });   // a table without created_at
    if (!r.ok) stop(`could not read ${t} from live (${r.status}) ${await r.text()}`);
    const j = await r.json(); rows.push(...j); if (j.length < 1000) break;
  }
  const sc = cols(t); if (!sc.length) stop(`staging has no table ${t}: run the migrations first.`);
  const dropped = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => !sc.includes(c));
  if (dropped.length) console.log(`  ${t}: live-only columns skipped for now: ${dropped.join(', ')}`);
  for (const r of rows) for (const c of dropped) delete r[c];
  for (let i = 0; i < rows.length; i += 50) {   // small batches: staging's audit triggers make each row slow, and a big batch can hit the statement timeout
    let r;
    for (let attempt = 1; attempt <= 4; attempt++) {   // a timeout or a 5xx is retried (the upsert is safe to repeat)
      r = await fetch(`${ST}/rest/v1/${t}`, { method: 'POST', headers: sh, body: JSON.stringify(rows.slice(i, i + 50)) });
      if (r.ok || (r.status < 500 && !/57014/.test(await r.clone().text()))) break;
      await new Promise((ok) => setTimeout(ok, 2000 * attempt));
    }
    if (!r.ok) stop(`could not write ${t} to staging at row ${i}: ${r.status} ${await r.text()}`);
  }
  console.log(`${t}: live ${rows.length} -> staging copied`);
}
