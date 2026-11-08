// The "Pattern" texture: a fabric drawn from its corrected preview color plus a weave chosen by fabric type, with no photo involved. Used when a swatch
// photo has no flat area (folds, a whole shade, too small, strong shading) and always for Zebra. Pure functions on RGB bytes, deterministic (a seeded
// random generator, no Math.random), so the picker tile, the 3D preview, the admin preview and the tests all draw exactly the same cloth.
//
// Every weave repeats seamlessly (it is built from periodic functions on the 256 px grid) and is re-centred on the target color, so the texture's
// average IS the swatch's color and its contrast is capped (no moire when it is small on screen).
import { TEX } from '../room/textureCore.js';

export const WEAVES = ['basket', 'smooth', 'mesh', 'linen', 'pleat', 'zebra'];

// Fabric type -> weave. Solar: fine basketweave. Blackout: smooth with a faint texture. Screen view: open mesh. Linen-look (everything else: roman,
// drapery, curtains, Shangri-La): slubby threads. Cellular: pleat lines. Zebra: its own (solid band weave + sheer band, see zebraPattern).
export function weaveKindOf({ line, family, composition } = {}) {
  if (line === 'zebra') return 'zebra';
  if (line === 'cellular') return 'pleat';
  if (line === 'roller') {
    if (family === 'solar') return 'basket';
    if (family === 'blackout') return 'smooth';
    if (family === 'screen-view') return 'mesh';
  }
  void composition;
  return 'linen';
}

function rng(seed) {                                 // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const wrap = (i, n) => ((i % n) + n) % n;

// Periodic 1-D smooth noise of `n` samples: a few random cosines with integer frequencies (so it repeats), scaled to sd 1.
function noise1(n, rand, lo, hi) {
  const out = new Float32Array(n);
  for (let f = lo; f <= hi; f++) { const a = rand() * 2 - 1, ph = rand() * Math.PI * 2; for (let i = 0; i < n; i++) out[i] += a * Math.cos((2 * Math.PI * f * i) / n + ph); }
  let v = 0; for (const x of out) v += x * x; const sd = Math.sqrt(v / n) || 1;
  return out.map((x) => x / sd);
}

// A float luminance field in roughly -1..1 (before re-centring) for one weave; `size` x size.
function field(kind, size, rand) {
  const f = new Float32Array(size * size), S = size / TEX;                  // S: scale the 256 px design to other sizes (the tile preview draws smaller)
  const at = (x, y, v) => { f[y * size + x] = v; };
  if (kind === 'basket') {
    // two threads over, two under: 8 px unit, 4 px blocks, alternate blocks run vertically and horizontally; each thread is a rounded ridge 2 px wide
    const u = 4 * S, t = noise1(size, rand, 6, 18);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const bx = Math.floor(x / u), by = Math.floor(y / u), vertical = (bx + by) % 2 === 0;
      const pos = vertical ? x : y, ridge = Math.cos((Math.PI * pos) / (u / 2)), edge = Math.min(1, Math.abs(Math.sin((Math.PI * (vertical ? y : x)) / u)) * 3);
      at(x, y, ridge * 0.8 * (0.65 + 0.35 * edge) + 0.08 * t[(vertical ? y : x) % size] * (vertical ? 1 : -1));
    }
  } else if (kind === 'smooth') {
    const nx = noise1(size, rand, 40, 90), ny = noise1(size, rand, 40, 90), nd = noise1(size, rand, 20, 60);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) at(x, y, 0.5 * nx[x] * ny[y] / 1 + 0.35 * nd[wrap(x + y, size)] + 0.25 * ny[y]);
  } else if (kind === 'mesh') {
    // open mesh: 8 px cells (a whole number of them in a tile, so it repeats), threads 3 px wide cross at the nodes and the openings between them are darker (you see through to the backing)
    const u = 8 * S, rows = noise1(size, rand, 10, 24), cols = noise1(size, rand, 10, 24);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = Math.abs(((x % u) + u) % u - u / 2) / (u / 2), dy = Math.abs(((y % u) + u) % u - u / 2) / (u / 2);       // 0 on a thread centre, 1 in the middle of an opening
      const tx = 1 - Math.min(1, dx * 1.8), ty = 1 - Math.min(1, dy * 1.8), thread = Math.max(tx, ty), hole = Math.min(1, dx * 1.8) * Math.min(1, dy * 1.8);
      at(x, y, thread * 0.9 - hole * 0.9 + 0.06 * rows[y] + 0.06 * cols[x]);
    }
  } else if (kind === 'linen') {
    // threads of uneven thickness running both ways, with slubs (short thick bursts) along them
    const rowT = noise1(size, rand, 30, 100), colT = noise1(size, rand, 30, 100), N = Math.round(46 * S * S);
    const slubH = new Float32Array(size * size), slubV = new Float32Array(size * size);
    for (let k = 0; k < N; k++) {
      const horizontal = rand() < 0.5, line = Math.floor(rand() * size), start = Math.floor(rand() * size), len = Math.round((8 + rand() * 34) * S), amp = (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.9);
      for (let i = 0; i < len; i++) { const bump = Math.sin((Math.PI * (i + 0.5)) / len); const a = horizontal ? slubH : slubV, x = horizontal ? wrap(start + i, size) : line, y = horizontal ? line : wrap(start + i, size); a[y * size + x] += amp * bump; }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) at(x, y, 0.38 * rowT[y] + 0.38 * colT[x] + slubH[y * size + x] + slubV[y * size + x]);
  } else if (kind === 'pleat') {
    // cellular shade: horizontal pleats, 8 to a tile (32 px each): a bright rounded face, a dark crease; plus a faint fabric grain
    const pitch = size / 8, g = noise1(size, rand, 50, 110), gy = noise1(size, rand, 50, 110);
    for (let y = 0; y < size; y++) {
      const t = (y % pitch) / pitch, face = Math.cos(2 * Math.PI * (t - 0.45)), crease = Math.exp(-(((t - 0.96) % 1) ** 2) / 0.0016) + Math.exp(-((t + 0.04) ** 2) / 0.0016);
      for (let x = 0; x < size; x++) at(x, y, 0.55 * face - 1.1 * crease + 0.14 * g[x] * gy[y] + 0.08 * gy[y]);
    }
  } else {                                                         // 'zebra' solid band weave: smooth cloth with fine horizontal streaks
    const ry = noise1(size, rand, 50, 120), rx = noise1(size, rand, 6, 20), r2 = noise1(size, rand, 30, 100);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) at(x, y, 0.55 * ry[y] + 0.2 * rx[x] * 0.4 + 0.18 * r2[wrap(x * 3 + y, size)]);
  }
  return f;
}

