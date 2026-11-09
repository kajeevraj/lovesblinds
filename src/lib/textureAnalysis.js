// Finds the flat part of a supplier swatch photo, or says there is none. Pure functions on RGB bytes (no DOM, no sharp), so the admin (canvas pixels),
// the backfill script (sharp pixels) and the tests all make the same decision.
//
// A photo is "usable" when some window of it has no folds, no edges and no strong shading: that window is cropped and made to tile (textureCore.js).
// Otherwise (a folded shade, a whole shade on a background, a photo that is too small, strong shading everywhere) the fabric gets a generated pattern
// texture instead (patternTexture.js).
import { blur } from './../room/textureCore.js';

export const ANALYSIS_SIDE = 192;           // the photo is looked at at this size (longest side)
export const MIN_SOURCE_CROP = 100;         // a flat crop smaller than this many photo pixels would be blurry once stretched to a 256 px texture
export const LIMITS = {
  shade: 8,         // slow brightness change left inside the window once a plain lighting slope is taken out (the flatten step removes that slope anyway):
                    // 5th to 95th percentile of the smoothed picture, in levels (0..255). Curved shading and soft folds show here.
  slope: 21,        // the plain lighting slope itself across the window, in levels: more than this is a shade photographed in strong, uneven light
  edge: 2.6,        // strongest edge: 99th percentile of the smoothed gradient, levels per analysis pixel (a weave is smoothed away; a fold or a border is not)
  line: 16,         // a crease or seam: a thin line running through the window (its row or column average stands out from its surroundings), in levels
};
const SIDES = [0.7, 0.56, 0.44];            // window sizes tried, as a share of the short side; the largest one that is flat wins

export function toGray(rgb) {
  const g = new Float32Array(rgb.length / 3);
  for (let i = 0, j = 0; i < g.length; i++, j += 3) g[i] = 0.3 * rgb[j] + 0.59 * rgb[j + 1] + 0.11 * rgb[j + 2];
  return g;
}

// Box-filter shrink so the longest side is `max` (or leave as is when already smaller). Returns { rgb, w, h, scale }.
export function shrink(rgb, w, h, max = ANALYSIS_SIDE) {
  const scale = Math.min(1, max / Math.max(w, h));
  if (scale === 1) return { rgb: Uint8ClampedArray.from(rgb), w, h, scale };
  const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
  const out = new Uint8ClampedArray(nw * nh * 3);
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor((y * h) / nh), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / nh));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor((x * w) / nw), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / nw));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * w + xx) * 3; r += rgb[i]; g += rgb[i + 1]; b += rgb[i + 2]; n++; }
      const o = (y * nw + x) * 3; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return { rgb: out, w: nw, h: nh, scale };
}

