// What kind of cloth a swatch photo shows: ONE of nine texture types, measured from the photo. Pure functions on RGB bytes (no DOM, no sharp), so the admin (canvas
// pixels), the classify script (sharp pixels), the preview (as a fallback for a color that has no stored type) and the tests all give the same answer.
//
//   slub     fine, uneven horizontal lines (long streaks of thread)
//   mesh     a tiny even grid or dots: a fine mesh or basketweave
//   twill    fine diagonal lines
//   linen    soft, irregular threads both ways
//   tweed    mixed-color threads (a mélange: several thread colors woven together)
//   motif    a repeating shape (hexagons, a trellis, a lattice)
//   print    a print or jacquard that does not repeat inside the photo (damask, leaf, branch)
//   stripe   vertical stripes
//   smooth   plain cloth with no visible structure
//
// The measuring (textureFeatures) is separate from the decision (classifyTexture), so the decision can be read, tested and tuned on its own.
import { blur } from '../room/textureCore.js';

export const TEXTURE_TYPES = ['slub', 'mesh', 'twill', 'linen', 'tweed', 'motif', 'print', 'stripe', 'smooth'];
export const TEXTURE_TYPE_LABEL = { slub: 'Slub streaks', mesh: 'Fine mesh / basketweave', twill: 'Twill / diagonal', linen: 'Linen look', tweed: 'Tweed / multicolor', motif: 'Geometric motif', print: 'Print / jacquard', stripe: 'Vertical stripe', smooth: 'Smooth' };
// The types drawn (generated) by default, and the ones that use the photo itself by default: a geometric shape, a print and a tweed cannot be drawn from a few numbers.
export const PHOTO_TYPES = ['motif', 'print', 'tweed'];
export const isTextureType = (t) => TEXTURE_TYPES.includes(t);
export const defaultSource = (type) => (PHOTO_TYPES.includes(type) ? 'photo' : 'generated');

export const N = 256;                                   // the size every measurement is made at

// ---- a patch of the photo at N x N ---------------------------------------------------------------------------------------------------------------------
// `rect` { x, y, w, h } in photo pixels (or a square { x, y, side }); the patch is box-averaged down (or bilinearly stretched up) to N x N. Returns r,g,b bytes.
export function resamplePatch(rgb, w, h, rect, n = N) {
  const rw = rect.w ?? rect.side, rh = rect.h ?? rect.side, out = new Float32Array(n * n * 3);
  const sx = rw / n, sy = rh / n;
  for (let y = 0; y < n; y++) {
    const y0 = rect.y + y * sy, y1 = y0 + sy;
    for (let x = 0; x < n; x++) {
      const x0 = rect.x + x * sx, x1 = x0 + sx;
      let r = 0, g = 0, b = 0, wsum = 0;
      for (let yy = Math.floor(y0); yy < Math.min(h, Math.ceil(y1)); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0); if (wy <= 0) continue;
        for (let xx = Math.floor(x0); xx < Math.min(w, Math.ceil(x1)); xx++) {
          const wx = Math.min(xx + 1, x1) - Math.max(xx, x0); if (wx <= 0) continue;
          const i = (yy * w + xx) * 3, k = wx * wy; r += rgb[i] * k; g += rgb[i + 1] * k; b += rgb[i + 2] * k; wsum += k;
        }
      }
      if (wsum === 0) { const i = (Math.min(h - 1, Math.max(0, Math.round(y0))) * w + Math.min(w - 1, Math.max(0, Math.round(x0)))) * 3; r = rgb[i]; g = rgb[i + 1]; b = rgb[i + 2]; wsum = 1; }
      const o = (y * n + x) * 3; out[o] = r / wsum; out[o + 1] = g / wsum; out[o + 2] = b / wsum;
    }
  }
  return out;
}

