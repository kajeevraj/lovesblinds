// Cellular, Roman and Shangri-La shades for the product-page preview. Same inputs as the Roller and Zebra model (models/shade.js), so the scene treats every
// kind alike:
//
//   const shade = createShade('cellular' | 'roman' | 'shangri-la', env, { style });
//   shade.setSize(w, h);  shade.setFabrics([{ fabric, optics }, ...]);  shade.setAmounts([..]);  scene.add(shade.group);
//   shade.movers          how many parts move (a top-down or day & night cellular: 2, the bottom rail first)
//   shade.handleAt(k)     where mover k's handle is, as a fraction of the opening's height;  shade.amountAt(k, f) the other way round
//
// Where everything is comes from src/room/softLayout.js (pure maths, tested offline). The cloth uses the same fabric texture, the same neutral light and the
// same daylight glow as a roller (common.js fabricMaterial); on top of that each vertex carries a soft light-and-shade factor (folds, overlaps, the pressed
// bundle of a cellular) and, for a cellular, a pleat coordinate the shader turns into fine horizontal pleat lines. Those factors multiply the finished color,
// so a plain, unshaded part of the cloth is lit exactly like a roller's.
import * as THREE from 'three';
import { weaveTexture, applyWeaveScale, fabricMaterial, applyGlow, barGeometry, shadowMesh, rampTexture, whenFabric } from './common.js';
import { CELL, ROMAN, SHANGRI, clamp, cellStyle, cellularLayout, cellularHandle, cellularAmountAt, romanStyle, romanLayout, romanHandle, romanAmountAt, shangriLayout, shangriHandle, shangriAmountAt } from '../softLayout.js';
import { sheerHexOf } from '../../lib/patternTexture.js';

const GAP = 0.003;          // clearance each side, like a real inside mount

