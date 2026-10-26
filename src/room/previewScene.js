// The three.js side of the product-page preview: ONE window, built to the size the customer typed, on a plaster wall with soft light.
//
//   const ctrl = createPreviewScene(canvas, { onLayout });
//   ctrl.configure({ kind, width, height, mount, control, cover, layers: [{ fabric, optics }, ...], amount })   // inches in, anything may be left out
//   ctrl.snapAmount(a)   ctrl.resize(cssW, cssH, dpr)   ctrl.setActive(bool)   ctrl.dispose()
//
// Inside mount: the window opening is the shade's size, the shade sits in the recess. Outside mount: the shade is the size typed and overlaps a
// smaller window and its trim. A bead chain or a motor is drawn at the right-hand end. Double-stack is two shades one in front of the other.
// The camera always fits the whole window with room for the size labels, whatever the size, and `onLayout` reports where the shade is on screen
// (CSS pixels) so the page can place the size labels and the drag handle. Draws only when something changed, only while on screen.
import * as THREE from 'three';
import { createShade, handleFraction } from './models/shade.js';
import { shadowMesh, rampTexture, blobTexture } from './models/common.js';
import { plasterTexture, skyTexture, washTexture } from './backdrop.js';

const IN = 0.0254;
const TRIM = 0.075, DEPTH = 0.09, FOV = 26;
const MIN_IN = 12, MAX_IN = 300;
export const clampInches = (v) => Math.min(MAX_IN, Math.max(MIN_IN, v));

