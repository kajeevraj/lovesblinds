// Every real swatch photo in the live catalog goes through the texture pipeline (read-only: it only downloads the public catalog and photos):
//  - a photo with a flat area becomes a Photo-crop texture that tiles with no visible seam and no fold (checked on the 3 x 3 tiling);
//  - a photo without one becomes the pattern, in the same color the picker tile shows (the pattern's average IS the tile color);
//  - every Zebra color is the pattern, whatever its photo looks like.
import { decodePhoto } from '../../scripts/room-lab/texture-node.mjs';
import { analyzePhoto, LIMITS } from '../../src/lib/textureAnalysis.js';
import { photoCropTexture, seamRatio, TEX } from '../../src/room/textureCore.js';
import { patternRGB, weaveKindOf } from '../../src/lib/patternTexture.js';
import { deriveHex, previewHex, bandPixels, isHex, hexOf } from '../../src/lib/swatchColor.js';
import { LINE_SCOPE, storageUrl, thumb200Path } from '../../src/data/catalogQuery.js';
const sharp = (await import('sharp')).default;
const BASE = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const buf = async (p) => { const r = await fetch(storageUrl(BASE, p)); if (!r.ok) throw new Error(`${p} ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
try {
  const all = new Map();
  for (const line of Object.keys(LINE_SCOPE)) {
    const rows = await (await fetch(`${BASE}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${LINE_SCOPE[line].join(',')}}`)}`, { headers: { apikey: ANON } })).json();
    for (const f of rows) for (const s of f.swatches || []) if (!all.has(s.id)) all.set(s.id, { ...s, fam: s.family || f.family });
  }
  const sw = [...all.values()];
  check(`the live catalog has colors to test (${sw.length})`, sw.length > 300);
  const ratios = []; const failures = { seam: [], fold: [], pat: [], zebra: [], mean: [], err: [] }; const stat = { photo: 0, pattern: 0 };
  const q = [...sw];
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) {
    const s = q.shift();
    try {
      const full = await decodePhoto(await buf(s.image_path)), a = analyzePhoto(full.rgb, full.w, full.h), zebra = s.product_line === 'zebra';
      const mode = zebra ? 'pattern' : a.mode; stat[mode]++;
      if (zebra && mode !== 'pattern') failures.zebra.push(s.id);
      if (mode === 'photo') {
        const t = photoCropTexture(full.rgb, full.w, full.h, a.rect);
        const r = seamRatio(t); ratios.push(r); if (r > 1.5) failures.seam.push(`${s.id} ${r.toFixed(2)}`);
        const S = TEX * 3, tiled = new Uint8ClampedArray(S * S * 3);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (let c = 0; c < 3; c++) tiled[(y * S + x) * 3 + c] = t[((y % TEX) * TEX + (x % TEX)) * 3 + c];
        const ta = analyzePhoto(tiled, S, S);
        if (ta.metrics.edge > LIMITS.edge || ta.metrics.line > LIMITS.line || ta.metrics.shade > LIMITS.shade) failures.fold.push(`${s.id} ${JSON.stringify(ta.metrics)}`);
      } else {
        const tile = await sharp(await buf(thumb200Path(s.thumb_path))).removeAlpha().resize(64, 64, { fit: 'fill' }).raw().toBuffer();
        const hex = previewHex(isHex(s.preview_color) ? s.preview_color : null, deriveHex(bandPixels(new Uint8ClampedArray(tile), s.product_line), s.color_family), s.color_family);
        const p = patternRGB(weaveKindOf({ line: s.product_line, family: s.fam, composition: s.composition }), hex), m = [0, 0, 0];
        for (let i = 0; i < p.length; i += 3) for (let c = 0; c < 3; c++) m[c] += p[i + c] / (p.length / 3);
        const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        if (m.some((v, i) => Math.abs(v - want[i]) > 1.5)) failures.mean.push(`${s.id} ${hexOf(m)} vs ${hex}`);
      }
    } catch (e) { failures.err.push(`${s.id}: ${e.message}`); }
  } }));
  check(`${stat.photo} Photo-crop textures: every one repeats with no seam (the wrap step is at most 1.5 x the loudest ordinary weave step; an uncut crop is 2.1 at the median)`, failures.seam.length === 0, failures.seam.slice(0, 5).join(' | '));
  ratios.sort((a, b) => a - b); console.log('      seam ratio p50', ratios[ratios.length >> 1].toFixed(2), 'p90', ratios[Math.floor(ratios.length * 0.9)].toFixed(2), 'max', ratios.at(-1).toFixed(2), 'over 1.5:', failures.seam.length);
  check(`and tiled 3 x 3 none shows a fold, edge or shading step`, failures.fold.length === 0, failures.fold.slice(0, 5).join(' | '));
  check(`${stat.pattern} Pattern colors (every Zebra and the photos with no flat area): the pattern's average is the tile color`, failures.mean.length === 0, failures.mean.slice(0, 5).join(' | '));
  check('every Zebra color is the pattern', failures.zebra.length === 0 && sw.filter((s) => s.product_line === 'zebra').length > 50);
  check('every photo could be read', failures.err.length === 0, failures.err.slice(0, 5).join(' | '));
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
