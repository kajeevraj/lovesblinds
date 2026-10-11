// Shared color math for the color-family script and its review report.
import sharp from 'sharp';

const srgb2lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function rgb2lab(r, g, b) {
  const R = srgb2lin(r), G = srgb2lin(g), B = srgb2lin(b);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const Y = (0.2126729 * R + 0.7151522 * G + 0.0721750 * B);
  const Z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// Center area only (the middle half of the tile), so edges, borders and shadows do not count.
export async function centerStats(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const x0 = Math.round(W * 0.25), x1 = Math.round(W * 0.75), y0 = Math.round(H * 0.25), y1 = Math.round(H * 0.75);
  const labs = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * W + x) * C;
    labs.push(rgb2lab(data[i], data[i + 1], data[i + 2]));
  }
  const n = labs.length;
  const mean = [0, 1, 2].map(k => labs.reduce((s, l) => s + l[k], 0) / n);
  const dE = labs.map(l => Math.hypot(l[0] - mean[0], l[1] - mean[1], l[2] - mean[2]));
  const meanDE = dE.reduce((s, v) => s + v, 0) / n;
  const sortedL = labs.map(l => l[0]).sort((a, b) => a - b);
  const spreadL = sortedL[Math.floor(n * 0.95)] - sortedL[Math.floor(n * 0.05)];
  // Hue spread: how many pixels sit far (in a/b) from the mean color.
  const farAB = labs.filter(l => Math.hypot(l[1] - mean[1], l[2] - mean[2]) > 14).length / n;
  return { lab: mean, meanDE, spreadL, farAB };
}

// ---- Families -------------------------------------------------------------
import { COLOR_FAMILY_LIST } from '../src/data/colorFamilyList.js';
export const FAMILIES = COLOR_FAMILY_LIST;

// Mean ΔE above this inside the center area means the tile shows real pattern, not just fabric texture.
export const PATTERN_DE = 18;

export function familyFromLab([L, a, b]) {
  const C = Math.hypot(a, b);
  const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  const warm = h >= 35 && h < 115;
  const neutral = (c) => (L >= 82 ? 'White' : L >= 45 ? 'Gray' : 'Charcoal/Black');
  if (C < 4 || (C < 7 && !warm)) return neutral(C);
  if (L >= 86 && C < 9) return 'White';
  if (L < 28 && C < 25) return 'Charcoal/Black';
  if (warm) {                                    // yellow / orange / tan / brown
    if (L >= 82) return C < 5.5 ? 'White' : 'Cream/Ivory';
    if (C <= 26) { if (L >= 58) return 'Beige/Tan'; if (L >= 32) return 'Brown'; return 'Charcoal/Black'; }
    return L >= 45 ? 'Beige/Tan' : 'Brown';
  }
  if (h >= 115 && h < 185) return 'Green';
  if (h >= 185 && h < 290) return C < 9 ? neutral(C) : 'Blue';
  if (h >= 330 || h < 35) return (L < 45 && C < 22) ? 'Brown' : 'Pink/Red';
  return 'Purple';                               // 290-330: purple / mauve / lilac
}

// Zebra tiles are always banded (sheer white bands + a colored band), so they are classified by the
// colored band: the darker half of the center pixels. Everything else uses the whole center area.
export async function classifyFile(file, line) {
  const st = await centerStats(file);
  let lab = st.lab;
  if (line === 'zebra' && st.spreadL > 35) {
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: Ch } = info;
    const px = [];
    for (let y = Math.round(H * .25); y < Math.round(H * .75); y++) for (let x = Math.round(W * .25); x < Math.round(W * .75); x++) {
      const i = (y * W + x) * Ch; px.push(rgb2lab(data[i], data[i + 1], data[i + 2]));
    }
    px.sort((p, q) => p[0] - q[0]);
    const dark = px.slice(0, Math.floor(px.length * 0.3));   // darkest 30%: the solid band
    lab = [0, 1, 2].map(k => dark.reduce((s, p) => s + p[k], 0) / dark.length);
  }
  const pattern = line !== 'zebra' && st.meanDE >= PATTERN_DE;
  return { family: pattern ? 'Pattern/Multi' : familyFromLab(lab), lab, meanDE: st.meanDE };
}
