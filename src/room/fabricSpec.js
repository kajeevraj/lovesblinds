// A fabric the 3D models can wear: { key, name, code, url, tile, kind, color, split?, dynamic? }.
//  - presets: the hand-cut textures from build-fabrics.mjs (public/room-lab/fabrics), a few real colors per product
//  - any other catalog swatch (picked in the color panel): its picture is cut and flattened in the browser (models/common.js whenFabric)
import FABRICS from './fabrics.json';
import { FAMILY_LOOK, familyHex, isHex } from '../lib/swatchColor.js';

// A neutral stand-in until a picture arrives (or when it never does): the swatch's color family
export const FAMILY_HEX = Object.fromEntries(Object.keys(FAMILY_LOOK).map((k) => [k, familyHex(k)]));
const DEFAULT_HEX = '#cfc6b6';

export const presetSpec = (key) => ({ key, ...FABRICS[key], url: `/room-lab/fabrics/${key}.webp`, preset: true, thumbUrl: `/room-lab/fabrics/${key}.webp` });

export function specFromEntry(entry, kind) {
  const s = entry.swatch;
  const curated = Object.keys(FABRICS).find((k) => FABRICS[k].code === s.code);
  if (curated && !isHex(s.previewColor)) return presetSpec(curated);          // a hand-cut texture, unless the admin has set this color's own
  const zebra = kind === 'zebra';
  return {
    key: `sw:${s.id}`, name: s.displayName, code: s.code, thumbUrl: s.tile || s.thumb || s.image,
    url: s.tex || s.thumb || s.image,                       // the ready-made texture (tex256/); without one, a texture is made from the picture in the browser
    prepared: !!s.tex, fallbackUrl: s.image || s.thumb,
    color: isHex(s.previewColor) ? s.previewColor.toLowerCase() : FAMILY_HEX[entry.color] || DEFAULT_HEX, override: isHex(s.previewColor), colorFamily: entry.color, tile: zebra ? [0.16, 0.17] : [0.075, 0.075], kind: zebra ? 'zebra' : 'weave', split: 0.6, dynamic: !s.tex, swatchId: s.id,
  };
}
