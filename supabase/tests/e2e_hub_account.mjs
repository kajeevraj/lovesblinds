// The Zigbee hub tick is saved with the cart: for a signed-in customer it is written to their order (orders.hub), comes back on another device,
// is cleared when the last Zigbee line goes, and the sent order keeps it with its price. The account's orders are answered by a fake REST
// endpoint (so this runs before migration 20 is applied); prices and swatches are live. Needs a preview server (BASE_URL, default http://localhost:4173).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const num = (t) => Number(String(t).replace(/[^\d]/g, ''));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'hub-test@example.com', app_metadata: {}, user_metadata: { full_name: 'Hub Test' }, created_at: new Date().toISOString() };
const session = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, role: 'authenticated', exp })}.sig`, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// one fake `orders` table shared by every "device" (browser context)
let row = null; const patches = [];
const device = async (w = 1280, h = 900) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([k, v]) => { try { if (!localStorage.getItem('__seeded')) { localStorage.clear(); localStorage.setItem('__seeded', '1'); localStorage.setItem(k, v); } } catch { /* ignore */ } }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  await page.route('**/auth/v1/user', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/rest/v1/orders*', async (r) => {
    const req = r.request(), one = /pgrst\.object/.test(req.headers().accept || '');
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (req.method() === 'PATCH') { const b = JSON.parse(req.postData() || '{}'); patches.push(b); row = { ...row, ...b, updated_at: new Date().toISOString() }; return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(one ? row : [row]) }); }
    if (req.method() === 'POST') { const b = JSON.parse(req.postData() || '{}'); row = { id: 'o-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), hub: false, ...b }; return r.fulfill({ status: 201, contentType: 'application/json', headers: cors, body: JSON.stringify(one ? row : [row]) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(row ? [row] : []) });
  });
  let sentBody = null;
  await page.route('**/api/quote', async (route) => { sentBody = JSON.parse(route.request().postData()); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, customerCopy: false }) }); });
  page.sent = () => sentBody;
  return page;
};
const card = (p, n) => p.locator('.s2-card').filter({ has: p.locator('.s2-card-name', { hasText: new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
const settle = (p) => p.waitForFunction(() => !/…|Calculating/.test(document.querySelector('.s2-total .s2-total-row strong')?.innerText || '…'), null, { timeout: 30000 });
const open = async (p) => { await p.goto(`${BASE}/order`, { waitUntil: 'networkidle' }); await p.locator('.s2-item').first().waitFor(); await settle(p); };
try {
  // device A: signed in, an empty draft, one Zigbee roller line saved to the order
  row = { id: 'o-1', user_id: user.id, name: 'Order 1', items: [], status: 'draft', hub: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const A = await device();
  await A.goto(`${BASE}/products/roller`, { waitUntil: 'networkidle' }); await A.locator('.s2-swgrid .s2-sw').first().waitFor(); await A.locator('.s2-swgrid .s2-sw').first().click();
  await A.locator('#s2-w').fill('40'); await A.locator('#s2-h').fill('64'); await card(A, 'Motorized').click(); await card(A, 'App + Voice + Remote (Zigbee)').click();
  await A.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled); await A.locator('.s2-add-btn').click(); await A.locator('.s2-added-card').waitFor(); await A.waitForTimeout(1500);       // the cart is saved to the order a moment after each change
  await open(A);
  check('device A: the account\'s cart has the Zigbee line (saved to the order) and the hub starts unchecked', (row.items || []).length === 1 && !(await A.locator('.s2-hub-check input').isChecked()));
  const zItems = row.items;
  patches.length = 0; await A.locator('.s2-hub-check input').check(); await A.waitForTimeout(800);
  check('ticking the hub writes hub = true to the account order', patches.some((p) => p.hub === true) && row.hub === true, JSON.stringify(patches));
  // device B: another browser, same account: the tick is already there and the $35 is in the total
  const B = await device(390, 844); await open(B);
  check('device B (same account, empty browser): the hub comes back checked and its $35 is in the total', (await B.locator('.s2-hub-check input').isChecked()) && (await B.locator('.s2-total-hub').count()) === 1 && /1 × \$35/.test(await B.locator('.s2-total').innerText()));
  patches.length = 0; await B.locator('.s2-hub-check input').uncheck(); await B.waitForTimeout(800);
  check('unticking it on device B writes hub = false', patches.some((p) => p.hub === false) && row.hub === false);
  const C = await device(); await open(C);
  check('device C sees it unchecked, and the hub option is still offered', !(await C.locator('.s2-hub-check input').isChecked()) && (await C.locator('.s2-hub-check input').count()) === 1);
  await C.locator('.s2-hub-check input').check(); await C.waitForTimeout(800);
  // removing the last Zigbee line clears the saved tick as well
  patches.length = 0;
  await C.locator('.s2-item').first().getByRole('button', { name: /remove/i }).click().catch(async () => { await C.locator('.s2-item-remove, [aria-label*="emove"]').first().click(); });
  await C.waitForTimeout(1500);
  check('removing the last Zigbee line hides the hub and clears the saved tick (hub = false)', (await C.locator('.s2-hub-check input').count()) === 0 && row.hub === false, JSON.stringify(patches.map((p) => Object.keys(p))));
  // sending: the account order keeps the hub with the price it was sent at
  row = { ...row, items: zItems, hub: true, status: 'draft' };
  const D = await device(); await open(D);
  check('device D: a draft with hub = true shows the hub checked', await D.locator('.s2-hub-check input').isChecked());
  await D.goto(`${BASE}/order?checkout=1`); await D.locator('#o-name').waitFor(); await D.waitForTimeout(600);
  await D.locator('#o-name').fill('Hub Test'); await D.locator('#o-email').fill('hub-test@example.com'); await D.locator('#o-street').fill('1 Way'); await D.locator('#o-city').fill('City'); await D.locator('#o-state').fill('ST'); await D.locator('#o-zip').fill('12345').catch(() => {});
  patches.length = 0; await D.getByRole('button', { name: 'Send my order' }).click(); await D.getByRole('heading', { name: 'Your order is on its way to us' }).waitFor(); await D.waitForTimeout(1200);
  const sentPatch = patches.find((p) => p.status === 'sent');
  check('the sent order is saved with hub = true and hub_price = 35, and the email lines carry the hub once at quantity 1', sentPatch?.hub === true && Number(sentPatch?.hub_price) === 35 && D.sent().lines.filter((l) => l.accessory === 'zigbee-hub').length === 1, JSON.stringify(sentPatch && { hub: sentPatch.hub, hub_price: sentPatch.hub_price }));
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser.close();
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