// ---- a 2D FFT (power of two sizes) -----------------------------------------------------------------------------------------------------------------------
export function fft(re, im, inverse = false) {            // in place, 1D, length a power of two
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI / len) * (inverse ? -1 : 1), wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
export function fft2(re, im, n = N, inverse = false) {
  const rr = new Float64Array(n), ri = new Float64Array(n);
  for (let y = 0; y < n; y++) { for (let x = 0; x < n; x++) { rr[x] = re[y * n + x]; ri[x] = im[y * n + x]; } fft(rr, ri, inverse); for (let x = 0; x < n; x++) { re[y * n + x] = rr[x]; im[y * n + x] = ri[x]; } }
  for (let x = 0; x < n; x++) { for (let y = 0; y < n; y++) { rr[y] = re[y * n + x]; ri[y] = im[y * n + x]; } fft(rr, ri, inverse); for (let y = 0; y < n; y++) { re[y * n + x] = rr[y]; im[y * n + x] = ri[y]; } }
}

const luma = (rgb) => { const n = rgb.length / 3, g = new Float32Array(n); for (let i = 0, j = 0; i < n; i++, j += 3) g[i] = 0.3 * rgb[j] + 0.59 * rgb[j + 1] + 0.11 * rgb[j + 2]; return g; };
const sdOf = (a) => { let m = 0; for (const v of a) m += v; m /= a.length; let t = 0; for (const v of a) t += (v - m) ** 2; return Math.sqrt(t / a.length); };
const meanOf = (a) => { let m = 0; for (const v of a) m += v; return m / a.length; };

