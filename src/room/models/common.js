// Shared pieces of the window-treatment models (shade.js, curtains.js): image loading, fabric materials, soft shadows.
// Units are metres. Every model is a THREE.Group whose origin is the top centre of its opening, x to the right, y up and z towards the room.
import * as THREE from 'three';
import { makeTextureCanvas, tunedCanvas, pixelsOf } from '../textureBrowser.js';
import { deriveHex } from '../../lib/swatchColor.js';

// ---- images ------------------------------------------------------------------------------------------------------------------------
const imgCache = new Map();
export function whenImage(url, cb, cross = false, fail = null) {
  const key = `${cross ? 'x:' : ''}${url}`;
  let e = imgCache.get(key);
  if (!e) {
    e = { img: new Image(), ready: false, failed: false, cbs: [], fails: [] };
    if (cross) e.img.crossOrigin = 'anonymous';                       // catalog swatches come from the storage bucket, which allows any origin
    e.img.decoding = 'async';
    e.img.onload = () => { e.ready = true; e.cbs.splice(0).forEach((f) => f(e.img)); };
    e.img.onerror = () => { e.failed = true; e.cbs.length = 0; e.fails.splice(0).forEach((f) => f()); };      // a missing picture: the model keeps its flat colour (or `fail` makes a texture another way)
    e.img.src = url;
    imgCache.set(key, e);
  }
  if (e.ready) cb(e.img);
  else if (e.failed) fail?.();
  else { e.cbs.push(cb); if (fail) e.fails.push(fail); }
}

// A color's 3D texture is normally ready-made (public/room-lab/fabrics for the presets, tex256/ in the storage bucket for every other swatch). If a
// swatch has none yet, one is made here from its picture (same steps as the admin upload and the backfill: textureBrowser.js) as a fallback.
const dynCache = new Map();
export function whenFabric(spec, cb) {
  const make = () => {
    const hit = dynCache.get(spec.key);
    if (hit) { cb(hit); return; }
    whenImage(spec.fallbackUrl || spec.url, (img) => {
      let r; try { r = makeTextureCanvas(img, spec.kind === 'zebra'); } catch { return; }       // a tainted or broken picture: keep the flat colour
      dynCache.set(spec.key, r.canvas); cb(r.canvas);
    }, true);
  };
  if (spec.dynamic) { make(); return; }
  whenImage(spec.url, cb, !!spec.prepared, spec.prepared ? make : undefined);       // a prepared texture that is missing (404) falls back to making one
}

// A fabric texture whose UVs are metres: repeat = 1 / (metres one picture covers). Mirrored in u so the swatch edges never show a seam.
// A catalog photo is re-centred on the color the fabric shows as (src/lib/swatchColor.js: the admin's override, else its own picture placed inside
// its color family) and its contrast capped; the preset textures are already cut for this. The color is read once per fabric.
const looks = new Map();
export const looksHex = (img, spec) => {
  if (spec.override) return spec.color;
  let h = looks.get(spec.key);
  if (!h) { try { h = deriveHex(pixelsOf(img, 64, spec.kind === 'zebra' ? 0.6 : 1), spec.colorFamily); } catch { h = spec.color; } looks.set(spec.key, h); }
  return h;
};
export const tuneFabric = (img, spec) => (!(spec.preset && !spec.override) && spec.color ? tunedCanvas(img, spec.key, looksHex(img, spec), spec.kind === 'zebra') : img);

export function weaveTexture(spec, env, { mirrorV = true } = {}) {
  const t = new THREE.Texture();
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.MirroredRepeatWrapping;
  t.wrapT = mirrorV ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;     // trilinear + anisotropic: the weave melts into its average color when small, never into moire
  t.anisotropy = env.maxAniso || 1;
  t.repeat.set(1 / spec.tile[0], 1 / spec.tile[1]);
  whenFabric(spec, (img) => { t.image = tuneFabric(img, spec); t.needsUpdate = true; env.invalidate(); });
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
