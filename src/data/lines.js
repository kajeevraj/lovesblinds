// Single product-line model for the customer-facing site.
//
// Six lines are active. Wood Blinds, Plantation Shutters and the Outdoor lines
// are archived with `active: false`: their data stays here, but every consumer
// goes through the helpers below, so re-enabling one is a single flag change.

export const MOUNTS = [
  { id: "inside",  name: "Inside Mount",  desc: "Sits within the window frame, a clean recessed look" },
  { id: "outside", name: "Outside Mount", desc: "Mounted over the trim, better light control" },
];

const MECH = {
  manual:      { id: "manual",      code: "MNL", name: "Manual cord/chain" },
  cordless:    { id: "cordless",    code: "CDL", name: "Cordless spring" },
  freestop:    { id: "freestop",    code: "FST", name: "Freestop lift" },
  wand:        { id: "wand",        code: "WND", name: "Wand / baton" },
  remote_wand: { id: "remote_wand", code: "RWD", name: "Remote wand" },
  hybrid:      { id: "hybrid",      code: "HYB", name: "2-in-1 hand + electric" },
  remote:      { id: "remote",      code: "RMT", name: "Remote control motor" },
  matter:      { id: "matter",      code: "MTR", name: "Matter smart motor" },
  motor:       { id: "motor",       code: "MOT", name: "Motor (non-Matter)" },
  chain:       { id: "chain",       code: "CHN", name: "Continuous chain" },
};
const mechs = (...ids) => ids.map(id => ({ ...MECH[id] }));
const named = (id, name) => ({ ...MECH[id], name });

export const LINES = [
  // ---- Active lines, in display order -----------------------------------
  {
    id: "roller", slug: "roller", name: "Roller Shades", icon: "roller",
    active: true, location: "indoor",
    families: ["screen-view", "solar", "blackout"],
    modes: ["single", "double-stack"],
    blurb: "Clean, minimal shades in fabrics from sheer to full blackout, available single or double-stack.",
    description: "Clean, minimal shades in three fabric families, from sheer to full blackout. Choose one shade, or pair two on a single window.",
    goodToKnow: [
      "Three fabric families. Screen View keeps the view and cuts glare, rated by openness (0% most private, up to 10% clearest view). Solar softens daylight, rated by opacity. Blackout shuts out light.",
      "Choose a single shade, or a double-stack that pairs two fabrics on one window and lets you pull each one down on its own.",
      "At night with lights on, people outside can see through Screen View and see-through Solar fabrics, so choose Blackout or a double-stack for night privacy.",
      "Control: motorized, cordless or manual chain.",
    ],
    mechanisms: mechs("chain", "cordless", "remote", "matter", "motor"),
    mounts: ["inside", "outside"],
  },
  {
    id: "zebra", slug: "zebra", name: "Zebra / Dual Shades", icon: "zebra",
    active: true, location: "indoor",
    blurb: "Alternating sheer and solid bands glide over one another for dial-in light and privacy control.",
    description: "Alternating sheer and solid bands glide over one another, so you can dial in exactly the light and privacy you want.",
    goodToKnow: [
      "Alternating sheer and solid bands. Line them up for privacy or offset them to let soft light through.",
      "Semi-blackout and blackout fabrics.",
      "Control: motorized, cordless or manual chain.",
    ],
    mechanisms: mechs("chain", "cordless", "remote", "matter"),
    mounts: ["inside", "outside"],
  },
  {
    id: "shangri-la", slug: "shangri-la", name: "Shangri-La Shades", icon: "shangrila",
    active: true, location: "indoor",
    blurb: "Soft vanes float between two sheer layers. Tilt to diffuse daylight, or raise for a clear view.",
    description: "Soft fabric vanes float between two sheer layers. Tilt to diffuse daylight, close for privacy, or raise for a clear view.",
    goodToKnow: [
      "Soft vanes between two sheer layers. Tilt to diffuse daylight, close for privacy, or raise for a clear view.",
      "The same fabrics can also be made as a sheer vertical blind for wide windows and sliding doors.",
    ],
    mechanisms: mechs("remote_wand", "matter"),
    mounts: ["inside", "outside"],
  },
  {
    id: "roman", slug: "roman", name: "Roman Shades", icon: "roman",
    active: true, location: "indoor",
    blurb: "Fabric that gathers into soft, even folds as it raises, for a warm and tailored finish.",
    description: "Fabric that folds into soft, even pleats as it rises, for a warm and tailored finish.",
    goodToKnow: [
      "Fabric that folds into soft, even pleats as it rises.",
      "Choose a style, then a fabric and a light-filtering or blackout lining.",
    ],
    mechanisms: mechs("cordless", "remote", "motor"),
    mounts: ["inside", "outside"],
  },
  {
    id: "cellular", slug: "cellular", name: "Cellular Shades", icon: "cellular",
    active: true, location: "indoor",
    families: ["light-filtering", "blackout"],
    blurb: "Honeycomb cells trap air at the window to insulate, in light-filtering or blackout fabrics.",
    description: "Honeycomb cells trap a layer of air at the window to insulate, in light-filtering or blackout fabrics.",
    goodToKnow: [
      "Honeycomb cells trap a layer of air, so rooms stay warmer in winter and cooler in summer.",
      "Light-filtering or blackout.",
      "Standard, Top-Down/Bottom-Up, or Day & Night (light-filtering by day, blackout by night).",
    ],
    mechanisms: mechs("cordless", "freestop", "remote", "matter", "motor"),
    mounts: ["inside", "outside"],
  },
  {
    id: "drapery", slug: "drapery", name: "Drapery", icon: "drapes",
    active: true, location: "indoor",
    sections: [
      { id: "curtains", name: "Curtains" },
      { id: "dream-curtains", name: "Dream Curtains" },
    ],
    blurb: "Custom curtains in pleat styles from French pleat to ripple fold, plus Dream Curtains you can walk through.",
    description: "Two ways to dress a window with fabric: custom curtains in pleat styles, and Dream Curtains, soft panels on a track that you can walk through.",
    goodToKnow: [
      "Two ways to dress a window with fabric.",
      "Curtains are custom made to your window in the fabrics in our collection, in pleat styles from French pleat to ripple fold, with blackout, light-filtering or no lining.",
      "Dream Curtains are soft vertical fabric panels on a track that pull fully aside, and you can walk through them. They filter light gently and are easy to care for: machine washable, and panels come off in about a second and go back up in about three.",
      "Manual or motorized track.",
    ],
    mechanisms: [named("manual", "Manual track"), named("remote", "Motorized track (remote)"), named("matter", "Motorized track (Matter)")],
    mounts: ["outside"],
  },

  // ---- Archived lines: data kept, hidden everywhere --------------------
  {
    id: "wood", slug: "wood", name: "Wood Blinds", icon: "wood", active: false, location: "indoor",
    blurb: "", description: "", goodToKnow: [],
    variants: ["Faux Wood", "Natural Basswood", "Espresso", "White Painted"],
    mechanisms: mechs("manual", "cordless", "wand", "hybrid", "remote", "matter"),
    mounts: ["inside", "outside"],
  },
  {
    id: "shutters", slug: "shutters", name: "Plantation Shutters", icon: "shutters", active: false, location: "indoor",
    blurb: "", description: "", goodToKnow: [],
    variants: ["Composite", "Basswood", "Phoenix Composite", "Hardwood Maple"],
    mechanisms: [named("manual", "Tilt bar"), named("wand", "Hidden tilt rod")],
    mounts: ["inside", "outside"],
  },
  {
    id: "zipscreen", slug: "zipscreen", name: "Zip Screen Blinds", icon: "zipscreen", active: false, location: "outdoor",
    blurb: "", description: "", goodToKnow: [],
    variants: ["3% Mesh", "5% Mesh", "10% Mesh", "Privacy Weave"],
    mechanisms: mechs("remote", "matter", "motor"),
    mounts: ["outside"],
  },
  {
    id: "outdoor", slug: "outdoor", name: "Outdoor Roller Shades", icon: "outdoor", active: false, location: "outdoor",
    blurb: "", description: "", goodToKnow: [],
    variants: ["Open Weave", "Solar 5%", "Privacy Weave"],
    mechanisms: mechs("chain", "cordless", "remote", "motor"),
    mounts: ["outside"],
  },
];

