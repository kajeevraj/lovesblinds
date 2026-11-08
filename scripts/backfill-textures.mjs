// Fabric textures for every existing color, and the auto-picked Texture setting (run AFTER migration 24 is applied).
//
//   node scripts/backfill-textures.mjs                          dry run (default): says what it would do, writes nothing
//   node scripts/backfill-textures.mjs --apply                  does it, and writes a manifest of everything it changed to backfill-logs/
//   node scripts/backfill-textures.mjs --undo <manifest.json>   puts everything in that manifest back (one command)
//
// It is additive, so the live site does not change before the new code is deployed:
//   * Textures go to NEW names, texflat/<line>/<name>.webp. The site's current code only reads tex256/, which this script never touches (no existing file is
//     overwritten or deleted, so there is nothing to back up; an existing texflat/ file is skipped, never replaced). Only the new code reads texflat/.
//   * swatches.texture_mode ('photo' or 'pattern', from src/lib/textureAnalysis.js; Zebra = 'pattern') is stored only where it is still empty. The current
//     code ignores that field. A color the owner already set is never changed.
// The manifest records every file created and, for every row changed, its previous value (the backup of what was changed). --undo deletes exactly the files in
// the manifest and puts texture_mode back to its previous value, but only on rows that still hold what this run wrote (an owner's later edit is kept).
// Run `node scripts/texture-report.mjs` first for the list of colors that become Pattern.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (live: it writes there with --apply and --undo).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTextureWebp } from './room-lab/texture-node.mjs';

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed.'); process.exit(1); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = process.env.BACKFILL_LOG_DIR || join(ROOT, 'backfill-logs');
const args = process.argv.slice(2), APPLY = args.includes('--apply'), UNDO = args.includes('--undo') ? args[args.indexOf('--undo') + 1] : null;
const BUCKET = 'swatches';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const texPath = (thumbPath) => thumbPath.replace(/^thumb\//, 'texflat/').replace(/\.[^./]+$/, '.webp');      // same rule as src/data/catalogQuery.js texFlatPath
const objUrl = (p) => `${BASE}/storage/v1/object/public/${BUCKET}/${enc(p)}`;
const json = { ...H, 'Content-Type': 'application/json' };

// ------------------------------------------------------------------------------------------------------------------------------------------ undo
if (UNDO) {
  const m = JSON.parse(readFileSync(UNDO, 'utf8'));
  if (m.kind !== 'backfill-textures' || m.base !== BASE) { console.error('That manifest is not from this script or is for another project.'); process.exit(1); }
  let removed = 0, restored = 0, kept = 0, failed = 0;
  for (const f of m.files) {                                                       // only files this run created
    const r = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${enc(f)}`, { method: 'DELETE', headers: H });
    if (r.ok || r.status === 404 || r.status === 400) removed++; else { failed++; console.error('  could not remove', f, r.status); }
  }
  for (const row of m.rows) {
    const cur = await (await fetch(`${BASE}/rest/v1/swatches?select=texture_mode&id=eq.${encodeURIComponent(row.id)}`, { headers: H })).json();
    if (!cur[0]) continue;
    if (cur[0].texture_mode !== row.to) { kept++; continue; }                      // the owner changed it since: leave it
    const r = await fetch(`${BASE}/rest/v1/swatches?id=eq.${encodeURIComponent(row.id)}&texture_mode=eq.${row.to}`, { method: 'PATCH', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify({ texture_mode: row.from }) });
    if (r.ok) restored++; else { failed++; console.error('  could not restore', row.id, r.status); }
  }
  console.log(`undone: ${removed} files removed, ${restored} texture_mode values put back, ${kept} left as the owner changed them, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

// ------------------------------------------------------------------------------------------------------------------------------------------ do
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

const manifest = { kind: 'backfill-textures', base: BASE, at: new Date().toISOString(), files: [], rows: [] };
let made = 0, existed = 0, failed = 0, photo = 0, pattern = 0, modeSet = 0, modeKept = 0;
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
    const up = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${enc(target)}`, { method: 'POST', headers: { ...H, 'Content-Type': 'image/webp', 'Cache-Control': 'max-age=86400', 'x-upsert': 'false' }, body: webp });
    if (up.ok) { made++; manifest.files.push(target); }
    else if (up.status === 409 || /already exists|Duplicate/i.test(await up.text())) existed++;       // never replaced
    else throw new Error(`upload ${up.status}`);
    if (hasMode) for (const id of e.ids) {
      const cur = rows.find((r) => r.id === id);
      if (cur.texture_mode) { modeKept++; continue; }                     // the owner's choice (or an earlier run): never changed
      const p = await fetch(`${BASE}/rest/v1/swatches?id=eq.${encodeURIComponent(id)}&texture_mode=is.null`, { method: 'PATCH', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify({ texture_mode: mode }) });
      if (!p.ok) throw new Error(`could not store texture_mode for ${id}: ${p.status} ${await p.text()}`);
      manifest.rows.push({ id, from: null, to: mode }); modeSet++;
    }
  } catch (err) { failed++; console.error('  failed', thumb, err.message); }
};
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await work(queue.shift()); }));      // six at a time
if (APPLY) {
  mkdirSync(LOG_DIR, { recursive: true });
  const file = join(LOG_DIR, `backfill-${manifest.at.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(manifest, null, 1));
  console.log(`new texture files: ${made} (already there, left alone: ${existed}), failed: ${failed}; texture_mode stored: ${modeSet}, already set (kept): ${modeKept}; photo ${photo}, pattern ${pattern}`);
  console.log(`manifest: ${file}\nto undo everything:  node scripts/backfill-textures.mjs --undo ${file}`);
} else {
  console.log(`dry run, nothing written (add --apply): would add ${pairs.size} new texture files at texflat/ (no existing file is touched); photo ${photo}, pattern ${pattern}, failed ${failed}`);
}
