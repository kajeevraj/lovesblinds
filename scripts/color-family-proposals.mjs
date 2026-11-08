// READ-ONLY: proposes color-family fixes for colors whose photo clearly does not match their family (nothing is changed anywhere):
//
//   node scripts/color-family-proposals.mjs          writes docs/color-family-proposals.md (+ .json) from the live catalog and public photos
//
// "Clearly does not match": the family the PICTURE says (src/lib/colorFamily.js familyFromLab on the photo's average color; a Zebra's solid band) is not the
// stored family AND the tile color is far from the photo (distance above 12). Each proposal says what the NAME says (src/data/colorFamilyList.js), which
// decides how sure it is: name and photo agree = propose; the name agrees with the stored family but the photo does not = your call.
// Needs SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { decodePhoto } from './room-lab/texture-node.mjs';
import { rgb2lab, familyFromLab } from '../src/lib/colorFamily.js';
import { familyFromName } from '../src/data/colorFamilyList.js';
import { deriveHex, previewHex, bandPixels, colorDistance, hexOf, isHex, FAMILY_LOOK } from '../src/lib/swatchColor.js';
import { LINE_SCOPE, storageUrl, thumb200Path } from '../src/data/catalogQuery.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!BASE || !ANON) { console.error('SUPABASE_URL and VITE_SUPABASE_ANON_KEY are needed.'); process.exit(1); }
const getBuf = async (p) => { const r = await fetch(storageUrl(BASE, p)); if (!r.ok) throw new Error(`${p} ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
const all = new Map();
for (const line of Object.keys(LINE_SCOPE)) {
  const rows = await (await fetch(`${BASE}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${LINE_SCOPE[line].join(',')}}`)}`, { headers: { apikey: ANON } })).json();
  for (const f of rows) for (const s of f.swatches || []) if (!all.has(s.id)) all.set(s.id, s);
}
const out = [], q = [...all.values()];
await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) {
  const s = q.shift();
  try {
    const full = await decodePhoto(await getBuf(s.image_path)), zebra = s.product_line === 'zebra';
    const px = bandPixels(full.rgb, s.product_line), m = [0, 0, 0], n = px.length / 3;
    for (let i = 0; i < px.length; i += 3) for (let c = 0; c < 3; c++) m[c] += px[i + c] / n;
    const photoAvg = hexOf(m), lab = rgb2lab(...m), photoFamily = familyFromLab(lab);
    const tilePx = new Uint8ClampedArray(await sharp(await getBuf(thumb200Path(s.thumb_path))).removeAlpha().resize(64, 64, { fit: 'fill' }).raw().toBuffer());
    const hexFor = (fam) => previewHex(isHex(s.preview_color) ? s.preview_color : null, deriveHex(bandPixels(tilePx, s.product_line), fam), fam);
    const now = hexFor(s.color_family), after = hexFor(photoFamily);
    out.push({ id: s.id, line: s.product_line, family: s.family || null, name: s.display_name, code: s.supplier_code, stored: s.color_family, photoFamily, nameFamily: familyFromName(s.display_name), photoAvg, L: +lab[0].toFixed(0), tileNow: now, tileAfter: after, dNow: +colorDistance(photoAvg, now).toFixed(1), dAfter: +colorDistance(photoAvg, after).toFixed(1), override: isHex(s.preview_color), zebra });
  } catch (e) { out.push({ id: s.id, error: e.message }); }
} }));
const ok = out.filter((o) => !o.error);
// a clear mismatch: the picture says another family, and the tile is visibly off the photo. Black / Pattern families are left alone (a black's photo is
// white weft on black; a pattern has no single color).
const cand = ok.filter((o) => !o.override && o.stored !== o.photoFamily && o.dNow > 12 && !['Charcoal/Black', 'Pattern/Multi'].includes(o.stored) && o.photoFamily !== 'Pattern/Multi' && o.dAfter < o.dNow - 4);
const kind = (o) => (o.nameFamily && o.nameFamily === o.photoFamily ? 'A' : !o.nameFamily ? 'B' : o.nameFamily === o.stored ? 'C' : 'D');
const label = { A: 'Name and photo agree: propose the change', B: 'Name has no family word: the photo decides', C: 'Name agrees with the CURRENT family, the photo does not: your call', D: 'Name says a third family: your call' };
const order = ['A', 'B', 'C', 'D'];
// ---- the recommendation ----
// The picture alone is not enough: supplier photos of WHITE fabric are often exposed grey (a photo average of L* 70 to 80), and the White family's band
// is what lifts them back to a soft white. So a white-named color is only proposed for Gray when its photo is as dark as a real grey fabric (L* 68 or less).
// A color whose name AND photo agree on another family is proposed. Everything else is reviewed and kept, with the reason.
const lightOf = (o) => o.L;
const proposeChange = (o) => (kind(o) === 'A') || (o.nameFamily === 'White' && o.stored === 'White' && o.photoFamily === 'Gray' && lightOf(o) <= 68) || (o.name === 'White Slate');
const change = cand.filter(proposeChange).sort((a, b) => a.name.localeCompare(b.name));
const keep = cand.filter((o) => !proposeChange(o));
const keepReason = (o) => {
  if (o.stored === 'White' && o.nameFamily === 'White' && o.photoFamily === 'Gray') return 'white-named; its photo is exposed grey (a white fabric in a studio shot): the White band shows it as the soft white it is';
  if (o.stored === 'Brown' && o.photoFamily === 'Charcoal/Black') return 'brown-named; its photo is neutral dark (the photo lost the brown): keep Brown, or set a Preview color';
  if (o.zebra) return 'zebra photo is a whole or folded shade, so its color is a poor guide: keep the family named in its name';
  if (o.stored === 'White' && o.photoFamily === 'Beige/Tan') return 'white-named linen with a warm photo: keep White (borderline distance)';
  return 'the name says the current family: keep';
};
const tbl = (rows, extra) => rows.map((o) => `| ${o.line}${o.family ? `/${o.family}` : ''} | ${o.name} | ${o.code} | ${o.stored} | ${extra(o)} | \`${o.photoAvg}\` | \`${o.tileNow}\` (${o.dNow}) | \`${o.tileAfter}\` (${o.dAfter}) |`).join('\n');
let md = `# Color family proposals (not applied)\n\nMade by \`node scripts/color-family-proposals.mjs\` (read-only) from the live catalog. ${cand.length} colors have a photo that clearly does not match their stored family (the picture says another family and the tile is more than 12 off the photo). **${change.length} are proposed for a change below; the other ${keep.length} are recommended to stay as they are, with the reason.** "Tile now" is what the picker shows today; "tile after" is what it would show in the proposed family (distance to the photo's average in brackets). A family also drives the picker's color filter. Nothing has been changed.\n`;
md += `\n## Proposed changes, for your approval (${change.length})\n\n| Line | Color | Code | Current | Proposed | Photo average | Tile now | Tile after |\n|---|---|---|---|---|---|---|---|\n${tbl(change, (o) => `**${o.photoFamily}**${o.name === 'Salt White' ? ' (verify the physical swatch: its name says white)' : o.name === 'White Slate' ? ' (slate is a grey)' : ' (name agrees)'}`)}\n`;
const groups = {};
for (const o of keep) (groups[keepReason(o)] = groups[keepReason(o)] || []).push(o);
md += `\n## Reviewed and recommended to keep (${keep.length})\n`;
for (const [why, rows] of Object.entries(groups)) md += `\n**${why}** (${rows.length})\n\n| Line | Color | Code | Current | Photo says | Photo average | Tile now | Tile after if changed |\n|---|---|---|---|---|---|---|---|\n${tbl(rows.sort((a, b) => a.name.localeCompare(b.name)), (o) => o.photoFamily)}\n`;
writeFileSync(join(ROOT, 'docs/color-family-proposals.md'), md);
writeFileSync(join(ROOT, 'docs/color-family-proposals.json'), JSON.stringify({ proposed: change, kept: keep }, null, 1));
console.log(`${cand.length} mismatches: ${change.length} proposed, ${keep.length} kept`);
void FAMILY_LOOK; void label; void order;
