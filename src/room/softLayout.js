// Where everything is on a Cellular, Roman or Shangri-La shade, for a given size and position. Pure maths (no three.js, no DOM), so the 3D models
// (models/soft.js), the page's handles (PreviewPane.jsx) and the offline tests all read the same numbers.
//
// Units are metres. A "depth" is measured DOWN from the top of the opening the shade sits in. An amount is 0 (raised) .. 1 (lowered).
export const IN = 0.0254;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---- Cellular ---------------------------------------------------------------------------------------------------------------------------------------------
// A pleated cloth between rails. The pleats (3/4 in apart) hang open from the top; the ones that have no room are pressed flat in a short, neat bundle on top
// of the rail below them (there is no roller). Three styles:
//   standard             headrail, cloth, bottom rail                       one mover: the bottom rail
//   top-down-bottom-up   headrail, two cords, top rail, cloth, bottom rail  two movers: the bottom rail and the top rail
//   day-night            headrail, day cloth, middle rail, night cloth, bottom rail   two movers: the bottom rail and the middle rail
// amounts = [bottom rail, upper rail]: both on the same scale, and the upper rail is never below the bottom one.
export const CELL = { HEAD_H: 0.04, HEAD_D: 0.05, RAIL_H: 0.022, RAIL_D: 0.04, PITCH: 0.75 * IN, SQUASH: 0.0011, LINE: 0.0045 };
export const CELL_STYLES = ['standard', 'top-down-bottom-up', 'day-night'];
export const cellStyle = (s) => (CELL_STYLES.includes(s) ? s : 'standard');

function cellBase(style, h) {
  const two = style !== 'standard', dn = style === 'day-night';
  const L = Math.max(0.12, h - CELL.HEAD_H), rails = CELL.RAIL_H * (two ? 2 : 1), k = CELL.SQUASH / CELL.PITCH;
  const F = dn ? (L - rails) / (1 + k) : L - rails;              // the full length of one cloth (day & night: each one can cover the window while the other is pressed flat)
  const N = F / CELL.PITCH, bundleAll = N * CELL.SQUASH, stackAll = rails + bundleAll * (dn ? 2 : 1);
  return { two, dn, L, F, N, bundleAll, stackAll, free: Math.max(0.01, L - stackAll) };
}
export function cellularLayout(style, h, amounts = [1, 0]) {
  style = cellStyle(style);
  const B = cellBase(style, h), { two, dn, F, N, bundleAll, stackAll, free } = B, H0 = CELL.HEAD_H, RH = CELL.RAIL_H;
  const up = two ? clamp(amounts[1] ?? 0) : 0, b = Math.max(clamp(amounts[0] ?? 1), up);
  const q = (dn ? bundleAll : 0) + up * free;                     // top of the upper rail, below the headrail
  const pb = stackAll + b * free;                                 // bottom of the bottom rail, below the headrail
  const section = (layer, top, bottom) => {
    const S = Math.max(0, bottom - top), hidden = clamp((F - S) / (CELL.PITCH - CELL.SQUASH), 0, N), bundle = Math.min(S, hidden * CELL.SQUASH);
    return { layer, top, bottom, ext: S - bundle, bundle, hidden, shown: N - hidden };
  };
  const sections = style === 'standard' ? [section(0, H0, H0 + pb - RH)]
    : dn ? [section(0, H0, H0 + q), section(1, H0 + q + RH, H0 + pb - RH)]
      : [section(0, H0 + q + RH, H0 + pb - RH)];
  return {
    ...B, style, b, up, q, pb, sections,
    upper: two ? [H0 + q, H0 + q + RH] : null, bottom: [H0 + pb - RH, H0 + pb],
    cords: style === 'top-down-bottom-up' ? [H0, H0 + q] : null,
    // what hides the glass: from `top` to `bottom` (a top-down shade leaves the glass above its top rail bare)
    cover: { top: style === 'top-down-bottom-up' ? H0 + q : 0, bottom: H0 + pb },
  };
}
// the handle of mover k (0 bottom rail, 1 upper rail): its depth as a fraction of the opening's height, and the other way round
export function cellularHandle(style, h, amounts, k) { const l = cellularLayout(style, h, amounts), r = k === 1 && l.upper ? l.upper : l.bottom; return (r[0] + r[1]) / 2 / h; }
export function cellularAmountAt(style, h, k, f) {
  style = cellStyle(style);
  const B = cellBase(style, h), mid = f * h - CELL.HEAD_H;
  return k === 1 ? clamp((mid - CELL.RAIL_H / 2 - (B.dn ? B.bundleAll : 0)) / B.free) : clamp((mid + CELL.RAIL_H / 2 - B.stackAll) / B.free);
}

