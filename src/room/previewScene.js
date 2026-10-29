// The three.js side of the product-page preview: ONE window, built to the size the customer typed, on a plaster wall with soft light.
//
//   const ctrl = createPreviewScene(canvas, { onLayout });
//   ctrl.configure({ kind, width, height, mount, drive: { movement, power, solar, control, side }, cover, layers: [{ fabric, optics }, ...], amount })   // inches in, anything may be left out
//   ctrl.snapAmount(a)   ctrl.resize(cssW, cssH, dpr)   ctrl.setActive(bool)   ctrl.dispose()
//
// Inside mount: the window opening is the shade's size, the shade sits in the recess. Outside mount: the shade is the size typed and overlaps a
// smaller window and its trim. A bead chain, a motor with its charging port or cord, and the optional center handle are drawn the way the choices say. Double-stack is two shades one in front of the other.
// The camera always fits the whole window with room for the size labels, whatever the size, and `onLayout` reports where the shade is on screen
// (CSS pixels) so the page can place the size labels and the drag handle. Draws only when something changed, only while on screen.
import * as THREE from 'three';
import { createShade, handleFraction } from './models/shade.js';
import { shadowMesh, rampTexture, blobTexture } from './models/common.js';
import { plasterTexture, skyTexture, washTexture } from './backdrop.js';

const IN = 0.0254;
const CASS_H_ = 0.064;                                  // the cassette's height (see models/shade.js)
const TRIM = 0.075, DEPTH = 0.09, FOV = 26;
const MIN_IN = 12, MAX_IN = 300;
export const clampInches = (v) => Math.min(MAX_IN, Math.max(MIN_IN, v));

