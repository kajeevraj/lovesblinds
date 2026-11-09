// The color a fabric shows as in the picker and in the 3D preview (one rule, so the two always agree).
//  1. An admin override on the color (swatches.preview_color) wins, as is.
//  2. Otherwise the swatch's own picture is read for its body color (the dominant shade, not the average: a photo of white weft on black
//     averages grey, but its body is black) and placed inside its color family. Only LIGHTNESS is moved into the family's band: the photo's own hue and
//     saturation are kept. The family's minimum tint (a cream stays creamy even if its photo is grey) is added ONLY when the photo is near-neutral grey,
//     so a tint can never make a color warmer than a photo that has a color of its own. White and Cream have a saturation cap so they read as soft
//     off-whites, never yellow. So two greys differ, Jet Black stays black and a white stays white, not cream.
//  3. Until a picture has loaded (or when it cannot be read), the family's own color.
// Pure (no DOM): the browser feeds it pixels. `rgb` is a flat r,g,b,r,g,b... array.

// base: the family's color; L: allowed lightness band (0 to 255); chroma: the most any channel may sit off the grey of the same lightness;
// tint: kept for reference (the old channel-offset floor); tintC: the minimum Lab chroma given to a NEAR-NEUTRAL photo (its hue is the family base's);
// maxC: a Lab chroma cap (White and Cream only: soft off-whites); body: which part of the picture is the cloth (dark = its darker part,
// light = its lighter part, else all of it).
export const FAMILY_LOOK = {
  White: { base: [241, 240, 236], L: [236, 250], chroma: 4, tint: 0, maxC: 4, body: 'light' },
  'Cream/Ivory': { base: [239, 229, 204], L: [212, 244], chroma: 34, tint: 22, tintC: 7, maxC: 11, body: 'light' },
  'Beige/Tan': { base: [205, 191, 159], L: [110, 225], chroma: 46, tint: 18, tintC: 12 },
  Gray: { base: [157, 156, 158], L: [68, 214], chroma: 10, tint: 0 },
  'Charcoal/Black': { base: [48, 48, 50], L: [14, 56], chroma: 4, tint: 0, body: 'dark' },
  Brown: { base: [122, 96, 72], L: [45, 150], chroma: 60, tint: 30, tintC: 15 },
  Blue: { base: [91, 122, 166], L: [70, 200], chroma: 80, tint: 40, tintC: 14 },
  Green: { base: [118, 138, 106], L: [70, 200], chroma: 70, tint: 35, tintC: 12 },
  'Pink/Red': { base: [190, 120, 120], L: [70, 205], chroma: 70, tint: 35, tintC: 14 },
  Purple: { base: [140, 120, 160], L: [70, 200], chroma: 60, tint: 30, tintC: 12 },
  'Pattern/Multi': { base: [201, 193, 178], L: [100, 225], chroma: 30, tint: 0 },
};
const FALLBACK = { base: [207, 198, 182], L: [90, 230], chroma: 30, tint: 0 };
const look = (family) => FAMILY_LOOK[family] || FALLBACK;

export const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
export const hexOf = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const lumaOf = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
export const familyHex = (family) => hexOf(look(family).base);

// The body color of a picture. A supplier photo is not true to the cloth (white weft on black averages grey), so for a dark family the cloth is
// the darker part of the picture and for a light family the lighter part (55% of the pixels, when the picture has a clear spread); otherwise
// it is the average of all of it.
export function bodyRGB(rgb, body) {
  const n = rgb.length / 3; if (!n) return null;
  const idx = Array.from({ length: n }, (_, i) => i), Ls = idx.map((i) => 0.3 * rgb[i * 3] + 0.59 * rgb[i * 3 + 1] + 0.11 * rgb[i * 3 + 2]);
  let keep = idx;
  if (body) {
    const sorted = idx.slice().sort((x, y) => Ls[x] - Ls[y]);
    if (Ls[sorted[n - 1]] - Ls[sorted[0]] >= 50) keep = body === 'dark' ? sorted.slice(0, Math.ceil(n * 0.55)) : sorted.slice(Math.floor(n * 0.45));
  }
  const m = [0, 0, 0]; for (const i of keep) { m[0] += rgb[i * 3]; m[1] += rgb[i * 3 + 1]; m[2] += rgb[i * 3 + 2]; }
  return m.map((v) => v / keep.length);
}

