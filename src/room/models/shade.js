// Roller and Zebra shades, inside mount. One model, reusable on its own (the product pages can mount it in any scene):
//
//   const shade = createShade('roller' | 'zebra', env);   // env: see scene.js (makeEnv)
//   shade.setSize(widthMetres, heightMetres);              // the opening it sits in
//   shade.setFabric(fabric, optics);                       // fabric from data.js fabricOf(), optics from PRODUCTS
//   shade.setAmount(0..1);                                 // 0 raised, 1 fully lowered
//   scene.add(shade.group);                                // origin = top centre of the opening, on the fabric plane; +z towards the room
//
// The shade has a fabric-wrapped cassette at the top and a bottom rail. A Zebra has two layers of banded cloth that slide past each other
// as it moves, because it is a loop of cloth (the stripes line up at some stopping points and close to solid at others). Soft shadows: under the cassette, down the jambs, and under the rail.
import * as THREE from 'three';
import { weaveTexture, applyWeaveScale, fabricMaterial, applyGlow, barGeometry, setQuad, shadowMesh, rampTexture, whenFabric, clamp } from './common.js';
import { zebraLayout, hiddenShare, solidnessAt } from '../zebraBands.js';
import { screenOpacity } from '../optics.js';
import { CellularShade, RomanShade, ShangriLaShade } from './soft.js';

const GAP = 0.003;          // clearance each side, like a real inside mount
const CASS_H = 0.064, CASS_D = 0.054;
const RAIL_H = 0.03, RAIL_D = 0.02;

// Roller and Zebra are below; Cellular, Roman and Shangri-La are in soft.js. `opts.style`: the cellular type or the roman style.
export function createShade(kind, env, opts = {}) {
  if (kind === 'cellular') return new CellularShade(env, opts.style);
  if (kind === 'roman') return new RomanShade(env, opts.style);
  if (kind === 'shangri-la') return new ShangriLaShade(env);
  return new Shade(kind, env);
}
// where the bottom rail's grab handle sits (as a fraction of the opening's height) for a shade `a` lowered, and the other way round
export const handleFraction = (a, h) => (CASS_H + a * (h - CASS_H - RAIL_H) + RAIL_H / 2) / h;
export const amountFromHandle = (f, h) => clamp((f * h - CASS_H - RAIL_H / 2) / (h - CASS_H - RAIL_H));
export const CASSETTE = { h: CASS_H, d: CASS_D, rail: RAIL_H };

class Shade {
  constructor(kind, env) {
    this.kind = kind; this.env = env;
    this.group = new THREE.Group();
    this.width = 0.8; this.height = 1.8; this.amount = 0.5;
    this.fabric = null; this.optics = null;
    this.mats = [];            // materials that carry daylight (emissive)
    this.disposables = [];
    this.layers = [];          // cloth quads: { mesh, offset }
    this.zebraShift = 0;

    this.cassette = new THREE.Mesh(new THREE.BufferGeometry());
    this.rail = new THREE.Mesh(new THREE.BufferGeometry());
    this.group.add(this.cassette, this.rail);

    // soft shadows
    const down = rampTexture([[0, 1], [1, 0]]);
    const side = rampTexture([[0, 1], [1, 0]], true);
    this.sTop = shadowMesh(down, 0.46);
    this.sLeft = shadowMesh(side, 0.34);
    this.sRight = shadowMesh(side, 0.18); this.sRight.scale.x = -1;
    this.sRail = shadowMesh(down, 0.3);
    this.group.add(this.sTop, this.sLeft, this.sRight, this.sRail);
    this._layout();
  }

  setSize(w, h) {
    this.width = w; this.height = h;
    const iw = w - 2 * GAP;
    this.cassette.geometry.dispose(); this.rail.geometry.dispose();
    this.cassette.geometry = barGeometry(iw, CASS_H, CASS_D, 0.022);
    this.rail.geometry = barGeometry(iw, RAIL_H, RAIL_D, 0.009);
    this.mats.forEach((m) => { m.userData.uHeight.value = h; });
    this._layout();
  }

  setAmount(a) { this.amount = clamp(a); this._layout(); }
  // what every kind of shade answers for the preview scene (see soft.js): one moving part, its handle, its travel, and what it covers
  get movers() { return 1; }
  get headHeight() { return CASS_H; } get headDepth() { return CASS_D; }
  handleAt() { return handleFraction(this.amount, this.height); }
  amountAt(_k, f) { return amountFromHandle(f, this.height); }
  travelOf() { return Math.max(0.4, this.height - CASS_H - RAIL_H); }
  get span() { return { top: -1e3, bottom: this.coverage * this.height }; }

