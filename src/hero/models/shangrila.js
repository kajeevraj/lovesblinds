// Shangri-La Shades (horizontal only): soft fabric vanes floating between two sheer layers.
// Raised, the vanes stack tight under the headrail; lowered, they spread out down the window.
import { BoxGeometry, Color, DoubleSide, InstancedMesh, Matrix4, MeshStandardMaterial } from 'three';
import { BlindModel, Sheet, hardware, lerp, ribbonGeometry } from './common.js';

const PITCH = 0.082;          // gap between vanes when fully lowered
const FRONT = 0.05, BACK = -0.012;

export class ShangriLaShade extends BlindModel {
  build() {
    const hw = this.own(hardware('#f2eee7'));
    const head = this.own(new BoxGeometry(this.w, 0.07, 0.085));
    this.mesh(head, hw).position.set(0, -0.035, 0.02);

    this.count = Math.max(4, Math.round((this.h - 0.1) / PITCH));
    // one vane: an S-shaped band of cloth from the front sheer (top edge) to the back sheer (bottom edge)
    const profile = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, s = t * t * (3 - 2 * t);
      profile.push([lerp(FRONT, BACK, s), -t * 0.05]);
    }
    const vane = this.own(ribbonGeometry(profile, this.w - 0.012, this.tile));
    this.vanes = new InstancedMesh(vane, this.fabric, this.count);
    this.vanes.castShadow = true; this.vanes.receiveShadow = true;
    this.vanes.frustumCulled = false;
    this.add(this.vanes);

    const sheerMat = this.own(new MeshStandardMaterial({
      color: new Color('#ffffff'), transparent: true, opacity: 0.42, roughness: 1, side: DoubleSide, depthWrite: false,
    }));
    this.sheers = [FRONT + 0.004, BACK - 0.004].map((z) => {
      const s = new Sheet(2, [1, 1]); this.own(s.geometry);
      const m = this.mesh(s.geometry, sheerMat); m.castShadow = false; m.renderOrder = 2;
      return { s, z };
    });
    this.bottomRail = this.mesh(this.own(new BoxGeometry(this.w - 0.006, 0.022, 0.07)), hw);
    this.m4 = new Matrix4();
  }
  update() {
    if (!this.vanes) return;
    const pitch = lerp(0.011, (this.h - 0.1) / this.count, this.drop);
    const top = -0.07;
    for (let i = 0; i < this.count; i++) {
      this.m4.makeTranslation(0, top - i * pitch, 0);
      this.vanes.setMatrixAt(i, this.m4);
    }
    this.vanes.instanceMatrix.needsUpdate = true;
    const bottom = top - (this.count - 1) * pitch - 0.055;
    this.bottomRail.position.set(0, bottom - 0.011, (FRONT + BACK) / 2);
    this.sheers.forEach(({ s, z }) => s.set([{ y: top, z, v: 0 }, { y: bottom, z, v: 1 }], this.w - 0.006));
  }
}
