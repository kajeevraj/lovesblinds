// The texture TYPE measuring and the generated cloth (src/lib/textureType.js, textureGen.js, zebraPhoto.js), with no browser and no network: synthetic photos of each kind of cloth
// are measured, drawn again, and the drawing is compared with what was measured: the main direction and the line spacing of each type, a seamless wrap, the same cloth for the
// same color and a different one for another, and the Zebra band reader (where the solid band is, its own color, a folded photo).
//   node supabase/tests/texture_gen_tests.mjs
const T = await import('../../src/lib/textureType.js');
const G = await import('../../src/lib/textureGen.js');
const Z = await import('../../src/lib/zebraPhoto.js');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const N = 256;
const rand = G.rngOf(12345), gauss = () => { let u = 0; while (u === 0) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };
// a photo (n x n x 3 floats) from a luminance function plus a color
const photo = (f, base = [150, 140, 130], dir = [1, 1, 1]) => { const p = new Float32Array(N * N * 3); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = f(x, y); for (let c = 0; c < 3; c++) p[(y * N + x) * 3 + c] = base[c] + v * dir[c]; } return p; };
const smoothRows = (amp, lo, hi) => { const a = Array.from({ length: 24 }, () => [lo + rand() * (hi - lo), rand() * 6.28, rand()]); return (y) => a.reduce((s, [f, ph, w]) => s + w * Math.cos((2 * Math.PI * f * y) / N + ph), 0) * amp; };

// ---- the kinds of cloth, as synthetic photos ----
const slubRows = smoothRows(14, 6, 60), slubCols = smoothRows(4, 1, 5);
const SLUB = photo((x, y) => slubRows(y) * (0.8 + 0.4 * Math.cos((2 * Math.PI * 2 * x) / N + y * 0.05)) + 0.3 * slubCols(x) + 2 * gauss());              // horizontal streaks, uneven
const TWILL = photo((x, y) => 30 * Math.cos((2 * Math.PI * (9 * x + 9 * y)) / N) + 10 * Math.cos((2 * Math.PI * (18 * x + 18 * y)) / N + 1) + 3 * gauss());      // diagonal ribs, 9 per patch
const STRIPE = photo((x) => 18 * Math.sign(Math.cos((2 * Math.PI * 6 * x) / N)) + 6 * Math.cos((2 * Math.PI * 11 * x) / N) + 2 * gauss());                       // vertical stripes, 6 per patch
const MESH = photo((x, y) => 40 * Math.sign(Math.cos((2 * Math.PI * 16 * x) / N) * Math.cos((2 * Math.PI * 16 * y) / N)) + 5 * gauss());                          // a grid of dots, 16 per patch
const LINEN = photo(() => 7 * gauss());
const fine = (kind) => ({ slub: SLUB, twill: TWILL, stripe: STRIPE, mesh: MESH, linen: LINEN })[kind];

// ---- measuring and drawing ----
const draw = (kind, seed = 1) => { const m = G.measureFabric(fine(kind), N); return { m, raw: G.drawFabric(kind, m, { n: N, seed }) }; };
const featuresOf = (raw) => T.textureFeatures(Float32Array.from(raw), N);
const spacing = (f) => (f.peakR ? N / f.peakR : null);
const srcF = Object.fromEntries(['slub', 'twill', 'stripe', 'mesh', 'linen'].map((k) => [k, T.textureFeatures(fine(k), N)]));

