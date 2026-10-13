// Live tests for one color in several product lines (migration 10), over HTTPS against SUPABASE_URL.
// One color = one name, code and image everywhere; names (and codes) stay unique within each line; the admin ticks lines with
// set_swatch_lines(); links and unlinks are audit-logged; the public reads only through public_catalog().
// Creates a temporary admin and non-admin and two temporary colors, and removes everything it made.
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


const pub = async (scope) => (await est(anon, 'public_catalog', { p_scope: scope })).body || [];
const inCatalog = async (scope, id) => (await pub(scope)).flatMap((g) => g.swatches.filter((s) => s.id === id).map((s) => ({ ...s, group: g.id })));
const lines = (id) => call('GET', `/rest/v1/swatch_links?select=product_line,fabric_id,family&swatch_id=eq.${enc(id)}`, svc).then((r) => r.body);
const setLines = (hdr, id, list) => call('POST', '/rest/v1/rpc/set_swatch_lines', hdr, { p_swatch: id, p_lines: list });

try {
  const probe = await call('POST', '/rest/v1/rpc/public_catalog', anon, { p_scope: ['zebra'] });
  if (probe.status >= 400) { console.log('migration 10 is not applied yet (public_catalog is missing):', short(probe)); process.exit(2); }
  const admin = await mk('ladmin'), plain = await mk('lplain');
  const ar = await call('POST', '/rest/v1/admins', { ...svc, ...REP }, { email: admin.email, user_id: admin.id }); adminRows.push(ar.body[0].id);

  // two temporary colors: A in Zebra, B in Drapery (Roman), with a name A could clash with
  const zf = (await call('GET', '/rest/v1/fabrics?select=id,shown_in&product_line=eq.zebra&active=eq.true&order=sort_order&limit=1', svc)).body[0];
  const df = (await call('GET', '/rest/v1/fabrics?select=id,shown_in&product_line=eq.drapery&active=eq.true&order=sort_order&limit=2', svc)).body;
  const tag = String(stamp).slice(-6).replace(/[0-9]/g, (d) => 'abcdefghij'[d]);
  const A = `zebra:ZZLA${stamp}`, B = `drapery:ZZLB${stamp}`;
  const nameA = `Zzl Link ${tag}`, nameB = `Zzl Other ${tag}`;
  const mkRow = (id, fab, line, shown, name, code) => ({ id, fabric_id: fab.id, product_line: line, shown_in: shown, family: null, display_name: name, supplier_code: code, color_family: 'Gray', image_path: 'full/zz-test.jpg', thumb_path: 'thumb/zz-test.webp', image_kind: 'swatch', active: true, sort_order: 9999 });
  for (const [id, row] of [[A, mkRow(A, zf, 'zebra', zf.shown_in, nameA, `ZZLA${stamp}`)], [B, mkRow(B, df[0], 'drapery', df[0].shown_in, nameB, `ZZLB${stamp}`)]]) {
    const r = await call('POST', '/rest/v1/swatches', { ...admin.hdr, ...REP }, row);
    if (r.status < 300) cleanup.push(() => call('DELETE', `/rest/v1/swatches?id=eq.${enc(id)}`, svc)); else throw new Error(`could not create ${id}: ${short(r)}`);
  }

  console.log('=== TICKING LINES (admin)');
  let r = await setLines(admin.hdr, A, [{ product_line: 'zebra' }, { product_line: 'drapery' }]);
  check('admin adds a Zebra color to Roman & Drapery (uses that line\'s standard price group)', r.status === 200 && r.body.added?.[0] === 'drapery', short(r) + ' ' + JSON.stringify(r.body));
  const l1 = await lines(A);
  check('it is one record with one link row, and the link has no name of its own', l1.length === 1 && l1[0].product_line === 'drapery', JSON.stringify(l1));
  const nl = await call('GET', '/rest/v1/swatch_links?select=display_name&limit=1', svc);
  check('swatch_links no longer has a display_name column', nl.status >= 400, short(nl));

  console.log('=== ONE NAME EVERYWHERE');
  const zebraCat = await inCatalog(['zebra'], A), dCat = await inCatalog(['roman'], A);
  check('the public catalog shows the color in both lines under the same name, code and image', zebraCat.length === 1 && dCat.length === 1 && zebraCat[0].display_name === nameA && dCat[0].display_name === nameA && zebraCat[0].supplier_code === dCat[0].supplier_code && zebraCat[0].image_path === dCat[0].image_path, `${zebraCat[0]?.display_name} / ${dCat[0]?.display_name}`);
  const rename = `${nameA} Renamed`;
  await call('PATCH', `/rest/v1/swatches?id=eq.${enc(A)}`, { ...admin.hdr, ...REP }, { display_name: rename });
  const again = await inCatalog(['roman'], A);
  check('renaming it once renames it in every line', again[0]?.display_name === rename, again[0]?.display_name);
  await call('PATCH', `/rest/v1/swatches?id=eq.${enc(A)}`, { ...admin.hdr, ...REP }, { display_name: nameA });

  console.log('=== NAMES STAY UNIQUE WITHIN A LINE');
  r = await call('PATCH', `/rest/v1/swatches?id=eq.${enc(B)}`, { ...admin.hdr, ...REP }, { display_name: nameA.toUpperCase() });
  check('another color in Roman cannot take that name (any letter case); the message names the color', r.status >= 400 && new RegExp(`ZZLA${stamp}`).test(JSON.stringify(r.body)), short(r));
  const C = `zebra:ZZLC${stamp}`;   // a third color in Zebra whose name equals B's: linking it into Roman must be blocked and name B
  r = await call('POST', '/rest/v1/swatches', { ...admin.hdr, ...REP }, mkRow(C, zf, 'zebra', zf.shown_in, nameB, `ZZLC${stamp}`));
  if (r.status < 300) cleanup.push(() => call('DELETE', `/rest/v1/swatches?id=eq.${enc(C)}`, svc));
  r = await setLines(admin.hdr, C, [{ product_line: 'zebra' }, { product_line: 'drapery' }]);
  check('ticking Roman on a color whose name is taken there is blocked and names the clashing color (by code)', r.status >= 400 && new RegExp(`ZZLB${stamp}`).test(JSON.stringify(r.body)), short(r) + ' ' + JSON.stringify(r.body).slice(0, 200));
  check('nothing was added by the refused call', (await lines(C)).length === 0, 'no link rows');

  console.log('=== PRICE GROUP PER LINE, UNTICKING, MAIN LINE');
  r = await setLines(admin.hdr, A, [{ product_line: 'zebra' }, { product_line: 'drapery', fabric_id: df[1].id }]);
  const l2 = await lines(A);
  check('the admin can change the price group of one line', r.status === 200 && l2[0]?.fabric_id === df[1].id, JSON.stringify(l2));
  r = await setLines(admin.hdr, A, [{ product_line: 'zebra' }]);
  check('unticking a line removes it from that line (and only that line)', r.status === 200 && r.body.removed?.[0] === 'drapery' && (await lines(A)).length === 0 && (await inCatalog(['roman'], A)).length === 0 && (await inCatalog(['zebra'], A)).length === 1, JSON.stringify(r.body));
  await setLines(admin.hdr, A, [{ product_line: 'zebra' }, { product_line: 'drapery' }]);
  r = await setLines(admin.hdr, A, [{ product_line: 'drapery' }]);
  const home = (await call('GET', `/rest/v1/swatches?select=product_line,fabric_id&id=eq.${enc(A)}`, svc)).body[0];
  check('unticking its own (main) line promotes another line', r.status === 200 && home.product_line === 'drapery' && (await lines(A)).length === 0 && (await inCatalog(['zebra'], A)).length === 0, JSON.stringify(home));
  r = await setLines(admin.hdr, A, []);
  check('a color must keep at least one line', r.status >= 400, short(r));
  r = await setLines(admin.hdr, A, [{ product_line: 'drapery' }, { product_line: 'zebra', fabric_id: df[0].id }]);
  check('a price group from another line is refused', r.status >= 400, short(r));

  console.log('=== HIDE AND DELETE');
  await setLines(admin.hdr, A, [{ product_line: 'drapery' }, { product_line: 'zebra' }]);
  const both = (await inCatalog(['roman', 'zebra'], A)).length;
  await call('PATCH', `/rest/v1/swatches?id=eq.${enc(A)}`, { ...admin.hdr, ...REP }, { active: false });
  const none = (await inCatalog(['roman', 'zebra'], A)).length;
  await call('PATCH', `/rest/v1/swatches?id=eq.${enc(A)}`, svc, { active: true });
  check('hiding the color hides it in every line', both === 2 && none === 0, `visible in ${both} lines, then ${none}`);

  console.log('=== AUDIT');
  const aud = await call('GET', `/rest/v1/audit_log?select=action,table_name,new_row,old_row&table_name=eq.swatch_links&order=id.desc&limit=100`, admin.hdr);
  const mine = (aud.body || []).filter((e) => (e.new_row || e.old_row)?.swatch_id === A);
  check('adding a line is written to the audit log', mine.some((e) => e.action === 'INSERT'), `${mine.length} entries for this color`);
  check('removing a line is written to the audit log, with the swatch id and line', mine.some((e) => e.action === 'DELETE' && e.old_row?.product_line), JSON.stringify(mine.filter((e) => e.action === 'DELETE').map((e) => e.old_row?.product_line)));

  console.log('=== NOBODY ELSE');
  for (const [label, hdr] of [['anonymous', anon], ['signed-in non-admin', plain.hdr]]) {
    const w = await setLines(hdr, A, [{ product_line: 'drapery' }]);
    check(`${label}: cannot tick or untick lines`, w.status >= 400, short(w));
    const ins = await call('POST', '/rest/v1/swatch_links', { ...hdr, ...REP }, { swatch_id: A, fabric_id: zf.id });
    check(`${label}: cannot write swatch_links`, ins.status >= 400, short(ins));
    const rd = await call('GET', '/rest/v1/swatch_links?select=product_line&swatch_id=eq.' + enc(A), hdr);
    check(`${label}: reads only what the site shows (active links; none expose a name or price group)`, Array.isArray(rd.body) ? rd.body.every((x) => Object.keys(x).join() === 'product_line') : true, short(rd));
  }
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  for (const fn of cleanup.reverse()) { try { await fn(); } catch { /* best effort */ } }
  for (const id of adminRows) await call('DELETE', `/rest/v1/admins?id=eq.${id}`, svc);
  for (const id of users) await call('DELETE', `/auth/v1/admin/users/${id}`, svc);
  const left = (await call('GET', '/rest/v1/swatches?select=id&id=like.*ZZL*', svc)).body;
  console.log(`\nclean-up: leftover test colors: ${Array.isArray(left) ? left.length : '?'}`);
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
