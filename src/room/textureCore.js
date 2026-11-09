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

// Re-centres a flat 3-channel texture on `target` ([r,g,b]) and caps its contrast: out = target + (pixel - mean) * k, with k = min(1, maxSd / sd).
// Supplier macro photos are not true to the cloth (white weft on black averages grey, open solar weaves show the backing), so the colour a
// customer sees comes from the swatch's colour family and the photo only supplies the weave.
export function retarget(rgb, target, maxSd = 16) {
  const n = rgb.length / 3, mean = [0, 0, 0];
  for (let i = 0; i < rgb.length; i += 3) for (let c = 0; c < 3; c++) mean[c] += rgb[i + c];
  for (let c = 0; c < 3; c++) mean[c] /= n;
  let v = 0;
  for (let i = 0; i < rgb.length; i += 3) { const l = 0.3 * rgb[i] + 0.59 * rgb[i + 1] + 0.11 * rgb[i + 2] - (0.3 * mean[0] + 0.59 * mean[1] + 0.11 * mean[2]); v += l * l; }
  const sd = Math.sqrt(v / n), k = sd > maxSd ? maxSd / sd : 1;
  const out = new Uint8ClampedArray(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) for (let c = 0; c < 3; c++) out[i + c] = target[c] + (rgb[i + c] - mean[c]) * k;
  return out;
}

// Re-centres a flat texture on `target` and sets its contrast to `sd` (luminance spread, in levels): out = target + (pixel - mean) * sd / photoSd. Unlike
// retarget() it can raise the contrast as well as lower it. Where the swing would clip against black or white the pixels are clipped, and the whole texture is
// then shifted back (a few passes) so its AVERAGE is still exactly `target`.
export function retargetWeave(rgb, target, sd) {
  const n = rgb.length / 3, mean = [0, 0, 0];
  for (let i = 0; i < rgb.length; i += 3) for (let c = 0; c < 3; c++) mean[c] += rgb[i + c];
  for (let c = 0; c < 3; c++) mean[c] /= n;
  let v = 0; const m = 0.3 * mean[0] + 0.59 * mean[1] + 0.11 * mean[2];
  for (let i = 0; i < rgb.length; i += 3) { const l = 0.3 * rgb[i] + 0.59 * rgb[i + 1] + 0.11 * rgb[i + 2] - m; v += l * l; }
  const k = v > 1e-6 ? sd / Math.sqrt(v / n) : 0, tmp = new Float32Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) for (let c = 0; c < 3; c++) tmp[i + c] = target[c] + (rgb[i + c] - mean[c]) * k;
  for (let pass = 0; pass < 4; pass++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let i = c; i < tmp.length; i += 3) s += Math.min(255, Math.max(0, tmp[i])); const d = target[c] - s / n;
    if (Math.abs(d) < 0.05) continue; for (let i = c; i < tmp.length; i += 3) tmp[i] += d;
  }
  const out = new Uint8ClampedArray(rgb.length); for (let i = 0; i < tmp.length; i++) out[i] = tmp[i];
  return out;
}

// A zebra picture is one stripe period (solid band on top, `split` of the height, sheer band under it). The photo's uneven lighting shows as dark
// vertical bars once it repeats, so the slow left-to-right brightness of the solid band is taken out of every row, and the solid band is then
// re-centred on `target` like a weave (retarget). The sheer band keeps its own look. `rgb` is size x size x 3.
export function retargetZebra(rgb, target, size = TEX, split = SPLIT, maxSd = 16) {
  const solidRows = Math.round(size * split), out = Uint8ClampedArray.from(rgb);
  const col = new Float32Array(size * 3);
  for (let y = 0; y < solidRows; y++) for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) col[x * 3 + c] += rgb[(y * size + x) * 3 + c] / solidRows;
  const tiled = new Float32Array(size * size * 3); for (let y = 0; y < size; y++) tiled.set(col, y * size * 3);       // blur() wants a real picture: the same row repeated
  const soft = blur(tiled, size, size, 3, Math.round(size / 64)), mean = [0, 0, 0];     // row 0 of the result is the smoothed profile (a few px: bars wider than the weave go, the weave stays)
  for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) mean[c] += soft[x * 3 + c] / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) out[(y * size + x) * 3 + c] = rgb[(y * size + x) * 3 + c] - (soft[x * 3 + c] - mean[c]);
  const solid = retarget(out.subarray(0, solidRows * size * 3), target, maxSd);
  out.set(solid, 0);
  return out;
}

// ---- flat crop + seamless tiling (the "Photo crop" texture) ------------------------------------------------------------------------------------

