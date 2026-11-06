// One-off maintenance: lists (and with --delete removes) rows that earlier test runs left behind in the Supabase project the SUPABASE_* variables point to.
// It only looks for rows whose names clearly say they are tests (zz-m13-, zz-m14-, zz-m16-, zz-lp-, zz-lt-, zz-e2e..., test e-mails zz-...@example.com).
// Nothing is deleted without --delete. The tests themselves no longer leave anything behind (see supabase/tests/lib/liveGuard.mjs); this is only for the
// rows left by older versions of them. Sent orders can only be deleted by an admin, so a temporary admin is created for the job and removed again.
//   node scripts/cleanup-test-leftovers.mjs            (list only)
//   node scripts/cleanup-test-leftovers.mjs --delete
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DELETE = process.argv.includes('--delete');
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const TEST = 'zz-*';
const found = {
  sent_orders: (await api('GET', `/rest/v1/sent_orders?select=id,customer&customer->>name=like.${TEST}`, H(SVC))).body,
  messages: (await api('GET', `/rest/v1/messages?select=id,name&name=like.${TEST}`, H(SVC))).body,
  admins: (await api('GET', `/rest/v1/admins?select=id,email,user_id&email=like.${TEST}`, H(SVC))).body,
  swatches: (await api('GET', `/rest/v1/swatches?select=id&id=like.zz-*`, H(SVC))).body,
  fabrics: (await api('GET', `/rest/v1/fabrics?select=id&id=like.*zz-*`, H(SVC))).body,
  rate_limits: (await api('GET', `/rest/v1/rate_limits?select=key&key=like.zz-*`, H(SVC))).body,
  option_values: (await api('GET', `/rest/v1/option_values?select=id&code=like.zz-*`, H(SVC))).body,
  size_rules: (await api('GET', `/rest/v1/size_rules?select=id,subject&subject=like.*Zz*`, H(SVC))).body,
};
const users = []; for (let page = 1; page <= 10; page++) { const r = await api('GET', `/auth/v1/admin/users?page=${page}&per_page=200`, H(SVC)); const list = r.body?.users || []; users.push(...list.filter((u) => /^(zz-|rls-test-|merge|zz)/i.test(u.email || '') && /@example\.com$/.test(u.email))); if (list.length < 200) break; }
for (const [k, v] of Object.entries(found)) console.log(`${k}: ${Array.isArray(v) ? v.length : 'n/a'}`, Array.isArray(v) ? v.slice(0, 6).map((x) => x.id || x.key || x.email).join(', ') : '');
console.log(`test users (zz-*, rls-test-*@example.com): ${users.length}`, users.slice(0, 6).map((u) => u.email).join(', '));
if (!DELETE) { console.log('\nList only. Run again with --delete to remove them.'); process.exit(0); }
// a temporary admin removes the sent orders (the server key cannot)
const email = `zz-cleanup-${Date.now()}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
const cu = (await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true })).body; const row = (await api('POST', '/rest/v1/admins', H(SVC), { email, user_id: cu.id })).body[0];
const tok = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password })).body.access_token;
try {
  const ids = found.sent_orders.map((o) => o.id);
  if (ids.length) console.log('sent orders removed:', (await api('DELETE', `/rest/v1/sent_orders?id=in.(${ids.join(',')})`, H(ANON, tok))).body?.length);
  for (const [t, col] of [['messages', 'id'], ['swatches', 'id'], ['option_values', 'id'], ['size_rules', 'id']]) { const ids2 = (found[t] || []).map((x) => x[col]); if (ids2.length) console.log(`${t} removed:`, (await api('DELETE', `/rest/v1/${t}?${col}=in.(${ids2.map(encodeURIComponent).join(',')})`, H(SVC))).body?.length); }
  for (const f of found.fabrics) await api('DELETE', `/rest/v1/fabrics?id=eq.${encodeURIComponent(f.id)}`, H(SVC));
  for (const r of found.rate_limits) await api('DELETE', `/rest/v1/rate_limits?key=eq.${encodeURIComponent(r.key)}`, H(SVC));
  for (const a of found.admins) await api('DELETE', `/rest/v1/admins?id=eq.${a.id}`, H(SVC));
} finally {
  await api('DELETE', `/rest/v1/admins?id=eq.${row.id}`, H(SVC)); await api('DELETE', `/auth/v1/admin/users/${cu.id}`, H(SVC));
  for (const u of users) await api('DELETE', `/auth/v1/admin/users/${u.id}`, H(SVC));
}
console.log('done');
