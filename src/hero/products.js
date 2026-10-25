// What the hero shows, in order. One row = one window on the wall = one stop on the scroll story = one progress dot = one tile.
// To add a window later (woven wood, venetian blinds): write its model (src/hero/models), register it in models/index.js,
// add a swatch to scripts/build_hero_fabrics.mjs, then add a row here. Nothing else needs to change.
import FABRICS from './fabrics.json';

const fabric = (key) => {
  const f = FABRICS[key];
  return { color: f.color, texture: f.texture, tile: f.tile, mirror: f.mirror, swatch: { code: f.code, name: f.name, line: f.line } };
};

// Sizes are metres. Every window is the same; `treatment` is what hangs in or in front of it.
export const WINDOW = { width: 1.3, height: 1.5, sill: 0.95 };
export const ROOM = { height: 3.2, spacing: 3.4 };

// Curtains reach from the ceiling to the floor, so the camera stands back a little further for them
const CURTAIN_VIEW = { dx: -2.3, z: 4.7, ty: 1.5, vis: 3.2 };

export const PRODUCTS = [
  {
    id: 'roller', kind: 'roller', name: 'Roller Shades', slug: 'roller', photo: 'blackout',
    line: 'Clean and simple, from sheer to full blackout.',
    tile: 'Sheer to full blackout fabrics, single or double stack.',
    treatment: { width: 1.3, height: 1.5, top: WINDOW.sill + WINDOW.height - 0.02, z: -0.035, ...fabric('roller-blue') },
  },
  {
    id: 'zebra', kind: 'zebra', name: 'Zebra Shades', slug: 'zebra', photo: 'zebra-dining',
    line: 'Slide the stripes to dial light and privacy up or down.',
    tile: 'Alternating sheer and solid bands for light you can dial in.',
    treatment: { width: 1.3, height: 1.5, top: WINDOW.sill + WINDOW.height - 0.02, z: -0.035, ...fabric('zebra-granite-gray') },
  },
  {
    id: 'shangri-la', kind: 'shangri-la', name: 'Shangri-La Shades', slug: 'shangri-la', photo: 'shangri-la',
    line: 'Soft vanes between two sheers for gentle, even daylight.',
    tile: 'Soft fabric vanes floating between two sheer layers.',
    treatment: { width: 1.3, height: 1.5, top: WINDOW.sill + WINDOW.height - 0.02, z: -0.035, ...fabric('shangri-la-linen') },
  },
  {
    id: 'cellular', kind: 'cellular', name: 'Cellular Shades', slug: 'cellular', photo: 'cellular',
    line: 'Honeycomb cells that help keep rooms comfortable all year.',
    tile: 'Honeycomb cells that trap air at the window to insulate.',
    treatment: { width: 1.3, height: 1.5, top: WINDOW.sill + WINDOW.height - 0.02, z: -0.035, ...fabric('cellular-avocado-green') },
  },
  {
    id: 'roman', kind: 'roman', name: 'Roman Shades', slug: 'roman', photo: 'roman',
    line: 'Soft, tailored folds for living rooms and bedrooms.',
    tile: 'Fabric that gathers into soft, even folds as it rises.',
    treatment: { width: 1.3, height: 1.5, top: WINDOW.sill + WINDOW.height - 0.02, z: -0.035, ...fabric('roman-hazelnut-beige') },
  },
  {
    id: 'curtains', kind: 'curtains', name: 'Curtains', slug: 'drapery', photo: 'drapery',
    line: 'Floor-length fabric for warmth, softness and privacy.',
    tile: 'Floor-length fabric in a pleat style you choose.',
    treatment: { width: 2.1, height: 2.5, top: 2.7, z: 0.22, view: CURTAIN_VIEW, ...fabric('curtains-mushroom-beige') },
  },
  {
    id: 'dream-curtains', kind: 'dream-curtains', name: 'Dream Curtains', slug: 'drapery', photo: 'dream-curtains',
    line: 'A sheer, walk-through curtain made for patio doors.',
    tile: 'Soft vertical vanes of cloth, made for doors and wide windows.',
    treatment: { width: 1.9, height: 2.55, top: 2.75, z: 0.22, view: CURTAIN_VIEW, ...fabric('dream-anchor-gray') },
  },
];

export const COPY = {
  eyebrow: 'Custom made to measure',
  headline: 'So many ways to dress a window.',
  hint: 'Scroll to explore',
  build: 'Build yours',
  skip: 'Skip to products',
  tilesTitle: 'Find your style',
  tilesLead: 'Pick a style to see every fabric and start building your order.',
  wallCaption: 'Seven ways to dress a window',
};
