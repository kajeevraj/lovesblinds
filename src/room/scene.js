// The three.js side of /room-lab: one transparent canvas laid over the room photo.
//
// The camera is matched to the photo (data.js): a pinhole camera 5.9 m from the back wall whose picture is the 2000 x 1333 photo, so a
// point on the wall at photo pixel (u, v) is drawn exactly there. Inside-mount shades are sized so their outline lands on the measured
// window openings (the size is corrected for how far they sit behind the wall). A cutout of the furniture is laid over this canvas by the
// page, so shades and curtains pass behind the sofa, lamp and plant.
//
// The canvas can show any rectangle of the photo (`view`), which is how the phone layout crops in and zooms to one window.
// Rendering happens only when something changed (a drag, an eased move, a texture arriving) and only while the canvas is on screen.
import * as THREE from 'three';
import { CAM, ROOM, WINDOWS, FAR_WINDOW, PRODUCT_BY_ID, fabricOf, project, wallX, wallY } from './data.js';
import { createModel } from './models/index.js';

const SHADE_Z = -0.045;          // the fabric plane of an inside-mount shade, behind the wall plane (m)
const CURTAIN_Z = 0.1;           // a curtain track stands this far from the wall
const GLASS = {                  // the glass in each window, for the places that must stay bright when the room dims
  left: [439, 188.5, 702, 804], middle: [831, 188.5, 1108, 804], right: [1233.5, 188.5, 1494, 804],
};
const CURTAIN_OVERHANG = 0.23;   // the track is wider than the window by this much each side (m)

