import { swatchesFor } from './data/catalog.js';
import { hasRealPhoto } from './lib/photos.js';

// Mock data for Love's Blinds

export const MECHANISM_TEMPLATES = [
  { id: "manual",      code: "MNL", name: "Manual cord/chain",        defaultUpcharge: 0,   desc: "Traditional pull-cord operation" },
  { id: "cordless",    code: "CDL", name: "Cordless spring",          defaultUpcharge: 8,   desc: "Push-pull, child-safe" },
  { id: "freestop",    code: "FST", name: "Freestop lift",            defaultUpcharge: 12,  desc: "Stop the shade at any height" },
  { id: "wand",        code: "WND", name: "Wand / baton",             defaultUpcharge: 0,   desc: "Twist-rod tilt control" },
  { id: "remote_wand", code: "RWD", name: "Remote wand",              defaultUpcharge: 18,  desc: "Detachable rotating wand" },
  { id: "hybrid",      code: "HYB", name: "2-in-1 hand + electric",   defaultUpcharge: 55,  desc: "Manual override with motor" },
  { id: "remote",      code: "RMT", name: "Remote control motor",     defaultUpcharge: 65,  desc: "Dedicated handheld remote" },
  { id: "matter",      code: "MTR", name: "Matter smart motor",       defaultUpcharge: 95,  desc: "Works with Alexa, Google, Apple Home" },
  { id: "motor",       code: "MOT", name: "Motor (non-Matter)",       defaultUpcharge: 75,  desc: "Hub-based smart control" },
  { id: "chain",       code: "CHN", name: "Continuous chain",         defaultUpcharge: 0,   desc: "Endless beaded loop" },
];

const mech = (templateId, overrides = {}) => {
  const t = MECHANISM_TEMPLATES.find(x => x.id === templateId);
  return { id: templateId, code: t.code, name: t.name, upcharge: t.defaultUpcharge, desc: t.desc, ...overrides };
};

export const MOUNTS = [
  { id: "inside",  name: "Inside Mount",  desc: "Sits within the window frame — clean, recessed look" },
  { id: "outside", name: "Outside Mount", desc: "Mounted over the trim — better light control" },
];

export const SHIPPING_LABELS = ["Standard", "Express", "Sea Freight", "Air Freight", "White Glove"];

export const SUPPLIERS = [
  {
    id: "s1", name: "Hunter Mill Co.", origin: "North Carolina, USA", terms: "Net 30",
    products: ["wood", "shutters"],
    shipping: [
      { id: "sh1", internal: "Ground", customerLabel: "Standard", days: "10–14 business days", cost: 0, visible: true, isDefault: true },
      { id: "sh2", internal: "Expedited Ground", customerLabel: "Express", days: "5–7 business days", cost: 95, visible: true, isDefault: false },
    ],
  },
  {
    id: "s2", name: "Linden & Ash", origin: "Portland, OR, USA", terms: "Net 30",
    products: ["cellular", "roller", "zebra", "roman"],
    shipping: [
      { id: "sh3", internal: "Standard ground", customerLabel: "Standard", days: "7–10 business days", cost: 0, visible: true, isDefault: true },
      { id: "sh4", internal: "Air freight", customerLabel: "Express Air", days: "3–4 business days", cost: 65, visible: true, isDefault: false },
    ],
  },
  {
    id: "s3", name: "Atelier Veneto", origin: "Verona, Italy", terms: "Prepaid",
    products: ["shangrila", "drapes"],
    shipping: [
      { id: "sh5", internal: "Ocean freight", customerLabel: "Standard (Sea)", days: "5–6 weeks", cost: 0, visible: true, isDefault: true },
      { id: "sh6", internal: "Air freight", customerLabel: "Express (Air)", days: "10–14 business days", cost: 220, visible: true, isDefault: false },
      { id: "sh7", internal: "White glove crating", customerLabel: "White Glove", days: "6–8 weeks", cost: 380, visible: false, isDefault: false },
    ],
  },
  {
    id: "s4", name: "Pacific Shade Supply", origin: "Vancouver, Canada", terms: "Net 15",
    products: ["zipscreen", "outdoor"],
    shipping: [
      { id: "sh8", internal: "Cross-border ground", customerLabel: "Standard", days: "5–7 business days", cost: 0, visible: true, isDefault: true },
      { id: "sh9", internal: "Priority", customerLabel: "Express", days: "2–3 business days", cost: 85, visible: true, isDefault: false },
    ],
  },
];

