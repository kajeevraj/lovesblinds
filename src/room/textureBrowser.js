// The browser side of the fabric textures. ONE place decides what a fabric looks like, and the picker tile, the "This blind" chip, the 3D preview and
// the admin's live preview all call it, so they can never disagree:
//
//   resolveLook(look, { lit })  ->  { mode: 'photo' | 'pattern', hex, canvas }
//
//   hex     the color the fabric shows as: the admin's override, else the swatch picture's body color placed inside its color family (swatchColor.js)
//   mode    zebra: always 'pattern'. Otherwise the admin's setting (swatches.texture_mode), else decided from the photo (textureAnalysis.js)
//   canvas  256 x 256, seamless, centred on `hex`: 'photo' = the flattest part of the supplier photo, 'pattern' = a weave by fabric type (patternTexture.js)
//
// `look` is { id, line, family, composition, colorFamily, previewColor, textureMode, solidIn, sheerIn, tile, thumb, image, tex }.
// `lit: true` is for the 3D room: the room's light lifts and warms every cloth a little, so the texture is set a touch darker and cooler and the shade on
// screen lands on the swatch's own color (measured: rendered = 1.04 x texture + 8). The picker tiles are not lit, they are the color itself.
import { TEX, retarget, photoCropTexture } from './textureCore.js';
import { analyzePhoto } from '../lib/textureAnalysis.js';
import { patternRGB, zebraPattern, weaveKindOf } from '../lib/patternTexture.js';
import { deriveHex, previewHex, isHex, familyHex, bandPixels } from '../lib/swatchColor.js';
import { zebraBands } from './zebraBands.js';

const sizeOf = (s) => ({ W: s.naturalWidth || s.width, H: s.naturalHeight || s.height });
const rgbOf = (ctx, w, h) => { const d = ctx.getImageData(0, 0, w, h).data, out = new Uint8ClampedArray(w * h * 3); for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { out[j] = d[i]; out[j + 1] = d[i + 1]; out[j + 2] = d[i + 2]; } return out; };
const toCanvas = (rgb, w, h) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true }), out = ctx.createImageData(w, h);
  for (let i = 0, j = 0; i < out.data.length; i += 4, j += 3) { out.data[i] = rgb[j]; out.data[i + 1] = rgb[j + 1]; out.data[i + 2] = rgb[j + 2]; out.data[i + 3] = 255; }
  ctx.putImageData(out, 0, 0); return c;
};
// the pixels of any image source at its own size, as r,g,b bytes (optionally capped to `max` on the long side)
export function pixelsAt(src, max = 0) {
  const { W, H } = sizeOf(src), k = max ? Math.min(1, max / Math.max(W, H)) : 1, w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(src, 0, 0, w, h);
  return { rgb: rgbOf(ctx, w, h), w, h };
}
// Pixels of a picture as a flat r,g,b array at n x n, for reading its color.
export function pixelsOf(src, n = 64) {
  const { W, H } = sizeOf(src), c = document.createElement('canvas'); c.width = c.height = n;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, W, H, 0, 0, n, n);
  return rgbOf(ctx, n, n);
}

// ---- loading ---------------------------------------------------------------------------------------------------------------------------------
const imgs = new Map();
export function loadImage(url) {
  let p = imgs.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async'; i.onload = () => resolve(i); i.onerror = () => { imgs.delete(url); reject(new Error(`could not load ${url}`)); }; i.src = url; });
    imgs.set(url, p);
  }
  return p;
}

// ---- the color ------------------------------------------------------------------------------------------------------------------------------
// The color a swatch shows as, read once per swatch from its tile picture (the same picture everywhere, so every surface gets the same answer).
const hexes = new Map();
export function swatchHex(look) {
  const override = isHex(look.previewColor) ? look.previewColor.toLowerCase() : null;
  if (override) return Promise.resolve(override);
  let p = hexes.get(look.id);
  if (!p) {
    p = loadImage(look.tile || look.thumb || look.image).then((img) => previewHex(null, deriveHex(bandPixels(pixelsOf(img, 64), look.line), look.colorFamily), look.colorFamily), () => familyHex(look.colorFamily));
    hexes.set(look.id, p);
  }
  return p;
}
export const forgetHex = (id) => hexes.delete(id);

// ---- the mode -------------------------------------------------------------------------------------------------------------------------------
// 'pattern' for a zebra and when the admin says so; 'photo' when the admin says so; otherwise (not decided yet) the photo is looked at.
export function decideMode(look, photoRgb) {
  if (look.line === 'zebra') return 'pattern';
  if (look.textureMode === 'pattern' || look.textureMode === 'photo') return look.textureMode;
  if (!photoRgb) return 'photo';
  return analyzePhoto(photoRgb.rgb, photoRgb.w, photoRgb.h).mode;
}

