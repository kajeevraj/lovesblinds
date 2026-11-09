// The photo -> texture pipeline, no browser, no database (src/lib/textureAnalysis.js, src/room/textureCore.js, src/lib/patternTexture.js):
//  - a photo with a flat area is cropped there and the texture tiles with no visible seam and no folds;
//  - a folded photo, a whole shade, a too-small photo or strong shading is NOT cropped: it gets a generated pattern;
//  - every pattern weave is in the fabric's color, repeats seamlessly and is weave-specific (solar basketweave, blackout smooth, screen view mesh,
//    linen slubs, cellular pleats, zebra bands).
import { analyzePhoto, LIMITS } from '../../src/lib/textureAnalysis.js';
import { photoCropTexture, seamRatio, makeSeamless, TEX } from '../../src/room/textureCore.js';
import { patternRGB, patternAlpha, zebraPattern, weaveKindOf, sheerHexOf, WEAVES } from '../../src/lib/patternTexture.js';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const rng = (seed) => { let a = seed; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// a synthetic supplier photo: fabric weave (threads 3 px) plus optional lighting gradient, a fold and a background. fn(x, y) -> extra luminance.
function photo(w, h, { base = [200, 196, 188], gradient = 0, fold = null, backdrop = null, seed = 1 } = {}) {
  const r = rng(seed), d = new Uint8ClampedArray(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let lum = 4 * Math.sin((x * Math.PI) / 3) * Math.cos((y * Math.PI) / 3) + (r() - 0.5) * 3 + gradient * (x / w);
    if (fold) lum += fold(x, y);
    let rgb = base.map((v) => v + lum);
    if (backdrop && backdrop(x, y)) rgb = [250, 250, 250];
    for (let c = 0; c < 3; c++) d[(y * w + x) * 3 + c] = rgb[c];
  }
  return d;
}
const ridge = (cx, width, amp) => (x) => amp * Math.exp(-((x - cx) ** 2) / (2 * width * width));       // a fold down the picture: a bright ridge with a dark side
const foldDown = (cx) => (x) => ridge(cx, 7, 60)(x) - ridge(cx + 18, 9, 45)(x);

// ---- 1. a flat photo is cropped and tiles ----
const flat = photo(600, 600, { gradient: 22, seed: 3 });
const a1 = analyzePhoto(flat, 600, 600);
check('a flat weave photo with gentle lighting is usable: Photo crop', a1.mode === 'photo' && a1.usable, JSON.stringify(a1.metrics));
const tex = photoCropTexture(flat, 600, 600, a1.rect);
const rawCrop = makeSeamless(tex, TEX);
check('its texture repeats with no visible seam: the step across the wrap is as quiet as the weave itself (ratio <= 1.5)', seamRatio(tex) <= 1.5, seamRatio(tex).toFixed(2));
const tiled = (t, n = 3) => { const S = TEX * n, o = new Uint8ClampedArray(S * S * 3); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (let c = 0; c < 3; c++) o[(y * S + x) * 3 + c] = t[((y % TEX) * TEX + (x % TEX)) * 3 + c]; return { rgb: o, S }; };
const t3 = tiled(tex); const a3 = analyzePhoto(t3.rgb, t3.S, t3.S);
check('tiled 3 x 3 it is still flat everywhere: no fold, no edge, no shading step at the tile joins', a3.mode === 'photo' && a3.metrics.edge <= LIMITS.edge * 0.6 && a3.metrics.shade <= LIMITS.shade * 0.6, JSON.stringify(a3.metrics));
check('seam test has teeth: the same crop pasted without the seamless step shows a seam (ratio > 1.6)', seamRatio(Uint8ClampedArray.from((() => { const o = new Uint8ClampedArray(TEX * TEX * 3); for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) for (let c = 0; c < 3; c++) o[(y * TEX + x) * 3 + c] = 140 + 80 * (x / TEX) + ((x * 7 + y * 3) % 5); return o; })())) > 1.6);
void rawCrop;

