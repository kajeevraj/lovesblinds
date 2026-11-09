// READ-ONLY: reviews every White and Cream/Ivory color (after the part 2 moves in scripts/color-fixes/part2.mjs) and lists those whose tile looks noticeably off
// from the photo, with a side-by-side image (tile next to photo). Nothing is changed anywhere.
//
//   node scripts/color-family-review.mjs        writes docs/color-family-review.md and docs/texture-review/family-review-*.jpg
//
// "Noticeably off": the tile color is more than 9 color distance from the photo's average (a zebra's: its solid band), or its lightness differs by more than 8
// (a tile much lighter or darker than the cloth looks wrong next to its photo). The tile is drawn exactly as the site draws it (same texture, same color).
// Needs SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { decodePhoto } from './room-lab/texture-node.mjs';
import { analyzePhoto } from '../src/lib/textureAnalysis.js';
import { photoCropTexture, retarget, TEX } from '../src/room/textureCore.js';
import { patternRGB, zebraPattern, weaveKindOf } from '../src/lib/patternTexture.js';
import { deriveHex, previewHex, bandPixels, colorDistance, hexOf, isHex, lightnessOf, chromaOf } from '../src/lib/swatchColor.js';
import { zebraBands } from '../src/room/zebraBands.js';
import { LINE_SCOPE, storageUrl, thumb200Path } from '../src/data/catalogQuery.js';
import { FIXES as PART2 } from './color-fixes/part2.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!BASE || !ANON) { console.error('SUPABASE_URL and VITE_SUPABASE_ANON_KEY are needed.'); process.exit(1); }
const getBuf = async (p) => { const r = await fetch(storageUrl(BASE, p)); if (!r.ok) throw new Error(`${p} ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
const moved = new Map(PART2.map((f) => [`${f.line}|${f.code}`, f.set.color_family]));
const all = new Map();
for (const line of Object.keys(LINE_SCOPE)) {
  const rows = await (await fetch(`${BASE}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${LINE_SCOPE[line].join(',')}}`)}`, { headers: { apikey: ANON } })).json();
  for (const f of rows) for (const s of f.swatches || []) if (!all.has(s.id)) all.set(s.id, { ...s, fam: s.family || f.family, composition: s.composition || f.composition });
}
const cands = [...all.values()].map((s) => ({ s, family: moved.get(`${s.product_line}|${s.supplier_code}`) || s.color_family, wasMoved: moved.has(`${s.product_line}|${s.supplier_code}`) }))
  .filter((x) => ['White', 'Cream/Ivory'].includes(x.family) && !x.wasMoved);
console.log(`${cands.length} White and Cream colors to review (after the ${moved.size} part 2 moves)`);

