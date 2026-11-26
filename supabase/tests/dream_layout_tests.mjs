// The maths behind the Dream Curtains preview (src/room/dreamLayout.js). No browser, no network.   node supabase/tests/dream_layout_tests.mjs
const D = await import('../../src/room/dreamLayout.js');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

for (const style of ['A', 'B']) {
  const s = D.STRIPS[style], p = D.profileOf(style, 24);
  check(`style ${style}: the supplier's three parts add up to the flat width (${s.flat * 100} cm)`, near(s.parts.reduce((a, b) => a + b, 0), s.flat, 1e-9));
  const len = p.points.slice(1).reduce((t, q, i) => t + Math.hypot(q.x - p.points[i].x, q.z - p.points[i].z), 0);
  check(`style ${style}: the hung strip is the flat width of cloth (arc length ${(len * 100).toFixed(1)} cm), hanging ${(p.chord * 100).toFixed(1)} cm wide and ${(p.depth * 100).toFixed(1)} cm deep`, near(len, s.flat, 0.004) && near(p.chord, s.flat * D.HANG_RATIO, 0.002) && p.depth > 0.03);
  check(`style ${style}: the strip is level (tangent along the track) where it meets its neighbours`, Math.abs(p.points[0].th) < 1e-6 && Math.abs(p.points[p.points.length - 1].th) < 0.05);
}
check('style A strips are wider than style B strips, so B has more strips across the same opening', D.profileOf('A').chord > D.profileOf('B').chord && D.stripCount(2.44, 'B') > D.stripCount(2.44, 'A'));

for (const stack of ['left', 'right', 'center']) {
  const span = 2.44, closed = D.layoutOf({ span, style: 'A', stack, a: 0 }), open = D.layoutOf({ span, style: 'A', stack, a: 1 });
  const xs = closed.strips.map((t) => t.x).sort((a, b) => a - b), gaps = xs.slice(1).map((x, i) => x - xs[i]);
  check(`${stack}: closed, the strips are evenly spaced across the whole track`, xs[0] > -span / 2 && xs[xs.length - 1] < span / 2 && Math.max(...gaps) - Math.min(...gaps) < 1e-6 || stack === 'center');
  const ox = open.strips.map((t) => t.x), mean = ox.reduce((a, b) => a + b, 0) / ox.length;
  check(`${stack}: fully open gathers the strips at the stack side, loosely (about half the hung spacing)`, (stack === 'left' ? mean < -span * 0.25 : stack === 'right' ? mean > span * 0.25 : Math.abs(mean) < 0.1) && open.ps <= closed.pitch * 0.55, `mean x ${mean.toFixed(2)} m`);
  const half = D.layoutOf({ span, style: 'A', stack, a: 0.5 });
  check(`${stack}: half open is between closed and open`, half.strips.some((t) => t.gathered > 0 && t.gathered < 1) || stack === 'center');
}

const hand = { cx: 0, cy: 1, amp: 1 };
const left = D.pushOf(hand, -0.15, 1), right = D.pushOf(hand, 0.15, 1), far = D.pushOf(hand, 1.2, 1), top = D.pushOf(hand, 0.15, 0);
check('a press pushes the strips on each side away from the hand', left.dx < -0.03 && right.dx > 0.03 && left.yaw * right.yaw < 0);
check('strips far from the hand, and the part at the track, stay put', Math.abs(far.dx) < 1e-9 && Math.abs(top.dx) < 1e-9);
check('no press, no push', D.pushOf({ cx: 0, cy: 1, amp: 0 }, 0.1, 1).dx === 0);
check('a hovering cursor snaps to the joint between two strips', near(D.jointNear([-0.3, 0, 0.3], 0.12, 0.3), 0.15, 1e-9) && near(D.jointNear([-0.3, 0, 0.3], -0.2, 0.3), -0.15, 1e-9));
const bad = results.filter((r) => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`); process.exit(bad.length ? 1 : 0);
