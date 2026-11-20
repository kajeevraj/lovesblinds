// Draws a fabric texture instead of cutting one out of the photo, tuned to the photo it stands for. Pure functions on arrays (no DOM, no sharp): the picker tile, the
// "This blind" chip, the 3D shade, the admin preview, the review sheet and the tests all draw the same cloth.
//
//   const m = measureFabric(patch, n);                 // patch: n x n x 3 floats (resamplePatch of the photo's fabric)  ->  what this cloth is like
//   const raw = drawFabric(type, m, { n, seed });      // -> n x n x 3 bytes: the cloth with the photo's own average color, contrast and thread colors
//
// The result is a "raw" picture exactly like a photo crop: src/room/textureBrowser.js hands it to retargetWeave (the color the tile shows, the weave-strength rules and the
// calibrated light) so a generated cloth lands on its tile color the same way a photo crop does.
//
// Two ways of drawing, by what kind of cloth it is:
//   * irregular cloth (slub streaks, linen, smooth, and anything else that is not a regular weave): SPECTRAL SYNTHESIS. The photo's own power spectrum (how much
//     structure there is at each size and in each direction: long horizontal streaks, soft threads both ways, nothing) is kept, with new random phases, so the
//     result has the same grain and no copy of the photo in it; its light-and-dark mix is then set to the photo's (a mostly dark cloth with a few bright slubs stays
//     that). It repeats seamlessly (it is made on a wrapped grid) and has no regular structure that could show as a repeat grid.
//   * regular cloth (mesh or basketweave, twill, vertical stripe): a LATTICE drawn from the photo's measured period, direction and contrast, with a little natural
//     irregularity (thread-by-thread differences in thickness and tone) that is never the same twice.
import { blur } from '../room/textureCore.js';
import { fft2, N as NDEFAULT } from './textureType.js';

export const GENERATED_TYPES = ['slub', 'mesh', 'twill', 'linen', 'stripe', 'smooth'];

