// Dream Curtains: a track with many vertical strips hanging side by side, every strip the same single piece of sheer fabric (no alternating sheer and solid). Each strip
// is one soft wave seen from above (src/room/dreamLayout.js has the numbers: style A and B are the two strip sizes). All the strips move together along the track,
// open towards the stack side and closed again; a hand pressed between them parts them sideways and they swing back when it lets go.
//
//   const curtain = createShade('dream', env, { style: 'A', stack: 'right', install: 'ceiling', control: 'manual' });
//   curtain.setSize(w, h); curtain.setFabrics([{ fabric, optics }]); curtain.setAmount(0..1);   // 0 closed, 1 fully open
//   curtain.setPush({ cx, cy, amp });                                                            // a hand at (cx, cy) metres from the top centre, strength 0..1
// The group's origin is the top centre of the curtain, on the track's plane; +z is towards the room.
import * as THREE from 'three';
import { SoftShade, clothMaterial, GAP } from './soft.js';
import { layoutOf, profileOf, pushOf, travelOf, STACK_YAW, stripOf, OVERLAP, jointNear } from '../dreamLayout.js';

const NU = 14;                                  // segments across one strip
const TRACK_H = 0.03, TRACK_D = 0.03;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export class DreamShade extends SoftShade {
  constructor(env, opts = {}) {
    super('dream', env);
    this.opt = { style: opts.style === 'B' ? 'B' : 'A', stack: opts.stack || 'right', install: opts.install === 'side' ? 'side' : 'ceiling', control: opts.control || 'manual', wired: !!opts.wired };
    this.amounts = [0.35]; this.push = { cx: 0, cy: 0, amp: 0 };
    [this.sTop, this.sLeft, this.sRight, this.sRail].forEach((m) => { m.visible = false; });         // (the cassette shadows are not wanted here)
    this.hard = new THREE.Group(); this.group.add(this.hard);
    this.trackMat = new THREE.MeshStandardMaterial({ color: 0xece8df, roughness: 0.45, metalness: 0.15 });
    this.rodMat = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.4, metalness: 0.1 });
    this.haloMat = new THREE.MeshBasicMaterial({ color: 0x2b2824, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
    this.geo = null; this.mesh = null;
    this._rebuildHardware(); this._rebuildStrips(); this._layout();
  }
  // the window-side numbers the scene uses
  get movers() { return 1; }
  get headHeight() { return TRACK_H; } get headDepth() { return TRACK_D; }
  get span() { return { top: 0, bottom: this.height }; }
  get dim() { return 0; }
  handleAt() { return 0.5; }
  amountAt() { return this.amounts[0]; }
  travelOf() { return travelOf({ span: this.iw, style: this.opt.style, stack: this.opt.stack }); }
  setVanes() {}
  setOptions(o) {
    const next = { ...this.opt, ...o }; next.style = next.style === 'B' ? 'B' : 'A'; next.install = next.install === 'side' ? 'side' : 'ceiling';
    const stripsChanged = next.style !== this.opt.style || next.stack !== this.opt.stack;
    this.opt = next; this._rebuildHardware(); if (stripsChanged) this._rebuildStrips(); this._layout(); this.env.invalidate();
  }
  setSize(w, h) { this.width = w; this.height = h; this.mats.forEach((m) => { m.userData.uHeight.value = h; }); this._rebuildHardware(); this._rebuildStrips(); this._layout(); }
  // the nearest joint between two strips to x (metres across the curtain): a hovering cursor opens that gap
  jointAt(x) { return jointNear(this.layout.strips.map((t) => t.x), x, this.layout.pitch); }
  setPush(p) { this.push = { cx: p.cx ?? this.push.cx, cy: p.cy ?? this.push.cy, amp: p.amp ?? 0 }; this._layout(); }
  _size() {}

  // ---- the track, its brackets, the rod and the motor ---------------------------------------------------------------------------------------------------------
  _rebuildHardware() {
    const g = this.hard; while (g.children.length) { const c = g.children.pop(); c.geometry?.dispose(); }
    const iw = this.iw, side = this.opt.install === 'side', zT = this.zOff(), box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
    box(iw, TRACK_H, TRACK_D, this.trackMat, 0, -TRACK_H / 2, zT);                                                       // the track
    for (const sx of [-1, 1]) box(0.012, TRACK_H, TRACK_D + 0.004, this.trackMat, sx * (iw / 2 - 0.006), -TRACK_H / 2, zT);            // end caps
    if (side) {                                                                                                          // a wall (side) install stands off the wall on brackets
      const nb = iw > 1.6 ? 3 : 2, xs = nb === 3 ? [-iw / 2 + 0.08, 0, iw / 2 - 0.08] : [-iw / 2 + 0.08, iw / 2 - 0.08];
      for (const x of xs) { box(0.016, 0.034, zT, this.trackMat, x, -TRACK_H / 2 - 0.004, zT / 2 - TRACK_D / 2); box(0.016, 0.012, 0.014, this.trackMat, x, 0.002, 0.006); }
    }
    if (this.opt.control === 'motorized') {                                                                              // the motor sits at the stack end of the track
      const sx = this.opt.stack === 'left' ? -1 : 1, mx = sx * (iw / 2 - 0.09);
      box(0.15, 0.05, 0.05, new THREE.MeshStandardMaterial({ color: 0x6b6458, roughness: 0.7 }), mx, -TRACK_H / 2 - 0.004, zT + TRACK_D / 2 + 0.022);
    }
  }
  zOff() { return this.opt.install === 'side' ? 0.045 : 0; }          // how far in front of the wall the track hangs

  // ---- the strips ---------------------------------------------------------------------------------------------------------------------------------------------
  _rebuildStrips() {
    const iw = this.iw, L = layoutOf({ span: iw, style: this.opt.style, stack: this.opt.stack, a: 0 }), n = L.count, nv = Math.min(18, Math.max(6, Math.round(this.height / 0.14)));
    this.n = n; this.nv = nv; this.prof = profileOf(this.opt.style, NU);
    const verts = n * (NU + 1) * (nv + 1), P = new Float32Array(verts * 3), N = new Float32Array(verts * 3), UV = new Float32Array(verts * 2), SH = new Float32Array(verts).fill(1), PL = new Float32Array(verts);
    const idx = new (verts > 65535 ? Uint32Array : Uint16Array)(n * NU * nv * 6);
    let o = 0;
    for (let i = 0; i < n; i++) for (let r = 0; r < nv; r++) for (let c = 0; c < NU; c++) {
      const a = (i * (nv + 1) + r) * (NU + 1) + c, b = a + 1, d = a + (NU + 1), e = d + 1;
      idx[o++] = a; idx[o++] = d; idx[o++] = b; idx[o++] = b; idx[o++] = d; idx[o++] = e;
    }
    // the cloth's texture coordinates are metres along the strip and down it; every strip starts at its own place in the cloth, so no two strips repeat each other
    for (let i = 0; i < n; i++) {
      const off = ((i * 0.6180339887) % 1) * 1.7;
      for (let r = 0; r <= nv; r++) for (let c = 0; c <= NU; c++) {
        const v = (i * (nv + 1) + r) * (NU + 1) + c, y = (r / nv) * this.height;
        UV[v * 2] = this.prof.points[c].s + off; UV[v * 2 + 1] = y;
        const t = c / NU, ao = 0.8 + 0.2 * Math.pow(Math.sin(Math.PI * t), 0.8), top = 0.84 + 0.16 * clamp01(y / 0.3);          // a touch darker where two strips meet and under the track
        SH[v] = ao * top;
      }
    }
    if (this.geo) this.geo.dispose();
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setAttribute('aShade', new THREE.BufferAttribute(SH, 1)); g.setAttribute('aPleat', new THREE.BufferAttribute(PL, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e3);
    if (this.mesh) { this.mesh.geometry = g; }
  }
  setFabrics(layers) {
    this._clearFabrics(); this.layers = layers;
    const layer = layers[0]; if (!layer) return;
    const o = layer.optics || {};
    const m = this._cloth(layer, { glow: o.glow ?? 0.85, grad: o.grad, side: THREE.DoubleSide, bump: 0.5 }, null);
    this.mesh = this._mesh(this.geo, m, 5);
    this.applyEnv(); this._layout(); this.env.invalidate();
  }
  // ---- placing the strips -------------------------------------------------------------------------------------------------------------------------------------
  get layout() { return layoutOf({ span: this.iw, style: this.opt.style, stack: this.opt.stack, a: this.amounts[0], n: this.n }); }
  // where the leading edge of each half is (group coordinates), and which way it moves to open
  leads() {
    const L = this.layout, zT = this.zOff(), out = [];
    for (const ld of L.lead || []) {
      const dir = -ld.side;                       // the strip's edge on the open side faces away from its stack
      out.push({ centerX: ld.x, edgeX: ld.x + dir * L.pitch / 2, opens: ld.side, z: zT + this.prof.depth * 0.5 });
    }
    return out;
  }
  _layout() {
    if (!this.geo) return;
    const L = this.layout, iw = this.iw, H = this.height, nv = this.nv, n = this.n, prof = this.prof.points, depth = this.prof.depth, zT = this.zOff() + TRACK_D / 2 + 0.004;
    const P = this.geo.attributes.position.array, N = this.geo.attributes.normal.array, hand = this.push.amp > 0.0005 ? this.push : null;
    const sx = (L.pitch / this.prof.chord) * OVERLAP;                       // each strip is stretched a hair so the strips overlap and no gap shows
    const dz = Math.min(0.008, 0.1 / Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const st = L.strips[i], zc = depth / 2, zBase = zT + st.index * dz * st.gathered + (i % 2 ? 0.004 : 0) * (1 - st.gathered), xBase = st.x;
      for (let r = 0; r <= nv; r++) {
        const y = (r / nv) * H, hp = hand ? pushOf(hand, xBase, y) : { dx: 0, yaw: 0 }, phi = st.yaw + hp.yaw, cs = Math.cos(phi), sn = Math.sin(phi), xr = xBase + hp.dx;
        for (let c = 0; c <= NU; c++) {
          const p = prof[c], v = (i * (nv + 1) + r) * (NU + 1) + c, lx = p.x * sx, lz = p.z - zc;
          P[v * 3] = xr + lx * cs + lz * sn; P[v * 3 + 1] = -y; P[v * 3 + 2] = zBase + zc + (-lx * sn + lz * cs);
          const th = p.th, nx = -Math.sin(th) / sx, nz = Math.cos(th), nl = Math.hypot(nx, nz) || 1, ax = nx / nl, az = nz / nl;
          N[v * 3] = ax * cs + az * sn; N[v * 3 + 1] = 0; N[v * 3 + 2] = -ax * sn + az * cs;
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true;
    this._rod(L);
    this.env.invalidate();
  }
  // where each strip is at height `y` (metres down from the track), the hand included: for the tests and the page
  stripXs(y = this.height * 0.5) {
    const L = this.layout, hand = this.push.amp > 0.0005 ? this.push : null;
    return L.strips.map((st) => st.x + (hand ? pushOf(hand, st.x, y).dx : 0));
  }
  // the pull rod hangs from the leading edge of the strip that leads
  _rod(L) {
    if (this.opt.control !== 'pull-rod') { if (this.rod) { this.hard.remove(this.rod); this.rod = null; } return; }
    const ld = (L.lead || [])[0]; if (!ld) return;
    const len = Math.min(1.05, this.height * 0.72), x = ld.x + (-ld.side) * (L.pitch / 2 - 0.004), z = this.zOff() + TRACK_D / 2 + this.prof.depth + 0.03;
    if (!this.rod) {
      const g = new THREE.Group();
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 1, 10), this.haloMat), rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 10), this.rodMat);
      halo.position.z = -0.003; g.add(halo, rod);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 14), this.rodMat), knobHalo = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0175, 0.075, 14), this.haloMat);
      knobHalo.position.z = -0.004; g.add(knobHalo, knob);
      g.userData = { rod, halo, knob, knobHalo }; this.rod = g; this.hard.add(g);
    }
    const u = this.rod.userData; u.rod.scale.y = len; u.halo.scale.y = len; u.rod.position.y = u.halo.position.y = -TRACK_H - len / 2; u.knob.position.y = u.knobHalo.position.y = -TRACK_H - len - 0.03;
    this.rod.position.set(x, 0, z);
    this.rodInfo = { x, len, top: TRACK_H, z };
  }
  dispose() {
    if (this.geo) this.geo.dispose();
    this.trackMat.dispose(); this.rodMat.dispose(); this.haloMat.dispose();
    this.hard.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material !== this.trackMat && o.material !== this.rodMat && o.material !== this.haloMat) o.material.dispose?.(); });
    super.dispose();
  }
}
void clothMaterial; void GAP; void STACK_YAW; void stripOf;
