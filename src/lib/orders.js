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
    price:     null,
    width:     stored.width ?? null,
    length:    stored.length ?? null,
    qty:       stored.qty ?? 1,
    roomLabel: stored.roomLabel ?? '',
    addons:    stored.addons ?? { blackout: false, install: false },
  };
};
