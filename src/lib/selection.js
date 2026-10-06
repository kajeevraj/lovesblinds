// What a customer picked, and how it reads in the order summary and the order email.
// Kept free of swatch data so the main bundle never needs the catalog.
//
// selection = {
//   lineId, section?, mode?, type?, format?, style?, pleat?, lining?,
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
export const SHANGRI_FORMATS = [
  { id: "horizontal-shade", label: "Horizontal shade" },
  { id: "sheer-vertical", label: "Sheer vertical blind" },
];
export const ROMAN_STYLES = [
  { id: "relax", label: "Relax" }, { id: "flat", label: "Flat" }, { id: "plain-fold", label: "Plain Fold" },
  { id: "ribble", label: "Ribble" }, { id: "hobble", label: "Hobble" },
];
export const LINING_LABELS = { blackout: "Blackout lining", "light-filtering": "Light-filtering lining", none: "No lining" };
export const PLEATS = [
  "French Pleat 2", "French Pleat 3", "Euro Pleat 2", "Euro Pleat 3",
  "Pinch Pleat 1", "Inverted Pleat", "Goblet", "Ripple Fold",
];
export const SECTION_LABELS = { curtains: "Curtains", "dream-curtains": "Dream Curtains" };

const label = (list, id) => list.find(x => x.id === id)?.label || id;

export const pickText = (p) => {
  // Cellular has a single fabric, so its name adds nothing next to the color.
  const name = p.line === "cellular" && p.colorName ? p.colorName : p.colorName ? `${p.fabric} ${p.colorName}` : p.fabric;
  return `${name} (${p.code})`;
};

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
  if (sel.format) parts.push(label(SHANGRI_FORMATS, sel.format));
  if (sel.type) parts.push(label(CELLULAR_TYPES, sel.type));
  if (sel.style) parts.push(`${label(ROMAN_STYLES, sel.style)} style`);
  if (sel.pleat) parts.push(sel.pleat);
  if (sel.lining) parts.push(LINING_LABELS[sel.lining]);
  const multi = sel.picks.length > 1;
  const pickLines = sel.picks.map(p => {
    const fam = p.family ? `${FAMILY_LABELS[p.family]} · ` : "";
    const sty = p.style ? ` · Style ${p.style}` : "";
    return `${multi && p.role ? `${p.role}: ` : ""}${fam}${pickText(p)}${sty}`;
  });
  return {
    title: titleBits.join(", "),
    parts: [...pickLines, ...parts],
    colorText: sel.picks.map(p => `${multi && p.role ? `${p.role}: ` : ""}${pickText(p)}`).join(" / "),
    codes: sel.picks.map(p => p.code),
  };
}

// One line of text for the order email and xlsx description.
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
