// How one order item reads on the order page and in the order panel: its photo, title, details and prices.
import { MOUNTS, getMechanism } from '../data/lines.js';
import { mechName } from './drive.js';
import { summarize } from './selection.js';
import { formatInches } from './inches.js';

export const money = (n) => `$${Number(n).toLocaleString('en-US')}`;
export const blinds = (n) => `${n} blind${n === 1 ? '' : 's'}`;

// The room photo that goes with an item (same photos as the product pages).
export function photoFor(it) {
  const p0 = it.selection?.picks?.[0];
  switch (it.product.id) {
    case 'roller': return { name: ['solar', 'screen-view', 'blackout'].includes(p0?.family) ? p0.family : 'solar', alt: 'Roller shade' };
    case 'zebra': return { name: 'zebra-dining', alt: 'Zebra shade' };
    case 'shangri-la': return { name: 'shangri-la', alt: 'Shangri-La shade' };
    case 'roman': return { name: 'roman', alt: 'Roman shade' };
    case 'cellular': return { name: it.selection?.type === 'top-down-bottom-up' ? 'cellular-tdbu' : 'cellular', alt: 'Cellular shade' };
    default: return { name: it.selection?.section === 'dream-curtains' ? 'dream-curtains' : 'drapery', alt: 'Drapery' };
  }
}

export const sizeText = (it) => (it.width ? `${formatInches(it.width)}" wide × ${formatInches(it.length || it.height)}" high` : null);

// "Solar · Jet Black (YS180006) · Fabric-wrapped cassette · 40" wide × 64" high · Inside mount · Continuous chain"
export function detailsOf(it) {
  const sum = summarize(it);
  const mech = mechName(it.product?.id, it.mech, getMechanism(it.product, it.mech)?.name, it.selection);
  const mount = it.product.mounts.length > 1 ? (MOUNTS.find((m) => m.id === it.mount)?.name || it.mount) : null;
  return { title: sum.title, colorText: sum.colorText, parts: [...sum.parts, sizeText(it), mount, mech].filter(Boolean) };
}

// The link that opens an item's product page with every choice filled in.
export const editPath = (it) => `/products/${it.product.slug}?edit=${encodeURIComponent(it.id)}`;
