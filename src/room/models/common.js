// Shared pieces of the window-treatment models (shade.js, curtains.js): image loading, fabric materials, soft shadows.
// Units are metres. Every model is a THREE.Group whose origin is the top centre of its opening, x to the right, y up and z towards the room.
import * as THREE from 'three';
import { resolveLook, isStochastic } from '../textureBrowser.js';
import { weaveTileMetres } from '../../lib/weaveStrength.js';

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

// A fabric's texture comes from ONE place for every surface (src/room/textureBrowser.js resolveLook): a flat crop of the supplier photo made to tile, or a
// generated pattern (always for Zebra), centred on the color the picker tile shows. The hand-cut presets (public/room-lab/fabrics, only the sample shown
// before a color is picked) are plain images.
const lookCache = new Map();
export function whenFabric(spec, cb) {
  if (spec.preset) { whenImage(spec.url, cb); return; }
  const key = `${spec.key}|${spec.look.lightType || ''}|${spec.look.textureType || ''}|${spec.look.textureSource || ''}|${spec.look.weave || ''}|${spec.look.weaveStrength ?? ''}|${spec.look.previewColor || ''}|${spec.bands?.solidIn}|${spec.bands?.sheerIn}`;
  let p = lookCache.get(key);
  if (!p) { p = resolveLook(spec.look, { lit: true }); lookCache.set(key, p); p.catch(() => lookCache.delete(key)); }
  p.then((r) => { try { (window.__lbLooks = window.__lbLooks || {})[spec.swatchId] = { mode: r.mode, hex: r.hex, weave: r.weave, sheer: !!r.sheer }; } catch { /* no window */ } cb(r.canvas, r); }, () => { /* no picture and no color: the model keeps its flat color */ });       // window.__lbLooks: what the 3D shows, for the tests
}

// A fabric texture whose UVs are metres: repeat = 1 / (metres one picture covers). Presets are hand-cut, so they are mirrored in u to hide their seams;
// every other texture is made to repeat on its own (seamless), so it repeats plainly (a mirror would show a symmetric pattern).
// The weave is shown at a size that reads on the shade as it is on screen (src/lib/weaveStrength.js): called when the texture arrives and whenever the picture is
// resized. Only where the scene says how many pixels a metre is (the product-page preview); a Zebra's texture is one stripe period (its geometry), never rescaled.
export function applyWeaveScale(t, env) {
  const spec = t.userData?.spec; if (!spec || spec.preset || spec.kind === 'zebra' || !env.pxPerMeter) return;
  const tile = weaveTileMetres(t.userData.period, env.pxPerMeter, { photo: t.userData.mode === 'photo' || t.userData.generated });
  t.repeat.set(1 / tile, 1 / tile); env.invalidate();
  try { (window.__lbTiles = window.__lbTiles || {})[spec.swatchId] = tile; } catch { /* no window */ }          // metres of cloth one texture covers: read by the scale tests
}
export function weaveTexture(spec, env, { mirrorV = true } = {}) {
  const t = new THREE.Texture(), mirror = !!spec.preset;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  t.wrapT = mirror && mirrorV ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;     // trilinear + anisotropic: the weave melts into its average color when small, never into moire
  t.anisotropy = env.maxAniso || 1;
  t.repeat.set(1 / spec.tile[0], 1 / spec.tile[1]);
  t.userData.spec = spec;
  whenFabric(spec, (img, r) => {
    t.image = img;
    if (r) { t.userData.period = r.period || null; t.userData.mode = r.mode; t.userData.generated = r.source === 'generated'; }
    // a zebra's solid-band picture is several stripe periods tall (each its own cloth): it repeats every `periods` periods down the shade, not every one
    if (r?.periods > 1) t.repeat.set(1 / spec.tile[0], 1 / (spec.tile[1] * r.periods));
    // its average color (linear light), for the shader that lays the cloth out patch by patch
    if (spec.look && isStochastic(spec.look)) t.userData.meanLinear = meanLinear(img);
    applyWeaveScale(t, env); t.needsUpdate = true; env.invalidate();
  });
  return t;
}

