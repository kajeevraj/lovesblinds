import { PRODUCTS } from '../data.js';

export const serializeItem = (item) => ({
  productId: item.product.id,
  variant:   item.variant,
  mech:      item.mech,
  mount:     item.mount,
  colorCode: item.code ?? null,
  width:     item.width ?? null,
  length:    item.length ?? null,
  qty:       item.qty ?? 1,
  roomLabel: item.roomLabel ?? '',
  addons:    item.addons ?? { blackout: false, install: false },
});

export const reconstructItem = (stored) => {
  const product = PRODUCTS.find(p => p.id === stored.productId);
  if (!product) return null;
  const color = product.colors?.find(c => c.code === stored.colorCode) ?? null;
  return {
    product,
    variant:   stored.variant,
    mech:      stored.mech,
    mount:     stored.mount,
    color,
    code:      stored.colorCode ?? null,
    colorName: color?.name ?? stored.variant,
    category:  product.category,
    location:  product.location,
    price:     null,
    width:     stored.width ?? null,
    length:    stored.length ?? null,
    qty:       stored.qty ?? 1,
    roomLabel: stored.roomLabel ?? '',
    addons:    stored.addons ?? { blackout: false, install: false },
  };
};
