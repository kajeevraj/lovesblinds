// Shared pieces of the window-treatment models (shade.js, curtains.js): image loading, fabric materials, soft shadows.
// Units are metres. Every model is a THREE.Group whose origin is the top centre of its opening, x to the right, y up and z towards the room.
import * as THREE from 'three';

// ---- images ------------------------------------------------------------------------------------------------------------------------
const imgCache = new Map();
export function whenImage(url, cb, cross = false) {
  const key = `${cross ? 'x:' : ''}${url}`;
  let e = imgCache.get(key);
  if (!e) {
    e = { img: new Image(), ready: false, failed: false, cbs: [] };
    if (cross) e.img.crossOrigin = 'anonymous';                       // catalog swatches come from the storage bucket, which allows any origin
    e.img.decoding = 'async';
    e.img.onload = () => { e.ready = true; e.cbs.splice(0).forEach((f) => f(e.img)); };
    e.img.onerror = () => { e.failed = true; e.cbs.length = 0; };      // a missing picture: the model keeps its flat colour
    e.img.src = url;
    imgCache.set(key, e);
  }
  if (e.ready) cb(e.img); else if (!e.failed) e.cbs.push(cb);
}

// Pictures of catalog swatches that are not presets are cut and flattened here (the presets were done ahead of time, see build-fabrics.mjs).
const dynCache = new Map();
const hexOf = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
function meanOf(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data; let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return [r / n, g / n, b / n];
}
function weaveTile(img) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const side = Math.min(img.naturalWidth, img.naturalHeight) * 0.75;
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, N, N);
  return { canvas: c, color: hexOf(...meanOf(ctx, N, N)) };
}
// A zebra swatch is a photo of stripes: find a dark (solid) band and the light (sheer) band beside it and stack them into one period.
function zebraTile(img) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const src = document.createElement('canvas'); src.width = W; src.height = H;
  const sctx = src.getContext('2d', { willReadFrequently: true }); sctx.drawImage(img, 0, 0);
  const x0 = Math.floor(W * 0.15), cw = Math.floor(W * 0.7);
  const d = sctx.getImageData(x0, 0, cw, H).data;
  const lum = new Float32Array(H);
  for (let y = 0; y < H; y++) { let t = 0; for (let x = 0; x < cw; x += 4) { const i = (y * cw + x) * 4; t += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; } lum[y] = t / Math.ceil(cw / 4); }
  const lo = Math.min(...lum), hi = Math.max(...lum), thr = (lo + hi) / 2;
  const runs = []; let start = 0;
  for (let y = 1; y <= H; y++) if (y === H || (lum[y] > thr) !== (lum[y - 1] > thr)) { runs.push({ light: lum[start] > thr, a: start, b: y }); start = y; }
  const inner = runs.filter((r) => r.a > 2 && r.b < H - 2 && r.b - r.a > H * 0.08);
  const solid = hi - lo > 25 ? inner.find((r) => !r.light) : null, sheer = inner.find((r) => r.light);
  const N = 256, sh = Math.round(N * 0.6), c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const pad = (r) => Math.max(4, Math.round((r.b - r.a) * 0.12));
  if (solid) {
    ctx.drawImage(src, x0, solid.a + pad(solid), cw, solid.b - solid.a - 2 * pad(solid), 0, 0, N, sh);
    if (sheer) ctx.drawImage(src, x0, sheer.a + pad(sheer), cw, sheer.b - sheer.a - 2 * pad(sheer), 0, sh, N, N - sh);
    else { ctx.fillStyle = '#f4f2ee'; ctx.fillRect(0, sh, N, N - sh); }
  } else {                                                            // no clear bands: plain cloth with a pale sheer band
    ctx.drawImage(src, x0, H * 0.2, cw, H * 0.6, 0, 0, N, sh);
    ctx.fillStyle = '#f4f2ee'; ctx.fillRect(0, sh, N, N - sh);
  }
  return { canvas: c, color: hexOf(...meanOf(ctx, N, sh)) };
}
// the picture for a fabric spec (presets are ready-made files; other swatches are made here). cb(imageOrCanvas)
export function whenFabric(spec, cb) {
  if (!spec.dynamic) { whenImage(spec.url, cb); return; }
  const hit = dynCache.get(spec.key);
  if (hit) { cb(hit.canvas); return; }
  whenImage(spec.url, (img) => {
    let r; try { r = spec.kind === 'zebra' ? zebraTile(img) : weaveTile(img); } catch { return; }       // a tainted or broken picture: keep the flat colour
    dynCache.set(spec.key, r); cb(r.canvas);
  }, true);
}

// A fabric texture whose UVs are metres: repeat = 1 / (metres one picture covers). Mirrored in u so the swatch edges never show a seam.
export function weaveTexture(spec, env, { mirrorV = true } = {}) {
  const t = new THREE.Texture();
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.MirroredRepeatWrapping;
  t.wrapT = mirrorV ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  t.anisotropy = env.maxAniso || 1;
  t.repeat.set(1 / spec.tile[0], 1 / spec.tile[1]);
  whenFabric(spec, (img) => { t.image = img; t.needsUpdate = true; env.invalidate(); });
  return t;
}

