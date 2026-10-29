// The picture processing for the 3D fabric textures, written once on plain arrays so the browser (admin upload, and the fallback that makes a
// texture on the spot) and Node (the backfill, scripts/backfill-textures.mjs) produce the same result. No DOM, no sharp in here.
//
// A texture is 256 x 256: for a weave, a flat piece of cloth (a 75% centre crop of the swatch picture, with the uneven lighting taken out so it can
// repeat without a grid of light patches); for a zebra, one stripe period (a solid band on top, SPLIT of the height, and the sheer band under it).
export const TEX = 256;
export const SPLIT = 0.6;

// Box blur, three passes (close to a Gaussian), edges mirrored. `data` is interleaved with `ch` channels; returns Float32Array.
export function blur(data, w, h, ch, radius) {
  let src = Float32Array.from(data), dst = new Float32Array(src.length);
  const mir = (i, n) => (i < 0 ? -i - 1 : i >= n ? 2 * n - i - 1 : i);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) for (let c = 0; c < ch; c++) {        // horizontal
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += src[(y * w + mir(k, w)) * ch + c];
      for (let x = 0; x < w; x++) {
        dst[(y * w + x) * ch + c] = sum / (2 * radius + 1);
        sum += src[(y * w + mir(x + radius + 1, w)) * ch + c] - src[(y * w + mir(x - radius, w)) * ch + c];
      }
    }
    [src, dst] = [dst, src];
    for (let x = 0; x < w; x++) for (let c = 0; c < ch; c++) {         // vertical
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += src[(mir(k, h) * w + x) * ch + c];
      for (let y = 0; y < h; y++) {
        dst[(y * w + x) * ch + c] = sum / (2 * radius + 1);
        sum += src[(mir(y + radius + 1, h) * w + x) * ch + c] - src[(mir(y - radius, h) * w + x) * ch + c];
      }
    }
    [src, dst] = [dst, src];
  }
  return src;
}

// Takes the slow brightness changes out of a 256 x 256 RGB picture (3 channels): keeps the weave, subtracts a blurred copy, adds back the average.
export function flatten(rgb, size = TEX) {
  const soft = blur(rgb, size, size, 3, Math.round(size / 20));
  const mean = [0, 0, 0];
  for (let i = 0; i < soft.length; i += 3) { mean[0] += soft[i]; mean[1] += soft[i + 1]; mean[2] += soft[i + 2]; }
  const n = soft.length / 3; for (let c = 0; c < 3; c++) mean[c] /= n;
  const out = new Uint8ClampedArray(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) for (let c = 0; c < 3; c++) out[i + c] = rgb[i + c] - soft[i + c] + mean[c];
  return out;
}

// Rows of a stripe photo: the average brightness of each row over its middle (`lum` has one number per row).
// Returns { solid: [from, to], sheer: [from, to] | null } for one dark band and a light band beside it (rows of the picture), or null when there are no clear stripes.
export function findBands(lum) {
  const H = lum.length;
  let lo = Infinity, hi = -Infinity;
  for (const v of lum) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi - lo < 25) return null;
  const thr = (lo + hi) / 2, runs = []; let start = 0;
  for (let y = 1; y <= H; y++) if (y === H || (lum[y] > thr) !== (lum[y - 1] > thr)) { runs.push({ light: lum[start] > thr, a: start, b: y }); start = y; }
  const whole = runs.filter((r) => r.a > 2 && r.b < H - 2 && r.b - r.a > H * 0.08);          // bands the photo shows in full
  const solid = whole.find((r) => !r.light); if (!solid) return null;
  const sheer = whole.find((r) => r.light) || null;
  const pad = (r) => Math.max(4, Math.round((r.b - r.a) * 0.12));
  const trim = (r) => [r.a + pad(r), r.b - pad(r)];
  return { solid: trim(solid), sheer: sheer ? trim(sheer) : null };
}

// The average color of an RGB buffer, as #rrggbb
export function meanHex(rgb) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < rgb.length; i += 12) { r += rgb[i]; g += rgb[i + 1]; b += rgb[i + 2]; n++; }
  return `#${[r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('')}`;
}
