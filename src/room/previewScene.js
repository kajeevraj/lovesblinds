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
    // camera: the whole window (trim, sill) with a margin for the labels
    const bw = (mount === 'inside' ? ow + 2 * TRIM + 0.08 : w), bh = (mount === 'inside' ? oh + TRIM + 0.024 + TRIM * 0.8 + 0.05 : h);
    const wide = cfg.tight ? 1.22 : 1.5, tall = cfg.tight ? 1.25 : 1.45;          // tight: the window fills about 80% of the picture's height
    built.fit = { w: bw * wide, h: bh * tall, cy: mount === 'inside' ? oy - (TRIM * 0.8 + 0.024 - TRIM) / 2 : 0 };
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
      shades.forEach((sh) => { sh.rail.add(box(0.07, 0.016, 0.01, plasticMat, 0, -0.015, 0.0145)); });
    } else if (d.movement === 'motorized') {
      const outletY = built.bottom - 0.2, wx = sx * (edge + 0.055);
      shades.forEach((sh, i) => {                                         // a motor in every shade (double-stack: two)
        const z = zOf(i);
        if (d.power === 'battery') {
          const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, 0.04, 4, 10), motorMat);          // the charging port on the cassette, on the chosen side
          cap.rotation.z = Math.PI / 2; cap.position.set(endX, sp.top - 0.052, z + 0.0275); g.add(cap);
        } else {
          g.add(box(0.03, 0.02, 0.012, motorMat, endX, sp.top - 0.052, z + 0.03));                       // the cord leaves the end of the motor...
          const path = new THREE.CatmullRomCurve3([
            new THREE.Vector3(endX, sp.top - 0.052, z + 0.036), new THREE.Vector3(endX + sx * 0.03, sp.top - 0.085, z + 0.05),
            new THREE.Vector3(sx * edge, sp.top - 0.09, 0.045 + i * 0.004), new THREE.Vector3(wx, sp.top - 0.15, 0.024 + i * 0.004),
            new THREE.Vector3(wx, (sp.top + outletY) / 2, 0.016 + i * 0.004), new THREE.Vector3(wx, outletY + 0.07, 0.014 + i * 0.004),
          ]);
          g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 48, 0.0032, 6), cordMat));                    // ...and runs down the wall to an outlet
        }
      });
      if (d.power === 'wired') {
        g.add(box(0.075, 0.12, 0.012, trimMat, wx, outletY, 0.006));                                    // the outlet
        for (const dy of [0.028, -0.028]) { g.add(box(0.034, 0.03, 0.004, jambTopMat, wx, outletY + dy, 0.013)); }
        g.add(box(0.028, 0.04, 0.018, cordMat, wx, outletY + 0.045, 0.026));                             // the plug
        reach = Math.max(reach, edge + 0.055 + 0.05);
      } else if (d.solar) {                                               // a small solar panel on the glass, in the lower corner on the control side
        const gz = -DEPTH + 0.03 - 0.02, px = sx * (built.ow / 2 - 0.13), py = built.bottom + 0.2;
        g.add(box(0.11, 0.15, 0.006, motorMat, px, py, gz + 0.006));
        g.add(plane(0.1, 0.14, solarMat, px, py, gz + 0.0095));
        g.add(box(0.012, 0.012, 0.012, plasticMat, px + sx * -0.045, py + 0.082, gz + 0.006));
      }
      // the remote: in a wall bracket only for Shangri-La (confirmed); every other line draws it on its own, on the sill
      const remote = (grp) => {
        {
          grp.add(box(0.044, 0.125, 0.014, motorMat, 0, 0, 0));
          for (const [bx, by] of [[0, 0.04], [-0.012, 0.012], [0.012, 0.012], [-0.012, -0.016], [0.012, -0.016], [0, -0.044]]) grp.add(box(0.009, 0.009, 0.004, jambTopMat, bx, by, 0.009));
        }
        return grp;
      };
      const bracketed = cfg.kind === 'shangri-la';
      if (bracketed) {
        const rx = edge + (d.power === 'wired' && sx === 1 ? 0.15 : 0.07), ry = built.oy + 0.06;
        g.add(box(0.06, 0.16, 0.008, trimMat, rx, ry, 0.004));
        const rg = remote(new THREE.Group()); rg.position.set(rx, ry, 0.015); g.add(rg);
        reach = Math.max(reach, rx + 0.045);
      }
      // the phone, hub or smart speaker on the sill, by control type
      const sill = built.bottom + 0.0005, lx = -sx * (built.ow / 2 - 0.1);
      const items = [];
      if (!bracketed) items.push('remote');
      if (d.control !== 'remote-only') items.push('phone');
      if (d.control === 'zigbee') items.push('hub');
      if (d.control === 'matter') items.push('speaker');
      items.forEach((it, i) => {
        const x = lx - sx * i * 0.09;
        if (it === 'remote') {
          const rg = remote(new THREE.Group()); rg.position.set(x, sill + 0.058, 0.05); rg.rotation.x = -0.28; g.add(rg);
        } else if (it === 'phone') {
          const ph = new THREE.Group(); ph.add(box(0.062, 0.12, 0.008, motorMat, 0, 0, 0)); ph.add(plane(0.054, 0.108, screenMat, 0, 0, 0.0045));
          ph.position.set(x, sill + 0.058, 0.05); ph.rotation.x = -0.28; g.add(ph);
        } else if (it === 'hub') {
          const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 24), trimMat); hb.position.set(x, sill + 0.01, 0.045); g.add(hb);
        } else {
          const sp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.1, 24), speakerMat); sp2.position.set(x, sill + 0.05, 0.045); g.add(sp2);
        }
      });
    }
    scene.add(g); accessory = g;
    const base = built.fit0, need = reach ? 2 * (reach + 0.04) * 1.04 : 0;
    built.fit = { ...base, w: Math.max(base.w, need) };
    fitCamera();
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
    const geometryChanged = ['w', 'h', 'mount', 'tight'].some((k) => n[k] != null && n[k] !== cfg[k]);
    const shadesChanged = geometryChanged || ['kind', 'cover'].some((k) => n[k] != null && n[k] !== cfg[k]) || (n.drive && JSON.stringify(n.drive) !== JSON.stringify(cfg.drive))
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
