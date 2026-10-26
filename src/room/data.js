// Everything the /room-lab page knows about the photo and the products. The three.js scene (scene.js) and the page (RoomLab.jsx)
// both read from here, so a measurement or a fabric is changed in one place.
import FABRICS from './fabrics.json';

// ---- the photo (public/room-lab/room-*.webp, 2000 x 1333) and the camera that matches it -----------------------------------------
// The photo is a straight-on view: the back wall is parallel to the picture, and the lines of the side walls meet at the picture
// centre (measured: ceiling and skirting lines of the right wall meet at about 1015, 663). So the camera looks straight at the wall
// from the middle of the picture. Scale: the back wall runs from floor (y 1006) to ceiling (y 74); at 2.6 m that is 358 px per metre.
// The camera distance was worked out from the coffee table (1.2 m wide, 0.55 m deep) and sofa: about 5.9 m from the wall.
export const PHOTO = { w: 2000, h: 1333, widths: [800, 1200, 1600, 2000], src: (w) => `/room-lab/room-${w}.webp`, cutout: (w) => `/room-lab/cutout-${w}.webp` };
export const CAM = { cx: 1000, cy: 667, scale: 358, dist: 5.9 };
CAM.focal = CAM.scale * CAM.dist;                                   // focal length in photo pixels
export const ROOM = { floorY: -(1006 - CAM.cy) / CAM.scale, ceilY: (CAM.cy - 74) / CAM.scale, wallX: (1767 - CAM.cx) / CAM.scale };

// photo pixel (on the back wall plane) -> metres from the camera axis
export const wallX = (px) => (px - CAM.cx) / CAM.scale;
export const wallY = (py) => (CAM.cy - py) / CAM.scale;
// metres in the room -> photo pixel
export const project = (x, y, z) => [CAM.cx + (CAM.focal * x) / (CAM.dist - z), CAM.cy - (CAM.focal * y) / (CAM.dist - z)];

// ---- the windows -----------------------------------------------------------------------------------------------------------------
// Openings in photo pixels: the glass edge (found where the picture goes from sky to frame) pushed out by the sash to the jamb, which is the
// edge an inside-mount shade fits to. Measured from the 2000 px photo: glass left 439/831/1233.5, right 702/1108/1494, top 188.5, bottom 804.
export const WINDOWS = {
  left:   { id: 'left',   label: 'Left',   rect: [427, 177.5, 712, 817] },
  middle: { id: 'middle', label: 'Middle', rect: [821, 177.5, 1118, 817] },
  right:  { id: 'right',  label: 'Right',  rect: [1224, 177.5, 1504, 817] },
};
export const WINDOW_IDS = ['left', 'middle', 'right'];
// The partly visible window on the right-hand side wall. It sits in the plane x = ROOM.wallX; z runs from the back wall towards the camera.
// Measured: its jamb starts at pixel x 1938; top and bottom from the glass edges (y 114 and 862 at that column).
export const FAR_WINDOW = (() => {
  const zCam = (CAM.focal * ROOM.wallX) / (1938 - CAM.cx);
  return { x: ROOM.wallX, z0: CAM.dist - zCam, width: 0.8, top: 1.27, bottom: -0.45 };
})();

// ---- products ----------------------------------------------------------------------------------------------------------------------
// optics: alpha = how much of the room's window view is hidden (1 solid); glow = how much daylight comes through the cloth;
// block = how much of the room's light the product stops when fully closed (the room in the photo dims by this).
export const PRODUCTS = [
  { id: 'none', label: 'Bare window', short: 'Bare', kind: null, photo: null, slug: null },
  // Our real names: Solar = the catalog's solar family, Screen view = the screen-view family, Blackout = the blackout family
  { id: 'roller-solar', label: 'Solar roller', short: 'Solar', kind: 'roller', family: 'Roller', photo: 'solar', slug: 'roller',
    optics: { alpha: 1, glow: 0.7, block: 0.25 }, control: 'lower',
    fabrics: ['rlf-soft-cream', 'rlf-fawn-beige', 'rlf-mineral-gray', 'rlf-blue', 'rlf-iced-coffee'] },
  { id: 'roller-screen', label: 'Screen view roller', short: 'Screen view', kind: 'roller', family: 'Roller', photo: 'screen-view', slug: 'roller',
    optics: { alpha: 0.72, glow: 0.42, block: 0.12 }, control: 'lower',
    fabrics: ['rsol-linen', 'rsol-latte', 'rsol-cement-gray', 'rsol-sterling-gray', 'rsol-basalt-charcoal'] },
  { id: 'roller-blackout', label: 'Blackout roller', short: 'Blackout', kind: 'roller', family: 'Roller', photo: 'blackout', slug: 'roller',
    optics: { alpha: 1, glow: 0, block: 1 }, control: 'lower',
    fabrics: ['rbo-plaster-white', 'rbo-haze-gray', 'rbo-blue', 'rbo-caramel-brown', 'rbo-thunder-gray'] },
  { id: 'zebra', label: 'Zebra shade', short: 'Zebra', kind: 'zebra', family: 'Zebra', photo: 'zebra-dining', slug: 'zebra',
    optics: { sheerAlpha: 0.3, glowSolid: 0.12, glowSheer: 0.9, block: 0.6 }, control: 'lower',
    fabrics: ['zeb-cream', 'zeb-camel-khaki', 'zeb-platinum-gray', 'zeb-cinnamon-latte', 'zeb-tuxedo-black'] },
];
// Curtains are not a per-window product: one layer across all the windows (a track, panels that move together), over shades or bare glass.
export const CURTAIN_LAYER = {
  id: 'curtains', label: 'Curtains', kind: 'curtains', family: 'Curtains', photo: 'drapery', slug: 'drapery', control: 'close',
  optics: { glow: 0.4, block: 0.8 },
  fabrics: ['cur-gossamer-white', 'cur-mushroom-beige', 'cur-granola-beige', 'cur-anchor-gray', 'cur-cedar-brown'],
};
// Where each product's colors come from in the catalog: the line, and for Roller the fabric family
export const CATALOG = {
  'roller-solar': { line: 'roller', family: 'solar' }, 'roller-screen': { line: 'roller', family: 'screen-view' }, 'roller-blackout': { line: 'roller', family: 'blackout' },
  zebra: { line: 'zebra' }, curtains: { line: 'drapery' },
};
export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
export const fabricOf = (key) => ({ key, ...FABRICS[key], url: `/room-lab/fabrics/${key}.webp` });

export const COPY = {
  eyebrow: 'Custom made to measure',
  headline: 'So many ways to dress a window.',
  lead: 'Pick a window, pick a style, pick a color. Drag a shade up and down, or draw the curtains, to see how it looks in the room.',
};