  // the zebra's stripe: from the color's band widths (admin), or a hand-cut preset's own split
  _bands() {
    const f = this.fabric || {};
    return f.bands || { period: f.tile?.[1] || 0.127, split: f.split || 0.6 };
  }
  get travel() { return this.height - CASS_H - RAIL_H; }
  get railTop() { return -CASS_H - this.amount * this.travel; }
  // fraction of the opening's height the shade covers (cassette and rail included)
  get coverage() { return (this.amount * this.travel + CASS_H + RAIL_H) / this.height; }
  // how much room light it stops right now (0..1), see PRODUCTS[].optics.block
  get block() {
    const o = this.optics; if (!o) return 0;
    let closed = 1;
    if (this.kind === 'zebra') {             // the share of the front layer's sheer band that the rear layer's solid band hides
      closed = 0.7 + 0.3 * hiddenShare(zebraLayout(this._bands(), this.amount, this.travel));
    }
    return o.block * this.coverage * closed;
  }
  // the grab handle sits on the bottom rail: height below the opening's top, as a fraction of the opening height
  get handle() { return clamp((-this.railTop + RAIL_H / 2) / this.height); }
  static handleFor(a, h) { return (CASS_H + a * (h - CASS_H - RAIL_H) + RAIL_H / 2) / h; }
  static amountFromHandle(f, h) { return clamp((f * h - CASS_H - RAIL_H / 2) / (h - CASS_H - RAIL_H)); }

  _layout() {
    const w = this.width, iw = w - 2 * GAP, a = this.amount;
    const rt = this.railTop;
    this.cassette.position.set(0, 0, 0);
    this.rail.position.set(0, rt, 0);
    const clothTop = -CASS_H * 0.6, clothBottom = rt + 0.004;
    const len = Math.max(0.001, clothTop - clothBottom);
    // Zebra is one loop of cloth: the front layer comes down from the roller, wraps the bottom rail and goes back up as the back layer.
    // Pulling the shade down makes the loop run round, so the two layers slide past each other by SLIDE x the distance dropped (a repeating
    // pattern of solid and sheer bands). Where solid lies over sheer only cloth shows; where the sheer bands of both layers line up you see through.
    const zl = this.kind === 'zebra' ? zebraLayout(this._bands(), a, this.travel) : null;     // the bands and where the two layers are (src/room/zebraBands.js)
    this.zebraShift = zl ? zl.shift : 0;                                                          // fraction of one stripe period, 0..1
    this.layers.forEach((l, i) => {
      setQuad(l.mesh.geometry, -iw / 2, iw / 2, clothTop, clothBottom, zl ? zl.vBottom[i] : 0);
    });
    // shadows
    const topH = Math.min(0.1, len);
    this.sTop.scale.set(iw, topH, 1); this.sTop.position.set(0, -CASS_H - topH / 2, 0.004);
    const sideH = Math.max(0.001, -CASS_H - (rt - RAIL_H * 0.5));
    for (const [m, sgn] of [[this.sLeft, -1], [this.sRight, 1]]) {
      const sw = 0.04;
      m.scale.set(sgn < 0 ? sw : -sw, sideH, 1);
      m.position.set(sgn * (iw / 2 - sw / 2), -CASS_H - sideH / 2, 0.004);
    }
    this.sRail.scale.set(iw, 0.09, 1); this.sRail.position.set(0, rt - RAIL_H - 0.045, -0.02);
  }

