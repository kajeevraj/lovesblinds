// Fabric textures for every existing color, and the auto-picked Texture setting (run AFTER migration 24 is applied).
//
//   node scripts/backfill-textures.mjs            dry run (default): counts what it would do, writes nothing
//   node scripts/backfill-textures.mjs --apply    does it
//
// For every color it looks at the supplier photo (src/lib/textureAnalysis.js: the same decision the admin upload makes) and
//   1. re-makes the 256 px Photo-crop texture at tex256/<line>/<name>.webp: the flattest part of the photo, uneven lighting removed, made to tile with no
//      seam. This REPLACES the older uncut texture of that name (the site reads it with ?v=2 in the url, so no one is served a stale copy);
//   2. stores swatches.texture_mode ('photo' or 'pattern') where it is still empty. A color the owner already set by hand is never changed. Zebra colors
//      are stored as 'pattern' (always).
// Nothing is deleted. Run `node scripts/texture-report.mjs` first for the list of colors that become Pattern. Safe to run twice.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (live: it writes there when --apply is given).
import { makeTextureWebp } from './room-lab/texture-node.mjs';

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed.'); process.exit(1); }
const APPLY = process.argv.includes('--apply');
const BUCKET = 'swatches';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const texPath = (thumbPath) => thumbPath.replace(/^thumb\//, 'tex256/').replace(/\.[^./]+$/, '.webp');      // same rule as src/data/catalogQuery.js
const objUrl = (p) => `${BASE}/storage/v1/object/public/${BUCKET}/${p.split('/').map(encodeURIComponent).join('/')}`;

let res = await fetch(`${BASE}/rest/v1/swatches?select=id,product_line,image_path,thumb_path,texture_mode,styles&limit=5000`, { headers: H });
let hasMode = true;
if (!res.ok) {                                                            // migration 24 not applied yet: textures only, no setting to store
  hasMode = false;
  res = await fetch(`${BASE}/rest/v1/swatches?select=id,product_line,image_path,thumb_path,styles&limit=5000`, { headers: H });
}
if (!res.ok) { console.error('could not read swatches', res.status, await res.text()); process.exit(1); }
if (!hasMode) console.log('NOTE: swatches.texture_mode does not exist yet (migration 24 is not applied): only the textures are handled.');
const rows = await res.json();
const pairs = new Map();            // thumb -> { image, ids: [swatch ids], zebra }
for (const r of rows) {
  if (r.thumb_path && r.image_path) { const e = pairs.get(r.thumb_path) || { image: r.image_path, ids: [], zebra: r.product_line === 'zebra' }; e.ids.push(r.id); pairs.set(r.thumb_path, e); }
  for (const st of r.styles || []) if (st.thumb_path && st.image_path && !pairs.has(st.thumb_path)) pairs.set(st.thumb_path, { image: st.image_path, ids: [], zebra: false });
}
console.log(`${rows.length} colors, ${pairs.size} distinct pictures`);

let made = 0, failed = 0, modeSet = 0, modeKept = 0, photo = 0, pattern = 0;
const queue = [...pairs];
const work = async ([thumb, e]) => {
  try {
    let src = await fetch(objUrl(e.image));
    if (!src.ok) src = await fetch(objUrl(thumb));
    if (!src.ok) throw new Error(`source missing (${src.status})`);
    const { webp, analysis } = await makeTextureWebp(Buffer.from(await src.arrayBuffer()));
    const mode = e.zebra ? 'pattern' : analysis.mode;
    if (mode === 'pattern') pattern++; else photo++;
    if (!APPLY) return;
    const target = texPath(thumb);
    const up = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${target.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'image/webp', 'Cache-Control': 'max-age=86400', 'x-upsert': 'true' }, body: webp,
    });
    if (!up.ok) throw new Error(`upload ${up.status} ${await up.text()}`);
    made++;
    if (hasMode) for (const id of e.ids) {
      const cur = rows.find((r) => r.id === id);
      if (cur.texture_mode) { modeKept++; continue; }                     // the owner's choice (or an earlier run): never changed
      const p = await fetch(`${BASE}/rest/v1/swatches?id=eq.${encodeURIComponent(id)}&texture_mode=is.null`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ texture_mode: mode }) });
      if (!p.ok) throw new Error(`could not store texture_mode for ${id}: ${p.status} ${await p.text()}`);
      modeSet++;
    }
  } catch (err) { failed++; console.error('  failed', thumb, err.message); }
};
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await work(queue.shift()); }));      // six at a time
console.log(APPLY
  ? `textures re-made: ${made}, failed: ${failed}; texture_mode stored: ${modeSet}, already set (kept): ${modeKept}; photo ${photo}, pattern ${pattern}`
  : `dry run, nothing written (add --apply): would re-make ${pairs.size} textures; photo ${photo}, pattern ${pattern}, failed ${failed}`);
