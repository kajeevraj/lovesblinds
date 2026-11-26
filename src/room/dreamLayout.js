// Dream Curtains, the numbers: the shape of one strip, where every strip is for a given opening, and how a hand pushes them apart. Pure (no three.js): the 3D model
// (models/dream.js), the page's handles (PreviewPane.jsx) and the offline tests all read the same numbers.
//
// WHAT A DREAM CURTAIN IS: a track with many vertical strips hanging side by side, every strip the same single piece of sheer fabric (no alternating sheer and solid).
// Each strip is curved: seen from above it is one soft wave, so the closed curtain reads as a row of gentle vertical curves.
//
// THE STRIP (how the supplier's sizes are read). Style A is 41 cm and style B 33 cm: the strip LAID FLAT (the handoff notes say so: they are not what hangs in the
// window). The supplier splits that width in three: A 12.5 / 16 / 12.5 cm, B 10 / 13 / 10 cm: two outer wings and a centre. Hung, the strip is a wave whose arc length is
// that flat width: the two wings curve back towards the window, the centre bulges towards the room, and the tangent is level where one strip meets the next (so the closed
// curtain is a smooth row of waves). The strip's hanging width (its pitch along the track) is HANG_RATIO of its flat width: A about 29 cm, B about 23 cm. That ratio is
// the one number in here that is a reading and not a supplier figure; it sets how deep the wave is (A about 11 cm, B about 9 cm).

export const STRIPS = {
  A: { flat: 0.41, parts: [0.125, 0.16, 0.125] },
  B: { flat: 0.33, parts: [0.10, 0.13, 0.10] },
};
export const HANG_RATIO = 0.72;               // hanging width / flat width
export const STACK_RATIO = 0.3;               // stacked pitch / hanging pitch: how tightly an open curtain gathers
export const stripOf = (style) => STRIPS[style] || STRIPS.A;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// The strip's cross-section from above, as points (x across, z towards the room) along its flat length. The tangent angle is a smooth wave: it rises through the first
// wing, falls through the centre and returns through the second wing, so the curvature changes sign exactly where the supplier's parts meet.
export function profileOf(style, n = 24) {
  const { flat, parts } = stripOf(style), s1 = parts[0], s2 = flat - parts[2];
  const pts = (theta) => {
    const out = [{ x: 0, z: 0, s: 0 }], ds = flat / 400; let x = 0, z = 0;
    for (let i = 1; i <= 400; i++) {
      const s = (i - 0.5) * ds;
      const th = theta(s); x += Math.cos(th) * ds; z += Math.sin(th) * ds; out.push({ x, z, s: i * ds });
    }
    return out;
  };
  const thetaFor = (T) => (s) => (s <= s1 ? T * Math.sin((Math.PI * s) / (2 * s1)) : s <= s2 ? T * Math.cos((Math.PI * (s - s1)) / (s2 - s1)) : -T * Math.cos((Math.PI / 2) * ((s - s2) / (flat - s2))));
  // find the amplitude whose chord is HANG_RATIO of the flat width
  let lo = 0, hi = 1.45;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2, p = pts(thetaFor(mid)); if (p[p.length - 1].x > flat * HANG_RATIO) lo = mid; else hi = mid; }
  const T = (lo + hi) / 2, dense = pts(thetaFor(T)), chord = dense[dense.length - 1].x;
  // resample to n + 1 points evenly along the arc
  const out = [];
  for (let i = 0; i <= n; i++) { const p = dense[Math.round((i / n) * 400)]; out.push({ x: p.x - chord / 2, z: p.z, s: p.s, th: thetaFor(T)(Math.min(flat - 1e-9, p.s)) }); }
  const depth = Math.max(...out.map((p) => p.z));
  return { points: out, chord, depth, flat, amplitude: T };
}

// ---- where the strips are ---------------------------------------------------------------------------------------------------------------------------------
// `span`: the track's length; `style`: A or B; `stack`: 'left' | 'right' | 'center'; `a`: how open (0 closed, 1 fully open).
// Closed, the strips hang side by side, each as wide as its pitch. Opening moves the leading edge towards the stack; it pushes the strips in front of it, so they
// gather at the stack closer together (STACK_RATIO of the pitch) and turn a little, like leaves of a fan, and each strip is a little deeper than the one before.
export function stripCount(span, style) { return Math.max(2, Math.round(span / (profileOf(style, 4).chord))); }
export function layoutOf({ span, style = 'A', stack = 'right', a = 0, n = null } = {}) {
  const chord = profileOf(style, 4).chord, count = n || stripCount(span, style), pitch = span / count, ps = pitch * STACK_RATIO;
  const halves = stack === 'center' ? [[Math.ceil(count / 2), -1], [Math.floor(count / 2), 1]] : [[count, stack === 'left' ? -1 : 1]];   // [strips, side of the stack: -1 left, 1 right]
  const strips = []; let lead = null;
  halves.forEach(([m, side], h) => {
    if (m <= 0) return;
    // u: distance from the stack end along the track; the stack end is at -side * span / 2 for the left/right stack, and at each end of the track for a centre opening
    const edge = stack === 'center' ? side * (span / 2) : side * (span / 2);
    const dir = -side;                                                          // from the stack end towards the other end
    const lenOf = (k) => k * pitch + pitch / 2, stkOf = (k) => k * ps + ps / 2;
    const uL = lenOf(m - 1) + (stkOf(m - 1) - lenOf(m - 1)) * a;                // the leading strip's position
    for (let k = 0; k < m; k++) {
      const closed = lenOf(k), u = Math.min(closed, uL - (m - 1 - k) * ps), gathered = clamp((closed - u) / Math.max(1e-6, closed - stkOf(k)));
      strips.push({ k: strips.length, half: h, index: k, x: edge + dir * u, gathered, yaw: -dir * gathered * STACK_YAW, depth: k * 0 });
    }
    lead = lead || [];
    lead.push({ x: edge + dir * uL, half: h, side });
  });
  return { count, pitch, chord, ps, strips, lead, span };
}
export const STACK_YAW = 0.95;                  // radians (about 55 degrees): how far a strip turns when it is fully gathered

// how far the leading edge is from the closed position, as the strips' own measure: the strip pitch, so "open" means the same at any width
export const travelOf = ({ span, style = 'A', stack = 'right' } = {}) => {
  const L = layoutOf({ span, style, stack, a: 0 }), m = stack === 'center' ? Math.ceil(L.count / 2) : L.count;
  return Math.max(0.1, (m - 1) * (L.pitch - L.ps));
};

// ---- the hand ---------------------------------------------------------------------------------------------------------------------------------------------
// A press at (cx, cy) (metres across the curtain from its centre, and down from the track) with strength `amp` (0..1) parts the strips there: each strip beside the hand
// is pushed sideways away from it and turned, most at the hand's height and reaching up to the track, where they hang. Returns what to add to one strip at height y.
export const PUSH = { reach: 0.46, shift: 0.3, yaw: 0.85, height: 0.34 };
export function pushOf({ cx, cy, amp }, stripX, y) {
  if (!amp) return { dx: 0, yaw: 0 };
  const d = stripX - cx, w = 1 - smooth(0, PUSH.reach, Math.abs(d)), side = Math.tanh(d / 0.05);
  const g = Math.exp(-(((y - cy) / PUSH.height) ** 2)) * smooth(0, 0.3, y);       // y: metres down from the track; the strips hang from it
  return { dx: side * w * g * amp * PUSH.shift, yaw: side * w * g * amp * PUSH.yaw };
}
