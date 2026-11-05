// The hub's customer price, from the database (zigbee_hub_price, migration 20). Until that exists, or if it cannot be reached, it is $35.
import { useEffect, useState } from 'react';
import { HUB_DEFAULT_PRICE } from './hub.js';

const BASE = import.meta.env.VITE_SUPABASE_URL, KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
let cached = null;
export function fetchHubPrice() {
  if (!cached) {
    cached = (!BASE || !KEY ? Promise.resolve(null) : fetch(`${BASE}/rest/v1/rpc/zigbee_hub_price`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null))
      .then((j) => (j && Number(j.price) > 0 ? Number(j.price) : HUB_DEFAULT_PRICE));
  }
  return cached;
}
export function useHubPrice() {
  const [price, setPrice] = useState(HUB_DEFAULT_PRICE);
  useEffect(() => { let live = true; fetchHubPrice().then((p) => { if (live) setPrice(p); }); return () => { live = false; }; }, []);
  return price;
}
