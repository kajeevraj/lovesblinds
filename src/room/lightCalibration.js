// The product-page preview's light, calibrated per fabric type. The shade's face is not the texture's color: the light, the daylight glow and (screen view) the
// window behind it change it. For each type the render is a straight line per channel:  face = a x texture + b  (measured by scripts/calibrate-shade-light.mjs on
// real renders of 13 known colors, residual under 2 levels). The texture is aimed at the INVERSE: texture = (tile color - b) / a, so that the lit face of the
// shade shows its preview color as it is (neutral whites stay neutral). The lights are neutral white (the wall keeps its warm color); the types differ only in
// how much daylight glows through their cloth (data.js optics).
//
// Types: 'solar', 'screen-view', 'blackout' (roller families) and 'zebra' (its solid band). Anything else uses the solar line.
export const LIGHT = {
  solar: { a: [1, 1, 1], b: [0, 0, 0] },
  'screen-view': { a: [1, 1, 1], b: [0, 0, 0] },
  blackout: { a: [1, 1, 1], b: [0, 0, 0] },
  zebra: { a: [1, 1, 1], b: [0, 0, 0] },
};
export const typeOfLook = (look) => (look.line === 'zebra' ? 'zebra' : look.family === 'screen-view' || look.family === 'blackout' ? look.family : 'solar');

// the texture color ([r,g,b], 0..255) that makes the lit face of a shade of `type` show `hex`
export function litTarget(hex, type = 'solar') {
  const t = LIGHT[type] || LIGHT.solar;
  return [1, 3, 5].map((i, c) => Math.min(255, Math.max(0, (parseInt(hex.slice(i, i + 2), 16) - t.b[c]) / t.a[c])));
}
// the face a texture color produces (the forward line; used by the tests to check the table against a real render)
export const faceOf = (rgb, type = 'solar') => { const t = LIGHT[type] || LIGHT.solar; return rgb.map((v, c) => t.a[c] * v + t.b[c]); };