// ---- the measurements ----------------------------------------------------------------------------------------------------------------------------------
// `patch`: N x N x 3 floats (resamplePatch). Everything is measured after the plain lighting is taken out (a blurred copy subtracted).
export function textureFeatures(patch, n = N) {
  const G = luma(patch), lowK = blur(G, n, n, 1, 14, false), fine = new Float32Array(n * n);
  for (let i = 0; i < fine.length; i++) fine[i] = G[i] - lowK[i];
  const sdFine = sdOf(fine), mean = meanOf(G);
  // ---- orientation: the structure tensor of the lightly smoothed picture (gradients), and a histogram of gradient directions (weighted by strength)
  const S = blur(fine, n, n, 1, 1, false), bins = new Float64Array(36);
  let Jxx = 0, Jyy = 0, Jxy = 0;
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
    const gx = (S[y * n + x + 1] - S[y * n + x - 1]) / 2, gy = (S[(y + 1) * n + x] - S[(y - 1) * n + x]) / 2, m2 = gx * gx + gy * gy;
    Jxx += gx * gx; Jyy += gy * gy; Jxy += gx * gy;
    let a = Math.atan2(gy, gx); if (a < 0) a += Math.PI; if (a >= Math.PI) a -= Math.PI;
    bins[Math.min(35, Math.floor((a / Math.PI) * 36))] += m2;
  }
  const J = Jxx + Jyy || 1;
  const horizontal = Jyy / J;                                   // 1: all structure is horizontal lines (gradients point up and down); 0: vertical lines; 0.5: both ways
  const coherence = Math.hypot(Jxx - Jyy, 2 * Jxy) / J;         // 1: one direction; 0: every direction
  // gradient direction -> line direction (90 degrees away). Share of the strength within 15 degrees of horizontal lines / vertical lines / each diagonal.
  const share = (center, tol) => { let s = 0, t = 0; for (let b = 0; b < 36; b++) { const a = (b + 0.5) * 5; let d = Math.abs(a - center); d = Math.min(d, 180 - d); t += bins[b]; if (d <= tol) s += bins[b]; } return s / (t || 1); };
  const horiz = share(90, 17), vert = share(0, 17) + share(180, 0), diagA = share(45, 17), diagB = share(135, 17);   // (gradient 90 degrees = a horizontal line)
  const diagonal = Math.max(diagA, diagB), diagSide = diagA >= diagB ? 'down-right' : 'down-left';
  // ---- periodicity: the strongest peaks of the power spectrum against the rest of it
  const re = new Float64Array(n * n), im = new Float64Array(n * n);
  for (let y = 0; y < n; y++) { const wy = 0.5 - 0.5 * Math.cos((2 * Math.PI * (y + 0.5)) / n); for (let x = 0; x < n; x++) re[y * n + x] = fine[y * n + x] * wy * (0.5 - 0.5 * Math.cos((2 * Math.PI * (x + 0.5)) / n)); }
  fft2(re, im, n);
  const P = new Float64Array(n * n); let total = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const fx = x <= n / 2 ? x : x - n, fy = y <= n / 2 ? y : y - n, r = Math.hypot(fx, fy);
    if (r < 3) continue;                                      // the lowest frequencies are lighting
    P[y * n + x] = re[y * n + x] ** 2 + im[y * n + x] ** 2; total += P[y * n + x];
  }
  const peaks = []; let peakSum = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = P[y * n + x]; if (!v) continue;
    const fx = x <= n / 2 ? x : x - n, fy = y <= n / 2 ? y : y - n; if (fy < 0 || (fy === 0 && fx < 0)) continue;   // half the plane (the other half mirrors it)
    let isMax = true;
    for (let dy = -2; dy <= 2 && isMax; dy++) for (let dx = -2; dx <= 2; dx++) { if (!dx && !dy) continue; if (P[((y + dy + n) % n) * n + ((x + dx + n) % n)] > v) { isMax = false; break; } }
    if (isMax) peaks.push({ v, fx, fy, r: Math.hypot(fx, fy) });
  }
  peaks.sort((a, b) => b.v - a.v);
  for (const p of peaks.slice(0, 6)) peakSum += p.v;
  const top = peaks[0] || { v: 0, fx: 0, fy: 0, r: 0 };
  // where the strongest spectral peaks lie: the angle of the spatial frequency (0 = vertical lines, 90 = horizontal lines, 45 and 135 = diagonals)
  const angOf = (p) => { let a = (Math.atan2(p.fy, p.fx) * 180) / Math.PI; if (a < 0) a += 180; return a; };
  const near = (a, c, tol) => { let d = Math.abs(a - c); d = Math.min(d, 180 - d); return d <= tol; };
  let axisE = 0, diagE = 0, allE = 0;
  for (const p of peaks.slice(0, 6)) { const a = angOf(p); allE += p.v; if (near(a, 0, 14) || near(a, 90, 14)) axisE += p.v; else if (near(a, 45, 22) || near(a, 135, 22)) diagE += p.v; }
  const axisPeak = axisE / (allE || 1), diagPeak = diagE / (allE || 1), peakAngle = peaks.length ? angOf(top) : 0;
  // the strongest low-frequency peak (a repeat of a coarse shape: 3 to 14 repeats across the patch): a motif repeats, a print does not
  let coarse = 0; for (const p of peaks) if (p.r >= 3 && p.r <= 14) { coarse = p.v; break; }
  const coarsePeak = coarse / (total || 1);
  const peakShare = (2 * peakSum) / (total || 1);             // the 6 strongest spots (and their mirrors) as a share of all the energy: 1/36 for noise, near 1 for a lattice
  const lattice = peaks.length > 1 ? peaks.slice(0, 6).filter((p) => p.v > top.v * 0.2).length : 1;
  // ---- coarse shapes: the picture between fine thread (about 2 px) and large shapes (about 60 px)
  const band = blur(G, n, n, 1, 2, false), wide = blur(G, n, n, 1, 22, false), mid = new Float32Array(n * n);
  for (let i = 0; i < mid.length; i++) mid[i] = band[i] - wide[i];
  const sdMid = sdOf(mid), midRatio = sdMid / (sdFine || 1);
  // ---- shapes: long coherent lines that are neither along the threads nor on a regular lattice. The picture is smoothed past the thread (2 px), its gradient tensor is averaged over a
  // 17 px window, and among the pixels with strong gradients we count those whose neighbourhood has ONE clear direction that is not horizontal or vertical (the edges of a
  // hexagon, a leaf, a damask scroll), and those that have one clear direction of any kind.
  const M = blur(G, n, n, 1, 2, false), gxs = new Float32Array(n * n), gys = new Float32Array(n * n), mag = new Float32Array(n * n);
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) { const i = y * n + x, gx = (M[i + 1] - M[i - 1]) / 2, gy = (M[i + n] - M[i - n]) / 2; gxs[i] = gx; gys[i] = gy; mag[i] = Math.hypot(gx, gy); }
  const txx = new Float32Array(n * n), tyy = new Float32Array(n * n), txy = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) { txx[i] = gxs[i] * gxs[i]; tyy[i] = gys[i] * gys[i]; txy[i] = gxs[i] * gys[i]; }
  const Bxx = blur(txx, n, n, 1, 8, false), Byy = blur(tyy, n, n, 1, 8, false), Bxy = blur(txy, n, n, 1, 8, false);
  const sortedMag = Float32Array.from(mag).sort(), thr = sortedMag[Math.floor(sortedMag.length * 0.85)];
  let strong = 0, coherentAny = 0, coherentOblique = 0;
  for (let y = 12; y < n - 12; y++) for (let x = 12; x < n - 12; x++) {
    const i = y * n + x; if (mag[i] < thr) continue; strong++;
    const t = Bxx[i] + Byy[i]; if (t < 1e-6) continue;
    const c = Math.hypot(Bxx[i] - Byy[i], 2 * Bxy[i]) / t; if (c < 0.6) continue;
    coherentAny++;
    let a = 0.5 * Math.atan2(2 * Bxy[i], Bxx[i] - Byy[i]); a = (a * 180) / Math.PI; if (a < 0) a += 180;       // gradient direction
    const off = Math.min(Math.abs(a - 0), Math.abs(a - 90), Math.abs(a - 180));
    if (off > 14) coherentOblique++;
  }
  const lineAny = coherentAny / (strong || 1), lineOblique = coherentOblique / (strong || 1);
  // ---- color: how much of the color varies on its own, apart from the light and dark (threads of different colors)
  const rg = new Float32Array(n * n), bg = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) { rg[i] = patch[i * 3] - patch[i * 3 + 1]; bg[i] = patch[i * 3 + 2] - patch[i * 3 + 1]; }
  const rgS = blur(rg, n, n, 1, 1, false), bgS = blur(bg, n, n, 1, 1, false), Gs = blur(G, n, n, 1, 1, false);
  const resid = (c) => { let mc = meanOf(c), mg = meanOf(Gs), cov = 0, vg = 0; for (let i = 0; i < c.length; i++) { cov += (c[i] - mc) * (Gs[i] - mg); vg += (Gs[i] - mg) ** 2; } const k = cov / (vg || 1); const r = new Float32Array(c.length); for (let i = 0; i < c.length; i++) r[i] = c[i] - mc - k * (Gs[i] - mg); return r; };
  const colorSd = Math.hypot(sdOf(resid(rgS)), sdOf(resid(bgS)));
  // ---- how much of the fine contrast sits in streaks vs everywhere
  const rowProf = new Float32Array(n), colProf = new Float32Array(n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { rowProf[y] += fine[y * n + x] / n; colProf[x] += fine[y * n + x] / n; }
  const rowShare = (sdOf(rowProf) / (sdFine || 1)) ** 2, colShare = (sdOf(colProf) / (sdFine || 1)) ** 2;   // the share of the fine variance that is the same all along a row (or column)
  return {
    mean, sdFine, sdMid, midRatio, horizontal, coherence, horiz, vert, diagonal, diagSide, peakShare, lattice, peakR: top.r, peakFx: top.fx, peakFy: top.fy, peakAngle, axisPeak, diagPeak, coarsePeak,
    colorSd, colorRatio: colorSd / (sdFine || 1), rowShare, colShare, lineAny, lineOblique,
  };
}

