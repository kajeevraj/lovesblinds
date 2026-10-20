// Protection shared by the order and contact endpoints: request size, field limits, a hidden spam-trap field and a small
// rate limit per IP address and per email address. (Files starting with an underscore are not served as endpoints.)
//
// The rate limit is a counter in Supabase (rate_limit_hit(), migration 13). Only a hash of the address is stored. If the
// counter cannot be reached (migration not applied yet, network trouble) the request is allowed and a warning is logged:
// a customer is never turned away because of our own plumbing.
import { createHash } from 'crypto';
import { MAX_QTY } from '../src/lib/limits.js';

export const BUSINESS_PHONE = '262-434-0949';
export const BUSINESS_EMAIL = 'loveblindswindows@gmail.com';
export const BUSINESS_NAME = 'Loves Blinds and Window Treatments';
export const LIMITS = {
  orderBytes: 200_000, contactBytes: 20_000,
  items: 50, qty: MAX_QTY, notes: 2000, name: 100, email: 200, phone: 40, line1: 200, text: 3000, picks: 8,
  size: 1000,
  orderPerIpHour: 5, orderPerEmailHour: 3, contactPerIpHour: 5, contactPerEmailHour: 3,
};

export const SPAM_TRAP = 'website';                       // a form field people never see; bots fill it in

export const clientIp = (req) => String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || String(req.headers?.['x-real-ip'] || '') || req.socket?.remoteAddress || 'unknown';
export const digest = (s) => createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex').slice(0, 24);

export const tooLarge = (req, max) => {
  if (Number(req.headers?.['content-length'] || 0) > max) return true;
  try { return JSON.stringify(req.body ?? {}).length > max; } catch { return true; }
};

export const friendly = (what) => `${what} If it keeps happening, please call us at ${BUSINESS_PHONE} or email ${BUSINESS_EMAIL}.`;

// checks: [{ key, limit, windowSeconds }]. Every check counts one hit. Resolves { limited, checked }.
export async function rateLimit(checks, env = process.env, fetchFn = fetch) {
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { limited: false, checked: false };
  try {
    const answers = await Promise.all(checks.map(async (c) => {
      const res = await fetchFn(`${url}/rest/v1/rpc/rate_limit_hit`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_key: c.key, p_limit: c.limit, p_window_seconds: c.windowSeconds }),
      });
      if (!res.ok) throw new Error(`rate limit lookup failed (${res.status})`);
      return res.json();
    }));
    return { limited: answers.some((a) => a === false), checked: true };
  } catch (err) {
    console.warn('[guard] rate limit not checked:', err?.message || err);
    return { limited: false, checked: false };
  }
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
export const validEmail = (v) => typeof v === 'string' && v.length <= LIMITS.email && EMAIL_RE.test(v.trim());
// header-safe text (subjects): no line breaks
export const oneLine = (v, max = 150) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

// Checks an order request and returns { error } or { customer, lines, notes } with every text field cut to its limit.
export function validateOrder(body) {
  const { customer, lines, notes } = body || {};
  if (!customer || typeof customer !== 'object') return { error: 'Customer details are missing.' };
  const email = str(customer.email, LIMITS.email);
  if (!validEmail(email)) return { error: 'Please enter a valid email address.' };
  const name = str(customer.name, LIMITS.name);
  if (!name) return { error: 'Please enter your name.' };
  if (!Array.isArray(lines) || lines.length === 0) return { error: 'There is nothing in the order to send.' };
  if (lines.length > LIMITS.items) return { error: `An order can have up to ${LIMITS.items} items. Please send the rest as a second order.` };
  const a = customer.address && typeof customer.address === 'object' ? customer.address : null;
  const address = a ? Object.fromEntries(['street', 'apt', 'city', 'state', 'zip', 'country'].map((k) => [k, str(a[k], LIMITS.line1)])) : null;
  const clean = [];
  for (const [i, l] of lines.entries()) {
    if (!l || typeof l !== 'object') return { error: `Item ${i + 1} is not valid.` };
    const qty = Number(l.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > LIMITS.qty) return { error: `Item ${i + 1}: the number of blinds must be from 1 to ${LIMITS.qty}.` };
    for (const k of ['width', 'length']) {
      const v = l[k];
      if (v != null && v !== '' && !(Number(v) > 0 && Number(v) <= LIMITS.size)) return { error: `Item ${i + 1}: the ${k === 'width' ? 'width' : 'height'} is not a valid size.` };
    }
    const picks = l.selection?.picks;
    if (picks != null && (!Array.isArray(picks) || picks.length > LIMITS.picks)) return { error: `Item ${i + 1} is not valid.` };
    const cut = { ...l, qty };
    for (const k of ['description', 'internalDescription', 'colorName', 'code', 'productName', 'mechName', 'roomLabel']) if (typeof cut[k] === 'string') cut[k] = cut[k].slice(0, LIMITS.text);
    if (typeof cut.roomLabel === 'string') cut.roomLabel = cut.roomLabel.slice(0, 100);
    clean.push(cut);
  }
  return {
    customer: { name, email, phone: str(customer.phone, LIMITS.phone), address, shipTo: str(customer.shipTo, 600), callTime: str(customer.callTime, 60), measureMethod: str(customer.measureMethod, 60) },
    lines: clean,
    notes: str(notes, LIMITS.notes),
  };
}