const out = [], q = [...cands];
await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) {
  const { s, family } = q.shift();
  try {
    const full = await decodePhoto(await getBuf(s.image_path)), zebra = s.product_line === 'zebra', px = bandPixels(full.rgb, s.product_line), m = [0, 0, 0], n = px.length / 3;
    for (let i = 0; i < px.length; i += 3) for (let c = 0; c < 3; c++) m[c] += px[i + c] / n;
    const photoAvg = hexOf(m), tilePx = new Uint8ClampedArray(await sharp(await getBuf(thumb200Path(s.thumb_path))).removeAlpha().resize(64, 64, { fit: 'fill' }).raw().toBuffer());
    const hex = previewHex(isHex(s.preview_color) ? s.preview_color : null, deriveHex(bandPixels(tilePx, s.product_line), family), family);
    const dE = colorDistance(photoAvg, hex), dL = lightnessOf(hex) - lightnessOf(photoAvg);
    const off = dE > 9 || Math.abs(dL) > 8;
    let tile = null;
    if (off) {                                              // draw the tile the way the site does
      const mode = zebra ? 'pattern' : s.texture_mode || analyzePhoto(full.rgb, full.w, full.h).mode, target = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      let rgb, h = TEX;
      if (zebra) { const z = zebraPattern(hex, zebraBands({ solidIn: s.zebra_solid_in, sheerIn: s.zebra_sheer_in }).split, TEX).rgb; rgb = new Uint8ClampedArray(z.length * 2); rgb.set(z); rgb.set(z, z.length); h = TEX * 2; }
      else if (mode === 'pattern') rgb = patternRGB(weaveKindOf({ line: s.product_line, family: s.fam, composition: s.composition, weave: s.weave }), hex, TEX);
      else rgb = retarget(photoCropTexture(full.rgb, full.w, full.h, analyzePhoto(full.rgb, full.w, full.h).rect), target);
      tile = await sharp(Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength), { raw: { width: TEX, height: h, channels: 3 } }).resize(220, 220, { fit: 'fill' }).png().toBuffer();
    }
    const photo = off ? await sharp(await getBuf(s.image_path)).resize(220, 220, { fit: 'cover' }).png().toBuffer() : null;
    out.push({ id: s.id, line: s.product_line, fam: s.fam || null, name: s.display_name, code: s.supplier_code, family, hex, photoAvg, dE: +dE.toFixed(1), dL: +dL.toFixed(0), L: +lightnessOf(photoAvg).toFixed(0), c: +chromaOf(photoAvg).toFixed(1), off, tile, photo });
  } catch (e) { out.push({ id: s.id, name: s.display_name, error: e.message }); }
} }));
const ok = out.filter((o) => !o.error), flagged = ok.filter((o) => o.off).sort((a, b) => b.dE - a.dE);
mkdirSync(join(ROOT, 'docs/texture-review'), { recursive: true });
const PER = 12, label = (o) => `${o.name} | ${o.line}${o.fam ? '/' + o.fam : ''} ${o.code} | ${o.family}`;
const sheets = [];
for (let p = 0; p * PER < flagged.length; p++) {
  const part = flagged.slice(p * PER, (p + 1) * PER), cols = 3, cw = 450, ch = 262, comps = [];
  for (let i = 0; i < part.length; i++) {
    const o = part[i], x = (i % cols) * (cw + 8), y = Math.floor(i / cols) * (ch + 8);
    const svg = Buffer.from(`<svg width="${cw}" height="${ch}"><rect width="${cw}" height="${ch}" fill="#fff"/><text x="6" y="16" font-size="13" font-weight="bold" fill="#111" font-family="sans-serif">${label(o).replace(/&/g, '&amp;')}</text><text x="6" y="256" font-size="12" fill="#333" font-family="sans-serif">tile ${o.hex}  |  photo ${o.photoAvg}  |  distance ${o.dE}, lightness ${o.dL > 0 ? '+' : ''}${o.dL}</text><text x="6" y="${ch - 20}" font-size="11" fill="#777" font-family="sans-serif"></text></svg>`);
    comps.push({ input: svg, left: x, top: y }, { input: o.tile, left: x + 2, top: y + 22 }, { input: o.photo, left: x + 226, top: y + 22 });
  }
  const rows = Math.ceil(part.length / cols), file = `docs/texture-review/family-review-${p + 1}.jpg`;
  await sharp({ create: { width: cols * (cw + 8), height: rows * (ch + 8), channels: 3, background: '#e8e4dc' } }).composite(comps).jpeg({ quality: 86 }).toFile(join(ROOT, file));
  sheets.push(file);
}
let md = `# White and Cream colors to review (after the part 2 moves)\n\nMade by \`node scripts/color-family-review.mjs\` (read-only). ${ok.length} White and Cream/Ivory colors reviewed; **${flagged.length}** have a tile that looks noticeably off from the photo (tile more than 9 color distance from the photo average, or more than 8 lightness apart). In each image the tile (left) is drawn as the site draws it, the photo is on the right. Nothing has been changed.\n\n`;
md += sheets.map((f) => `![${f}](texture-review/${f.split('/').pop()})`).join('\n\n') + '\n\n| Color | Line | Code | Family | Photo average | Tile | Distance | Lightness |\n|---|---|---|---|---|---|---|---|\n';
for (const o of flagged) md += `| ${o.name} | ${o.line}${o.fam ? '/' + o.fam : ''} | ${o.code} | ${o.family} | \`${o.photoAvg}\` | \`${o.hex}\` | ${o.dE} | ${o.dL > 0 ? '+' : ''}${o.dL} |\n`;
writeFileSync(join(ROOT, 'docs/color-family-review.md'), md);
writeFileSync(join(ROOT, 'docs/color-family-review.json'), JSON.stringify(flagged.map(({ tile, photo, ...r }) => r), null, 1));
console.log(`${ok.length} reviewed, ${flagged.length} flagged, ${out.length - ok.length} unreadable; sheets: ${sheets.join(', ')}`);
for (const o of flagged) console.log(o.name.padEnd(20), o.line.padEnd(14), o.code.padEnd(12), o.family.padEnd(12), 'photo', o.photoAvg, 'tile', o.hex, `dE ${o.dE} dL ${o.dL}`);
