// What a customer picked, and how it reads in the order summary and the order email.
// Pure text logic with no imports, so the browser and api/quote.js (Node) share it. The browser entry point is
// selection.js, which adds the fallback names for picks saved before display names existed.
//
// selection = {
//   lineId, section?, mode?, type?, format?, style?, pleat?, lining?, cover? ("wrapped" | "none", Roller top cover),
//   picks: [{ role, swatchId, line, family, fabric, fabricId, code, colorName, style, thumb }]
// }
// `code` is exactly the stored code (for Dream Curtains with a style, that style's own code).

export const FAMILY_LABELS = {
  "screen-view": "Screen View", solar: "Solar", blackout: "Blackout", "light-filtering": "Light Filtering",
};
export const MODE_LABELS = { single: "Single", "double-stack": "Double-stack" };
export const CELLULAR_TYPES = [
  { id: "standard", label: "Standard" },
  { id: "top-down-bottom-up", label: "Top-Down/Bottom-Up" },
  { id: "day-night", label: "Day & Night" },
];
// Shangri-La only comes as a horizontal shade, so there is no format step any more. Orders saved while a format was offered
// still carry it, and keep reading the way they were saved.
const SAVED_SHANGRI_FORMATS = { "horizontal-shade": "Horizontal shade", "sheer-vertical": "Sheer vertical blind" };
export const ROMAN_STYLES = [
  { id: "relax", label: "Relax" }, { id: "flat", label: "Flat" }, { id: "plain-fold", label: "Plain Fold" },
  { id: "ribble", label: "Ribble" }, { id: "hobble", label: "Hobble" },
];
export const LINING_LABELS = { blackout: "Blackout lining", "light-filtering": "Light-filtering lining", none: "No lining" };
export const PLEATS = [
  "French Pleat 2", "French Pleat 3", "Euro Pleat 2", "Euro Pleat 3",
  "Pinch Pleat 1", "Inverted Pleat", "Goblet", "Ripple Fold",
];
// Dream Curtains styles in plain words (the supplier calls them Style A and Style B). Customers see the names; our own email and sheet show both.
export const DREAM_STYLE_NAMES = { A: "Classic", B: "Slim" };
const dreamStyle = (style, internal = false) => (DREAM_STYLE_NAMES[style] ? (internal ? `${DREAM_STYLE_NAMES[style]} (Style ${style})` : DREAM_STYLE_NAMES[style]) : `Style ${style}`);
export const SECTION_LABELS = { curtains: "Curtains", "dream-curtains": "Dream Curtains" };

const label = (list, id) => list.find(x => x.id === id)?.label || id;

// Customers see the display name and the code, never the supplier's collection or color name.
// Picks saved before display names existed are filled in from their swatch id by the fallback, when one is set.
let nameFallback = null;
export const setNameFallback = (fn) => { nameFallback = fn; };
export const displayNameOf = (p) => p.displayName || nameFallback?.(p.swatchId) || p.code;
export const pickText = (p) => `${displayNameOf(p)} (${p.code})`;

// Internal only (order email to us, spreadsheet): supplier collection, supplier color name and code.
export const internalPickText = (p) =>
  `${[p.fabric, p.colorName].filter(Boolean).join(" ")} (${p.code}) [${displayNameOf(p)}]`;

export function summarize(item) {
  const sel = item.selection;
  const lineName = item.product.name;
  if (!sel) {
    return { title: lineName, parts: [item.colorName || item.variant].filter(Boolean), colorText: item.colorName || item.variant || "", codes: item.code ? [item.code] : [] };
  }
  const titleBits = [lineName];
  if (sel.section) titleBits.push(SECTION_LABELS[sel.section]);
  if (sel.mode) titleBits.push(MODE_LABELS[sel.mode]);
  const parts = [];
  if (sel.format) parts.push(SAVED_SHANGRI_FORMATS[sel.format] || String(sel.format));   // saved orders only
  if (sel.type) parts.push(label(CELLULAR_TYPES, sel.type));
  if (sel.style) parts.push(`${label(ROMAN_STYLES, sel.style)} style`);
  if (sel.pleat) parts.push(sel.pleat);
  if (sel.lining) parts.push(LINING_LABELS[sel.lining]);
  if (sel.cover) parts.push(sel.cover === "none" ? "No fabric wrap on the cassette" : "Fabric-wrapped cassette");
  const multi = sel.picks.length > 1;
  const pickLines = sel.picks.map(p => {
    const fam = p.family ? `${FAMILY_LABELS[p.family]} · ` : "";
    const sty = p.style ? ` · ${dreamStyle(p.style)}` : "";
    return `${multi && p.role ? `${p.role}: ` : ""}${fam}${pickText(p)}${sty}`;
  });
  return {
    title: titleBits.join(", "),
    parts: [...pickLines, ...parts],
    colorText: sel.picks.map(p => `${multi && p.role ? `${p.role}: ` : ""}${pickText(p)}`).join(" / "),
    codes: sel.picks.map(p => p.code),
  };
}

// Internal one-liner: same options, supplier data in place of the customer wording.
export function describeInternal(item) {
  const sel = item.selection;
  if (!sel) return describeItem(item);
  const s = summarize(item);
  const multi = sel.picks.length > 1;
  const lines = sel.picks.map(p => `${multi && p.role ? `${p.role}: ` : ""}${p.family ? `${FAMILY_LABELS[p.family]} · ` : ""}${internalPickText(p)}${p.style ? ` · ${dreamStyle(p.style, true)}` : ""}`);
  const opts = s.parts.slice(sel.picks.length);
  return [s.title, ...lines, ...opts].join(" · ");
}

// One line of text for the customer email and the order summary.
export const describeItem = (item) => {
  const s = summarize(item);
  return [s.title, ...s.parts].join(" · ");
};

export const primaryPick = (item) => item.selection?.picks?.[0] || null;

// Roman styles for one drapery/roman swatch, straight from its romanStyles data.
// A style is disabled when `available` is false; linings are only those listed for the style.
export const romanStyleOptions = (swatch) =>
  ROMAN_STYLES.map(({ id, label }) => {
    const st = swatch?.romanStyles?.[id];
    return { id, label, available: !!st?.available, linings: st?.available ? (st.linings || []) : [] };
  });
