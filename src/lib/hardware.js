// Curtain choices (style, fullness, return, liner, panels), the optional "Add a track or rod" hardware, and the Dream Curtains install choices.
// Pure code with no imports: the product page, the order text, the remote rule and api/quote.js all read it.
// The hardware PRICE is worked out in the database (hardware_estimate, migration 20) from rates the owner edits in admin;
// nothing here knows a cost.

// ---- Curtain styles --------------------------------------------------------------------------------------------------
// `family` decides which tracks fit. `fullness` are the choices we make the fabric panel to (the pleat distance is for our order notes only).
const PLEATED_FULL = ['2.1-2.3x', '2.6x', '3x'];
const THREE_FINGER_FULL = ['2.8x', '3.5x', '4x'];
export const CURTAIN_STYLES = [
  { id: 'grommet', label: 'Grommet', family: 'grommet', fullness: ['1x', '2x'] },
  { id: 'pinch-pleat', label: 'Pinch pleat', family: 'pleated', fullness: PLEATED_FULL },
  { id: 'goblet', label: 'Goblet', family: 'pleated', fullness: PLEATED_FULL },
  { id: 'inverted-pleat', label: 'Inverted pleat', family: 'pleated', fullness: PLEATED_FULL },
  { id: 'euro-pleat-2', label: 'Euro pleat (2 finger)', family: 'pleated', fullness: PLEATED_FULL },
  { id: 'french-pleat-2', label: 'French pleat (2 finger)', family: 'pleated', fullness: PLEATED_FULL },
  { id: 'korean-pleat-2', label: 'Korean pleat (2 finger)', family: 'pleated', fullness: PLEATED_FULL },
  { id: 'out-invert-pleat', label: 'Out invert pleat', family: 'pleated', fullness: PLEATED_FULL },
  { id: 'euro-pleat-3', label: 'Euro pleat (3 finger)', family: 'pleated', fullness: THREE_FINGER_FULL },
  { id: 'french-pleat-3', label: 'French pleat (3 finger)', family: 'pleated', fullness: THREE_FINGER_FULL },
  { id: 'korean-pleat-3', label: 'Korean pleat (3 finger)', family: 'pleated', fullness: THREE_FINGER_FULL },
  { id: 'ripple-hook', label: 'Ripple fold (hook)', family: 'ripple-hook', fullness: ['2.6x', '2.8x'] },
  { id: 'ripple-button', label: 'Ripple fold (button)', family: 'ripple-button', fullness: ['2.6x'] },
  { id: 'rod-pocket', label: 'Rod pocket', family: 'rod-pocket', fullness: ['1x', '2x'] },
];
export const styleById = (id) => CURTAIN_STYLES.find((s) => s.id === id) || null;
export const styleByLabel = (label) => CURTAIN_STYLES.find((s) => s.label === label) || null;
export const fullnessLabel = (f) => String(f || '').replace('-', ' to ');

// Styles saved before this list (as the display string on the order line) -> the style they are now
const LEGACY_STYLE = {
  'French Pleat 2': 'french-pleat-2', 'French Pleat 3': 'french-pleat-3', 'Euro Pleat 2': 'euro-pleat-2', 'Euro Pleat 3': 'euro-pleat-3',
  'Pinch Pleat 1': 'pinch-pleat', 'Inverted Pleat': 'inverted-pleat', Goblet: 'goblet', 'Ripple Fold': 'ripple-hook',
};
export const styleIdFromSaved = (saved) => (styleByLabel(saved) ? styleByLabel(saved).id : LEGACY_STYLE[saved] || null);

export const RETURNS = [
  { id: 'pleat', label: 'Same as pleat spacing', desc: 'The curtain edge turns back to the wall by the same amount as the pleat spacing.' },
  { id: '2', label: '2 in', desc: 'The curtain edge turns back 2 inches to the wall.' },
  { id: '3.5', label: '3.5 in', desc: 'The curtain edge turns back 3.5 inches to the wall.' },
];
export const LINERS = [
  { id: 'none', label: 'None', desc: 'The fabric on its own.' },
  { id: 'light-filtering', label: 'Light filtering', desc: 'Backed to soften daylight.' },
  { id: 'blackout', label: 'Blackout', desc: 'Backed to block light.' },
];
export const PANELS = [
  { id: 'single', label: 'Single panel', desc: 'One curtain panel.' },
  { id: 'pair', label: 'Pair', desc: 'Two panels, one for each side of the window.' },
];