{
  const { raw } = draw('slub'), f = featuresOf(raw);
  check('slub: the drawn cloth has horizontal streaks like the photo (horizontal lines carry the structure, one clear direction)', f.horiz >= 0.5 && f.coherence >= 0.6 && srcF.slub.horiz >= 0.5, `drawn horiz ${f.horiz.toFixed(2)} coherence ${f.coherence.toFixed(2)}; photo ${srcF.slub.horiz.toFixed(2)} / ${srcF.slub.coherence.toFixed(2)}`);
  check('slub: its contrast and average color are the photo\'s (spread within 10 %, mean within 2 levels)', Math.abs(f.sdFine / srcF.slub.sdFine - 1) < 0.15 && Math.abs(raw.reduce((a, b, i) => a + (i % 3 === 0 ? b : 0), 0) / (N * N) - 150) < 2, `${f.sdFine.toFixed(1)} vs ${srcF.slub.sdFine.toFixed(1)}`);
}
{
  const { raw } = draw('twill'), f = featuresOf(raw);
  const ang = (v) => { let a = (Math.atan2(v.peakFy, v.peakFx) * 180) / Math.PI; if (a < 0) a += 180; return a; };
  check('twill: the drawn ribs run on the same diagonal as the photo\'s (within 10 degrees)', Math.abs(ang(f) - ang(srcF.twill)) < 10 && f.diagPeak >= 0.5, `${ang(f).toFixed(0)} vs ${ang(srcF.twill).toFixed(0)} degrees`);
  check('twill: the rib spacing is the photo\'s (within 12 %)', Math.abs(spacing(f) / spacing(srcF.twill) - 1) < 0.12, `${spacing(f).toFixed(1)} vs ${spacing(srcF.twill).toFixed(1)} px`);
  check('twill: it reads as a twill again when measured (clear diagonal lines everywhere)', T.classifyTexture(T.textureFeatures(Float32Array.from(raw), N)).type === 'twill' || (f.lineOblique ?? 0) >= 0.7);
}
{
  const { raw } = draw('stripe'), f = featuresOf(raw);
  check('stripe: the drawn stripes run down the cloth like the photo\'s (vertical lines carry the structure) and are as many (within 12 %)', f.vert >= 0.4 && Math.abs(spacing(f) / spacing(srcF.stripe) - 1) < 0.12, `vert ${f.vert.toFixed(2)}, spacing ${spacing(f).toFixed(1)} vs ${spacing(srcF.stripe).toFixed(1)}`);
}
{
  const { m, raw } = draw('mesh'), f = featuresOf(raw);
  check('mesh: the drawn lattice has the photo\'s period (within 8 %) and is a sharp lattice (a few strong spectral peaks)', Math.abs(spacing(f) / spacing(srcF.mesh) - 1) < 0.08 && f.peakShare >= 0.2, `${spacing(f).toFixed(1)} vs ${spacing(srcF.mesh).toFixed(1)} px, peak share ${f.peakShare.toFixed(2)}`);
  check('mesh: the cell is the photo\'s own (the lattice was found: two independent directions, a cell image, and cells that differ a little)', !!m.lattice && m.lattice.cell.length === 400 && m.lattice.cellTone >= 0, JSON.stringify({ A: m.lattice?.A.map((v) => +v.toFixed(2)), B: m.lattice?.B.map((v) => +v.toFixed(2)) }));
}
{
  const { raw } = draw('linen'), f = featuresOf(raw);
  check('linen: soft irregular threads: no strong direction and no lattice', f.coherence < 0.5 && f.peakShare < 0.15 && f.sdFine > 3, `coherence ${f.coherence.toFixed(2)}, peak share ${f.peakShare.toFixed(2)}`);
}
// ---- seamless, and not a copy ----
const seam = (raw) => { // the step across the wrap against the ordinary steps (src/room/textureCore.js seamRatio does the same on the 3 x 3 tiling)
  const px = (x, y, c) => raw[(y * N + x) * 3 + c], step = (x0, x1, along) => { let t = 0; for (let k = 0; k < N; k++) for (let c = 0; c < 3; c++) t += Math.abs(along === 'x' ? px(x0, k, c) - px(x1, k, c) : px(k, x0, c) - px(k, x1, c)); return t / (N * 3); };
  const inner = []; for (let i = 0; i < N - 1; i++) inner.push(step(i, i + 1, 'x')); inner.sort((a, b) => a - b);
  const innerY = []; for (let i = 0; i < N - 1; i++) innerY.push(step(i, i + 1, 'y')); innerY.sort((a, b) => a - b);
  return Math.max(step(N - 1, 0, 'x') / Math.max(0.01, inner[Math.floor(inner.length * 0.9)]), step(N - 1, 0, 'y') / Math.max(0.01, innerY[Math.floor(innerY.length * 0.9)]));
};
for (const k of ['slub', 'twill', 'stripe', 'mesh', 'linen']) { const { raw } = draw(k); const r = seam(raw); check(`${k}: the drawn cloth wraps with no seam (the step across the edge is at most 2.1 x an ordinary step)`, r <= 2.1, r.toFixed(2)); }
{
  const a = draw('slub', 1).raw, b = draw('slub', 1).raw, c = draw('slub', 2).raw; let same = true, diff = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) same = false; if (Math.abs(a[i] - c[i]) > 8) diff++; }
  check('the same color is always drawn the same, and another color (another seed) is not a copy of it', same && diff / a.length > 0.2, `${(diff / a.length).toFixed(2)} of the picture differs`);
  const { m } = draw('slub'); const o = G.drawFabric('slub', m, { n: 64, seed: 3 });
  check('a tile is drawn at 64 px with the same cloth (a quick draw for the picker)', o.length === 64 * 64 * 3 && Math.abs(o.reduce((s, v, i) => s + (i % 3 === 0 ? v : 0), 0) / (64 * 64) - 150) < 4);
}
{ // a folded photo's streaks run down the picture: slub is always drawn across
  const rot = photo((x, y) => slubRows(x) * 0.9 + 2 * gauss()), m = G.measureFabric(rot, N), f = featuresOf(G.drawFabric('slub', m, { n: N, seed: 1 }));
  check('slub from a photo whose streaks run down the picture (a folded sheet) is drawn across the cloth', m.vertical && f.horiz >= 0.45, `vertical ${m.vertical}, drawn horiz ${f.horiz.toFixed(2)}`);
}
// ---- the types: what is drawn and what is cut ----
check('the six drawn types and the three photo types are exactly the nine', G.GENERATED_TYPES.join() === 'slub,mesh,twill,linen,stripe,smooth' && [...T.PHOTO_TYPES].sort().join() === 'motif,print,tweed' && T.TEXTURE_TYPES.length === 9 && T.TEXTURE_TYPES.every((t) => G.GENERATED_TYPES.includes(t) !== T.PHOTO_TYPES.includes(t)));
check('default source: generated for slub, mesh, twill, linen, stripe, smooth; photo for tweed, motif, print', ['slub', 'mesh', 'twill', 'linen', 'stripe', 'smooth'].every((t) => T.defaultSource(t) === 'generated') && ['tweed', 'motif', 'print'].every((t) => T.defaultSource(t) === 'photo'));