export function createRoomScene(canvas, { onVisualChange } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default' });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const env = {
    invalidate: () => invalidate(),
    maxAniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    backlight: new THREE.Color(1, 1, 1),
    glowTop: { value: new THREE.Vector3(1.0, 1.0, 1.04) },       // the sky is brightest at the top of the window ...
    glowBottom: { value: new THREE.Vector3(0.72, 0.8, 0.62) },   // ... and the trees below it are darker and greener
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1.5, 0.1, 30);
  camera.position.set(0, 0, CAM.dist);
  const hemi = new THREE.HemisphereLight(0xfff4e6, 0xb9a687, 1.5);
  const sun = new THREE.DirectionalLight(0xffeedd, 1.5);
  sun.position.set(-2.6, 2.4, 4.4);
  scene.add(hemi, sun);

  // ---- the room dims when blackout comes down: a dark veil over the photo, with holes where the glass is ------------------------
  const dimScene = new THREE.Scene();
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const edges = Array.from({ length: 16 }, () => new THREE.Vector3());
  const dimMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uView: { value: new THREE.Vector4(0, 0, 2000, 1333) }, uDim: { value: 0 }, uEdges: { value: edges } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec4 uView; uniform float uDim; uniform vec3 uEdges[16];
      void main(){
        vec2 p = vec2(uView.x + vUv.x * uView.z, uView.y + (1.0 - vUv.y) * uView.w);
        float inside = 0.0;
        for (int k = 0; k < 4; k++) {
          float d = 1.0e5;
          for (int e = 0; e < 4; e++) { vec3 L = uEdges[k * 4 + e]; d = min(d, L.x * p.x + L.y * p.y + L.z); }
          inside = max(inside, smoothstep(-1.0, 1.5, d));
        }
        gl_FragColor = vec4(0.05, 0.034, 0.02, uDim * (1.0 - inside));
      }`,
  });
  dimScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dimMat));
  dimScene.children[0].frustumCulled = false;

  const farCorners = (inset = 0.03) => {
    const f = FAR_WINDOW, x = f.x;
    return [[x, f.top - inset, f.z0 + inset], [x, f.top - inset, f.z0 + f.width - inset], [x, f.bottom + inset, f.z0 + f.width - inset], [x, f.bottom + inset, f.z0 + inset]]
      .map(([px, py, pz]) => project(px, py, pz).map((v) => v));
  };
  const polys = [GLASS.left, GLASS.middle, GLASS.right].map(([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  // the far window: x of a point on the side wall depends on its z, so project the 3D corners (the part past the picture edge is simply off screen)
  polys.push(farCorners().map(([u, v]) => [u, v]));
  polys.forEach((poly, k) => {
    const cx = poly.reduce((s, p) => s + p[0], 0) / 4, cy = poly.reduce((s, p) => s + p[1], 0) / 4;
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % 4];
      let nx = b[1] - a[1], ny = -(b[0] - a[0]);
      const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      if (nx * (cx - a[0]) + ny * (cy - a[1]) < 0) { nx = -nx; ny = -ny; }
      edges[k * 4 + i].set(nx, ny, -(nx * a[0] + ny * a[1]));
    });
  });

  // ---- slots: three windows on the back wall and the far one on the right wall -----------------------------------------------------
  const slots = {};
  for (const id of ['left', 'middle', 'right', 'far']) slots[id] = { id, product: 'none', fabric: null, target: 0.5, current: 0.5, model: null, kind: null };

  const place = (slot) => {
    const m = slot.model; if (!m) return;
    if (slot.id === 'far') {
      const f = FAR_WINDOW, zc = f.z0 + f.width / 2;
      m.group.rotation.set(0, -Math.PI / 2, 0);                     // local x runs along the wall (towards the camera), local z points into the room (-x)
      if (slot.kind === 'curtains') {
        m.wallDist = CURTAIN_Z;
        m.setSize(f.width + 2 * CURTAIN_OVERHANG, ROOM.ceilY - 0.022 - (ROOM.floorY + 0.012));
        m.group.position.set(f.x - CURTAIN_Z, ROOM.ceilY - 0.022, zc);
      } else {
        m.setSize(f.width, f.top - f.bottom);
        m.group.position.set(f.x + 0.045, f.top, zc);
      }
      return;
    }
    const [x0, y0, x1, y1] = WINDOWS[slot.id].rect;
    const cx = wallX((x0 + x1) / 2);
    if (slot.kind === 'curtains') {
      m.wallDist = CURTAIN_Z;
      m.setSize((x1 - x0) / CAM.scale + 2 * CURTAIN_OVERHANG, ROOM.ceilY - 0.022 - (ROOM.floorY + 0.012));
      m.group.position.set(cx, ROOM.ceilY - 0.022, CURTAIN_Z);
    } else {
      const k = (CAM.dist - SHADE_Z) / CAM.dist;                       // an object behind the wall plane must be larger to cover the same pixels
      m.setSize(((x1 - x0) / CAM.scale) * k, ((y1 - y0) / CAM.scale) * k);
      m.group.position.set(cx * k, wallY(y0) * k, SHADE_Z);
    }
  };

  function setSlot(id, { product, fabricKey, amount }) {
    const slot = slots[id], p = PRODUCT_BY_ID[product];
    const kind = p?.kind || null;
    if (kind !== slot.kind) {
      slot.model?.dispose();
      slot.model = null; slot.kind = kind;
      if (kind) { slot.model = createModel(kind, env); scene.add(slot.model.group); }
      slot.fabricKey = null;
    }
    slot.product = product;
    if (typeof amount === 'number') slot.target = amount;
    if (slot.model) {
      if (slot.fabricKey !== fabricKey || slot.productKey !== product) {
        slot.fabricKey = fabricKey; slot.productKey = product;
        slot.model.setFabric(fabricOf(fabricKey), p.optics);
      }
      place(slot);
      slot.model.setAmount(slot.current);
    }
    wake();
  }
  // move straight to an amount (a drag follows the finger, no easing)
  function snapAmount(id, a) { const s = slots[id]; s.target = s.current = a; s.model?.setAmount(a); recomputeDim(true); wake(); }

  // ---- room light ------------------------------------------------------------------------------------------------------------------
  let dimTarget = 0, dimCurrent = 0;
  const WEIGHT = { left: 1, middle: 1, right: 1, far: 0.35 };
  function recomputeDim(instant = false) {
    let sum = 0, tot = 0;
    for (const s of Object.values(slots)) { tot += WEIGHT[s.id]; sum += WEIGHT[s.id] * (s.model ? s.model.block : 0); }
    dimTarget = tot ? sum / tot : 0;
    if (instant) dimCurrent = dimTarget;
  }
  const applyLight = () => {
    const room = 1 - 0.55 * dimCurrent;                              // 1 = the photo as it is, 0.45 = every window blacked out
    dimMat.uniforms.uDim.value = 1 - room;
    hemi.intensity = 1.5 * room; sun.intensity = 1.5 * room;
    onVisualChange?.({ brightness: room });
  };

  // ---- camera ----------------------------------------------------------------------------------------------------------------------
  let view = { x: 0, y: 0, w: 2000, h: 1333 }, viewGoal = null, size = { w: 2, h: 2 };
  function projection() {
    const { x, y, w, h } = view, near = 0.1, far = 30, f = CAM.focal;
    camera.projectionMatrix.set(
      (2 * f) / w, 0, 1 - (2 * (CAM.cx - x)) / w, 0,
      0, (2 * f) / h, (2 * (CAM.cy - y)) / h - 1, 0,
      0, 0, -(far + near) / (far - near), (-2 * far * near) / (far - near),
      0, 0, -1, 0,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    dimMat.uniforms.uView.value.set(x, y, w, h);
  }
  function setView(v, animate = false) {
    if (animate) viewGoal = v; else { view = { ...v }; viewGoal = null; }
    wake();
  }
  function resize(w, h, dpr) {
    size = { w, h };
    const px = Math.min(dpr, 2, Math.sqrt(2.6e6 / Math.max(1, w * h)));       // keep the canvas under about 2.6 megapixels (phones)
    renderer.setPixelRatio(px);
    renderer.setSize(w, h, false);
    wake();
  }

  // ---- the loop: draws when something changed, sleeps otherwise ---------------------------------------------------------------------------
  let active = false, raf = 0, dirty = true, last = 0;
  const wake = () => { dirty = true; if (active && !raf) raf = requestAnimationFrame(frame); };
  function invalidate() { wake(); }
  function frame(t) {
    raf = 0;
    if (!active) return;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
    let moving = false;
    const k = 1 - Math.exp(-dt * 14);
    for (const s of Object.values(slots)) {
      if (!s.model) continue;
      if (Math.abs(s.target - s.current) > 0.0008) { s.current += (s.target - s.current) * k; s.model.setAmount(s.current); moving = true; dirty = true; }
      else if (s.current !== s.target) { s.current = s.target; s.model.setAmount(s.current); dirty = true; }
    }
    recomputeDim();
    if (Math.abs(dimTarget - dimCurrent) > 0.0008) { dimCurrent += (dimTarget - dimCurrent) * k; moving = true; dirty = true; } else if (dimCurrent !== dimTarget) { dimCurrent = dimTarget; dirty = true; }
    if (viewGoal) {
      const kv = 1 - Math.exp(-dt * 12), v = view, g = viewGoal;
      view = { x: v.x + (g.x - v.x) * kv, y: v.y + (g.y - v.y) * kv, w: v.w + (g.w - v.w) * kv, h: v.h + (g.h - v.h) * kv };
      if (Math.abs(g.x - view.x) + Math.abs(g.y - view.y) + Math.abs(g.w - view.w) < 0.6) { view = { ...g }; viewGoal = null; } else moving = true;
      onVisualChange?.({ view });
      dirty = true;
    }
    if (dirty) { dirty = false; draw(); onVisualChange?.({ amounts: Object.fromEntries(Object.values(slots).map((s) => [s.id, s.current])) }); }
    if (moving) raf = requestAnimationFrame(frame); else last = 0;
  }
  function draw() {
    for (const s of Object.values(slots)) s.model?.applyEnv();
    applyLight();
    projection();
    renderer.clear();
    renderer.render(dimScene, ortho);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }
  function setActive(on) { active = on; if (on) { last = 0; wake(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  const onLost = (e) => { e.preventDefault(); setActive(false); };
  const onRestored = () => { Object.values(slots).forEach((s) => { if (s.model) { s.model.setFabric(fabricOf(s.fabricKey), PRODUCT_BY_ID[s.product].optics); } }); wake(); };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    setSlot, snapAmount, setView, resize, setActive, invalidate,
    slot: (id) => slots[id], get view() { return view; },
    dispose() {
      setActive(false);
      canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      Object.values(slots).forEach((s) => s.model?.dispose());
      renderer.dispose();
    },
  };
}
