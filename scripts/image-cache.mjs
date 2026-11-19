// The local copy of the swatch photos that tests and screenshot scripts read (see supabase/tests/lib/imageCache.mjs). Nothing here writes to any project.
//
//   node scripts/image-cache.mjs status                       how many of the catalog's pictures are in .image-cache
//   node scripts/image-cache.mjs fill [--seed DIR] [--from-staging] [--allow-live [--live-budget N]]
//        fills what is missing, from (in this order): a local seed folder (DIR/catalog.json + DIR/full + DIR/thumb: photos downloaded earlier), the 200 px tiles and
//        textures made locally from those photos (the backfill scripts' own code),
//        (with --from-staging) the STAGING project's storage, and ONLY with --allow-live the live project (a one-time fill; prints how many files and bytes it took; stops after N, default 1500).
//   Needs SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the public catalog tells which pictures exist). STAGING_SUPABASE_URL is used when set.
import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const { CACHE_DIR, cacheFile, readCached, writeCached, stagingFile } = await import('../supabase/tests/lib/imageCache.mjs');
const { LINE_SCOPE, thumb200Path, texFlatPath } = await import('../src/data/catalogQuery.js');
const sharp = (await import('sharp')).default;
const { makeTextureWebp } = await import('./room-lab/texture-node.mjs');
const args = process.argv.slice(2), cmd = args[0] || 'status', flag = (f) => args.includes(f), val = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const LIVE = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!LIVE || !ANON) { console.error('SUPABASE_URL and VITE_SUPABASE_ANON_KEY are needed (to read the public catalog).'); process.exit(1); }

