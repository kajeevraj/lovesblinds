// The three.js side of the product-page preview: ONE window, built to the size the customer typed, on a plaster wall with soft light.
//
//   const ctrl = createPreviewScene(canvas, { onLayout });
//   ctrl.configure({ kind, width, height, mount, drive: { movement, power, solar, control, side }, cover, layers: [{ fabric, optics }, ...], amount })   // inches in, anything may be left out
//   ctrl.snapAmount(a, moverIndex)   ctrl.moveTo(a, moverIndex)   ctrl.setVanes(bool)   ctrl.resize(cssW, cssH, dpr)   ctrl.setActive(bool)   ctrl.dispose()
//
// `kind` is roller, zebra, cellular, roman or shangri-la; `style` is the cellular type or the roman style. A "mover" is a part the customer moves: a shade's
// bottom bar, or (cellular top-down/bottom-up and day & night) its bottom rail and its upper rail. amounts[] has one position per mover.
//
// Inside mount: the window opening is the shade's size, the shade sits in the recess. Outside mount: the shade is the size typed and overlaps a
// smaller window and its trim. A bead chain, a motor with its charging port or cord, and the optional center handle are drawn the way the choices say. Double-stack is two shades one in front of the other.
// The camera always fits the whole window with room for the size labels, whatever the size, and `onLayout` reports where the shade is on screen
// (CSS pixels) so the page can place the size labels and the drag handle. Draws only when something changed, only while on screen.
import * as THREE from 'three';
import { createShade } from './models/shade.js';
import { shadowMesh, rampTexture, blobTexture } from './models/common.js';
import { plasterTexture, skyTexture, washTexture } from './backdrop.js';
import { HOVER_AMP } from './dreamLayout.js';

const IN = 0.0254;
const TRIM = 0.075, DEPTH = 0.09, FOV = 26;
const MIN_IN = 12, MAX_IN = 300;
export const clampInches = (v) => Math.min(MAX_IN, Math.max(MIN_IN, v));

