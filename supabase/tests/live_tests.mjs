// Live constraint + RLS tests over HTTPS against the project in SUPABASE_URL. Plain fetch, no dependencies.
// Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Creates a temporary non-admin user and deletes it.
// Usage: node supabase/tests/live_tests.mjs
// REQUIRE_CLOSED=1: also assert that migration 11 (closing the public's direct table reads) is applied.
const REQUIRE_CLOSED = process.env.REQUIRE_CLOSED === '1';
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (key, bearer = key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...extra });
const call = async (method, path, headers, body) => {
  const r = await fetch(URL_ + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};
const short = (r) => `HTTP ${r.status} ${typeof r.body === 'object' ? (r.body?.code ? r.body.code + ' ' : '') + (r.body?.message ?? (Array.isArray(r.body) ? `[${r.body.length} rows]` : JSON.stringify(r.body).slice(0, 120))) : String(r.body).slice(0, 120)}`;
const results = []; const strays = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`); };
const PRE = 'Prefer';

// --- real rows to build realistic tests from
const svc = H(SVC);
const zebraSw = (await call('GET', '/rest/v1/swatches?product_line=eq.zebra&select=*&order=sort_order&limit=2', svc)).body;
const a = zebraSw[0], b = zebraSw[1];
const base = (o) => ({ fabric_id: a.fabric_id, product_line: 'zebra', shown_in: ['zebra'], family: null, color_family: 'Gray', image_path: a.image_path, thumb_path: a.thumb_path, ...o });
const tryInsert = async (hdr, row) => { const r = await call('POST', '/rest/v1/swatches', hdr, row); if (r.status < 300) strays.push(row.id); return r; };

console.log(`\n=== CONSTRAINTS (service role, which bypasses RLS: only the database's own rules can stop these) ===`);
let r = await tryInsert(H(SVC, SVC, { [PRE]: 'return=minimal' }), base({ id: 'zz-test:dupname', display_name: a.display_name.toUpperCase(), supplier_code: 'ZZTESTDUP1' }));
check('1 duplicate display name in the same scope (zebra, different case)', r.status === 409 && /duplicate|unique/i.test(JSON.stringify(r.body)), short(r) + ` [constraint: ${r.body?.message?.match(/"([^"]+)"/)?.[1] ?? ''}]`);
r = await tryInsert(H(SVC, SVC, { [PRE]: 'return=minimal' }), base({ id: 'zz-test:digit', display_name: 'Gray 5', supplier_code: 'ZZTESTDIG1' }));
check('2 display name containing a digit', r.status >= 400 && /swatches_display_name_no_digit/.test(JSON.stringify(r.body)), short(r) + ` [${r.body?.message?.match(/constraint "([^"]+)"/)?.[1] ?? ''}]`);
r = await tryInsert(H(SVC, SVC, { [PRE]: 'return=minimal' }), base({ id: 'zz-test:dupcode', display_name: 'Zzqx Testing Gray', supplier_code: a.supplier_code.toLowerCase() }));
check('3 duplicate supplier code in the same line (different case)', r.status === 409 && /duplicate|unique/i.test(JSON.stringify(r.body)), short(r) + ` [${r.body?.message?.match(/"([^"]+)"/)?.[1] ?? ''}]`);

// --- temporary non-admin user
const email = `rls-test-${Date.now()}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
let userId = null;
try {
  const cu = await call('POST', '/auth/v1/admin/users', svc, { email, password, email_confirm: true });
  userId = cu.body?.id;
  console.log(`\ntemporary user created: ${userId ? 'yes' : 'NO'} (${email})`);
  const tok = await call('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password });
  const jwt = tok.body?.access_token;
  if (!userId || !jwt) throw new Error('could not create/sign in test user: ' + short(tok));
  const user = H(ANON, jwt), anon = H(ANON);

  const before = (await call('GET', `/rest/v1/swatches?id=eq.${encodeURIComponent(a.id)}&select=display_name,active`, svc)).body[0];
  const newRow = base({ id: 'zz-test:nonadmin', display_name: 'Zzqx Writer Gray', supplier_code: 'ZZTESTW1' });
  const upd = { display_name: 'Hacked Name' };
  const rep = { [PRE]: 'return=representation' };
  const cntSvc = (await call('GET', '/rest/v1/swatches?select=id', H(SVC, SVC, { [PRE]: 'count=exact', Range: '0-0' })));

  for (const [label, hdr] of [['ANONYMOUS', anon], ['SIGNED-IN NON-ADMIN', user]]) {
    console.log(`\n=== ${label} ===`);
    // price group names live in fabrics (and ids carry them): the public no longer reads the tables, only the catalog function
    const c = await call('GET', '/rest/v1/swatches?select=id', { ...hdr, [PRE]: 'count=exact', Range: '0-0' });
    const rng = await fetch(URL_ + '/rest/v1/swatches?select=id', { headers: { ...hdr, [PRE]: 'count=exact', Range: '0-0' } });
    const seen = Number((rng.headers.get('content-range') || '').split('/')[1]) || 0;
    const closed = c.status >= 400 || seen === 0;
    check(`${label} direct reads of the swatches table: ${REQUIRE_CLOSED ? 'closed (migration 11)' : 'open until migration 11 (the live site on main still reads them)'}`, REQUIRE_CLOSED ? closed : true, `HTTP ${c.status}, rows visible: ${seen}${closed ? '' : ' (still open)'}`);
    const f = await fetch(URL_ + '/rest/v1/fabrics?select=id', { headers: { ...hdr, [PRE]: 'count=exact', Range: '0-0' } });
    const fseen = Number((f.headers.get('content-range') || '').split('/')[1]) || 0;
    check(`${label} direct reads of the fabrics (price groups) table: ${REQUIRE_CLOSED ? 'closed (migration 11)' : 'open until migration 11'}`, REQUIRE_CLOSED ? (f.status >= 400 || fseen === 0) : true, `HTTP ${f.status}, rows visible: ${fseen}`);
    const cat = await call('POST', '/rest/v1/rpc/public_catalog', hdr, { p_scope: ['roller', 'zebra', 'shangri-la', 'cellular', 'roman', 'drapery', 'dream-curtains'] });
    const ids = new Set((cat.body || []).flatMap((g) => g.swatches.map((x) => x.id)));
    check(`${label} can read the catalog through public_catalog() (437 colors, 89 groups)`, cat.status === 200 && ids.size === 437 && cat.body.length === 89, `HTTP ${cat.status}, ${ids.size} colors, ${cat.body?.length} groups`);
    r = await tryInsert({ ...hdr, ...rep }, newRow);
    check(`${label} INSERT swatch is refused`, r.status === 401 || r.status === 403, short(r));
    r = await call('PATCH', `/rest/v1/swatches?id=eq.${encodeURIComponent(a.id)}`, { ...hdr, ...rep }, upd);
    check(`${label} UPDATE swatch is refused`, (r.status >= 400) || (Array.isArray(r.body) && r.body.length === 0), short(r) + (Array.isArray(r.body) ? ' (0 rows changed)' : ''));
    r = await call('DELETE', `/rest/v1/swatches?id=eq.${encodeURIComponent(a.id)}`, { ...hdr, ...rep });
    check(`${label} DELETE swatch is refused`, (r.status >= 400) || (Array.isArray(r.body) && r.body.length === 0), short(r) + (Array.isArray(r.body) ? ' (0 rows deleted)' : ''));
    r = await call('PATCH', `/rest/v1/fabrics?id=eq.${encodeURIComponent(a.fabric_id)}`, { ...hdr, ...rep }, { collection_name: 'Hacked' });
    check(`${label} UPDATE fabric is refused`, (r.status >= 400) || (Array.isArray(r.body) && r.body.length === 0), short(r) + (Array.isArray(r.body) ? ' (0 rows changed)' : ''));
    r = await call('GET', '/rest/v1/admins?select=email', hdr);
    check(`${label} cannot read the admin list`, r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0), short(r));
    r = await call('POST', '/storage/v1/object/swatches/full/zz-test.jpg', { apikey: ANON, Authorization: hdr.Authorization, 'Content-Type': 'image/jpeg' });
    check(`${label} storage upload is refused`, r.status >= 400, short(r));
    r = await call('POST', '/rest/v1/rpc/is_admin', hdr, {});
    check(`${label} is_admin() = false`, r.body === false, short(r) + ` -> ${JSON.stringify(r.body)}`);
  }
  const after = (await call('GET', `/rest/v1/swatches?id=eq.${encodeURIComponent(a.id)}&select=display_name,active`, svc)).body[0];
  check('swatch unchanged after all attempts', JSON.stringify(before) === JSON.stringify(after), `before ${JSON.stringify(before)} / after ${JSON.stringify(after)}`);
  const pub = await fetch(URL_ + `/storage/v1/object/public/swatches/${a.thumb_path}`);
  check('swatch images are publicly readable', pub.status === 200, `GET public thumb ${a.thumb_path} -> HTTP ${pub.status}`);
} finally {
  for (const id of strays) await call('DELETE', `/rest/v1/swatches?id=eq.${encodeURIComponent(id)}`, svc);
  if (strays.length) console.log(`\nWARNING: unexpected rows were created and deleted: ${strays.join(', ')}`);
  if (userId) {
    const d = await call('DELETE', `/auth/v1/admin/users/${userId}`, svc);
    const g = await call('GET', `/auth/v1/admin/users/${userId}`, svc);
    console.log(`\ntemporary user deleted: HTTP ${d.status}; lookup afterwards -> HTTP ${g.status} (404 = gone)`);
  }
}
const bad = results.filter(x => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ' | FAILED: ' + bad.map(x => x.name).join('; ') : ''}`);
