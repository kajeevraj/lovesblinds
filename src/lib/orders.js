import { getLine, resolveLineId } from '../data/lines.js';

export const serializeItem = (item) => ({
  productId: item.product.id,
  variant:   item.variant,
  mech:      item.mech,
  mount:     item.mount,
  colorCode: item.code ?? null,
  colorName: item.colorName ?? null,
  selection: item.selection ?? null,
  width:     item.width ?? null,
  length:    item.length ?? null,
  qty:       item.qty ?? 1,
  roomLabel: item.roomLabel ?? '',
  addons:    item.addons ?? { blackout: false, install: false },
  price:     item.price ?? null,            // the estimate for one window, as shown when it was added or sent
  priceKind: item.priceKind ?? null,        // 'estimate' | 'email'; orders saved before Stage 2 have neither
});

// Saved orders may use older line ids (shangrila, drapes) or have no `selection`.
// Archived lines still resolve here so old orders keep displaying.
export const reconstructItem = (stored) => {
  const product = getLine(resolveLineId(stored.productId));
  if (!product) return null;
  return {
    product,
    variant:   stored.variant,
    mech:      stored.mech,
    mount:     stored.mount,
    selection: stored.selection ?? null,
    code:      stored.colorCode ?? null,
    colorName: stored.colorName ?? stored.variant,
    category:  product.id,
    location:  product.location,
    price:     stored.price ?? null,
    priceKind: stored.priceKind ?? null,
    width:     stored.width ?? null,
    length:    stored.length ?? null,
    qty:       stored.qty ?? 1,
    roomLabel: stored.roomLabel ?? '',
    addons:    stored.addons ?? { blackout: false, install: false },
  };
};

// "Estimated total $678 · plus 1 item priced by email" for orders sent after Stage 2 (their items carry the estimate they were sent with).
// Orders saved before that have none, and show no price line.
export function sentEstimate(order) {
  const items = order.items || [];
  if (order.status !== 'sent' || !items.some((it) => it.priceKind)) return null;
  let total = 0, byEmail = 0;
  for (const it of items) { if (it.priceKind === 'estimate' && it.price > 0) total += it.price * Math.max(1, it.qty || 1); else byEmail += 1; }
  const plus = byEmail ? `plus ${byEmail} item${byEmail === 1 ? '' : 's'} priced by email` : '';
  return total > 0 ? `Estimated total $${total.toLocaleString('en-US')}${plus ? ` · ${plus}` : ''}` : (plus ? plus.charAt(0).toUpperCase() + plus.slice(1).replace('plus ', '') : null);
}
