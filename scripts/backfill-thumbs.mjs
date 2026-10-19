// One-time backfill: gives every existing color a 200 px WebP tile picture at thumb200/<line>/<name>.webp
// (the naming rule the product pages use; new colors get theirs when uploaded in the admin).
//
//   node scripts/backfill-thumbs.mjs            dry run (default): counts what is missing, writes nothing
//   node scripts/backfill-thumbs.mjs --apply    makes and uploads the missing tiles
//
// Adds new files only: it never changes or deletes an existing file, and changes no database row. Safe to run twice
// (tiles that already exist are skipped). Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import sharp from 'sharp';

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed.'); process.exit(1); }
const APPLY = process.argv.includes('--apply');
const BUCKET = 'swatches';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const tilePath = (thumbPath) => thumbPath.replace(/^thumb\//, 'thumb200/').replace(/\.[^./]+$/, '.webp');
const objUrl = (p) => `${BASE}/storage/v1/object/public/${BUCKET}/${p.split('/').map(encodeURIComponent).join('/')}`;

// every (image, thumbnail) pair the catalog points at: each color's own picture plus Dream Curtains styles
const res = await fetch(`${BASE}/rest/v1/swatches?select=id,image_path,thumb_path,styles&limit=5000`, { headers: H });
if (!res.ok) { console.error('could not read swatches', res.status, await res.text()); process.exit(1); }
const rows = await res.json();
const pairs = new Map();
for (const r of rows) {
  if (r.thumb_path && r.image_path) pairs.set(r.thumb_path, r.image_path);
  for (const st of r.styles || []) if (st.thumb_path && st.image_path) pairs.set(st.thumb_path, st.image_path);
}
console.log(`${rows.length} colors, ${pairs.size} distinct thumbnails`);

let have = 0, made = 0, failed = 0, todo = 0;
for (const [thumb, image] of pairs) {
  const target = tilePath(thumb);
  const head = await fetch(objUrl(target), { method: 'HEAD' });
  if (head.ok) { have++; continue; }
  todo++;
  if (!APPLY) continue;
  try {
    // the full image gives the sharpest 200 px square; the 320 px thumbnail is the fallback source
    let src = await fetch(objUrl(image));
    if (!src.ok) src = await fetch(objUrl(thumb));
    if (!src.ok) throw new Error(`source missing (${src.status})`);
    const buf = Buffer.from(await src.arrayBuffer());
    const out = await sharp(buf).rotate().resize(200, 200, { fit: 'cover', position: 'centre' }).flatten({ background: '#fff' }).webp({ quality: 60 }).toBuffer();
    const up = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${target.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'image/webp', 'Cache-Control': 'max-age=86400', 'x-upsert': 'false' }, body: out,
    });
    if (!up.ok) throw new Error(`upload ${up.status} ${await up.text()}`);
    made++;
  } catch (e) { failed++; console.error('  failed', thumb, e.message); }
}
console.log(APPLY ? `tiles already there: ${have}, made: ${made}, failed: ${failed}` : `tiles already there: ${have}, missing: ${todo} (dry run, nothing written; add --apply)`);
