// Live tests for linked swatches (migration 9: one swatch record in several product lines), over HTTPS against SUPABASE_URL.
// Needs migration 9. Creates a temporary admin and non-admin, links two real swatches, checks every rule, and removes what it made.
// Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.   Usage: node supabase/tests/live_links_tests.mjs
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (key, bearer = key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...extra });
const call = async (method, path, headers, body, raw) => {
  const r = await fetch(URL_ + path, { method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};
const short = (r) => `HTTP ${r.status} ${typeof r.body === 'object' && r.body ? (r.body.code ? r.body.code + ' ' : '') + (r.body.message ?? (Array.isArray(r.body) ? `[${r.body.length} rows]` : JSON.stringify(r.body).slice(0, 100))) : String(r.body).slice(0, 100)}`;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`); };
const refused = (r) => r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0);
const REP = { Prefer: 'return=representation' };
const svc = H(SVC); const anon = H(ANON); const enc = encodeURIComponent;
const stamp = Date.now();
const users = [], adminRows = [], cleanup = [];

const mk = async (label) => {
  const email = `zz-${label}-${stamp}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await call('POST', '/auth/v1/admin/users', svc, { email, password, email_confirm: true });
  if (!cu.body?.id) throw new Error(`could not create ${label}: ${short(cu)}`); users.push(cu.body.id);
  const tok = await call('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password });
  if (!tok.body?.access_token) throw new Error(`could not sign in ${label}`);
  return { id: cu.body.id, email, hdr: H(ANON, tok.body.access_token) };
};
const est = (hdr, fn, args) => call('POST', `/rest/v1/rpc/${fn}`, hdr, args);
const sel = encodeURIComponent('id,product_line,shown_in,swatches:swatches!fabric_id(id,display_name),swatch_links(id,display_name,swatch:swatches!swatch_id(id,supplier_code))');
try {
  const probe = await call('GET', '/rest/v1/swatch_links?select=id&limit=1', svc);
  if (probe.status >= 400) { console.log('swatch_links is not there yet: run migration 9 first.', short(probe)); process.exit(2); }
  const admin = await mk('ladmin'), plain = await mk('lplain');
  const ar = await call('POST', '/rest/v1/admins', { ...svc, ...REP }, { email: admin.email, user_id: admin.id }); adminRows.push(ar.body[0].id);

  // a real roller swatch to link into Roman (drapery), and a drapery collection to receive it
  const rs = (await call('GET', '/rest/v1/swatches?select=id,display_name,supplier_code&product_line=eq.roller&active=eq.true&limit=1', svc)).body[0];
  const fab = (await call('GET', '/rest/v1/fabrics?select=id,product_line,shown_in&product_line=eq.drapery&active=eq.true&limit=2', svc)).body;
  const name = `Zz Linked ${stamp}`.replace(/[0-9]/g, (d) => 'abcdefghij'[d]);
  const link = (extra = {}) => call('POST', '/rest/v1/swatch_links', { ...admin.hdr, ...REP }, { swatch_id: rs.id, fabric_id: fab[0].id, display_name: name, ...extra });

  console.log('=== ADMIN');
  let r = await link();
  const linkId = r.body?.[0]?.id; if (linkId) cleanup.push(() => call('DELETE', `/rest/v1/swatch_links?id=eq.${linkId}`, svc));
  check('admin links a roller swatch into a drapery collection (product_line filled from the collection)', r.status === 201 && r.body[0].product_line === 'drapery', short(r));
  r = await link({ fabric_id: fab[1].id, display_name: `${name} Two` });
  check('the same swatch cannot be placed twice in one line', r.status >= 400, short(r));
  const home = (await call('GET', `/rest/v1/fabrics?select=id&product_line=eq.roller&limit=1`, svc)).body[0];
  r = await call('POST', '/rest/v1/swatch_links', { ...admin.hdr, ...REP }, { swatch_id: rs.id, fabric_id: home.id, display_name: `${name} Home` });
  check('a swatch cannot be linked into its own line', r.status >= 400, short(r));
  const other = (await call('GET', '/rest/v1/swatches?select=id&product_line=eq.roller&active=eq.true&limit=2', svc)).body.find((x) => x.id !== rs.id);
  r = await call('POST', '/rest/v1/swatch_links', { ...admin.hdr, ...REP }, { swatch_id: other.id, fabric_id: fab[0].id, display_name: name.toUpperCase() });
  check('a second color cannot take the same display name in that line (any case)', r.status >= 400, short(r));
  r = await call('POST', '/rest/v1/swatch_links', { ...admin.hdr, ...REP }, { swatch_id: other.id, fabric_id: fab[0].id, display_name: 'Zz With 9 Digit' });
  check('a display name with a digit is refused', r.status >= 400, short(r));

  console.log('=== WHAT THE SITE READS');
  const lineRows = (await call('GET', `/rest/v1/fabrics?select=${sel}&id=eq.${enc(fab[0].id)}`, anon)).body;
  const seen = lineRows?.[0]?.swatch_links?.find((l) => l.id === linkId);
  check('the catalog query (anonymous) returns the placement with its own name and the shared swatch record', seen?.display_name === name && seen?.swatch?.id === rs.id && seen.swatch.supplier_code === rs.supplier_code, JSON.stringify(seen));
  const own = (await call('GET', `/rest/v1/fabrics?select=${sel}&id=eq.${enc(home.id)}`, anon)).body?.[0];
  check('the swatch still appears in its own line under its own name', own?.swatches?.some((s) => s.id === rs.id && s.display_name === rs.display_name), `${own?.swatches?.length} swatches`);

  console.log('=== HIDE ONCE, HIDDEN EVERYWHERE');
  await call('PATCH', `/rest/v1/swatches?id=eq.${enc(rs.id)}`, { ...admin.hdr, ...REP }, { active: false });
  const hidden = (await call('GET', `/rest/v1/fabrics?select=${sel}&id=eq.${enc(fab[0].id)}`, anon)).body?.[0];
  check('hiding the swatch hides its placement in the other line too', !(hidden?.swatch_links || []).some((l) => l.swatch && l.id === linkId), JSON.stringify(hidden?.swatch_links?.filter((l) => l.id === linkId)));
  await call('PATCH', `/rest/v1/swatches?id=eq.${enc(rs.id)}`, svc, { active: true });

  console.log('=== AUDIT');
  const aud = await call('GET', `/rest/v1/audit_log?select=action,table_name&table_name=eq.swatch_links&row_id=eq.${linkId}`, admin.hdr);
  check('linking is written to the audit log', Array.isArray(aud.body) && aud.body.some((a) => a.action === 'INSERT'), JSON.stringify(aud.body));
  r = await call('DELETE', `/rest/v1/swatch_links?id=eq.${linkId}`, { ...admin.hdr, ...REP });
  check('admin unlinks', r.status === 200 && r.body.length === 1, short(r));
  const aud2 = await call('GET', `/rest/v1/audit_log?select=action,old_row&table_name=eq.swatch_links&row_id=eq.${linkId}`, admin.hdr);
  check('unlinking is written to the audit log with the swatch id', aud2.body.some((a) => a.action === 'DELETE' && a.old_row?.swatch_id === rs.id), JSON.stringify(aud2.body).slice(0, 200));

  console.log('=== NOBODY ELSE');
  for (const [label, hdr] of [['anonymous', anon], ['signed-in non-admin', plain.hdr]]) {
    const w = await call('POST', '/rest/v1/swatch_links', { ...hdr, ...REP }, { swatch_id: rs.id, fabric_id: fab[0].id, display_name: `${name} Nope` });
    const rd = await call('GET', '/rest/v1/swatch_links?select=id&limit=1', hdr);
    check(`${label}: cannot create a link`, w.status >= 400, short(w));
    check(`${label}: reads only active placements (none of this test's)`, !JSON.stringify(rd.body).includes(linkId), `${Array.isArray(rd.body) ? rd.body.length : '-'} rows visible`);
  }
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  for (const fn of cleanup.reverse()) { try { await fn(); } catch { /* best effort */ } }
  for (const id of adminRows) await call('DELETE', `/rest/v1/admins?id=eq.${id}`, svc);
  for (const id of users) await call('DELETE', `/auth/v1/admin/users/${id}`, svc);
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
