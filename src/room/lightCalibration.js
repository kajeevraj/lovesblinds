// The product-page preview's light, calibrated per fabric type. The shade's face is not the texture's color: the light, the daylight glow and (screen view) the
// window behind it change it. For each type the render is a straight line per channel:  face = a x texture + b  (measured by scripts/calibrate-shade-light.mjs on
// real renders of 13 known colors, residual under 2 levels). The texture is aimed at the INVERSE: texture = (tile color - b) / a, so that the lit face of the
// shade shows its preview color as it is (neutral whites stay neutral). The lights are neutral white (the wall keeps its warm color); the types differ only in
// how much daylight glows through their cloth (data.js optics).
//
import { screenOpacity } from './optics.js';

// Types: 'solar', 'screen-view', 'blackout' (roller families) and 'zebra' (its solid band). Anything else uses the solar line.
export const LIGHT = {
  solar: { a: [1.0425, 1.0407, 1.039], b: [9.05, 9.19, 9.54] },
  blackout: { a: [1.0425, 1.0407, 1.039], b: [9.05, 9.19, 9.54] },       // the same face as solar: a blackout blocks the light BEHIND it, not the one on its face
  zebra: { a: [0.9645, 0.9641, 0.9639], b: [6.69, 6.7, 6.71] },          // the solid band
  // screen view is drawn partly see-through (src/room/optics.js screenOpacity, decided by the color): its face is that opacity of the cloth (the solar line) plus
  // the rest of the window behind it (`bg`, the sky seen through the mesh)
  'screen-view': { a: [1.0425, 1.0407, 1.039], b: [9.05, 9.19, 9.54], bg: [202.2, 209.7, 215.6], opacity: 0.72 },
};
export const typeOfLook = (look) => (look.line === 'zebra' ? 'zebra' : look.family === 'screen-view' || look.family === 'blackout' ? look.family : 'solar');

// the texture color ([r,g,b], 0..255) that makes the lit face of a shade of `type` show `hex`
export function litTarget(hex, type = 'solar') {
  const t = LIGHT[type] || LIGHT.solar, al = t.bg ? screenOpacity(t.opacity, hex) : 1;
  return [1, 3, 5].map((i, c) => {
    const want = parseInt(hex.slice(i, i + 2), 16), cloth = t.bg ? (want - (1 - al) * t.bg[c]) / al : want;      // what the cloth itself must show
    return Math.min(255, Math.max(0, (cloth - t.b[c]) / t.a[c]));
  });
}
// the face a texture color produces (the forward line; used by the tests to check the table against a real render)
export const faceOf = (rgb, type = 'solar', hex = null) => { const t = LIGHT[type] || LIGHT.solar, al = t.bg && hex ? screenOpacity(t.opacity, hex) : 1; return rgb.map((v, c) => al * (t.a[c] * v + t.b[c]) + (1 - al) * (t.bg ? t.bg[c] : 0)); };