// ---- what the site can ask for
const wanted = new Map();            // 'bucket/path' -> { bucket, path, swatch }
const want = (bucket, path, swatch = null) => { if (path) wanted.set(`${bucket}/${path}`, { bucket, path, swatch }); };
const swatches = new Map();
for (const key of Object.keys(LINE_SCOPE)) {
  const rows = await (await fetch(`${LIVE}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${LINE_SCOPE[key].join(',')}}`)}`, { headers: { apikey: ANON } })).json();
  if (!Array.isArray(rows)) throw new Error(`the catalog could not be read: ${JSON.stringify(rows).slice(0, 200)}`);
  for (const g of rows) for (const s of g.swatches || []) swatches.set(s.id, s);
}
for (const s of swatches.values()) {
  want('swatches', s.image_path, { s, kind: 'full' }); want('swatches', s.thumb_path, { s, kind: 'thumb' });
  for (const p of [thumb200Path(s.thumb_path), texFlatPath(s.thumb_path)]) want('swatches', p, { s, kind: p.startsWith('thumb200/') ? 'tile' : 'texflat' });          // (the older tex256/ files are no longer read by the site)
  for (const st of s.styles || []) { const ss = { ...s, image_path: st.image_path, thumb_path: st.thumb_path }; want('swatches', st.image_path, { s: ss, kind: 'full', style: true }); want('swatches', st.thumb_path, { s: ss, kind: 'thumb', style: true }); want('swatches', thumb200Path(st.thumb_path), { s: ss, kind: 'tile', style: true }); want('swatches', texFlatPath(st.thumb_path), { s: ss, kind: 'texflat', style: true }); }
}
try {                                   // option pictures
  const o = await (await fetch(`${LIVE}/rest/v1/rpc/public_options`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: '{}' })).json();
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) { if (k === 'image_path' && typeof x === 'string') want('option-images', x); else walk(x); } } };
  walk(o);
} catch { /* the options are optional */ }

const missing = () => [...wanted.values()].filter((w) => !readCached(w.bucket, w.path));
if (cmd === 'status') { const m = missing(); console.log(`${wanted.size} pictures in the catalog, ${wanted.size - m.length} in ${CACHE_DIR}, ${m.length} missing`); process.exit(m.length ? 2 : 0); }
if (cmd !== 'fill') { console.error('usage: node scripts/image-cache.mjs status | fill [--seed DIR] [--from-staging] [--allow-live [--live-budget N]]'); process.exit(1); }

// ---- 1. a seed folder
const seed = val('--seed'); let fromSeed = 0;
if (seed) {
  const idx = new Map(JSON.parse(readFileSync(join(seed, 'catalog.json'), 'utf8')).map((c) => [c.id, c.file]));
  for (const w of missing()) {
    if (!w.swatch || w.swatch.style || !['full', 'thumb'].includes(w.swatch.kind)) continue;          // (the 200 px tiles and textures are made below; a style's own picture is not the color's)
    const file = idx.get(w.swatch.s.id); if (!file) continue;
    const src = w.swatch.kind === 'full' ? join(seed, 'full', `${file}.jpg`) : join(seed, 'thumb', `${file}.webp`);
    const alt = w.swatch.kind === 'full' ? [join(seed, 'full', `${file}.jpeg`), join(seed, 'full', `${file}.png`)] : [];
    const found = [src, ...alt].find(existsSync); if (!found) continue;
    const dest = cacheFile(w.bucket, w.path); mkdirSync(dirname(dest), { recursive: true }); copyFileSync(found, dest); fromSeed++;
  }
}
// ---- 1a. the repository's own source photos (public/images/swatches/<line>/<name>.jpg): the files scripts/seed-catalog.mjs uploaded; thumbnails are made the way it makes them
{
  const THUMB_PX = 320, THUMB_QUALITY = 62;
  for (const w of missing()) {
    if (!w.swatch || !['full', 'thumb'].includes(w.swatch.kind)) continue;
    const parts = (w.swatch.kind === 'full' ? w.path : w.path.replace(/^thumb\//, 'full/')).split('/');          // full/<line>/<name>.<ext>
    const src = ['.jpg', '.jpeg', '.png'].map((e) => join('public', 'images', 'swatches', parts[1] || '', (parts[2] || '').replace(/\.[^.]+$/, '') + e)).find(existsSync);
    if (!src) continue;
    if (w.swatch.kind === 'full') { writeCached(w.bucket, w.path, readFileSync(src)); fromSeed++; }
    else { writeCached(w.bucket, w.path, await sharp(src).resize(THUMB_PX, THUMB_PX, { fit: 'cover' }).webp({ quality: THUMB_QUALITY }).toBuffer()); fromSeed++; }
  }
}
// ---- 1b. the derived pictures, made LOCALLY from the photos with the very code the backfill scripts use (no project is asked)
//   thumb200/ (the 200 px tile: scripts/backfill-thumbs.mjs) and texflat/ (the seamless Photo-crop texture: scripts/backfill-textures.mjs)
let derived = 0;
for (const w of missing()) {
  if (!w.swatch || !['tile', 'texflat'].includes(w.swatch.kind)) continue;
  const { s } = w.swatch, src = readCached('swatches', s.image_path) || readCached('swatches', s.thumb_path); if (!src) continue;
  try {
    const out = w.swatch.kind === 'tile' ? await sharp(src).rotate().resize(200, 200, { fit: 'cover', position: 'centre' }).flatten({ background: '#fff' }).webp({ quality: 60 }).toBuffer() : (await makeTextureWebp(src)).webp;
    writeCached(w.bucket, w.path, out); derived++;
  } catch { /* left missing */ }
}
// ---- 2. the staging project
let fromStaging = 0;
if (flag('--from-staging')) for (const w of missing()) { const b = await stagingFile(w.bucket, w.path); if (b) { writeCached(w.bucket, w.path, b); fromStaging++; } }
// ---- 3. the live project: only on request, a bounded one-time fill
let fromLive = 0, liveBytes = 0, liveRequests = 0;
if (flag('--allow-live')) {
  const budget = Number(val('--live-budget')) || 1500;
  for (const w of missing()) {
    if (liveRequests >= budget) { console.log(`stopped at the live budget (${budget} requests)`); break; }
    liveRequests++;
    const r = await fetch(`${LIVE}/storage/v1/object/public/${w.bucket}/${w.path.split('/').map(encodeURIComponent).join('/')}`);
    if (!r.ok) continue;
    const b = Buffer.from(await r.arrayBuffer()); writeCached(w.bucket, w.path, b); fromLive++; liveBytes += b.length;
  }
}
const left = missing();
console.log(`${wanted.size} pictures in the catalog: ${fromSeed} from the seed folder, ${derived} made locally from them, ${fromStaging} from staging, ${fromLive} from LIVE (${liveRequests} requests, ${(liveBytes / 1e6).toFixed(1)} MB), ${left.length} still missing`);
if (left.length) console.log('missing (first 8):', left.slice(0, 8).map((w) => `${w.bucket}/${w.path}`).join(', '));
