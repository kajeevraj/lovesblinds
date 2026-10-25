// Roller Shades, and Zebra Shades (the same shade with a boxier headrail and a striped fabric).
import { BoxGeometry, CylinderGeometry } from 'three';
import { BlindModel, Sheet, hardware, lerp } from './common.js';

const ROLL_R = 0.042;       // radius of the roll tube
const FRONT_Z = 0.05;       // the cloth hangs from the front of the roll

export class RollerShade extends BlindModel {
  headrail() {
    const g = this.own(new CylinderGeometry(ROLL_R, ROLL_R, this.w, 28));
    g.rotateZ(Math.PI / 2);
    const m = this.mesh(g, this.hardwareMat);
    m.position.set(0, -ROLL_R, 0.0);
    return m;
  }
  build() {
    this.hardwareMat = this.own(hardware('#f2eee7'));
    this.headrail();
    this.sheet = new Sheet(4, this.tile);
    this.own(this.sheet.geometry);
    this.clothMesh = this.mesh(this.sheet.geometry);
    const bar = this.own(new BoxGeometry(this.w - 0.006, 0.024, 0.022));
    this.bar = this.mesh(bar, this.hardwareMat);
  }
  update() {
    if (!this.sheet) return;
    const top = -ROLL_R, run = Math.max(0.02, lerp(0.02, this.h - 0.07, this.drop));
    const bottom = top - run;
    const v = (d) => (d) / this.tile[1];
    const soft = Math.min(0.14, run * 0.5);
    this.sheet.set([
      { y: top, z: FRONT_Z, v: 0, shade: 0.74 },
      { y: top - soft, z: FRONT_Z, v: v(soft), shade: 1 },
      { y: bottom, z: FRONT_Z, v: v(run), shade: 1 },
    ], this.w);
    this.bar.position.set(0, bottom - 0.012, FRONT_Z + 0.004);
  }
}

export class ZebraShade extends RollerShade {
  headrail() {
    const g = this.own(new BoxGeometry(this.w, 0.085, 0.085));
    const m = this.mesh(g, this.hardwareMat);
    m.position.set(0, -0.0425, 0.02);
    return m;
  }
}
