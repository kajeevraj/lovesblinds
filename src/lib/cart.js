import { createContext, useContext } from 'react';

// The order in progress, shared by the order bar, the order panel, the product pages and the order page.
//   items, prices ({ kind, price } per item), totals ({ total, byEmail, loading }), ready (the saved order has loaded),
//   addItem(item), saveItem(id, item), removeItem(id), panelOpen / setPanelOpen, flash ({ msg, n }), showFlash(msg), goEdit(item)
export const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);
