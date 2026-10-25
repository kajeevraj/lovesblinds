// Curtains and Dream Curtains: tall panels of cloth with vertical folds, hung from a rod or track.
// "Drop" here is how far the cloth has fallen from the rod: at 0 only the heading shows, at 1 it reaches the floor.
import {
  BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, SphereGeometry,
  TorusGeometry,
} from 'three';
import { BlindModel, hardware, lerp } from './common.js';

// A panel: `cols` columns across, 3 rows down (top, a point near the top for the heading shade, bottom). Smooth shaded.
class Panel {
  constructor(cols) {
    this.cols = cols;
    const n = (cols + 1) * 3;
    this.pos = new Float32Array(n * 3); this.uv = new Float32Array(n * 2);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    g.setAttribute('normal', new Float32BufferAttribute(new Float32Array(n * 3), 3));
    const idx = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
    g.setIndex(idx);
    this.geometry = g;
  }
  // x0..x1: where the panel sits; fabricW: width of cloth before gathering; wave(x) -> z; rows: top y, y of heading end, bottom y
  set({ x0, x1, fabricW, wave, yTop, yBottom, tile, bulge = 1 }) {
    const { cols, pos, uv } = this;
    const yMid = Math.min(yTop - 0.05, yTop - (yTop - yBottom) * 0.05);
    const ys = [yTop, yMid, yBottom];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c <= cols; c++) {
        const f = c / cols, i = r * (cols + 1) + c;
        const x = lerp(x0, x1, f);
        pos[i * 3] = x; pos[i * 3 + 1] = ys[r]; pos[i * 3 + 2] = wave(f, r === 2 ? bulge : lerp(0.7, bulge, r / 2));
        uv[i * 2] = (f * fabricW) / tile[0]; uv[i * 2 + 1] = 1 - (yTop - ys[r]) / tile[1];
      }
    }
    const g = this.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true;
    g.computeVertexNormals(); g.computeBoundingSphere();
  }
}

export class Curtains extends BlindModel {
  // a rod across the top, two panels that meet in the middle
  build() {
    const hw = this.own(hardware('#d8cdb8'));
    const w = this.w;
    const rod = this.own(new CylinderGeometry(0.016, 0.016, w + 0.3, 16)); rod.rotateZ(Math.PI / 2);
    this.mesh(rod, hw).position.set(0, 0.05, 0.0);
    [-1, 1].forEach((s) => {
      this.mesh(this.own(new SphereGeometry(0.034, 18, 12)), hw).position.set(s * (w / 2 + 0.17), 0.05, 0);
      this.mesh(this.own(new BoxGeometry(0.02, 0.02, 0.1)), hw).position.set(s * (w / 2 - 0.05), 0.05, -0.05);
    });
    this.panels = [-1, 1].map(() => {
      const p = new Panel(64); this.own(p.geometry); this.mesh(p.geometry); return p;
    });
    this.rings = this.own(new InstancedMesh(this.own(new TorusGeometry(0.026, 0.004, 8, 18)), hw, 28));
    this.add(this.rings);
    this.m4 = new Matrix4();
    this.wave = (f, k) => 0;
  }
  update() {
    if (!this.panels) return;
    const w = this.w, half = w / 2, len = lerp(0.06, this.h, this.drop), yTop = 0.0;
    const pleat = 0.115, amp = 0.036;                       // distance between pleats, and how far each stands out
    this.panels.forEach((p, i) => {
      const side = i ? 1 : -1;
      const x0 = side < 0 ? -half - 0.12 : 0.01, x1 = side < 0 ? -0.01 : half + 0.12;
      const span = Math.abs(x1 - x0);
      p.set({
        x0, x1, fabricW: span * 2.1, yTop, yBottom: yTop - len, tile: this.tile,
        wave: (f, k) => amp * k * Math.cos((f * span * Math.PI * 2) / pleat) * (0.92 + 0.08 * Math.cos(f * 13)),
        bulge: 1.15,
      });
    });
    let n = 0;
    for (let i = 0; i < 28; i++) {
      const x = lerp(-half - 0.1, half + 0.1, i / 27);
      this.m4.makeRotationX(0).setPosition(x, 0.05, 0);
      this.rings.setMatrixAt(n++, this.m4);
    }
    this.rings.instanceMatrix.needsUpdate = true;
  }
}

export class DreamCurtains extends BlindModel {
  // one wide sheet of soft-edged vertical folds hung from a ceiling track
  build() {
    const hw = this.own(hardware('#f2eee7'));
    this.mesh(this.own(new BoxGeometry(this.w + 0.24, 0.04, 0.05)), hw).position.set(0, 0.04, 0.0);
    this.panel = new Panel(120);
    this.own(this.panel.geometry);
    this.mesh(this.panel.geometry);
    this.hem = this.mesh(this.own(new BoxGeometry(this.w + 0.2, 0.012, 0.03)), hw);
  }
  update() {
    if (!this.panel) return;
    const half = this.w / 2 + 0.12, len = lerp(0.05, this.h, this.drop);
    const vane = 0.105;                                      // width of one hanging vane
    this.panel.set({
      x0: -half, x1: half, fabricW: half * 2 * 1.35, yTop: 0, yBottom: -len, tile: this.tile,
      // a rounded triangle wave: flat-ish faces with soft edges, like the vanes of the real curtain
      wave: (f, k) => {
        const t = (f * half * 2) / vane, ph = t - Math.floor(t);
        const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
        const soft = tri * tri * (3 - 2 * tri);
        return 0.045 * k * (soft - 0.5);
      },
      bulge: 1,
    });
    this.hem.position.set(0, -len - 0.004, 0);
  }
}
