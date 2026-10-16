// Live admin tests over HTTPS against the project in SUPABASE_URL. Creates a temporary admin user and a temporary
// non-admin user (plus a throwaway collection, color, images and saved order), checks what each may do, then deletes ALL
// of it. Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// The audit_log is append-only by design, so the entries these tests cause (row ids starting "zz-test") stay in it.
// Usage: node supabase/tests/live_admin_tests.mjs
import sharp from 'sharp';
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (key, bearer = key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...extra });
const call = async (method, path, headers, body, raw) => {
  const r = await fetch(URL_ + path, { method, headers, body: raw ? body : body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j, headers: r.headers };
};
const short = (r) => `HTTP ${r.status} ${typeof r.body === 'object' && r.body ? (r.body.code ? r.body.code + ' ' : '') + (r.body.message ?? (Array.isArray(r.body) ? `[${r.body.length} rows]` : JSON.stringify(r.body).slice(0, 120))) : String(r.body).slice(0, 120)}`;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`); };
const refused = (r) => r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0);
const REP = { Prefer: 'return=representation' };
const svc = H(SVC);
const enc = encodeURIComponent;
// is this color in what the public site reads? (the public no longer reads the tables; it calls public_catalog)
const pubHas = async (id) => { const r = await call('POST', '/rest/v1/rpc/public_catalog', H(ANON), { p_scope: ['zebra'] }); return (r.body || []).some((g) => g.swatches.some((x) => x.id === id)) ? 1 : 0; };

const stamp = Date.now();
const FAB = `zebra:-:zz-test-${stamp}`, SW = `zebra:ZZTEST${stamp}`, CODE = `ZZTEST${stamp}`, COLL = 'Zztestcoll';
const created = { users: [], admins: [], fabrics: [], swatches: [], orders: [], files: [] };
let plainHdr = null;
const mkUser = async (label) => {
  const email = `${label}-${stamp}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await call('POST', '/auth/v1/admin/users', svc, { email, password, email_confirm: true });
  if (!cu.body?.id) throw new Error(`could not create ${label} user: ${short(cu)}`);
  created.users.push(cu.body.id);
  const tok = await call('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password });
  if (!tok.body?.access_token) throw new Error(`could not sign in ${label}: ${short(tok)}`);
  return { id: cu.body.id, email, hdr: H(ANON, tok.body.access_token) };
};
const jpeg = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#8899aa' } }).jpeg().toBuffer();
const webp = await sharp({ create: { width: 320, height: 320, channels: 3, background: '#8899aa' } }).webp().toBuffer();
const upload = (hdr, path, buf, type) => call('POST', `/storage/v1/object/swatches/${path}`, { apikey: ANON, Authorization: hdr.Authorization, 'Content-Type': type, 'cache-control': 'max-age=86400' }, buf, true);
const anon = H(ANON);
// Is the object still stored? (the list endpoint reads the database; GETs of the file can be answered from a CDN cache)
const stored = async (path) => { const i = path.lastIndexOf('/'); const x = await call('POST', '/storage/v1/object/list/swatches', svc, { prefix: path.slice(0, i), search: path.slice(i + 1), limit: 5 }); return Array.isArray(x.body) && x.body.some(o => o.name === path.slice(i + 1)); };

try {
  const admin = await mkUser('zz-admin');
  const plain = await mkUser('zz-nonadmin'); plainHdr = plain.hdr;
  const ar = await call('POST', '/rest/v1/admins', { ...svc, ...REP }, { email: admin.email, user_id: admin.id });
  if (ar.status >= 300) throw new Error('could not add temporary admin row: ' + short(ar));
  created.admins.push(ar.body[0].id);
  console.log(`temporary admin ${admin.email} and non-admin ${plain.email} created\n`);

  const imgPath = `full/zebra/zz-test-${stamp}.jpg`, thumbPath = `thumb/zebra/zz-test-${stamp}.webp`;
  const row = { id: SW, fabric_id: FAB, product_line: 'zebra', shown_in: ['zebra'], family: null, display_name: 'Zzqx Test Color', supplier_code: CODE, supplier_color_name: 'Test', color_family: 'Gray', image_path: imgPath, thumb_path: thumbPath, image_kind: 'swatch', active: true, sort_order: 9999 };

  console.log('=== ADMIN ===');
  let r = await call('POST', '/rest/v1/rpc/is_admin', admin.hdr, {});
  check('admin: is_admin() = true', r.body === true, short(r));
  const cnt = async (hdr, path) => { const x = await fetch(URL_ + path, { headers: { ...hdr, Prefer: 'count=exact', Range: '0-0' } }); return Number((x.headers.get('content-range') || '').split('/')[1]); };

  r = await call('POST', '/rest/v1/fabrics', { ...admin.hdr, ...REP }, { id: FAB, product_line: 'zebra', shown_in: ['zebra'], family: null, collection_name: COLL, width: '118 in', active: true, sort_order: 9999 });
  if (r.status < 300) created.fabrics.push(FAB);
  check('admin: can add a collection', r.status === 201, short(r));

  r = await upload(admin.hdr, imgPath, jpeg, 'image/jpeg'); if (r.status < 300) created.files.push(imgPath);
  check('admin: can upload a full image', r.status === 200, short(r));
  r = await upload(admin.hdr, thumbPath, webp, 'image/webp'); if (r.status < 300) created.files.push(thumbPath);
  check('admin: can upload a thumbnail', r.status === 200, short(r));
  const pub = await fetch(`${URL_}/storage/v1/object/public/swatches/${thumbPath}`);
  check('uploaded image is public and cached for 24 hours', pub.status === 200 && /max-age=86400/.test(pub.headers.get('cache-control') || ''), `HTTP ${pub.status}, cache-control: ${pub.headers.get('cache-control')}`);

  r = await call('POST', '/rest/v1/swatches', { ...admin.hdr, ...REP }, row); if (r.status < 300) created.swatches.push(SW);
  check('admin: can add a color', r.status === 201, short(r));
  r = await call('POST', '/rest/v1/swatches', { ...admin.hdr, ...REP }, { ...row, id: SW + 'b', supplier_code: CODE + 'b', display_name: 'zzqx test color' });
  if (r.status < 300) created.swatches.push(SW + 'b');
  check('admin: a duplicate name is refused in plain constraint terms', r.status === 409 && /swatches_display_name_per_line|already used in the zebra line/.test(JSON.stringify(r.body)), short(r) + ' ' + (r.body?.message?.match(/"([^"]+)"/)?.[1] ?? ''));
  r = await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW)}`, { ...admin.hdr, ...REP }, { display_name: 'Zzqx Renamed Color' });
  check('admin: can edit a color', r.status === 200 && r.body[0]?.display_name === 'Zzqx Renamed Color', short(r));

  check('anonymous can see the active test color', (await pubHas(SW)) === 1, 'via public_catalog');
  r = await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW)}`, { ...admin.hdr, ...REP }, { active: false });
  check('admin: can hide a color', r.status === 200 && r.body[0]?.active === false, short(r));
  check('hidden color is invisible to anonymous', (await pubHas(SW)) === 0, 'via public_catalog');
  check('hidden color is still visible to the admin', (await cnt(admin.hdr, `/rest/v1/swatches?id=eq.${enc(SW)}&select=id`)) === 1, 'count via admin key');
  r = await call('POST', '/rest/v1/rpc/swatch_display_names', anon, { ids: [SW] });
  check('anonymous can look up the display name of a hidden color (old saved orders)', Array.isArray(r.body) && r.body[0]?.display_name === 'Zzqx Renamed Color', short(r) + ' ' + JSON.stringify(r.body));
  r = await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW)}`, { ...admin.hdr, ...REP }, { active: true });
  check('admin: can show a color again', r.status === 200 && r.body[0]?.active === true, short(r));

  r = await call('PATCH', `/rest/v1/fabrics?id=eq.${enc(FAB)}`, { ...admin.hdr, ...REP }, { active: false });
  check('admin: can hide a collection', r.status === 200 && r.body[0]?.active === false, short(r));
  check('colors of a hidden collection are invisible to anonymous', (await pubHas(SW)) === 0, 'via public_catalog');
  await call('PATCH', `/rest/v1/fabrics?id=eq.${enc(FAB)}`, { ...admin.hdr, ...REP }, { active: true });

  // audit log
  r = await call('GET', `/rest/v1/audit_log?select=action,actor_id,actor_email,table_name,row_id,old_row,new_row&row_id=eq.${enc(SW)}&order=id`, admin.hdr);
  const acts = Array.isArray(r.body) ? r.body.map(e => e.action) : [];
  check('audit log: admin can read it and it shows insert, then updates, for the color', acts[0] === 'INSERT' && acts.filter(a => a === 'UPDATE').length >= 3, short(r) + ' ' + acts.join(','));
  check('audit log: records who (id and email) made each change', Array.isArray(r.body) && r.body.length > 0 && r.body.every(e => e.actor_id === admin.id && e.actor_email === admin.email), `actor on ${r.body?.length} rows`);
  const rename = Array.isArray(r.body) && r.body.find(e => e.action === 'UPDATE' && e.new_row?.display_name === 'Zzqx Renamed Color');
  check('audit log: keeps before and after values', !!rename && rename.old_row.display_name === 'Zzqx Test Color', rename ? `${rename.old_row.display_name} -> ${rename.new_row.display_name}` : 'no rename entry');
  r = await call('GET', `/rest/v1/audit_log?select=action&table_name=eq.fabrics&row_id=eq.${enc(FAB)}`, admin.hdr);
  check('audit log: collections are recorded too', Array.isArray(r.body) && r.body.length >= 3, `${r.body?.length} entries`);

  // delete guard
  const ord = await call('POST', '/rest/v1/orders', { ...plain.hdr, ...REP }, { user_id: plain.id, name: 'zz-test order', status: 'draft', items: [{ productId: 'zebra', selection: { picks: [{ swatchId: SW, code: CODE }] } }] });
  if (ord.status < 300) created.orders.push(ord.body[0].id);
  check('(setup) temporary saved order created', ord.status === 201, short(ord));
  r = await call('POST', '/rest/v1/rpc/swatch_order_count', admin.hdr, { p_id: SW });
  check('admin: swatch_order_count sees the saved order', r.body === 1, short(r) + ' -> ' + JSON.stringify(r.body));
  r = await call('DELETE', `/rest/v1/swatches?id=eq.${enc(SW)}`, { ...admin.hdr, ...REP });
  check('admin: deleting a color that is in a saved order is refused by the database', r.status >= 400 && /used in 1 saved order/.test(JSON.stringify(r.body)), short(r));
  r = await call('DELETE', `/rest/v1/orders?id=eq.${ord.body?.[0]?.id}`, { ...plain.hdr, ...REP });
  check('(clean-up) temporary saved order removed', r.status === 200 && r.body.length === 1, short(r)); created.orders.length = 0;
  r = await call('POST', '/rest/v1/rpc/swatch_order_count', admin.hdr, { p_id: SW });
  check('after the order is gone the count is 0', r.body === 0, short(r));

  // ---- non-admin and anonymous
  for (const [label, hdr] of [['NON-ADMIN', plain.hdr], ['ANONYMOUS', anon]]) {
    console.log(`\n=== ${label} ===`);
    r = await call('POST', '/rest/v1/swatches', { ...hdr, ...REP }, { ...row, id: 'zz-test:' + label, supplier_code: 'ZZX' + label, display_name: 'Zzqx Intruder' });
    if (r.status < 300) created.swatches.push('zz-test:' + label);
    check(`${label}: cannot add a color`, refused(r), short(r));
    r = await call('POST', '/rest/v1/fabrics', { ...hdr, ...REP }, { id: 'zebra:-:zz-intruder', product_line: 'zebra', shown_in: ['zebra'], collection_name: 'Intruder' });
    if (r.status < 300) created.fabrics.push('zebra:-:zz-intruder');
    check(`${label}: cannot add a collection`, refused(r), short(r));
    r = await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW)}`, { ...hdr, ...REP }, { display_name: 'Hacked' });
    check(`${label}: cannot edit a color`, refused(r), short(r));
    r = await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW)}`, { ...hdr, ...REP }, { active: false });
    check(`${label}: cannot hide a color`, refused(r), short(r));
    r = await call('PATCH', `/rest/v1/fabrics?id=eq.${enc(FAB)}`, { ...hdr, ...REP }, { active: false });
    check(`${label}: cannot hide a collection`, refused(r), short(r));
    r = await call('DELETE', `/rest/v1/swatches?id=eq.${enc(SW)}`, { ...hdr, ...REP });
    check(`${label}: cannot delete a color`, refused(r), short(r));
    r = await upload(hdr, `full/zebra/zz-intruder-${stamp}.jpg`, jpeg, 'image/jpeg'); if (r.status < 300) created.files.push(`full/zebra/zz-intruder-${stamp}.jpg`);
    check(`${label}: cannot upload an image`, r.status >= 400, short(r));
    r = await call('DELETE', '/storage/v1/object/swatches', hdr, { prefixes: [imgPath] });
    check(`${label}: cannot delete an image`, await stored(imgPath), `delete: ${short(r)}; image still stored afterwards`);
    r = await call('GET', '/rest/v1/audit_log?select=id&limit=5', hdr);
    check(`${label}: cannot read the audit log`, refused(r), short(r));
    r = await call('POST', '/rest/v1/audit_log', { ...hdr, ...REP }, { table_name: 'x', row_id: 'y', action: 'INSERT' });
    check(`${label}: cannot write the audit log`, refused(r), short(r));
    r = await call('POST', '/rest/v1/rpc/swatch_order_count', hdr, { p_id: SW });
    check(`${label}: cannot call swatch_order_count`, r.status >= 400, short(r));
    r = await call('POST', '/rest/v1/rpc/is_admin', hdr, {});
    check(`${label}: is_admin() = false`, r.body === false, short(r));
    r = await call('GET', '/rest/v1/admins?select=email', hdr);
    check(`${label}: cannot read the admin list`, refused(r), short(r));
  }
  r = await call('GET', `/rest/v1/swatches?id=eq.${enc(SW)}&select=display_name,active`, svc);
  check('test color unchanged after every refused attempt', r.body[0]?.display_name === 'Zzqx Renamed Color' && r.body[0]?.active === true, JSON.stringify(r.body));

  // admin finishes: delete the color and its images
  console.log('\n=== ADMIN clean-up through the same permissions ===');
  r = await call('DELETE', `/rest/v1/swatches?id=eq.${enc(SW)}`, { ...admin.hdr, ...REP }); if (r.status < 300) created.swatches = created.swatches.filter(x => x !== SW);
  check('admin: can delete a color that no order uses', r.status === 200 && r.body.length === 1, short(r));
  r = await call('DELETE', '/storage/v1/object/swatches', admin.hdr, { prefixes: [imgPath, thumbPath] });
  const gone = !(await stored(imgPath)) && !(await stored(thumbPath));
  check('admin: can delete images', r.status < 300 && gone, `${short(r).slice(0, 40)}; both files gone from storage afterwards (the public URL can keep answering from the CDN cache for up to a day)`);
  r = await call('GET', `/rest/v1/audit_log?select=action&row_id=eq.${enc(SW)}&action=eq.DELETE`, admin.hdr);
  check('audit log: the delete is recorded with the old values', Array.isArray(r.body) && r.body.length === 1, short(r));
} catch (e) {
  console.log('\nTEST ERROR:', e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  const del = (p) => call('DELETE', p, svc);
  for (const id of created.orders) await call('DELETE', `/rest/v1/orders?id=eq.${id}`, plainHdr);
  for (const id of created.swatches) await del(`/rest/v1/swatches?id=eq.${enc(id)}`);
  for (const id of created.fabrics) await del(`/rest/v1/fabrics?id=eq.${enc(id)}`);
  if (created.files.length) await call('DELETE', '/storage/v1/object/swatches', svc, { prefixes: created.files });
  for (const id of created.admins) await del(`/rest/v1/admins?id=eq.${id}`);
  for (const id of created.users) await del(`/auth/v1/admin/users/${id}`);
  const left = [];
  for (const id of created.users) left.push((await call('GET', `/auth/v1/admin/users/${id}`, svc)).status);
  const f = await call('GET', `/rest/v1/fabrics?id=like.zebra:-:zz-*&select=id`, svc);
  const s = await call('GET', `/rest/v1/swatches?id=like.*zz-test*&select=id`, svc);
  const s2 = await call('GET', `/rest/v1/swatches?id=like.zebra:ZZTEST*&select=id`, svc);
  const o = await call('GET', `/rest/v1/orders?name=eq.zz-test%20order&select=id`, plainHdr);
  const a = await call('GET', `/rest/v1/admins?email=like.zz-*&select=id`, svc);
  console.log(`\nclean-up: user lookups afterwards ${JSON.stringify(left)} (404 = gone); leftover test collections ${f.body.length}, colors ${s.body.length + s2.body.length}, orders ${Array.isArray(o.body) ? o.body.length : 'n/a'}, admin rows ${a.body.length}`);
  results.push({ name: 'clean-up left nothing behind', ok: left.every(x => x === 404) && !f.body.length && !s.body.length && !s2.body.length && (!Array.isArray(o.body) || !o.body.length) && !a.body.length });
}
const bad = results.filter(x => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ' | FAILED: ' + bad.map(x => x.name).join('; ') : ''}`);
process.exit(bad.length ? 1 : 0);
