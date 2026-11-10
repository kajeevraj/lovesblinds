// Classifies every swatch of the live catalog into one texture type, measured from its photo (src/lib/textureType.js), and writes the review material.
// READ-ONLY on the catalog by default (public catalog function + public photos); nothing on live is touched unless --apply is given.
//
//   node scripts/classify-textures.mjs                 measure everything; write docs/texture-types/report.json and report.md (and print the counts)
//   node scripts/classify-textures.mjs --write-data    also write src/data/textureTypes.json (the types bundled with the site: used for a color with no stored type)
//   node scripts/classify-textures.mjs --apply         store each color's type in swatches.texture_type (migration 27). Dry run unless --apply; only colors with NO stored type
//                                                      are written (a type set by hand in the admin is never overwritten); writes a manifest to backfill-logs/
//   node scripts/classify-textures.mjs --undo <manifest.json>   empties exactly the types this script wrote (a value changed since is left alone)
//
// The decision is the measurement (src/lib/textureType.js) plus the colors listed in scripts/texture-types/reviewed.mjs, which were looked at by eye and corrected, each with its reason.
// Needs SUPABASE_URL and VITE_SUPABASE_ANON_KEY (SUPABASE_SERVICE_ROLE_KEY for --apply / --undo).
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const { classifyPhoto, TEXTURE_TYPES, TEXTURE_TYPE_LABEL, defaultSource } = await import('../src/lib/textureType.js');
const { REVIEWED } = await import('./texture-types/reviewed.mjs');

const BASE = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), has = (f) => args.includes(f);
const OUT = join(ROOT, 'docs/texture-types'), LOG_DIR = process.env.BACKFILL_LOG_DIR || join(ROOT, 'backfill-logs');
if (!BASE || !ANON) { console.error('SUPABASE_URL and VITE_SUPABASE_ANON_KEY are needed.'); process.exit(1); }

if (has('--undo')) {
  if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY is needed.'); process.exit(1); }
  const m = JSON.parse(readFileSync(args[args.indexOf('--undo') + 1], 'utf8'));
  if (m.kind !== 'classify-textures' || m.base !== BASE) { console.error('That manifest is not from this script or is for another project.'); process.exit(1); }
  let back = 0, kept = 0;
  for (const r of m.rows) {
    const cur = await (await fetch(`${BASE}/rest/v1/swatches?select=texture_type&id=eq.${encodeURIComponent(r.id)}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();
    if (cur[0]?.texture_type !== r.type) { kept++; continue; }
    const res = await fetch(`${BASE}/rest/v1/swatches?id=eq.${encodeURIComponent(r.id)}&texture_type=eq.${r.type}`, { method: 'PATCH', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ texture_type: null }) });
    if (!res.ok) throw new Error(await res.text()); back++;
  }
  console.log(`undone: ${back} types emptied, ${kept} left as they are now`); process.exit(0);
}

// ---- the catalog ----
const rows = [];
for (const scope of ['roller', 'zebra', 'shangri-la', 'cellular', 'roman', 'dream-curtains']) {
  const r = await (await fetch(`${BASE}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${scope}}`)}`, { headers: { apikey: ANON } })).json();
  if (!Array.isArray(r)) throw new Error(`the catalog could not be read: ${JSON.stringify(r).slice(0, 200)}`);
  for (const g of r) for (const s of g.swatches || []) rows.push({ id: s.id, line: s.product_line, family: s.family || g.family || null, code: s.supplier_code, name: s.display_name, colorFamily: s.color_family, thumb: s.thumb_path, storedMode: s.texture_mode ?? null, storedType: s.texture_type ?? null, storedSource: s.texture_source ?? null, hasTypeColumn: 'texture_type' in s });
}
const seen = new Set(), swatches = rows.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
const out = [];
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < swatches.length) {
    const s = swatches[next++];
    const res = await fetch(`${BASE}/storage/v1/object/public/swatches/${s.thumb}`);
    if (!res.ok) { out.push({ ...s, type: 'linen', confidence: 0, reason: 'photo could not be read', failed: true }); continue; }
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const r = classifyPhoto(data, info.width, info.height, { line: s.line });
    const f = r.features, rev = REVIEWED[s.id];
    out.push({ ...s, measured: r.type, type: rev ? rev.type : r.type, reviewed: rev ? rev.why : null, confidence: +r.confidence.toFixed(2), runnerUp: r.runnerUp, reason: r.reason, how: r.how, banded: !!r.bands?.banded,
      features: { sdFine: +f.sdFine.toFixed(1), horiz: +f.horiz.toFixed(2), coherence: +f.coherence.toFixed(2), peakShare: +f.peakShare.toFixed(2), lineOblique: +(f.lineOblique ?? 0).toFixed(2) } });
  }
}));
out.sort((a, b) => (a.line + a.code).localeCompare(b.line + b.code));
for (const r of out) { r.source = defaultSource(r.type); r.uncertain = !r.reviewed && (r.confidence < 0.4 || (r.runnerUp && r.runnerUp !== 'linen' && r.confidence < 0.55)); }

