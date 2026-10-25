// The 3D room: one long cream wall with a row of identical windows, a floor and a ceiling, soft light, and the camera.
// Everything is driven by setState() (from timeline.js) and drawn on demand with render(), so the page can stop drawing when
// nothing moves or the hero is off screen.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, DirectionalLight, SpotLight, DoubleSide, ExtrudeGeometry, Group, HemisphereLight,
  MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, NeutralToneMapping, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  Scene, Shape, SRGBColorSpace, Path, Vector3, WebGLRenderer,
} from 'three';
import { MODELS } from './models/index.js';
import { ROOM, WINDOW } from './products.js';
import { gradientTexture, lerp } from './models/common.js';

const WALL_DEPTH = 0.24;
const FLOOR_DEPTH = 16;
const CREAM = '#eee6d6';
const TRIM = '#fbf8f2';

// The view from outside: a pale sky, soft clouds and a blur of garden, so a raised blind shows daylight, not a hole.
function skyTexture() {
  return gradientTexture([[0, '#c9def0'], [0.45, '#e6f0f5'], [0.78, '#fbf6ea'], [1, '#f6efe0']], 256, 512, (ctx, w, h) => {
    ctx.filter = 'blur(14px)';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    [[0.28, 0.28, 0.22, 0.07], [0.72, 0.38, 0.28, 0.08], [0.45, 0.14, 0.2, 0.05]].forEach(([x, y, rx, ry]) => { ctx.beginPath(); ctx.ellipse(x * w, y * h, rx * w, ry * h, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = 'rgba(150,172,138,0.65)';
    ctx.beginPath(); ctx.moveTo(0, h * 0.78);
    for (let i = 0; i <= 8; i++) ctx.lineTo((i / 8) * w, h * (0.74 + 0.04 * Math.sin(i * 1.9)));
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    ctx.fillStyle = 'rgba(120,150,112,0.55)';
    ctx.beginPath(); ctx.moveTo(0, h * 0.88);
    for (let i = 0; i <= 8; i++) ctx.lineTo((i / 8) * w, h * (0.85 + 0.03 * Math.cos(i * 2.3)));
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
  });
}

// A soft pool of warm light for the floor under each window
function lightPatchTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,240,208,0.32)'); g.addColorStop(1, 'rgba(255,236,196,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 256);
  const side = ctx.createLinearGradient(0, 0, 128, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.18, 'rgba(0,0,0,0)'); side.addColorStop(0.82, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = side; ctx.fillRect(0, 0, 128, 256);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}

export function createHeroScene({ canvas, products, onChange, antialias = true }) {
  const n = products.length;
  const xs = products.map((_, i) => i * ROOM.spacing);
  const xMin = -26, xMax = xs[n - 1] + 4.4;           // the wall runs on past the first window so the wide shot can look along it
  const renderer = new WebGLRenderer({ canvas, antialias, alpha: false, powerPreference: 'high-performance' });
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(new Color('#efe6d6'));

  const scene = new Scene();
  scene.background = new Color('#efe6d6');
  const camera = new PerspectiveCamera(40, 1, 0.1, 200);
  const disposables = [];
  const track = (d) => { disposables.push(d); return d; };

  // ---- light ----
  // a soft ambient fill, plus one warm spot that follows the camera: it lights the wall we are looking at and lets the
  // rest of the wall fall away, which is what gives the picture depth
  const ambient = new HemisphereLight('#ffffff', '#efe2cc', 0.85);
  scene.add(ambient);
  const sun = new SpotLight('#fff4de', 3.2, 0, 0.5, 1, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 6;
  scene.add(sun, sun.target);

  // ---- the wall, with a hole for every window ----
  const wall = new Shape();
  wall.moveTo(xMin, 0); wall.lineTo(xMax, 0); wall.lineTo(xMax, ROOM.height); wall.lineTo(xMin, ROOM.height); wall.lineTo(xMin, 0);
  xs.forEach((x) => {
    const hole = new Path();
    const x0 = x - WINDOW.width / 2, x1 = x + WINDOW.width / 2, y0 = WINDOW.sill, y1 = WINDOW.sill + WINDOW.height;
    hole.moveTo(x0, y0); hole.lineTo(x0, y1); hole.lineTo(x1, y1); hole.lineTo(x1, y0); hole.lineTo(x0, y0);
    wall.holes.push(hole);
  });
  const wallGeo = track(new ExtrudeGeometry(wall, { depth: WALL_DEPTH, bevelEnabled: false }));
  wallGeo.translate(0, 0, -WALL_DEPTH);
  const wallMat = track(new MeshStandardMaterial({ color: CREAM, roughness: 1 }));
  const wallMesh = new Mesh(wallGeo, wallMat);
  wallMesh.receiveShadow = true; wallMesh.castShadow = true;
  scene.add(wallMesh);

  // floor, ceiling, the two end walls
  const floorMat = track(new MeshStandardMaterial({ color: '#e7d9c0', roughness: 0.92 }));
  const floor = new Mesh(track(new PlaneGeometry(xMax - xMin, FLOOR_DEPTH)), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set((xMin + xMax) / 2, 0, FLOOR_DEPTH / 2 - WALL_DEPTH);
  scene.add(floor);
  const ceiling = new Mesh(track(new PlaneGeometry(xMax - xMin, FLOOR_DEPTH)), track(new MeshStandardMaterial({ color: '#f6efe3', emissive: '#f6efe3', emissiveIntensity: 0.55, roughness: 1 })));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set((xMin + xMax) / 2, ROOM.height, FLOOR_DEPTH / 2 - WALL_DEPTH);
  scene.add(ceiling);
  [xMin, xMax].forEach((x, i) => {
    const side = new Mesh(track(new PlaneGeometry(FLOOR_DEPTH, ROOM.height)), wallMat);
    side.rotation.y = i ? -Math.PI / 2 : Math.PI / 2; side.position.set(x, ROOM.height / 2, FLOOR_DEPTH / 2 - WALL_DEPTH);
    side.receiveShadow = true; scene.add(side);
  });
  const trimMat = track(new MeshStandardMaterial({ color: TRIM, roughness: 0.6 }));
  const baseboard = new Mesh(track(new BoxGeometry(xMax - xMin, 0.12, 0.025)), trimMat);
  baseboard.position.set((xMin + xMax) / 2, 0.06, 0.0125); baseboard.receiveShadow = true; scene.add(baseboard);
  const crown = new Mesh(track(new BoxGeometry(xMax - xMin, 0.08, 0.04)), trimMat);
  crown.position.set((xMin + xMax) / 2, ROOM.height - 0.04, 0.02); scene.add(crown);

  // ---- windows ----
  const sky = track(skyTexture());
  const glassMat = track(new MeshBasicMaterial({ map: sky, toneMapped: false }));
  const patch = track(lightPatchTexture());
  const patchMat = track(new MeshBasicMaterial({ map: patch, transparent: true, blending: AdditiveBlending, depthWrite: false }));
  const blinds = [];
  const windowGroups = xs.map((x, i) => {
    const g = new Group(); g.position.set(x, 0, 0); scene.add(g);
    const W = WINDOW.width, H = WINDOW.height, y0 = WINDOW.sill;
    const glass = new Mesh(track(new PlaneGeometry(W + 0.04, H + 0.04)), glassMat);
    glass.position.set(0, y0 + H / 2, -WALL_DEPTH + 0.1); g.add(glass);
    // the window itself: a thin frame set back in the opening, with one centre bar
    const frame = (w, h, px, py, d = 0.05, z = -WALL_DEPTH + 0.13) => { const m = new Mesh(track(new BoxGeometry(w, h, d)), trimMat); m.position.set(px, py, z); m.castShadow = true; m.receiveShadow = true; g.add(m); };
    const f = 0.055;
    frame(W, f, 0, y0 + H - f / 2); frame(W, f, 0, y0 + f / 2);
    frame(f, H, -W / 2 + f / 2, y0 + H / 2); frame(f, H, W / 2 - f / 2, y0 + H / 2);
    frame(0.045, H, 0, y0 + H / 2);
    // casing on the wall face and the sill
    const t = 0.075, cz = 0.014;
    frame(W + t * 2, t, 0, y0 + H + t / 2, 0.028, cz); frame(t, H + t, -W / 2 - t / 2, y0 + (H + t) / 2, 0.028, cz); frame(t, H + t, W / 2 + t / 2, y0 + (H + t) / 2, 0.028, cz);
    frame(W + 0.26, 0.04, 0, y0 - 0.02, 0.17, 0.07);
    frame(W + 0.16, 0.07, 0, y0 - 0.075, 0.02, cz);
    // pool of light on the floor
    const pool = new Mesh(track(new PlaneGeometry(W * 1.05, 2.6)), patchMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(0.25, 0.004, 1.5); pool.renderOrder = 1; g.add(pool);
    // the treatment
    const p = products[i];
    const Model = MODELS[p.kind];
    const t2 = p.treatment;
    const model = new Model({ width: t2.width, height: t2.height, drop: 0, color: t2.color, texture: t2.texture, tile: t2.tile, mirror: t2.mirror, onChange });
    model.group.position.set(0, t2.top, t2.z);
    g.add(model.group);
    blinds.push(model);
    return g;
  });

  // ---- camera ----
  let viewW = 1, viewH = 1, layout = 'wide';
  const probe = new PerspectiveCamera();
  const tmp = new Vector3();
  // where the camera stands for each window (metres from the window) and how much height it should show; products may override
  const viewOf = (p) => ({ dx: -2.2, y: 1.55, z: 4.0, ty: 1.55, vis: 2.55, ...(p.treatment.view || {}) });
  const views = products.map(viewOf);

  // How the scene is framed in a canvas of this shape. `region` is where the model should sit, in normalised canvas units
  // (x and y from -1 to 1, up is positive): the right part on a desktop (words on the left), the top part on a phone.
  function framing(l, aspect) {
    const tall = l === 'tall';
    const fa = tall ? 0.6 : 1;                                  // share of the canvas height the model may use
    const near = { cx: tall ? 0 : 0.3, cy: tall ? 0.38 : 0.02, hw: tall ? 1 : 0.62, hh: fa };
    const wide = { cx: 0, cy: tall ? 0.36 : 0.06, hw: 0.96, hh: tall ? 0.6 : 0.8 };
    const wideFov = tall ? 44 : 34;
    return { near, wide, wideFov, fa };
  }
  const fit = {};
  function fitWide(l, aspect, f) {
    const key = `${l}:${aspect.toFixed(3)}`;
    if (fit[key]) return fit[key];
    const yaw = MathUtils.degToRad(l === 'tall' ? 62 : 46);
    const dir = new Vector3(-Math.sin(yaw), 0.1, Math.cos(yaw)).normalize();
    const target = new Vector3((xs[0] + xs[n - 1]) / 2, 1.5, 0);
    probe.fov = f.wideFov; probe.aspect = aspect; probe.updateProjectionMatrix();
    const pts = [];
    xs.forEach((x) => [[-1, 0], [1, 0], [-1, 1], [1, 1]].forEach(([sx, sy]) => pts.push(new Vector3(x + sx * WINDOW.width / 2, WINDOW.sill + sy * WINDOW.height, 0))));
    // the smallest distance at which the whole row fits (by size), and where its middle lands, so the caller can centre it
    let d = 8, bx = 0, by = 0, ok = false;
    for (; d < 160 && !ok; d *= 1.03) {
      probe.position.copy(target).addScaledVector(dir, d); probe.lookAt(target); probe.updateMatrixWorld(true);
      probe.matrixWorldInverse.copy(probe.matrixWorld).invert();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      pts.forEach((p) => { tmp.copy(p).project(probe); x0 = Math.min(x0, tmp.x); x1 = Math.max(x1, tmp.x); y0 = Math.min(y0, tmp.y); y1 = Math.max(y1, tmp.y); });
      bx = (x0 + x1) / 2; by = (y0 + y1) / 2;
      ok = (x1 - x0) / 2 <= f.wide.hw * 0.92 && (y1 - y0) / 2 <= f.wide.hh;
    }
    return (fit[key] = { pos: target.clone().addScaledVector(dir, d), target, bx, by });
  }

  let state = { cam: 0, wide: 0, drops: products.map(() => 0) };
  const camPos = new Vector3(), camTarget = new Vector3();

  function applyCamera() {
    const aspect = viewW / viewH;
    const f = framing(layout, aspect);
    const w = fitWide(layout, aspect, f);
    const i0 = Math.min(Math.floor(state.cam), n - 1), i1 = Math.min(i0 + 1, n - 1), frac = state.cam - i0;
    const a = views[i0], b = views[i1];
    const v = (key) => lerp(a[key], b[key], frac);
    const x = lerp(xs[i0], xs[i1], frac);
    camPos.set(x + v('dx'), v('y'), v('z') ); camTarget.set(x + 0.15, v('ty'), 0);
    const nearFov = 2 * MathUtils.radToDeg(Math.atan((v('vis') / f.fa) / (2 * Math.hypot(v('dx') - 0.15, v('z')))));
    const k = state.wide;
    camPos.lerp(w.pos, k); camTarget.lerp(w.target, k);
    camera.fov = lerp(nearFov, f.wideFov, k); camera.aspect = aspect;
    camera.position.copy(camPos); camera.lookAt(camTarget);
    camera.updateProjectionMatrix();
    const cx = lerp(f.near.cx, f.wide.cx - w.bx, k), cy = lerp(f.near.cy, f.wide.cy - w.by, k);
    // move the picture so that the model's centre sits at (cx, cy) in the canvas
    camera.setViewOffset(viewW, viewH, -cx * viewW / 2, cy * viewH / 2, viewW, viewH);
    // the light follows the camera so the shadows stay sharp and the pool of light stays on what we are looking at
    const sx = camTarget.x;
    const spread = state.wide;
    sun.position.set(lerp(sx - 4.2, camTarget.x - 3, spread), lerp(5.2, 9, spread), lerp(7.6, 14, spread));
    sun.target.position.set(camTarget.x + 0.2, 1.5, 0);
    sun.angle = lerp(0.52, 1.3, spread); sun.penumbra = lerp(0.95, 1, spread);
    ambient.intensity = lerp(0.85, 1.7, spread);
    sun.intensity = lerp(3.2, 3.6, spread);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.camera.fov = MathUtils.radToDeg(sun.angle) * 2;
    sun.shadow.camera.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
  }

  function setState(next) {
    state = next;
    blinds.forEach((b, i) => { const d = next.drops[i] ?? 0; if (Math.abs(b.drop - d) > 1e-4) { b.drop = d; b.update(); } });
    applyCamera();
  }
  function resize(w, h, l) {
    viewW = Math.max(1, w); viewH = Math.max(1, h); layout = l;
    renderer.setSize(viewW, viewH, false);
    applyCamera();
  }
  function render() { renderer.render(scene, camera); }
  function setPixelRatio(r) { renderer.setPixelRatio(r); renderer.setSize(viewW, viewH, false); }
  function setShadows(on) { renderer.shadowMap.enabled = on; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  function dispose() {
    blinds.forEach((b) => b.dispose());
    disposables.forEach((d) => d.dispose?.());
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
  return { renderer, scene, camera, blinds, setState, resize, render, setPixelRatio, setShadows, dispose, xs };
}