// ---- Hardware ---------------------------------------------------------------------------------------------------------
export const TRACKS = [
  { id: 'classic-rail', label: 'Classic rail', note: 'Square track', fits: ['pleated', 'ripple-button'], colors: ['white'] },
  { id: 'arc-rail', label: 'Arc rail', note: 'Slim curved track', fits: ['pleated', 'ripple-hook'], colors: ['white', 'black'] },
  { id: 'elegance-rod', label: 'Elegance rod', note: 'Plain decorative rod', fits: ['pleated', 'grommet', 'rod-pocket'], colors: 'metal' },
  { id: 'elegance-rail', label: 'Elegance rail', note: 'Grooved decorative rod', fits: ['pleated', 'ripple-hook', 'ripple-button'], colors: 'metal' },
  { id: 'motorized-rail', label: 'Motorized rail', note: 'Motor and remote included', fits: ['pleated', 'ripple-hook', 'ripple-button'], colors: ['white'], motorized: true },
];
export const trackById = (id) => TRACKS.find((t) => t.id === id) || null;
export const isDecorative = (id) => id === 'elegance-rod' || id === 'elegance-rail';
export const tracksFor = (styleId) => { const st = styleById(styleId); return st ? TRACKS.filter((t) => t.fits.includes(st.family)) : []; };
export const motorizedWhy = 'Grommet and rod pocket curtains slide by hand along a rod, so they cannot go on a motorized rail.';

export const METAL_FINISHES = [
  { id: 'brushed-bronze', label: 'Brushed Bronze', hex: '#7b5a3a' },
  { id: 'black-matt', label: 'Black Matt', hex: '#2b2a29' },
  { id: 'antique-tin-matte', label: 'Antique Tin Matte', hex: '#a39e94' },
  { id: 'brushed-brass', label: 'Brushed Brass', hex: '#b69a54' },
  { id: 'brushed-nickel-matte', label: 'Brushed Nickel Matte', hex: '#b4b6b6' },
];
export const RAIL_COLORS = [{ id: 'white', label: 'White', hex: '#f1efea' }, { id: 'black', label: 'Black', hex: '#2b2a29' }];
export const colorsOf = (trackId) => { const t = trackById(trackId); if (!t) return []; return t.colors === 'metal' ? METAL_FINISHES : RAIL_COLORS.filter((c) => t.colors.includes(c.id)); };

// Names only for now (pictures come later). The plain one is free; the rest are $18 (cost) in the database.
export const FINIALS = [
  { id: 'classic', label: 'Classic (plain)' }, { id: 'spacecraft', label: 'Spacecraft' }, { id: 'moonstone', label: 'Moonstone' },
  { id: 'celestial-oval', label: 'Celestial Oval' }, { id: 'imperial-crest', label: 'Imperial Crest' }, { id: 'crystal-diamond', label: 'Crystal Diamond' },
  { id: 'crystal-bubble', label: 'Crystal Bubble' }, { id: 'concave-top-ball', label: 'Concave-Top Ball' }, { id: 'sculpted-cylinder', label: 'Sculpted Cylinder' },
  { id: 'heritage-drum', label: 'Heritage Drum' }, { id: 'gilded-helix', label: 'Gilded Helix' },
];
export const OPENINGS = [
  { id: 'left', label: 'Left stack', desc: 'Both panels bunch up at the left.' },
  { id: 'right', label: 'Right stack', desc: 'Both panels bunch up at the right.' },
  { id: 'center', label: 'Center opening', desc: 'The panels part in the middle and bunch up at both sides.' },
];
export const OVERLAPS = [{ id: 'return', label: 'Same as return' }, { id: '2', label: '2 in' }];
export const MOUNTS_HW = [{ id: 'ceiling', label: 'Ceiling', desc: 'Fixed to the ceiling above the window.' }, { id: 'wall', label: 'Wall (side)', desc: 'Fixed to the wall above the window.' }];
export const LAYERS = [
  { id: 'single', label: 'Single', desc: 'One track, one layer of curtain.' },
  { id: 'double', label: 'Double', desc: 'A sheer in front and a blackout behind, each on its own track.' },
];
export const HW_POWER = [{ id: 'battery', label: 'Battery' }, { id: 'wired', label: 'Wired' }];