const counts = {}; for (const r of out) counts[r.type] = (counts[r.type] || 0) + 1;
console.log(`${out.length} colors:`, TEXTURE_TYPES.map((t) => `${t} ${counts[t] || 0}`).join(', '), `| reviewed by eye: ${out.filter((r) => r.reviewed).length}, uncertain: ${out.filter((r) => r.uncertain).length}`);

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'report.json'), JSON.stringify(out.map(({ features, ...r }) => ({ ...r, features })), null, 1));
const md = ['# Texture types, measured from the swatch photos', '', `${out.length} colors. Generated by \`node scripts/classify-textures.mjs\`. "Reviewed" = looked at by eye and corrected after the measurement (reason given).`, ''];
for (const t of TEXTURE_TYPES) {
  const list = out.filter((r) => r.type === t);
  md.push(`## ${TEXTURE_TYPE_LABEL[t]} (${t}): ${list.length}, drawn ${defaultSource(t) === 'photo' ? 'from the photo' : 'generated'} by default`, '');
  md.push(list.map((r) => `${r.name} (${r.code}${r.line === 'zebra' ? ', zebra' : r.line === 'drapery' ? ', roman/drapery' : `, ${r.line}`})${r.reviewed ? ' *reviewed*' : r.uncertain ? ' ?' : ''}`).join('; '), '');
}
md.push('## Reviewed by eye', '', ...out.filter((r) => r.reviewed).map((r) => `- ${r.name} (${r.code}, ${r.line}): measured ${r.measured}, now ${r.type}. ${r.reviewed}`), '');
writeFileSync(join(OUT, 'report.md'), md.join('\n'));
if (has('--write-data')) {
  const o = Object.fromEntries(out.map((r) => [r.id, r.type]).sort((a, b) => a[0].localeCompare(b[0])));
  writeFileSync(join(ROOT, 'src/data/textureTypes.json'), `${JSON.stringify(o, null, 1)}\n`);
  console.log(`wrote src/data/textureTypes.json (${Object.keys(o).length} colors)`);
}

if (has('--apply') || has('--dry')) {
  const todo = out.filter((r) => r.storedType == null), column = out.some((r) => r.hasTypeColumn);
  if (!column) { console.error('STOP: the texture_type column does not exist yet: apply migration 27 first.'); process.exit(1); }
  console.log(`${todo.length} colors have no stored type (${out.length - todo.length} already have one and are left alone)`);
  if (has('--apply')) {
    if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY is needed.'); process.exit(1); }
    const manifest = { kind: 'classify-textures', base: BASE, at: new Date().toISOString(), rows: [] };
    for (const r of todo) {
      const res = await fetch(`${BASE}/rest/v1/swatches?id=eq.${encodeURIComponent(r.id)}&texture_type=is.null`, { method: 'PATCH', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ texture_type: r.type }) });
      if (!res.ok) throw new Error(`${r.id}: ${res.status} ${await res.text()}`);
      manifest.rows.push({ id: r.id, name: r.name, type: r.type });
    }
    mkdirSync(LOG_DIR, { recursive: true });
    const file = join(LOG_DIR, `classify-textures-${manifest.at.replace(/[:.]/g, '-')}.json`);
    writeFileSync(file, JSON.stringify(manifest, null, 1));
    console.log(`applied to ${manifest.rows.length} colors.\nmanifest: ${file}\nto undo:  node scripts/classify-textures.mjs --undo ${file}`);
  } else console.log('dry run, nothing written (add --apply)');
}