// ---- Lab helpers (the same maths as src/lib/colorFamily.js, plus the way back to sRGB) ----
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const unlin = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const labOf = (r, g, b) => {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047, Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B, Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const srgbOfLab = (L, a, b) => {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X = 0.95047 * inv(fx), Y = L > 8 ? fy ** 3 : L / (24389 / 27), Z = 1.08883 * inv(fz);
  return [unlin(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z), unlin(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z), unlin(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z)];
};
// Lightness L and chroma C at hue h (radians) as sRGB; if that is outside the screen's range the chroma is reduced (the lightness and hue stay).
const lchToRgb = (L, C, h) => {
  const ok = (c) => c.every((v) => v >= -0.5 && v <= 255.5);
  let rgb = srgbOfLab(L, C * Math.cos(h), C * Math.sin(h));
  if (ok(rgb)) return rgb;
  let lo = 0, hi = C;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (ok(srgbOfLab(L, mid * Math.cos(h), mid * Math.sin(h)))) lo = mid; else hi = mid; }
  rgb = srgbOfLab(L, lo * Math.cos(h), lo * Math.sin(h));
  return rgb.map((v) => Math.max(0, Math.min(255, v)));
};
const lstarOfGrey = (g) => labOf(g, g, g)[0];

// A photo is "near-neutral grey" when its colorfulness (Lab chroma C*) is below this: a person calls it grey.
export const NEUTRAL_C = 3.5;

// The body color put inside the family. 1) lightness moves into the family's band; the photo's hue and saturation (Lab chroma) are KEPT.
// 2) Only when the photo is near-neutral grey does the family's minimum tint apply (a cream whose photo went grey is still creamy): it is then the
//    tint's own small chroma, never more than the family's cap. A photo that has a color of its own is never made warmer than it is.
// 3) White and Cream have a chroma cap (soft off-whites); every family also keeps its older per-channel cap.
export function deriveHex(rgb, family) {
  const f = look(family), d = bodyRGB(rgb, f.body);
  if (!d) return hexOf(f.base);
  let [L, a, b] = labOf(d[0], d[1], d[2]), C = Math.hypot(a, b), h = Math.atan2(b, a);
  L = Math.max(lstarOfGrey(f.L[0]), Math.min(lstarOfGrey(f.L[1]), L));
  if (f.tintC && C < NEUTRAL_C) { const [, ba, bb] = labOf(...f.base); C = f.tintC; h = Math.atan2(bb, ba); }
  if (f.maxC != null && C > f.maxC) C = f.maxC;
  const out = lchToRgb(L, C, h), Lc = lumaOf(out), ch = out.map((v) => v - Lc), top = Math.max(...ch.map(Math.abs));
  const s = top > f.chroma ? f.chroma / top : 1;
  return hexOf(ch.map((c) => Lc + c * s));
}

// Lab chroma of a hex color (used by the tests and the review list)
export const chromaOf = (hex) => { const [, a, b] = labOf(...rgbOf(hex)); return Math.hypot(a, b); };
export const lightnessOf = (hex) => labOf(...rgbOf(hex))[0];

// What a color shows as: the admin's override, else the derived color, else the family's
export const previewHex = (override, derived, family) => (isHex(override) ? override.toLowerCase() : isHex(derived) ? derived : familyHex(family));

// A Zebra swatch photo is banded (solid cloth and white sheer voile), so its color is the SOLID band's: the darker part of the picture, when the picture
// has a clear light/dark spread (a folded or whole-shade photo has none: all of it counts). Returns r,g,b bytes to hand to deriveHex.
export function bandPixels(rgb, line) {
  const n = rgb.length / 3;
  if (line !== 'zebra' || n < 16) return rgb;
  const idx = Array.from({ length: n }, (_, i) => i), Ls = idx.map((i) => 0.3 * rgb[i * 3] + 0.59 * rgb[i * 3 + 1] + 0.11 * rgb[i * 3 + 2]);
  const sorted = idx.slice().sort((x, y) => Ls[x] - Ls[y]);
  if (Ls[sorted[Math.floor(n * 0.95)]] - Ls[sorted[Math.floor(n * 0.05)]] < 35) return rgb;
  const keep = sorted.slice(0, Math.ceil(n * 0.35)), out = new Uint8ClampedArray(keep.length * 3);
  keep.forEach((i, k) => { out[k * 3] = rgb[i * 3]; out[k * 3 + 1] = rgb[i * 3 + 1]; out[k * 3 + 2] = rgb[i * 3 + 2]; });
  return out;
}

// A color distance for tests: CIE76 on sRGB (the same for two colors that look the same to a person, small for a few levels apart)
export function colorDistance(h1, h2) {
  const lab = (hex) => {
    const [r, g, b] = rgbOf(hex).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const A = lab(h1), B = lab(h2);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
