// Live tests for supplier pricing and product options, over HTTPS against the project in SUPABASE_URL.
// The point: nobody but an admin can read ANY cost, grid, adder, markup or option data, and customers learn a price only
// through estimate_price(), which returns {price, custom_size, price_on_request} and nothing else.
// Creates a temporary admin and a temporary non-admin, restores everything it edits, deletes everything it creates.
// Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.   Usage: node supabase/tests/live_pricing_tests.mjs
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

const TABLES = ['price_grids', 'grid_fabrics', 'price_adders', 'price_flags', 'price_imports', 'pricing_lines', 'collection_markups', 'product_lines', 'option_groups', 'option_values', 'size_rules'];
const mk = async (label) => {
  const email = `zz-${label}-${stamp}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await call('POST', '/auth/v1/admin/users', svc, { email, password, email_confirm: true });
  if (!cu.body?.id) throw new Error(`could not create ${label}: ${short(cu)}`); users.push(cu.body.id);
  const tok = await call('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password });
  if (!tok.body?.access_token) throw new Error(`could not sign in ${label}`);
  return { id: cu.body.id, email, hdr: H(ANON, tok.body.access_token) };
};
const est = (hdr, fn, args) => call('POST', `/rest/v1/rpc/${fn}`, hdr, args);
const ARGS = (o = {}) => ({ p_line: 'roller', p_fabric_id: 'roller:solar:sag', p_options: { control: 'chain' }, p_width: 40, p_height: 56, ...o });

try {
  const admin = await mk('padmin'), plain = await mk('pplain');
  const ar = await call('POST', '/rest/v1/admins', { ...svc, ...REP }, { email: admin.email, user_id: admin.id }); adminRows.push(ar.body[0].id);
  console.log(`temporary admin and non-admin created\n`);

  // ------------------------------------------------------------------ nobody but an admin reads or writes cost data
  for (const [label, hdr] of [['ANONYMOUS', anon], ['SIGNED-IN NON-ADMIN', plain.hdr]]) {
    console.log(`=== ${label}`);
    const readable = [];
    for (const t of [...TABLES, 'audit_log']) {
      const r = await call('GET', `/rest/v1/${t}?select=*&limit=5`, hdr);
      if (!refused(r)) readable.push(t);
    }
    check(`${label}: cannot read any pricing or option table (${TABLES.length} tables + audit log)`, readable.length === 0, readable.length ? `READABLE: ${readable.join(', ')}` : 'all refused or empty');
    const written = [];
    const tries = [['price_grids', { grid_key: 'zz', line_id: 'roller', systems: ['cord'], label: 'zz', rows_are: 'width', row_axis: [1], col_axis: [1], cost: [1] }], ['price_adders', { line_id: 'roller', adder_key: 'zz', label: 'zz', kind: 'add', amount: 1 }],
      ['pricing_lines', { id: 'zz', name: 'zz' }], ['collection_markups', { fabric_id: 'roller:solar:sag', markup: 0.01 }], ['option_values', { id: 'zz', group_id: 'roller:control', code: 'zz', label: 'zz' }], ['size_rules', { line_id: 'roller', subject: 'zz' }], ['product_lines', { id: 'zz', name: 'zz' }], ['price_flags', { flag_key: 'zz', kind: 'info', title: 'zz' }]];
    for (const [t, row] of tries) { const r = await call('POST', `/rest/v1/${t}`, { ...hdr, ...REP }, row); if (r.status < 300) { written.push(t); cleanup.push(() => call('DELETE', `/rest/v1/${t}?${t === 'collection_markups' ? 'fabric_id=eq.roller:solar:sag' : t === 'price_adders' ? 'adder_key=eq.zz' : t === 'price_grids' ? 'grid_key=eq.zz' : t === 'price_flags' ? 'flag_key=eq.zz' : t === 'size_rules' ? 'subject=eq.zz' : 'id=eq.zz'}`, svc)); } }
    check(`${label}: cannot insert into the pricing and option tables`, written.length === 0, written.length ? `INSERTED: ${written.join(', ')}` : 'all refused');
    const changed = [];
    for (const [t, filter, patchBody] of [['pricing_lines', 'id=eq.roller', { markup: 0.01 }], ['price_adders', 'adder_key=eq.motor-cost', { amount: 0 }], ['option_values', 'id=eq.roller:control:chain', { label: 'Hacked' }], ['price_flags', 'flag_key=eq.dream-115-dip', { resolved: true }], ['product_lines', 'id=eq.roller', { name: 'Hacked' }]]) {
      const r = await call('PATCH', `/rest/v1/${t}?${filter}`, { ...hdr, ...REP }, patchBody); if (!refused(r)) changed.push(t);
      const d = await call('DELETE', `/rest/v1/${t}?${filter}`, { ...hdr, ...REP }); if (!refused(d)) changed.push(t + ' (delete)');
    }
    check(`${label}: cannot change or delete markups, adders, options or flags`, changed.length === 0, changed.length ? `CHANGED: ${changed.join(', ')}` : 'all refused');
    const fns = []; 
    for (const [fn, args] of [['estimate_price_debug', ARGS()], ['price_breakdown', ARGS()], ['price_single', ARGS()], ['price_import_apply', { p_line: 'roller', p_grids: [], p_remove_keys: null, p_adders: null, p_meta: null }], ['roll_numbers', { t: '98 in' }]]) {
      const r = await est(hdr, fn, args); if (r.status < 300) fns.push(fn);
    }
    check(`${label}: cannot call estimate_price_debug, price_breakdown, price_single, price_import_apply or roll_numbers`, fns.length === 0, fns.length ? `CALLABLE: ${fns.join(', ')}` : 'all refused');

    // what a customer may learn
    const samples = [ARGS(), ARGS({ p_width: 10, p_height: 10 }), ARGS({ p_width: 500 }), ARGS({ p_line: 'nope' }), ARGS({ p_line: 'drapery', p_fabric_id: 'drapery:orsay', p_options: { control: 'manual' } }),
      ARGS({ p_options: { control: 'matter', mode: 'double-stack', back_fabric_id: 'roller:screen-view:purity' } }), ARGS({ p_line: 'shangri-la', p_fabric_id: 'shangri-la:-:hermes', p_options: { control: 'matter' }, p_width: 50, p_height: 90 })];
    const outs = []; for (const s of samples) outs.push(await est(hdr, 'estimate_price', s));
    const keysOk = outs.every((o) => o.status === 200 && o.body && typeof o.body === 'object' && Object.keys(o.body).sort().join() === 'custom_size,price,price_on_request');
    check(`${label}: estimate_price answers with only {price, custom_size, price_on_request}`, keysOk, outs.map((o) => JSON.stringify(o.body)).join('\n      '));
    const leaked = outs.some((o) => /cost|markup|grid|adder|cell|sheet|supplier|margin/i.test(JSON.stringify(o.body)));
    check(`${label}: nothing about cost, markup, grids or adders appears in an estimate`, !leaked, 'checked the 7 answers above');
    check(`${label}: estimates give whole-dollar prices, "custom size" for impossible sizes, "price on request" for curtains`,
      Number.isInteger(outs[0].body.price) && outs[2].body.custom_size === true && outs[3].body.custom_size === true && outs[4].body.price_on_request === true, `${outs[0].body.price} / ${JSON.stringify(outs[2].body)} / ${JSON.stringify(outs[4].body)}`);
  }

  // ------------------------------------------------------------------ the admin can do everything
  console.log('\n=== ADMIN');
  let r = await call('GET', '/rest/v1/price_grids?select=id', { ...admin.hdr, Prefer: 'count=exact', Range: '0-0' });
  const cnt = await fetch(URL_ + '/rest/v1/price_grids?select=id', { headers: { ...admin.hdr, Prefer: 'count=exact', Range: '0-0' } });
  const total = Number((cnt.headers.get('content-range') || '').split('/')[1]);
  check('admin reads the price grids', total >= 130, `${total} grids`);
  const dbg = await est(admin.hdr, 'estimate_price_debug', ARGS()); const cust = await est(anon, 'estimate_price', ARGS());
  check('admin price checker returns cost, grid cell, adders and markup, and the same final price a customer gets', dbg.status === 200 && dbg.body.grid_cost > 0 && dbg.body.markup === 0.5 && dbg.body.price === cust.body.price, `cost ${dbg.body.grid_cost}, markup ${dbg.body.markup}, price ${dbg.body.price} vs customer ${cust.body.price}`);
  const known = [[ARGS(), 121], [ARGS({ p_line: 'shangri-la', p_fabric_id: 'shangri-la:-:hermes', p_options: { control: 'matter' }, p_width: 50, p_height: 90 }), 390],
    [ARGS({ p_line: 'dream-curtains', p_fabric_id: 'dream-curtains:-:sunflower', p_options: { control: 'manual' }, p_width: 100, p_height: 100 }), 421]];
  const got = []; for (const [a, want] of known) got.push([(await est(admin.hdr, 'estimate_price_debug', a)).body.price, want]);
  check('three known prices match the spreadsheets (roller 121, shangri-la 390, dream curtains 421)', got.every(([g, w]) => g === w), JSON.stringify(got));

  // markup: change, see the price move, restore
  r = await call('PATCH', '/rest/v1/pricing_lines?id=eq.roller', { ...admin.hdr, ...REP }, { markup: 0.6 });
  const p60 = (await est(anon, 'estimate_price', ARGS())).body.price;
  await call('PATCH', '/rest/v1/pricing_lines?id=eq.roller', { ...admin.hdr, ...REP }, { markup: 0.5 });
  const p50 = (await est(anon, 'estimate_price', ARGS())).body.price;
  check('admin changes a line markup (50% -> 60% -> 50%) and the customer price follows', p60 === 129 && p50 === 121, `60%: $${p60}, back to 50%: $${p50}`);
  r = await call('POST', '/rest/v1/collection_markups', { ...admin.hdr, ...REP }, { fabric_id: 'roller:solar:sag', markup: 1.0 }); cleanup.push(() => call('DELETE', '/rest/v1/collection_markups?fabric_id=eq.roller:solar:sag', svc));
  const po = (await est(anon, 'estimate_price', ARGS())).body.price;
  await call('DELETE', '/rest/v1/collection_markups?fabric_id=eq.roller:solar:sag', { ...admin.hdr, ...REP });
  check('admin sets and removes a per-collection markup override', r.status === 201 && po === 162, `override 100%: $${po}`);
  // dream curtains motor placeholder is editable
  const before = (await est(admin.hdr, 'estimate_price_debug', ARGS({ p_line: 'dream-curtains', p_fabric_id: 'dream-curtains:-:sunflower', p_options: { control: 'remote' }, p_width: 100, p_height: 100 }))).body;
  await call('PATCH', '/rest/v1/price_adders?adder_key=eq.motor-cost&line_id=eq.dream-curtains', { ...admin.hdr, ...REP }, { amount: 130 });
  const after = (await est(admin.hdr, 'estimate_price_debug', ARGS({ p_line: 'dream-curtains', p_fabric_id: 'dream-curtains:-:sunflower', p_options: { control: 'remote' }, p_width: 100, p_height: 100 }))).body;
  await call('PATCH', '/rest/v1/price_adders?adder_key=eq.motor-cost&line_id=eq.dream-curtains', { ...admin.hdr, ...REP }, { amount: 90 });
  check('the Dream Curtains motor (+$90) is editable and marked from the supplier', before.adders?.[0]?.status === 'from_supplier' && Number(before.adders?.[0]?.amount) === 90 && Math.abs(after.subtotal - before.subtotal - 40) < 0.01, `adders ${JSON.stringify(before.adders)}; +$40 -> subtotal ${before.subtotal} -> ${after.subtotal}`);
  // options
  r = await call('POST', '/rest/v1/option_values', { ...admin.hdr, ...REP }, { id: 'roller:mode:zz-triple', group_id: 'roller:mode', code: 'zz-triple', label: 'Triple', sort_order: 99 });
  check('admin cannot add an option to a group tied to the site\'s code (roller mode)', r.status >= 400, short(r));
  r = await call('POST', '/rest/v1/option_values', { ...admin.hdr, ...REP }, { id: 'zebra:control:zz-test', group_id: 'zebra:control', code: 'zz-test', label: 'Zz test control', grid_system: 'cord', sort_order: 99 }); cleanup.push(() => call('DELETE', '/rest/v1/option_values?id=eq.zebra:control:zz-test', svc));
  check('admin adds an option to a free group (Zebra control)', r.status === 201, short(r));
  r = await call('PATCH', '/rest/v1/option_values?id=eq.zebra:control:zz-test', { ...admin.hdr, ...REP }, { code: 'zz-changed' });
  check('an option code can never change', r.status >= 400, short(r));
  r = await call('PATCH', '/rest/v1/option_values?id=eq.zebra:control:zz-test', { ...admin.hdr, ...REP }, { active: false, explanation: 'x' });
  check('admin hides an option and edits its explanation', r.status === 200 && r.body[0]?.active === false, short(r));
  r = await call('PATCH', '/rest/v1/option_values?id=eq.roller:control:cordless', { ...admin.hdr, ...REP }, { is_default: true });
  check('only one default per group (a second default is refused)', r.status >= 400, short(r));
  r = await call('POST', '/rest/v1/size_rules', { ...admin.hdr, ...REP }, { line_id: 'roman', subject: 'Zz cordless Roman shades', when_values: { control: ['cordless'] }, max_width: 94 }); const ruleId = r.body?.[0]?.id; cleanup.push(() => call('DELETE', `/rest/v1/size_rules?subject=eq.${enc('Zz cordless Roman shades')}`, svc));
  check('admin adds a size rule (it starts unverified)', r.status === 201 && r.body[0].verified === false, short(r));
  r = await call('POST', '/rest/v1/size_rules', { ...admin.hdr, ...REP }, { line_id: 'roman', subject: 'bad', min_width: 50, max_width: 10 });
  check('a rule whose minimum is above its maximum is refused', r.status >= 400, short(r));
  // pictures for options
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  const up = (hdr, p) => fetch(`${URL_}/storage/v1/object/option-images/${p}`, { method: 'POST', headers: { apikey: ANON, Authorization: hdr.Authorization, 'Content-Type': 'image/jpeg', 'cache-control': 'max-age=86400' }, body: jpeg }).then(async (x) => ({ status: x.status, body: await x.text() }));
  const pa = `zebra/zz-test-${stamp}.jpg`; r = await up(admin.hdr, pa); cleanup.push(() => call('DELETE', '/storage/v1/object/option-images', svc, { prefixes: [pa] }));
  check('admin uploads an option picture', r.status === 200, `HTTP ${r.status}`);
  const pub = await fetch(`${URL_}/storage/v1/object/public/option-images/${pa}`);
  check('the uploaded picture is public with a 24-hour cache', pub.status === 200 && /max-age=86400/.test(pub.headers.get('cache-control') || ''), `HTTP ${pub.status} ${pub.headers.get('cache-control')}`);
  for (const [label, hdr] of [['non-admin', plain.hdr], ['anonymous', anon]]) { const x = await up(hdr, `zebra/zz-intruder-${stamp}.jpg`); if (x.status < 300) cleanup.push(() => call('DELETE', '/storage/v1/object/option-images', svc, { prefixes: [`zebra/zz-intruder-${stamp}.jpg`] })); check(`${label} cannot upload an option picture`, x.status >= 400, `HTTP ${x.status}`); }
  // history
  r = await call('GET', '/rest/v1/audit_log?select=table_name,row_id,action,actor_email,new_row&order=id.desc&limit=200&actor_email=eq.' + enc(admin.email), admin.hdr);
  const tbl = new Set(r.body.map((e) => e.table_name));
  check('the audit log recorded this admin\'s changes to markups, adders, options and size rules', ['pricing_lines', 'collection_markups', 'price_adders', 'option_values', 'size_rules'].every((t) => tbl.has(t)), [...tbl].join(', '));
  r = await call('GET', '/rest/v1/audit_log?select=id,new_row&table_name=eq.price_grids&limit=1000', admin.hdr);
  check('the audit log never stores a grid\'s cost cells (only a fingerprint)', Array.isArray(r.body) && r.body.every((e) => !e.new_row || !('cost' in e.new_row)), `${r.body.length} price_grids entries checked`);
  // the existing site is untouched
  const sw = await fetch(URL_ + '/rest/v1/swatches?select=id', { headers: { ...anon, Prefer: 'count=exact', Range: '0-0' } });
  check('the public catalog is unchanged (437 colors visible to anonymous visitors)', /\/437$/.test(sw.headers.get('content-range') || ''), sw.headers.get('content-range'));
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  for (const fn of cleanup.reverse()) { try { await fn(); } catch { /* best effort */ } }
  await call('PATCH', '/rest/v1/pricing_lines?id=eq.roller', svc, { markup: 0.5 });
  await call('PATCH', '/rest/v1/price_adders?adder_key=eq.motor-cost&line_id=eq.dream-curtains', svc, { amount: 90 });
  for (const id of adminRows) await call('DELETE', `/rest/v1/admins?id=eq.${id}`, svc);
  for (const id of users) await call('DELETE', `/auth/v1/admin/users/${id}`, svc);
  const left = []; for (const id of users) left.push((await call('GET', `/auth/v1/admin/users/${id}`, svc)).status);
  const leftovers = [];
  for (const [t, f] of [['option_values', 'code=like.zz-*'], ['size_rules', `subject=like.*Zz*`], ['collection_markups', 'fabric_id=eq.roller:solar:sag'], ['admins', 'email=like.zz-*']]) { const x = await call('GET', `/rest/v1/${t}?select=*&${f}`, svc); if (Array.isArray(x.body) && x.body.length) leftovers.push(`${t}:${x.body.length}`); }
  const mk = (await call('GET', '/rest/v1/pricing_lines?select=markup&id=eq.roller', svc)).body[0]?.markup;
  console.log(`\nclean-up: user lookups ${JSON.stringify(left)} (404 = gone); leftovers: ${leftovers.join(', ') || 'none'}; roller markup restored to ${mk}`);
  results.push({ name: 'clean-up left nothing behind', ok: left.every((x) => x === 404) && !leftovers.length && Number(mk) === 0.5 });
}
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ' | FAILED: ' + bad.map((x) => x.name).join('; ') : ''}`);
process.exit(bad.length ? 1 : 0);
