// One-time seed: loads the catalog (89 fabrics, 437 swatches) and their images into Supabase.
//
//   node scripts/seed-catalog.mjs                  dry run (default): reads the JSON, prints what it would do, writes nothing
//   node scripts/seed-catalog.mjs --sql out.sql    write the rows as upsert SQL (used to test against a local Postgres)
//   node scripts/seed-catalog.mjs --apply          upsert rows and upload images to the Supabase project in your environment
//   node scripts/seed-catalog.mjs --verify         only count rows per line and compare with the expected numbers
//
// Safe to run twice, but NOTE: --apply writes every row back to the archived data, which undoes anything changed in the admin
// page since. It therefore needs --overwrite-admin-edits as well (only for rebuilding an empty or damaged catalog).
//
// Safe to run twice: rows are upserted by id and images are uploaded with upsert.
//
// Keys (never paste them into chat; never give them a VITE_ prefix):
//   SUPABASE_URL                 https://<project-ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    the service role key. Server side and this script only.
//   VITE_SUPABASE_ANON_KEY       optional here; with it, --verify also counts what an anonymous visitor can read
// Put them in .env.seed.local (git-ignored) when you run this on your own machine, or in the cloud environment's
// secrets when it runs in a session. The script reads those files and the process environment.
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { mergeCatalogs, orderCatalogs } from '../src/data/mergeSwatches.js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const arg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const APPLY = has('--apply');
if (APPLY && !has('--overwrite-admin-edits')) {
  console.error('Refusing to run: --apply overwrites every catalog row with the archived data, undoing edits made in /admin.\nAdd --overwrite-admin-edits if that is really what you want.');
  process.exit(1);
}
const VERIFY_ONLY = has('--verify');
const SQL_OUT = arg('--sql');

const EXPECTED = { fabrics: 89, swatches: 437, byLine: { roller: 133, zebra: 88, 'shangri-la': 21, cellular: 33, 'dream-curtains': 39, drapery: 123 } };
const BUCKET = 'swatches';
const THUMB_PX = 320, THUMB_QUALITY = 62;

