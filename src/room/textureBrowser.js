// The browser side of the fabric textures. ONE place decides what a fabric looks like, and the picker tile, the "This blind" chip, the 3D preview and
// the admin's live preview all call it, so they can never disagree:
//
//   resolveLook(look, { lit })  ->  { mode: 'photo' | 'pattern', hex, canvas }
//
//   hex     the color the fabric shows as: the admin's override, else the swatch picture's body color placed inside its color family (swatchColor.js)
//   mode    zebra: always 'pattern'. Otherwise the admin's setting (swatches.texture_mode), else decided from the photo (textureAnalysis.js)
//   canvas  256 x 256, seamless, centred on `hex`: 'photo' = the flattest part of the supplier photo, 'pattern' = a weave by fabric type (patternTexture.js)
//
// What a fabric is drawn from (texture type and source, see src/lib/textureType.js):
//   generated  the cloth is DRAWN from what the photo measures (src/lib/textureGen.js): slub streaks, fine mesh or basketweave, twill, linen look, vertical stripe, smooth
//   photo      the flat part of the photo is cut out and made to tile: a tweed (mixed-color threads), a geometric motif, a print or jacquard
// The type is the color's stored one (swatches.texture_type), else the measured one bundled with the site (src/data/textureTypes.json), else linen. The source is the admin's
// choice (swatches.texture_source), else by type. An admin-chosen weave (Products > Colors > Texture > Weave, e.g. the sheer open weave) keeps the older generic drawings.
// A Zebra's solid band is drawn the same way from the photo's SOLID band, and its sheer band takes the photo's own sheer color.
//
// `look` is { id, line, family, composition, colorFamily, previewColor, textureType, textureSource, solidIn, sheerIn, tile, thumb, image, tex }.
// `lit: true` is for the 3D room: the room's light lifts and warms every cloth a little, so the texture is set a touch darker and cooler and the shade on
// screen lands on the swatch's own color (measured: rendered = 1.04 x texture + 8). The picker tiles are not lit, they are the color itself.
import { TEX, retargetWeave, photoCropTexture, flattenRows } from './textureCore.js';
import { weaveStats, desiredSd } from '../lib/weaveStrength.js';
import { analyzePhoto } from '../lib/textureAnalysis.js';
import { patternRGB, patternAlpha, zebraPattern, weaveKindOf, PATTERN_PERIOD, WEAVE_CHOICES } from '../lib/patternTexture.js';
import { deriveHex, previewHex, isHex, familyHex, bandPixels, hexOf } from '../lib/swatchColor.js';
import { zebraBands } from './zebraBands.js';
import { litTarget, typeOfLook } from './lightCalibration.js';
import { patchOfPhoto, defaultSource, isTextureType, zebraColors } from '../lib/textureType.js';
import { measureFabric, drawFabric, periodOf, seedOf } from '../lib/textureGen.js';
import STATIC_TYPES from '../data/textureTypes.json';

const sizeOf = (s) => ({ W: s.naturalWidth || s.width, H: s.naturalHeight || s.height });
const rgbOf = (ctx, w, h) => { const d = ctx.getImageData(0, 0, w, h).data, out = new Uint8ClampedArray(w * h * 3); for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { out[j] = d[i]; out[j + 1] = d[i + 1]; out[j + 2] = d[i + 2]; } return out; };
const toCanvas = (rgb, w, h, alpha = null) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true }), out = ctx.createImageData(w, h);
  for (let i = 0, j = 0; i < out.data.length; i += 4, j += 3) { out.data[i] = rgb[j]; out.data[i + 1] = rgb[j + 1]; out.data[i + 2] = rgb[j + 2]; out.data[i + 3] = alpha ? alpha[i / 4] : 255; }
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
    if (look.line === 'zebra') p = zebraInfo(look).then((z) => (z ? z.hex : familyHex(look.colorFamily)));
    else p = loadImage(look.tile || look.thumb || look.image).then((img) => previewHex(null, deriveHex(bandPixels(pixelsOf(img, 64), look.line), look.colorFamily), look.colorFamily), () => familyHex(look.colorFamily));
    hexes.set(look.id, p);
  }
  return p;
}
export const forgetHex = (id) => { hexes.delete(id); zinfos.delete(id); };

