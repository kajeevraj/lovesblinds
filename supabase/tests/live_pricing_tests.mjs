// Live tests for supplier pricing and product options, over HTTPS against the project in SUPABASE_URL.
// The point: nobody but an admin can read ANY cost, grid, adder, markup or option data, and customers learn a price only
// through estimate_price(), which returns {price, custom_size, price_on_request} and nothing else.
// Creates a temporary admin and a temporary non-admin, restores everything it edits, deletes everything it creates.
// Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.   Usage: node supabase/tests/live_pricing_tests.mjs
import { guard, own } from './lib/liveGuard.mjs';       // every write is checked: a test may only change what it created (see lib/liveGuard.mjs)
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
const users = [], adminRows = [], cleanup = [], sharedCleanup = [];   // sharedCleanup: undo steps for edits made inside guard.sharedRows; they run inside it too (staging only)

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
// REQUIRE_CLOSED=1: also assert that migration 11 (closing the public's direct table reads) is applied.
const REQUIRE_CLOSED = process.env.REQUIRE_CLOSED === '1';
const SARGS = (o = {}) => ({ p_line: 'roller', p_swatch_id: SW.sag, p_options: { control: 'chain' }, p_width: 40, p_height: 56, ...o });
const ARGS = (o = {}) => ({ p_line: 'roller', p_fabric_id: 'roller:solar:sag', p_options: { control: 'chain' }, p_width: 40, p_height: 56, ...o });

