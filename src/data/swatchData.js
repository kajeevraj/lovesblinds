// The one data module for swatches. Everything keys by line + family + fabric + code,
// never by fabric name alone (names repeat across Roller families).
import { mergeCatalogs, orderCatalogs } from './mergeSwatches.js';

const files = import.meta.glob('./swatches*.json', { eager: true, import: 'default' });
const { fabrics, swatches } = mergeCatalogs(
  orderCatalogs(Object.entries(files).map(([path, data]) => ({ name: path.replace('./', ''), data })))
);

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

// Drapery composition strings carry a leading "GRADE" label that is internal pricing data, so they are not shown.
export function specRows(fabric) {
  const sp = fabric?.specs || {};
  return SPEC_LABELS
    .filter(([k]) => has(sp[k]) && !(k === 'composition' && /^GRADE\b/i.test(sp[k])))
    .map(([k, label]) => [label, k === 'openness' ? `${sp[k]} open` : sp[k]]);
}

export const swatchLabel = (s) =>
  [s.fabric, s.colorName, s.code].filter(has).join(' · ');
