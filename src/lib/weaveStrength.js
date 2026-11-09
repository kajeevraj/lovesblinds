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
export const STRENGTH = { min: 0, max: 3 };            // the admin's multiple of auto: 0 = flat, 1 = auto, 3 = three times

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

export function weaveStats(rgb, size = TEX) {
  const l = lumOf(rgb), n = l.length; let m = 0; for (const v of l) m += v; m /= n;
  let v = 0; for (const x of l) v += (x - m) ** 2;
  return { sd: Math.sqrt(v / n), period: dominantPeriod(l, size) };
}

// the most contrast a color can carry around its average without much of it clipping against black or white
export const headroomSd = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), L = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return 0.55 * Math.min(L, 255 - L) + 4; };

// strength: the admin's multiple (null / undefined = auto = 1)
export function desiredSd(photoSd, hex, strength = null) {
  const m = Number.isFinite(strength) ? Math.min(STRENGTH.max, Math.max(STRENGTH.min, strength)) : 1;
  return Math.min(photoSd, headroomSd(hex)) * m;
}

// metres of cloth one 256 px texture covers, so that the weave repeat is DISPLAY.periodPx screen pixels on the shade (pxPerMeter: css pixels per metre at the shade)
export function weaveTileMetres(periodTexPx, pxPerMeter = DISPLAY.fallbackPxPerM) {
  if (!periodTexPx) return DISPLAY.tileMin;
  const periodM = Math.min(DISPLAY.maxM, Math.max(DISPLAY.minM, DISPLAY.periodPx / Math.max(20, pxPerMeter)));
  return Math.min(DISPLAY.tileMax, Math.max(DISPLAY.tileMin, (periodM * TEX) / periodTexPx));
}
