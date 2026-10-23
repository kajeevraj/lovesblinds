import { createContext, useContext } from 'react';

// The cart (the order in progress until it is sent), shared by the cart bar, the cart panel, the product pages and the cart page.
//   items, prices ({ kind, price } per item), totals ({ total, byEmail, loading }), ready (the saved cart has loaded),
//   addItem(item) -> { merged, qty }, saveItem(id, item), removeItem(id), setQty(id, qty), panelOpen / setPanelOpen,
//   flash ({ msg, n }), showFlash(msg), goEdit(item), duplicateItem(item),
//   registerPage({ ready, add, discard } | null): the blind on the open product page (so Checkout can ask to add it first),
//   undo ({ label, restore } | null) after Remove, notice ({ msg, n } | null) such as "Saved",
//   incomplete (product pages left part way: { key, lineId, product, title, colorText, sizeText }), removeIncomplete(entry), goIncomplete(entry),
//   count (items + incomplete), goCheckout(),
//   auth ({ user, supabaseEnabled, authLoading, signIn })
export const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

// "Add another like this": the product page asks LinePage to start the page again from the draft it just saved.
export const BuildAnotherContext = createContext(() => {});

// JSON with sorted keys, so two selections that mean the same thing compare equal.
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

// The same product, options, size and room (and window label): adding it again raises the quantity instead of making a new line.
export const sameItem = (a, b) =>
  a.product.id === b.product.id && a.mech === b.mech && a.mount === b.mount
  && Number(a.width) === Number(b.width) && Number(a.length) === Number(b.length)
  && (a.roomLabel || '').trim().toLowerCase() === (b.roomLabel || '').trim().toLowerCase()
  && (a.windowLabel || '').trim().toLowerCase() === (b.windowLabel || '').trim().toLowerCase()
  && stable(a.selection ?? null) === stable(b.selection ?? null);
