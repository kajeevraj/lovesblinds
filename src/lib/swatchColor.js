// The color a fabric shows as in the picker and in the 3D preview (one rule, so the two always agree).
//  1. An admin override on the color (swatches.preview_color) wins, as is.
//  2. Otherwise the swatch's own picture is read for its body color (the dominant shade, not the average: a photo of white weft on black
//     averages grey, but its body is black) and placed inside its color family: lightness is kept inside the family's band, the tint is
//     capped to what the family allows. So two greys differ, Jet Black stays black and a white stays white, not cream.
//  3. Until a picture has loaded (or when it cannot be read), the family's own color.
// Pure (no DOM): the browser feeds it pixels. `rgb` is a flat r,g,b,r,g,b... array.

// base: the family's color; L: allowed lightness band (0 to 255); chroma: the most any channel may sit off the grey of the same lightness;
// tint: the least (a beige stays beige even if its photo is grey); body: which part of the picture is the cloth (dark = its darker part,
// light = its lighter part, else all of it).
export const FAMILY_LOOK = {
  White: { base: [241, 240, 236], L: [236, 250], chroma: 4, tint: 0, body: 'light' },
  'Cream/Ivory': { base: [239, 229, 204], L: [212, 244], chroma: 34, tint: 22, body: 'light' },
  'Beige/Tan': { base: [205, 191, 159], L: [110, 225], chroma: 46, tint: 18 },
  Gray: { base: [157, 156, 158], L: [68, 214], chroma: 10, tint: 0 },
  'Charcoal/Black': { base: [48, 48, 50], L: [14, 56], chroma: 4, tint: 0, body: 'dark' },
  Brown: { base: [122, 96, 72], L: [45, 150], chroma: 60, tint: 30 },
  Blue: { base: [91, 122, 166], L: [70, 200], chroma: 80, tint: 40 },
  Green: { base: [118, 138, 106], L: [70, 200], chroma: 70, tint: 35 },
  'Pink/Red': { base: [190, 120, 120], L: [70, 205], chroma: 70, tint: 35 },
  Purple: { base: [140, 120, 160], L: [70, 200], chroma: 60, tint: 30 },
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

// The body color put inside the family: lightness clamped to the band, tint kept between the family's least and most.
export function deriveHex(rgb, family) {
  const f = look(family), d = bodyRGB(rgb, f.body);
  if (!d) return hexOf(f.base);
  const L = lumaOf(d), L2 = Math.max(f.L[0], Math.min(f.L[1], L));
  let ch = d.map((v) => v - L), top = Math.max(...ch.map(Math.abs));
  if (f.tint && top < f.tint) { const bc = f.base.map((v) => v - lumaOf(f.base)), w = 1 - top / f.tint; ch = ch.map((c, i) => c + bc[i] * w); top = Math.max(...ch.map(Math.abs)); }
  const s = top > f.chroma ? f.chroma / top : 1;
  return hexOf(ch.map((c) => L2 + c * s));
}

// What a color shows as: the admin's override, else the derived color, else the family's
export const previewHex = (override, derived, family) => (isHex(override) ? override.toLowerCase() : isHex(derived) ? derived : familyHex(family));

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