// a seeded random number generator (mulberry32) and a gaussian from it
export function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const seedOf = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const gauss = (rand) => { let u = 0, v = 0; while (u === 0) u = rand(); v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

const lumaArr = (rgb) => { const n = rgb.length / 3, g = new Float32Array(n); for (let i = 0, j = 0; i < n; i++, j += 3) g[i] = 0.3 * rgb[j] + 0.59 * rgb[j + 1] + 0.11 * rgb[j + 2]; return g; };

// ---- what the cloth is like ---------------------------------------------------------------------------------------------------------------------------------
// -> { n, mean [r,g,b], sd (luminance, after the plain lighting is taken out), colorDir [r,g,b] (the change in each channel per unit of luminance), quant (the photo's
//      light-and-dark mix: 65 quantiles of its normalized luminance), amp (the amplitude spectrum, n x n), peaks (the sharpest spectral peaks: { fx, fy, v }),
//      period (px of the strongest repeat, or null), colProfile (the average down each column, for stripes), vertical (the structure runs down the picture) }
export function measureFabric(patch, n = NDEFAULT) {
  const G = lumaArr(patch), low = blur(G, n, n, 1, Math.max(3, Math.round(n / 18)), false), fine = new Float32Array(n * n);
  let sum = 0; for (let i = 0; i < fine.length; i++) { fine[i] = G[i] - low[i]; sum += fine[i]; }
  const mf = sum / fine.length; let v = 0; for (let i = 0; i < fine.length; i++) { fine[i] -= mf; v += fine[i] * fine[i]; }
  const sd = Math.sqrt(v / fine.length) || 1e-6;
  const mean = [0, 0, 0]; for (let i = 0; i < patch.length; i += 3) { mean[0] += patch[i]; mean[1] += patch[i + 1]; mean[2] += patch[i + 2]; } for (let c = 0; c < 3; c++) mean[c] /= n * n;
  // the color of the light and dark threads: each channel's slope against the luminance
  const colorDir = [0, 0, 0], gm = G.reduce((a, b) => a + b, 0) / G.length; let gv = 0; for (const x of G) gv += (x - gm) ** 2;
  for (let c = 0; c < 3; c++) { let cov = 0; for (let i = 0; i < G.length; i++) cov += (patch[i * 3 + c] - mean[c]) * (G[i] - gm); colorDir[c] = gv > 1e-6 ? cov / gv : 1; }
  const wsum = 0.3 * colorDir[0] + 0.59 * colorDir[1] + 0.11 * colorDir[2] || 1; for (let c = 0; c < 3; c++) colorDir[c] = Math.max(0, Math.min(3, colorDir[c] / wsum));
  // the light-and-dark mix, as quantiles of the standardized fine luminance
  const z = Float32Array.from(fine, (x) => x / sd).sort(), quant = new Float32Array(65); for (let q = 0; q <= 64; q++) quant[q] = z[Math.min(z.length - 1, Math.round((q / 64) * (z.length - 1)))];
  // the amplitude spectrum (Hann window so the edges do not ring), lightly smoothed
  const re = new Float64Array(n * n), im = new Float64Array(n * n);
  for (let y = 0; y < n; y++) { const wy = 0.5 - 0.5 * Math.cos((2 * Math.PI * (y + 0.5)) / n); for (let x = 0; x < n; x++) re[y * n + x] = fine[y * n + x] * wy * (0.5 - 0.5 * Math.cos((2 * Math.PI * (x + 0.5)) / n)); }
  fft2(re, im, n);
  const amp0 = new Float32Array(n * n); for (let i = 0; i < amp0.length; i++) amp0[i] = Math.hypot(re[i], im[i]);
  const amp = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let t = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t += amp0[((y + dy + n) % n) * n + ((x + dx + n) % n)] * (dx || dy ? 1 : 2); amp[y * n + x] = t / 10; }
  amp[0] = 0;
  // spectral peaks: the strongest points that stand clear of their surroundings (half the plane)
  const peaks = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const fx = x <= n / 2 ? x : x - n, fy = y <= n / 2 ? y : y - n; if (Math.hypot(fx, fy) < 2.5 || fy < 0 || (fy === 0 && fx < 0)) continue;
    const a = amp0[y * n + x]; let isMax = true;
    for (let dy = -2; dy <= 2 && isMax; dy++) for (let dx = -2; dx <= 2; dx++) { if ((dx || dy) && amp0[((y + dy + n) % n) * n + ((x + dx + n) % n)] > a) { isMax = false; break; } }
    if (isMax) peaks.push({ fx, fy, v: a });
  }
  peaks.sort((a, b) => b.v - a.v);
  // the position of a peak to a fraction of a bin (a parabola through it and its two neighbours, on each axis)
  const at = (x, y) => amp0[((y + n) % n) * n + ((x + n) % n)];
  for (const p of peaks.slice(0, 12)) {
    const x = (p.fx + n) % n, y = (p.fy + n) % n, c = at(x, y);
    const dx = (at(x - 1, y) - 2 * c + at(x + 1, y)), dy = (at(x, y - 1) - 2 * c + at(x, y + 1));
    p.rx = p.fx + (dx ? Math.max(-0.5, Math.min(0.5, (0.5 * (at(x - 1, y) - at(x + 1, y))) / dx)) : 0); p.ry = p.fy + (dy ? Math.max(-0.5, Math.min(0.5, (0.5 * (at(x, y - 1) - at(x, y + 1))) / dy)) : 0);
  }
  const top = peaks[0], period = top ? n / Math.hypot(top.fx, top.fy) : null;
  // the average down each column (stripes) and along each row, and which way the structure runs
  const colProfile = new Float32Array(n), rowProfile = new Float32Array(n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { colProfile[x] += fine[y * n + x] / n; rowProfile[y] += fine[y * n + x] / n; }
  const sdOf = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
  const lattice = latticeOf(fine, sd, peaks, n);
  return { n, mean, sd, colorDir, quant, amp, peaks: peaks.slice(0, 12), period, lattice, colProfile, rowProfile, rowEnergy: sdOf(rowProfile) / sd, colEnergy: sdOf(colProfile) / sd, vertical: sdOf(colProfile) > sdOf(rowProfile) * 1.5 };
}

