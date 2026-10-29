// Generated pictures for the single-window preview's backdrop: plaster for the wall and a soft sky-and-trees view for the glass.
// Drawn once on small canvases, so there is nothing to download.
import * as THREE from 'three';

// A seeded random number generator, so the wall looks the same every time
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

// Warm plaster: soft cloudy patches plus a fine grain. Tileable (patches wrap round), 512 px, covers about 1.2 m.
export function plasterTexture(anisotropy = 4) {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d'), rand = rng(7);
  ctx.fillStyle = '#e4d9c7'; ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < 46; i++) {                                    // cloudy patches, drawn again on the far side so the tile repeats without a seam
    const x = rand() * N, y = rand() * N, r = 90 + rand() * 170, light = rand() > 0.5, a = 0.012 + rand() * 0.022;
    for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, light ? `rgba(255,248,232,${a})` : `rgba(120,98,70,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
    }
  }
  const d = ctx.getImageData(0, 0, N, N), px = d.data;                // grain
  for (let i = 0; i < px.length; i += 4) { const n = (rand() - 0.5) * 9; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(1 / 1.6, 1 / 1.6); t.anisotropy = anisotropy;
  return t;
}

// The view through the glass: pale sky fading to a hazy horizon, with soft green trees along the bottom
export function skyTexture() {
  const W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), rand = rng(11);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#dfe9f4'); g.addColorStop(0.55, '#eef2f4'); g.addColorStop(0.72, '#f1f1e8'); g.addColorStop(1, '#e4e4cf');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const x = rand() * W, y = H * (0.68 + rand() * 0.36), r = 18 + rand() * 46;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r), green = 120 + Math.round(rand() * 50);
    rg.addColorStop(0, `rgba(${green - 18},${green + 4},${84 + Math.round(rand() * 28)},0.42)`); rg.addColorStop(1, 'rgba(130,150,100,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A soft pool of light for the wall (sun coming in from the left), as an alpha map
export function washTexture() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(N * 0.3, N * 0.35, 0, N * 0.3, N * 0.35, N * 0.75);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#000');
  ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  return new THREE.CanvasTexture(c);
}