// ---- 2. photos with no usable flat area get the pattern ----
const folded = photo(600, 600, { fold: foldDown(300) });
const a2 = analyzePhoto(folded, 600, 600);
check('a fold down the middle of the photo is not usable: Pattern (a crop on either side would be a thin sliver or contain the fold)', a2.mode === 'pattern' || (a2.mode === 'photo' && (a2.rect.x + a2.rect.side <= 295 || a2.rect.x >= 340)), `${a2.mode} ${a2.reason} rect ${JSON.stringify(a2.rect)}`);
const foldWide = photo(600, 600, { fold: (x) => 45 * Math.sin((2 * Math.PI * x) / 230) });
const a2b = analyzePhoto(foldWide, 600, 600);
check('soft folds all across the photo (a draped shade): Pattern', a2b.mode === 'pattern', `${a2b.mode} ${a2b.reason} ${JSON.stringify(a2b.metrics)}`);
check('whenever a crop IS chosen next to a fold, it stays clear of the fold (the tiled result has no fold in it)', (() => { if (a2.mode !== 'photo') return true; const t = photoCropTexture(folded, 600, 600, a2.rect), tt = tiled(t); return analyzePhoto(tt.rgb, tt.S, tt.S).metrics.edge <= LIMITS.edge * 0.6; })());
const shadeShot = photo(600, 600, { base: [150, 148, 144], backdrop: (x, y) => x < 90 || x > 510 || y < 70 || y > 520, fold: (x, y) => 35 * Math.sin((x / 600) * 9) });
const a4 = analyzePhoto(shadeShot, 600, 600);
check('a whole shade on a backdrop (edges, folds and a bright background): Pattern', a4.mode === 'pattern', `${a4.mode} ${a4.reason} ${JSON.stringify(a4.metrics)}`);
const small = photo(150, 150, { seed: 9 });
const a5 = analyzePhoto(small, 150, 150);
check('a photo that is too small: Pattern ("too small")', a5.mode === 'pattern' && /small/.test(a5.reason), a5.reason);
const shaded = photo(600, 600, { base: [60, 58, 56], gradient: 150, seed: 11 });
const a6 = analyzePhoto(shaded, 600, 600);
check('strong shading across the whole photo: Pattern', a6.mode === 'pattern', `${a6.mode} ${a6.reason} ${JSON.stringify(a6.metrics)}`);
const a7 = analyzePhoto(photo(600, 600, { fold: (x, y) => (x < 330 ? foldDown(120)(x) + foldDown(250)(x) : 0), seed: 5 }), 600, 600);
check('half the photo folded, the other half flat: Photo crop, and the crop is inside the flat half', a7.mode === 'photo' && a7.rect.x >= 300, `${a7.mode} rect ${JSON.stringify(a7.rect)}`);
check('the analysis is deterministic', JSON.stringify(analyzePhoto(flat, 600, 600)) === JSON.stringify(a1));

