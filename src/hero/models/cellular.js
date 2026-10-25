// Cellular (honeycomb) Shades: a stack of small closed cells. Raised, the cells squash flat under the headrail; lowered,
// each cell opens to its full depth. Both faces of every cell and the cell ends (seen from the side) are drawn.
import { BoxGeometry, BufferAttribute, BufferGeometry, Float32BufferAttribute } from 'three';
import { BlindModel, hardware, lerp } from './common.js';

const CELL = 0.036;           // height of one cell when lowered
const DEPTH = 0.015;          // how far a cell bulges front and back
const Z = 0.026;              // centre line of the cells

export class CellularShade extends BlindModel {
  build() {
    const hw = this.own(hardware('#f4f0e9'));
    this.mesh(this.own(new BoxGeometry(this.w, 0.05, 0.07)), hw).position.set(0, -0.025, Z);
    this.cells = Math.max(6, Math.round((this.h - 0.1) / CELL));
    const verts = this.cells * 12 * 3;           // front 4 + back 4 + two end caps 2 each = 12 triangles per cell
    this.pos = new Float32Array(verts * 3);
    this.uv = new Float32Array(verts * 2);
    this.col = new Float32Array(verts * 3);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new BufferAttribute(this.uv, 2));
    g.setAttribute('color', new BufferAttribute(this.col, 3));
    g.setAttribute('normal', new Float32BufferAttribute(new Float32Array(verts * 3), 3));
    g.frustumCulled = false;
    this.geo = g;
    const m = this.mesh(g);
    m.frustumCulled = false;
    this.bottomRail = this.mesh(this.own(new BoxGeometry(this.w - 0.004, 0.02, 0.05)), hw);
  }
  update() {
    if (!this.geo) return;
    const { pos, uv, col, w } = this;
    const pitch = lerp(0.0065, (this.h - 0.1) / this.cells, this.drop);
    const depth = lerp(0.009, DEPTH, Math.min(1, this.drop * 3));
    const x0 = -w / 2, x1 = w / 2, uMax = w / this.tile[0];
    let k = 0;
    const vtx = (x, y, z, u, v, s) => {
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      uv[k * 2] = u; uv[k * 2 + 1] = v;
      col[k * 3] = s; col[k * 3 + 1] = s; col[k * 3 + 2] = s;
      k++;
    };
    const quad = (a, b, c, d, s) => {   // a,b = left/right of the top edge, c,d = left/right of the bottom edge, each [x,y,z]
      vtx(...a, 0, 1, s); vtx(...d, uMax, 0, s); vtx(...b, uMax, 1, s);
      vtx(...a, 0, 1, s); vtx(...c, 0, 0, s); vtx(...d, uMax, 0, s);
    };
    const tri = (a, b, c, s) => { vtx(...a, 0, 0, s); vtx(...b, 0, 0, s); vtx(...c, 0, 0, s); };
    const top0 = -0.05;
    for (let i = 0; i < this.cells; i++) {
      const yT = top0 - i * pitch, yM = yT - pitch / 2, yB = yT - pitch;
      const zf = Z + depth, zb = Z - depth;
      // front: upper half faces up-and-out (lit), lower half faces down-and-out (shaded)
      quad([x0, yT, Z], [x1, yT, Z], [x0, yM, zf], [x1, yM, zf], 1);
      quad([x0, yM, zf], [x1, yM, zf], [x0, yB, Z], [x1, yB, Z], 0.82);
      // back (seen only from the side and through light cloth)
      quad([x1, yT, Z], [x0, yT, Z], [x1, yM, zb], [x0, yM, zb], 0.9);
      quad([x1, yM, zb], [x0, yM, zb], [x1, yB, Z], [x0, yB, Z], 0.75);
      // the two ends of the cell (a small diamond each)
      tri([x0, yT, Z], [x0, yM, zf], [x0, yB, Z], 0.9); tri([x0, yT, Z], [x0, yB, Z], [x0, yM, zb], 0.9);
      tri([x1, yT, Z], [x1, yB, Z], [x1, yM, zf], 0.9); tri([x1, yT, Z], [x1, yM, zb], [x1, yB, Z], 0.9);
    }
    this.geo.setDrawRange(0, k);
    ['position', 'uv', 'color'].forEach((n) => { this.geo.attributes[n].needsUpdate = true; });
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.bottomRail.position.set(0, top0 - this.cells * pitch - 0.01, Z);
  }
}