// ---- spectral synthesis ------------------------------------------------------------------------------------------------------------------------------------
// New random phases on the photo's amplitude spectrum, then the photo's light-and-dark mix. `transpose`: swap the two directions (a folded photo shows streaks running
// down the picture; on the shade they run across it). Returns zero-mean, unit-spread floats.
export function synthesize(m, { n = m.n, seed = 1, transpose = false, tame = 1 } = {}) {
  const rand = rngOf(seed), re = new Float64Array(n * n), im = new Float64Array(n * n);
  for (let i = 0; i < re.length; i++) re[i] = gauss(rand);
  fft2(re, im, n);
  const A = m.amp, ratio = m.n / n;                                  // (a spectrum measured at another size is read at the matching frequencies)
  let norm = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const fx = x <= n / 2 ? x : x - n, fy = y <= n / 2 ? y : y - n;
    const sx = transpose ? fy : fx, sy = transpose ? fx : fy, ix = ((Math.round(sx * ratio) % m.n) + m.n) % m.n, iy = ((Math.round(sy * ratio) % m.n) + m.n) % m.n;
    let a = A[iy * m.n + ix]; if (tame !== 1) a = a ** tame;
    const k = (a || 0) / n; re[y * n + x] *= k; im[y * n + x] *= k; norm += a * a;
  }
  re[0] = 0; im[0] = 0;
  fft2(re, im, n, true);
  const out = new Float32Array(n * n); let mean = 0; for (let i = 0; i < out.length; i++) { out[i] = re[i]; mean += out[i]; } mean /= out.length;
  let v = 0; for (let i = 0; i < out.length; i++) { out[i] -= mean; v += out[i] * out[i]; } const sd = Math.sqrt(v / out.length) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= sd;
  return matchMix(out, m.quant);
}
// Set the light-and-dark mix of a field to the photo's (rank mapping onto its quantiles): a mostly dark cloth with a few bright slubs stays that.
export function matchMix(field, quant) {
  const n = field.length, idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
  idx.sort((a, b) => field[a] - field[b]);
  const out = new Float32Array(n), Q = quant.length - 1;
  for (let r = 0; r < n; r++) { const t = (r / (n - 1)) * Q, i0 = Math.min(Q - 1, Math.floor(t)), f = t - i0; out[idx[r]] = quant[i0] * (1 - f) + quant[i0 + 1] * f; }
  return out;
}