// ---- the decision --------------------------------------------------------------------------------------------------------------------------------------
// `f`: textureFeatures of the fabric patch (the flat part of the photo; for a Zebra the solid band). `w`: the same measured on the middle of the whole photo (coarse shapes), or null.
// The rules run in this order and the first that holds decides. Each rule has a strength (0..1: how far past its thresholds the measurement is); the confidence is the winner's
// strength, lowered when a later rule also holds (then the photo could be read two ways, and the review sheet flags it).
//   twill   clear lines on a diagonal, repeating
//   slub    clear horizontal lines, or horizontal lines that carry most of the contrast (a Zebra photo of a folded sheet shows them along the columns: the sheet hangs)
//   stripe  lines along the columns, clear (or a weak one-sided grid with little contrast)
//   motif / print   long clear lines that are neither along the threads nor on a lattice (the edges of shapes): a motif repeats inside the photo, a print does not
//   mesh    the spectrum is a few sharp peaks (a lattice of dots, squares or basket)
//   tweed   strong, irregular contrast (several thread colors woven together)
//   smooth  almost no structure
//   linen   everything else: soft, irregular threads both ways
const ramp = (v, lo, hi) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
export function classifyTexture(f, w = null, { line = null, banded = true } = {}) {
  const wide = w || f, oblique = Math.max(f.lineOblique ?? 0, wide.lineOblique ?? 0), zebra = line === 'zebra';
  // diagonal lines all over the patch (not just at the edge of a shape), with some contrast, and either one clear direction or a sharp lattice
  const twill = (f.lineOblique ?? 0) >= 0.7 && f.sdFine >= 5 && (f.coherence >= 0.25 || f.peakShare >= 0.25);
  const slubA = f.horiz >= 0.5 && f.coherence >= 0.68, slubB = f.rowShare >= 0.25 && f.horiz >= 0.35 && f.horizontal >= 0.7;
  // a banded zebra's solid band has only horizontal streaks (or nothing): a lower bar, but there must be some contrast
  const slubZ = zebra && banded && f.horiz >= 0.38 && f.horizontal >= 0.7 && f.coherence >= 0.45 && f.sdFine >= 5.5;
  // a folded sheet: its threads run down the picture (across the shade); a plain white one has none
  const slubC = zebra && !banded && f.vert >= 0.45 && f.coherence >= 0.6 && f.sdFine >= 6 && f.colShare >= 0.2;
  const stripeA = !zebra && f.vert >= 0.5 && f.coherence >= 0.6 && f.horiz < 0.2, stripeB = !zebra && f.colShare >= 0.25 && f.colShare >= 2 * f.rowShare && f.sdFine < 15 && f.horiz < 0.25;
  // (every zebra pattern repeats down its band, and the geometric Roller screens are all repeating shapes; a drapery or Dream Curtains print repeats only if the photo shows it)
  const shapes = (!zebra || banded) && oblique >= (zebra ? 0.15 : 0.25) && !twill, repeats = zebra || line === 'roller' || (wide.coarsePeak ?? 0) >= 0.01 || (f.coarsePeak ?? 0) >= 0.01;
  const mesh = zebra && !banded ? f.peakShare >= 0.3 : f.peakShare >= (zebra ? 0.12 : 0.2) || (f.peakShare >= 0.16 && f.sdFine < 26), tweed = f.sdFine >= 26 && f.peakShare < 0.2, smooth = f.sdFine < 6.5;
  const flat = f.sdFine < 3.5;                                            // nothing to measure: any lattice or lines found in it are noise
  const rules = [
    ['smooth', flat, 0.6 + 0.4 * ramp(3.5 - f.sdFine, 0, 3), 'almost no structure'],
    ['twill', twill, 0.55 + 0.4 * ramp(f.coherence, 0.45, 0.8), 'clear diagonal lines'],
    ['slub', slubA || slubB || slubC || slubZ, slubA ? 0.5 + 0.5 * ramp(f.coherence, 0.68, 0.92) : slubB ? 0.45 + 0.3 * ramp(f.rowShare, 0.25, 0.6) : 0.5 + 0.4 * ramp(f.coherence, 0.6, 0.9), slubC ? 'lines down a folded sheet (they run across the shade)' : 'horizontal lines'],
    ['stripe', stripeA || stripeB, stripeA ? 0.6 + 0.4 * f.coherence : 0.4 + 0.4 * ramp(f.colShare, 0.25, 0.6), 'vertical lines'],
    [repeats ? 'motif' : 'print', shapes, 0.4 + 0.5 * ramp(oblique, 0.3, 0.7), repeats ? 'edges of a repeating shape' : 'edges of shapes that do not repeat in the photo'],
    ['mesh', mesh, 0.4 + 0.5 * ramp(f.peakShare, 0.2, 0.34), 'a sharp regular lattice'],
    ['tweed', tweed, 0.4 + 0.5 * ramp(f.sdFine, 26, 50), 'strong irregular contrast'],
    ['smooth', smooth, 0.4 + 0.5 * ramp(6.5 - f.sdFine, 0, 5), 'almost no structure'],
    ['linen', true, 0.45, 'soft irregular threads'],
  ];
  const hit = rules.filter((r) => r[1]);
  const [type, , strength, reason] = hit[0], next = hit[1] ? hit[1][0] : null, nextStrength = hit[1] ? hit[1][2] : 0;
  return { type, confidence: Math.max(0, Math.min(1, strength - (next && next !== 'linen' ? 0.35 * nextStrength : 0))), runnerUp: next, reason };
}