  // ---- fabric ---------------------------------------------------------------------------------------------------------------------
  setFabric(fabric, optics) {
    this.fabric = fabric; this.optics = optics;
    this._disposeMaterials();
    const env = this.env;
    const zebra = this.kind === 'zebra';
    const tex = weaveTexture(fabric, env, { mirrorV: !zebra });
    this.mainTex = tex;
    this.disposables.push(tex);
    const flat = new THREE.Color(fabric.color);
    const solid = fabricMaterial({ map: zebra ? null : tex, emissiveMap: zebra ? null : tex, glow: (optics.glow ?? optics.glowSolid ?? 0.1) * 0.3, bump: 1.2 }, env);
    this.solid = solid;
    this._applyCover();
    this.mats = [solid];
    const base = [];
    if (zebra) {
      const alphaTex = new THREE.Texture(), emTex = new THREE.Texture();
      for (const t of [alphaTex, emTex]) { t.wrapS = fabric.preset ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / fabric.tile[0], 1 / fabric.tile[1]); t.anisotropy = env.maxAniso || 1; }
      emTex.colorSpace = THREE.SRGBColorSpace;
      this.disposables.push(alphaTex, emTex);
      const m = fabricMaterial({ map: tex, emissiveMap: emTex, alphaMap: alphaTex, glow: 1, bump: 0.9, opacity: 1 }, env);
      m.color.copy(flat); m.userData.zebra = true;
      whenFabric(fabric, (img, look) => {
        if (look?.hex) this.solid?.color.set(look.hex);                      // the cassette and rail: plain cloth in the color the picker tile shows
        const { alphaCanvas, emissiveCanvas } = zebraMaps(img, this._bands().split, optics.sheerAlpha ?? 0.3, optics.glowSolid ?? 0.12, optics.glowSheer ?? 0.9);
        alphaTex.image = alphaCanvas; alphaTex.needsUpdate = true;
        emTex.image = emissiveCanvas; emTex.needsUpdate = true;
        m.color.set(0xffffff); m.needsUpdate = true; env.invalidate();
      });
      this.mats.push(m); base.push(m, m);
    } else {
      const m = fabricMaterial({ map: tex, glow: optics.glow ?? 0, opacity: optics.alpha ?? 1, bump: 1.2 }, env);
      m.color.copy(flat);
      whenFabric(fabric, (img, look) => { m.color.set(0xffffff); if (look?.hex) m.opacity = screenOpacity(optics.alpha ?? 1, look.hex); m.needsUpdate = true; solid.needsUpdate = true; });       // a dark screen stays dark: see src/room/optics.js
      this.mats.push(m); base.push(m);
    }
    solid.color.copy(flat);                                    // zebra: the cassette and rail are plain cloth colour (the texture is a stripe)
    if (!zebra) whenFabric(fabric, () => { solid.color.set(0xffffff); solid.needsUpdate = true; });
    this.mats.forEach((m) => { m.userData.uHeight.value = this.height; });
    // cloth layers
    this.layers.forEach((l) => { this.group.remove(l.mesh); l.mesh.geometry.dispose(); });
    this.layers = base.map((m, i) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
      mesh.renderOrder = 5 + i;
      mesh.position.z = zebra ? (i === 0 ? -0.005 : 0.005) : 0;     // zebra: back layer first, front layer in front
      this.group.add(mesh);
      return { mesh };
    });
    this.applyEnv();
    this._layout();
    env.invalidate();
  }

  // the cassette and bottom rail: wrapped in the shade's fabric (the default), or a plain bar ("No fabric wrap")
  setCover(cover) { this.cover = cover; this._applyCover(); this.env.invalidate(); }
  // the bottom bar can have its own color (the "bottom bar color" choice); with no color it follows the cassette (fabric or plain)
  setRailColor(hex) { this.railHex = hex || null; this._applyCover(); this.env.invalidate(); }
  _applyCover() {
    if (!this.plain) this.plain = new THREE.MeshStandardMaterial({ color: 0xe6e2d9, roughness: 0.5, metalness: 0.05 });
    const m = this.cover === 'none' || !this.solid ? this.plain : this.solid;
    this.cassette.material = m;
    if (this.railHex) {
      if (!this.railMat) this.railMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.15 });
      this.railMat.color.set(this.railHex);
      this.rail.material = this.railMat;
    } else this.rail.material = m;
  }

  applyEnv() { this.mats.forEach((m) => applyGlow(m, this.env)); }
  // the picture was resized: show the weave at the size that reads at the new pixels-per-metre
  applyScale() { if (this.mainTex) applyWeaveScale(this.mainTex, this.env); }

  _disposeMaterials() {
    this.mats.forEach((m) => m.dispose());
    this.solid = null;
    this.disposables.forEach((t) => t.dispose());
    this.mats = []; this.disposables = [];
  }

  dispose() {
    this._disposeMaterials();
    this.plain?.dispose();
    this.railMat?.dispose();
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.material.dispose(); });
    this.group.removeFromParent();
  }
}

// Zebra texture helpers: from the one-period swatch (solid band on top, sheer band below) make the alpha map (sheer bands see-through)
// and the emissive map (daylight comes mostly through the sheer bands).
function zebraMaps(img, split, sheerAlpha, glowSolid, glowSheer) {
  const N = 256, sh = Math.round(split * N);
  const solidness = (r) => solidnessAt(r, sh, N);      // 1 on the solid band, 0 on the sheer band, blended over about 6 px at each edge (src/room/zebraBands.js)
  const a = document.createElement('canvas'); a.width = 4; a.height = N;
  const actx = a.getContext('2d'); const ad = actx.createImageData(4, N);
  for (let r = 0; r < N; r++) { const v = Math.round(255 * (sheerAlpha + (1 - sheerAlpha) * solidness(r))); for (let x = 0; x < 4; x++) { const i = (r * 4 + x) * 4; ad.data[i] = ad.data[i + 1] = ad.data[i + 2] = v; ad.data[i + 3] = 255; } }
  actx.putImageData(ad, 0, 0);
  const e = document.createElement('canvas'); e.width = e.height = N;
  const ectx = e.getContext('2d'); ectx.drawImage(img, 0, 0, N, N);
  const ed = ectx.getImageData(0, 0, N, N);
  for (let r = 0; r < N; r++) {
    const f = glowSheer + (glowSolid - glowSheer) * solidness(r);
    for (let x = 0; x < N; x++) { const i = (r * N + x) * 4; ed.data[i] *= f; ed.data[i + 1] *= f; ed.data[i + 2] *= f; }
  }
  ectx.putImageData(ed, 0, 0);
  return { alphaCanvas: a, emissiveCanvas: e };
}
