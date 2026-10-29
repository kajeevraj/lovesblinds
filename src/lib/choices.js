// The small choices that cost nothing extra and are saved on the order line (selection.extras): chain color, cord loop, bottom bar color,
// roll direction, bottom rail wrap. Pure code with no imports: the page, the 3D preview, the order text and api/quote.js all read it.
//
//   selection.extras = { chainColor?, cordType?, cordColor?, barColor?, rollDir?, bottomWrap? }
// Only the choices that apply to the line and the movement are saved, so the same blind always produces the same selection.

// Chain color: when the lift is Chain. `hex` is the thin true-color chain drawn in the preview.
export const CHAIN_COLORS = [
  { id: 'black', label: 'Black', hex: '#25221f' },
  { id: 'white', label: 'White', hex: '#f4f1ea' },
  { id: 'grey', label: 'Grey', hex: '#8d8a86' },
  { id: 'beige', label: 'Beige', hex: '#cdbb98' },
  { id: 'brown', label: 'Brown', hex: '#6a4a33' },
  { id: 'stainless-steel', label: 'Stainless steel', hex: '#c3c7cb' },
];
// Cord loops (Cellular and Roman): the Chain option offers a chain or a cord loop.
export const CORD_TYPES = [
  { id: 'chain', label: 'Chain', desc: 'A beaded chain loop.' },
  { id: 'cord-loop', label: 'Cord loop', desc: 'A soft cord loop instead of beads.' },
];
export const CORD_LOOP_COLORS = [
  { id: 'white', label: 'White', hex: '#f4f1ea' },
  { id: 'beige', label: 'Beige', hex: '#cdbb98' },
  { id: 'grey', label: 'Grey', hex: '#8d8a86' },
  { id: 'brown', label: 'Brown', hex: '#6a4a33' },
  { id: 'black', label: 'Black', hex: '#25221f' },
];
// Bottom bar color (Roller and Zebra): the supplier's names, exactly.
export const BAR_COLORS = [
  { id: 'pearl-white', label: 'Pearl White', hex: '#efece5' },
  { id: 'sand-beige', label: 'Sand Beige', hex: '#cdbd9f' },
  { id: 'iron-gray', label: 'Iron Gray', hex: '#6b6d70' },
  { id: 'night-black', label: 'Night Black', hex: '#26262a' },
];
export const ROLL_DIRECTIONS = [
  { id: 'standard', label: 'Standard', desc: 'The fabric hangs behind the roller, close to the glass.' },
  { id: 'reverse', label: 'Reverse', desc: 'The fabric hangs in front of the roller, closer to the room.' },
];
export const BOTTOM_WRAPS = [
  { id: 'wrapped', label: 'Wrapped in fabric', desc: 'The bottom rail is covered in your fabric.' },
  { id: 'none', label: 'Plain bottom rail', desc: 'The bottom rail stays plain, in the bottom bar color.' },
];

export const DEFAULT_EXTRAS = { chainColor: 'white', cordType: 'chain', cordColor: 'white', barColor: 'pearl-white', rollDir: 'standard', bottomWrap: 'wrapped' };

export const ROLL_DIRECTION_LINES = ['roller', 'roman', 'shangri-la'];
export const BAR_COLOR_LINES = ['roller', 'zebra'];
export const CORD_LOOP_LINES = ['cellular', 'roman'];

const known = (list, id) => (list.some((x) => x.id === id) ? id : null);

// the extras that apply to this line, movement and mode, with defaults filled in; `saved` is what a draft or order carried
export function extrasFor(lineId, movement, saved = {}, { double = false } = {}) {
  const s = saved || {};
  const out = {};
  if (movement === 'chain') {
    if (CORD_LOOP_LINES.includes(lineId)) {
      out.cordType = known(CORD_TYPES, s.cordType) || DEFAULT_EXTRAS.cordType;
      if (out.cordType === 'cord-loop') out.cordColor = known(CORD_LOOP_COLORS, s.cordColor) || DEFAULT_EXTRAS.cordColor;
      else out.chainColor = known(CHAIN_COLORS, s.chainColor) || DEFAULT_EXTRAS.chainColor;
    } else out.chainColor = known(CHAIN_COLORS, s.chainColor) || DEFAULT_EXTRAS.chainColor;
  }
  if (BAR_COLOR_LINES.includes(lineId)) out.barColor = known(BAR_COLORS, s.barColor) || DEFAULT_EXTRAS.barColor;
  if (ROLL_DIRECTION_LINES.includes(lineId)) out.rollDir = known(ROLL_DIRECTIONS, s.rollDir) || DEFAULT_EXTRAS.rollDir;
  if (lineId === 'roller' && double) out.bottomWrap = known(BOTTOM_WRAPS, s.bottomWrap) || DEFAULT_EXTRAS.bottomWrap;
  return out;
}

const label = (list, id) => list.find((x) => x.id === id)?.label || id;
export const barColorLabel = (id) => label(BAR_COLORS, id);
export const chainColorOf = (id) => CHAIN_COLORS.find((c) => c.id === id) || CHAIN_COLORS[1];
export const barColorOf = (id) => BAR_COLORS.find((c) => c.id === id) || BAR_COLORS[0];

// "Chain color: White", "Cord loop: Beige", "Bottom bar: Pearl White", "Roll direction: Reverse" ... in the order the page shows them
export function extrasText(extras) {
  const e = extras || {};
  const out = [];
  if (e.cordType === 'cord-loop') out.push(`Cord loop, ${label(CORD_LOOP_COLORS, e.cordColor || DEFAULT_EXTRAS.cordColor).toLowerCase()}`);
  else if (e.cordType === 'chain' && e.chainColor) out.push(`Chain color: ${label(CHAIN_COLORS, e.chainColor)}`);
  else if (e.chainColor) out.push(`Chain color: ${label(CHAIN_COLORS, e.chainColor)}`);
  if (e.barColor) out.push(`Bottom bar: ${label(BAR_COLORS, e.barColor)}`);
  if (e.bottomWrap) out.push(e.bottomWrap === 'none' ? 'Plain bottom rail' : 'Bottom rail wrapped in fabric');
  if (e.rollDir) out.push(`Roll direction: ${label(ROLL_DIRECTIONS, e.rollDir)}`);
  return out;
}
