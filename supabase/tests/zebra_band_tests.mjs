// Zebra bands, no browser (src/room/zebraBands.js, src/lib/patternTexture.js): the default 3 in solid + 2 in sheer, editable widths, and the front and
// rear layers lining up correctly at every position of the shade, with the see-through map changing over at exactly the same row as the picture.
import { zebraBands, zebraLayout, bandAt, seen, openShare, hiddenShare, solidnessAt, cleanBand, ZEBRA_DEFAULTS, IN, SLIDE, TEX_ROWS } from '../../src/room/zebraBands.js';
import { zebraPattern } from '../../src/lib/patternTexture.js';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// ---- band widths ----
const d = zebraBands();
check('defaults: solid 3 in and sheer 2 in, one period 5 in (0.127 m), the solid band 154 of 256 texture rows (0.6016)', d.solidIn === 3 && d.sheerIn === 2 && near(d.period, 5 * IN) && d.rows === 154 && near(d.split, 154 / 256), JSON.stringify(d));
check('the defaults are exactly what the task says (3 in / 2 in)', ZEBRA_DEFAULTS.solidIn === 3 && ZEBRA_DEFAULTS.sheerIn === 2);
const c = zebraBands({ solidIn: 4, sheerIn: 1.5 });
check('editable: solid 4 in + sheer 1.5 in gives a 5.5 in period and a solid share of 4 / 5.5 (to the texture row)', c.solidIn === 4 && c.sheerIn === 1.5 && near(c.period, 5.5 * IN) && Math.abs(c.split - 4 / 5.5) <= 0.5 / TEX_ROWS, JSON.stringify(c));
check('text from a form box works ("3.5"), and bad, empty or out-of-range values fall back to the default', zebraBands({ solidIn: '3.5', sheerIn: '' }).solidIn === 3.5 && zebraBands({ solidIn: '', sheerIn: '' }).sheerIn === 2 && cleanBand(0, 3) === 3 && cleanBand(50, 3) === 3 && cleanBand(NaN, 3) === 3 && cleanBand(-1, 3) === 3 && cleanBand(null, 2) === 2 && cleanBand(0.5, 3) === 0.5 && cleanBand(12, 3) === 12);
check('the solid band is never 0 or the whole period, however extreme the widths (at least 1 texture row of each)', [[0.5, 12], [12, 0.5], [0.5, 0.5], [12, 12]].every(([s, h]) => { const b = zebraBands({ solidIn: s, sheerIn: h }); return b.rows >= 1 && b.rows <= TEX_ROWS - 1; }));

// ---- the picture has its band edge at the same row as the layout says ----
for (const [s, h] of [[3, 2], [4, 1.5], [2, 3], [3.25, 1.75]]) {
  const b = zebraBands({ solidIn: s, sheerIn: h }), z = zebraPattern('#7a6a58', b.split), L = (y) => 0.3 * z.rgb[y * TEX_ROWS * 3 + 100 * 3] + 0.59 * z.rgb[y * TEX_ROWS * 3 + 100 * 3 + 1] + 0.11 * z.rgb[y * TEX_ROWS * 3 + 100 * 3 + 2];
  let edge = -1; for (let y = 1; y < TEX_ROWS; y++) if (L(y) - L(y - 1) > 40) { edge = y; break; }
  const half = [...Array(TEX_ROWS).keys()].filter((r) => solidnessAt(r, b.rows) >= 0.5).length;
  check(`${s} in + ${h} in: the picture's solid band has ${b.rows} rows, its colour changes over at row ${edge}, and the see-through map is solid for exactly ${half} rows`, z.rows === b.rows && edge === b.rows && half === b.rows, `rows ${b.rows} edge ${edge} solid map rows ${half}`);
  const rowAt = (r) => solidnessAt(r, b.rows);
  check(`${s} + ${h}: the see-through map is fully solid inside the solid band and fully see-through inside the sheer band (away from the 6-row blend)`, rowAt(5) === 1 && rowAt(b.rows - 5) === 1 && rowAt(b.rows + 5) === 0 && rowAt(TEX_ROWS - 5) === 0 && rowAt(b.rows - 1) > 0.5 && rowAt(b.rows) < 0.5);
}

// ---- the two layers, at every position ----
const SAMPLE = 0.002;                       // m
const lenOf = (layout, i, band, from, to) => { let n = 0; for (let y = from; y < to; y += SAMPLE) if (bandAt(layout, i, y + SAMPLE / 2) === band) n += SAMPLE; return n; };
const BANDS = [zebraBands(), zebraBands({ solidIn: 4, sheerIn: 1.5 }), zebraBands({ solidIn: 2, sheerIn: 3 })];
let worstLen = 0, wrong = [];
for (const b of BANDS) for (const travel of [0.9, 1.37, 2.11]) for (let k = 0; k <= 200; k++) {
  const a = k / 200, L = zebraLayout(b, a, travel);
  for (const i of [0, 1]) {
    // each layer's bands are the right width: over one period, solid = solidIn, sheer = sheerIn
    const solid = lenOf(L, i, 'solid', 0, b.period), want = b.split * b.period;
    worstLen = Math.max(worstLen, Math.abs(solid - want));
    if (Math.abs(solid - want) > 2 * SAMPLE) wrong.push(`${i} a=${a}`);
  }
  // the front layer ends (at the bottom rail) on the bottom of a solid band, whatever the position
  if (bandAt(L, 0, SAMPLE / 4) !== 'solid') wrong.push(`front not solid at the rail, a=${a}`);
}
check('at every position (201 positions x 3 band sets x 3 drops), each layer has solid bands exactly solidIn wide and sheer bands sheerIn wide (within 4 mm)', wrong.length === 0, `worst ${(worstLen * 1000).toFixed(1)} mm ${wrong.slice(0, 3).join('; ')}`);
check('and the front layer always sits on a solid band at the bottom rail', wrong.every((w) => !w.startsWith('front')));

