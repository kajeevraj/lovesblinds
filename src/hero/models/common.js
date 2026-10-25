// Shared pieces for the window-treatment models (src/hero/models/*).
//
// Every model follows the same contract, so the same file can drive a live preview on a product page later:
//
//   const blind = new RollerShade({ width, height, drop, color, texture, tile, onChange })
//   scene.add(blind.group)          // origin = top centre of the treatment, hangs down -Y, front faces +Z, units = metres
//   blind.setDrop(0.5)              // 0 = fully raised, 1 = fully down
//   blind.setSize(width, height)    // metres; `height` is the full drop length
//   blind.setFabric({ color, texture, tile })   // texture = URL or THREE.Texture, tile = [w, h] metres one copy covers
//   blind.dispose()
//
// `onChange` is called whenever the picture needs drawing again (a texture finished loading, the drop changed), so a
// render-on-demand loop can stay idle the rest of the time.
import {
  BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Group, Mesh, MeshStandardMaterial,
  MirroredRepeatWrapping, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader, Float32BufferAttribute,
} from 'three';

const loader = new TextureLoader();
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// A fabric texture from a URL (or a texture you already have). Repeating, sRGB, with mipmaps.
export function fabricTexture(source, onLoad, mirror = false) {
  if (!source) return null;
  let t;
  if (source instanceof Texture) { t = source.clone(); t.needsUpdate = true; }
  else t = loader.load(source, () => onLoad?.());
  t.wrapS = t.wrapT = mirror ? MirroredRepeatWrapping : RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Hardware (rails, rods, brackets): painted white, slightly satin.
export const hardware = (color = '#f3efe8') => new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 });

export class BlindModel {
  constructor(options = {}) {
    this.opts = { width: 1.3, height: 1.5, drop: 1, color: '#cfc7bb', texture: null, tile: [0.4, 0.4], ...options };
    this.onChange = options.onChange || null;
    this.group = new Group();
    this.parts = new Group();            // everything build() makes, so a resize can throw it away in one go
    this.group.add(this.parts);
    this.disposables = [];
    this.drop = clamp01(this.opts.drop);
    this.map = null;
    this.fabric = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.94, metalness: 0, vertexColors: true });
    this.disposables.push(this.fabric);
    this.applyFabric();
    this.rebuild();
  }

  // ---- public API ----------------------------------------------------------------------------------------------
  setDrop(t) { this.drop = clamp01(t); this.update(); this.onChange?.(); }
  setSize(width, height) { this.opts.width = width; this.opts.height = height; this.rebuild(); this.onChange?.(); }
  setFabric({ color, texture, tile } = {}) {
    if (color !== undefined) this.opts.color = color;
    if (texture !== undefined) this.opts.texture = texture;
    if (tile !== undefined) this.opts.tile = tile;
    this.applyFabric();
    this.rebuild();
    this.onChange?.();
  }
  dispose() {
    this.clearParts();
    this.disposables.forEach((d) => d.dispose?.());
    this.map?.dispose();
  }

  // ---- for the subclasses --------------------------------------------------------------------------------------
  get w() { return this.opts.width; }
  get h() { return this.opts.height; }
  get tile() { return this.opts.tile; }
  build() {}                               // create the meshes for the current size and fabric (add them with this.add)
  update() {}                              // move things for the current this.drop

  add(obj) { this.parts.add(obj); return obj; }
  own(resource) { this.owned.push(resource); return resource; }
  clearParts() {
    this.parts.children.slice().forEach((c) => this.parts.remove(c));
    (this.owned || []).forEach((d) => d.dispose?.());
    this.owned = [];
  }
  rebuild() { this.clearParts(); this.build(); this.update(); }

  applyFabric() {
    const { color, texture } = this.opts;
    this.map?.dispose();
    this.map = fabricTexture(texture, () => this.onChange?.(), this.opts.mirror === true);
    this.fabric.map = this.map;
    this.fabric.color = new Color(this.map ? '#ffffff' : color);
    this.fabric.needsUpdate = true;
    // a hint of light coming through the cloth (windows sit behind every treatment)
    this.fabric.emissive = new Color(color).multiplyScalar(0.12);
    this.fabric.emissiveMap = this.map;
  }
  mesh(geometry, material = this.fabric) {
    this.own(geometry);
    const m = new Mesh(geometry, material);
    m.castShadow = true; m.receiveShadow = true;
    return this.add(m);
  }
}

// A strip of cloth across the full width, made of rows (each row is a horizontal line). Flat-shaded (a vertex per quad corner),
// so fold lines stay crisp. rows: [{ y, z, v, shade }] where v is the texture height in tile units and shade darkens a row.
export class Sheet {
  constructor(maxRows, tile) {
    this.maxRows = maxRows; this.tile = tile;
    const n = (maxRows - 1) * 6;
    this.geometry = new BufferGeometry();
    this.pos = new Float32Array(n * 3); this.uv = new Float32Array(n * 2); this.col = new Float32Array(n * 3);
    this.geometry.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('uv', new BufferAttribute(this.uv, 2));
    this.geometry.setAttribute('color', new BufferAttribute(this.col, 3));
    this.geometry.setAttribute('normal', new Float32BufferAttribute(new Float32Array(n * 3), 3));
  }
  set(rows, w) {
    const { pos, uv, col, tile } = this;
    const x0 = -w / 2, x1 = w / 2, u0 = 0, u1 = w / tile[0];
    let k = 0;
    const put = (x, r, u) => {
      pos[k * 3] = x; pos[k * 3 + 1] = r.y; pos[k * 3 + 2] = r.z;
      uv[k * 2] = u; uv[k * 2 + 1] = 1 - r.v;
      const s = r.shade ?? 1; col[k * 3] = s; col[k * 3 + 1] = s; col[k * 3 + 2] = s;
      k++;
    };
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      put(x0, a, u0); put(x1, a, u1); put(x0, b, u0);
      put(x1, a, u1); put(x1, b, u1); put(x0, b, u0);
    }
    const g = this.geometry;
    g.setDrawRange(0, k);
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.color.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  }
}

// A ribbon: a profile (list of [z, y] points) extruded across the width, smooth-shaded. UV in tile units.
export function ribbonGeometry(profile, w, tile, segmentsX = 1) {
  const cols = segmentsX + 1;
  const pos = [], uv = [], idx = [];
  let run = 0;
  profile.forEach(([z, y], i) => {
    if (i) run += Math.hypot(z - profile[i - 1][0], y - profile[i - 1][1]);
    for (let c = 0; c < cols; c++) {
      const f = c / segmentsX;
      pos.push((f - 0.5) * w, y, z);
      uv.push((f * w) / tile[0], 1 - run / tile[1]);
    }
  });
  for (let i = 0; i < profile.length - 1; i++) {
    for (let c = 0; c < segmentsX; c++) {
      const a = i * cols + c, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const white = new Float32Array(pos.length).fill(1);
  g.setAttribute('color', new Float32BufferAttribute(white, 3));
  return g;
}

// A soft vertical gradient (or any list of stops) as a texture. Used for the sky behind the glass and light on the floor.
export function gradientTexture(stops, w = 4, h = 256, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach(([p, col]) => g.addColorStop(p, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  draw?.(ctx, w, h);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}