// ---- env ------------------------------------------------------------------------------------------------
for (const f of ['.env.seed.local', '.env.local']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---- source data ----------------------------------------------------------------------------------------
// Reads the current JSON files; after the switch they live in archive/ as a backup, so look there too.
const dataDir = ['src/data', 'archive/data'].find(d => existsSync(join(d, 'swatches.json')));
const readJson = (name, fallback) => {
  for (const d of ['src/data', 'archive/data']) if (existsSync(join(d, name))) return JSON.parse(readFileSync(join(d, name), 'utf8'));
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} not found in src/data or archive/data`);
};
const catalogs = orderCatalogs(
  (existsSync(dataDir) ? readdirSync(dataDir) : []).filter(n => /^swatches.*\.json$/.test(n))
    .map(name => ({ name, data: JSON.parse(readFileSync(join(dataDir, name), 'utf8')) }))
);
const { fabrics, swatches } = mergeCatalogs(catalogs);
const displayNames = readJson('displayNames.json');
const colorFamilies = { ...readJson('colorFamilies.json'), ...readJson('colorFamilyOverrides.json', {}) };   // overrides win

// ---- build rows -----------------------------------------------------------------------------------------
const has_ = (v) => v !== undefined && v !== null && v !== '';
const orNull = (v) => (has_(v) ? v : null);
const fullPath = (s) => `full/${s.line}/${basename(s.image)}`;
const thumbPathFor = (imagePath) => imagePath.replace(/^full\//, 'thumb/').replace(/\.[a-z]+$/i, '.webp');

const orderIn = {};      // running sort_order per line
const fabricRows = fabrics.map((f) => {
  const sp = f.specs || {};
  const extra = {};
  for (const k of ['vaneSize', 'care', 'weightStyleA', 'weightStyleB']) if (has_(sp[k])) extra[k] = sp[k];
  const n = (orderIn[`f:${f.line}`] = (orderIn[`f:${f.line}`] ?? -1) + 1);
  return {
    id: f.id, product_line: f.line, shown_in: f.lines || [f.line], family: f.family || null,
    collection_name: f.fabric,
    width: orNull(sp.width), composition: orNull(sp.composition), weight: orNull(sp.weight), thickness: orNull(sp.thickness),
    openness: orNull(sp.openness), opacity: orNull(sp.opacity ?? f.opacity), use_area: orNull(sp.use),
    extra_specs: extra, active: true, sort_order: n,
  };
});

const imageJobs = new Map();   // storage path -> { source file, kind }
const swatchRows = swatches.map((s) => {
  const n = (orderIn[`s:${s.line}`] = (orderIn[`s:${s.line}`] ?? -1) + 1);
  const image_path = fullPath(s);
  const thumb_path = thumbPathFor(image_path);
  imageJobs.set(image_path, { src: join('public', s.image), kind: 'full' });
  imageJobs.set(thumb_path, { src: join('public', s.image), kind: 'thumb' });
  const styles = (s.styles || []).length ? s.styles.map((st) => {
    const ip = fullPath({ line: s.line, image: st.image });
    imageJobs.set(ip, { src: join('public', st.image), kind: 'full' });
    imageJobs.set(thumbPathFor(ip), { src: join('public', st.image), kind: 'thumb' });
    return { style: st.style, code: st.code, image_path: ip, thumb_path: thumbPathFor(ip) };
  }) : null;
  const name = displayNames[s.id];
  if (!name) throw new Error(`no approved display name for ${s.id}`);
  if (!colorFamilies[s.id]) throw new Error(`no color family for ${s.id}`);
  return {
    id: s.id, fabric_id: s.fabricId, product_line: s.line, shown_in: s.lines || [s.line], family: s.family || null,
    display_name: name, supplier_code: s.code, supplier_color_name: orNull(s.colorName),
    color_family: colorFamilies[s.id], image_path, thumb_path, image_kind: s.imageKind || 'swatch',
    grade: orNull(s.grade), width: orNull(s.specs?.width), composition: orNull(s.specs?.composition),
    roman_styles: s.romanStyles || null, styles, active: true, sort_order: n,
  };
});

const countBy = (rows) => rows.reduce((a, r) => ((a[r.product_line] = (a[r.product_line] || 0) + 1), a), {});
const sameCounts = (got) => Object.entries(EXPECTED.byLine).every(([l, n]) => got[l] === n);
console.log(`source: ${dataDir}  ->  ${fabricRows.length} fabrics, ${swatchRows.length} swatches, ${imageJobs.size} images to store`);
console.log('swatches per line:', JSON.stringify(countBy(swatchRows)));
if (fabricRows.length !== EXPECTED.fabrics || swatchRows.length !== EXPECTED.swatches || !sameCounts(countBy(swatchRows))) {
  console.error('FAIL: the source data does not match the expected counts', JSON.stringify(EXPECTED));
  process.exit(1);
}

// ---- --sql: write upserts (local test) ------------------------------------------------------------------
const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : Array.isArray(v) && v.every(x => typeof x === 'string') ? `array[${v.map(x => `'${x.replace(/'/g, "''")}'`).join(',')}]::text[]`
  : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`);
const upsertSql = (table, rows) => {
  const cols = Object.keys(rows[0]);
  return rows.map(r => `insert into public.${table} (${cols.join(', ')}) values (${cols.map(c => q(r[c])).join(', ')})\n  on conflict (id) do update set ${cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ')};`).join('\n');
};
if (SQL_OUT) {
  writeFileSync(SQL_OUT, ['-- generated by scripts/seed-catalog.mjs --sql', upsertSql('fabrics', fabricRows), upsertSql('swatches', swatchRows), ''].join('\n'));
  console.log(`wrote ${SQL_OUT}`);
  process.exit(0);
}