// How strong each weave is: the standard deviation of luminance, in levels (0..255), after re-centring on the target color.
const SD = { basket: 9, smooth: 2.6, mesh: 11, linen: 8.5, pleat: 9, zebra: 4.5 };
const SEED = { basket: 11, smooth: 23, mesh: 37, linen: 41, pleat: 53, zebra: 67 };

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// size x size x 3 RGB of the weave in `hex`. The average is `hex` (within a level or two: rounding and clipping at the ends of the range only).
export function patternRGB(kind, hex, size = TEX) {
  const k = WEAVES.includes(kind) ? kind : 'linen', target = hexToRgb(hex);
  const f = field(k, size, rng(SEED[k] + size)), n = f.length;
  let m = 0; for (let i = 0; i < n; i++) m += f[i]; m /= n;
  let v = 0; for (let i = 0; i < n; i++) v += (f[i] - m) ** 2; const sd = Math.sqrt(v / n) || 1;
  // keep the weave from clipping against black or white: its swing is reduced where the color is very dark or very light
  const lum = 0.3 * target[0] + 0.59 * target[1] + 0.11 * target[2], room = Math.max(3, Math.min(lum, 255 - lum) * 0.5), amp = Math.min(SD[k], room) / sd;
  const out = new Uint8ClampedArray(n * 3), tmp = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) tmp[i * 3 + c] = target[c] + (f[i] - m) * amp;
  // clipping can pull the mean off target: nudge each channel back (two passes is plenty)
  for (let pass = 0; pass < 3; pass++) {
    for (let c = 0; c < 3; c++) { let s = 0; for (let i = 0; i < n; i++) s += Math.min(255, Math.max(0, tmp[i * 3 + c])); const d = target[c] - s / n; for (let i = 0; i < n; i++) tmp[i * 3 + c] += d; }
  }
  for (let i = 0; i < tmp.length; i++) out[i] = tmp[i];
  return out;
}

// The Zebra texture: one stripe period, size x size: a solid band on top (`split` of the height) and a sheer band under it. The solid band is the zebra
// weave in the fabric's color; the sheer band is a light voile (fine open mesh, very pale, a hint of the fabric's color) that the 3D model makes see-through.
// `split` = solid / (solid + sheer) of the band widths in inches (src/room/zebraBands.js).
export function zebraPattern(hex, split = 0.6, size = TEX) {
  const rows = Math.round(size * split), solid = patternRGB('zebra', hex, size), pale = [244, 242, 238], c0 = hexToRgb(hex);
  const sheerHex = `#${c0.map((v, i) => Math.round(pale[i] * 0.93 + v * 0.07).toString(16).padStart(2, '0')).join('')}`;
  const voile = patternRGB('mesh', sheerHex, size), out = new Uint8ClampedArray(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3;
    for (let c = 0; c < 3; c++) out[i + c] = y < rows ? solid[i + c] : 0.55 * voile[i + c] + 0.45 * (pale[c] * 0.93 + c0[c] * 0.07);      // the voile: the mesh at 55 % strength over plain pale
  }
  return { rgb: out, rows };
}
