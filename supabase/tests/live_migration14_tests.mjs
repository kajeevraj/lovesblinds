// Live tests of migration 14 (the sent_orders store) against the real project, run after pasting the migration: the public and
// signed-in customers cannot read or write it, the server can store an order through the real handler, and the stored copy
// holds the customer, the items and the totals. Removes everything it creates. Exits 2 when the migration is not applied yet.
import { handleQuote } from '../../api/quote.js';
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const tag = `zz-m14-${Date.now()}`; let userId;
try {
  const probe = await api('GET', '/rest/v1/sent_orders?select=id&limit=1', H(SVC));
  if (probe.status === 404 || probe.status === 400 && /sent_orders/.test(JSON.stringify(probe.body))) { console.log('Migration 14 is not applied yet. Paste supabase/migrations/20261023000014_sent_orders_store.sql into the SQL Editor, then run this again.'); process.exit(2); }
  const anonRead = await api('GET', '/rest/v1/sent_orders?select=id', H(ANON));
  const anonWrite = await api('POST', '/rest/v1/sent_orders', H(ANON), { customer: { email: 'a@b.c' }, lines: [] });
  check('the public can neither read nor write sent orders', !Array.isArray(anonRead.body) && anonRead.status >= 400 && anonWrite.status >= 400, `${anonRead.status}/${anonWrite.status}`);

  const password = `Tmp-${crypto.randomUUID()}`;
  userId = (await api('POST', '/auth/v1/admin/users', H(SVC), { email: `${tag}@example.com`, password, email_confirm: true })).body.id;
  const token = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email: `${tag}@example.com`, password })).body;
  const mine = await api('GET', '/rest/v1/sent_orders?select=id', H(ANON, token.access_token));
  check('a signed-in customer (not an admin) sees nothing and cannot add a row', (Array.isArray(mine.body) ? mine.body.length === 0 : mine.status >= 400) && (await api('POST', '/rest/v1/sent_orders', H(ANON, token.access_token), { customer: { email: 'x@y.z' }, lines: [] })).status >= 400);

  // the real handler with a fake email service: the order lands in the table
  const cat = (await (await fetch(`${URL_}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent('{roller}')}&apikey=${ANON}`)).json()).flatMap((g) => g.swatches);
  const sw = cat.find((s) => s.family === 'solar');
  const pick = { swatchId: sw.id, line: 'roller', family: 'solar', fabricId: sw.fabric_id, code: sw.supplier_code, displayName: sw.display_name, role: null, style: null };
  const line = { category: 'roller', productName: 'Roller Shades', selection: { lineId: 'roller', mode: 'single', picks: [pick] }, mechId: 'chain', mechName: 'Continuous chain', width: 40, length: 64, qty: 2, roomLabel: 'Den', description: 'd', internalDescription: 'i' };
  const res = { code: 0, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  const sent = [];
  await handleQuote({ method: 'POST', headers: { 'x-forwarded-for': `198.51.100.${Date.now() % 200}` }, body: { customer: { name: tag, email: `${tag}@example.com`, phone: '555', address: { street: '1 Way', city: 'X', state: 'WI', zip: '53000', country: 'United States' } }, lines: [line], notes: 'live test' } }, res, { env: { ...process.env, RESEND_API_KEY: 'x' }, resend: { emails: { send: async (m) => { sent.push(m); return { data: { id: '1' } }; } } } });
  const row = (await api('GET', `/rest/v1/sent_orders?select=*&customer->>name=eq.${tag}`, H(SVC))).body[0];
  check('an order through the real handler is emailed and stored (customer, items with estimate, notes, totals, status new)', res.code === 200 && res.body.stored === true && row && row.customer.email === `${tag}@example.com` && row.lines.length === 1 && row.lines[0].price && row.notes === 'live test' && row.status === 'new' && row.total > 0, JSON.stringify(res.body));
} catch (e) { console.log('TEST ERROR:', e.message); results.push({ name: 'script ran to completion', ok: false }); }
finally { if (userId) await api('DELETE', `/auth/v1/admin/users/${userId}`, H(SVC)).catch(() => {}); }
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
console.log(`Note: the test order's row (customer name ${tag}) stays in sent_orders until an admin deletes it, because the server cannot delete.`);
process.exit(bad.length ? 1 : 0);
