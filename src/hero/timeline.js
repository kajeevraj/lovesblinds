// The scroll story as a pure function: scroll position (in "screens") -> what the scene and the words should look like.
// No DOM and no three.js in here, so it can be tested and the same numbers drive the 3D scene, the text and the progress list.
//
//   intro hold  ->  [product 0: blind comes down -> hold]  ->  [slide to next -> blind comes down -> hold] x (n-1)  ->  pull back
//
// u runs from 0 to total(n). One unit is one screen of scrolling.
const INTRO = 0.45;
const SLIDE = 0.35;
const DROP = 0.5;
const HOLD = 0.15;
const PULL = 0.9;
const END_HOLD = 0.3;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOutCubic = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const span = (u, a, b) => clamp((u - a) / (b - a));

// Where each stage starts and ends, in screens
export function schedule(n) {
  const items = [];
  let t = INTRO;
  for (let i = 0; i < n; i++) {
    const slide = i === 0 ? [t, t] : [t, t + SLIDE];
    const dropFrom = slide[1];
    const drop = [dropFrom, dropFrom + DROP];
    const hold = [drop[1], drop[1] + HOLD];
    items.push({ slide, drop, hold });
    t = hold[1];
  }
  const pull = [t, t + PULL];
  return { items, pull, total: pull[1] + END_HOLD };
}

export const totalScreens = (n) => schedule(n).total;

// The scroll position (in screens) to jump to for product i: its blind is down and its words are showing.
export const stopFor = (n, i) => (i < 0 ? 0 : schedule(n).items[i].drop[1]);

export function stateAt(u, n) {
  const sch = schedule(n);
  const drops = sch.items.map((it) => smoother(span(u, it.drop[0], it.drop[1])));

  // camera: which window it is looking at (fractional while sliding), and how far it has pulled back
  let cam = 0;
  sch.items.forEach((it, i) => { if (i > 0) cam += easeInOutCubic(span(u, it.slide[0], it.slide[1])); });
  const wide = easeInOutCubic(span(u, sch.pull[0], sch.pull[1]));

  // words: each fades in as the camera settles and out as it starts to leave
  const alphas = sch.items.map((it, i) => {
    const inFrom = i === 0 ? INTRO - 0.12 : it.slide[0] + SLIDE * 0.55;
    const inTo = i === 0 ? INTRO + 0.1 : it.slide[1] + 0.05;
    const next = sch.items[i + 1];
    const outFrom = next ? next.slide[0] : sch.pull[0];
    const outTo = outFrom + (next ? SLIDE * 0.4 : 0.22);
    return smooth(span(u, inFrom, inTo)) * (1 - smooth(span(u, outFrom, outTo)));
  });
  const intro = 1 - smooth(span(u, INTRO - 0.2, INTRO));
  const wall = smooth(span(u, sch.pull[0] + PULL * 0.55, sch.pull[1]));

  let active = -1, best = 0.35;
  alphas.forEach((a, i) => { if (a > best) { best = a; active = i; } });
  return { u, cam, wide, drops, alphas, intro, wall, active, total: sch.total };
}