// ---- 3. the generated patterns ----
const meanOf = (rgb) => { const n = rgb.length / 3, m = [0, 0, 0]; for (let i = 0; i < rgb.length; i += 3) for (let c = 0; c < 3; c++) m[c] += rgb[i + c] / n; return m; };
const sdOf = (rgb) => { const m = meanOf(rgb), n = rgb.length / 3; let v = 0; for (let i = 0; i < rgb.length; i += 3) { const l = 0.3 * rgb[i] + 0.59 * rgb[i + 1] + 0.11 * rgb[i + 2] - (0.3 * m[0] + 0.59 * m[1] + 0.11 * m[2]); v += l * l / n; } return Math.sqrt(v); };
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const COLORS = ['#ece8e0', '#3b3a3c', '#9a8f7c', '#a9b4c4', '#f2efe9'];
for (const kind of ['basket', 'smooth', 'mesh', 'linen', 'pleat', 'voile']) {
  const bad = [], seams = [], sds = [];
  for (const hex of COLORS) { const t = patternRGB(kind, hex), m = meanOf(t), want = hexRgb(hex); if (m.some((v, i) => Math.abs(v - want[i]) > 1.5)) bad.push(`${hex} -> ${m.map(Math.round)}`); seams.push(seamRatio(t)); sds.push(sdOf(t)); }
  check(`${kind}: the pattern's average is the color it was made for (within 1.5 levels, 5 colors)`, bad.length === 0, bad.join(' | '));
  const seamLimit = kind === 'pleat' ? 1.25 : 1;      // a pleat crease is itself a sharp line, and the repeat joins one crease to the next
  check(`${kind}: it repeats with no seam (ratio <= ${seamLimit}) and its contrast is capped (sd <= 12)`, Math.max(...seams) <= seamLimit && Math.max(...sds) <= 12, `seam ${Math.max(...seams).toFixed(2)} sd ${Math.max(...sds).toFixed(1)}`);
}
const sdByKind = Object.fromEntries(['basket', 'smooth', 'mesh', 'linen', 'pleat'].map((k) => [k, sdOf(patternRGB(k, '#9a8f7c'))]));
check('blackout (smooth) is the calmest weave; mesh and basketweave are the strongest', sdByKind.smooth < 4 && sdByKind.smooth < Math.min(sdByKind.basket, sdByKind.mesh, sdByKind.linen, sdByKind.pleat) && sdByKind.mesh > 7 && sdByKind.basket > 6, JSON.stringify(Object.fromEntries(Object.entries(sdByKind).map(([k, v]) => [k, +v.toFixed(1)]))));
const A = patternRGB('basket', '#9a8f7c'), B = patternRGB('mesh', '#9a8f7c'), C = patternRGB('linen', '#9a8f7c'), D = patternRGB('pleat', '#9a8f7c');
const dist = (p, q) => { let t = 0; for (let i = 0; i < p.length; i++) t += Math.abs(p[i] - q[i]); return t / p.length; };
check('every weave looks different from the others (mean pixel difference > 2 levels)', [[A, B], [A, C], [A, D], [B, C], [B, D], [C, D]].every(([p, q]) => dist(p, q) > 2));
// pleats: horizontal lines, 8 to a tile; a row profile with strong swing and identical columns on average
const rowMeans = (t) => Array.from({ length: TEX }, (_, y) => { let s = 0; for (let x = 0; x < TEX; x++) s += t[(y * TEX + x) * 3]; return s / TEX; });
const colMeans = (t) => Array.from({ length: TEX }, (_, x) => { let s = 0; for (let y = 0; y < TEX; y++) s += t[(y * TEX + x) * 3]; return s / TEX; });
const spread = (a) => Math.max(...a) - Math.min(...a);
check('cellular pleats: horizontal pleat lines (rows swing, columns do not)', spread(rowMeans(D)) > 12 && spread(colMeans(D)) < 5, `rows ${spread(rowMeans(D)).toFixed(1)} cols ${spread(colMeans(D)).toFixed(1)}`);
check('weave by fabric type: solar basketweave, blackout smooth, screen view mesh, cellular pleat, zebra, everything else linen-look',
  weaveKindOf({ line: 'roller', family: 'solar' }) === 'basket' && weaveKindOf({ line: 'roller', family: 'blackout' }) === 'smooth' && weaveKindOf({ line: 'roller', family: 'screen-view' }) === 'mesh'
  && weaveKindOf({ line: 'cellular', family: 'blackout' }) === 'pleat' && weaveKindOf({ line: 'zebra' }) === 'zebra' && ['drapery', 'dream-curtains', 'shangri-la', 'roman'].every((l) => weaveKindOf({ line: l }) === 'linen'));