// ---- fabric material -----------------------------------------------------------------------------------------------------------------
// MeshStandardMaterial with the swatch as colour, as a small bump (the weave catches the light) and as the colour of the daylight that
// comes through (emissive). The emissive is the room's backlight tinted by the cloth, brighter at the top (sky) than at the bottom (trees).
// `uHeight` is the height of the cloth, so the gradient follows the model when it is resized.
export function fabricMaterial({ map, glow = 0, opacity = 1, bump = 1.1, emissiveMap = map, alphaMap = null, vertexColors = false, side = THREE.FrontSide }, env) {
  const m = new THREE.MeshStandardMaterial({
    map, bumpMap: map, bumpScale: bump, roughness: 0.92, metalness: 0, emissiveMap, emissive: new THREE.Color(0, 0, 0),
    transparent: opacity < 1 || !!alphaMap, opacity, alphaMap, vertexColors, side, depthWrite: !(opacity < 1 || alphaMap),
  });
  m.userData.glow = glow;
  m.userData.uHeight = { value: 1 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHeight = m.userData.uHeight;
    sh.uniforms.uGlowTop = env.glowTop;
    sh.uniforms.uGlowBottom = env.glowBottom;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLy = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLy;\nuniform float uHeight;\nuniform vec3 uGlowTop;\nuniform vec3 uGlowBottom;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= mix(uGlowTop, uGlowBottom, clamp(-vLy / uHeight, 0.0, 1.0));');
  };
  m.customProgramCacheKey = () => 'lb-fabric-glow';
  return m;
}
// the daylight colour and strength currently in the room (env.backlight is set by the scene)
export function applyGlow(mat, env) {
  mat.emissive.copy(env.backlight).multiplyScalar(mat.userData.glow);
}

// ---- soft shadows ----------------------------------------------------------------------------------------------------------------------
const gradCache = new Map();
// 1 x 64 (or 64 x 1) grey ramp used as an alpha map: `stops` are [position 0..1, level 0..1] from the top (vertical) or left (horizontal)
export function rampTexture(stops, horizontal = false) {
  const key = JSON.stringify([stops, horizontal]);
  if (gradCache.has(key)) return gradCache.get(key);
  const c = document.createElement('canvas');
  c.width = horizontal ? 64 : 4; c.height = horizontal ? 4 : 64;
  const g = horizontal ? c.getContext('2d').createLinearGradient(0, 0, 64, 0) : c.getContext('2d').createLinearGradient(0, 0, 0, 64);
  for (const [p, v] of stops) { const n = Math.round(v * 255); g.addColorStop(p, `rgb(${n},${n},${n})`); }
  const ctx = c.getContext('2d'); ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  gradCache.set(key, t);
  return t;
}
// a blurred rounded rectangle (for the shadow a curtain throws on the wall)
let blobTex;
export function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 128);
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; ctx.shadowOffsetX = 1000; ctx.fillStyle = '#fff';
  ctx.fillRect(26 - 1000, 26, 76, 76);                 // drawn off the canvas: only its blurred shadow lands on it
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}
const SHADOW_COLOR = 0x120b05;
export function shadowMesh(alphaMap, opacity) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    color: SHADOW_COLOR, alphaMap, transparent: true, opacity, depthWrite: false, toneMapped: false,
  }));
  m.renderOrder = 20;
  return m;
}

// ---- geometry helpers -----------------------------------------------------------------------------------------------------------
// A bar with a rounded front (a roller cassette or bottom rail): width along x, height along y, depth along z. Its top is at y = 0 and its back at z = -depth/2.
export function barGeometry(width, height, depth, radius) {
  const r = Math.min(radius, height / 2, depth / 2);
  const s = new THREE.Shape();
  s.moveTo(0, -height); s.lineTo(depth - r, -height); s.quadraticCurveTo(depth, -height, depth, -height + r);
  s.lineTo(depth, -r); s.quadraticCurveTo(depth, 0, depth - r, 0); s.lineTo(0, 0); s.lineTo(0, -height);
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 6 });
  g.rotateY(-Math.PI / 2);                       // shape x (depth) -> +z, extrusion -> -x
  g.translate(width / 2, 0, -depth / 2);
  return g;
}
// A quad whose four corners and texture coordinates (in metres) are rewritten when the cloth changes length: cheap, no new geometry.
export function setQuad(geo, x0, x1, yTop, yBottom, vBottom) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  p.setXYZ(0, x0, yTop, 0); p.setXYZ(1, x1, yTop, 0); p.setXYZ(2, x0, yBottom, 0); p.setXYZ(3, x1, yBottom, 0);
  const top = vBottom + (yTop - yBottom);
  uv.setXY(0, x0, top); uv.setXY(1, x1, top); uv.setXY(2, x0, vBottom); uv.setXY(3, x1, vBottom);
  p.needsUpdate = true; uv.needsUpdate = true;
  geo.computeBoundingSphere();
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
