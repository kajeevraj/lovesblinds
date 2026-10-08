// One-line plain explanations and picture keys for every option card.
// Picture keys point into public/explainers/ (see src/data/explainers.json). Drop a photo with the same
// name next to an svg and it wins, with no code change.

const MOTORIZED = "Raise and lower with a remote, no pulling.";

export const CONTROL_COPY = {
  chain: "Pull the beaded chain loop to raise and lower.",
  cordless: "Push or pull the bottom of the shade by hand. No cords.",
  freestop: "Stop the shade at any height.",
  remote: MOTORIZED,
  matter: "Smart motor that works with Alexa, Google and Apple Home.",
  motor: "Motor with hub-based smart control.",
  remote_wand: "A detachable rotating wand tilts and raises the shade.",
  manual: "Pull by hand along the track.",
};

// Controls with a picture: [line][mechanism id] -> explainer key
export const CONTROL_IMG = {
  roller: { chain: "control/roller-chain", cordless: "control/roller-cordless", remote: "control/roller-motorized", matter: "control/roller-motorized", motor: "control/roller-motorized" },
  zebra:  { chain: "control/zebra-chain", cordless: "control/zebra-cordless", remote: "control/zebra-motorized", matter: "control/zebra-motorized" },
  roman:  { cordless: "control/roman-cordless", remote: "control/roman-motorized", motor: "control/roman-motorized" },
};

export const MOUNT_INFO = {
  inside: { desc: "Sits inside the window frame for a clean, recessed look.", img: "mount/inside" },
  outside: { desc: "Mounted over the trim and frame, for better light control.", img: "mount/outside" },
};

export const ROLLER_MODE_INFO = {
  single: { desc: "One shade with one fabric.", img: "roller/single" },
  "double-stack": { desc: "Pairs two fabrics on one window and lets you pull each one down on its own.", img: "roller/double-stack" },
};

export const SHANGRI_FORMAT_INFO = {
  "horizontal-shade": { desc: "Soft vanes between two sheer layers. Tilt to diffuse daylight, or raise for a clear view.", img: "shangri-la/horizontal" },
  "sheer-vertical": { desc: "The same fabrics as a sheer vertical blind, for wide windows and sliding doors.", img: "shangri-la/vertical" },
};

export const CELLULAR_TYPE_INFO = {
  standard: { desc: "Raises from the bottom, like a standard shade.", img: "cellular-types/cellular-standard" },
  "top-down-bottom-up": { desc: "Lower it from the top or raise it from the bottom to let light in where you want it.", img: "cellular-types/cellular-top-down-bottom-up" },
  "day-night": { desc: "Two fabrics in one shade: light-filtering by day, blackout by night.", img: "cellular-types/cellular-day-night" },
};

export const ROMAN_STYLE_INFO = {
  relax: { desc: "A soft, relaxed look with gentle folds at the bottom.", img: "roman-styles/relax" },
  flat: { desc: "A smooth, flat face that folds up neatly as it raises.", img: "roman-styles/flat" },
  "plain-fold": { desc: "Even, tailored folds that stack up as it raises.", img: "roman-styles/plain-fold" },
  ribble: { desc: "A defined, banded look with evenly spaced folds.", img: "roman-styles/ribble" },
  hobble: { desc: "Layered folds that stay visible even when the shade is lowered.", img: "roman-styles/hobble" },
};

export const LINING_INFO = {
  blackout: "Backed to block light.",
  "light-filtering": "Backed to soften daylight.",
  none: "The fabric on its own.",
};

export const PLEAT_INFO = {
  "French Pleat 2": { desc: "A gathered pleat with two folds at the top.", img: "drapery-pleats/french-pleat-2" },
  "French Pleat 3": { desc: "A gathered pleat with three folds at the top.", img: "drapery-pleats/french-pleat-3" },
  "Euro Pleat 2": { desc: "A tailored pleat with two folds, sewn in at the top.", img: "drapery-pleats/euro-pleat-2" },
  "Euro Pleat 3": { desc: "A tailored pleat with three folds, sewn in at the top.", img: "drapery-pleats/euro-pleat-3" },
  "Pinch Pleat 1": { desc: "A single pinched pleat at the top of each fold.", img: "drapery-pleats/pinch-pleat-1" },
  "Inverted Pleat": { desc: "Folds turned inward for a clean, flat front.", img: "drapery-pleats/inverted-pleat" },
  Goblet: { desc: "Cup-shaped pleats at the top, like a goblet.", img: "drapery-pleats/goblet" },
  "Ripple Fold": { desc: "Continuous, even waves from end to end.", img: "drapery-pleats/ripple-fold" },
};

export const DREAM_STYLE_INFO = {
  A: { desc: "41 cm per vane, with 12.5 / 16 / 12.5 cm sections.", img: "dream-curtains/style-a" },
  B: { desc: "33 cm per vane, with 10 / 13 / 10 cm sections.", img: "dream-curtains/style-b" },
};
