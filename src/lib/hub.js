// The Zigbee hub we sell: a flat customer price (a selling price, no markup) that the owner edits in admin (hardware_rates, id zigbee_hub).
// It is offered once per order, only while some cart line uses an App + Voice + Remote (Zigbee) motor, and goes into the order as its own line
// (quantity 1; an admin can change the quantity on the sent order). Pure code with no imports beyond drive.js: the cart, the page, the emails and api/quote.js use it.
import { usesDrive, parseMech } from './drive.js';

export const HUB_DEFAULT_PRICE = 35;
export const HUB_ACCESSORY = 'zigbee-hub';
export const HUB_BLURB = 'Needed once per home to control Zigbee shades with your phone or voice. Skip it if you already have one.';
export const hubTitle = (price) => `Zigbee hub, $${price}.`;
export const zigbeeNote = (price) => `Needs a Zigbee hub. Add one in your cart for $${price} if you don't have one.`;

// does this cart item (or order line: { category, mechId }) use a Zigbee motor?
export function isZigbeeItem(it) {
  const line = it.category || it.product?.id;
  if (!usesDrive(line)) return false;
  const d = parseMech(line, it.mechId ?? it.mech, { double: it.selection?.mode === 'double-stack' });
  return d.movement === 'motorized' && d.control === 'zigbee';
}

// the order line the hub becomes (what the browser sends; the server sets the price itself)
export const hubLine = (price) => ({
  category: 'accessory', accessory: HUB_ACCESSORY, productName: 'Zigbee hub', description: 'Zigbee hub', internalDescription: 'Zigbee hub (flat selling price, no markup)',
  colorName: '', code: null, codes: [], details: [], selection: null, mechId: '', mechName: '', mountId: '', width: null, length: null, qty: 1,
  location: 'indoor', roomLabel: '', windowLabel: '', estimate: { kind: 'price', unit: price },
});
export const isHubLine = (l) => l?.accessory === HUB_ACCESSORY;