// ---- the photo crop texture --------------------------------------------------------------------------------------------------------------------
// -> { canvas (256, seamless, not yet re-centred), analysis }. `src` is any image source: the swatch's full photo.
export function makeTextureCanvas(src) {
  const px = pixelsAt(src, 1000), analysis = analyzePhoto(px.rgb, px.w, px.h);
  return { canvas: toCanvas(photoCropTexture(px.rgb, px.w, px.h, analysis.rect), TEX, TEX), analysis };
}
export const textureBlob = (canvas) => new Promise((resolve) => canvas.toBlob((b) => resolve(b && b.type === 'image/webp' ? b : null), 'image/webp', 0.8));

// the ready-made texture (tex256/ in the bucket) if there is one, else made here from the full photo
const crops = new Map();
function cropTexture(look, small) {
  const key = `${look.id}|${small ? 's' : 'f'}`;
  let p = crops.get(key);
  if (!p) {
    const make = () => loadImage((small ? look.thumb : look.image) || look.image || look.thumb).then((img) => makeTextureCanvas(img).canvas);
    p = (look.tex ? loadImage(look.tex).catch(make) : make());
    crops.set(key, p);
  }
  return p;
}

// ---- tuning to a color ---------------------------------------------------------------------------------------------------------------------------
const LIGHT_GAIN = 1.04, LIGHT_LIFT = 8, ZEBRA_GAIN = 0.92;     // a zebra's solid band is lit less (rendered = 0.92 x texture)
const WARMTH = [1, 1.02, 1.055];
export function targetFor(hex, { lit = false, zebra = false } = {}) {
  return [1, 3, 5].map((i, k) => { const v = parseInt(hex.slice(i, i + 2), 16); return lit ? Math.min(255, Math.max(0, (zebra ? v / ZEBRA_GAIN : (v - LIGHT_LIFT) / LIGHT_GAIN) * WARMTH[k])) : v; });
}
export const litHex = (hex, zebra = false) => `#${targetFor(hex, { lit: true, zebra }).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function weaveOf(look) { return weaveKindOf({ line: look.line, family: look.family, composition: look.composition }); }

// The pattern canvas for a weave in a color (zebra: one stripe period, solid on top). Also returns the solid band's rows.
export function patternCanvas(weave, hex, bands) {
  if (weave === 'zebra') { const z = zebraPattern(hex, bands.split, TEX); return { canvas: toCanvas(z.rgb, TEX, TEX), rows: z.rows }; }
  return { canvas: toCanvas(patternRGB(weave, hex, TEX), TEX, TEX), rows: 0 };
}

// Everything above in one call. `look.textureMode` may be forced for a preview ({ ...look, textureMode: 'pattern' }).
// `small: true` (the picker tiles) reads the 320 px thumbnail instead of the full photo when a color has no stored setting or ready-made texture yet,
// so a grid of tiles stays light; once a color has its setting and its tex256/ texture (the backfill) both read the same small texture file.
export async function resolveLook(look, { lit = false, small = false } = {}) {
  const zebra = look.line === 'zebra', hex = await swatchHex(look), bands = zebraBands({ solidIn: look.solidIn, sheerIn: look.sheerIn });
  let mode = look.textureMode === 'pattern' || look.textureMode === 'photo' || zebra ? decideMode(look, null) : null;
  if (!mode) {                                                       // not decided yet: look at the photo (the tile picture is enough to tell)
    try { mode = decideMode(look, pixelsAt(await loadImage((small ? look.thumb : look.image) || look.image || look.thumb), 1000)); } catch { mode = 'photo'; }
  }
  const target = lit ? litHex(hex, zebra) : hex;
  if (mode === 'pattern') {
    const { canvas, rows } = patternCanvas(weaveOf(look), target, bands);
    return { mode, hex, canvas, weave: weaveOf(look), bands, rows };
  }
  const crop = await cropTexture(look, small), c = document.createElement('canvas'); c.width = c.height = TEX;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(crop, 0, 0, TEX, TEX);
  const out = retarget(rgbOf(ctx, TEX, TEX), targetFor(hex, { lit }));
  return { mode, hex, canvas: toCanvas(out, TEX, TEX), weave: weaveOf(look), bands, rows: 0 };
}

// The same, as a "look" description built from a catalog swatch (what the customer pages and the room use)
export const lookOfSwatch = (s) => ({
  id: s.id, line: s.line, family: s.family, composition: s.specs?.composition, colorFamily: s.colorFamily, previewColor: s.previewColor,
  textureMode: s.textureMode, solidIn: s.zebraSolidIn, sheerIn: s.zebraSheerIn, tile: s.tile, thumb: s.thumb, image: s.image, tex: s.tex,
});