// least-squares plane v = a + bx x + by y
function planeFit(xs, ys, vs) {
  const n = vs.length; let sx = 0, sy = 0, sv = 0, sxx = 0, syy = 0, sxy = 0, sxv = 0, syv = 0;
  for (let k = 0; k < n; k++) { sx += xs[k]; sy += ys[k]; sv += vs[k]; sxx += xs[k] * xs[k]; syy += ys[k] * ys[k]; sxy += xs[k] * ys[k]; sxv += xs[k] * vs[k]; syv += ys[k] * vs[k]; }
  const mx = sx / n, my = sy / n, mv = sv / n, cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my, cxv = sxv / n - mx * mv, cyv = syv / n - my * mv, det = cxx * cyy - cxy * cxy || 1;
  const bx = (cxv * cyy - cyv * cxy) / det, by = (cyv * cxx - cxv * cxy) / det;
  return { a: mv - bx * mx - by * my, bx, by };
}
// A crease or seam is a thin line through the window: average the window's rows (and its columns) along the line and look for a spike against the surroundings.
function lineStrength(B, w, x0, y0, side) {
  const cols = new Float32Array(side), rows = new Float32Array(side);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) { const v = B[(y0 + y) * w + x0 + x]; cols[x] += v / side; rows[y] += v / side; }
  // one or two isolated spikes are a crease; many evenly spread spikes are a striped or ribbed fabric, which is cloth, not a crease
  const spike = (p) => {
    const r = 8, hp = new Float32Array(side);
    for (let i = r; i < side - r; i++) { let t = 0; for (let k = -r; k <= r; k++) t += p[i + k]; hp[i] = Math.abs(p[i] - t / (2 * r + 1)); }
    let top = 0; for (let i = r; i < side - r; i++) top = Math.max(top, hp[i]);
    let peaks = 0, last = -99;
    for (let i = r; i < side - r; i++) if (hp[i] >= top * 0.5 && hp[i] >= hp[i - 1] && hp[i] >= hp[i + 1] && i - last > 12) { peaks++; last = i; }
    return peaks >= 3 ? 0 : top;
  };
  return Math.max(spike(cols), spike(rows));
}
const pct = (arr, p) => { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

// -> { mode: 'photo' | 'pattern', usable, rect: { x, y, side } (in PHOTO pixels), metrics: { shade, edge, hf }, reason }
// `rect` is the flattest window even when the photo is not usable (so the admin can still show "what a crop would be").
export function analyzePhoto(rgb, width, height) {
  const small = shrink(rgb, width, height), { w, h, scale } = small;
  const gray = toGray(small.rgb);
  const B = blur(gray, w, h, 1, 5), LF = blur(gray, w, h, 1, 10), B2 = blur(gray, w, h, 1, 2);
  const G = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const gx = (B[y * w + x + 1] - B[y * w + x - 1]) / 2, gy = (B[(y + 1) * w + x] - B[(y - 1) * w + x]) / 2;
    G[y * w + x] = Math.hypot(gx, gy);
  }
  const short = Math.min(w, h);
  let best = null, bestPass = null;
  for (const f of SIDES) {
    const side = Math.max(24, Math.round(short * f)), step = Math.max(2, Math.round(side / 10));
    for (let y0 = 0; y0 + side <= h; y0 += step) for (let x0 = 0; x0 + side <= w; x0 += step) {
      // leave the outer rim of the picture out: photos have vignettes, borders and the edge of the cloth there
      const m = Math.round(short * 0.04); if (x0 < m || y0 < m || x0 + side > w - m || y0 + side > h - m) continue;
      const lf = [], gg = [], hf = [], xs = [], ys = []; let hs = 0;
      for (let y = y0 + 1; y < y0 + side - 1; y += 2) for (let x = x0 + 1; x < x0 + side - 1; x += 2) { const i = y * w + x; lf.push(LF[i]); xs.push(x - x0); ys.push(y - y0); gg.push(G[i]); const d = gray[i] - B[i]; hs += d * d; }
      // take out the best-fit plane (a plain lighting slope): what is left is curved shading and folds
      const pl = planeFit(xs, ys, lf), res = lf.map((v, k) => v - (pl.a + pl.bx * xs[k] + pl.by * ys[k]));
      const shade = pct(res, 0.95) - pct(res, 0.05), slope = Math.hypot(pl.bx, pl.by) * side, edge = pct(gg, 0.99), hfSd = Math.sqrt(hs / lf.length);
      const line = lineStrength(B2, w, x0, y0, side);
      const score = shade / LIMITS.shade + edge / LIMITS.edge + line / LIMITS.line + slope / (LIMITS.slope * 2), cand = { x: x0, y: y0, side, shade, slope, edge, line, hf: hfSd, score, f };
      if (!best || score < best.score) best = cand;
      if (shade <= LIMITS.shade && edge <= LIMITS.edge && line <= LIMITS.line && slope <= LIMITS.slope && (!bestPass || (f === bestPass.f ? score < bestPass.score : f > bestPass.f))) bestPass = cand;
    }
    if (bestPass) break;                                           // the largest size that has a flat window
  }
  const pick = bestPass || best;
  if (!pick) return { mode: 'pattern', usable: false, rect: { x: 0, y: 0, side: Math.min(width, height) }, metrics: { shade: NaN, slope: NaN, edge: NaN, line: NaN, hf: NaN }, reason: 'too small to find a flat area' };
  const rect = { x: Math.round(pick.x / scale), y: Math.round(pick.y / scale), side: Math.round(pick.side / scale) };
  rect.side = Math.min(rect.side, width - rect.x, height - rect.y);
  const metrics = { shade: +pick.shade.toFixed(2), slope: +pick.slope.toFixed(1), edge: +pick.edge.toFixed(2), line: +pick.line.toFixed(1), hf: +pick.hf.toFixed(2) };
  if (Math.min(width, height) < 200 || rect.side < MIN_SOURCE_CROP) return { mode: 'pattern', usable: false, rect, metrics, reason: 'photo too small for a flat crop' };
  if (!bestPass) {
    const folds = pick.edge > LIMITS.edge || pick.line > LIMITS.line, shading = pick.shade > LIMITS.shade || pick.slope > LIMITS.slope;
    return { mode: 'pattern', usable: false, rect, metrics, reason: folds ? (shading ? 'folds, edges and strong shading' : 'folds or edges') : 'strong shading' };
  }
  return { mode: 'photo', usable: true, rect, metrics, reason: 'flat area found' };
}