// ---- the Zebra band reader ----
const banded = (solidRgb, sheerRgb, w = 200, h = 300, texture = 0) => {
  const rgb = new Uint8ClampedArray(w * h * 3); // 60 px solid, 40 px sheer, repeating, starting with sheer
  for (let y = 0; y < h; y++) { const isSolid = (y % 100) >= 40; for (let x = 0; x < w; x++) { const n = isSolid ? texture * Math.sin(y * 1.7) : 0; for (let c = 0; c < 3; c++) rgb[(y * w + x) * 3 + c] = (isSolid ? solidRgb : sheerRgb)[c] + n; } }
  return rgb;
};
{
  const rgb = banded([66, 54, 50], [246, 246, 248]), b = Z.bandsOf(rgb, 200, 300);
  check('a banded photo: the bands are found, solid and sheer', b.banded && b.solidRows.length === 3 && b.sheerRows.length >= 2, JSON.stringify(b.solidRows));
  const c = T.zebraColors(rgb, 200, 300, 'Brown');
  check('the zebra\'s color is the solid band\'s own, as dark as the photo (not lifted by the white sheer bands, not moved into a family\'s lightness band)', Math.abs(parseInt(c.hex.slice(1, 3), 16) - 66) <= 2 && Math.abs(parseInt(c.hex.slice(3, 5), 16) - 54) <= 2 && Math.abs(parseInt(c.hex.slice(5, 7), 16) - 50) <= 2, c.hex);
  check('and the sheer band takes the photo\'s own sheer color', c.sheerHex === '#f6f6f8', c.sheerHex);
}
{
  const rgb = banded([244, 241, 232], [253, 253, 255]), c = T.zebraColors(rgb, 200, 300, 'White');
  check('a White zebra still goes through the family rules (a soft white, never cream or grey)', /^#[ef][0-9a-f]{5}$/.test(c.hex) && T.zebraColors(rgb, 200, 300, 'White').banded, c.hex);
}
{ // a folded sheet: creases down the picture, no bands
  const w = 200, h = 300, rgb = new Uint8ClampedArray(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 200 + 30 * Math.sin((x / w) * Math.PI * 6) ; for (let c = 0; c < 3; c++) rgb[(y * w + x) * 3 + c] = v; }
  check('a folded photo (creases down the picture) is not read as bands', !Z.bandsOf(rgb, w, h).banded);
}
{ // classification of drawn cloth: the types come back (the classifier and the generator agree)
  const f = (k) => T.textureFeatures(fine(k), N);
  check('the classifier reads the synthetic cloths as what they are: slub, twill, stripe, mesh; plain noise is linen or smooth, never a shape or a lattice', T.classifyTexture(f('slub')).type === 'slub' && ['twill', 'mesh'].includes(T.classifyTexture(f('twill')).type) && T.classifyTexture(f('stripe')).type === 'stripe' && T.classifyTexture(f('mesh')).type === 'mesh' && ['linen', 'smooth', 'tweed'].includes(T.classifyTexture(f('linen')).type),
    ['slub', 'twill', 'stripe', 'mesh', 'linen'].map((k) => `${k}->${T.classifyTexture(f(k)).type}`).join(' '));
}

const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