export const PRODUCTS = [
  {
    id: "wood", category: "wood", name: "Wood Blinds", location: "indoor",
    badge: "Bestseller", featured: true, visible: true,
    description: "Hand-finished basswood slats in cordless or motorized configurations. Made-to-measure for windows up to 96 inches wide.",
    variants: ["Faux Wood", "Natural Basswood", "Espresso", "White Painted"],
    features: ["Made-to-measure", "Lifetime warranty", "Child-safe options", "PEFC certified wood"],
    mechanisms: [
      mech("manual"), mech("cordless"), mech("wand"),
      mech("hybrid"), mech("remote"), mech("matter"),
    ],
    mounts: ["inside", "outside"],
    supplier: "s1", lead: "10–14 days",
    baseCost: 12.50, margin: 0.40,
  },
  {
    id: "cellular", category: "cellular", name: "Cellular Shades", location: "indoor",
    badge: "Energy Star", featured: true, visible: true,
    description: "Honeycomb-cell construction insulates against heat and cold. Available in light-filtering, room-darkening, and blackout opacities.",
    variants: ["Light Filtering", "Room Darkening", "Blackout", "Day/Night"],
    features: ["Insulating", "Cordless safe", "Top-down bottom-up option", "Energy Star rated"],
    mechanisms: [
      mech("cordless"), mech("freestop"),
      mech("remote"), mech("matter"), mech("motor"),
    ],
    mounts: ["inside", "outside"],
    supplier: "s2", lead: "7–10 days",
    baseCost: 14.00, margin: 0.40,
  },
  {
    id: "roller", category: "roller", name: "Roller & Solar Shades", location: "indoor",
    badge: null, featured: true, visible: true,
    description: "Minimal profile, maximum versatility. Solar fabric options filter UV while preserving the view; blackout options seal out light.",
    variants: ["Light Filtering", "Solar 3%", "Solar 5%", "Blackout"],
    features: ["UV protection", "Slim cassette option", "Dual-shade pairing", "Easy to clean"],
    mechanisms: [
      mech("chain"), mech("freestop"),
      mech("remote"), mech("matter"), mech("motor"),
    ],
    mounts: ["inside", "outside"],
    supplier: "s2", lead: "7–10 days",
    baseCost: 9.50, margin: 0.40,
  },
  {
    id: "zebra", category: "zebra", name: "Zebra Shades", location: "indoor",
    badge: "New", featured: false, visible: true,
    description: "Alternating sheer and opaque bands let you tune privacy and light in one gesture. Modern, architectural.",
    variants: ["Light Filtering", "Room Darkening"],
    features: ["Adjustable bands", "Sleek profile", "Cordless safe"],
    mechanisms: [
      mech("chain"), mech("cordless"),
      mech("remote"), mech("matter"),
    ],
    mounts: ["inside", "outside"],
    supplier: "s2", lead: "10–14 days",
    baseCost: 16.00, margin: 0.40,
  },
  {
    id: "shangrila", category: "shangrila", name: "Shangri-La Shades", location: "indoor",
    badge: null, featured: false, visible: true,
    description: "Sheer fabric vanes float between two layers of voile, diffusing light into a soft glow.",
    variants: ["Sheer White", "Linen", "Smoke"],
    features: ["Soft diffused light", "Architectural look", "Cordless"],
    mechanisms: [
      mech("remote_wand"), mech("matter"),
    ],
    mounts: ["inside", "outside"],
    supplier: "s3", lead: "3–4 weeks",
    baseCost: 22.00, margin: 0.40,
  },
  {
    id: "roman", category: "roman", name: "Roman Shades", location: "indoor",
    badge: null, featured: false, visible: true,
    description: "Soft fabric folds in flat, hobbled, or relaxed styles. Lined options add insulation and structure.",
    variants: ["Flat", "Hobbled", "Relaxed", "Blackout Lined"],
    features: ["Custom fabrics", "Optional blackout lining", "Hand-finished"],
    mechanisms: [
      mech("cordless"), mech("remote"), mech("motor"),
    ],
    mounts: ["inside", "outside"],
    supplier: "s2", lead: "14–18 days",
    baseCost: 18.00, margin: 0.40,
  },
  {
    id: "shutters", category: "shutters", name: "Plantation Shutters", location: "indoor",
    badge: "Premium", featured: false, visible: true,
    description: "Solid hardwood or composite panels with tilt-bar or hidden-rod louvers. Built to last decades.",
    variants: ["Composite", "Basswood", "Phoenix Composite", "Hardwood Maple"],
    features: ["Hardwood frame", "Custom paint match", "Lifetime warranty"],
    mechanisms: [
      mech("manual", { name: "Tilt bar" }),
      mech("wand", { name: "Hidden tilt rod" }),
    ],
    mounts: ["inside", "outside"],
    supplier: "s1", lead: "4–6 weeks",
    baseCost: 28.00, margin: 0.40,
  },
  {
    id: "drapes", category: "drapes", name: "Drapes & Curtains", location: "indoor",
    badge: null, featured: false, visible: true,
    description: "Custom drapery in linens, velvets, and performance weaves. Lined, interlined, or sheer.",
    variants: ["Linen", "Velvet", "Performance Weave", "Sheer"],
    features: ["Custom width", "Optional motorized rod", "Pinch pleat or grommet header"],
    mechanisms: [
      mech("manual", { name: "Hand-drawn rod" }),
      mech("remote", { name: "Motorized rod (remote)" }),
      mech("matter", { name: "Motorized rod (Matter)" }),
    ],
    mounts: ["outside"],
    supplier: "s3", lead: "3–5 weeks",
    baseCost: 24.00, margin: 0.40,
  },
  {
    id: "zipscreen", category: "zipscreen", name: "Zip Screen Blinds", location: "outdoor",
    badge: "Outdoor", featured: false, visible: true,
    description: "Perimeter-zipped mesh keeps insects and wind out while preserving the view. Engineered for patios.",
    variants: ["3% Mesh", "5% Mesh", "10% Mesh", "Privacy Weave"],
    features: ["Wind-rated", "Bug screen", "UV protection"],
    mechanisms: [
      mech("remote"), mech("matter"), mech("motor"),
    ],
    mounts: ["outside"],
    supplier: "s4", lead: "5–7 days",
    baseCost: 20.00, margin: 0.40,
  },
  {
    id: "outdoor", category: "outdoor", name: "Outdoor Roller Shades", location: "outdoor",
    badge: null, featured: false, visible: true,
    description: "Weatherproof roller shades for porches, decks, and pergolas. Open-weave fabrics filter sun without blocking breeze.",
    variants: ["Open Weave", "Solar 5%", "Privacy Weave"],
    features: ["Weatherproof", "Fade resistant", "Easy retract"],
    mechanisms: [
      mech("chain"), mech("cordless"),
      mech("remote"), mech("motor"),
    ],
    mounts: ["outside"],
    supplier: "s4", lead: "5–7 days",
    baseCost: 16.00, margin: 0.40,
  },
];

