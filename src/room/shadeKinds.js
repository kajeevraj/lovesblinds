// What the product-page preview needs to know about each kind of shade, in one place (pure data and small helpers, no three.js):
// which parts move, where they start, how the cloth takes the light, and the stand-in cloth shown before a color is picked.
//
// Roller and Zebra keep their own entries in data.js (PRODUCTS). Cellular, Roman and Shangri-La are here.
import { cellStyle } from './softLayout.js';

export const SOFT_KINDS = ['cellular', 'roman', 'shangri-la'];
export const isSoft = (kind) => SOFT_KINDS.includes(kind);
export const HAS_PREVIEW = ['roller', 'zebra', ...SOFT_KINDS];

// ---- light ------------------------------------------------------------------------------------------------------------------------------------------------
// The light type names the calibration line a cloth uses (src/room/lightCalibration.js). Light filtering lets daylight glow softly through the cloth, brighter
// towards the top where the sky is; blackout lets none through, so its face is lit evenly by the room only. Either way the face keeps its own color: a
// blackout darkens what is BEHIND it, never the cloth you look at.
export function lightTypeFor(kind, { family = null, lining = null } = {}) {
  if (kind === 'cellular') return family === 'blackout' ? 'cellular-blackout' : 'cellular';
  if (kind === 'roman') return lining === 'blackout' ? 'roman-blackout' : 'roman';
  if (kind === 'shangri-la') return 'shangri-la';
  return null;
}
// glow: daylight through the cloth; grad: that glow at the top and at the bottom of the shade; pleat: [light and shade of the two faces of a pleat, depth of the
// crease line]; stack: how much darker a roman's stacked folds are (several layers of cloth); sheer*: how much of the view each sheer hides
export const SOFT_OPTICS = {
  cellular: { glow: 0.7, grad: [1.16, 0.68], pleat: [0.03, 0.085], block: 0.5 },
  'cellular-blackout': { glow: 0.7, grad: [0.9, 0.9], pleat: [0.05, 0.14], block: 1 },
  roman: { glow: 0.7, grad: [1.16, 0.68], stack: 0.93, block: 0.6 },
  'roman-blackout': { glow: 0.7, grad: [0.9, 0.9], stack: 1, block: 1 },
  'shangri-la': { glow: 0.7, grad: [1.08, 0.8], sheerFront: 0.1, sheerBack: 0.2, block: 0.45 },
};
export const opticsFor = (lightType) => SOFT_OPTICS[lightType] || SOFT_OPTICS.cellular;

// ---- the parts that move ------------------------------------------------------------------------------------------------------------------------------------
// One entry per handle (or bottom bar, or remote row), in the order the preview keeps their positions. The first one is always the bottom.
export function moversFor(kind, { double = false, style = null } = {}) {
  if (kind === 'roller' && double) return [{ id: 'front', label: 'Front shade' }, { id: 'back', label: 'Back shade' }];
  if (kind === 'cellular' && cellStyle(style) === 'top-down-bottom-up') return [{ id: 'bottom', label: 'Bottom rail' }, { id: 'top', label: 'Top rail' }];
  if (kind === 'cellular' && cellStyle(style) === 'day-night') return [{ id: 'bottom', label: 'Bottom rail' }, { id: 'middle', label: 'Middle rail' }];
  return [{ id: 'shade', label: null }];
}
// where each part is when the page opens: a single shade a little over halfway; a double-stack's front shade halfway and its back shade raised; a top-down
// shade with its top dropped a little; a day & night shade showing both of its cloths
export function startAmounts(kind, { double = false, style = null } = {}) {
  if (kind === 'roller' && double) return [0.5, 0];
  if (kind === 'cellular' && cellStyle(style) === 'top-down-bottom-up') return [0.8, 0.22];
  if (kind === 'cellular' && cellStyle(style) === 'day-night') return [0.88, 0.42];
  return [0.55];
}
// Day & Night: which cloth covers the window. Day: the middle rail is down at the bottom rail (the day cloth hangs open). Night: it is up at the headrail.
export const DAY_NIGHT = { day: [1, 1], night: [1, 0] };

// ---- the stand-in cloth -------------------------------------------------------------------------------------------------------------------------------------
// Before a color is picked the preview wears a plain sample: a generated weave in a soft neutral (no picture to download).
const SAMPLE_HEX = { cellular: '#e9e4d8', 'cellular-blackout': '#8d8a85', roman: '#e6dfd0', 'roman-blackout': '#e6dfd0', 'shangri-la': '#e8e4da' };
export function sampleSpec(kind, lightType) {
  const hex = SAMPLE_HEX[lightType] || '#e6dfd0', id = `sample-${lightType}`;
  return {
    key: `sample:${lightType}`, name: 'Sample color', code: '', color: hex, kind: 'weave', tile: [0.075, 0.075], swatchId: id, sample: true,
    look: { id, line: kind === 'roman' ? 'drapery' : kind, family: lightType === 'cellular-blackout' ? 'blackout' : kind === 'cellular' ? 'light-filtering' : undefined, colorFamily: 'Cream/Ivory', previewColor: hex, textureMode: 'pattern', lightType, lit3d: kind },
  };
}

// what the rail under the cloth is called in the note under the picture
export const HEAD_WORD = { roller: 'roller', zebra: 'roller', 'shangri-la': 'cassette', cellular: 'headrail', roman: 'headrail' };