// ---- Shared helpers: the only place that reads `active` -----------------

export const activeLines = () => LINES.filter(l => l.active);

// Includes archived lines. Only for rebuilding saved orders; never for display lists.
export const getLine = (id) => LINES.find(l => l.id === id || l.slug === id) || null;
export const getActiveLine = (id) => activeLines().find(l => l.id === id || l.slug === id) || null;

// Ids used by saved orders before the lineup change.
const LEGACY_LINE_IDS = { shangrila: "shangri-la", drapes: "drapery" };
export const resolveLineId = (id) => LEGACY_LINE_IDS[id] || id;

export const activeLocations = () => [...new Set(activeLines().map(l => l.location))];
// The Indoor/Outdoor step only exists while more than one location has active lines.
export const needsLocationStep = () => activeLocations().length > 1;
export const activeLinesIn = (location) => activeLines().filter(l => l.location === location);

export const LOCATION_LABELS = { indoor: "Indoor", outdoor: "Outdoor" };

// Old per-page URLs and where they now go. Mirrored as 301 redirects in vercel.json.
export const LEGACY_REDIRECTS = {
  "/products/drapes": "/products/drapery",
  "/products/shangrila": "/products/shangri-la",
  "/products/solar": "/products/roller",
  "/products/screen-view": "/products/roller",
  "/products/blackout": "/products/roller",
  "/products/wood": "/products",
  "/products/shutters": "/products",
  "/products/zipscreen": "/products",
  "/products/outdoor": "/products",
};

export const getMechanism = (line, mechId) => line?.mechanisms?.find(m => m.id === mechId);