export const RECENT_QUOTES = [
  { id: "Q-2034", name: "Sarah Whitfield",   date: "May 9",  items: "3× Wood Blinds, 1× Cellular",         total: 1840,  status: "new" },
  { id: "Q-2033", name: "Marcus Olin",       date: "May 8",  items: "5× Roller Shades",                     total: 2210,  status: "review" },
  { id: "Q-2032", name: "Hampton Residence", date: "May 7",  items: "12× Plantation Shutters",              total: 8640,  status: "ordered" },
  { id: "Q-2031", name: "Lena Park",         date: "May 6",  items: "2× Zebra, 4× Cellular Blackout",       total: 1980,  status: "new" },
  { id: "Q-2030", name: "Ben Toriello",      date: "May 5",  items: "6× Outdoor Roller, 2× Zip Screen",     total: 3120,  status: "ordered" },
  { id: "Q-2029", name: "The Mireille Co.",  date: "May 3",  items: "20× Roman Shades (linen)",             total: 7480,  status: "review" },
];

export const SETTINGS = {
  businessName: "Love's Blinds",
  businessAddress: "512 Glenwyck Court, Fuquay-Varina, NC 27526",
  phone: "262-434-0949",
  email: "loveblindswindows@gmail.com",
  hours: "Mon–Sat · 9am – 6pm",
  globalMargin: 40,
  quoteExpiry: 14,
  showSuppliers: true,
};

export const ADDON_UPCHARGES = {
  blackout_lining: 35,
  installation: 45,
  outside_mount: 0,
};

PRODUCTS.forEach(p => { p.colors = swatchesFor(p.category); });

export const productsByLocation = (loc) => PRODUCTS.filter(p => p.location === loc && p.visible);
export const getMechanism = (product, mechId) => product?.mechanisms?.find(m => m.id === mechId);
export const productById = (id) => PRODUCTS.find(p => p.id === id);

export const photoCountForProduct = (p) => {
  let n = 0;
  for (const c of (p.colors || [])) {
    for (const m of p.mechanisms) {
      for (const mt of p.mounts) {
        if (hasRealPhoto(p.category, c.code, m.id, mt)) n++;
      }
    }
  }
  return n;
};

export const totalCombosForProduct = (p) => (p.colors?.length || 0) * p.mechanisms.length * p.mounts.length;