export function createPreviewScene(canvas, { onLayout, onAmount } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const env = {
    invalidate: () => wake(), maxAniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    backlight: new THREE.Color(0.62, 0.62, 0.62),         // less daylight through the cloth than in the room: here the color has to be accurate
    glowTop: { value: new THREE.Vector3(1.0, 1.0, 1.04) }, glowBottom: { value: new THREE.Vector3(0.78, 0.84, 0.7) },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xb9a687, 1.5));
  const sun = new THREE.DirectionalLight(0xffeedd, 1.5); sun.position.set(-2.6, 2.4, 4.4); scene.add(sun);
  const plaster = plasterTexture(env.maxAniso), sky = skyTexture(), wash = washTexture();
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xfffdf8, roughness: 0.5 });
  const jambMat = new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.7 });
  const jambTopMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.8 });
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster, bumpMap: plaster, bumpScale: 1.4, roughness: 1 });
  const glassMat = new THREE.MeshBasicMaterial({ map: sky, toneMapped: false });
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xd6d1c6, metalness: 0.35, roughness: 0.4 });
  const plasticMat = new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.5 });
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x38373a, roughness: 0.6 });

  // vignette: the corners of the picture fall off a little, like the room photo
  const vig = new THREE.Scene(), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  vig.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = distance(vUv, vec2(0.5, 0.46)); gl_FragColor = vec4(0.11, 0.075, 0.04, smoothstep(0.35, 0.95, d) * 0.3); }',
  })));
  vig.children[0].frustumCulled = false;

  const cfg = { kind: 'roller', w: 1, h: 1.5, mount: 'inside', control: 'chain', cover: 'wrapped', layers: [], amount: 0.55 };
  let built = null, shades = [], current = 0.55, size = { w: 2, h: 2 }, active = false, raf = 0, dirty = true, last = 0, reduced = false, slow = 0, dprCap = 2;
  let dispDpr = 1;

  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const plane = (w, h, mat, x, y, z, rx = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); return m; };

  // ---- the window, the trim and the wall (rebuilt when the size or the mount changes) ---------------------------------------------------------------
  function buildWindow() {
    if (built) { scene.remove(built.group); built.group.traverse((o) => { o.geometry?.dispose(); if (o.material && o.userData.own) o.material.dispose(); }); }
    const { w, h, mount } = cfg, g = new THREE.Group();
    const ow = mount === 'inside' ? w : Math.max(0.22, w - 0.25), oh = mount === 'inside' ? h : Math.max(0.3, h - 0.275), oy = mount === 'inside' ? 0 : -0.0125;
    const top = oy + oh / 2, bottom = oy - oh / 2;
    // wall with a hole for the recess
    const R = Math.max(w, h) * 3 + 3, shape = new THREE.Shape([new THREE.Vector2(-R, -R), new THREE.Vector2(R, -R), new THREE.Vector2(R, R), new THREE.Vector2(-R, R)]);
    shape.holes.push(new THREE.Path([new THREE.Vector2(-ow / 2, bottom), new THREE.Vector2(-ow / 2, top), new THREE.Vector2(ow / 2, top), new THREE.Vector2(ow / 2, bottom)]));
    const wallGeo = new THREE.ShapeGeometry(shape);
    g.add(new THREE.Mesh(wallGeo, wallMat));
    const washMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, alphaMap: wash, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const washTex = wash.clone(); washTex.needsUpdate = true;
    const washMesh = plane(Math.max(w, h) * 4, Math.max(w, h) * 4, washMat, -Math.max(w, h) * 0.3, Math.max(w, h) * 0.3, 0.002); g.add(washMesh);
    // trim: head, sides, sill and apron
    g.add(box(ow + 2 * TRIM, TRIM, 0.02, trimMat, 0, top + TRIM / 2, 0.01));
    for (const sx of [-1, 1]) g.add(box(TRIM, oh, 0.02, trimMat, sx * (ow / 2 + TRIM / 2), oy, 0.01));
    g.add(box(ow + 2 * TRIM + 0.07, 0.024, 0.07, trimMat, 0, bottom - 0.012, 0.035));
    g.add(box(ow + 2 * TRIM, TRIM * 0.8, 0.02, trimMat, 0, bottom - 0.024 - TRIM * 0.4, 0.01));
    const under = shadowMesh(blobTexture(), 0.34); under.scale.set(ow + 2 * TRIM + 0.34, 0.36, 1); under.position.set(0.02, bottom - 0.024 - TRIM * 0.8 - 0.05, 0.003); g.add(under);
    // the recess
    g.add(plane(ow, DEPTH, jambTopMat, 0, top, -DEPTH / 2, Math.PI / 2));
    g.add(plane(ow, DEPTH, jambMat, 0, bottom, -DEPTH / 2, -Math.PI / 2));
    g.add(plane(DEPTH, oh, jambMat, -ow / 2, oy, -DEPTH / 2, 0, Math.PI / 2));
    g.add(plane(DEPTH, oh, jambMat, ow / 2, oy, -DEPTH / 2, 0, -Math.PI / 2));
    // the window itself: sash frame and glass with the view
    const F = 0.03, gz = -DEPTH + 0.03;
    g.add(plane(ow, oh, glassMat, 0, oy, gz - 0.02));
    g.add(box(ow, F, 0.03, trimMat, 0, top - F / 2, gz)); g.add(box(ow, F * 1.3, 0.03, trimMat, 0, bottom + F * 0.65, gz));
    for (const sx of [-1, 1]) g.add(box(F, oh - F * 2.3, 0.03, trimMat, sx * (ow / 2 - F / 2), oy + F * 0.15, gz));
    // soft shadows in the recess: from the head onto the glass and from the left jamb
    const sh = shadowMesh(rampTexture([[0, 1], [1, 0]]), 0.35); sh.scale.set(ow - F * 2, 0.16, 1); sh.position.set(0, top - F - 0.08, gz + 0.016); g.add(sh);
    const sl = shadowMesh(rampTexture([[0, 1], [1, 0]], true), 0.28); sl.scale.set(0.1, oh - F * 2, 1); sl.position.set(-ow / 2 + F + 0.05, oy, gz + 0.016); g.add(sl);
    const sr = shadowMesh(rampTexture([[0, 1], [1, 0]], true), 0.14); sr.scale.set(-0.07, oh - F * 2, 1); sr.position.set(ow / 2 - F - 0.035, oy, gz + 0.016); g.add(sr);
    scene.add(g);
    built = { group: g, ow, oh, oy, top, bottom, washTex };
    // where the shade goes
    if (mount === 'inside') built.shade = { w: ow, h: oh, x: 0, top, z: -0.032 };
    else built.shade = { w, h, x: 0, top: h / 2, z: 0.05 };
    // camera: the whole window (trim, sill) with a margin for the labels
    const bw = (mount === 'inside' ? ow + 2 * TRIM + 0.08 : w), bh = (mount === 'inside' ? oh + TRIM + 0.024 + TRIM * 0.8 + 0.05 : h);
    built.fit = { w: bw * 1.5, h: bh * 1.45, cy: mount === 'inside' ? oy - (TRIM * 0.8 + 0.024 - TRIM) / 2 : 0 };
    fitCamera();
  }

  function fitCamera() {
    if (!built) return;
    const t = Math.tan((FOV * Math.PI) / 360), aspect = size.w / size.h;
    const d = Math.max(built.fit.h / (2 * t), built.fit.w / (2 * t * aspect), 0.9);
    camera.aspect = aspect; camera.position.set(0, built.fit.cy, d); camera.lookAt(0, built.fit.cy, 0); camera.updateProjectionMatrix();
  }

  // ---- the shades (one, or two for double-stack) and the control ------------------------------------------------------------------------------------
  let accessory = null;
  function buildShades() {
    shades.forEach((s) => s.dispose()); shades = [];
    if (accessory) { scene.remove(accessory); accessory.traverse((o) => o.geometry?.dispose()); accessory = null; }
    if (!built || !cfg.layers.length) return;
    const sp = built.shade;
    cfg.layers.forEach((layer, i) => {                                   // layers[0] is the front shade, the last one the back
      const s = createShade(cfg.kind, env);
      s.setSize(sp.w, sp.h); s.setCover(cfg.cover); s.setFabric(layer.fabric, layer.optics);
      s.group.position.set(sp.x, sp.top, sp.z + (cfg.layers.length - 1 - i) * 0.058);
      scene.add(s.group); shades.push(s);
    });
    setShadeAmounts(current);
    buildControl(sp);
    emit();
  }

  function buildControl(sp) {
    const front = shades[0], g = new THREE.Group();
    const z = sp.z + (shades.length - 1) * 0.058, right = sp.w / 2 - 0.03;
    if (cfg.control === 'chain') {
      g.add(box(0.034, 0.05, 0.034, plasticMat, right, sp.top - 0.045, z + 0.034));                    // the clutch at the end of the cassette
      const beads = 64, len = Math.min(sp.h * 0.55, 1.0), step = len / beads;
      const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0021, 8, 6), chainMat, beads * 2);
      const m = new THREE.Matrix4();
      for (let i = 0; i < beads; i++) for (const k of [0, 1]) { m.makeTranslation(right + (k ? 0.006 : -0.006), sp.top - 0.07 - i * step, z + 0.038 + (k ? 0.004 : 0)); mesh.setMatrixAt(i * 2 + k, m); }
      g.add(mesh);
      g.add(box(0.02, 0.018, 0.014, plasticMat, right, sp.top - 0.07 - len - 0.01, z + 0.04));         // the weight that keeps the loop tight
    } else if (['remote', 'matter', 'motor', 'hybrid'].includes(cfg.control)) {
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, 0.04, 4, 10), motorMat);            // the motor's charging port on the cassette
      cap.rotation.z = Math.PI / 2; cap.position.set(right, sp.top - 0.052, z + 0.0275); g.add(cap);
    }
    scene.add(g); accessory = g;
    void front;
  }

  function emit() {
    if (!built || !shades.length) { onLayout?.(null); return; }
    const sp = built.shade, v = new THREE.Vector3(), pts = [[-sp.w / 2, sp.top], [sp.w / 2, sp.top], [sp.w / 2, sp.top - sp.h], [-sp.w / 2, sp.top - sp.h]];
    const xs = [], ys = [];
    for (const [x, y] of pts) { v.set(x, y, sp.z + 0.03).project(camera); xs.push(((v.x + 1) / 2) * size.w); ys.push(((1 - v.y) / 2) * size.h); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const f = handleFraction(current, sp.h);
    onLayout?.({ x0, x1, y0, y1, handle: { x: (x0 + x1) / 2, y: Math.min(y1, y0 + f * (y1 - y0)) }, canvasW: size.w, canvasH: size.h });
  }

  // ---- configuration ----------------------------------------------------------------------------------------------------------------------------------
  function configure(next) {
    const n = { ...next };
    if (n.width != null) n.w = clampInches(n.width) * IN;
    if (n.height != null) n.h = clampInches(n.height) * IN;
    delete n.width; delete n.height;
    const geometryChanged = ['w', 'h', 'mount'].some((k) => n[k] != null && n[k] !== cfg[k]);
    const shadesChanged = geometryChanged || ['kind', 'cover', 'control'].some((k) => n[k] != null && n[k] !== cfg[k])
      || (n.layers && JSON.stringify(n.layers.map((l) => [l.fabric?.key, l.optics])) !== JSON.stringify(cfg.layers.map((l) => [l.fabric?.key, l.optics])));
    Object.assign(cfg, Object.fromEntries(Object.entries(n).filter(([, v]) => v != null)));
    if (n.amount != null) cfg.amount = n.amount;
    if (geometryChanged || !built) buildWindow();
    if (shadesChanged || geometryChanged || !shades.length) buildShades();
    wake();
  }
  // double-stack: the back shade hangs a little lower, so its bottom rail shows under the front one
  function setShadeAmounts(a) { shades.forEach((s, i) => s.setAmount(i === 0 ? a : Math.min(1, a + 0.07 * (1 - a)))); }
  function snapAmount(a) { cfg.amount = current = a; setShadeAmounts(a); emit(); wake(); }

  // ---- loop -----------------------------------------------------------------------------------------------------------------------------------------------
  const wake = () => { dirty = true; if (active && !raf) raf = requestAnimationFrame(frame); };
  function frame(t) {
    raf = 0; if (!active) return;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
    let moving = false;
    if (Math.abs(cfg.amount - current) > 0.0008) {
      current += (cfg.amount - current) * (reduced ? 1 : 1 - Math.exp(-dt * 14)); setShadeAmounts(current); moving = true; dirty = true; emit(); onAmount?.(current);
    } else if (current !== cfg.amount) { current = cfg.amount; setShadeAmounts(current); dirty = true; emit(); onAmount?.(current); }
    if (dirty) {
      dirty = false;
      const t0 = performance.now();
      shades.forEach((s) => s.applyEnv());
      renderer.autoClear = true; renderer.render(scene, camera);
      renderer.autoClear = false; renderer.render(vig, ortho);
      if (moving) {                                                       // slow device: after a run of slow frames, draw fewer pixels
        slow = performance.now() - t0 > 30 ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 12 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); slow = 0; resize(size.w, size.h, dispDpr); }
      }
    }
    if (moving) raf = requestAnimationFrame(frame); else last = 0;
  }
  function resize(w, h, dpr) {
    size = { w, h }; dispDpr = dpr;
    renderer.setPixelRatio(Math.min(dpr, dprCap, Math.sqrt(2.4e6 / Math.max(1, w * h))));
    renderer.setSize(w, h, false); fitCamera(); emit(); wake();
  }
  function setActive(on) { active = on; if (on) { last = 0; wake(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  const onLost = (e) => { e.preventDefault(); setActive(false); };
  const onRestored = () => { buildShades(); wake(); };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    configure, snapAmount, resize, setActive, setReducedMotion: (v) => { reduced = !!v; },
    get amount() { return current; }, get shadeHeight() { return built?.shade.h || cfg.h; },
    dispose() {
      setActive(false); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      shades.forEach((s) => s.dispose()); renderer.dispose();
    },
  };
}