// ---- a whole photo -------------------------------------------------------------------------------------------------------------------------------------
// -> { type, confidence, runnerUp, reason, features, rect, band: { banded, ... } | null }. `line` decides how the photo is read:
//   zebra       the SOLID band's rows (a banded photo), else the flattest part (a folded sheet)
//   cellular    the photo is all pleat bands: every row is first brought to the same average, so what is left is the cloth's own grain
//   shangri-la  a photo of vanes in perspective: lines running along the vanes look diagonal, so diagonal reads as horizontal, and shapes and tweed are read as linen
//   others      the flattest part of the photo
import { analyzePhoto } from './textureAnalysis.js';
import { bandsOf, bandPatch } from './zebraPhoto.js';
import { flattenRows } from '../room/textureCore.js';
export function patchOfPhoto(rgb, w, h, { line = null } = {}) {
  let bands = null, rect;
  if (line === 'zebra') bands = bandsOf(rgb, w, h);
  if (bands?.banded) {
    // a square inside the tallest solid band (a band is wide and short: stretching it to a square would bend every direction and spacing)
    const [y0, y1] = bands.solidRows.slice().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0], bw = Math.ceil(w * 0.88) - Math.floor(w * 0.12), side = Math.max(8, Math.min(y1 - y0, bw));
    rect = { x: Math.floor(w * 0.12) + (bw - side) / 2, y: y0 + (y1 - y0 - side) / 2, side };
    return { patch: resamplePatch(rgb, w, h, rect), wide: null, bands, rect, how: 'band' };
  }
  const a = analyzePhoto(rgb, w, h); rect = a.rect;
  let patch = resamplePatch(rgb, w, h, rect);
  const sd = Math.min(w, h) * 0.84;
  let wide = resamplePatch(rgb, w, h, { x: (w - sd) / 2, y: (h - sd) / 2, side: sd });
  if (line === 'cellular') { patch = flattenRows(patch); wide = flattenRows(wide); }
  return { patch, wide, bands, rect, how: a.usable ? 'flat' : 'best' };
}
export function classifyPhoto(rgb, w, h, { line = null } = {}) {
  const { patch, wide, bands, rect, how } = patchOfPhoto(rgb, w, h, { line });
  const features = textureFeatures(patch), wideF = wide ? textureFeatures(wide) : null;
  let r = classifyTexture(features, wideF, { line, banded: !!bands?.banded });
  if (line === 'shangri-la') {
    if (r.type === 'twill') r = { ...r, type: 'slub', reason: 'lines along the vanes (they look diagonal in the photo)' };
    else if (['motif', 'print', 'tweed', 'mesh', 'stripe'].includes(r.type)) r = { ...r, type: features.sdFine < 6.5 ? 'smooth' : 'linen', confidence: Math.min(r.confidence, 0.3), reason: 'a photo of vanes in perspective: read as plain sheer cloth' };
  }
  if (line === 'zebra' && ['stripe'].includes(r.type)) r = { ...r, type: 'slub' };
  // a cellular photo is pleat bands; what is left after they are removed is faint (their soft edges leave horizontal traces), so only a visible grain counts
  if (line === 'cellular') r = features.sdFine < 6.5 || ['slub', 'stripe', 'twill'].includes(r.type) && features.sdFine < 9 ? { ...r, type: 'smooth', reason: 'plain cloth (the pleat bands of the photo are not texture)' } : ['motif', 'print', 'tweed', 'mesh', 'slub', 'stripe', 'twill'].includes(r.type) ? { ...r, type: 'linen', confidence: Math.min(r.confidence, 0.4), reason: 'a visible grain under the pleats' } : r;
  return { ...r, features, rect, bands, how };
}