// ---- Roman ------------------------------------------------------------------------------------------------------------------------------------------------
// A flat cloth hanging from a covered headrail, with lift rings every 8 in up its back. Raising it lifts the hem: the bottom panel folds in half into a soft
// loop, then the next, and so on; the rings pile up (STEP apart), so each finished fold hangs a little higher than the one before it and the folds show as an
// even stack of soft horizontal edges. Fully raised, the stack sits right under the headrail.
//   d      how far the hem has been lifted
//   n      finished folds; `slack` is how far into the next fold we are
//   R      depth of the pile of rings (where the flat cloth turns into the fold in front)
//   FB     depth of the front fold's bottom edge (the flat face runs from the headrail to here)
//   bands  the finished folds that peek out below it, front to back: { j, top, bottom } (the first fold, j = 1, hangs lowest)
// Styles (the line's own options): flat, plain-fold (a fine stitched line at every ring row), ribble (a raised rib at every row), hobble (a soft loop per panel,
// there even when lowered) and relax (no battens: the bottom edge and the folds sag in a gentle curve, and two folds stay at the bottom when lowered).
export const ROMAN = { HEAD_H: 0.05, HEAD_D: 0.04, FOLD: 8 * IN, STEP: 0.016, HEM: 0.004, GRIP: 0.018, SWAG: 0.14 };
export const ROMAN_STYLE_IDS = ['flat', 'relax', 'plain-fold', 'ribble', 'hobble'];
export const romanStyle = (s) => (ROMAN_STYLE_IDS.includes(s) ? s : 'flat');
// a relaxed shade: how much lower than its sides the middle of fold j hangs (the earlier the fold, the deeper its swag), for a hem lifted by d
const swag = (B, d, j) => B.sag * (1 + ROMAN.SWAG * Math.max(0, Math.min(6, d / B.pitch) + 1 - j));
const romanBase = (style, h, w) => {
  const T0 = ROMAN.HEAD_H, pitch = ROMAN.FOLD - ROMAN.STEP, D = pitch / 2, relax = style === 'relax', sag = relax ? Math.min(0.085, 0.07 * w) : 0;
  // a relaxed shade keeps a fold and a half at the bottom when lowered, and is cut longer so that the middle of its curve still reaches the sill
  const dMin = relax ? Math.min((h - T0) * 0.3, 1.35 * pitch) : 0;
  const Hf = Math.max(T0 + 0.1, h - ROMAN.HEM + (relax ? dMin - D - sag * (1 + ROMAN.SWAG * dMin / pitch) : 0));
  const dMax = Math.max(dMin + 0.02, (Hf - T0 - 0.012) * pitch / ROMAN.FOLD);
  return { T0, Hf, pitch, D, dMin, dMax, sag };
};
export function romanLayout(style, h, w, a) {
  style = romanStyle(style);
  const B = romanBase(style, h, w), { T0, Hf, pitch, D, dMin, dMax } = B;
  const d = dMin + (1 - clamp(a)) * (dMax - dMin), n = Math.floor(d / pitch + 1e-9), slack = d - n * pitch;
  const R = Hf - d - n * ROMAN.STEP, FB = R + slack / 2;
  const bands = []; let top = FB;
  for (let j = n; j >= 1; j--) { const bottom = Hf - d - (j - 1) * ROMAN.STEP + D; bands.push({ j, top, bottom, mid: Hf - (j - 0.5) * ROMAN.FOLD, sag: swag(B, d, j) }); top = bottom; }
  const lines = [];                                                // ring rows still hanging flat (depths), top to bottom
  for (let j = Math.floor((Hf - T0) / ROMAN.FOLD); j >= n + 1; j--) { const y = Hf - j * ROMAN.FOLD; if (y > T0 + 0.02) lines.push(y); }
  const last = bands[bands.length - 1], edge = last ? last.bottom : FB;
  // edge: the lowest edge at the sides; low: the lowest point of all (the middle of a relaxed shade's curve)
  return { ...B, style, d, n, slack, R, FB, bands, lines, edge, low: edge + (last ? last.sag : B.sag * Math.min(1, d / 0.02)), folded: d > 0.004 };
}
// the hem's handle: a little above the lowest point, in the middle
export const romanHandle = (style, h, w, a) => clamp((romanLayout(style, h, w, a).low - ROMAN.GRIP) / h);
export function romanAmountAt(style, h, w, f) {                   // the handle only ever goes down as the shade is lowered: found by halving
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (romanHandle(style, h, w, mid) < f) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// ---- Shangri-La -------------------------------------------------------------------------------------------------------------------------------------------
// Two sheers with soft cloth vanes between them, rolling into a cassette. Each vane (2 in) is fixed to the front sheer along its lower edge and to the back
// sheer along its upper edge. Closed, the sheers lie together and the vanes hang flat, each one overlapping the next: privacy. Open, the bottom rail has turned
// and the sheers stand apart, so the vanes lie almost level and you look between them through the two sheers. The vanes open only once the shade is all the
// way down (that is how the shade works), so `open` is held back until then.
export const SHANGRI = { CASS_H: 0.075, CASS_D: 0.072, RAIL_H: 0.024, RAIL_D: 0.02, PITCH: 2 * IN, VANE: 0.056, SEP_CLOSED: 0.005, SEP_OPEN: 0.054, BACK_Z: -0.012 };
export function shangriLayout(h, a, vanes = 0) {
  const travel = Math.max(0.05, h - SHANGRI.CASS_H - SHANGRI.RAIL_H), rail = SHANGRI.CASS_H + clamp(a) * travel;       // depth of the bottom rail's top
  const open = clamp(vanes) * smooth(0.9, 1, clamp(a));
  const sep = SHANGRI.SEP_CLOSED + open * (SHANGRI.SEP_OPEN - SHANGRI.SEP_CLOSED), rise = Math.sqrt(SHANGRI.VANE ** 2 - sep ** 2);
  const list = [];                                                 // depth of each vane's lower (front) edge, from the bottom rail up; the cloth rolls up, so they travel with the rail
  for (let k = 0; ; k++) { const y = rail - 0.004 - k * SHANGRI.PITCH; if (y - rise < 0.01 || k > 400) break; list.push(y); }
  return { travel, rail, open, sep, rise, vanes: list, cover: { top: 0, bottom: rail + SHANGRI.RAIL_H } };
}
export const shangriHandle = (h, a) => (shangriLayout(h, a).rail + SHANGRI.RAIL_H / 2) / h;
export const shangriAmountAt = (h, f) => clamp((f * h - SHANGRI.RAIL_H / 2 - SHANGRI.CASS_H) / Math.max(0.05, h - SHANGRI.CASS_H - SHANGRI.RAIL_H));
