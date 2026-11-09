// A fabric the 3D models can wear: { key, name, code, url, tile, kind, color, split?, dynamic? }.
//  - presets: the hand-cut textures from build-fabrics.mjs (public/room-lab/fabrics), a few real colors per product
//  - any catalog swatch (picked in the color panel): textureBrowser.js resolveLook gives it a flat photo crop or a pattern, in the same color as its picker tile
import FABRICS from './fabrics.json';
import { FAMILY_LOOK, familyHex, isHex } from '../lib/swatchColor.js';
import { lookOfSwatch } from './textureBrowser.js';
import { zebraBands } from './zebraBands.js';

// A neutral stand-in until a picture arrives (or when it never does): the swatch's color family
export const FAMILY_HEX = Object.fromEntries(Object.keys(FAMILY_LOOK).map((k) => [k, familyHex(k)]));
const DEFAULT_HEX = '#cfc6b6';

export const presetSpec = (key) => ({ key, ...FABRICS[key], url: `/room-lab/fabrics/${key}.webp`, preset: true, thumbUrl: `/room-lab/fabrics/${key}.webp` });

export function specFromEntry(entry, kind) {
  const s = entry.swatch, zebra = kind === 'zebra', bands = zebraBands({ solidIn: s.zebraSolidIn, sheerIn: s.zebraSheerIn });
  return {
    key: `sw:${s.id}`, name: s.displayName, code: s.code, thumbUrl: s.tile || s.thumb || s.image, look: lookOfSwatch(s),
    // the flat color the model wears until its texture is ready (the family's color; the admin's override when there is one)
    color: isHex(s.previewColor) ? s.previewColor.toLowerCase() : FAMILY_HEX[entry.color] || DEFAULT_HEX, override: isHex(s.previewColor), colorFamily: entry.color,
    // a zebra's picture is one stripe period (solid + sheer inches) on a square; a weave covers 7.5 cm
    tile: zebra ? [bands.period, bands.period] : [0.075, 0.075], kind: zebra ? 'zebra' : 'weave', split: zebra ? bands.split : 0.6, bands, swatchId: s.id,
  };
}