// ---- everything below talks to Supabase -----------------------------------------------------------------
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!APPLY && !VERIFY_ONLY) {
  console.log('\nDRY RUN: nothing was written. Add --apply to upsert the rows and upload the images,');
  console.log(`         target: ${url ? new URL(url).host : '(SUPABASE_URL is not set)'}  |  service key: ${serviceKey ? 'present' : 'missing'}`);
  console.log('first fabric row:', JSON.stringify(fabricRows[0]));
  console.log('first swatch row:', JSON.stringify(swatchRows[0]));
  process.exit(0);
}
if (!url || !serviceKey) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see the header of this file).'); process.exit(1); }

const { createClient } = await import('@supabase/supabase-js');
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function verify() {
  const out = { fabrics: 0, swatches: 0, byLine: {} };
  const f = await admin.from('fabrics').select('id', { count: 'exact', head: true });
  if (f.error) throw f.error; out.fabrics = f.count;
  const s = await admin.from('swatches').select('id', { count: 'exact', head: true });
  if (s.error) throw s.error; out.swatches = s.count;
  for (const l of Object.keys(EXPECTED.byLine)) {
    const r = await admin.from('swatches').select('id', { count: 'exact', head: true }).eq('product_line', l);
    if (r.error) throw r.error; out.byLine[l] = r.count;
  }
  console.log('database (service role): fabrics', out.fabrics, '| swatches', out.swatches, '|', JSON.stringify(out.byLine));
  const okDb = out.fabrics === EXPECTED.fabrics && out.swatches === EXPECTED.swatches && sameCounts(out.byLine);
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  let okAnon = true;
  if (anon) {
    // the public reads the catalog through public_catalog(), not the tables
    const res = await fetch(`${url}/rest/v1/rpc/public_catalog`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_scope: ['roller', 'zebra', 'shangri-la', 'cellular', 'roman', 'drapery', 'dream-curtains'] }) });
    const body = res.ok ? await res.json() : null;
    const ids = new Set((body || []).flatMap((g) => g.swatches.map((x) => x.id)));
    console.log('what an anonymous visitor can read:', body ? `${ids.size} colors` : `ERROR HTTP ${res.status}`);
    okAnon = !!body && ids.size === EXPECTED.swatches;
  }
  console.log(okDb && okAnon ? 'COUNTS MATCH' : 'COUNTS DO NOT MATCH');
  return okDb && okAnon;
}
if (VERIFY_ONLY) process.exit((await verify()) ? 0 : 1);

// 1. rows (fabrics first: swatches refer to them and the database checks names against collection names)
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
for (const rows of chunk(fabricRows, 100)) {
  const { error } = await admin.from('fabrics').upsert(rows, { onConflict: 'id' });
  if (error) { console.error('fabrics upsert failed:', error.message); process.exit(1); }
}
console.log(`fabrics upserted: ${fabricRows.length}`);

// 2. images: the original as the full image, and a 320 px WebP thumbnail (the size the site builds today)
const sharp = (await import('sharp')).default;
let done = 0, failed = 0;
const jobs = [...imageJobs.entries()];
const worker = async () => {
  while (jobs.length) {
    const [path, job] = jobs.pop();
    try {
      const body = job.kind === 'full'
        ? readFileSync(job.src)
        : await sharp(job.src).resize(THUMB_PX, THUMB_PX, { fit: 'cover' }).webp({ quality: THUMB_QUALITY }).toBuffer();
      const { error } = await admin.storage.from(BUCKET).upload(path, body, {
        upsert: true, contentType: job.kind === 'full' ? 'image/jpeg' : 'image/webp', cacheControl: '86400',
      });
      if (error) throw error;
      done++;
    } catch (e) { failed++; console.error('upload failed:', path, e.message); }
  }
};
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`images uploaded: ${done}, failed: ${failed}`);
if (failed) process.exit(1);

// 3. swatches
for (const rows of chunk(swatchRows, 100)) {
  const { error } = await admin.from('swatches').upsert(rows, { onConflict: 'id' });
  if (error) { console.error('swatches upsert failed:', error.message); process.exit(1); }
}
console.log(`swatches upserted: ${swatchRows.length}`);

process.exit((await verify()) ? 0 : 1);
