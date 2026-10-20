// Live tests of migration 13 against the real project (run after pasting the migration): the messages table (admins only), the
// rate-limit counter (server only), size_limits() (four numbers, public) and read-only sent orders. Uses a temporary customer and
// removes everything it creates. Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { handleContact } from '../../api/contact.js';
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const stamp = Date.now(); let userId, token; const tag = `zz-m13-${stamp}`;
try {
  const probe = await api('POST', '/rest/v1/rpc/rate_limit_hit', H(SVC), { p_key: `${tag}:probe`, p_limit: 1, p_window_seconds: 60 });
  if (probe.status === 404) { console.log('Migration 13 is not applied yet (rate_limit_hit does not exist). Paste supabase/migrations/20261019000013_messages_limits_and_sent_orders.sql into the SQL Editor, then run this again.'); process.exit(2); }

  // messages
  const anonRead = await api('GET', '/rest/v1/messages?select=id', H(ANON));
  const anonWrite = await api('POST', '/rest/v1/messages', H(ANON), { name: tag, email: 'a@b.c', message: 'x' });
  check('messages: the public can neither read nor write (the table is closed to the browser)', anonRead.status >= 400 && anonWrite.status >= 400 && !Array.isArray(anonRead.body), `read ${anonRead.status}, write ${anonWrite.status}`);
  const ins = await api('POST', '/rest/v1/messages', H(SVC), { name: tag, email: 'a@b.c', message: 'live test' });
  check('messages: the server (service role) can store a message; status starts as "new"', ins.status === 201 && ins.body[0].status === 'new' && ins.body[0].emailed === false, JSON.stringify(ins.body[0] || ins.body).slice(0, 120));

  const password = `Tmp-${crypto.randomUUID()}`;
  const cu = await api('POST', '/auth/v1/admin/users', H(SVC), { email: `${tag}@example.com`, password, email_confirm: true }); userId = cu.body.id;
  token = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email: `${tag}@example.com`, password })).body;
  const mine = await api('GET', '/rest/v1/messages?select=id', H(ANON, token.access_token));
  check('messages: a signed-in customer (not an admin) sees nothing', Array.isArray(mine.body) && mine.body.length === 0, JSON.stringify(mine.body).slice(0, 80));

  // contact endpoint end to end with a fake email service: the message lands in the table
  const sent = []; const res = { code: 0, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await handleContact({ method: 'POST', headers: { 'x-forwarded-for': `198.51.100.${stamp % 200}` }, body: { name: tag, email: `${tag}@example.com`, phone: '555', topic: 'General question', subject: 's', message: 'hello from the live test' } }, res, { env: { ...process.env, RESEND_API_KEY: 'x' }, resend: { emails: { send: async (m) => { sent.push(m); return { data: { id: '1' } }; } } } });
  const row = (await api('GET', `/rest/v1/messages?select=*&name=eq.${tag}&message=eq.hello from the live test`, H(SVC))).body[0];
  check('contact: a message through the real handler is emailed and stored (phone, topic, subject, message, created time, status)', res.code === 200 && res.body.stored && sent.length === 1 && row && row.phone === '555' && row.topic === 'General question' && row.status === 'new' && row.emailed === true && !!row.created_at, JSON.stringify(res.body));

  // rate limit counter
  const k = `${tag}:rl`; const hits = [];
  for (let i = 0; i < 4; i++) hits.push((await api('POST', '/rest/v1/rpc/rate_limit_hit', H(SVC), { p_key: k, p_limit: 3, p_window_seconds: 3600 })).body);
  check('rate limit: three hits allowed, the fourth refused (real database)', hits.join() === 'true,true,true,false', hits.join());
  const anonRl = await api('POST', '/rest/v1/rpc/rate_limit_hit', H(ANON), { p_key: k, p_limit: 3, p_window_seconds: 3600 });
  check('rate limit: the public cannot call it or read the counters', anonRl.status >= 400 && (await api('GET', '/rest/v1/rate_limits?select=key', H(ANON))).status >= 400);

  // size limits
  const roller = await api('POST', '/rest/v1/rpc/size_limits', H(ANON), { p_line: 'roller', p_options: {} });
  check('size limits: Roller from the supplier grids (smallest 23 x 24, largest 118 x 120), four numbers and a source, callable by the public', roller.status === 200 && roller.body.min_width === 23 && roller.body.min_height === 24 && roller.body.max_width === 118 && roller.body.max_height === 120 && roller.body.source === 'grid' && Object.keys(roller.body).sort().join() === 'max_height,max_width,min_height,min_width,source', JSON.stringify(roller.body));
  const dream = await api('POST', '/rest/v1/rpc/size_limits', H(ANON), { p_line: 'dream-curtains', p_options: {} });
  check('size limits: Dream Curtains from its grids', dream.body.min_width === 24 && dream.body.min_height === 12 && dream.body.max_width === 352, JSON.stringify(dream.body));
  const curt = await api('POST', '/rest/v1/rpc/size_limits', H(ANON), { p_line: 'drapery', p_options: {} });
  check('size limits: Curtains have none (price on request)', curt.body.min_width === null && curt.body.source === 'none', JSON.stringify(curt.body));
  const all = {}; for (const l of ['zebra', 'shangri-la', 'roman', 'cellular']) all[l] = (await api('POST', '/rest/v1/rpc/size_limits', H(ANON), { p_line: l, p_options: {} })).body;
  check('size limits: every other line has numbers too', Object.values(all).every((b) => b.min_width > 0 && b.min_height > 0 && b.max_width > b.min_width), JSON.stringify(all));

  // sent orders are read-only in the database
  const ord = (await api('POST', '/rest/v1/orders', H(ANON, token.access_token), { user_id: userId, name: 'T', items: [{ qty: 1 }], status: 'draft' })).body[0];
  await api('PATCH', `/rest/v1/orders?id=eq.${ord.id}`, H(ANON, token.access_token), { items: [{ qty: 2 }] });
  const send = await api('PATCH', `/rest/v1/orders?id=eq.${ord.id}`, H(ANON, token.access_token), { status: 'sent', items: [{ qty: 3 }], customer: { name: 'A' } });
  check('orders: a draft can be edited and then sent', send.status < 300 && send.body[0].status === 'sent' && send.body[0].items[0].qty === 3, `${send.status}`);
  const t1 = await api('PATCH', `/rest/v1/orders?id=eq.${ord.id}`, H(ANON, token.access_token), { items: [] });
  const t2 = await api('PATCH', `/rest/v1/orders?id=eq.${ord.id}`, H(ANON, token.access_token), { status: 'draft' });
  const t3 = await api('PATCH', `/rest/v1/orders?id=eq.${ord.id}`, H(ANON, token.access_token), { customer: {} });
  const now = (await api('GET', `/rest/v1/orders?select=items,status,customer&id=eq.${ord.id}`, H(ANON, token.access_token))).body[0];
  check('orders: the database refuses new items, reopening and new details on a sent order', t1.status >= 400 && t2.status >= 400 && t3.status >= 400 && now.items[0].qty === 3 && now.status === 'sent' && now.customer.name === 'A', `${t1.status}/${t2.status}/${t3.status}`);
  const rn = await api('PATCH', `/rest/v1/orders?id=eq.${ord.id}`, H(ANON, token.access_token), { name: 'Renamed' });
  check('orders: a sent order can still be renamed', rn.status < 300 && rn.body[0].name === 'Renamed');
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  if (token?.access_token) { const o = await api('GET', `/rest/v1/orders?select=id&user_id=eq.${userId}`, H(ANON, token.access_token)); for (const r of o.body || []) await api('DELETE', `/rest/v1/orders?id=eq.${r.id}`, H(ANON, token.access_token)); }
  await api('DELETE', `/rest/v1/messages?name=eq.${tag}`, H(SVC));
  await api('DELETE', `/rest/v1/rate_limits?key=like.${tag}*`, H(SVC));
  if (userId) await api('DELETE', `/auth/v1/admin/users/${userId}`, H(SVC));
  const left = (await api('GET', `/rest/v1/messages?select=id&name=eq.${tag}`, H(SVC))).body;
  console.log(`clean-up: messages left ${Array.isArray(left) ? left.length : 'n/a'}`);
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