// ---- fabric material -----------------------------------------------------------------------------------------------------------------
// MeshStandardMaterial with the swatch as colour, as a small bump (the weave catches the light) and as the colour of the daylight that
// comes through (emissive). The emissive is the room's backlight tinted by the cloth, brighter at the top (sky) than at the bottom (trees).
// `uHeight` is the height of the cloth, so the gradient follows the model when it is resized.
export function fabricMaterial({ map, glow = 0, opacity = 1, bump = 1.1, emissiveMap = map, alphaMap = null, vertexColors = false, side = THREE.FrontSide, stochastic = false }, env) {
  // stochastic: the cloth is laid out patch by patch, each patch a random window of the one texture (see STOCH_GLSL), so a 10 cm texture never shows as a grid of copies.
  // (There is no bump map then: it would carry the repeat.)
  const m = new THREE.MeshStandardMaterial({
    map, bumpMap: stochastic ? null : map, bumpScale: bump, roughness: 0.92, metalness: 0, emissiveMap, emissive: new THREE.Color(0, 0, 0),
    transparent: opacity < 1 || !!alphaMap, opacity, alphaMap, vertexColors, side, depthWrite: !(opacity < 1 || alphaMap),
  });
  m.userData.glow = glow;
  m.userData.uHeight = { value: 1 };
  m.userData.stoch = stochastic; m.userData.stochMean = { value: new THREE.Vector3(0.5, 0.5, 0.5) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHeight = m.userData.uHeight;
    sh.uniforms.uGlowTop = env.glowTop;
    sh.uniforms.uGlowBottom = env.glowBottom;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLy = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying float vLy;\nuniform float uHeight;\nuniform vec3 uGlowTop;\nuniform vec3 uGlowBottom;${m.userData.stoch ? STOCH_GLSL : ''}`)
      .replace('#include <emissivemap_fragment>', `${m.userData.stoch ? '#ifdef USE_EMISSIVEMAP\n  totalEmissiveRadiance *= lbStoch(emissiveMap, vEmissiveMapUv);\n#endif' : '#include <emissivemap_fragment>'}\n  totalEmissiveRadiance *= mix(uGlowTop, uGlowBottom, clamp(-vLy / uHeight, 0.0, 1.0));`);
    if (m.userData.stoch) { sh.uniforms.uStochMean = m.userData.stochMean; sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', 'diffuseColor *= vec4(lbStoch(map, vMapUv), 1.0);'); }
  };
  m.customProgramCacheKey = () => (stochastic ? 'lb-fabric-glow-stoch' : 'lb-fabric-glow');
  return m;
}
// the daylight colour and strength currently in the room (env.backlight is set by the scene)
export function applyGlow(mat, env) {
  mat.emissive.copy(env.backlight).multiplyScalar(mat.userData.glow);
  const mean = mat.map?.userData?.meanLinear; if (mat.userData.stoch && mean) mat.userData.stochMean.value.set(mean[0], mean[1], mean[2]);
}
// the average color of a picture in linear light (what the cloth's patches are blended around)
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export function meanLinear(img) {
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data, m = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += lin(d[i + k]);
  return m.map((v) => v / (d.length / 4));
}
// Stochastic tiling (Heitz and Neyret, as in Mikkelsen's "Practical Real-Time Hex-Tiling"): the plane is cut into a grid of triangles about half a tile wide, each corner picks a
// random window of the texture, and the three are blended with weights that keep the cloth's contrast (the blend is taken around the texture's average color). The texture is
// seamless, so any window will do; the result never repeats on a grid. Mipmaps follow the plain texture coordinates (textureGrad).
const STOCH_GLSL = `
vec2 lbHash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
uniform vec3 uStochMean;
vec3 lbStoch(sampler2D tex, vec2 uv) {
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec2 sk = mat2(1.0, 0.0, -0.57735027, 1.15470054) * (uv * 3.4641016 * 0.6);
  vec2 id = floor(sk); vec3 b = vec3(fract(sk), 0.0); b.z = 1.0 - b.x - b.y;
  vec3 w; vec2 v1; vec2 v2; vec2 v3;
  if (b.z > 0.0) { w = vec3(b.z, b.y, b.x); v1 = id; v2 = id + vec2(0.0, 1.0); v3 = id + vec2(1.0, 0.0); }
  else { w = vec3(-b.z, 1.0 - b.y, 1.0 - b.x); v1 = id + vec2(1.0, 1.0); v2 = id + vec2(1.0, 0.0); v3 = id + vec2(0.0, 1.0); }
  vec3 c1 = textureGrad(tex, uv + lbHash2(v1), dx, dy).rgb;
  vec3 c2 = textureGrad(tex, uv + lbHash2(v2), dx, dy).rgb;
  vec3 c3 = textureGrad(tex, uv + lbHash2(v3), dx, dy).rgb;
  vec3 c = w.x * c1 + w.y * c2 + w.z * c3;
  return uStochMean + (c - uStochMean) / sqrt(dot(w, w));
}`;

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
  // Texture coordinates in metres, in the SAME direction as the cloth below (u along the width, v up): the extrusion's own UVs run the wrong way round on the
  // long faces, which turned a horizontal weave on the cassette vertical. Front/back: (x, y); top/bottom: (x, z); the two end caps: (z, y).
  const pos = g.attributes.position, nor = g.attributes.normal, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i));
    if (ax > 0.7) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else if (ay > 0.7) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
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
