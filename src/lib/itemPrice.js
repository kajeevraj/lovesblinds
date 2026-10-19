// Prices of the windows in an order, asked from the database (the same function the product pages use), so the order page
// and the emails always show a current estimate. Nothing but { price, custom_size, price_on_request } comes back.
import { useEffect, useMemo, useState } from 'react';
import { priceRequestFromItem } from './priceRequest.js';
import { estimatePrice } from './estimate.js';

// What an item's price shows as: price | custom (larger than our standard range) | request (curtains) | email (no estimate possible) | loading
export const kindOf = (res) => {
  if (!res || res.error) return { kind: 'email' };
  if (res.price_on_request) return { kind: 'request' };
  if (res.price != null) return { kind: 'price', price: res.price };
  if (res.custom_size) return { kind: 'custom' };
  return { kind: 'email' };
};

const cache = new Map();            // request JSON -> answer

export function useItemPrices(items) {
  const keys = useMemo(() => items.map((it) => {
    const req = priceRequestFromItem(it.product, it);
    return req ? JSON.stringify(req) : null;
  }), [items]);
  const [, bump] = useState(0);
  useEffect(() => {
    let live = true;
    const todo = [...new Set(keys.filter((k) => k && !cache.has(k)))];
    if (!todo.length) return undefined;
    Promise.all(todo.map((k) => estimatePrice(JSON.parse(k)).then((r) => cache.set(k, r)).catch(() => cache.set(k, { error: true }))))
      .then(() => { if (live) bump((n) => n + 1); });
    return () => { live = false; };
  }, [keys]);
  // until the database answers, a window that was added with an estimate shows that estimate (so the bar does not flicker on a refresh)
  return keys.map((k, i) => (!k ? { kind: 'email' } : cache.has(k) ? kindOf(cache.get(k)) : (items[i].priceKind === 'estimate' && items[i].price > 0 ? { kind: 'price', price: items[i].price, provisional: true } : { kind: 'loading' })));
}

// The estimated total and how many items have no estimate. Quantity multiplies the price of one window.
export function totalsOf(items, prices) {
  let total = 0, byEmail = 0, loading = false;
  items.forEach((it, i) => {
    const p = prices[i];
    const q = Math.max(1, it.qty || 1);
    if (p.kind === 'price') total += p.price * q;
    else if (p.kind === 'loading') loading = true;
    else byEmail += 1;                 // counted per item (a line of 3 identical windows is one item)
  });
  return { total, byEmail, loading };
}