export const MEASURE_HELP = 'Width is the track width without the end caps. Height is from the track down. Don’t add or subtract anything, we’ll work out the fullness.';

// What "I have my own" saves: nothing. A chosen track saves one object; `null` means no hardware from us.
export function cleanHardware(h, styleId) {
  if (!h || !h.track) return null;
  const t = trackById(h.track), st = styleById(styleId);
  if (!t || !st || !t.fits.includes(st.family)) return null;
  const colors = colorsOf(t.id);
  const out = {
    track: t.id,
    layers: h.layers === 'double' ? 'double' : 'single',
    mount: h.mount === 'wall' ? 'wall' : 'ceiling',
    coversTrack: !!h.coversTrack,
    color: colors.some((c) => c.id === h.color) ? h.color : colors[0]?.id,
  };
  if (isDecorative(t.id)) out.finial = FINIALS.some((f) => f.id === h.finial) ? h.finial : 'classic';
  if (t.motorized) {
    out.power = h.power === 'wired' ? 'wired' : 'battery';
    out.opening = ['left', 'right', 'center'].includes(h.opening) ? h.opening : 'right';
    if (out.opening === 'center') out.overlap = h.overlap === '2' ? '2' : 'return';
  }
  return out;
}

// The options the price function takes (width is the curtain width in inches; the function works in meters)
export const hardwareRequest = (h, styleId, widthInches) => {
  const st = styleById(styleId);
  if (!h || !h.track || !st) return null;
  const w = parseFloat(widthInches);
  if (!(w > 0)) return null;
  return { width: w, options: { track: h.track, style_family: st.family, layers: h.layers || 'single', finial: h.finial && h.finial !== 'classic' ? 'premium' : 'classic', motorized: !!trackById(h.track)?.motorized, power: h.power || 'battery' } };
};

const lab = (list, id) => list.find((x) => x.id === id)?.label || id;
// The hardware as text lines for the cart, the emails and the order sheet
export function hardwareText(h) {
  if (!h || !h.track) return [];
  const t = trackById(h.track);
  const out = [`${t?.label || h.track}${h.layers === 'double' ? ' (double: sheer in front, blackout behind, two tracks)' : ''}`];
  const colors = colorsOf(h.track);
  if (h.color) out.push(`${lab(colors, h.color)}`);
  out.push(`${h.mount === 'wall' ? 'Wall (side)' : 'Ceiling'} mount, fabric ${h.coversTrack ? 'covers' : 'does not cover'} the track`);
  if (h.finial) out.push(`Finial: ${lab(FINIALS, h.finial)}`);
  if (h.opening) out.push(`${lab(OPENINGS, h.opening)}${h.opening === 'center' ? `, overlap ${h.overlap === '2' ? '2 in' : 'same as return'}` : ''}`);
  if (t?.motorized) out.push(`${h.power === 'wired' ? 'Wired' : 'Battery'} motor, remote included`);
  return out;
}

// ---- Dream Curtains ------------------------------------------------------------------------------------------------------
export const DREAM_INSTALLS = [
  { id: 'side', label: 'Side install', desc: 'The track goes on the wall beside or above the window.' },
  { id: 'ceiling', label: 'Ceiling install', desc: 'The track goes on the ceiling.' },
];
export const DREAM_FITS = [{ id: 'inside', label: 'Inside' }, { id: 'outside', label: 'Outside' }];
export const DREAM_STACKS = [
  { id: 'left', label: 'Left stack', desc: 'The panels pull aside to the left.' },
  { id: 'right', label: 'Right stack', desc: 'The panels pull aside to the right.' },
  { id: 'center', label: 'Center opening', desc: 'The panels part in the middle.' },
];
export const DREAM_CONTROLS = ['manual', 'motorized', 'pull-rod'];
// Pull rod needs a left or right stack
export const pullRodOk = (stack) => stack !== 'center';

export function dreamText(d) {
  if (!d) return [];
  const out = [];
  if (d.install) out.push(`${lab(DREAM_INSTALLS, d.install)}${d.fit ? `, ${lab(DREAM_FITS, d.fit).toLowerCase()}` : ''}`);
  if (d.stack) out.push(`${lab(DREAM_STACKS, d.stack)}`);
  return out;
}
