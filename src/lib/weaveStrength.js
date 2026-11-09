// How visible a fabric's weave is in the 3D preview and on the picker tile. Pure functions on RGB bytes.
//
//  * weaveStats(rgb): the contrast the photo's weave actually has (luminance spread of the flat, seamless crop) and its dominant thread period in texture pixels.
//  * desiredSd(...): the contrast to draw. "Auto" is the photo's own contrast, held back only where more would clip against black or white (a black fabric can swing
//    up, not down), so a strong weave (Jet Black: white weft on black) shows clearly and a smooth blackout stays smooth. The admin's per-color "Weave strength" is a
//    multiple of that (empty = auto = 1).
//  * weaveTileMetres(...): the weave is drawn at a size that reads on the shade as it is on screen (a few pixels per thread repeat), whatever the screen: a real
//    thread is under a millimetre, which would melt into flat colour at the size the shade is shown, so the weave is magnified to a readable size (and kept
//    large enough that the texture's mipmaps never beat against the screen pixels, which is what moire is).
// The shade's AVERAGE color is never affected: the contrast is applied around the target color (textureCore.js retargetWeave keeps the mean).
import { TEX } from '../room/textureCore.js';

export const DISPLAY = { periodPx: 3.6, minM: 0.008, maxM: 0.03, tileMin: 0.075, tileMax: 1.2, fallbackPxPerM: 236 };
export const STRENGTH = { min: 0, max: 3 };
// Auto is a little over HALF of the contrast the photo itself would draw: measured on screen, the full contrast read as bold stripes on Jet Black, Onyx Black and
// Flint Gray (fine contrast 16 to 20); 0.7 of it (a fine contrast of about 8 to 12) is a fine woven texture that is still clearly not flat. The admin's slider is a
// multiple of this auto.
export const AUTO_WEAVE = 0.7;
// A photo is a small physical sample of cloth, about 10 cm across, so a photo-crop texture covers about 10 cm of shade (never more than 12 cm, never less than
// 7.5 cm): a 40 in shade shows the pattern 8.5 to 13.5 times across, whatever the fabric. Inside that range a fine weave is drawn as large as it can be so that its
// threads still read on screen.
export const SAMPLE_M = { min: 0.075, max: 0.12 };            // the admin's multiple of auto: 0 = flat, 1 = auto, 3 = three times

const lumOf = (rgb) => { const n = rgb.length / 3, l = new Float32Array(n); for (let i = 0, j = 0; i < n; i++, j += 3) l[i] = 0.3 * rgb[j] + 0.59 * rgb[j + 1] + 0.11 * rgb[j + 2]; return l; };

// dominant repeat of the weave (texture pixels) from the autocorrelation of its rows and columns; null when there is none (smooth cloth, a print)
function dominantPeriod(l, size) {
  const maxLag = Math.min(64, size >> 2), corr = new Float32Array(maxLag + 1);
  const rowCols = [];
  for (let k = 0; k < 24; k++) rowCols.push(Math.floor((k + 0.5) * size / 24));
  for (const axis of [0, 1]) for (const k of rowCols) {
    const line = new Float32Array(size); let m = 0;
    for (let i = 0; i < size; i++) { line[i] = axis === 0 ? l[k * size + i] : l[i * size + k]; m += line[i]; }
    m /= size; let v = 0; for (let i = 0; i < size; i++) { line[i] -= m; v += line[i] * line[i]; }
    if (v < 1e-6) continue;
    for (let lag = 1; lag <= maxLag; lag++) { let c = 0; for (let i = 0; i + lag < size; i++) c += line[i] * line[i + lag]; corr[lag] += c / v; }
  }
  // the first clear peak after the correlation has first fallen below zero (or well below its start)
  let lag = 2; while (lag < maxLag && corr[lag] > corr[lag + 1] - 1e-9 && corr[lag] > 0) lag++;     // walk down the first slope
  let best = 0, bl = 0; for (let k = Math.max(2, lag); k <= maxLag; k++) if (corr[k] > best && corr[k] >= corr[k - 1] && corr[k] >= corr[k + 1 > maxLag ? maxLag : k + 1]) { best = corr[k]; bl = k; }
  return best > 0.2 * 48 * 0.35 ? bl : null;       // 48 = lines summed; a peak under a third of a fifth is noise
}