// ---- a Zebra photo --------------------------------------------------------------------------------------------------------------------------------------
// The color a zebra shows is its SOLID band's own, as the photo shows it (the white sheer bands must not lift it): the average of the solid band's pixels. Only a White or
// Cream zebra goes through the family rules (a soft white, never yellow); every other color is exactly what the photo shows, however dark. A photo that is not banded
// (a folded sheet) is read in its flattest part. The sheer band's color is the photo's own sheer band, when there is one.
const zinfos = new Map();
export function zebraInfo(look) {
  let p = zinfos.get(look.id);
  if (!p) {
    p = loadImage(look.thumb || look.tile || look.image).then((img) => { const px = pixelsAt(img, 0), z = zebraColors(px.rgb, px.w, px.h, look.colorFamily); return { hex: z.hex, sheerHex: z.sheerHex, banded: z.banded, px }; }, () => null);
    zinfos.set(look.id, p);
  }
  return p;
}

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
// `fresh` (the 3D shade): always cut from the full photo with the current recipe, so the shade repeats with no seam whatever recipe the stored file was made with.
function cropTexture(look, small, fresh = false) {
  const key = `${look.id}|${small ? 's' : 'f'}${fresh ? 'n' : ''}`;
  let p = crops.get(key);
  if (!p) {
    const make = () => loadImage((small ? look.thumb : look.image) || look.image || look.thumb).then((img) => makeTextureCanvas(img).canvas);
    p = fresh ? make().catch(() => (look.tex ? loadImage(look.tex) : Promise.reject(new Error('no photo')))) : (look.tex ? loadImage(look.tex).catch(make) : make());
    crops.set(key, p);
  }
  return p;
}