let ZP, ZF1, ZF2, ZFLAG, RULE_SUBJECT;       // the rows this test creates (names set inside the try)
const SW = {};   // swatch ids the tests price (filled in below, with the service role)
// Everything this script changes that moves a price is read first and put back to exactly that value at the end (never a fixed number).
const orig = {};
try {
  const firstSwatch = async (fab) => (await call('GET', `/rest/v1/swatches?select=id&fabric_id=eq.${enc(fab)}&active=eq.true&order=sort_order&limit=1`, svc)).body[0].id;
  SW.sag = await firstSwatch('roller:solar:sag'); SW.purity = await firstSwatch('roller:screen-view:purity'); SW.hermes = await firstSwatch('shangri-la:-:hermes');
  SW.sun = await firstSwatch('dream-curtains:-:sunflower'); SW.orsay = await firstSwatch('drapery:orsay');
  orig.markup = (await call('GET', '/rest/v1/pricing_lines?select=markup&id=eq.roller', svc)).body[0].markup;
  orig.dream = (await call('GET', '/rest/v1/price_adders?select=amount&adder_key=eq.motor-cost&line_id=eq.dream-curtains', svc)).body[0].amount;
  orig.swatch = (await call('GET', `/rest/v1/swatches?select=extra_cost,active&id=eq.${enc(SW.sag)}`, svc)).body[0];
  orig.coll = (await call('GET', '/rest/v1/collection_markups?select=*&fabric_id=eq.roller:solar:sag', svc)).body;
  console.log(`prices read before any change: roller markup ${orig.markup}, Dream motor ${orig.dream}, extra cost on the test color ${orig.swatch.extra_cost}, ${orig.coll.length} collection override(s)\n`);
  const admin = await mk('padmin'), plain = await mk('pplain');
  const ar = await call('POST', '/rest/v1/admins', { ...svc, ...REP }, { email: admin.email, user_id: admin.id }); adminRows.push(ar.body[0].id);
  console.log(`temporary admin and non-admin created\n`);

  // The attempts below by a non-admin or an anonymous visitor to change or delete a price, an adder, an option, a flag, a line or a markup are aimed at
  // rows THIS test creates (and removes at the end), never at the real ones: the database refuses them by role, whichever row they name.
  ZP = `zz-lp-${stamp}`; ZF1 = `zebra:-:${ZP}-a`; ZF2 = `zebra:-:${ZP}-b`; ZFLAG = `zz-flag-${stamp}`;
  own(ZP, ZF1, ZF2, ZFLAG, `zz-motor-${stamp}`);
  const mkOwn = async (t, row) => { const x = await call('POST', `/rest/v1/${t}`, { ...svc, Prefer: 'return=minimal' }, row); if (x.status >= 300) throw new Error(`could not create the test row in ${t}: ${short(x)}`); };
  cleanup.push(() => call('DELETE', `/rest/v1/product_lines?id=eq.${ZP}`, svc));                     // takes its pricing line, adders, flags, option groups and values with it (on delete cascade)
  cleanup.push(() => call('DELETE', `/rest/v1/pricing_lines?id=eq.${ZP}`, svc));
  cleanup.push(() => call('DELETE', `/rest/v1/fabrics?id=in.(${enc(ZF1)},${enc(ZF2)})`, svc));
  await mkOwn('product_lines', { id: ZP, name: `Zz lp ${stamp}`, active: false });
  await mkOwn('pricing_lines', { id: ZP, name: `Zz lp ${stamp}`, product_line_id: ZP, markup: 0.5 });
  await mkOwn('price_adders', { line_id: ZP, adder_key: `zz-motor-${stamp}`, label: 'zz', kind: 'add', amount: 1 });
  await mkOwn('price_flags', { line_id: ZP, flag_key: ZFLAG, kind: 'info', title: 'zz' });
  await mkOwn('option_groups', { id: `${ZP}:control`, line_id: ZP, key: 'control', label: 'Control' });
  await mkOwn('option_values', { id: `${ZP}:control:chain`, group_id: `${ZP}:control`, code: 'chain', label: 'Chain' });
  for (const f of [ZF1, ZF2]) await mkOwn('fabrics', { id: f, product_line: 'zebra', shown_in: ['zebra'], family: null, collection_name: `Zz ${f.slice(-8)}`, width: '118 in', active: false, sort_order: 9999 });
  await mkOwn('collection_markups', { fabric_id: ZF1, markup: 0.5 });
  RULE_SUBJECT = `Zz cordless Roman shades ${stamp}`; own(RULE_SUBJECT);

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
    const tries = [['price_grids', { grid_key: `${ZP}-g`, line_id: ZP, systems: ['cord'], label: 'zz', rows_are: 'width', row_axis: [1], col_axis: [1], cost: [1] }], ['price_adders', { line_id: ZP, adder_key: `${ZP}-add`, label: 'zz', kind: 'add', amount: 1 }],
      ['pricing_lines', { id: `${ZP}-new`, name: 'zz' }], ['collection_markups', { fabric_id: ZF2, markup: 0.01 }], ['option_values', { id: `${ZP}:control:new`, group_id: `${ZP}:control`, code: 'zz', label: 'zz' }], ['size_rules', { line_id: ZP, subject: `${ZP}-rule` }], ['product_lines', { id: `${ZP}-newp`, name: 'zz' }], ['price_flags', { flag_key: `${ZP}-flag2`, kind: 'info', title: 'zz' }]];
    const where = { collection_markups: `fabric_id=eq.${enc(ZF2)}`, price_adders: `adder_key=eq.${ZP}-add`, price_grids: `grid_key=eq.${ZP}-g`, price_flags: `flag_key=eq.${ZP}-flag2`, size_rules: `subject=eq.${ZP}-rule`, pricing_lines: `id=eq.${ZP}-new`, option_values: `id=eq.${enc(ZP + ':control:new')}`, product_lines: `id=eq.${ZP}-newp` };
    for (const [t, row] of tries) { const r = await call('POST', `/rest/v1/${t}`, { ...hdr, ...REP }, row); if (r.status < 300) { written.push(t); cleanup.push(() => call('DELETE', `/rest/v1/${t}?${where[t]}`, svc)); } }
    check(`${label}: cannot insert into the pricing and option tables`, written.length === 0, written.length ? `INSERTED: ${written.join(', ')}` : 'all refused');
    const changed = [];
    for (const [t, filter, patchBody] of [['pricing_lines', `id=eq.${ZP}`, { markup: 0.01 }], ['price_adders', `adder_key=eq.zz-motor-${stamp}`, { amount: 0 }], ['option_values', `id=eq.${enc(ZP + ':control:chain')}`, { label: 'Hacked' }], ['price_flags', `flag_key=eq.${ZFLAG}`, { resolved: true }], ['product_lines', `id=eq.${ZP}`, { name: 'Hacked' }], ['collection_markups', `fabric_id=eq.${enc(ZF1)}`, { markup: 0.01 }]]) {
      const r = await call('PATCH', `/rest/v1/${t}?${filter}`, { ...hdr, ...REP }, patchBody); if (!refused(r)) changed.push(t);
      const d = await call('DELETE', `/rest/v1/${t}?${filter}`, { ...hdr, ...REP }); if (!refused(d)) changed.push(t + ' (delete)');
    }
    check(`${label}: cannot change or delete markups, adders, options or flags`, changed.length === 0, changed.length ? `CHANGED: ${changed.join(', ')}` : 'all refused');
    const fns = []; 
    for (const [fn, args] of [['estimate_price_debug', ARGS()], ['estimate_price', ARGS()], ['estimate_price_debug_for_swatch', SARGS()], ['price_for_swatch', SARGS()], ['swatch_placement', { p_swatch: SW.sag, p_catline: 'roller' }], ['price_breakdown', ARGS()], ['price_single', ARGS()], ['price_import_apply', { p_line: 'roller', p_grids: [], p_remove_keys: null, p_adders: null, p_meta: null }], ['roll_numbers', { t: '98 in' }]]) {
      const r = await est(hdr, fn, args); if (r.status < 300) fns.push(fn);
    }
    check(`${label}: cannot call estimate_price (price group route), the debug and internal price functions, price_import_apply or roll_numbers`, fns.length === 0, fns.length ? `CALLABLE: ${fns.join(', ')}` : 'all refused');

    // what a customer may learn
    const samples = [SARGS(), SARGS({ p_width: 10, p_height: 10 }), SARGS({ p_width: 500 }), SARGS({ p_line: 'nope' }), SARGS({ p_line: 'drapery', p_swatch_id: SW.orsay, p_options: { control: 'manual' } }),
      SARGS({ p_options: { control: 'motorized', power: 'battery', solar: 'none', motor_control: 'matter', mode: 'double-stack', back_swatch_id: SW.purity } }), SARGS({ p_line: 'shangri-la', p_swatch_id: SW.hermes, p_options: { control: 'motorized', power: 'wired', solar: 'none', motor_control: 'zigbee' }, p_width: 50, p_height: 90 })];
    const outs = []; for (const s of samples) outs.push(await est(hdr, 'estimate_price_for_swatch', s));
    const keysOk = outs.every((o) => o.status === 200 && o.body && typeof o.body === 'object' && Object.keys(o.body).sort().join() === 'custom_size,price,price_on_request');
    check(`${label}: estimate_price_for_swatch answers with only {price, custom_size, price_on_request}`, keysOk, outs.map((o) => JSON.stringify(o.body)).join('\n      '));
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
  const dbg = await est(admin.hdr, 'estimate_price_debug_for_swatch', SARGS()); const cust = await est(anon, 'estimate_price_for_swatch', SARGS());
  check('admin price checker returns cost, grid cell, adders and markup, and the same final price a customer gets', dbg.status === 200 && dbg.body.grid_cost > 0 && dbg.body.markup === 0.5 && dbg.body.price === cust.body.price, `cost ${dbg.body.grid_cost}, markup ${dbg.body.markup}, price ${dbg.body.price} vs customer ${cust.body.price}`);
  const known = [[SARGS(), 121], [SARGS({ p_line: 'shangri-la', p_swatch_id: SW.hermes, p_options: { control: 'motorized', power: 'battery', solar: 'none', motor_control: 'app-remote' }, p_width: 50, p_height: 90 }), 285],
    [SARGS({ p_line: 'dream-curtains', p_swatch_id: SW.sun, p_options: { control: 'manual' }, p_width: 100, p_height: 100 }), 421]];
  const got = []; for (const [a, want] of known) got.push([(await est(admin.hdr, 'estimate_price_debug_for_swatch', a)).body.price, want]);
  check('three known prices (roller 121, shangri-la motorized 285 = plain table + $70 motor, dream curtains 421)', got.every(([g, w]) => g === w), JSON.stringify(got));

  // motor restructure (migrations 17 and 18): Motorized = the plain (chain) table + one $70 motor, Solar panel +$30, double-stack = two of each (all before the 1.5x markup)
  {
    const price = async (opts, extra = {}) => (await est(admin.hdr, 'estimate_price_debug_for_swatch', SARGS({ p_options: { mode: 'single', ...opts }, ...extra }))).body;
    const chain = await price({ control: 'chain' });
    const motor = await price({ control: 'motorized', power: 'battery', solar: 'none', motor_control: 'app-remote' });
    const wired = await price({ control: 'motorized', power: 'wired', solar: 'none', motor_control: 'matter' });
    const solar = await price({ control: 'motorized', power: 'battery', solar: 'panel', motor_control: 'zigbee' });
    const near = (a, b) => Math.abs(a - b) <= 1;
    check('motorized = chain price + $70 motor (x1.5 = +$105), the same for battery and wired and every control', near(motor.price - chain.price, 105) && motor.price === wired.price && motor.price === solar.price - 45, `chain $${chain.price}, battery $${motor.price}, wired $${wired.price}, solar $${solar.price}`);
    check('a solar panel adds $30 cost (+$45), and Zero gravity costs exactly the Cordless table price (no adder; since migration 20)', near(solar.price - motor.price, 45) && (await price({ control: 'zero-gravity' })).price === (await price({ control: 'cordless' })).price, `solar +${solar.price - motor.price}`);
    const dbl = (o) => est(admin.hdr, 'estimate_price_debug_for_swatch', SARGS({ p_options: { mode: 'double-stack', back_swatch_id: SW.purity, ...o } }));
    const d0 = (await dbl({ control: 'chain' })).body.price, d1 = (await dbl({ control: 'motorized', power: 'battery', solar: 'panel', motor_control: 'app-remote' })).body.price;
    check('double-stack with a motor and solar = two motors ($140) and two panels ($60) at cost (+$300)', near(d1 - d0, 300), `$${d0} -> $${d1}`);
  }

  // These three edit real prices (a line markup, a collection markup, the Dream motor cost): they run on the staging project only. Against the live project they are skipped.
  await guard.sharedRows('markups and the Dream motor cost: change, see the price move, restore', async () => {
    globalThis.__lpShared = true;
    r = await call('PATCH', '/rest/v1/pricing_lines?id=eq.roller', { ...admin.hdr, ...REP }, { markup: 0.6 });
    const p60 = (await est(anon, 'estimate_price_for_swatch', SARGS())).body.price;
    await call('PATCH', '/rest/v1/pricing_lines?id=eq.roller', { ...admin.hdr, ...REP }, { markup: orig.markup });
    const p50 = (await est(anon, 'estimate_price_for_swatch', SARGS())).body.price;
    check('admin changes a line markup (50% -> 60% -> 50%) and the customer price follows', p60 === 129 && p50 === 121, `60%: $${p60}, back to 50%: $${p50}`);
    r = await call('POST', '/rest/v1/collection_markups', { ...admin.hdr, ...REP }, { fabric_id: 'roller:solar:sag', markup: 1.0 }); sharedCleanup.push(() => call('DELETE', '/rest/v1/collection_markups?fabric_id=eq.roller:solar:sag', svc));
    const po = (await est(anon, 'estimate_price_for_swatch', SARGS())).body.price;
    await call('DELETE', '/rest/v1/collection_markups?fabric_id=eq.roller:solar:sag', { ...admin.hdr, ...REP });
    check('admin sets and removes a per-collection markup override', r.status === 201 && po === 162, `override 100%: $${po}`);
    // dream curtains motor placeholder is editable
    const before = (await est(admin.hdr, 'estimate_price_debug', ARGS({ p_line: 'dream-curtains', p_fabric_id: 'dream-curtains:-:sunflower', p_options: { control: 'motorized' }, p_width: 100, p_height: 100 }))).body;
    await call('PATCH', '/rest/v1/price_adders?adder_key=eq.motor-cost&line_id=eq.dream-curtains', { ...admin.hdr, ...REP }, { amount: 130 });
    const after = (await est(admin.hdr, 'estimate_price_debug', ARGS({ p_line: 'dream-curtains', p_fabric_id: 'dream-curtains:-:sunflower', p_options: { control: 'motorized' }, p_width: 100, p_height: 100 }))).body;
    await call('PATCH', '/rest/v1/price_adders?adder_key=eq.motor-cost&line_id=eq.dream-curtains', { ...admin.hdr, ...REP }, { amount: orig.dream });
    check('the Dream Curtains motor (+$100) is editable and marked from the supplier', before.adders?.[0]?.status === 'from_supplier' && Number(before.adders?.[0]?.amount) === 100 && Math.abs(after.subtotal - before.subtotal - 30) < 0.01, `adders ${JSON.stringify(before.adders)}; +$30 -> subtotal ${before.subtotal} -> ${after.subtotal}`);
  });
  // options
  r = await call('POST', '/rest/v1/option_values', { ...admin.hdr, ...REP }, { id: 'roller:mode:zz-triple', group_id: 'roller:mode', code: 'zz-triple', label: 'Triple', sort_order: 99 });
  check('admin cannot add an option to a group tied to the site\'s code (roller mode)', r.status >= 400, short(r));
  r = await call('POST', '/rest/v1/option_values', { ...admin.hdr, ...REP }, { id: 'zebra:control:zz-test', group_id: 'zebra:control', code: 'zz-test', label: 'Zz test control', grid_system: 'cord', sort_order: 99 }); cleanup.push(() => call('DELETE', '/rest/v1/option_values?id=eq.zebra:control:zz-test', svc));
  check('admin adds an option to a free group (Zebra control)', r.status === 201, short(r));
  r = await call('PATCH', '/rest/v1/option_values?id=eq.zebra:control:zz-test', { ...admin.hdr, ...REP }, { code: 'zz-changed' });
  check('an option code can never change', r.status >= 400, short(r));
  r = await call('PATCH', '/rest/v1/option_values?id=eq.zebra:control:zz-test', { ...admin.hdr, ...REP }, { active: false, explanation: 'x' });
  check('admin hides an option and edits its explanation', r.status === 200 && r.body[0]?.active === false, short(r));
  await guard.sharedRows('a second default in a real option group is refused', async () => {
    r = await call('PATCH', '/rest/v1/option_values?id=eq.roller:control:cordless', { ...admin.hdr, ...REP }, { is_default: true });
    check('only one default per group (a second default is refused)', r.status >= 400, short(r));
  });
  r = await call('POST', '/rest/v1/size_rules', { ...admin.hdr, ...REP }, { line_id: 'roman', subject: RULE_SUBJECT, when_values: { control: ['cordless'] }, max_width: 94 }); const ruleId = r.body?.[0]?.id; own(ruleId); cleanup.push(() => call('DELETE', `/rest/v1/size_rules?subject=eq.${enc(RULE_SUBJECT)}`, svc));
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
  check('the audit log recorded this admin\'s changes to options and size rules' + (guard.isLive ? '' : ', markups and adders'), (guard.isLive ? ['option_values', 'size_rules'] : ['pricing_lines', 'collection_markups', 'price_adders', 'option_values', 'size_rules']).every((t) => tbl.has(t)), [...tbl].join(', '));
  r = await call('GET', '/rest/v1/audit_log?select=id,new_row&table_name=eq.price_grids&limit=1000', admin.hdr);
  check('the audit log never stores a grid\'s cost cells (only a fingerprint)', Array.isArray(r.body) && r.body.every((e) => !e.new_row || !('cost' in e.new_row)), `${r.body.length} price_grids entries checked`);
  // the existing site is untouched
  const catAll = await est(anon, 'public_catalog', { p_scope: ['roller', 'zebra', 'shangri-la', 'cellular', 'roman', 'drapery', 'dream-curtains'] });
  const idsAll = new Set((catAll.body || []).flatMap((g) => g.swatches.map((x) => x.id)));
  check('the public catalog is unchanged (436 colors visible to anonymous visitors, through public_catalog; SP26030004 is hidden since migration 20)', idsAll.size === 436, `${idsAll.size} colors`);

  // ------------------------------------------------------------------ PRIVACY: what the customer side can learn
  console.log('\n=== PRIVACY (customer side)');
  const names = (await call('GET', '/rest/v1/fabrics?select=id,collection_name', svc)).body;
  const supp = (await call('GET', '/rest/v1/swatches?select=supplier_color_name&supplier_color_name=not.is.null', svc)).body;
  const payload = JSON.stringify(catAll.body);
  const leakedNames = names.filter((f) => new RegExp(`\\b${f.collection_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(payload)).map((f) => f.collection_name);
  check('the public catalog contains no price group (collection) names', leakedNames.length === 0, leakedNames.length ? `FOUND: ${leakedNames.slice(0, 8).join(', ')}` : `${names.length} names checked against ${payload.length} bytes`);
  check('the public catalog contains no price group ids', !names.some((f) => payload.includes(f.id)), `${names.length} ids checked`);
  // exactly these fields and no others (a supplier color name such as "White" is also an ordinary word, so values cannot be searched; the keys can)
  const GROUP_KEYS = 'composition,extra_specs,family,id,opacity,openness,product_line,shown_in,sort_order,swatches,thickness,use_area,weight,width,line_band_solid_in,line_band_sheer_in';       // line_band_*: the line's default Zebra band widths in inches (migration 24): display fields
  const SWATCH_KEYS = 'color_family,composition,display_name,family,fabric_id,id,image_kind,image_path,preview_color,roman_styles,shown_in,sort_order,styles,supplier_code,thumb_path,width,product_line,texture_mode,texture_type,texture_source,weave,weave_strength,zebra_solid_in,zebra_sheer_in';       // preview_color (migration 20) is the color the swatch shows as, and texture_mode / weave / weave_strength / zebra_*_in (migrations 24 and 25) how the fabric is drawn: display fields
  const okKeys = (o, allowed) => Object.keys(o).every((k) => allowed.split(',').includes(k));
  const badKeys = (catAll.body || []).filter((g) => !okKeys(g, GROUP_KEYS) || g.swatches.some((x) => !okKeys(x, SWATCH_KEYS))).length;
  check('the public catalog carries only display fields: no supplier color names, grades, extra costs, costs or price information', badKeys === 0 && !/supplier_color_name|"grade"|extra_cost|"price|"cost|markup|collection_name|multiplier/i.test(payload), `${(catAll.body || []).length} groups with unexpected fields: ${badKeys}`);
  for (const [label, hdr] of [['anonymous', anon], ['signed-in non-admin', plain.hdr]]) {
    const direct = [];
    for (const t of ['fabrics', 'swatches', 'swatch_links']) { const x = await call('GET', `/rest/v1/${t}?select=*&limit=3`, hdr); if (!refused(x)) direct.push(t); }
    check(`${label}: direct reads of fabrics, swatches and swatch_links are ${REQUIRE_CLOSED ? 'closed (migration 11)' : 'still open until migration 11 (main reads them)'}`, REQUIRE_CLOSED ? direct.length === 0 : true, direct.length ? `readable now: ${direct.join(', ')}` : 'all refused');
  }
  const anyExtra = (await call('GET', '/rest/v1/swatches?select=id&extra_cost=neq.0&limit=5', svc)).body;
  check('every existing color starts with an extra cost of $0 (no price changes today)', Array.isArray(anyExtra) && anyExtra.length === 0, `${anyExtra.length} colors with an extra cost`);
  // Extra cost and hiding edit a real color: staging only (skipped against the live project)
  await guard.sharedRows('extra cost on a color and hiding a color', async () => {
    globalThis.__lpShared = true;
    // extra cost is added to the customer price AFTER the markup, and only the price comes back
    const base = (await est(anon, 'estimate_price_for_swatch', SARGS())).body.price;
    await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW.sag)}`, { ...admin.hdr, ...REP }, { extra_cost: 12.5 }); sharedCleanup.push(() => call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW.sag)}`, svc, { extra_cost: orig.swatch.extra_cost }));
    const withExtra = await est(anon, 'estimate_price_for_swatch', SARGS());
    const dbgExtra = (await est(admin.hdr, 'estimate_price_debug_for_swatch', SARGS())).body;
    check('an extra cost of $12.50 is added after the markup (price +$12 or +$13 after rounding, whole dollars)', Number.isInteger(withExtra.body.price) && withExtra.body.price - base >= 12 && withExtra.body.price - base <= 13, `$${base} -> $${withExtra.body.price}`);
    check('the customer answer is still only price / custom size / price on request, and shows no extra cost', Object.keys(withExtra.body).sort().join() === 'custom_size,price,price_on_request' && !/extra/i.test(JSON.stringify(withExtra.body)), JSON.stringify(withExtra.body));
    check('the admin breakdown keeps the price group and the extra cost apart', dbgExtra.price_group?.name && Number(dbgExtra.extra_cost) === 12.5 && dbgExtra.price_before_extra === base, `group ${dbgExtra.price_group?.name}, extra ${dbgExtra.extra_cost}, before ${dbgExtra.price_before_extra}`);
    await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW.sag)}`, { ...admin.hdr, ...REP }, { extra_cost: orig.swatch.extra_cost });
    // a hidden color and an unknown color give no price, and no hint why
    await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW.sag)}`, { ...admin.hdr, ...REP }, { active: false });
    const hid = await est(anon, 'estimate_price_for_swatch', SARGS());
    await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW.sag)}`, svc, { active: orig.swatch.active });
    const unk = await est(anon, 'estimate_price_for_swatch', SARGS({ p_swatch_id: 'no-such-color' }));
    check('a hidden or unknown color gets "custom size" and nothing else', hid.body.custom_size === true && hid.body.price === null && unk.body.custom_size === true && unk.body.price === null, `${JSON.stringify(hid.body)} / ${JSON.stringify(unk.body)}`);
  });
  const unk = await est(anon, 'estimate_price_for_swatch', SARGS({ p_swatch_id: 'no-such-color' }));
  check('an unknown color gets "custom size" and nothing else', unk.body.custom_size === true && unk.body.price === null, JSON.stringify(unk.body));
  const sizes = [await est(anon, 'estimate_price_for_swatch', SARGS({ p_width: null, p_height: null })), await est(anon, 'estimate_price_for_swatch', SARGS({ p_width: 0 }))];
  check('no size, no price (custom size)', sizes.every((x) => x.body.price === null), JSON.stringify(sizes.map((x) => x.body)));
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  for (const fn of cleanup.reverse()) { try { await fn(); } catch { /* best effort */ } }
  // put back exactly what was read at the start (only if it was read: a failed start must not write guesses)
  // (only the staging project edits shared rows: against live nothing above changed a price, so there is nothing to put back)
  if (guard.target !== 'live' && globalThis.__lpShared) await guard.sharedRows('put back the shared rows', async () => {
    for (const fn of sharedCleanup.reverse()) { try { await fn(); } catch { /* best effort */ } }
    if (orig.markup !== undefined) await call('PATCH', '/rest/v1/pricing_lines?id=eq.roller', svc, { markup: orig.markup });
    if (orig.dream !== undefined) await call('PATCH', '/rest/v1/price_adders?adder_key=eq.motor-cost&line_id=eq.dream-curtains', svc, { amount: orig.dream });
    if (orig.swatch) await call('PATCH', `/rest/v1/swatches?id=eq.${enc(SW.sag)}`, svc, { extra_cost: orig.swatch.extra_cost, active: orig.swatch.active });
    if (orig.coll) { await call('DELETE', '/rest/v1/collection_markups?fabric_id=eq.roller:solar:sag', svc); for (const row of orig.coll) await call('POST', '/rest/v1/collection_markups', svc, row); }
  });
  for (const id of adminRows) await call('DELETE', `/rest/v1/admins?id=eq.${id}`, svc);
  for (const id of users) await call('DELETE', `/auth/v1/admin/users/${id}`, svc);
  const left = []; for (const id of users) left.push((await call('GET', `/auth/v1/admin/users/${id}`, svc)).status);
  const leftovers = [];
  // only what THIS run created is checked (never a search by name, which could match another run's rows)
  for (const [t, f] of [['option_values', `id=eq.${enc('zebra:control:zz-test')}`], ['size_rules', `subject=eq.${enc(RULE_SUBJECT)}`], ['product_lines', `id=eq.${ZP}`], ['pricing_lines', `id=eq.${ZP}`], ['fabrics', `id=in.(${enc(ZF1)},${enc(ZF2)})`], ['collection_markups', `fabric_id=in.(${enc(ZF1)},${enc(ZF2)})`], ...adminRows.map((id) => ['admins', `id=eq.${id}`])]) { const x = await call('GET', `/rest/v1/${t}?select=*&${f}`, svc); if (Array.isArray(x.body) && x.body.length) leftovers.push(`${t}:${x.body.length}`); }
  const mk = (await call('GET', '/rest/v1/pricing_lines?select=markup&id=eq.roller', svc)).body[0]?.markup;
  console.log(`\nclean-up: user lookups ${JSON.stringify(left)} (404 = gone); leftovers: ${leftovers.join(', ') || 'none'}; roller markup restored to ${mk}`);
  results.push({ name: 'clean-up left nothing behind', ok: left.every((x) => x === 404) && !leftovers.length && Number(mk) === 0.5 });
}
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ' | FAILED: ' + bad.map((x) => x.name).join('; ') : ''}`);
process.exit(bad.length ? 1 : 0);
