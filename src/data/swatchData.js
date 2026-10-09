// The one data module for swatches. Everything keys by line + family + fabric + code,
// never by fabric name alone (names repeat across Roller families).
import { mergeCatalogs, orderCatalogs } from './mergeSwatches.js';
import COLOR_FAMILIES from './colorFamilies.json';
import DISPLAY_NAMES from './displayNames.json';
import { COLOR_FAMILY_LIST } from './colorFamilyList.js';
import COLOR_OVERRIDES from './colorFamilyOverrides.json';

const files = import.meta.glob('./swatches*.json', { eager: true, import: 'default' });
const { fabrics, swatches } = mergeCatalogs(
  orderCatalogs(Object.entries(files).map(([path, data]) => ({ name: path.replace('./', ''), data })))
);

// Customer-facing names live in displayNames.json, apart from the supplier data. The supplier's own color name
// and code stay as stored; a missing display name falls back to the code, never to the supplier name.
for (const s of swatches) s.displayName = DISPLAY_NAMES[s.id] || s.code;

export const FABRICS = fabrics;
export const SWATCHES = swatches;

const swatchesByFabric = new Map();
const swatchIndex = new Map();
for (const s of swatches) {
  swatchIndex.set(s.id, s);
  if (!swatchesByFabric.has(s.fabricId)) swatchesByFabric.set(s.fabricId, []);
  swatchesByFabric.get(s.fabricId).push(s);
}
const fabricIndex = new Map(fabrics.map(f => [f.id, f]));

const linesOf = (x) => x.lines || [x.line];

// `lineKey` is a catalog line: roller, zebra, shangri-la, cellular, dream-curtains,
// or roman / drapery (both read the shared drapery fabrics).
export const fabricsFor = (lineKey, family = null) =>
  fabrics.filter(f => linesOf(f).includes(lineKey) && (family == null || f.family === family));

export const swatchesForFabric = (fabricId) => swatchesByFabric.get(fabricId) || [];
export const getFabric = (id) => fabricIndex.get(id) || null;
export const getSwatch = (id) => swatchIndex.get(id) || null;

// Cellular has one fabric per family; its colors are what the customer picks.
export const swatchesFor = (lineKey, family = null) =>
  swatches.filter(s => linesOf(s).includes(lineKey) && (family == null || s.family === family));

// ---- Display helpers ---------------------------------------------------

// A null or missing spec is never displayed.
const has = (v) => v !== null && v !== undefined && v !== '';

export function badgeFor(fabric) {
  const sp = fabric?.specs || {};
  if (fabric?.line === 'roller' && fabric.family === 'screen-view' && has(sp.openness)) return `${sp.openness} open`;
  if (has(sp.opacity)) return sp.opacity;
  return null;
}

const SPEC_LABELS = [
  ['openness', 'Openness'], ['opacity', 'Opacity'], ['vaneSize', 'Vane size'],
  ['composition', 'Composition'], ['width', 'Max width'], ['weight', 'Weight'],
  ['thickness', 'Thickness'], ['use', 'Use'], ['care', 'Care'],
];

// Grade (A to E) is stored in its own field and is never shown to customers.
export function specRows(fabric) {
  const sp = fabric?.specs || {};
  return SPEC_LABELS
    .filter(([k]) => has(sp[k]))
    .map(([k, label]) => [label, k === 'openness' ? `${sp[k]} open` : sp[k]]);
}

export const swatchLabel = (s) => `${s.displayName} (${s.code})`;

// ---- Filtering facets: color family, light control, material -----------------

export const COLOR_FAMILY_ORDER = COLOR_FAMILY_LIST;

// Manual overrides (colorFamilyOverrides.json) win over the script result (colorFamilies.json).
export const colorFamilyOf = (s) => COLOR_OVERRIDES[s.id] || COLOR_FAMILIES[s.id] || 'Pattern/Multi';

// Light control: Screen View by openness (0% most private), everything else by opacity.
const OPACITY_ORDER = ['Blackout', 'Semi-blackout', 'Translucent', 'Semi-transparent', 'Visual contact outside'];
export function lightControlOf(s, fabric) {
  const sp = fabric?.specs || {};
  if (s.line === 'roller' && s.family === 'screen-view' && has(sp.openness)) {
    return { label: `${sp.openness} open`, order: parseFloat(sp.openness) };
  }
  if (has(sp.opacity)) {
    const i = OPACITY_ORDER.indexOf(sp.opacity);
    return { label: sp.opacity, order: i === -1 ? OPACITY_ORDER.length : i };
  }
  return null;
}

// Material: from composition (the swatch's own, else the fabric's).
export function materialOf(s, fabric) {
  const comp = s.specs?.composition ?? fabric?.specs?.composition;
  if (!has(comp)) return null;
  if (/pvc/i.test(comp)) return s.line === 'roller' && s.family === 'screen-view' ? 'Screen mesh (PVC)' : 'Polyester/PVC blend';
  if (/linen/i.test(comp)) return 'Linen blend';
  if (/viscose/i.test(comp)) return 'Viscose blend';
  if (/wool/i.test(comp)) return 'Wool blend';
  if (/acrylic/i.test(comp)) return 'Acrylic blend';
  if (/^\s*100%\s*polyester/i.test(comp)) return 'Polyester';
  return 'Polyester blend';
}

// One searchable entry per swatch, with its facet values resolved once.
export function entriesFor(fabricList, family = null) {
  const out = [];
  for (const f of fabricList) {
    for (const s of swatchesForFabric(f.id)) {
      if (family && s.family !== family) continue;
      out.push({ swatch: s, fabric: f, color: colorFamilyOf(s), light: lightControlOf(s, f), material: materialOf(s, f) });
    }
  }
  return out;
}

// Small grid tile for a swatch (built by scripts/build_swatch_tiles.js); the original image is the fallback.
export const tileSrc = (s) => s.image.replace('/images/swatches/', '/images/swatches-opt/').replace(/\.jpe?g$/i, '.webp');