// ---- tuning to a color ---------------------------------------------------------------------------------------------------------------------------
// `lit: true` is for the 3D preview: the texture is aimed at the inverse of that type's calibrated light (src/room/lightCalibration.js), so the lit face of the
// shade shows `hex` as it is. The picker tiles are not lit, they are the color itself.
export function targetFor(hex, { lit = false, type = 'solar' } = {}) {
  return lit ? litTarget(hex, type) : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
export const litHex = (hex, type = 'solar') => `#${litTarget(hex, type).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function weaveOf(look) { return weaveKindOf({ line: look.line, family: look.family, composition: look.composition, weave: look.weave }); }

// The pattern canvas for a weave in a color (zebra: one stripe period, solid on top). Also returns the solid band's rows.
export function patternCanvas(weave, hex, bands, strength = 1) {
  if (weave === 'zebra') { const z = zebraPattern(hex, bands.split, TEX, { strength }); return { canvas: toCanvas(z.rgb, TEX, TEX), rows: z.rows }; }
  const alpha = patternAlpha(weave, TEX);                          // a sheer open weave is see-through between its threads
  return { canvas: toCanvas(patternRGB(weave, hex, TEX, { strength }), TEX, TEX, alpha), rows: 0, sheer: !!alpha };
}

// The type a color is drawn as: its stored one, else the measured one bundled with the site, else linen (soft irregular threads).
export const typeOfSwatch = (look) => (isTextureType(look.textureType) ? look.textureType : isTextureType(STATIC_TYPES[look.id]) ? STATIC_TYPES[look.id] : 'linen');
// generated or photo: the admin's choice, else by type
export const sourceOfSwatch = (look) => (look.textureSource === 'generated' || look.textureSource === 'photo' ? look.textureSource : defaultSource(typeOfSwatch(look)));
// the irregular cloths the 3D shade lays out with a random offset per patch (src/room/models/common.js), so no tile of it ever shows twice in a row
export const STOCHASTIC_TYPES = ['slub', 'linen', 'smooth'];
export const isStochastic = (look) => look.line !== 'zebra' && !WEAVE_CHOICES.includes(look.weave) && sourceOfSwatch(look) === 'generated' && STOCHASTIC_TYPES.includes(typeOfSwatch(look));

// the cloth is drawn at this size for a tile (they are 52 px) and at TEX for the 3D shade; either way the canvas handed back is TEX x TEX
const SMALL_N = 64;
const upscale = (c, n) => { if (n === TEX) return c; const o = document.createElement('canvas'); o.width = o.height = TEX; const x = o.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, TEX, TEX); return o; };
const measures = new Map();
// what the photo's fabric is like, measured once per color and size (the photo is the 320 px thumbnail, so a tile and the 3D shade measure the same picture)
async function fabricOf(look, n) {
  const key = `${look.id}|${n}|${look.line}`;
  let p = measures.get(key);
  if (!p) {
    p = loadImage(look.thumb || look.tile || look.image).then((img) => { const px = pixelsAt(img, 0), { patch } = patchOfPhoto(px.rgb, px.w, px.h, { line: look.line, n }); return { m: measureFabric(patch, n), patch }; });
    measures.set(key, p); p.catch(() => measures.delete(key));
  }
  return p;
}
export const forgetFabric = (id) => { for (const k of [...measures.keys()]) if (k.startsWith(`${id}|`)) measures.delete(k); };

// How many stripe periods tall a zebra's solid-band picture is for the 3D shade: each period gets its own cloth, so the bands of a shade are not copies of one another.
export const ZEBRA_PERIODS = 3;

// Everything above in one call. `look.textureMode` is no longer read (it was the older Photo crop / Pattern choice).
// `small: true` (the picker tiles) draws at 64 px and reads the thumbnail only.
export async function resolveLook(look, { lit = false, small = false } = {}) {
  const zebra = look.line === 'zebra', hex = await swatchHex(look), bands = zebraBands({ solidIn: look.solidIn, sheerIn: look.sheerIn });
  const ltype = typeOfLook(look), target = lit ? litHex(hex, ltype) : hex, ttype = typeOfSwatch(look), source = sourceOfSwatch(look), n = small ? SMALL_N : TEX;
  const strength = Number.isFinite(look.weaveStrength) ? look.weaveStrength : 1;
  const handWeave = !zebra && WEAVE_CHOICES.includes(look.weave);
  // ---- an admin-chosen weave: the older generic drawings (the sheer open weave, a fine basketweave ...)
  if (handWeave) {
    const { canvas, rows, sheer } = patternCanvas(look.weave, target, bands, strength);
    return { mode: 'pattern', source: 'generated', ttype, hex, canvas, weave: look.weave, bands, rows, sheer: !!sheer, period: PATTERN_PERIOD[look.weave] || null, periods: 1 };
  }
  // ---- a Zebra: the solid band is drawn (or cut out) in the photo's solid color, the sheer band is the photo's own sheer color
  if (zebra) {
    const info = await zebraInfo(look), sheerHex = info?.sheerHex || null, sheerTarget = sheerHex ? (lit ? litHex(sheerHex, 'zebra') : sheerHex) : null;
    const photoZ = look.textureSource === 'photo', zn = photoZ ? TEX : n;      // (a zebra is cut out of its photo only when the admin chose Photo by hand)
    const drawType = zebraDrawType(ttype), periods = lit && !small && !photoZ && STOCHASTIC_TYPES.includes(drawType) ? ZEBRA_PERIODS : 1;
    let fab = null; try { fab = await fabricOf(look, zn); } catch { fab = null; }
    if (!fab) { const { canvas, rows, sheer } = patternCanvas('zebra', target, bands, strength); return { mode: 'pattern', source: 'generated', ttype, hex, canvas, weave: 'zebra', bands, rows, sheer: !!sheer, period: null, periods: 1 }; }
    const { m, patch } = fab, tall = document.createElement('canvas'); tall.width = TEX; tall.height = TEX * periods; const tctx = tall.getContext('2d', { willReadFrequently: true });
    let first = null;
    for (let k = 0; k < periods; k++) {
      let raw, period = null;
      if (photoZ) raw = photoCropTexture(Uint8ClampedArray.from(patch), m.n, m.n, { x: 0, y: 0, side: m.n }, m.n);
      else { raw = drawFabric(drawType, m, { n: m.n, seed: seedOf(look.id) + k * 7919 }); period = periodOf(drawType, m); }
      const stats = weaveStats(raw, m.n), sd = desiredSd(stats.sd, hex, look.weaveStrength, stats.lines);
      const solid = retargetWeave(raw, targetFor(hex, { lit, type: ltype }), sd), z = zebraPattern(hex, bands.split, TEX, { strength, solidRgb: m.n === TEX ? solid : resizeRgb(solid, m.n, TEX), sheerHexIn: sheerTarget });
      tctx.drawImage(toCanvas(z.rgb, TEX, TEX), 0, k * TEX);
      if (k === 0) first = { rows: z.rows, sd: stats.sd, period };
    }
    return { mode: photoZ ? 'photo' : 'pattern', source: photoZ ? 'photo' : 'generated', ttype, hex, canvas: tall, weave: 'zebra', bands, rows: first.rows, sheer: false, period: null, periods, sheerHex, photoSd: first.sd, sd: first.sd };
  }
  // ---- a generated cloth: drawn from the photo's measurements
  const wantPhoto = source === 'photo';
  if (!wantPhoto || (look.textureSource == null && !(await photoUsable(look, small)))) {
    let fab = null; try { fab = await fabricOf(look, n); } catch { fab = null; }
    if (fab) {
      const m = fab.m, drawType = zebraDrawType(ttype);          // a tweed, motif or print drawn anyway (a photo that is not flat enough to cut): a motif as a lattice, the others as soft irregular cloth
      const raw = drawFabric(drawType, m, { n: m.n, seed: seedOf(look.id) }), stats = weaveStats(raw, m.n), sd = desiredSd(stats.sd, hex, look.weaveStrength, stats.lines);
      const out = retargetWeave(raw, targetFor(hex, { lit, type: ltype }), sd), period = periodOf(drawType, m);
      return { mode: 'pattern', source: 'generated', ttype: drawType, hex, canvas: upscale(toCanvas(out, m.n, m.n), m.n), weave: drawType, bands, rows: 0, period: period ? period * (TEX / m.n) : null, periods: 1, photoSd: stats.sd, sd };
    }
    // no photo to measure: the older generic weave for the fabric type
    const { canvas, rows, sheer } = patternCanvas(weaveOf(look), target, bands, strength);
    return { mode: 'pattern', source: 'generated', ttype, hex, canvas, weave: weaveOf(look), bands, rows, sheer: !!sheer, period: PATTERN_PERIOD[weaveOf(look)] || null, periods: 1 };
  }
  // ---- a photo crop: the flat part of the photo cut out, made to tile, and set to the color's own average and weave strength
  const crop = await cropTexture(look, small, lit), c = document.createElement('canvas'); c.width = c.height = TEX;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(crop, 0, 0, TEX, TEX);
  // the photo's own weave contrast (held back only where it would clip), times the color's Weave strength; the average stays exactly the color
  const raw = look.line === 'cellular' ? flattenRows(rgbOf(ctx, TEX, TEX)) : rgbOf(ctx, TEX, TEX), stats = weaveStats(raw), sd = desiredSd(stats.sd, hex, look.weaveStrength, stats.lines);
  const out = retargetWeave(raw, targetFor(hex, { lit, type: ltype }), sd);
  return { mode: 'photo', source: 'photo', ttype, hex, canvas: toCanvas(out, TEX, TEX), weave: weaveOf(look), bands, rows: 0, period: stats.period, periods: 1, photoSd: stats.sd, sd };
}
const GENERATED_OK = ['slub', 'mesh', 'twill', 'linen', 'stripe', 'smooth'];
const zebraDrawType = (t) => (GENERATED_OK.includes(t) ? t : t === 'motif' ? 'mesh' : 'linen');
// is the photo flat enough to cut a texture out of it? (a photo-source color that is not falls back to a generated cloth, unless the admin chose Photo by hand)
const usable = new Map();
function photoUsable(look, small) {
  let p = usable.get(look.id);
  if (!p) {
    p = loadImage((small ? look.thumb : look.image) || look.image || look.thumb).then((img) => { const px = pixelsAt(img, 1000); return analyzePhoto(px.rgb, px.w, px.h).usable; }, () => false);
    usable.set(look.id, p);
  }
  return p;
}
const resizeRgb = (rgb, from, to) => { const c = toCanvas(rgb, from, from), o = document.createElement('canvas'); o.width = o.height = to; const x = o.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = true; x.drawImage(c, 0, 0, to, to); return rgbOf(x, to, to); };

// The same, as a "look" description built from a catalog swatch (what the customer pages and the room use)
export const lookOfSwatch = (s) => ({
  id: s.id, line: s.line, family: s.family, composition: s.specs?.composition, colorFamily: s.colorFamily, previewColor: s.previewColor,
  textureType: s.textureType, textureSource: s.textureSource, weave: s.weave, weaveStrength: s.weaveStrength, solidIn: s.zebraSolidIn, sheerIn: s.zebraSheerIn, tile: s.tile, thumb: s.thumb, image: s.image, tex: s.tex,
});