// Resamples the square `rect` ({ x, y, side }, in photo pixels) of an RGB photo to size x size: box average when shrinking, bilinear when stretching.
export function cropResample(rgb, w, h, rect, size = TEX) {
  const out = new Uint8ClampedArray(size * size * 3), k = rect.side / size;
  const at = (x, y, c) => rgb[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 3 + c];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = rect.x + (x + 0.5) * k, sy = rect.y + (y + 0.5) * k;
    for (let c = 0; c < 3; c++) {
      let v;
      if (k > 1.5) {                                                        // shrinking: average the source pixels this one covers
        const x0 = Math.floor(sx - k / 2), x1 = Math.max(x0 + 1, Math.ceil(sx + k / 2)), y0 = Math.floor(sy - k / 2), y1 = Math.max(y0 + 1, Math.ceil(sy + k / 2));
        let t = 0, n = 0; for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { t += at(xx, yy, c); n++; } v = t / n;
      } else {                                                              // stretching: bilinear
        const fx = sx - 0.5, fy = sy - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        v = (at(x0, y0, c) * (1 - tx) + at(x0 + 1, y0, c) * tx) * (1 - ty) + (at(x0, y0 + 1, c) * (1 - tx) + at(x0 + 1, y0 + 1, c) * tx) * ty;
      }
      out[(y * size + x) * 3 + c] = v;
    }
  }
  return out;
}

// Makes a square 3-channel texture repeat with no visible seam. Every pixel is a blend of itself and the pixel half a texture away (wrapping round):
// the blend favours the pixel itself in the middle and the shifted one at the edges, and at the edges the shifted picture is continuous across the wrap
// (its middle lies there), so the left edge meets the right edge, and the top the bottom, as if they were neighbours. The blend keeps the weave's contrast
// (the weights are normalised for unrelated pictures) instead of washing it out. Returns a new Uint8ClampedArray.
export function makeSeamless(rgb, size = TEX) {
  const half = size >> 1, mean = [0, 0, 0], n = size * size;
  for (let i = 0; i < rgb.length; i += 3) for (let c = 0; c < 3; c++) mean[c] += rgb[i + c] / n;
  const out = new Uint8ClampedArray(rgb.length), ramp = (t) => Math.sin(Math.PI * t) ** 2;       // 0 at the edge, 1 in the middle
  for (let y = 0; y < size; y++) {
    const wy = ramp((y + 0.5) / size), y2 = (y + half) % size;
    for (let x = 0; x < size; x++) {
      const wa = wy * ramp((x + 0.5) / size), wb = 1 - wa, norm = Math.sqrt(wa * wa + wb * wb), x2 = (x + half) % size;
      for (let c = 0; c < 3; c++) {
        const a = rgb[(y * size + x) * 3 + c] - mean[c], b = rgb[(y2 * size + x2) * 3 + c] - mean[c];
        out[(y * size + x) * 3 + c] = mean[c] + (wa * a + wb * b) / norm;
      }
    }
  }
  return out;
}

// How visible the repeat seam of a texture is: the colour step across the wrap (last column to first, last row to first) compared with the biggest ordinary
// steps INSIDE the texture (the 90th percentile of the average step between neighbouring columns / rows). 1 or less means the seam is no louder than the
// loudest ordinary weave joins, so it cannot be seen; a pasted-together tile is well above. `axes` limits the check ('x', 'y' or 'xy'): a zebra stripe
// is made of bands, so only its left-right wrap is meant to be invisible.
export function seamRatio(rgb, size = TEX, axes = 'xy') {
  const px = (x, y) => (y * size + x) * 3, step = (x0, y0, x1, y1, along) => {              // mean |difference| of the pixel pairs along one line
    let t = 0; for (let k = 0; k < size; k++) for (let c = 0; c < 3; c++) { const a = along === 'col' ? px(x0, k) : px(k, y0), b = along === 'col' ? px(x1, k) : px(k, y1); t += Math.abs(rgb[a + c] - rgb[b + c]); }
    return t / (size * 3);
  };
  const p90 = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length * 0.9)];
  let worst = 0;
  if (axes.includes('x')) { const inner = []; for (let x = 0; x < size - 1; x++) inner.push(step(x, 0, x + 1, 0, 'col')); worst = Math.max(worst, step(size - 1, 0, 0, 0, 'col') / Math.max(0.01, p90(inner))); }
  if (axes.includes('y')) { const inner = []; for (let y = 0; y < size - 1; y++) inner.push(step(0, y, 0, y + 1, 'row')); worst = Math.max(worst, step(0, size - 1, 0, 0, 'row') / Math.max(0.01, p90(inner))); }
  return worst;
}

// The whole "Photo crop" recipe on a photo's RGB bytes: the flat window (from analyzePhoto), cut out at 256, uneven lighting taken out, made to repeat.
export function photoCropTexture(rgb, w, h, rect, size = TEX) {
  return makeSeamless(flatten(cropResample(rgb, w, h, rect, size), size), size);
}
