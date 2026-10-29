// One-time backfill: gives every existing color its 256 px 3D fabric texture at tex256/<line>/<name>.webp (the naming rule the room visualizer
// and the product-page preview use; new or replaced colors get theirs when uploaded in the admin).
//
//   node scripts/backfill-textures.mjs            dry run (default): counts what is missing, writes nothing
//   node scripts/backfill-textures.mjs --apply    makes and uploads the missing textures
//
// Adds new files only: it never changes or deletes an existing file, and changes no database row. Safe to run twice (textures that already
// exist are skipped). A color in the zebra line gets a stripe texture (solid band over sheer band), every other line a flat piece of cloth.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import { makeTextureWebp } from './room-lab/texture-node.mjs';

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed.'); process.exit(1); }
const APPLY = process.argv.includes('--apply');
const BUCKET = 'swatches';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const texPath = (thumbPath) => thumbPath.replace(/^thumb\//, 'tex256/').replace(/\.[^./]+$/, '.webp');      // same rule as src/data/catalogQuery.js
const objUrl = (p) => `${BASE}/storage/v1/object/public/${BUCKET}/${p.split('/').map(encodeURIComponent).join('/')}`;

const res = await fetch(`${BASE}/rest/v1/swatches?select=id,image_path,thumb_path,styles&limit=5000`, { headers: H });
if (!res.ok) { console.error('could not read swatches', res.status, await res.text()); process.exit(1); }
const rows = await res.json();
const pairs = new Map();
for (const r of rows) {
  if (r.thumb_path && r.image_path) pairs.set(r.thumb_path, r.image_path);
  for (const st of r.styles || []) if (st.thumb_path && st.image_path) pairs.set(st.thumb_path, st.image_path);
}
console.log(`${rows.length} colors, ${pairs.size} distinct pictures`);

let have = 0, made = 0, failed = 0, todo = 0;
const queue = [...pairs];
const work = async ([thumb, image]) => {
  const target = texPath(thumb);
  if ((await fetch(objUrl(target), { method: 'HEAD' })).ok) { have++; return; }
  todo++;
  if (!APPLY) return;
  try {
    let src = await fetch(objUrl(image));
    if (!src.ok) src = await fetch(objUrl(thumb));
    if (!src.ok) throw new Error(`source missing (${src.status})`);
    const out = await makeTextureWebp(Buffer.from(await src.arrayBuffer()), thumb.split('/')[1] === 'zebra' ? 'zebra' : 'weave');
    const up = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${target.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'image/webp', 'Cache-Control': 'max-age=86400', 'x-upsert': 'false' }, body: out,
    });
    if (!up.ok) throw new Error(`upload ${up.status} ${await up.text()}`);
    made++;
  } catch (e) { failed++; console.error('  failed', thumb, e.message); }
};
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await work(queue.shift()); }));      // six at a time
console.log(APPLY ? `textures already there: ${have}, made: ${made}, failed: ${failed}` : `textures already there: ${have}, missing: ${todo} (dry run, nothing written; add --apply)`);
