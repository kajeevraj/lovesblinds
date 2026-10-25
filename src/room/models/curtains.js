// Curtains on a ceiling track, two panels that meet in the middle. Reusable on its own:
//
//   const c = createCurtains(env);
//   c.setSize(trackWidthMetres, hangHeightMetres);   // the track is wider than the window; the cloth hangs from the track down to the floor
//   c.setFabric(fabric, optics);
//   c.setAmount(0..1);                               // 0 open (bunched at the ends), 1 closed (drawn across)
//   scene.add(c.group);                              // origin = centre of the track's underside; +z towards the room
//
// No cloth physics: each panel is a strip of cloth folded into soft waves. The waves are sine folds whose depth is worked out from the
// length of cloth in each fold, so they get deeper and closer together as the panel gathers (a short distance with the same amount of cloth).
import * as THREE from 'three';
import { weaveTexture, fabricMaterial, applyGlow, shadowMesh, blobTexture, whenImage, clamp, lerp } from './common.js';

const FULLNESS = 1.35;      // metres of cloth per metre of track when closed
const FOLD = 0.19;          // metres of cloth per fold when closed
const MIN_WAVE = 0.03;      // distance between folds when fully bunched
const SEG_X = 8, SEG_Y = 26;
const OVERLAP = 0.03;       // the panels overlap a little in the middle

export function createCurtains(env) { return new Curtains(env); }

class Curtains {
  constructor(env) {
    this.env = env;
    this.group = new THREE.Group();
    this.width = 1.2; this.height = 2.5; this.amount = 1;
    this.wallDist = 0.1;
    this.fabric = null; this.optics = null; this.mat = null; this.tex = null;
    this.panels = [];
    this.track = new THREE.Mesh(new THREE.BoxGeometry(1, 0.022, 0.032), new THREE.MeshStandardMaterial({ color: 0xe8e5de, roughness: 0.55 }));
    this.group.add(this.track);
    this._build();
  }

  get folds() { return Math.max(4, Math.round((FULLNESS * this._closedExtent) / FOLD)); }
  get _closedExtent() { return this.width / 2 + OVERLAP; }
  _wave(c) {                                      // distance between folds and fold depth for a closed amount c
    const N = this.folds, lc = this._closedExtent / N, arc = (FULLNESS * this._closedExtent) / N;
    const lam = lerp(MIN_WAVE, lc, c);
    return { N, lam, amp: 0.5 * Math.sqrt(Math.max(0, (arc / 2) ** 2 - (lam / 2) ** 2)), arc };
  }
  // x of the left panel's leading edge (where the handle goes) and its inverse, for dragging
  leadX(c) { const { N, lam } = this._wave(c); return -this.width / 2 + N * lam; }
  amountFromLead(x) { const N = this.folds, lc = this._closedExtent / N; return clamp((((x + this.width / 2) / N) - MIN_WAVE) / (lc - MIN_WAVE)); }
  get coverage() { return this.amount; }
  get block() { return (this.optics?.block ?? 0) * this.amount; }
  get handle() { return 0.55; }

  _build() {
    this.panels.forEach((p) => { this.group.remove(p.mesh, p.shadow); p.mesh.geometry.dispose(); });
    this.panels = [-1, 1].map((side) => {
      const nx = this.folds * SEG_X + 1, ny = SEG_Y + 1;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nx * ny * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nx * ny * 2), 2));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nx * ny * 3), 3));
      const idx = [];
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
      g.setIndex(idx);
      const mesh = new THREE.Mesh(g, this.mat || undefined);
      mesh.renderOrder = 3;
      const shadow = shadowMesh(blobTexture(), 0.34);
      this.group.add(mesh, shadow);
      return { side, mesh, shadow, nx, ny };
    });
    this._layout();
  }

  setSize(w, h) {
    const prevN = this.folds;
    this.width = w; this.height = h;
    this.track.scale.x = w + 0.02; this.track.position.y = 0.011;
    if (this.mat) this.mat.userData.uHeight.value = h;
    if (this.folds !== prevN || !this.panels.length) this._build(); else this._layout();
  }
  setAmount(c) { this.amount = clamp(c); this._layout(); }

  _layout() {
    if (!this.panels.length) return;
    const { N, lam, amp, arc } = this._wave(this.amount);
    const e = N * lam, H = this.height;
    for (const p of this.panels) {
      const pos = p.mesh.geometry.attributes.position, uv = p.mesh.geometry.attributes.uv, col = p.mesh.geometry.attributes.color;
      const side = p.side;
      for (let j = 0; j < p.ny; j++) {
        const t = j / (p.ny - 1), y = -t * H;
        const heading = 0.5 + 0.5 * clamp(-y / 0.09);                       // the top is gathered tighter than the rest
        const phase = 0.32 * Math.sin(t * 5.2 + side * 1.3) + 0.12 * Math.sin(t * 13.0);
        const a = amp * heading * (1 - 0.1 * t);
        for (let i = 0; i < p.nx; i++) {
          const s = i / (p.nx - 1);
          const x = side * (this.width / 2) - side * s * e;                  // from the outer end inwards
          const th = 2 * Math.PI * N * s + phase;
          const w = (Math.sin(th) + 0.26 * Math.sin(2.3 * th + 1.1)) / 1.2 * (1 + 0.18 * Math.sin(5.7 * N * s + 2 * t));   // folds are not all alike
          const k = j * p.nx + i;
          pos.setXYZ(k, x, y, a * w);
          uv.setXY(k, s * arc * N, y);
          const ao = 0.76 + 0.24 * (0.5 + 0.5 * w);                           // folds are darker in the valleys
          col.setXYZ(k, ao, ao, ao);
        }
      }
      pos.needsUpdate = true; uv.needsUpdate = true; col.needsUpdate = true;
      p.mesh.geometry.computeVertexNormals();
      p.mesh.geometry.computeBoundingSphere();
      // shadow on the wall behind this panel: a little to the right and lower (the sun is on the left of the room)
      const cx = side * (this.width / 2) - side * e / 2;
      p.shadow.scale.set(e + 0.18, H + 0.06, 1);
      p.shadow.position.set(cx + 0.05, -H / 2 - 0.02, -this.wallDist + 0.004);
    }
  }

  setFabric(fabric, optics) {
    this.fabric = fabric; this.optics = optics;
    this.mat?.dispose(); this.tex?.dispose();
    this.tex = weaveTexture(fabric.url, fabric.tile, this.env);
    this.mat = fabricMaterial({ map: this.tex, glow: optics.glow ?? 0.2, bump: 1.4, vertexColors: true, side: THREE.DoubleSide }, this.env);
    this.mat.color.set(fabric.color);
    const m = this.mat;
    whenImage(fabric.url, () => { m.color.set(0xffffff); m.needsUpdate = true; });
    this.mat.userData.uHeight.value = this.height;
    this.panels.forEach((p) => { p.mesh.material = this.mat; });
    this.applyEnv();
    this.env.invalidate();
  }
  applyEnv() { if (this.mat) applyGlow(this.mat, this.env); }

  dispose() {
    this.mat?.dispose(); this.tex?.dispose();
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o !== this.panels[0]?.mesh && o.material.dispose && o.material !== this.mat) o.material.dispose(); });
    this.group.removeFromParent();
  }
}
