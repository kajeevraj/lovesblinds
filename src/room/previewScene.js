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
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xb79c77, roughness: 0.75 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xfffdf8, roughness: 0.5 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8f6f4d, roughness: 0.6 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.45 });
  const cordMat = new THREE.MeshStandardMaterial({ color: 0xe4e0d6, roughness: 0.7 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x23365c, roughness: 0.35, metalness: 0.3 });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x9fc4e8, toneMapped: false });
  const speakerMat = new THREE.MeshStandardMaterial({ color: 0x8a8984, roughness: 0.9 });

  // vignette: the corners of the picture fall off a little, like the room photo
  const vig = new THREE.Scene(), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  vig.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = distance(vUv, vec2(0.5, 0.46)); gl_FragColor = vec4(0.11, 0.075, 0.04, smoothstep(0.35, 0.95, d) * 0.3); }',
  })));
  vig.children[0].frustumCulled = false;

  const cfg = { tight: false, kind: 'roller', w: 1, h: 1.5, mount: 'inside', drive: { movement: 'chain', side: 'right' }, cover: 'wrapped', layers: [], amount: 0.55 };
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
    // true-scale references under the window: floor, baseboard (5 1/2 in) and a side table (24 in high, 20 in wide, 14 in deep); the sill is 36 in above the floor
    const fy = bottom - 36 * IN;
    built.fy = fy;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, 9), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, fy, 4.5); g.add(floor);
    g.add(box(R * 2, 5.5 * IN, 0.018, baseMat, 0, fy + 2.75 * IN, 0.009));
    if (ow >= 24 * IN) {
      const tx = -ow * 0.15, tz = 0.02 + 7 * IN, th = 24 * IN, tw = 20 * IN, td = 14 * IN;
      g.add(box(tw, 1.4 * IN, td, woodMat, tx, fy + th - 0.7 * IN, tz));
      for (const lx of [-1, 1]) for (const lz of [-1, 1]) g.add(box(1.4 * IN, th - 1.4 * IN, 1.4 * IN, woodMat, tx + lx * (tw / 2 - 1.2 * IN), fy + (th - 1.4 * IN) / 2, tz + lz * (td / 2 - 1.2 * IN)));
    }
    const shadeTop = Math.max(top, built.shade.top);
    // camera: the window, the trim and the floor below it, with a margin for the labels
    const bw = (mount === 'inside' ? ow + 2 * TRIM + 0.08 : w);
    const topExt = shadeTop + TRIM + 0.12, botExt = fy - 0.05;
    const wide = cfg.tight ? 1.22 : 1.5, tall = cfg.tight ? 1.04 : 1.08;
    built.fit = { w: bw * wide, h: (topExt - botExt) * tall, cy: (topExt + botExt) / 2 };
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
  let accessory = null, xrayMats = [], driveDir = 0;
  const xray = { target: 0, v: 0 }, xrayPt = new THREE.Vector3();
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
    const d = cfg.drive, g = new THREE.Group(), n = shades.length;
    const zOf = (i) => sp.z + (n - 1 - i) * 0.058;                       // each shade's own depth (double-stack: the back shade is further from the room)
    const sx = d.side === 'left' ? -1 : 1, endX = sx * (sp.w / 2 - 0.03);
    const edge = Math.max(sp.w / 2, built.ow / 2 + TRIM);                // where the wall starts, beside the trim
    let reach = 0;                                                       // how far beside the window something is drawn (the camera makes room for it)
    if (d.movement === 'chain') {
      const z = zOf(0);
      g.add(box(0.034, 0.05, 0.034, plasticMat, endX, sp.top - 0.045, z + 0.034));                       // the clutch at the end of the cassette
      const beads = 64, len = Math.min(sp.h * 0.55, 1.0), step = len / beads;
      const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0021, 8, 6), chainMat, beads * 2);
      const m = new THREE.Matrix4();
      for (let i = 0; i < beads; i++) for (const k of [0, 1]) { m.makeTranslation(endX + (k ? 0.006 : -0.006), sp.top - 0.07 - i * step, z + 0.038 + (k ? 0.004 : 0)); mesh.setMatrixAt(i * 2 + k, m); }
      g.add(mesh);
      g.add(box(0.02, 0.018, 0.014, plasticMat, endX, sp.top - 0.07 - len - 0.01, z + 0.04));            // the weight that keeps the loop tight
    } else if (d.movement === 'cordless' || d.movement === 'zero-gravity') {
      // the optional center handle, on the middle of each bottom rail (it moves with the rail)
      shades.forEach((sh) => { sh.rail.add(box(0.1, 0.02, 0.012, handleMat, 0, -0.015, 0.016)); });
    } else if (d.movement === 'motorized') {
      xrayMats = [];
      const tabY = sp.top - CASS_H_ - 0.014;
      const ox = sx * (edge + 0.16), oyy = built.fy + 12 * IN;                                          // the wall outlet (12 in up), on the control side
      g.add(box(0.07, 0.115, 0.01, trimMat, ox, oyy, 0.005));
      for (const dy of [0.028, -0.028]) g.add(box(0.034, 0.03, 0.004, jambTopMat, ox, oyy + dy, 0.011));
      reach = Math.max(reach, Math.abs(ox) + 0.08);
      shades.forEach((sh, i) => {                                         // a motor in every shade (double-stack: two), hidden inside the roller
        const z = zOf(i);
        g.add(box(0.04, 0.028, 0.036, plasticMat, endX, tabY, z));                                         // the plastic end cap under the cassette
        if (d.power === 'battery') {
          g.add(box(0.019, 0.008, 0.002, motorMat, endX, tabY, z + 0.0185));                               // the USB-C charging port
          g.add(box(0.012, 0.0035, 0.0012, cordMat, endX, tabY, z + 0.0196));
        } else {
          const path = new THREE.CatmullRomCurve3([
            new THREE.Vector3(endX, tabY, z + 0.019), new THREE.Vector3(endX + sx * 0.02, tabY - 0.03, z + 0.03),
            new THREE.Vector3(sx * (sp.w / 2 + 0.01), tabY - 0.07, Math.max(0.03, z + 0.03)), new THREE.Vector3(sx * (edge + 0.1), tabY - 0.2, 0.02 + i * 0.004),
            new THREE.Vector3(ox, (tabY + oyy) / 2, 0.016 + i * 0.004), new THREE.Vector3(ox, oyy + 0.06, 0.016 + i * 0.004),
          ]);
          g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 64, 0.0032, 6), cordMat));                    // the cord leaves the end cap and runs down the wall to the outlet
          g.add(box(0.026, 0.04, 0.018, cordMat, ox, oyy + 0.03, 0.02));                                   // the plug
        }
        // the x-ray: a soft outline of the motor inside the roller, on the chosen side
        const len = 0.27, cx = sx * (sp.w / 2 - 0.02 - len / 2);
        const body = new THREE.CylinderGeometry(0.017, 0.017, len, 20); body.rotateZ(Math.PI / 2);
        const fill = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(body), new THREE.LineBasicMaterial({ color: 0x2f7fe0, transparent: true, opacity: 0, depthTest: false, toneMapped: false }));
        for (const m of [fill, lines]) { m.position.set(cx, sp.top - CASS_H_ / 2, z); m.renderOrder = 20; g.add(m); }
        xrayMats.push([fill.material, 0.16], [lines.material, 0.7]);
        if (i === 0) xrayPt.set(cx, sp.top - CASS_H_ / 2, z);
      });
      if (d.power === 'battery' && d.solar) {                             // a small solar panel on the glass near the top on the motor side, with a thin cable to the end cap; drawn over the shade so it shows up or down
        const gz = -DEPTH + 0.03 - 0.02 + 0.008, px = sx * (sp.w / 2 - 0.1), py = sp.top - 0.24;
        const ghost = (m, order) => { m.material.depthTest = false; m.material.transparent = true; m.renderOrder = order; g.add(m); return m; };
        ghost(box(0.12, 0.16, 0.004, trimMat.clone(), px, py, gz), 8);
        ghost(box(0.108, 0.148, 0.004, solarMat.clone(), px, py, gz + 0.003), 9);
        const gl = trimMat.clone();
        for (const vx of [-0.018, 0.018]) ghost(box(0.002, 0.148, 0.002, gl, px + vx, py, gz + 0.005), 10);
        for (const vy of [-0.037, 0, 0.037]) ghost(box(0.108, 0.002, 0.002, gl, px, py + vy, gz + 0.005), 10);
        const cab = new THREE.CatmullRomCurve3([new THREE.Vector3(px, py + 0.08, gz + 0.004), new THREE.Vector3(px + sx * 0.02, (py + tabY) / 2, gz + 0.01), new THREE.Vector3(endX, tabY - 0.012, zOf(0) + 0.019)]);
        ghost(new THREE.Mesh(new THREE.TubeGeometry(cab, 24, 0.0018, 5), new THREE.MeshBasicMaterial({ color: 0x2b2b2e, toneMapped: false })), 11);
      }
      if (cfg.kind === 'shangri-la') {                                    // the wall bracket is confirmed for the Shangri-La remote only
        const rx = -sx * (edge + 0.07), ry = built.oy + 0.06;
        g.add(box(0.06, 0.16, 0.008, trimMat, rx, ry, 0.004));
        g.add(box(0.044, 0.125, 0.014, motorMat, rx, ry, 0.015));
        for (const [bx, by] of [[0, 0.04], [-0.012, 0.012], [0.012, 0.012], [-0.012, -0.016], [0.012, -0.016], [0, -0.044]]) g.add(box(0.009, 0.009, 0.004, jambTopMat, rx + bx, ry + by, 0.023));
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
    let motor = null;
    if (cfg.drive.movement === 'motorized') { v.copy(xrayPt).project(camera); motor = { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h }; }
    onLayout?.({ motor, xray: xray.target, x0, x1, y0, y1, handle: { x: (x0 + x1) / 2, y: Math.min(y1, y0 + f * (y1 - y0)) }, canvasW: size.w, canvasH: size.h });
  }

  // ---- configuration ----------------------------------------------------------------------------------------------------------------------------------
  function configure(next) {
    const n = { ...next };
    if (n.width != null) n.w = clampInches(n.width) * IN;
    if (n.height != null) n.h = clampInches(n.height) * IN;
    delete n.width; delete n.height;
    const geometryChanged = ['w', 'h', 'mount', 'tight'].some((k) => n[k] != null && n[k] !== cfg[k]);
    const shadesChanged = geometryChanged || ['kind', 'cover'].some((k) => n[k] != null && n[k] !== cfg[k]) || (n.drive && JSON.stringify(n.drive) !== JSON.stringify(cfg.drive))
      || (n.layers && JSON.stringify(n.layers.map((l) => [l.fabric?.key, l.optics])) !== JSON.stringify(cfg.layers.map((l) => [l.fabric?.key, l.optics])));
    const driveChanged = n.drive && JSON.stringify(n.drive) !== JSON.stringify(cfg.drive);
    Object.assign(cfg, Object.fromEntries(Object.entries(n).filter(([, v]) => v != null)));
    if (driveChanged) { xray.target = cfg.drive.movement === 'motorized' ? 1 : 0; driveDir = 0; }
    if (n.amount != null) cfg.amount = n.amount;
    if (geometryChanged || !built) buildWindow();
    if (shadesChanged || geometryChanged || !shades.length) buildShades();
    wake();
  }
  // double-stack: the back shade hangs a little lower, so its bottom rail shows under the front one
  function setShadeAmounts(a) { shades.forEach((s, i) => s.setAmount(i === 0 ? a : Math.min(1, a + 0.07 * (1 - a)))); }
  function snapAmount(a) { driveDir = 0; xray.target = 0; cfg.amount = current = a; setShadeAmounts(a); emit(); wake(); }

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
    drive(dir) { xray.target = 0; driveDir = (dir > 0 && current >= 1) || (dir < 0 && current <= 0) ? 0 : dir; if (!dir) cfg.amount = current; emit(); wake(); },
    setXray(on) { xray.target = on ? 1 : 0; emit(); wake(); }, setActive, setReducedMotion: (v) => { reduced = !!v; },
    get amount() { return current; }, get shadeHeight() { return built?.shade.h || cfg.h; },
    dispose() {
      setActive(false); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      shades.forEach((s) => s.dispose()); renderer.dispose();
    },
  };
}