// How much of the contrast is ONE-directional (horizontal or vertical rows of thread: stripes): the spread of the row (or column) averages over the spread of the
// whole picture. About 0.85 for a solar weave of white thread on black or a stripe, about 0.2 for a printed shape pattern (a mosaic, a trellis).
function lineness(l, size, total) {
  const rows = new Float64Array(size), cols = new Float64Array(size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = l[y * size + x]; rows[y] += v / size; cols[x] += v / size; }
  const sdOf = (a) => { let m = 0; for (const v of a) m += v; m /= a.length; let t = 0; for (const v of a) t += (v - m) ** 2; return Math.sqrt(t / a.length); };
  return total > 0 ? Math.max(sdOf(rows), sdOf(cols)) / total : 0;
}

export function weaveStats(rgb, size = TEX) {
  const l = lumOf(rgb), n = l.length; let m = 0; for (const v of l) m += v; m /= n;
  let v = 0; for (const x of l) v += (x - m) ** 2;
  const sd = Math.sqrt(v / n);
  return { sd, period: dominantPeriod(l, size), lines: lineness(l, size, sd) };
}

// the most contrast a color can carry around its average without much of it clipping against black or white
export const headroomSd = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), L = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return 0.55 * Math.min(L, 255 - L) + 4; };

// Dark thread weaves (white thread on black) lose more of their contrast on screen than mid tones do: the same texture contrast is a darker, finer picture that the
// mipmaps flatten sooner. So the rows-of-thread auto is raised as the color gets darker (x1.6 at lightness 30 or below, none from 130 up): Jet Black and Onyx Black then
// read like Flint Gray (a fine contrast of 11 to 12 on a desktop).
export const DARK_BOOST = { full: 30, none: 130, gain: 0.6 };
// A printed shape pattern (Bark Brown's mosaic) is drawn at this multiple of the photo's contrast so the shapes read at normal desktop size.
export const SHAPE_GAIN = 1.4;
const lightnessOf = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; };

// strength: the admin's multiple (null / undefined = auto = 1)
export function desiredSd(photoSd, hex, strength = null, lines = 1) {
  const m = Number.isFinite(strength) ? Math.min(STRENGTH.max, Math.max(STRENGTH.min, strength)) : 1;
  const shape = Math.min(1, Math.max(0, (0.6 - lines) / 0.3));                    // 0: rows of thread / stripes, 1: a printed shape pattern (lines near 0.2)
  const dark = 1 + DARK_BOOST.gain * Math.min(1, Math.max(0, (DARK_BOOST.none - lightnessOf(hex)) / (DARK_BOOST.none - DARK_BOOST.full)));
  const auto = AUTO_WEAVE * dark + (SHAPE_GAIN - AUTO_WEAVE * dark) * shape;
  return Math.min(photoSd, headroomSd(hex), 24) * auto * m;     // 24: a very strong weave on a mid grey would drift the average (the screen averages in linear light)
}

// metres of cloth one 256 px texture covers, so that the weave repeat is DISPLAY.periodPx screen pixels on the shade (pxPerMeter: css pixels per metre at the shade)
export function weaveTileMetres(periodTexPx, pxPerMeter = DISPLAY.fallbackPxPerM, { photo = false } = {}) {
  if (!periodTexPx) return photo ? 0.1 : DISPLAY.tileMin;
  const periodM = Math.min(DISPLAY.maxM, Math.max(DISPLAY.minM, DISPLAY.periodPx / Math.max(20, pxPerMeter)));
  const t = (periodM * TEX) / periodTexPx;
  return photo ? Math.min(SAMPLE_M.max, Math.max(SAMPLE_M.min, t)) : Math.min(DISPLAY.tileMax, Math.max(DISPLAY.tileMin, t));
}
