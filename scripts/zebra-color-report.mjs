// READ-ONLY. For every Zebra color: the color the preview shows TODAY (the admin's preview color, else the old rule: the darker part of the photo moved into the color family's
// lightness band) against the NEW one (the average of the photo's solid band, src/lib/textureType.js zebraColors), and against an independent reading of the full-size photo.
//   node scripts/zebra-color-report.mjs [--md docs/texture-types/zebra-colors.md]
// Lists the colors that move a lot, for review. Needs SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const { zebraColors } = await import('../src/lib/textureType.js');
const { deriveHex, bandPixels, previewHex, colorDistance, isHex, familyHex, chromaOf } = await import('../src/lib/swatchColor.js');
const BASE = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = await (await fetch(`${BASE}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent('{zebra}')}`, { headers: { apikey: ANON } })).json();
const out = [];
const bytes = async (path) => { const r = await fetch(`${BASE}/storage/v1/object/public/swatches/${path}`); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; };
for (const s of rows.flatMap((g) => g.swatches)) {
  const thumb = await bytes(s.thumb_path), full = await bytes(s.image_path); if (!thumb || !full) continue;
  const t = await sharp(thumb).removeAlpha().raw().toBuffer({ resolveWithObject: true }), f = await sharp(full).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const old = await sharp(thumb).removeAlpha().resize(64, 64, { fit: 'fill' }).raw().toBuffer();
  const today = isHex(s.preview_color) ? s.preview_color.toLowerCase() : previewHex(null, deriveHex(bandPixels(old, 'zebra'), s.color_family), s.color_family);
  const now = zebraColors(t.data, t.info.width, t.info.height, s.color_family), full_ = zebraColors(f.data, f.info.width, f.info.height, s.color_family);
  out.push({ code: s.supplier_code, name: s.display_name, family: s.color_family, override: s.preview_color || null, today, now: now.hex, banded: now.banded, fromFull: full_.hex, move: colorDistance(today, now.hex), thumbVsFull: colorDistance(now.hex, full_.hex) });
}
out.sort((a, b) => b.move - a.move);
const md = ['# Zebra colors: today against the photo\'s solid band', '', '"Today" is what the preview shows now (the admin\'s preview color if there is one, else the old rule). "New" is the average of the photo\'s solid band. "Move" is the color distance between them.', '',
  '| Color | Family | Today | New | Move | Banded | Thumbnail vs full photo |', '|---|---|---|---|---|---|---|', ...out.map((r) => `| ${r.name} (${r.code}) | ${r.family} | ${r.today}${r.override ? ' (override)' : ''} | ${r.now} | ${r.move.toFixed(1)}${r.move > 8 ? ' **' : ''} | ${r.banded ? 'yes' : 'folded'} | ${r.thumbVsFull.toFixed(1)} |`), ''];
mkdirSync(join(ROOT, 'docs/texture-types'), { recursive: true });
writeFileSync(join(ROOT, process.argv.includes('--md') ? process.argv[process.argv.indexOf('--md') + 1] : 'docs/texture-types/zebra-colors.md'), md.join('\n'));
writeFileSync(join(ROOT, 'docs/texture-types/zebra-colors.json'), JSON.stringify(out, null, 1));
console.log(`${out.length} zebra colors; moving more than 8: ${out.filter((r) => r.move > 8).length}; more than 15: ${out.filter((r) => r.move > 15).length}; thumbnail vs full photo worst ${Math.max(...out.map((r) => r.thumbVsFull)).toFixed(1)}`);
for (const r of out.slice(0, 22)) console.log(`${r.code.padEnd(9)} ${r.name.padEnd(20)} ${r.family.padEnd(12)} today ${r.today}${r.override ? '*' : ' '} new ${r.now} move ${r.move.toFixed(1)}${r.banded ? '' : ' (folded)'}`);
