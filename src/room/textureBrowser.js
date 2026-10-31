// The browser side of the 3D fabric textures: the same steps as scripts/room-lab/texture-node.mjs (the maths is shared in textureCore.js).
// Used in two places: the admin makes the texture when a color is uploaded or replaced, and the room visualizer makes one on the spot for a
// color whose prepared texture is not there yet. `src` is any image source (ImageBitmap, <img>, canvas).
import { TEX, SPLIT, flatten, findBands, meanHex, retarget, retargetZebra } from './textureCore.js';

const sizeOf = (s) => ({ W: s.naturalWidth || s.width, H: s.naturalHeight || s.height });
const rgbOf = (ctx, w, h) => { const d = ctx.getImageData(0, 0, w, h).data, out = new Uint8ClampedArray(w * h * 3); for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { out[j] = d[i]; out[j + 1] = d[i + 1]; out[j + 2] = d[i + 2]; } return out; };

// -> { canvas (256 x 256), color (#rrggbb) }. Throws if the picture cannot be read (a picture from another site without CORS).
export function makeTextureCanvas(src, zebra = false) {
  const { W, H } = sizeOf(src);
  const c = document.createElement('canvas'); c.width = c.height = TEX;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (zebra) {
    const x0 = Math.floor(W * 0.15), cw = Math.floor(W * 0.7), sh = Math.round(TEX * SPLIT);
    const strip = document.createElement('canvas'); strip.width = 16; strip.height = H;
    const sctx = strip.getContext('2d', { willReadFrequently: true }); sctx.drawImage(src, x0, 0, cw, H, 0, 0, 16, H);
    const d = sctx.getImageData(0, 0, 16, H).data, lum = new Float32Array(H);
    for (let y = 0; y < H; y++) { let t = 0; for (let x = 0; x < 16; x++) { const i = (y * 16 + x) * 4; t += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; } lum[y] = t / 16; }
    const bands = findBands(lum);
    const piece = (rows, dy, dh) => ctx.drawImage(src, x0, rows[0], cw, Math.max(2, rows[1] - rows[0]), 0, dy, TEX, dh);
    ctx.fillStyle = '#f4f2ee'; ctx.fillRect(0, 0, TEX, TEX);
    if (bands) { piece(bands.solid, 0, sh); if (bands.sheer) piece(bands.sheer, sh, TEX - sh); }
    else piece([Math.floor(H * 0.2), Math.floor(H * 0.8)], 0, sh);
    return { canvas: c, color: meanHex(rgbOf(ctx, TEX, sh)) };
  }
  const side = Math.floor(Math.min(W, H) * 0.75);
  ctx.drawImage(src, (W - side) / 2, (H - side) / 2, side, side, 0, 0, TEX, TEX);
  const flat = flatten(rgbOf(ctx, TEX, TEX));
  const out = ctx.createImageData(TEX, TEX);
  for (let i = 0, j = 0; i < out.data.length; i += 4, j += 3) { out.data[i] = flat[j]; out.data[i + 1] = flat[j + 1]; out.data[i + 2] = flat[j + 2]; out.data[i + 3] = 255; }
  ctx.putImageData(out, 0, 0);
  return { canvas: c, color: meanHex(flat) };
}
export const textureBlob = (canvas) => new Promise((resolve) => canvas.toBlob((b) => resolve(b && b.type === 'image/webp' ? b : null), 'image/webp', 0.8));

// Pixels of a picture as a flat r,g,b array at n x n (optionally only its top `top` fraction: a zebra's solid band), for reading its color.
export function pixelsOf(src, n = 64, top = 1) {
  const { W, H } = sizeOf(src), c = document.createElement('canvas'); c.width = c.height = n;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, W, Math.max(1, Math.round(H * top)), 0, 0, n, n);
  return rgbOf(ctx, n, n);
}

// The texture re-centred on `hex` with its contrast capped (see retarget in textureCore.js); one copy per fabric and color.
// The room's light lifts every cloth a little and warms it (measured on black / gray / white: rendered = 1.04 x texture + 8, blue about 5% low,
// green 2%), so the texture is set a touch darker and cooler and the shade on screen lands on the swatch's own color.
// The picker thumbnails (swatchTile.js) are not lit, they are the color itself.
const LIGHT_GAIN = 1.04, LIGHT_LIFT = 8, ZEBRA_GAIN = 0.92;     // a zebra's solid band is lit less (rendered = 0.92 x texture)
const WARMTH = [1, 1.02, 1.055];
const tuned = new Map();
export function tunedCanvas(src, key, hex, zebra = false) {
  const ck = `${key}|${hex}`, hit = tuned.get(ck); if (hit) return hit;
  const w = sizeOf(src).W, h = sizeOf(src).H;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(src, 0, 0);
  const target = [1, 3, 5].map((i, k) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.min(255, Math.max(0, (zebra ? v / ZEBRA_GAIN : (v - LIGHT_LIFT) / LIGHT_GAIN) * WARMTH[k])); });
  const rgb = zebra ? retargetZebra(rgbOf(ctx, w, h), target, w) : retarget(rgbOf(ctx, w, h), target);
  const out = ctx.createImageData(w, h);
  for (let i = 0, j = 0; i < out.data.length; i += 4, j += 3) { out.data[i] = rgb[j]; out.data[i + 1] = rgb[j + 1]; out.data[i + 2] = rgb[j + 2]; out.data[i + 3] = 255; }
  ctx.putImageData(out, 0, 0); tuned.set(ck, c); return c;
}
