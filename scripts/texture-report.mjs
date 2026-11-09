// READ-ONLY review report for the fabric texture work (nothing is written to any database or bucket; it only reads the public catalog and the public photos):
//
//   node scripts/texture-report.mjs            writes docs/texture-review.md (+ docs/texture-review.json) and prints a summary
//
// 1. Every swatch that is drawn as PATTERN instead of a photo crop, and why: every Zebra color (always), and every other color whose photo has no usable
//    flat area (folds, a whole shade, too small, strong shading). This is exactly the setting scripts/backfill-textures.mjs --apply would store in
//    swatches.texture_mode (Products > Colors > Texture lets the owner flip any of them).
// 2. Every swatch whose tile color is far from its photo's average color (color distance, CIE76, above FAR_DE), so it can be reviewed in the admin
//    (Products > Colors > Preview color). A tile color is the color the picker tile, the chip and the 3D shade all show.
//
// Needs SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the same public values the site uses).
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { decodePhoto } from './room-lab/texture-node.mjs';
import { analyzePhoto } from '../src/lib/textureAnalysis.js';
import { deriveHex, previewHex, bandPixels, colorDistance, hexOf, isHex } from '../src/lib/swatchColor.js';
import { LINE_SCOPE, storageUrl, thumb200Path } from '../src/data/catalogQuery.js';

export const FAR_DE = 12;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!BASE || !ANON) { console.error('SUPABASE_URL and VITE_SUPABASE_ANON_KEY are needed.'); process.exit(1); }

const getJson = async (url) => { const r = await fetch(url, { headers: { apikey: ANON } }); if (!r.ok) throw new Error(`${url} -> ${r.status}`); return r.json(); };
const getBuf = async (path) => { const r = await fetch(storageUrl(BASE, path)); if (!r.ok) throw new Error(`${path} -> ${r.status}`); return Buffer.from(await r.arrayBuffer()); };

// every distinct swatch, from every line's public catalog
const all = new Map();
for (const line of Object.keys(LINE_SCOPE)) {
  const rows = await getJson(`${BASE}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${LINE_SCOPE[line].join(',')}}`)}`);
  for (const f of rows) for (const s of f.swatches || []) if (!all.has(s.id)) all.set(s.id, { ...s, fabricFamily: f.family, composition: s.composition || f.composition, collection: f.id });
}
const swatches = [...all.values()];
console.log(`${swatches.length} colors`);

const out = [];
const queue = [...swatches];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const s = queue.shift();
    try {
      const full = await decodePhoto(await getBuf(s.image_path));
      const analysis = analyzePhoto(full.rgb, full.w, full.h);
      // the tile color, read the way the browser reads it (the 200 px tile picture, drawn at 64 x 64)
      const tile = await sharp(await getBuf(thumb200Path(s.thumb_path))).removeAlpha().resize(64, 64, { fit: 'fill' }).raw().toBuffer();
      const px = new Uint8ClampedArray(tile), derived = deriveHex(bandPixels(px, s.product_line), s.color_family);
      const hex = previewHex(isHex(s.preview_color) ? s.preview_color : null, derived, s.color_family);
      // the photo's average color (a zebra's: its solid band, since the white sheer bands are not the cloth's color)
      const n = full.rgb.length / 3, m = [0, 0, 0];
      const avgPx = bandPixels(full.rgb, s.product_line), na = avgPx.length / 3;
      for (let i = 0; i < avgPx.length; i += 3) for (let c = 0; c < 3; c++) m[c] += avgPx[i + c] / na;
      void n;
      const avg = hexOf(m), zebra = s.product_line === 'zebra';
      out.push({
        id: s.id, line: s.product_line, family: s.family || null, name: s.display_name, code: s.supplier_code, colorFamily: s.color_family,
        mode: zebra ? 'pattern' : analysis.mode, reason: zebra ? 'Zebra is always the pattern' : analysis.reason, metrics: analysis.metrics, stored: s.texture_mode || null,
        tile: hex, photoAvg: avg, dE: +colorDistance(avg, hex).toFixed(1), override: isHex(s.preview_color) ? s.preview_color : null,
      });
    } catch (e) { out.push({ id: s.id, line: s.product_line, name: s.display_name, code: s.supplier_code, error: String(e.message || e) }); }
  }
}));

const ok = out.filter((o) => !o.error).sort((a, b) => a.line.localeCompare(b.line) || a.name.localeCompare(b.name));
const errors = out.filter((o) => o.error);
const label = (o) => `${o.line}${o.family ? `/${o.family}` : ''}`;
const patternNonZebra = ok.filter((o) => o.mode === 'pattern' && o.line !== 'zebra');
const patternZebra = ok.filter((o) => o.line === 'zebra');
const far = ok.filter((o) => o.dE > FAR_DE && !o.override).sort((a, b) => b.dE - a.dE);
const photoCount = ok.filter((o) => o.mode === 'photo').length;

let md = `# Fabric texture review (phase 1)\n\nMade by \`node scripts/texture-report.mjs\` from the live catalog (read-only). ${ok.length} colors: **${photoCount} Photo crop**, **${patternNonZebra.length + patternZebra.length} Pattern** (${patternZebra.length} Zebra, always; ${patternNonZebra.length} others).\n\n`;
md += `## 1. Swatches switched to Pattern (not Zebra): ${patternNonZebra.length}\n\nEach has no usable flat area in its photo. In the admin: Products > Colors > the color > Texture. "shade" and "edge" are the measures behind the decision (limits 11 and 2.6).\n\n| Line | Color | Code | Why | shade | edge |\n|---|---|---|---|---|---|\n`;
for (const o of patternNonZebra) md += `| ${label(o)} | ${o.name} | ${o.code} | ${o.reason} | ${o.metrics.shade} | ${o.metrics.edge} |\n`;
md += `\n## 2. Zebra: every color is Pattern (${patternZebra.length})\n\nSolid and sheer bands (default 3 in and 2 in, editable per color in the admin). ${patternZebra.map((o) => `${o.name} (${o.code})`).join(', ')}.\n`;
md += `\n## 3. Tile color far from the photo's average color (distance above ${FAR_DE}): ${far.length}\n\nThe tile color is what the picker, the "This blind" chip and the 3D shade show. A Zebra's photo color is its solid band. Colors with an admin override are left out. Review in Products > Colors > Preview color.\n\n| Line | Color | Code | Color family | Photo average | Tile color | Distance |\n|---|---|---|---|---|---|---|\n`;
for (const o of far) md += `| ${label(o)} | ${o.name} | ${o.code} | ${o.colorFamily} | \`${o.photoAvg}\` | \`${o.tile}\` | ${o.dE} |\n`;
if (errors.length) md += `\n## Could not be read (${errors.length})\n\n${errors.map((e) => `- ${e.id}: ${e.error}`).join('\n')}\n`;
writeFileSync(join(ROOT, 'docs/texture-review.md'), md);
writeFileSync(join(ROOT, 'docs/texture-review.json'), JSON.stringify({ farDE: FAR_DE, colors: ok }, null, 1));
console.log(`photo ${photoCount}, pattern ${patternNonZebra.length} + ${patternZebra.length} zebra, far from photo ${far.length}, unreadable ${errors.length}`);
