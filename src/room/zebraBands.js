// The geometry of a Zebra shade's bands, in one place so the picture (src/lib/patternTexture.js zebraPattern), the see-through map and the glow map
// (models/shade.js) and the tests all agree to the pixel.
//
// A zebra is a loop of cloth: the front layer hangs from the roller, wraps the bottom rail and goes back up as the rear layer. Both layers carry the same
// repeating stripe: a SOLID band (opaque cloth) and a SHEER band (see-through voile). One stripe period is solid + sheer inches (default 3 in + 2 in = 5 in).
// Moving the shade makes the loop run round, so the rear layer slides past the front one by SLIDE x the distance the rail moved (modulo one period). When
// the two layers line up (shift 0) the sheer bands are over each other and you see through them; when the rear solid band sits behind the front sheer band
// the shade looks solid.
export const ZEBRA_DEFAULTS = { solidIn: 3, sheerIn: 2 };
export const ZEBRA_LIMITS = { min: 0.5, max: 12 };       // inches, each band
export const IN = 0.0254;                                // metres per inch
export const SLIDE = 1;                                  // how far the rear layer slides past the front one per metre the rail moves
export const TEX_ROWS = 256;                             // rows of the stripe texture (src/lib/patternTexture.js TEX)

// A band width (inches) the admin typed: a finite number inside the limits, else the default.
export const cleanBand = (v, fallback) => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) && n >= ZEBRA_LIMITS.min && n <= ZEBRA_LIMITS.max ? n : fallback; };

// The bands of a color: { solidIn, sheerIn, period (metres), split (solid share of a period), rows (texture rows of the solid band) }.
// `split` is the share the TEXTURE can draw (a whole number of rows), so the model and the picture agree exactly.
export function zebraBands({ solidIn, sheerIn } = {}) {
  const s = cleanBand(solidIn, ZEBRA_DEFAULTS.solidIn), h = cleanBand(sheerIn, ZEBRA_DEFAULTS.sheerIn);
  const rows = Math.min(TEX_ROWS - 1, Math.max(1, Math.round((TEX_ROWS * s) / (s + h))));
  return { solidIn: s, sheerIn: h, period: (s + h) * IN, split: rows / TEX_ROWS, rows };
}

// Where the two cloth layers are for a shade lowered by `amount` (0 raised .. 1 lowered) with `travel` metres of cloth between cassette and rail.
// shift: how far the rear layer has slid, as a fraction of one period (0..1). vBottom[i]: the texture coordinate, in metres, at the bottom edge of layer
// i (0 front, 1 rear). The front layer's bottom edge is the bottom of a solid band (the bottom rail sits on a solid band), and both layers have the
// same stripe, the rear one shifted by `shift`.
export function zebraLayout(bands, amount, travel) {
  const P = bands.period, shift = (((SLIDE * amount * travel) % P) + P) % P / P;
  const base = (1 - bands.split) * P;
  return { period: P, split: bands.split, shift, vBottom: [base, base + shift * P] };
}

// The band at height `y` metres ABOVE the bottom edge of layer `i` ('solid' or 'sheer'), given the layout. In the texture the stripe period runs from the
// bottom of the sheer band up through the solid band: v mod P in [0, (1-split) P) is sheer, the rest is solid.
export function bandAt(layout, i, y) {
  const P = layout.period, v = ((layout.vBottom[i] + y) % P + P) % P;
  return v < (1 - layout.split) * P - 1e-12 ? 'sheer' : 'solid';
}

// What a viewer sees at height `y` above the rail (same y for both layers: they hang side by side): 'open' when both layers are sheer there (light
// passes through the voile twice), 'solid' when either layer is solid. Pure, used by the tests and by the light-blocking estimate in the model.
export function seen(layout, y) {
  return bandAt(layout, 0, y) === 'sheer' && bandAt(layout, 1, y) === 'sheer' ? 'open' : 'solid';
}

// The share of the shade's height that is open (see-through) for a layout, sampled finely over one period.
export function openShare(layout, samples = 400) {
  let open = 0;
  for (let k = 0; k < samples; k++) if (seen(layout, ((k + 0.5) / samples) * layout.period) === 'open') open++;
  return open / samples;
}

// Of the places where the FRONT layer is sheer, the share the rear layer's solid band hides (0 = every sheer band is a window, 1 = none is).
export function hiddenShare(layout, samples = 400) {
  let sheer = 0, hidden = 0;
  for (let k = 0; k < samples; k++) {
    const y = ((k + 0.5) / samples) * layout.period;
    if (bandAt(layout, 0, y) === 'sheer') { sheer++; if (bandAt(layout, 1, y) === 'solid') hidden++; }
  }
  return sheer ? hidden / sheer : 1;
}

// How solid the cloth is at row `r` (from the top) of the stripe texture: 1 on the solid band, 0 on the sheer band, blended over about 6 rows at each edge
// (the bottom edge of the sheer band wraps round to the top of the solid one). The see-through map and the glow map of the 3D shade are built from this,
// and the picture's own band edge is at row `rows` (see zebraBands().rows), so the three always change over at the same row.
export function solidnessAt(r, rows, N = TEX_ROWS) {
  const dist = r < rows ? -Math.min(r + 0.5, rows - r - 0.5) : Math.min(r - rows + 0.5, N - r - 0.5);
  return Math.min(1, Math.max(0, 0.5 - dist / 6));
}