// ---- the cloth material ---------------------------------------------------------------------------------------------------------------------------------------
// fabricMaterial plus: aShade (a per-vertex light-and-shade factor), aPleat (pleat number, running down the cloth: its fraction is where we are on a pleat)
// and an optional glow gradient of its own (a blackout has none). A pleat is two faces: the upper one turned up to the light, the lower one turned away, with
// a fine dark line where two pleats meet. Pleats too small to draw (the pressed bundle, a very tall shade on a small screen) melt into their average, so
// there is never a beat pattern.
const SHADE_GLSL = `
  float lbShade = vShade;
  if (uPleat.x > 0.0) {
    float pf = fract(vPleat), pw = fwidth(vPleat);
    float keep = 1.0 - smoothstep(0.22, 0.5, pw);
    float e = max(pw, 0.04);
    float facet = pf < 0.25 ? mix(-1.0, 1.0, smoothstep(-e, e, pf)) : (pf > 0.75 ? mix(-1.0, 1.0, smoothstep(1.0 - e, 1.0 + e, pf)) : 1.0 - 2.0 * smoothstep(0.5 - e, 0.5 + e, pf));
    float dc = min(pf, 1.0 - pf) / max(0.04, pw * 0.8);
    lbShade *= 1.0 + keep * (uPleat.x * facet - uPleat.y * exp(-dc * dc));
  }
  outgoingLight *= lbShade;
`;
function clothMaterial({ map, glow = 0.7, grad = null, pleat = null, side = THREE.FrontSide, bump = 1.1 }, env) {
  const m = fabricMaterial({ map, glow, bump, side }, env), base = m.onBeforeCompile;
  m.userData.grad = grad ? { top: { value: new THREE.Vector3(grad[0], grad[0], grad[0]) }, bottom: { value: new THREE.Vector3(grad[1], grad[1], grad[1]) } } : null;
  m.userData.pleat = { value: new THREE.Vector2(pleat ? pleat[0] : 0, pleat ? pleat[1] : 0) };
  m.onBeforeCompile = (sh) => {
    base(sh);
    if (m.userData.grad) { sh.uniforms.uGlowTop = m.userData.grad.top; sh.uniforms.uGlowBottom = m.userData.grad.bottom; }
    sh.uniforms.uPleat = m.userData.pleat;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShade;\nattribute float aPleat;\nvarying float vShade;\nvarying float vPleat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShade = aShade; vPleat = aPleat;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vShade;\nvarying float vPleat;\nuniform vec2 uPleat;')
      .replace('#include <opaque_fragment>', `${SHADE_GLSL}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'lb-fabric-soft';
  return m;
}

// ---- a sheet of quads that is rewritten as the shade moves --------------------------------------------------------------------------------------------------
// Each quad has its four corners, texture coordinates in metres (u along the width, v up the cloth), a shade factor and a pleat number at its top and bottom
// edge, and one normal. Rewriting a few hundred of them per frame is cheap, and nothing is allocated while the shade moves.
class Strips {
  constructor(maxQuads) {
    const n = maxQuads * 4;
    this.max = maxQuads; this.q = 0;
    this.pos = new Float32Array(n * 3); this.nor = new Float32Array(n * 3); this.uv = new Float32Array(n * 2); this.shade = new Float32Array(n); this.pleat = new Float32Array(n);
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(maxQuads * 6);
    for (let i = 0; i < maxQuads; i++) idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);       // corners: 0 top left, 1 top right, 2 bottom left, 3 bottom right
    const g = this.geo = new THREE.BufferGeometry();
    const attr = (name, arr, size) => { const a = new THREE.BufferAttribute(arr, size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.attrs = [attr('position', this.pos, 3), attr('normal', this.nor, 3), attr('uv', this.uv, 2), attr('aShade', this.shade, 1), attr('aPleat', this.pleat, 1)];
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e3);                // never culled, never recomputed
  }
  begin() { this.q = 0; }
  // one quad: x0..x1; top edge at yT0 (left) and yT1 (right), bottom edge at yB0 and yB1; o: { vT, vB, sT, sB, pT, pB, zT, zB, ny, nz }
  quad(x0, x1, yT0, yT1, yB0, yB1, o) {
    if (this.q >= this.max) return;
    const i = this.q++ * 4, { vT = 0, vB = 0, sT = 1, sB = 1, pT = 0, pB = 0, zT = 0, zB = 0, ny = 0, nz = 1 } = o;
    const P = this.pos, N = this.nor, U = this.uv;
    P[i * 3] = x0; P[i * 3 + 1] = yT0; P[i * 3 + 2] = zT; P[i * 3 + 3] = x1; P[i * 3 + 4] = yT1; P[i * 3 + 5] = zT;
    P[i * 3 + 6] = x0; P[i * 3 + 7] = yB0; P[i * 3 + 8] = zB; P[i * 3 + 9] = x1; P[i * 3 + 10] = yB1; P[i * 3 + 11] = zB;
    for (let k = 0; k < 4; k++) { N[(i + k) * 3] = 0; N[(i + k) * 3 + 1] = ny; N[(i + k) * 3 + 2] = nz; }
    U[i * 2] = x0; U[i * 2 + 1] = vT; U[i * 2 + 2] = x1; U[i * 2 + 3] = vT; U[i * 2 + 4] = x0; U[i * 2 + 5] = vB; U[i * 2 + 6] = x1; U[i * 2 + 7] = vB;
    this.shade[i] = this.shade[i + 1] = sT; this.shade[i + 2] = this.shade[i + 3] = sB;
    this.pleat[i] = this.pleat[i + 1] = pT; this.pleat[i + 2] = this.pleat[i + 3] = pB;
  }
  end() { this.geo.setDrawRange(0, this.q * 6); for (const a of this.attrs) a.needsUpdate = true; }
}

// ---- what the three kinds share ---------------------------------------------------------------------------------------------------------------------------------
class SoftShade {
  constructor(kind, env) {
    this.kind = kind; this.env = env; this.group = new THREE.Group();
    this.width = 0.8; this.height = 1.8; this.amounts = [0.55];
    this.mats = []; this.texs = []; this.meshes = []; this.layers = [];
    this.railMat = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.55, metalness: 0.04 });        // rails and cassette: plain, in the cloth's own color
    const down = rampTexture([[0, 1], [1, 0]]), side = rampTexture([[0, 1], [1, 0]], true);
    this.sTop = shadowMesh(down, 0.46); this.sLeft = shadowMesh(side, 0.34); this.sRight = shadowMesh(side, 0.18); this.sRail = shadowMesh(down, 0.3);
    this.group.add(this.sTop, this.sLeft, this.sRight, this.sRail);
  }
  get movers() { return 1; }
  get amount() { return this.amounts[0]; }
  get iw() { return this.width - 2 * GAP; }
  setSize(w, h) { this.width = w; this.height = h; this.mats.forEach((m) => { m.userData.uHeight.value = h; }); this._size(); this._layout(); }
  setAmount(a, k = 0) { this.amounts[k] = clamp(a); this._layout(); }
  setAmounts(arr) { for (let k = 0; k < this.movers; k++) this.amounts[k] = clamp(arr[k] ?? this.amounts[k] ?? 0); this._layout(); }
  setFabric(fabric, optics) { this.setFabrics([{ fabric, optics }]); }
  setCover() {} setRailColor() {}
  travelOf() { return Math.max(0.4, this.height - 0.1); }
  get coverage() { return this.span.bottom / this.height; }
  applyEnv() { this.mats.forEach((m) => applyGlow(m, this.env)); }
  applyScale() { this.texs.forEach((t) => applyWeaveScale(t, this.env)); }

  // a cloth material for one fabric: flat color until its texture is ready; `onLook` gets what the texture pipeline decided (its color)
  _cloth(layer, opts, onLook) {
    const env = this.env, tex = weaveTexture(layer.fabric, env, { mirrorV: false });
    const m = clothMaterial({ map: tex, ...opts }, env);
    m.color.set(layer.fabric.color); m.userData.uHeight.value = this.height;
    whenFabric(layer.fabric, (img, look) => { if (!this.mats.includes(m)) return; m.color.set(0xffffff); m.needsUpdate = true; onLook?.(look); env.invalidate(); });
    this.texs.push(tex); this.mats.push(m);
    return m;
  }
  _mesh(geo, mat, order = 5) { const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = order; this.group.add(mesh); this.meshes.push(mesh); return mesh; }
  _clearFabrics() {
    this.meshes.forEach((m) => this.group.remove(m)); this.meshes = [];
    this.mats.forEach((m) => m.dispose()); this.texs.forEach((t) => t.dispose()); this.mats = []; this.texs = [];
  }
  // soft shadows: under the head onto the cloth, down the two jambs, and under the bottom edge onto the glass
  _shadows(top, bottom, z = 0.004) {
    const iw = this.iw, len = Math.max(0.001, bottom - top), topH = Math.min(0.1, len);
    this.sTop.scale.set(iw, topH, 1); this.sTop.position.set(0, -top - topH / 2, z);
    for (const [m, sgn] of [[this.sLeft, -1], [this.sRight, 1]]) { const sw = 0.04; m.scale.set(sgn < 0 ? sw : -sw, len, 1); m.position.set(sgn * (iw / 2 - sw / 2), -top - len / 2, z); }
    this.sRail.scale.set(iw, 0.09, 1); this.sRail.position.set(0, -bottom - 0.045, -0.02);
  }
  dispose() {
    this._clearFabrics(); this.railMat.dispose();
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.material.dispose(); });
    this.group.removeFromParent();
  }
}
const bar = (mat) => new THREE.Mesh(new THREE.BufferGeometry(), mat);
const setBar = (mesh, w, h, d, r) => { mesh.geometry.dispose(); mesh.geometry = barGeometry(w, h, d, r); };

// ---- Cellular ---------------------------------------------------------------------------------------------------------------------------------------------------
// A smooth cloth face with fine horizontal pleat lines and soft shading (the honeycomb cells are inside, never drawn). Raised, the pleats press into a short,
// neat bundle on the rail below them. Top-down/bottom-up: the top rail hangs on two cords and moves too. Day & night: a day cloth above a middle rail and a
// blackout cloth below it; sliding the middle rail chooses which one covers the window.
export class CellularShade extends SoftShade {
  constructor(env, style) {
    super('cellular', env);
    this.style = cellStyle(style); this.amounts = this.movers > 1 ? [0.8, 0.22] : [0.55];
    this.head = bar(this.railMat); this.rail = bar(this.railMat); this.group.add(this.head, this.rail);
    if (this.movers > 1) { this.upper = bar(this.railMat); this.group.add(this.upper); }
    if (this.style === 'top-down-bottom-up') {
      this.cordMat = new THREE.MeshBasicMaterial({ color: 0xcfc9bd, toneMapped: false });
      this.cords = [0, 1].map(() => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 1, 0.0016), this.cordMat); this.group.add(c); return c; });
    }
    this.strips = [];
    this._size(); this._layout();
  }
  get movers() { return this.style === 'standard' ? 1 : 2; }
  get headHeight() { return CELL.HEAD_H; } get headDepth() { return CELL.HEAD_D; }
  get layout() { return cellularLayout(this.style, this.height, this.amounts); }
  get span() { return this.layout.cover; }
  handleAt(k = 0) { return cellularHandle(this.style, this.height, this.amounts, k); }
  amountAt(k, f) { return cellularAmountAt(this.style, this.height, k, f); }
  travelOf() { return this.layout.free; }
  // the two rails never cross: the one that is being moved pushes the other
  constrain(vals, k) { if (this.movers < 2) return vals; if (k === 0) vals[1] = Math.min(vals[1], vals[0]); else vals[0] = Math.max(vals[0], vals[1]); return vals; }

  _size() {
    const iw = this.iw;
    setBar(this.head, iw, CELL.HEAD_H, CELL.HEAD_D, 0.008); setBar(this.rail, iw, CELL.RAIL_H, CELL.RAIL_D, 0.008);
    if (this.upper) setBar(this.upper, iw, CELL.RAIL_H, CELL.RAIL_D, 0.008);
  }
  setFabrics(layers) {
    this._clearFabrics(); this.layers = layers;
    const count = this.style === 'day-night' ? 2 : 1;
    this.strips = [];
    for (let i = 0; i < count; i++) {
      const layer = layers[i] || layers[0]; if (!layer) break;
      const o = layer.optics || {}, strips = new Strips(4);
      const m = this._cloth(layer, { glow: o.glow ?? 0.7, grad: o.grad, pleat: o.pleat || [0.03, 0.085], bump: 0.6 }, i === 0 ? (look) => { if (look?.hex) this.railMat.color.set(look.hex); } : null);
      if (i === 0) this.railMat.color.set(layer.fabric.color);
      this._mesh(strips.geo, m); this.strips.push(strips);
    }
    this.applyEnv(); this._layout(); this.env.invalidate();
  }
  _layout() {
    const L = this.layout, iw = this.iw, x0 = -iw / 2, x1 = iw / 2;
    this.rail.position.set(0, -L.bottom[0], 0);
    if (this.upper && L.upper) this.upper.position.set(0, -L.upper[0], 0);
    if (this.cords && L.cords) {
      const len = Math.max(0.0005, L.cords[1] - L.cords[0]), inset = Math.min(0.14, iw * 0.2);
      this.cords.forEach((c, i) => { c.scale.y = len; c.position.set((i ? 1 : -1) * (iw / 2 - inset), -L.cords[0] - len / 2, 0); c.visible = len > 0.002; });
    }
    for (const s of L.sections) {
      const strips = this.strips[s.layer]; if (!strips) continue;
      strips.begin();
      // the open pleats, hanging from the top of this cloth
      if (s.ext > 1e-5) strips.quad(x0, x1, -s.top, -s.top, -s.top - s.ext, -s.top - s.ext, { vT: 0, vB: -s.ext, pT: 0, pB: s.ext / CELL.PITCH });
      // the pressed bundle on the rail below: the same cloth squeezed flat, a touch darker, with fine lines
      if (s.bundle > 1e-5) strips.quad(x0, x1, -s.top - s.ext, -s.top - s.ext, -s.bottom, -s.bottom, { vT: -s.ext, vB: -s.ext - s.hidden * CELL.PITCH, sT: 0.93, sB: 0.88, pT: 0.5, pB: 0.5 + s.bundle / CELL.LINE });
      strips.end();
    }
    const first = L.sections[0], last = L.sections[L.sections.length - 1];
    this._shadows(first.top, last.bottom + CELL.RAIL_H);
  }
}

// ---- Roman ------------------------------------------------------------------------------------------------------------------------------------------------------
// A flat cloth that folds into soft, evenly stacked horizontal folds as it rises (a fold about every 8 in), under a headrail covered in the same cloth.
const SEGS = 24;                                                    // columns of a relaxed shade (its folds sag in a curve)
const sagAt = (x, w) => { const t = (2 * x) / w; return Math.max(0, 1 - t * t); };
const HOBBLE = [[0, 0.8], [0.2, 0.98], [0.55, 1.05], [0.86, 1.0], [1, 0.87]];          // one hobbled panel, top to bottom: tucked under the loop above, round and lit, turning under
export class RomanShade extends SoftShade {
  constructor(env, style) {
    super('roman', env);
    this.style = romanStyle(style);
    this.head = bar(this.railMat); this.group.add(this.head);
    this.strips = new Strips(this.style === 'relax' ? 4800 : 700);
    this._size(); this._layout();
  }
  get headHeight() { return ROMAN.HEAD_H; } get headDepth() { return ROMAN.HEAD_D; }
  get layout() { return romanLayout(this.style, this.height, this.width, this.amounts[0]); }
  get span() { const l = this.layout; return { top: 0, bottom: (l.edge + l.low) / 2 }; }
  handleAt() { return romanHandle(this.style, this.height, this.width, this.amounts[0]); }
  amountAt(_k, f) { return romanAmountAt(this.style, this.height, this.width, f); }
  travelOf() { const l = this.layout; return Math.max(0.3, l.dMax - l.dMin); }
  _size() { setBar(this.head, this.iw, ROMAN.HEAD_H, ROMAN.HEAD_D, 0.006); }
  setFabrics(layers) {
    this._clearFabrics(); this.layers = layers;
    const layer = layers[0]; if (!layer) return;
    const o = this.optics = layer.optics || {};
    const face = this._cloth(layer, { glow: o.glow ?? 0.7, grad: o.grad, bump: 1.1 });
    // the headrail is wrapped in the same cloth (lit by the room, with only a little daylight through it)
    const wrap = fabricMaterial({ map: this.texs[0], glow: (o.glow ?? 0.7) * 0.3, bump: 1.2 }, this.env);
    wrap.color.set(layer.fabric.color); wrap.userData.uHeight.value = this.height;
    whenFabric(layer.fabric, () => { if (!this.mats.includes(wrap)) return; wrap.color.set(0xffffff); wrap.needsUpdate = true; });
    this.mats.push(wrap); this.head.material = wrap;
    this._mesh(this.strips.geo, face);
    this.applyEnv(); this._layout(); this.env.invalidate();
  }
  _layout() {
    const L = this.layout, st = this.strips, iw = this.iw, relax = this.style === 'relax', segs = relax ? SEGS : 1, S = L.sag;
    const stack = this.optics?.stack ?? 1;
    st.begin();
    // one row of quads between two edges; an edge is [depth, sag]: its depth at the sides and how much lower it hangs in the middle
    const row = (top, bot, sT, sB, vT, vB) => {
      if (bot[0] + bot[1] - top[0] - top[1] < 1e-5 && bot[0] - top[0] < 1e-5) return;
      for (let c = 0; c < segs; c++) {
        const xa = -iw / 2 + (iw * c) / segs, xb = -iw / 2 + (iw * (c + 1)) / segs, ka = segs > 1 ? sagAt(xa, iw) : 0, kb = segs > 1 ? sagAt(xb, iw) : 0;
        st.quad(xa, xb, -(top[0] + top[1] * ka), -(top[0] + top[1] * kb), -(bot[0] + bot[1] * ka), -(bot[0] + bot[1] * kb), { vT, vB, sT, sB });
      }
    };
    // ---- the flat face: from the headrail to the bottom of the fold in front; the style's lines sit at the ring rows that still hang flat
    const pts = [[L.T0, 1, 0]];                                        // [depth, shade, sag]
    const limit = L.FB - (L.folded ? 0.034 : 0.002), hobble = this.style === 'hobble';
    const add = (y, s) => { if (y > pts[pts.length - 1][0] - 1e-6 && y < limit) pts.push([y, s, 0]); };
    if (hobble) {                                                      // every panel is one soft loop; the top one starts behind the headrail
      const shadeAt = (t) => { for (let i = 0; i + 1 < HOBBLE.length; i++) if (t <= HOBBLE[i + 1][0]) return HOBBLE[i][1] + (HOBBLE[i + 1][1] - HOBBLE[i][1]) * (t - HOBBLE[i][0]) / (HOBBLE[i + 1][0] - HOBBLE[i][0]); return 1; };
      for (let j = Math.ceil((L.Hf - L.T0) / ROMAN.FOLD); j >= L.n + 1; j--) {
        const a = L.Hf - j * ROMAN.FOLD;
        if (a < L.T0 && a + ROMAN.FOLD > L.T0) pts[0][1] = shadeAt((L.T0 - a) / ROMAN.FOLD);
        for (const [t, s] of HOBBLE) { const y = a + t * ROMAN.FOLD; if (y <= L.T0 + 1e-4 || y >= limit) continue; if (t === 0) pts.push([y, s, 0]); else add(y, s); }
      }
    } else for (const y of L.lines) {
      if (this.style === 'plain-fold') { add(y - 0.007, 1); add(y - 0.001, 0.84); add(y + 0.002, 0.84); add(y + 0.008, 1); }
      else if (this.style === 'ribble') { add(y - 0.014, 1); add(y - 0.003, 1.06); add(y, 0.8); add(y + 0.012, 1); }
    }
    if (L.folded) {                                                    // the fold in front: round, turning under at its bottom edge
      const last = pts[pts.length - 1][0], from = Math.max(last + 1e-4, relax ? L.R - 0.07 : L.FB - 0.03);
      if (!hobble && from < L.FB - 0.011) pts.push([from, 1, 0]);
      if (L.FB - 0.01 > pts[pts.length - 1][0]) pts.push([L.FB - 0.01, 1.01, S * 0.9]);
      pts.push([L.FB, 0.9, S]);
    } else pts.push([L.FB, 1, S]);
    for (let i = 0; i + 1 < pts.length; i++) row([pts[i][0], pts[i][2]], [pts[i + 1][0], pts[i + 1][2]], pts[i][1], pts[i + 1][1], -pts[i][0], -pts[i + 1][0]);
    // ---- the finished folds that peek out below it, front to back: in the shadow of the fold in front, then round and lit, then turning under
    let top = [L.FB, S];
    L.bands.forEach((b) => {
      const bot = [b.bottom, b.sag], hgt = Math.max(1e-4, b.bottom - top[0]), t1 = Math.min(0.4, 0.012 / hgt), t2 = 1 - Math.min(0.3, 0.007 / hgt);
      const at = (t) => [top[0] + (bot[0] - top[0]) * t, top[1] + (bot[1] - top[1]) * t], v = (t) => -(b.mid - hgt * (1 - t));
      row(at(0), at(t1), 0.6 * stack, 0.95 * stack, v(0), v(t1));
      row(at(t1), at(t2), 0.95 * stack, 1.0 * stack, v(t1), v(t2));
      row(at(t2), at(1), 1.0 * stack, 0.88 * stack, v(t2), v(1));
      top = bot;
    });
    st.end();
    this._shadows(L.T0, (L.edge + L.low) / 2, 0.006);
  }
}

// ---- Shangri-La -------------------------------------------------------------------------------------------------------------------------------------------------
// Two sheers with soft horizontal cloth vanes between them; it rolls into a cassette. Closed vanes overlap (privacy); open vanes lie level and you look
// through the sheers between them.
const VANE_SHADE = [[0, 0.99], [0.3, 1.035], [0.65, 1.0], [1, 0.9]];          // along a vane, from its lower front edge to its upper back edge (tucked behind the vane above)
export class ShangriLaShade extends SoftShade {
  constructor(env) {
    super('shangri-la', env);
    this.vanes = 0;
    this.cass = bar(this.railMat); this.rail = bar(this.railMat); this.group.add(this.cass, this.rail);
    const sheer = (opacity, order) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, toneMapped: false })); m.renderOrder = order; this.group.add(m); return m; };
    this.back = sheer(0.2, 4); this.front = sheer(0.1, 7);
    this.strips = new Strips(1300);
    this._size(); this._layout();
  }
  get headHeight() { return SHANGRI.CASS_H; } get headDepth() { return SHANGRI.CASS_D; }
  get layout() { return shangriLayout(this.height, this.amounts[0], this.vanes); }
  get span() { return this.layout.cover; }
  handleAt() { return shangriHandle(this.height, this.amounts[0]); }
  amountAt(_k, f) { return shangriAmountAt(this.height, f); }
  travelOf() { return this.layout.travel; }
  setVanes(v) { this.vanes = clamp(v); this._layout(); }
  _size() { setBar(this.cass, this.iw, SHANGRI.CASS_H, SHANGRI.CASS_D, 0.016); setBar(this.rail, this.iw, SHANGRI.RAIL_H, SHANGRI.RAIL_D, 0.009); }
  setFabrics(layers) {
    this._clearFabrics(); this.layers = layers;
    const layer = layers[0]; if (!layer) return;
    const o = layer.optics || {};
    this.front.material.opacity = o.sheerFront ?? 0.1; this.back.material.opacity = o.sheerBack ?? 0.2;
    const tint = (hex) => { this.railMat.color.set(hex); const s = sheerHexOf(hex); this.front.material.color.set(s); this.back.material.color.set(s); };
    tint(layer.fabric.color);
    const m = this._cloth(layer, { glow: o.glow ?? 0.7, grad: o.grad, side: THREE.DoubleSide, bump: 0.8 }, (look) => { if (look?.hex) tint(look.hex); });
    this._mesh(this.strips.geo, m, 5);
    this.applyEnv(); this._layout(); this.env.invalidate();
  }
  _layout() {
    const L = this.layout, iw = this.iw, x0 = -iw / 2 + 0.001, x1 = iw / 2 - 0.001, st = this.strips;
    const zb = SHANGRI.BACK_Z, zf = zb + L.sep;
    this.cass.position.set(0, 0, 0.014);
    // the bottom rail turns to part the sheers: it is as deep as the gap between them
    this.rail.scale.z = (SHANGRI.RAIL_D + L.sep) / SHANGRI.RAIL_D; this.rail.position.set(0, -L.rail, (zb + zf) / 2);
    const top = SHANGRI.CASS_H * 0.6, len = Math.max(0.001, L.rail + 0.004 - top);
    for (const [m, z] of [[this.back, zb - 0.0006], [this.front, zf + 0.0006]]) { m.scale.set(iw - 0.002, len, 1); m.position.set(0, -top - len / 2, z); }
    st.begin();
    const ny = L.sep / SHANGRI.VANE, nz = L.rise / SHANGRI.VANE, curve = 0.006 * L.open;
    L.vanes.forEach((y, k) => {
      for (let i = 0; i + 1 < VANE_SHADE.length; i++) {
        const [ta, sa] = VANE_SHADE[i], [tb, sb] = VANE_SHADE[i + 1];
        const z = (t) => zf + (zb - zf) * t + curve * Math.sin(2 * Math.PI * t), v = (t) => (k + t) * SHANGRI.VANE;
        st.quad(x0, x1, -(y - L.rise * tb), -(y - L.rise * tb), -(y - L.rise * ta), -(y - L.rise * ta), { vT: v(tb), vB: v(ta), sT: sb, sB: sa, zT: z(tb), zB: z(ta), ny, nz });
      }
    });
    st.end();
    this._shadows(SHANGRI.CASS_H, L.rail + SHANGRI.RAIL_H, zf + 0.004);
  }
}
