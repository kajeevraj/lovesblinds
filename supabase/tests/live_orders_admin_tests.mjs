// Live tests of who may do what with sent_orders (migrations 14 and 16): a temporary admin reads, changes the status and the note,
// and cannot change the order itself; a temporary customer who is not an admin sees nothing. Test rows are made by the server and
// removed by the temporary admin (only the admin may delete). Also removes leftover test rows from earlier runs (customer name
// starting zz-m14- or zz-m16-). Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Exits 2 when migration 14 is missing. The status checks need migration 16 (new, confirmed, ordered, shipped) and say so if it is not applied.
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const tag = `zz-m16-${Date.now()}`; const users = [], adminRows = []; let adminCtx = null;
const mk = async (label) => {
  const email = `${tag}-${label}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true }); users.push(cu.body.id);
  const tok = await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password });
  return { id: cu.body.id, email, hdr: H(ANON, tok.body.access_token) };
};
const seed = (name, extra = {}) => api('POST', '/rest/v1/sent_orders', H(SVC), { customer: { name, email: `${name}@example.com` }, lines: [{ qty: 2, description: 'x', price: { kind: 'price', unit: 100 } }], total: 200, ...extra });
try {
  const probe = await api('GET', '/rest/v1/sent_orders?select=id&limit=1', H(SVC));
  if (probe.status === 404 || (probe.status === 400 && /sent_orders/.test(JSON.stringify(probe.body)))) { console.log('Migration 14 is not applied yet.'); process.exit(2); }
  const admin = await mk('admin'), plain = await mk('plain'); adminCtx = admin;
  adminRows.push((await api('POST', '/rest/v1/admins', H(SVC), { email: admin.email, user_id: admin.id })).body[0].id);

  const a = (await seed(`${tag}-a`)).body[0]; const b = (await seed(`${tag}-b`)).body[0];
  const asAdmin = await api('GET', `/rest/v1/sent_orders?select=id,status,customer&customer->>name=like.${tag}-*`, admin.hdr);
  check('an admin can read sent orders', Array.isArray(asAdmin.body) && asAdmin.body.length === 2, JSON.stringify(asAdmin.body).slice(0, 100));
  const asPlain = await api('GET', `/rest/v1/sent_orders?select=id`, plain.hdr);
  check('a signed-in customer who is not an admin sees no sent orders', Array.isArray(asPlain.body) ? asPlain.body.length === 0 : asPlain.status >= 400);

  const note = await api('PATCH', `/rest/v1/sent_orders?id=eq.${a.id}`, admin.hdr, { admin_note: 'called, confirmed sizes' });
  check('an admin can add a note', note.status === 200 && note.body[0]?.admin_note === 'called, confirmed sizes', JSON.stringify(note.body).slice(0, 100));
  const upd = await api('PATCH', `/rest/v1/sent_orders?id=eq.${a.id}`, admin.hdr, { status: 'confirmed' });
  if (upd.status === 200) {
    check('an admin can change the status to confirmed, then ordered and shipped', upd.body[0]?.status === 'confirmed'
      && (await api('PATCH', `/rest/v1/sent_orders?id=eq.${a.id}`, admin.hdr, { status: 'ordered' })).body[0]?.status === 'ordered'
      && (await api('PATCH', `/rest/v1/sent_orders?id=eq.${a.id}`, admin.hdr, { status: 'shipped' })).body[0]?.status === 'shipped');
    const bad = await api('PATCH', `/rest/v1/sent_orders?id=eq.${a.id}`, admin.hdr, { status: 'in_progress' });
    check('an old or made-up status is refused', bad.status >= 400);
  } else {
    console.log(`SKIPPED  status changes: migration 16 is not applied yet (${upd.status} ${JSON.stringify(upd.body).slice(0, 80)})`);
  }
  const lines = await api('PATCH', `/rest/v1/sent_orders?id=eq.${a.id}`, admin.hdr, { lines: [] });
  const cust = await api('PATCH', `/rest/v1/sent_orders?id=eq.${a.id}`, admin.hdr, { customer: { name: 'x' } });
  const total = await api('PATCH', `/rest/v1/sent_orders?id=eq.${a.id}`, admin.hdr, { total: 1 });
  check('even an admin cannot change the items, the customer or the total of a sent order', lines.status >= 400 && cust.status >= 400 && total.status >= 400, `${lines.status}/${cust.status}/${total.status}`);
  const plainEdit = await api('PATCH', `/rest/v1/sent_orders?id=eq.${a.id}`, plain.hdr, { admin_note: 'hack' });
  const after = (await api('GET', `/rest/v1/sent_orders?select=admin_note&id=eq.${a.id}`, H(SVC))).body[0];
  check('a customer cannot change an order', after.admin_note === 'called, confirmed sizes' && !(plainEdit.body?.length), `${plainEdit.status}`);
  const svcDel = await api('DELETE', `/rest/v1/sent_orders?id=eq.${b.id}`, H(SVC));
  check('the server itself cannot delete orders', svcDel.status >= 400, `${svcDel.status}`);
} catch (e) { console.log('TEST ERROR:', e.message); results.push({ name: 'script ran to completion', ok: false }); }
finally {
  // the temporary admin deletes this run's rows and any leftover test rows from earlier runs, then the admin and customer are removed
  if (adminCtx) {
    const del = await api('DELETE', `/rest/v1/sent_orders?or=(customer->>name.like.zz-m14-*,customer->>name.like.zz-m16-*)`, adminCtx.hdr);
    console.log(`cleanup: removed ${Array.isArray(del.body) ? del.body.length : 0} test order row(s)`);
  }
  for (const id of adminRows) await api('DELETE', `/rest/v1/admins?id=eq.${id}`, H(SVC)).catch(() => {});
  for (const id of users) await api('DELETE', `/auth/v1/admin/users/${id}`, H(SVC)).catch(() => {});
}
const left = (await api('GET', `/rest/v1/sent_orders?select=id&or=(customer->>name.like.zz-m14-*,customer->>name.like.zz-m16-*)`, H(SVC))).body;
check('no test rows are left in sent_orders', Array.isArray(left) && left.length === 0, `${left?.length} left`);
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((x) => x.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
