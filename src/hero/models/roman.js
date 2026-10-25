// Roman Shades: one piece of cloth that folds into soft, even pleats. Raised, the folds stack tight at the top; lowered,
// the cloth hangs nearly flat with a gentle puff in each panel.
import { BoxGeometry } from 'three';
import { BlindModel, Sheet, hardware, lerp } from './common.js';

const PANEL = 0.2;           // height of one panel of cloth between folds
const Z0 = 0.03;

export class RomanShade extends BlindModel {
  build() {
    const hw = this.own(hardware('#f2eee7'));
    this.mesh(this.own(new BoxGeometry(this.w + 0.02, 0.055, 0.075)), hw).position.set(0, -0.0275, 0.03);
    this.panels = Math.max(3, Math.round((this.h - 0.06) / PANEL));
    this.panel = (this.h - 0.06) / this.panels;
    this.sheet = new Sheet(this.panels * 2 + 2, this.tile);
    this.own(this.sheet.geometry);
    this.mesh(this.sheet.geometry);
    this.hem = this.mesh(this.own(new BoxGeometry(this.w - 0.004, 0.026, 0.026)), hw);
  }
  update() {
    if (!this.sheet) return;
    const s = this.panel;
    // fold angle: steep when raised, almost flat when lowered
    const theta = lerp(1.36, 0.0, this.drop * this.drop * (3 - 2 * this.drop));
    const pitch = s * Math.cos(theta), reach = s * Math.sin(theta);
    const puff = 0.012 + 0.03 * Math.sin(theta);
    const rows = [];
    const top = -0.055;
    for (let i = 0; i <= this.panels; i++) {
      const y = top - i * pitch, z = Z0 + (i % 2 ? reach : 0) + (i % 2 ? 0.012 : 0);
      if (i > 0) {                      // the middle of the panel before this fold, puffed forward
        const prev = rows[rows.length - 1];
        rows.push({ y: (prev.y + y) / 2, z: (prev.z + z) / 2 + puff, v: (prev.v + (i * s) / this.tile[1]) / 2, shade: 1 });
      }
      rows.push({ y, z, v: (i * s) / this.tile[1], shade: i === 0 ? 0.85 : i % 2 ? 0.93 : 1 });
    }
    this.sheet.set(rows, this.w);
    const last = rows[rows.length - 1];
    this.hem.position.set(0, last.y - 0.012, last.z + 0.004);
  }
}