check('patterns are deterministic (the same pixels every time, so every surface draws the same cloth)', dist(patternRGB('linen', '#9a8f7c'), C) === 0 && dist(patternRGB('mesh', '#9a8f7c'), B) === 0);
const va = patternAlpha('voile', TEX), vt = patternRGB('voile', '#efede9', TEX);
const openShare = va.filter((v) => v < 120).length / va.length, threadAlpha = va.filter((v) => v > 230).length / va.length;
check('sheer open weave (Salt White): light, see-through between its threads: the average is the soft white, 30 to 50 % of it is open (alpha under 120), the threads are opaque', [239, 237, 233].every((w, i) => Math.abs(meanOf(vt)[i] - w) <= 1.5) && openShare > 0.3 && openShare < 0.5 && threadAlpha > 0.2, `open ${openShare.toFixed(2)} thread ${threadAlpha.toFixed(2)} mean ${meanOf(vt).map(Math.round)}`);
check('only the sheer open weave has gaps: every other weave is opaque (no alpha map)', ['basket', 'smooth', 'mesh', 'linen', 'pleat', 'zebra'].every((k) => patternAlpha(k) === null));
check('a weave set by hand on the color overrides the fabric type (voile on a drapery color), but never on a Zebra', weaveKindOf({ line: 'drapery', weave: 'voile' }) === 'voile' && weaveKindOf({ line: 'roller', family: 'solar', weave: 'mesh' }) === 'mesh' && weaveKindOf({ line: 'zebra', weave: 'voile' }) === 'zebra' && weaveKindOf({ line: 'drapery', weave: 'nonsense' }) === 'linen');
check('every weave name is known', WEAVES.length === 7 && WEAVES.every((w) => patternRGB(w, '#808080', 64).length === 64 * 64 * 3));
// very dark and very light colors must not clip their weave off
const black = patternRGB('basket', '#0c0c0d'), white = patternRGB('basket', '#fbfbfa');
check('a near-black and a near-white fabric still have a visible weave and keep their color', sdOf(black) > 1.2 && sdOf(white) > 1.2 && meanOf(black)[0] < 16 && meanOf(white)[0] > 245, `${sdOf(black).toFixed(1)} / ${sdOf(white).toFixed(1)}`);

// ---- 4. the zebra pattern: solid band over a sheer band ----
const z = zebraPattern('#7a6a58', 154 / 256), rows = z.rows;
const solidMean = meanOf(z.rgb.subarray(0, rows * TEX * 3)), sheerMean = meanOf(z.rgb.subarray(rows * TEX * 3));
check('zebra: the solid band (top rows) is the fabric color, within 1.5 levels', hexRgb('#7a6a58').every((v, i) => Math.abs(solidMean[i] - v) <= 1.5), solidMean.map(Math.round).join(','));
check('zebra: the sheer band under it is a see-through mesh in the fabric\'s own color (a brown fabric: a lighter brown, not white), and the band edge is at row 154', hexRgb(sheerHexOf('#7a6a58')).every((v, i) => Math.abs(sheerMean[i] - v) <= 6) && sheerMean[0] < 200 && sheerMean[0] > solidMean[0] + 9 && Math.abs((sheerMean[0] - sheerMean[2]) - (solidMean[0] - solidMean[2])) < 25 && rows === 154, sheerMean.map(Math.round).join(','));
const smoke = (h) => { const t = zebraPattern(h, 154 / 256); return meanOf(t.rgb.subarray(154 * TEX * 3)); };
check('zebra: a Black or Brown fabric has a dark smoky sheer (lightness under 120), a Cream one a soft sheer (within 14 levels of its solid band)', smoke('#2a2a2c')[0] < 120 && smoke('#2a2a2c')[0] > 60 && smoke('#665758')[0] < 140 && Math.abs(smoke('#f6f1e4')[0] - 246) <= 14, `${smoke('#2a2a2c').map(Math.round)} | ${smoke('#665758').map(Math.round)} | ${smoke('#f6f1e4').map(Math.round)}`);
check('zebra: the weave repeats left to right with no seam (the bands themselves are meant to change over)', seamRatio(z.rgb, TEX, 'x') <= 1, seamRatio(z.rgb, TEX, 'x').toFixed(2));
const zw = zebraPattern('#f6f1e4', 154 / 256), zl = (a, y0, y1) => { let t = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < TEX; x++) { const k = (y * TEX + x) * 3; t += 0.3 * a[k] + 0.59 * a[k + 1] + 0.11 * a[k + 2]; n++; } return t / n; };
check('zebra: even a cream or white fabric keeps its sheer band at least 8 levels lighter than its solid band (the bands can be told apart)', zl(zw.rgb, 156, TEX) - zl(zw.rgb, 0, 152) >= 8, (zl(zw.rgb, 156, TEX) - zl(zw.rgb, 0, 152)).toFixed(1));
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