export function createPreviewScene(canvas, { onLayout, onAmount, onDrive } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const env = {
    invalidate: () => wake(), maxAniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    backlight: new THREE.Color(0.62, 0.62, 0.62),         // less daylight through the cloth than in the room: here the color has to be accurate
    glowTop: { value: new THREE.Vector3(1.0, 1.0, 1.04) }, glowBottom: { value: new THREE.Vector3(0.78, 0.84, 0.7) },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xfffaf2, 0xe7dfd0, 1.9));
  const sun = new THREE.DirectionalLight(0xfff3e4, 0.9); sun.position.set(-2.6, 2.4, 4.4); scene.add(sun);
  const plaster = plasterTexture(env.maxAniso), sky = skyTexture(), wash = washTexture();
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xfffdf8, roughness: 0.5 });
  const jambMat = new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.7 });
  const jambTopMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.8 });
  const wallMat = new THREE.MeshBasicMaterial({ color: 0xf3ede2, toneMapped: false });          // plain, evenly lit
  const glassMat = new THREE.MeshBasicMaterial({ map: sky, toneMapped: false });
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xd6d1c6, metalness: 0.35, roughness: 0.4 });
  const plasticMat = new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.5 });
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x6b655c, roughness: 0.7 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x3a404c, roughness: 0.5, metalness: 0.1 });

  // vignette: the corners of the picture fall off a little, like the room photo
  const vig = new THREE.Scene(), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  vig.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = distance(vUv, vec2(0.5, 0.46)); gl_FragColor = vec4(0.11, 0.075, 0.04, smoothstep(0.45, 1.0, d) * 0.09); }',
  })));
  vig.children[0].frustumCulled = false;

  const cfg = { tight: false, kind: 'roller', w: 1, h: 1.5, mount: 'inside', drive: { movement: 'chain', side: 'right' }, cover: 'wrapped', layers: [], amount: 0.55, extras: {} };
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
    // trim: head, sides, sill and apron
    g.add(box(ow + 2 * TRIM, TRIM, 0.02, trimMat, 0, top + TRIM / 2, 0.01));
    for (const sx of [-1, 1]) g.add(box(TRIM, oh, 0.02, trimMat, sx * (ow / 2 + TRIM / 2), oy, 0.01));
    g.add(box(ow + 2 * TRIM + 0.07, 0.024, 0.07, trimMat, 0, bottom - 0.012, 0.035));
    g.add(box(ow + 2 * TRIM, TRIM * 0.8, 0.02, trimMat, 0, bottom - 0.024 - TRIM * 0.4, 0.01));
    const under = shadowMesh(blobTexture(), 0.13); under.scale.set(ow + 2 * TRIM + 0.34, 0.36, 1); under.position.set(0.02, bottom - 0.024 - TRIM * 0.8 - 0.05, 0.003); g.add(under);
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
    built = { group: g, ow, oh, oy, top, bottom };
    // where the shade goes
    if (mount === 'inside') built.shade = { w: ow, h: oh, x: 0, top, z: -0.032 };
    else built.shade = { w, h, x: 0, top: h / 2, z: 0.05 };
    // camera: a straight-on view of the one window, with plenty of plain wall around it and room under it for the size
    const shadeTop = Math.max(top, built.shade.top), shadeBottom = Math.min(bottom, built.shade.top - built.shade.h);
    const bw = (mount === 'inside' ? ow + 2 * TRIM + 0.08 : w);
    const topExt = shadeTop + TRIM + 0.08, botExt = shadeBottom - 0.024 - TRIM * 0.8 - 0.16;
    const wide = cfg.tight ? 1.5 : 1.75, tall = cfg.tight ? 1.1 : 1.18;
    built.fit = { w: bw * wide, h: (topExt - botExt) * tall, cy: (topExt + botExt) / 2 };
    built.shadeBottom = shadeBottom;
    built.fit0 = built.fit;
    fitCamera();
  }

  function fitCamera() {
    if (!built) return;
    const t = Math.tan((FOV * Math.PI) / 360), aspect = size.w / size.h;
    const d = Math.max(built.fit.h / (2 * t), built.fit.w / (2 * t * aspect), 0.9);
    camera.aspect = aspect; camera.position.set(0, built.fit.cy, d); camera.lookAt(0, built.fit.cy, 0); camera.updateProjectionMatrix();
  }

  // ---- the shades (one, or two for double-stack) and the control ------------------------------------------------------------------------------------
  let accessory = null, xrayMats = [], driveDir = 0, hasSolar = false;
  const xray = { target: 0, v: 0 }, xrayPt = new THREE.Vector3(), solarPt = new THREE.Vector3();
  function buildShades() {
    shades.forEach((s) => s.dispose()); shades = [];
    if (accessory) { scene.remove(accessory); accessory.traverse((o) => o.geometry?.dispose()); accessory = null; }
    if (!built || !cfg.layers.length) return;
    const sp = built.shade;
    cfg.layers.forEach((layer, i) => {                                   // layers[0] is the front shade, the last one the back
      const s = createShade(cfg.kind, env);
      s.setSize(sp.w, sp.h); s.setCover(cfg.cover); s.setFabric(layer.fabric, layer.optics); s.setRailColor(cfg.extras?.railHex);
      s.group.position.set(sp.x, sp.top, sp.z + (cfg.layers.length - 1 - i) * 0.058);
      scene.add(s.group); shades.push(s);
    });
    setShadeAmounts(current);
    buildControl(sp);
    emit();
  }

  function buildControl(sp) {
    const d = cfg.drive, g = new THREE.Group(), n = shades.length;
    const zOf = (i) => sp.z + (n - 1 - i) * 0.058;                       // each shade's own depth (double-stack: the back shade is further from the room)
    const sx = d.side === 'left' ? -1 : 1, endX = sx * (sp.w / 2 - 0.03);
    const edge = Math.max(sp.w / 2, built.ow / 2 + TRIM);                // where the wall starts, beside the trim
    let reach = 0;                                                       // how far beside the window something is drawn (the camera makes room for it)
    chainMat.color.set(cfg.extras?.chainHex || '#f4f1ea'); chainMat.metalness = cfg.extras?.chainMetal ? 0.7 : 0.04; chainMat.roughness = cfg.extras?.chainMetal ? 0.3 : 0.55;   // thin, true-color chain
    if (d.movement === 'chain') {
      const z = zOf(0);
      g.add(box(0.034, 0.05, 0.034, plasticMat, endX, sp.top - 0.045, z + 0.034));                       // the clutch at the end of the cassette
      const beads = 64, len = Math.min(sp.h * 0.55, 1.0), step = len / beads;
      const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0021, 8, 6), chainMat, beads * 2);
      const m = new THREE.Matrix4();
      for (let i = 0; i < beads; i++) for (const k of [0, 1]) { m.makeTranslation(endX + (k ? 0.006 : -0.006), sp.top - 0.07 - i * step, z + 0.038 + (k ? 0.004 : 0)); mesh.setMatrixAt(i * 2 + k, m); }
      g.add(mesh);
      g.add(box(0.02, 0.018, 0.014, plasticMat, endX, sp.top - 0.07 - len - 0.01, z + 0.04));            // the weight that keeps the loop tight
    } else if (d.movement === 'zero-gravity') {
      // nothing hangs down: the center handle is drawn on the page (a button on the bottom rail), so it is always visible and can be dragged
    } else if (d.movement === 'motorized' || d.movement === 'two-in-one') {
      xrayMats = [];
      shades.forEach((sh, i) => {                                         // a motor in every shade (double-stack: two), hidden inside the roller
        const z = zOf(i);
        // a soft, thin outline of the motor inside the roller tube, on the chosen side: just darker than the cassette, low opacity
        const len = 0.27, cx = sx * (sp.w / 2 - 0.02 - len / 2);
        const body = new THREE.CylinderGeometry(0.017, 0.017, len, 20); body.rotateZ(Math.PI / 2);
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(body), new THREE.LineBasicMaterial({ color: 0x3a3228, transparent: true, opacity: 0, depthTest: false, toneMapped: false }));
        lines.position.set(cx, sp.top - CASS_H_ / 2, z); lines.renderOrder = 20; g.add(lines);
        xrayMats.push([lines.material, 0.2]);
        if (d.movement === 'two-in-one' || d.power === 'battery') g.add(box(0.005, 0.005, 0.001, motorMat, endX, sp.top - 0.05, z + 0.0275));   // the charging port: a tiny, barely visible dot
      });
      if (d.movement === 'motorized' && d.power === 'battery' && d.solar) {                             // a small, dark, thin solar panel on the glass near the top on the motor side (behind the shade)
        const gz = -DEPTH + 0.03 - 0.02 + 0.006;
        g.add(box(0.07, 0.1, 0.003, solarMat, sx * (sp.w / 2 - 0.09), sp.top - 0.2, gz));
      }
      if (cfg.kind === 'shangri-la') {                                    // the wall bracket is confirmed for the Shangri-La remote only
        const rx = -sx * (edge + 0.07), ry = built.oy + 0.06;
        g.add(box(0.06, 0.16, 0.008, trimMat, rx, ry, 0.004));
        g.add(box(0.044, 0.125, 0.014, motorMat, rx, ry, 0.015));
        reach = Math.max(reach, Math.abs(rx) + 0.045);
      }
    }
    scene.add(g); accessory = g;
    applyXray();
    const base = built.fit0, need = reach ? 2 * (reach + 0.04) * 1.04 : 0;
    built.fit = { ...base, w: Math.max(base.w, need) };
    fitCamera();
  }

  function applyXray() { for (const [m, max] of xrayMats) m.opacity = xray.v * max; }

  function emit() {
    if (!built || !shades.length) { onLayout?.(null); return; }
    const sp = built.shade, v = new THREE.Vector3(), pts = [[-sp.w / 2, sp.top], [sp.w / 2, sp.top], [sp.w / 2, sp.top - sp.h], [-sp.w / 2, sp.top - sp.h]];
    const xs = [], ys = [];
    for (const [x, y] of pts) { v.set(x, y, sp.z + 0.03).project(camera); xs.push(((v.x + 1) / 2) * size.w); ys.push(((1 - v.y) / 2) * size.h); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const f = handleFraction(current, sp.h);
    v.set(0, built.shadeBottom - 0.024 - TRIM * 0.8 - 0.07, 0.03).project(camera);
    onLayout?.({ labelY: ((1 - v.y) / 2) * size.h, x0, x1, y0, y1, handle: { x: (x0 + x1) / 2, y: Math.min(y1, y0 + f * (y1 - y0)) }, canvasW: size.w, canvasH: size.h });
  }

  // ---- configuration ----------------------------------------------------------------------------------------------------------------------------------
  function configure(next) {
    const n = { ...next };
    if (n.width != null) n.w = clampInches(n.width) * IN;
    if (n.height != null) n.h = clampInches(n.height) * IN;
    delete n.width; delete n.height;
    const extrasChanged = n.extras && JSON.stringify(n.extras) !== JSON.stringify(cfg.extras);
    const geometryChanged = ['w', 'h', 'mount', 'tight'].some((k) => n[k] != null && n[k] !== cfg[k]);
    const shadesChanged = geometryChanged || extrasChanged || ['kind', 'cover'].some((k) => n[k] != null && n[k] !== cfg[k]) || (n.drive && JSON.stringify(n.drive) !== JSON.stringify(cfg.drive))
      || (n.layers && JSON.stringify(n.layers.map((l) => [l.fabric?.key, l.optics])) !== JSON.stringify(cfg.layers.map((l) => [l.fabric?.key, l.optics])));
    const driveChanged = n.drive && JSON.stringify(n.drive) !== JSON.stringify(cfg.drive);
    Object.assign(cfg, Object.fromEntries(Object.entries(n).filter(([, v]) => v != null)));
    if (driveChanged) { xray.target = ['motorized', 'two-in-one'].includes(cfg.drive.movement) ? 1 : 0; driveDir = 0; }
    if (n.amount != null) cfg.amount = n.amount;
    if (geometryChanged || !built) buildWindow();
    if (shadesChanged || geometryChanged || !shades.length) buildShades();
    wake();
  }
  // double-stack: the back shade hangs a little lower, so its bottom rail shows under the front one
  function setShadeAmounts(a) { shades.forEach((s, i) => s.setAmount(i === 0 ? a : Math.min(1, a + 0.07 * (1 - a)))); }
  function snapAmount(a) { driveDir = 0; cfg.amount = current = a; setShadeAmounts(a); emit(); wake(); }

  // ---- loop -----------------------------------------------------------------------------------------------------------------------------------------------
  const wake = () => { dirty = true; if (active && !raf) raf = requestAnimationFrame(frame); };
  function frame(t) {
    raf = 0; if (!active) return;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
    let moving = false;
    if (Math.abs(xray.target - xray.v) > 0.003) { xray.v += (xray.target - xray.v) * (reduced ? 1 : 1 - Math.exp(-dt * 5)); applyXray(); dirty = true; moving = true; }
    else if (xray.v !== xray.target) { xray.v = xray.target; applyXray(); dirty = true; }
    if (driveDir) {                                                       // the remote: steady motor speed, about 10 in a second, until it reaches the end or Stop
      const travel = Math.max(0.4, (built?.shade.h || 1.5) - 0.094);
      cfg.amount = Math.min(1, Math.max(0, cfg.amount + driveDir * (0.254 / travel) * dt)); current = cfg.amount; setShadeAmounts(current); emit(); onAmount?.(current); dirty = true; moving = true;
      if (cfg.amount <= 0 || cfg.amount >= 1) { driveDir = 0; onDrive?.(0); }
    }
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
    configure, snapAmount, resize,
    drive(dir) { driveDir = (dir > 0 && current >= 1) || (dir < 0 && current <= 0) ? 0 : dir; if (!dir) cfg.amount = current; emit(); wake(); },
    setXray(on) { xray.target = on ? 1 : 0; emit(); wake(); }, setActive, setReducedMotion: (v) => { reduced = !!v; },
    get amount() { return current; }, get shadeHeight() { return built?.shade.h || cfg.h; },
    dispose() {
      setActive(false); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      shades.forEach((s) => s.dispose()); renderer.dispose();
    },
  };
}
