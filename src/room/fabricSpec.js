// A fabric the 3D models can wear: { key, name, code, url, tile, kind, color, split?, dynamic? }.
//  - presets: the hand-cut textures from build-fabrics.mjs (public/room-lab/fabrics), a few real colors per product
//  - any other catalog swatch (picked in the color panel): its picture is cut and flattened in the browser (models/common.js whenFabric)
import FABRICS from './fabrics.json';

// A neutral stand-in until a picture arrives (or when it never does): the swatch's color family
export const FAMILY_HEX = {
  White: '#ebe7df', Gray: '#9d9c9e', 'Charcoal/Black': '#3b3a3c', 'Beige/Tan': '#cdbf9f', 'Cream/Ivory': '#efe5cc',
  Brown: '#7a6048', Blue: '#5b7aa6', 'Pattern/Multi': '#c9c1b2',
};
const DEFAULT_HEX = '#cfc6b6';

export const presetSpec = (key) => ({ key, ...FABRICS[key], url: `/room-lab/fabrics/${key}.webp`, preset: true, thumbUrl: `/room-lab/fabrics/${key}.webp` });

export function specFromEntry(entry, kind) {
  const s = entry.swatch;
  const curated = Object.keys(FABRICS).find((k) => FABRICS[k].code === s.code);
  if (curated) return presetSpec(curated);
  const zebra = kind === 'zebra';
  return {
    key: `sw:${s.id}`, name: s.displayName, code: s.code, url: s.thumb || s.image || s.tile, thumbUrl: s.tile || s.thumb || s.image,
    color: FAMILY_HEX[entry.color] || DEFAULT_HEX, tile: zebra ? [0.16, 0.17] : [0.075, 0.075], kind: zebra ? 'zebra' : 'weave', split: 0.6, dynamic: true, swatchId: s.id,
  };
}