// the rear layer's offset from the front is exactly how far the shade has been moved (mod one period), continuously
let offErr = 0, jumps = 0, prev = null;
for (const b of BANDS) { prev = null; for (let k = 0; k <= 1000; k++) {
  const a = k / 1000, travel = 1.6, L = zebraLayout(b, a, travel), want = ((SLIDE * a * travel) % b.period + b.period) % b.period;
  offErr = Math.max(offErr, Math.abs(L.shift * b.period - want));
  const off = L.vBottom[1] - L.vBottom[0]; offErr = Math.max(offErr, Math.abs(off - want));
  if (prev !== null) { let step = L.shift - prev; if (step < -0.5) step += 1; if (step > 0.5 || step < 0) jumps++; }       // it only ever runs forward, wrapping once per period
  prev = L.shift;
} }
check('the rear layer is offset from the front by exactly the distance the shade moved (mod one period): within 0.01 mm at 1001 positions', offErr < 1e-5, `${(offErr * 1000).toFixed(5)} mm`);
check('the offset moves smoothly: no jump, no step backwards (it wraps once per period)', jumps === 0, `${jumps} jumps`);
check('raised (shade 0) the two layers are identical', zebraLayout(BANDS[0], 0, 1.6).shift === 0 && openShare(zebraLayout(BANDS[0], 0, 1.6)) > 0.39);

// where the layers line up the sheer bands are windows; where they are a half period apart the solid bands cover them
const aligned = zebraLayout(BANDS[0], 0, 1.6);
check('aligned (offset 0): every sheer band is a window (nothing of the rear solid band hides it): open share = the sheer share, 40 %', near(openShare(aligned), 0.4, 0.01) && hiddenShare(aligned) < 0.02, `${openShare(aligned).toFixed(3)} ${hiddenShare(aligned).toFixed(3)}`);
const sheerLen = (b) => b.period - b.split * b.period;
const closedAt = zebraLayout({ ...BANDS[0] }, 0, 1); closedAt.vBottom[1] = closedAt.vBottom[0] + (BANDS[0].split * BANDS[0].period);       // rear shifted by one solid band: its solid sits behind the front's sheer
check('offset by one solid band the shade is closed: nothing is open, every sheer band is hidden (3 in solid covers the 2 in sheer)', openShare(closedAt) === 0 && hiddenShare(closedAt) > 0.98, `${openShare(closedAt)} ${hiddenShare(closedAt)}`);
// the share of the front's sheer band that is hidden matches the exact overlap of two intervals, at every position
let worstShare = 0;
for (const b of BANDS) for (let k = 0; k <= 400; k++) {
  const a = k / 400, travel = 1.45, L = zebraLayout(b, a, travel), P = b.period, S = sheerLen(b), shift = L.shift * P;
  // front sheer: [0, S) (texture v in [0, (1-split)P)), rear sheer: same shifted by `shift`; rear solid = the rest. overlap of front sheer with rear solid:
  const rearSheer = [(P - shift) % P, ((P - shift) % P) + S];            // rear sheer as an interval of front coordinates (mod P)
  let overlapSheer = 0;
  for (const off of [-P, 0, P]) overlapSheer += Math.max(0, Math.min(S, rearSheer[1] + off) - Math.max(0, rearSheer[0] + off));
  const hiddenWant = (S - overlapSheer) / S;
  worstShare = Math.max(worstShare, Math.abs(hiddenWant - hiddenShare(L, 2000)));
}
check('the share of each sheer band hidden by the other layer equals the exact overlap of the two layers\' bands, at 401 positions x 3 band sets (within 1 %)', worstShare < 0.01, `${(worstShare * 100).toFixed(2)} %`);
// seen(): open exactly where both layers are sheer
check('"open" means sheer in BOTH layers and nowhere else', (() => { const L = zebraLayout(BANDS[1], 0.37, 1.8); for (let y = 0; y < L.period; y += 0.003) { const both = bandAt(L, 0, y) === 'sheer' && bandAt(L, 1, y) === 'sheer'; if ((seen(L, y) === 'open') !== both) return false; } return true; })());
// the band pattern repeats exactly every period, in both layers
check('each layer repeats exactly every period (bands identical one period up)', (() => { const L = zebraLayout(BANDS[0], 0.61, 1.7); for (const i of [0, 1]) for (let y = 0; y < 0.5; y += 0.0017) if (bandAt(L, i, y) !== bandAt(L, i, y + L.period)) return false; return true; })());
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
