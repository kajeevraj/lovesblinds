// Reads a Zebra swatch photo: where its solid and sheer bands are, and what each one looks like. Pure functions on RGB bytes (no DOM, no sharp).
//
// A zebra photo shows the cloth as a stack of horizontal bands: a SOLID band (opaque, the cloth's own color and texture) and a SHEER band (white voile) in turn. The color a
// zebra shows is the SOLID band's, not the photo's average (the white sheer bands lift it). Some photos are not banded at all (a folded sheet, or one flat
// color): for those the whole usable picture is the cloth.
//
//   bandsOf(rgb, w, h)  ->  { banded, solidRows: [[y0, y1] ...], sheerRows: [[y0, y1] ...], gap, split }
//   bandPatch(rgb, w, h, rows)  ->  the pixels inside those rows (and the middle of the width), as r,g,b bytes, w, h, for the color and the texture
const lumaOf = (rgb, i) => 0.3 * rgb[i] + 0.59 * rgb[i + 1] + 0.11 * rgb[i + 2];

export function bandsOf(rgb, w, h) {
  const x0 = Math.floor(w * 0.12), x1 = Math.ceil(w * 0.88), prof = new Float32Array(h), colMean = new Float64Array(w);
  // the signal that tells solid from sheer is the light AND the color: a cream band and a white band have almost the same luminance, but the cream is yellower (less blue)
  const sig = (i) => lumaOf(rgb, i) - 1.4 * Math.max(0, (rgb[i] + rgb[i + 1]) / 2 - rgb[i + 2]);
  for (let y = 0; y < h; y++) { let t = 0; for (let x = x0; x < x1; x++) { const v = sig((y * w + x) * 3); t += v; colMean[x] += v / h; } prof[y] = t / (x1 - x0); }
  const sm = new Float32Array(h); for (let y = 0; y < h; y++) { let t = 0, c = 0; for (let k = -2; k <= 2; k++) { const yy = y + k; if (yy >= 0 && yy < h) { t += prof[yy]; c++; } } sm[y] = t / c; }
  // two clusters of rows (Otsu): the threshold that best separates the dark rows from the light ones
  const sorted = Array.from(sm).sort((a, b) => a - b); let best = { score: -1, thr: 0 };
  for (let k = Math.floor(h * 0.1); k < Math.floor(h * 0.9); k++) {
    const thr = (sorted[k] + sorted[k + 1]) / 2; let n0 = 0, n1 = 0, s0 = 0, s1 = 0;
    for (const v of sm) if (v <= thr) { n0++; s0 += v; } else { n1++; s1 += v; }
    if (!n0 || !n1) continue; const m0 = s0 / n0, m1 = s1 / n1, score = n0 * n1 * (m1 - m0) ** 2; if (score > best.score) best = { score, thr, m0, m1, n0, n1 };
  }
  const none = { banded: false, solidRows: [], sheerRows: [], gap: 0, split: 0 };
  if (best.score < 0) return none;
  let wv = 0; for (const v of sm) wv += (v - (v <= best.thr ? best.m0 : best.m1)) ** 2; wv /= h;
  let tv = 0; const mean = (best.m0 * best.n0 + best.m1 * best.n1) / h; for (const v of sm) tv += (v - mean) ** 2; tv /= h;
  const gap = best.m1 - best.m0;
  // runs of rows on each side of the threshold; a band is a run at least 7% of the height
  const runs = []; let start = 0;
  for (let y = 1; y <= h; y++) if (y === h || (sm[y] <= best.thr) !== (sm[y - 1] <= best.thr)) { runs.push({ dark: sm[start] <= best.thr, a: start, b: y }); start = y; }
  const long = runs.filter((r) => r.b - r.a >= h * 0.07);
  const solid = long.filter((r) => r.dark), sheer = long.filter((r) => !r.dark);
  // a banded photo is the same all along a row and different from row to row; a folded sheet has creases down the picture, so its columns differ from one another about as
  // much as its rows do (the variance of the column averages against that of the row averages: under 0.15 for every banded photo, over 0.4 for every folded one)
  let cm = 0; for (let x = x0; x < x1; x++) cm += colMean[x]; cm /= x1 - x0;
  let cv = 0; for (let x = x0; x < x1; x++) cv += (colMean[x] - cm) ** 2; cv /= x1 - x0;
  const banded = gap >= 4 && wv / tv < 0.3 && cv / tv <= 0.2 && solid.length >= 1 && sheer.length >= 1 && best.n0 / h > 0.15 && best.n1 / h > 0.12;
  if (!banded) return { ...none, gap };
  const inset = (r) => { const pad = Math.max(3, Math.round((r.b - r.a) * 0.14)); return [r.a + pad, r.b - pad]; };
  return { banded: true, solidRows: solid.map(inset), sheerRows: sheer.map(inset), gap, split: best.n0 / h };
}

// The pixels inside some rows of the photo (middle 76% of the width), stacked into one picture. -> { rgb, w, h }
export function bandPatch(rgb, w, h, rows) {
  const x0 = Math.floor(w * 0.12), x1 = Math.ceil(w * 0.88), pw = x1 - x0, ph = rows.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
  const out = new Uint8ClampedArray(pw * ph * 3); let o = 0;
  for (const [a, b] of rows) for (let y = a; y < b; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 3; out[o++] = rgb[i]; out[o++] = rgb[i + 1]; out[o++] = rgb[i + 2]; }
  return { rgb: out, w: pw, h: ph };
}

// the average color of a patch (sRGB bytes) and its luminance spread
export function patchColor(rgb) {
  const n = rgb.length / 3, m = [0, 0, 0]; for (let i = 0; i < rgb.length; i += 3) { m[0] += rgb[i]; m[1] += rgb[i + 1]; m[2] += rgb[i + 2]; }
  return m.map((v) => v / n);
}