// ---- regular cloth ---------------------------------------------------------------------------------------------------------------------------------------------
// A smooth periodic noise (a few integer-frequency cosines), unit spread: the thread-by-thread differences. `lo`..`hi`: the frequencies used.
function periodicNoise(n, rand, lo, hi) {
  const out = new Float32Array(n * n);
  for (let k = 0; k < 14; k++) {
    const fx = Math.round(lo + rand() * (hi - lo)) * (rand() < 0.5 ? -1 : 1), fy = Math.round(lo + rand() * (hi - lo)) * (rand() < 0.5 ? -1 : 1), ph = rand() * Math.PI * 2, a = rand() * 0.8 + 0.2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] += a * Math.cos((2 * Math.PI * (fx * x + fy * y)) / n + ph);
  }
  let v = 0; for (const x of out) v += x * x; const sd = Math.sqrt(v / out.length) || 1; for (let i = 0; i < out.length; i++) out[i] /= sd;
  return out;
}
const sharpen = (x, k) => Math.tanh(k * x) / Math.tanh(k);
// Two independent spectral peaks (a lattice's two directions): the strongest, and the strongest one that is not along the same line as it.
function latticeVectors(m) {
  const p = m.peaks; if (!p.length) return null;
  const a = p[0], cross = (b) => Math.abs(a.fx * b.fy - a.fy * b.fx) / (Math.hypot(a.fx, a.fy) * Math.hypot(b.fx, b.fy));
  const b = p.slice(1).find((q) => cross(q) > 0.35 && q.v > a.v * 0.3);
  return { a, b: b || null };
}
// ---- a lattice from the photo's own repeating cell -------------------------------------------------------------------------------------------------------------
// The two strongest independent spectral peaks are the lattice (the repeat in the two thread directions, to a fraction of a bin). Every cell of the photo is laid on top of
// every other (by its position inside its own cell) and averaged: the result is the photo's own cell, clean of the noise of any one thread. It is then laid on an exact
// lattice with a whole number of repeats in the tile (so it wraps), cell by cell, each cell a little different in tone and thread.
function latticeOf(fine, sd, peaks, n) {
  if (!peaks.length) return null;
  const a = peaks[0], A = [a.rx ?? a.fx, a.ry ?? a.fy], crossOf = (b) => Math.abs(a.fx * b.fy - a.fy * b.fx) / (Math.hypot(a.fx, a.fy) * Math.hypot(b.fx, b.fy));
  const b = peaks.slice(1, 12).find((q) => crossOf(q) > 0.35 && q.v > a.v * 0.28);
  const B = b ? [b.rx ?? b.fx, b.ry ?? b.fy] : [-A[1], A[0]];           // no second direction: the other thread direction is across the first
  const R = 20, cell = new Float64Array(R * R), wt = new Float64Array(R * R), z = (i) => fine[i] / sd;
  const cellSum = new Map();
  for (let y = 0; y < n; y++) {
    const wy = 0.5 - 0.5 * Math.cos((2 * Math.PI * (y + 0.5)) / n);
    for (let x = 0; x < n; x++) {
      const w = wy * (0.5 - 0.5 * Math.cos((2 * Math.PI * (x + 0.5)) / n)); if (w < 0.05) continue;
      const ux = (A[0] * x + A[1] * y) / n, vy = (B[0] * x + B[1] * y) / n, fu = ux - Math.floor(ux), fv = vy - Math.floor(vy), val = z(y * n + x);
      const gu = fu * R, gv = fv * R, u0 = Math.floor(gu) % R, v0 = Math.floor(gv) % R, du = gu - Math.floor(gu), dv = gv - Math.floor(gv);
      for (const [uu, vv, ww] of [[u0, v0, (1 - du) * (1 - dv)], [(u0 + 1) % R, v0, du * (1 - dv)], [u0, (v0 + 1) % R, (1 - du) * dv], [(u0 + 1) % R, (v0 + 1) % R, du * dv]]) { cell[vv * R + uu] += val * ww * w; wt[vv * R + uu] += ww * w; }
      const key = Math.floor(ux) * 4096 + Math.floor(vy), e = cellSum.get(key) || [0, 0]; e[0] += val * w; e[1] += w; cellSum.set(key, e);
    }
  }
  for (let i = 0; i < cell.length; i++) cell[i] = wt[i] > 1e-6 ? cell[i] / wt[i] : 0;
  // how much the cells differ from one another (the sd of the cell averages, in units of the cloth's own spread), and the part of the picture the average cell does not explain
  const means = [...cellSum.values()].filter((e) => e[1] > 20).map((e) => e[0] / e[1]); let cv = 0;
  if (means.length > 3) { const mm = means.reduce((x, y) => x + y, 0) / means.length; cv = Math.sqrt(means.reduce((x, y) => x + (y - mm) ** 2, 0) / means.length); }
  let rv = 0, rc = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const ux = (A[0] * x + A[1] * y) / n, vy = (B[0] * x + B[1] * y) / n, gu = (ux - Math.floor(ux)) * R, gv = (vy - Math.floor(vy)) * R;
    const r = z(y * n + x) - cell[(Math.floor(gv) % R) * R + (Math.floor(gu) % R)]; rv += r * r; rc++;
  }
  return { A, B, R, cell, cellTone: Math.min(0.6, cv), residual: Math.sqrt(rv / rc) };
}
// the cell, sampled bilinearly (wrapping), at lattice position (u, v) in cells
function sampleCell(lat, u, v) {
  const R = lat.R, gu = (u - Math.floor(u)) * R, gv = (v - Math.floor(v)) * R, u0 = Math.floor(gu), v0 = Math.floor(gv), du = gu - u0, dv = gv - v0, c = lat.cell, at = (a, b) => c[(b % R) * R + (a % R)];
  return at(u0, v0) * (1 - du) * (1 - dv) + at(u0 + 1, v0) * du * (1 - dv) + at(u0, v0 + 1) * (1 - du) * dv + at(u0 + 1, v0 + 1) * du * dv;
}
const hash2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function drawLattice(m, n, rand, salt) {
  const lat = m.lattice; if (!lat) return null;
  // whole numbers of repeats per tile (so it wraps): the nearest integer vectors; if they collapse onto one line, nudge the second
  let A = [Math.round(lat.A[0]), Math.round(lat.A[1])], B = [Math.round(lat.B[0]), Math.round(lat.B[1])];
  if (!A[0] && !A[1]) A = [Math.sign(lat.A[0]) || 1, 0];
  if (A[0] * B[1] - A[1] * B[0] === 0) B = [-A[1] || 1, A[0]];
  const det = A[0] * B[1] - A[1] * B[0], out = new Float32Array(n * n), tone = new Map();
  const toneAt = (ci, cj) => { // the cell's own tone (a random number from its place in the tile, so the same cell is the same on both sides of the wrap)
    const px = (n * (B[1] * (ci + 0.5) - A[1] * (cj + 0.5))) / det, py = (n * (-B[0] * (ci + 0.5) + A[0] * (cj + 0.5))) / det;
    const kx = ((Math.round(px * 4) % (4 * n)) + 4 * n) % (4 * n), ky = ((Math.round(py * 4) % (4 * n)) + 4 * n) % (4 * n), key = kx * 8192 + ky;
    let t = tone.get(key); if (t === undefined) { t = (hash2(kx + salt, ky) + hash2(ky, kx ^ salt) + hash2(kx * 3, ky * 7) - 1.5) * 2; tone.set(key, t); } return t;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const ux = (A[0] * x + A[1] * y) / n, vy = (B[0] * x + B[1] * y) / n;
    out[y * n + x] = sampleCell(lat, ux, vy) + lat.cellTone * toneAt(Math.floor(ux), Math.floor(vy));
  }
  // the part of the cloth the average cell does not explain: fine thread differences, softly
  const noise = new Float32Array(n * n); for (let i = 0; i < noise.length; i++) noise[i] = gauss(rand);
  const soft = blur(noise, n, n, 1, 1, true), k = lat.residual * 0.7 * 2.2;
  for (let i = 0; i < out.length; i++) out[i] += soft[i] * k;
  return out;
}
function drawMesh(m, n, rand, salt) { return drawLattice(m, n, rand, salt); }
function drawTwill(m, n, rand, salt) {
  const viaCell = drawLattice(m, n, rand, salt); if (viaCell) return viaCell;
  const k = m.peaks[0] || { fx: n / 10, fy: n / 10 };
  const out = new Float32Array(n * n), wob = periodicNoise(n, rand, 1, 4), tone = periodicNoise(n, rand, 8, 26);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * n + x, p = (2 * Math.PI * (k.fx * x + k.fy * y)) / n + 0.5 * wob[i]; out[i] = (Math.cos(p) + 0.35 * Math.cos(2 * p + 0.8)) * 0.9 + 0.22 * tone[i]; }
  return out;
}
function drawStripe(m, n, rand) {
  // the photo's own stripe layout across the width (its column profile resampled, and wrapped so the ends meet), smoothed lightly, with fine thread noise along each stripe
  const out = new Float32Array(n * n), prof = new Float32Array(n), src = m.colProfile, sn = src.length;
  for (let x = 0; x < n; x++) { const t = (x / n) * sn, i0 = Math.floor(t) % sn, i1 = (i0 + 1) % sn, f = t - Math.floor(t); prof[x] = src[i0] * (1 - f) + src[i1] * f; }
  const blend = Math.max(2, Math.round(n / 16)); for (let b = 0; b < blend; b++) { const w = b / blend, a = prof[b], z = prof[n - 1 - b]; prof[b] = a * w + z * (1 - w) * 0.5 + a * (1 - w) * 0.5; prof[n - 1 - b] = z * w + a * (1 - w) * 0.5 + z * (1 - w) * 0.5; }
  let v = 0; for (const x of prof) v += x * x; const psd = Math.sqrt(v / n) || 1;
  const fineN = periodicNoise(n, rand, 18, 70), col = periodicNoise(n, rand, 1, 5);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = (prof[x] / psd) * 1.0 + 0.35 * fineN[y * n + x] + 0.12 * col[y * n + x];
  return out;
}