// a light oak plank floor: planks 13 cm wide running away from the window, each in a slightly different tone with soft grain and its own joints. One tile is 1.6 m square.
function floorTexture() {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const planks = 12, pw = N / planks;
  for (let i = 0; i < planks; i++) {
    const cuts = [0]; let y = rnd() * N * 0.3; while (y < N * 0.95) { cuts.push(Math.round(y)); y += N * (0.45 + 0.4 * rnd()); } cuts.push(N);
    for (let j = 0; j < cuts.length - 1; j++) {
      const y0 = cuts[j], y1 = cuts[j + 1], t = rnd(), r = 226 + t * 5, g = 201 + t * 5, b = 164 + t * 6;
      x.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; x.fillRect(i * pw, y0, pw, y1 - y0);
      for (let k = 0; k < 10; k++) { x.strokeStyle = `rgba(${130 + rnd() * 30 | 0},${104 + rnd() * 25 | 0},${70 + rnd() * 20 | 0},${0.03 + rnd() * 0.05})`; x.lineWidth = 0.6 + rnd() * 1.6; const gx = i * pw + rnd() * pw; x.beginPath(); x.moveTo(gx, y0); x.lineTo(gx + (rnd() - 0.5) * 6, y1); x.stroke(); }
      x.fillStyle = 'rgba(100,80,52,0.07)'; x.fillRect(i * pw, y0, pw, 1);
    }
    x.fillStyle = 'rgba(100,80,52,0.2)'; x.fillRect(i * pw, 0, 1.5, N);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function createPreviewScene(canvas, { onLayout, onAmount, onDrive, onVanes } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const env = {
    invalidate: () => wake(), maxAniso: Math.min(16, renderer.capabilities.getMaxAnisotropy()),
    backlight: new THREE.Color(0.62, 0.62, 0.62),         // less daylight through the cloth than in the room: here the color has to be accurate
    glowTop: { value: new THREE.Vector3(1, 1, 1) }, glowBottom: { value: new THREE.Vector3(0.78, 0.78, 0.78) },       // daylight through the cloth: brighter at the top, never tinted
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
  // The lights are neutral white, so the cloth is lit without a tint (a white shade is white, not cream). The room keeps its warm color: the wall is unlit (below)
  // and the trim and jambs carry the warmth in their own colors.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(-2.6, 2.4, 4.4); scene.add(sun);
  const plaster = plasterTexture(env.maxAniso), sky = skyTexture(), wash = washTexture();
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xfffbed, roughness: 0.5 });       // (these colors are what the old warm light made of the old base colors)
  const jambMat = new THREE.MeshStandardMaterial({ color: 0xe9e0cd, roughness: 0.7 });
  const jambTopMat = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.8 });
  const WALL = 0xf3ede2, ROOM_DIM = 0.1; let wallDim = 0;
  const wallMat = new THREE.MeshBasicMaterial({ color: WALL, toneMapped: false });          // plain, evenly lit
  const glassMat = new THREE.MeshBasicMaterial({ map: sky, toneMapped: false });
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xd6cebd, metalness: 0.35, roughness: 0.4 });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x2b2824, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });          // the chain's soft outline (opposite lightness)
  const plasticMat = new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.5 });
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x6b6458, roughness: 0.7 });
  // the solar panel is stuck on the glass, behind the cloth: it shows only below the lowest shade's bottom edge (a clip plane that follows the shade),
  // so no fabric (transparent or not) ever has it drawn over or through it
  renderer.localClippingEnabled = true;
  // (a top-down shade also leaves the glass ABOVE its top rail bare: the panel is hidden only between the cloth's top and bottom edges)
  const solarClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e3), solarClipTop = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1e3);
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x3a404c, roughness: 0.5, metalness: 0.1, clippingPlanes: [solarClip, solarClipTop], clipIntersection: true });

  // vignette: the corners of the picture fall off a little, like the room photo
  const vig = new THREE.Scene(), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  vig.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = distance(vUv, vec2(0.5, 0.46)); gl_FragColor = vec4(0.11, 0.075, 0.04, smoothstep(0.45, 1.0, d) * 0.09); }',
  })));
  vig.children[0].frustumCulled = false;

  const cfg = { dream: null, tight: false, kind: 'roller', style: 'none', w: 1, h: 1.5, mount: 'inside', drive: { movement: 'chain', side: 'right' }, cover: 'wrapped', layers: [], amounts: [0.55], extras: {} };
  // every shade has its own position: amounts[i] is where it is going, current[i] where it is now (0 raised, 1 fully lowered); layers[0] is the front shade
  let built = null, shades = [], movers = [], current = [0.55], size = { w: 2, h: 2 }, active = false, raf = 0, dirty = true, last = 0, reduced = false, slow = 0, dprCap = 2;
  let dispDpr = 1;

  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const plane = (w, h, mat, x, y, z, rx = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); return m; };

  // ---- Dream Curtains hang on a SLIDING GLASS DOOR (that is where people put them): a tall opening to the floor, two or three glass panels with slim frames, a handle,
  // a floor and a baseboard, and the soft view outside. The curtain's top is at the top of the typed height and it clears the floor by 2.5 cm.
  function buildDoor() {
    if (built) { scene.remove(built.group); built.group.traverse((o) => { o.geometry?.dispose(); if (o.material && o.userData.own) o.material.dispose(); }); }
    const { w, h, mount } = cfg, g = new THREE.Group(), inside = mount === 'inside', CLEAR = 0.025;
    const ow = inside ? w : Math.max(0.6, w - 0.25), top = inside ? h / 2 : h / 2 - 0.22, floorY = -h / 2, bottom = floorY, oh = top - bottom, oy = (top + bottom) / 2;
    const R = Math.max(w, h) * 3 + 3, shape = new THREE.Shape([new THREE.Vector2(-R, floorY - 0.5), new THREE.Vector2(R, floorY - 0.5), new THREE.Vector2(R, R), new THREE.Vector2(-R, R)]);
    shape.holes.push(new THREE.Path([new THREE.Vector2(-ow / 2, bottom), new THREE.Vector2(-ow / 2, top), new THREE.Vector2(ow / 2, top), new THREE.Vector2(ow / 2, bottom)]));
    g.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), wallMat));
    g.add(box(ow + 2 * TRIM, TRIM, 0.02, trimMat, 0, top + TRIM / 2, 0.01));                                             // head trim
    for (const sx of [-1, 1]) g.add(box(TRIM * 0.8, oh, 0.02, trimMat, sx * (ow / 2 + TRIM * 0.4), oy, 0.01));            // side trim (no sill and no apron: it is a door)
    g.add(plane(ow, DEPTH, jambTopMat, 0, top, -DEPTH / 2, Math.PI / 2));
    for (const sx of [-1, 1]) g.add(plane(DEPTH, oh, jambMat, sx * ow / 2, oy, -DEPTH / 2, 0, sx * -Math.PI / 2));
    // the floor, and the baseboard either side of the door
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.7 }); floorMat.userData.own = true;
    floorMat.map.repeat.set(R * 2 / 1.6, 14 / 1.6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, 14), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, floorY, 7 - DEPTH); g.add(floor);
    const contact = shadowMesh(rampTexture([[0, 1], [1, 0]]), 0.25); contact.rotation.x = -Math.PI / 2; contact.scale.set(ow + 0.2, 0.18, 1); contact.position.set(0, floorY + 0.002, 0.09 - DEPTH * 0.0); g.add(contact);
    const sideW = Math.max(0.1, R - ow / 2 - TRIM * 0.8);
    for (const sx of [-1, 1]) g.add(box(sideW, 0.09, 0.016, trimMat, sx * (ow / 2 + TRIM * 0.8 + sideW / 2), floorY + 0.045, 0.008));
    // the glass and the view
    const gz = -DEPTH + 0.03, frameMat = new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.45, metalness: 0.2 }); frameMat.userData.own = true;
    g.add(plane(ow, oh, glassMat, 0, oy, gz - 0.02));
    g.add(box(ow, 0.05, 0.07, frameMat, 0, top - 0.025, gz)); g.add(box(ow, 0.035, 0.1, frameMat, 0, floorY + 0.0175, gz));                       // head and the track along the floor
    const n = ow > 2.4 ? 3 : 2, ov = 0.06, pw = (ow + (n - 1) * ov) / n;
    for (let i = 0; i < n; i++) {                                                                                                    // sliding panels: each in its own depth, overlapping a little
      const cx = -ow / 2 + pw / 2 + i * (pw - ov), pz = gz + (i % 2 ? 0.024 : -0.016), top2 = top - 0.05, h2 = top2 - (floorY + 0.035);
      for (const sx of [-1, 1]) g.add(box(0.05, h2, 0.04, frameMat, cx + sx * (pw / 2 - 0.025), floorY + 0.035 + h2 / 2, pz));
      g.add(box(pw, 0.05, 0.04, frameMat, cx, top2 - 0.025, pz)); g.add(box(pw, 0.11, 0.04, frameMat, cx, floorY + 0.035 + 0.055, pz));
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.1, h2 - 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, depthWrite: false, toneMapped: false })); pane.position.set(cx, floorY + 0.035 + h2 / 2 + 0.03, pz + 0.021); pane.userData.own = true; g.add(pane);
    }
    const hx = -ow / 2 + (n === 2 ? pw - ov : 2 * (pw - ov)) + 0.02;                                                                  // a slim handle on the meeting stile of the front panel
    g.add(box(0.02, 0.24, 0.03, new THREE.MeshStandardMaterial({ color: 0x77746d, roughness: 0.4, metalness: 0.4 }), hx, floorY + 1.0, gz + 0.05));
    const sh = shadowMesh(rampTexture([[0, 1], [1, 0]]), 0.3); sh.scale.set(ow - 0.1, 0.16, 1); sh.position.set(0, top - 0.13, gz + 0.03); g.add(sh);
    scene.add(g);
    built = { group: g, ow, oh, oy, top, bottom };
    built.shade = { w: inside ? ow : w, h: h - CLEAR, x: 0, top: h / 2, z: inside ? -0.032 : 0.05 };
    const topExt = h / 2 + TRIM + 0.08, botExt = floorY - 0.2, bw = inside ? ow + 2 * TRIM * 0.8 + 0.08 : w;
    const wide = cfg.tight ? 1.4 : 1.55, tall = cfg.tight ? 1.04 : 1.1;
    built.fit = { w: bw * wide, h: (topExt - botExt) * tall, cy: (topExt + botExt) / 2 }; built.fit0 = built.fit;
    built.shadeBottom = floorY; built.labelY = floorY - 0.14; built.floorEdge = floorY;
    fitCamera();
  }

  // ---- the window, the trim and the wall (rebuilt when the size or the mount changes) ---------------------------------------------------------------
  function buildWindow() {
    if (cfg.kind === 'dream') { buildDoor(); return; }
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
    const cy = built.floorEdge != null ? Math.max(built.fit.cy, built.floorEdge + 0.7 * t * d) : built.fit.cy;      // a door: about an eighth of the picture is floor, the rest goes to the wall above
    camera.aspect = aspect; camera.position.set(0, cy, d); camera.lookAt(0, cy, 0); camera.updateProjectionMatrix();
    env.pxPerMeter = size.h / (2 * d * t);                       // css pixels per metre at the shade (the weave is sized to read at this scale)
    shades.forEach((sh) => sh.applyScale?.());
  }

  // ---- the shades (one, or two for double-stack) and the control ------------------------------------------------------------------------------------
  let accessory = null, xrayMats = [], driveDirs = [], hasSolar = false;
  const xray = { target: 0, v: 0 }, vane = { target: 0, v: 0, p: 0, armed: true, pending: null, driveWait: 0 };
  let chainRig = null;
  const hand = { cx: 0, cy: 0, amp: 0, vel: 0, target: 0, cxTo: 0 };            // Dream Curtains: a hand pressed into the strips (amp 0..1, a spring: it swings back when let go)
  function buildShades() {
    shades.forEach((s) => s.dispose()); shades = [];
    if (accessory) { scene.remove(accessory); accessory.traverse((o) => o.geometry?.dispose()); accessory = null; }
    chainRig = null;
    if (!built || !cfg.layers.length) return;
    const sp = built.shade;
    if (cfg.kind === 'roller' || cfg.kind === 'zebra') cfg.layers.forEach((layer, i) => {                                   // layers[0] is the front shade, the last one the back
      const s = createShade(cfg.kind, env);
      s.setSize(sp.w, sp.h); s.setCover(cfg.cover); s.setFabric(layer.fabric, layer.optics); s.setRailColor(cfg.extras?.railHex);
      s.group.position.set(sp.x, sp.top, sp.z + (cfg.layers.length - 1 - i) * 0.058);
      scene.add(s.group); shades.push(s);
    });
    else if (cfg.kind === 'dream') {                                      // Dream Curtains: one track, many strips (models/dream.js)
      const s = createShade('dream', env, { style: cfg.style, stack: cfg.dream?.stack, install: cfg.dream?.install, control: cfg.dream?.control, wired: cfg.dream?.wired });
      s.setSize(sp.w, sp.h); s.setFabrics(cfg.layers);
      s.group.position.set(sp.x, sp.top, sp.z);
      scene.add(s.group); shades.push(s);
    } else {                                                               // cellular, roman, shangri-la: one shade; its layers are its cloths (day & night has two)
      const s = createShade(cfg.kind, env, { style: cfg.style });
      s.setSize(sp.w, sp.h); s.setRailColor(cfg.extras?.headHex); s.setWindow(built.ow / 2 - 0.03, built.top - 0.03 - sp.top, built.bottom + 0.04 - sp.top); s.setFabrics(cfg.layers); s.setVanes?.(vane.v);
      s.group.position.set(sp.x, sp.top, sp.z);
      scene.add(s.group); shades.push(s);
    }
    movers = []; shades.forEach((s) => { for (let k = 0; k < s.movers; k++) movers.push({ s, k }); });
    for (const arr of [current, cfg.amounts]) { arr.length = movers.length; for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) arr[i] = 0; }
    setShadeAmounts(current);
    if (cfg.kind !== 'dream') buildControl(sp);
    emit();
  }

  function buildControl(sp) {
    const d = cfg.drive, g = new THREE.Group(), n = shades.length;
    const hh = shades[0].headHeight, hd = shades[0].headDepth;          // the cassette or headrail everything hangs from
    const zOf = (i) => sp.z + (n - 1 - i) * 0.058;                       // each shade's own depth (double-stack: the back shade is further from the room)
    const sx = d.side === 'left' ? -1 : 1, endX = sx * (sp.w / 2 - 0.03);
    const reach = 0;                                                     // how far beside the window something is drawn (the camera makes room for it): nothing is drawn on the wall
    chainMat.color.set(cfg.extras?.chainHex || '#f4f1ea'); chainMat.metalness = cfg.extras?.chainMetal ? 0.7 : 0.04; chainMat.roughness = cfg.extras?.chainMetal ? 0.3 : 0.55;   // thin, true-color chain
    if (d.movement === 'chain') {
      const z = zOf(0);
      // The chain comes straight out of the end of the cassette (or headrail): no bracket and no cover over it. It leaves the underside at the very end and
      // hangs a little in front of the cloth.
      // It hangs from the cassette (or headrail) on the motor side, OUTSIDE the fabric edge, in front of the trim. A real bead chain is thin; here the beads are drawn a little larger
      // (about 14 mm) so they read as beads at normal size, with a soft outline of the opposite lightness so a white chain shows on a light fabric and a dark chain on a dark one.
      const endX = sx * (sp.w / 2 + 0.034), cz = Math.max(z + 0.022, 0.05), y0 = sp.top - hh + 0.002;          // (in front of the trim, so it is never hidden by it)
      const pitch = 0.0165, rad = 0.0072, len0 = Math.min(sp.h * 0.55, 1.0), beads = Math.max(8, Math.round(len0 / pitch)), len = beads * pitch, step = pitch, dx = 0.013;
      chainRig = { endX, y0, cz, len, beads, step, dx, travel: sp.h * 0.8, mesh: null, halo: null };
      const lumOf = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
      const lightChain = lumOf(cfg.extras?.chainHex || '#f4f1ea') > 0.35;
      haloMat.color.set(lightChain ? 0x2b2824 : 0xf6f3ea); haloMat.opacity = lightChain ? 0.5 : 0.62;
      if (cfg.extras?.cordLoop) {                                        // a soft cord loop (Cellular and Roman): two smooth cords in the chosen color, no beads
        for (const k of [0, 1]) {
          const x = endX + (k ? dx : -dx), zz = cz + 0.004 + (k ? 0.004 : 0);
          const h = new THREE.Mesh(new THREE.CylinderGeometry(0.0066, 0.0066, len, 8), haloMat); h.position.set(x, y0 - len / 2, zz - 0.002); g.add(h);
          const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, len, 8), chainMat); c.position.set(x, y0 - len / 2, zz); g.add(c);
        }
      } else {
        const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(rad, 12, 8), chainMat, beads * 2), halo = new THREE.InstancedMesh(new THREE.SphereGeometry(rad * 1.38, 10, 7), haloMat, beads * 2);
        mesh.frustumCulled = false; halo.frustumCulled = false; halo.renderOrder = 1; chainRig.mesh = mesh; chainRig.halo = halo; g.add(halo, mesh);
      }
      g.add(box(0.026, 0.03, 0.016, plasticMat, endX, y0 - len - 0.014, cz + 0.006));            // the weight that keeps the loop tight
    } else if (d.movement === 'zero-gravity') {
      // nothing hangs down: the center handle is drawn on the page (a button on the bottom rail), so it is always visible and can be dragged
    } else if (d.movement === 'motorized' || d.movement === 'two-in-one') {
      xrayMats = [];
      shades.forEach((sh, i) => {                                         // a motor in every shade (double-stack: two), hidden inside the roller
        const z = zOf(i);
        // a soft, thin outline of the motor inside the roller tube, on the chosen side: just darker than the cassette, low opacity
        const len = 0.27, cx = sx * (sp.w / 2 - 0.02 - len / 2);
        const mr = Math.min(0.017, hh * 0.3), body = new THREE.CylinderGeometry(mr, mr, len, 20); body.rotateZ(Math.PI / 2);
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(body), new THREE.LineBasicMaterial({ color: 0x3a3228, transparent: true, opacity: 0, depthTest: false, toneMapped: false }));
        lines.position.set(cx, sp.top - hh / 2, z); lines.renderOrder = 20; g.add(lines);
        xrayMats.push([lines.material, 0.2]);
        if (d.movement === 'two-in-one' || d.power === 'battery') g.add(box(0.005, 0.005, 0.001, motorMat, endX, sp.top - hh * 0.78, z + hd / 2 + 0.0005));   // the charging port: a tiny, barely visible dot
      });
      if (d.movement === 'motorized' && d.power === 'battery' && d.solar) {                             // a small, dark, thin solar panel on the glass near the top on the motor side (behind the shade)
        const gz = -DEPTH + 0.03 - 0.02 + 0.006;
        const panel = box(0.07, 0.1, 0.003, solarMat, sx * (sp.w / 2 - 0.09), sp.top - 0.2, gz); panel.renderOrder = -1; g.add(panel);
      }
    }
    scene.add(g); accessory = g; updateChain();
    applyXray();
    const base = built.fit0, need = reach ? 2 * (reach + 0.04) * 1.04 : 0;
    built.fit = { ...base, w: Math.max(base.w, need) };
    fitCamera();
  }

  // ---- Shangri-La vanes: they open by themselves when the shade reaches the bottom, and close (the same movement run backwards, same speed) before it rises ----
  const VANE_T = 0.8, VANE_K = 5, vaneEase = (p) => (1 - Math.exp(-VANE_K * p)) / (1 - Math.exp(-VANE_K));
  const isSL = () => cfg.kind === 'shangri-la';
  const vaneNote = () => onVanes?.(vane.target === 1);
  const closeVanesFirst = () => { vane.target = 0; vaneNote(); };
  const vaneAuto = () => {
    if (!isSL()) return;
    const a = current[0] ?? 0;
    if (a < 0.95) vane.armed = true;
    else if (a >= 0.995 && vane.armed && vane.target === 0 && vane.pending == null) { vane.target = 1; vane.armed = false; vaneNote(); }
  };
  const holdsForVanes = (i, a) => isSL() && i === 0 && vane.p > 0 && a < (current[0] ?? 0) - 1e-6;
  // the chain: its beads run round the loop as the shade moves (a strand pulled down goes round, the other comes up)
  function updateChain() {
    const c = chainRig; if (!c || !c.mesh) return;
    const off = (current[0] ?? 0) * c.travel, m = new THREE.Matrix4();
    for (let i = 0; i < c.beads; i++) for (const k of [0, 1]) {
      const y = ((i * c.step + (k ? off : -off)) % c.len + c.len) % c.len;
      const x = c.endX + (k ? c.dx : -c.dx), zz = c.cz + 0.004 + (k ? 0.004 : 0);
      m.makeTranslation(x, c.y0 - y, zz); c.mesh.setMatrixAt(i * 2 + k, m);
      if (c.halo) { m.makeTranslation(x, c.y0 - y, zz - 0.0035); c.halo.setMatrixAt(i * 2 + k, m); }
    }
    c.mesh.instanceMatrix.needsUpdate = true; if (c.halo) c.halo.instanceMatrix.needsUpdate = true;
  }

  function applyXray() { for (const [m, max] of xrayMats) m.opacity = xray.v * max; }

  function emit() {
    if (!built || !shades.length) { onLayout?.(null); return; }
    const sp = built.shade, v = new THREE.Vector3(), pts = [[-sp.w / 2, sp.top], [sp.w / 2, sp.top], [sp.w / 2, sp.top - sp.h], [-sp.w / 2, sp.top - sp.h]];
    const xs = [], ys = [];
    for (const [x, y] of pts) { v.set(x, y, sp.z + 0.03).project(camera); xs.push(((v.x + 1) / 2) * size.w); ys.push(((1 - v.y) / 2) * size.h); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    v.set(0, built.labelY ?? built.shadeBottom - 0.024 - TRIM * 0.8 - 0.07, 0.03).project(camera);
    // where each shade's handle (or bottom bar) is on screen: a single shade at the center, a double-stack's front shade at 40% of the width and the back at 60%
    // (a shade with two rails has both handles at the center, one on each rail)
    const n = shades.length, xAt = (i) => (n > 1 ? x0 + (i === 0 ? 0.4 : 0.6) * (x1 - x0) : (x0 + x1) / 2);
    const handles = movers.map((m, i) => ({ x: xAt(i), y: Math.min(y1, y0 + m.s.handleAt(m.k) * (y1 - y0)) }));
    // two rails of one shade that are close together (day & night switched to the day cloth, a top-down shade nearly closed): their handles move apart
    // sideways, the upper rail's to the left and the bottom rail's to the right, so both are easy to grab
    let near = 0;
    if (n === 1 && handles.length === 2) {
      near = Math.min(1, Math.max(0, (60 - Math.abs(handles[0].y - handles[1].y)) / 16));
      const dx = near * Math.min(38, (x1 - x0) * 0.22);
      handles[0].x += dx; handles[1].x -= dx;
    }
    // the back shade's bar is hidden when it is not lower than the front shade's
    const hidden = movers.map((_, i) => n > 1 && i > 0 && (current[i] ?? 0) <= (current[0] ?? 0) + 0.004);
    let chain = null;
    if (chainRig) {
      const c = chainRig, a = new THREE.Vector3(c.endX, c.y0, c.cz + 0.006).project(camera), b = new THREE.Vector3(c.endX, c.y0 - c.len - 0.02, c.cz + 0.006).project(camera);
      const px = ((a.x + 1) / 2) * size.w, ya = ((1 - a.y) / 2) * size.h, yb = ((1 - b.y) / 2) * size.h;
      chain = { x: px, top: ya, bottom: yb, pxPerM: (yb - ya) / (c.len + 0.02), travelM: c.travel };
    }
    let dream = null;
    if (cfg.kind === 'dream' && shades[0]?.leads) {
      const sh = shades[0], P = (x, y, z) => { v.set(sp.x + x, sp.top + y, sp.z + z).project(camera); return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h }; };
      const lead = sh.leads().map((l) => ({ x: P(l.edgeX, -0.03, l.z).x, opens: l.opens })), ya = P(0, -0.03, 0.05).y, yb = P(0, -sp.h, 0.05).y;
      dream = { leads: lead, pxPerM: (yb - ya) / (sp.h - 0.03), travelM: sh.travelOf(), stack: cfg.dream?.stack || 'right', top: ya, bottom: yb, rod: null };
      if (sh.rodInfo && cfg.dream?.control === 'pull-rod') { const r = sh.rodInfo, a0 = P(r.x, -r.top, r.z), a1 = P(r.x, -(r.top + r.len + 0.07), r.z); dream.rod = { x: a0.x, y0: a0.y, y1: a1.y }; }
    }
    onLayout?.({ chain, dream, labelY: ((1 - v.y) / 2) * size.h, x0, x1, y0, y1, handle: handles[0], handles, hidden, near, canvasW: size.w, canvasH: size.h });
  }

  // ---- configuration ----------------------------------------------------------------------------------------------------------------------------------
  function configure(next) {
    const n = { ...next };
    if (n.width != null) n.w = clampInches(n.width) * IN;
    if (n.height != null) n.h = clampInches(n.height) * IN;
    delete n.width; delete n.height;
    const extrasChanged = n.extras && JSON.stringify(n.extras) !== JSON.stringify(cfg.extras);
    const geometryChanged = ['w', 'h', 'mount', 'tight'].some((k) => n[k] != null && n[k] !== cfg[k]) || (n.kind != null && (n.kind === 'dream') !== (cfg.kind === 'dream'));
    const shadesChanged = geometryChanged || extrasChanged || ['kind', 'cover', 'style'].some((k) => n[k] != null && n[k] !== cfg[k]) || (n.drive && JSON.stringify(n.drive) !== JSON.stringify(cfg.drive)) || (n.dream && JSON.stringify(n.dream) !== JSON.stringify(cfg.dream))
      || (n.layers && JSON.stringify(n.layers.map((l) => [l.fabric?.key, l.optics])) !== JSON.stringify(cfg.layers.map((l) => [l.fabric?.key, l.optics])));
    const driveChanged = n.drive && JSON.stringify(n.drive) !== JSON.stringify(cfg.drive);
    Object.assign(cfg, Object.fromEntries(Object.entries(n).filter(([, v]) => v != null)));
    if (driveChanged) { xray.target = ['motorized', 'two-in-one'].includes(cfg.drive.movement) ? 1 : 0; driveDirs = []; }
    if (n.amounts) { cfg.amounts = n.amounts.slice(); if (geometryChanged || shadesChanged || !shades.length) current = n.amounts.slice(); }
    if (n.vanes != null) vane.target = n.vanes ? 1 : 0;
    if (cfg.kind !== 'shangri-la' && (vane.p || vane.target)) { vane.target = 0; vane.p = vane.v = 0; vane.pending = null; vane.driveWait = 0; vaneNote(); }
    if (geometryChanged || !built) buildWindow();
    if (shadesChanged || geometryChanged || !shades.length) buildShades();
    wake();
  }
  function setShadeAmounts(a) {
    let i = 0;
    for (const s of shades) { if (s.movers > 1) s.setAmounts(a.slice(i, i + s.movers)); else s.setAmount(a[i] ?? a[0] ?? 0); i += s.movers; }
    // a blackout cloth (cellular blackout, a roman's blackout lining) makes the room a little dimmer as it comes down: the wall, never the cloth's own face
    updateChain();
    const dim = Math.max(0, ...shades.map((s) => s.dim || 0));
    if (Math.abs(dim - wallDim) > 0.002) { wallDim = dim; wallMat.color.set(WALL).multiplyScalar(1 - ROOM_DIM * dim); }
    if (built?.shade && shades.length) {                                 // the panel is hidden between these two heights (the glass the cloth covers)
      solarClip.constant = Math.min(...shades.map((s) => built.shade.top - s.span.bottom));
      solarClipTop.constant = -Math.min(...shades.map((s) => built.shade.top - s.span.top));
    }
  }
  // two rails of one shade never cross: the one that moves pushes the other (models/soft.js constrain)
  function constrain(arr, i) {
    const m = movers[i]; if (!m || !m.s.constrain) return;
    const base = i - m.k, vals = m.s.constrain(arr.slice(base, base + m.s.movers), m.k);
    for (let k = 0; k < vals.length; k++) arr[base + k] = vals[k];
  }
  function snapAmount(a, i = 0) { if (i >= movers.length) return current.slice(); if (holdsForVanes(i, a)) { vane.pending = a; closeVanesFirst(); wake(); return current.slice(); } driveDirs[i] = 0; if (i === 0) vane.pending = null; cfg.amounts[i] = current[i] = a; constrain(current, i); constrain(cfg.amounts, i); setShadeAmounts(current); vaneAuto(); emit(); wake(); return current.slice(); }
  // glide to a position (the Day and Night buttons, Open vanes, Raise and Lower)
  function moveTo(a, i = 0) { if (i >= movers.length) return; if (holdsForVanes(i, a)) { vane.pending = Math.min(1, Math.max(0, a)); closeVanesFirst(); wake(); return; } driveDirs[i] = 0; if (i === 0) vane.pending = null; cfg.amounts[i] = Math.min(1, Math.max(0, a)); constrain(cfg.amounts, i); wake(); }

  // ---- loop -----------------------------------------------------------------------------------------------------------------------------------------------
  const wake = () => { dirty = true; if (active && !raf) raf = requestAnimationFrame(frame); };
  function frame(t) {
    raf = 0; if (!active) return;
    const raw = last ? (t - last) / 1000 : 0.016, dt = Math.min(0.05, raw); last = t;          // (the vanes keep real time, so a slow frame does not slow them)
    let moving = false;
    if (Math.abs(xray.target - xray.v) > 0.003) { xray.v += (xray.target - xray.v) * (reduced ? 1 : 1 - Math.exp(-dt * 5)); applyXray(); dirty = true; moving = true; }
    else if (xray.v !== xray.target) { xray.v = xray.target; applyXray(); dirty = true; }
    const pT = vane.target ? 1 : 0;
    if (vane.p !== pT) { vane.p = reduced ? pT : (pT > vane.p ? Math.min(pT, vane.p + Math.min(0.25, raw) / VANE_T) : Math.max(pT, vane.p - Math.min(0.25, raw) / VANE_T)); vane.v = vaneEase(vane.p); dirty = true; moving = true; shades.forEach((s) => s.setVanes?.(vane.v)); }
    if (isSL()) {                                                          // the shade waits until the vanes have closed, then goes where it was asked to
      if (vane.p <= 0 && vane.pending != null) { cfg.amounts[0] = vane.pending; vane.pending = null; }
      if (vane.p <= 0 && vane.driveWait) { driveDirs[0] = vane.driveWait; vane.driveWait = 0; }
    }
    let shifted = false;
    movers.forEach((mv, i) => {
      if (driveDirs[i]) {                                                  // the remote: steady motor speed, about 10 in a second, until it reaches the end or Stop
        const travel = mv.s.travelOf(mv.k);
        cfg.amounts[i] = Math.min(1, Math.max(0, cfg.amounts[i] + driveDirs[i] * (0.254 / travel) * dt)); current[i] = cfg.amounts[i];
        constrain(cfg.amounts, i); constrain(current, i);
        moving = true; dirty = true; shifted = true;
        if (cfg.amounts[i] <= 0 || cfg.amounts[i] >= 1) { driveDirs[i] = 0; onDrive?.(0, i); }
      } else if (Math.abs(cfg.amounts[i] - current[i]) > 0.0008) {
        current[i] += (cfg.amounts[i] - current[i]) * (reduced ? 1 : 1 - Math.exp(-dt * 14)); moving = true; dirty = true; shifted = true;
      } else if (current[i] !== cfg.amounts[i]) { current[i] = cfg.amounts[i]; dirty = true; shifted = true; }
    });
    if (cfg.kind === 'dream' && shades[0]?.setPush && (hand.target || Math.abs(hand.amp) > 0.0008 || Math.abs(hand.vel) > 0.002)) {
      if (reduced) { hand.amp = hand.target; hand.vel = 0; }
      else {
        hand.vel += (220 * (hand.target - hand.amp) - 15 * hand.vel) * dt; hand.amp += hand.vel * dt; hand.amp = Math.max(-0.15, Math.min(1.05, hand.amp));
        if (!hand.target && Math.abs(hand.amp) < 0.0008 && Math.abs(hand.vel) < 0.002) { hand.amp = 0; hand.vel = 0; }
      }
      if (Math.abs(hand.cxTo - hand.cx) > 0.0005) { hand.cx += (hand.cxTo - hand.cx) * (reduced ? 1 : 1 - Math.exp(-dt * 16)); moving = true; }
      shades[0].setPush(hand); dirty = true;
      if (Math.abs(hand.target - hand.amp) > 0.001 || Math.abs(hand.vel) > 0.002) moving = true;
    }
    if (shifted) { setShadeAmounts(current); vaneAuto(); emit(); onAmount?.(current.slice()); }
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
    if (moving) { if (!raf) raf = requestAnimationFrame(frame); } else last = 0;
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
    configure, snapAmount, moveTo, resize,
    pendingAmount: () => vane.pending,
    setVanes(on) { if (on && (current[0] ?? 0) < 0.995) return; vane.target = on ? 1 : 0; vane.armed = false; vaneNote(); wake(); }, get vanes() { return vane.v; },
    handleFraction: (i = 0) => (movers[i] ? movers[i].s.handleAt(movers[i].k) : 0), amountAt: (i, f) => (movers[i] ? movers[i].s.amountAt(movers[i].k, f) : 0), driving: (i = 0) => driveDirs[i] || 0,
    drive(dir, i = 0) { if (i >= movers.length) return; if (i === 0) { vane.pending = null; vane.driveWait = 0; if (dir < 0 && isSL() && vane.p > 0) { vane.driveWait = -1; closeVanesFirst(); wake(); return; } } driveDirs[i] = (dir > 0 && current[i] >= 1) || (dir < 0 && current[i] <= 0) ? 0 : dir; if (!dir) cfg.amounts[i] = current[i]; emit(); wake(); },
    // Dream Curtains: a hand pressed at (nx, ny) (0..1 across and down the curtain; down = pressed) parts the strips there, and they swing back when it lets go
    // mode: true = pressed (parts the strips under the hand), 'hover' = a cursor over the curtain (the nearest joint opens a little), false = let go
    push(nx, ny, mode = true) {
      const sp = built?.shade; if (cfg.kind !== 'dream' || !sp || !shades[0]) return;
      const cx = (Math.min(1, Math.max(0, nx)) - 0.5) * sp.w, hover = mode === 'hover';
      hand.cxTo = hover ? shades[0].jointAt(cx) : cx; hand.cy = Math.min(1, Math.max(0, ny)) * sp.h;
      if (mode && !hand.target && !hand.amp) hand.cx = hand.cxTo;
      hand.target = mode === true ? 1 : hover ? HOVER_AMP : 0;
      if (!mode && reduced) hand.amp = 0;
      shades[0].setPush(hand); wake();
    },
    get hand() { return { ...hand }; }, dreamStrips: (y) => (shades[0]?.stripXs ? shades[0].stripXs(y) : []),
    setXray(on) { xray.target = on ? 1 : 0; emit(); wake(); }, setActive, setReducedMotion: (v) => { reduced = !!v; },
    get amounts() { return current.slice(); }, get shadeHeight() { return built?.shade.h || cfg.h; },
    dispose() {
      setActive(false); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      shades.forEach((s) => s.dispose()); renderer.dispose();
    },
  };
}