// ---- the whole cloth ---------------------------------------------------------------------------------------------------------------------------------------------
const standardize = (f) => { const n = f.length; let m = 0; for (const x of f) m += x; m /= n; let v = 0; for (let i = 0; i < n; i++) { f[i] -= m; v += f[i] * f[i]; } const sd = Math.sqrt(v / n) || 1; for (let i = 0; i < n; i++) f[i] /= sd; return f; };
// The unit-spread field of a cloth of this type (before the photo's colors are put on it).
export function fieldOf(type, m, { n = m.n, seed = 1 } = {}) {
  const rand = rngOf(seed ^ 0x9e3779b9);
  if (type === 'mesh' || type === 'twill') {
    const f = (type === 'mesh' ? drawMesh : drawTwill)(m, n, rand, seed & 0xffff);
    if (f) return matchMix(standardize(f), m.quant);
  }
  if (type === 'stripe') return standardize(drawStripe(m, n, rand));
  // slub streaks always run ACROSS the shade: a measured structure that runs down the picture (a folded photo) is turned
  const horizontal = Math.sqrt(m.rowProfile.reduce((s, x) => s + x * x, 0)), vertical = Math.sqrt(m.colProfile.reduce((s, x) => s + x * x, 0));
  return synthesize(m, { n, seed, transpose: type === 'slub' && vertical > horizontal * 1.5 });
}
// -> n x n x 3 bytes: the cloth in the photo's own average color, contrast and thread colors (a "raw" picture, like a photo crop)
export function drawFabric(type, m, { n = m.n, seed = 1 } = {}) {
  const f = fieldOf(type, m, { n, seed }), out = new Uint8ClampedArray(n * n * 3);
  for (let i = 0; i < f.length; i++) { const d = f[i] * m.sd; for (let c = 0; c < 3; c++) out[i * 3 + c] = m.mean[c] + d * m.colorDir[c]; }
  return out;
}
// the repeat of the lattice in texture pixels (for the size rule in src/lib/weaveStrength.js), or null for irregular cloth
export const periodOf = (type, m) => (type === 'mesh' || type === 'twill' ? (m.period ? Math.max(3, m.period) : null) : null);
