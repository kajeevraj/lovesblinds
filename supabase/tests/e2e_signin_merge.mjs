// What happens when a customer signs in: a guest's order in progress joins a DRAFT of the account (never a sent order), a sent
// order is never reopened or changed, and a guest's own sent order is never saved to any account (guests have no saved orders).
// A temporary customer is created and removed. Needs a preview on BASE_URL (default http://localhost:4173) and the three env vars.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
let userId, token, browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const orderCalls = []; page.on('request', (r) => { if (/rest\/v1\/orders/.test(r.url()) && r.method() !== 'GET') orderCalls.push(r.method()); });
  await page.route('**/api/quote', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, customerCopy: false }) }));

  // 1. a guest builds an order and SENDS one (guests have no account, so nothing is saved to any order)
  await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click();
  await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64'); await page.waitForFunction(() => !document.querySelector('.s2-bar-btn').disabled); await page.locator('.s2-bar-btn').click(); await page.locator('.s2-flash').waitFor();
  await page.goto(`${BASE}/order`); await page.locator('#o-name').waitFor(); await page.waitForTimeout(600);
  await page.locator('#o-name').fill('Guest'); await page.locator('#o-email').fill('guest@example.com'); await page.locator('#o-street').fill('1 Way'); await page.locator('#o-city').fill('City'); await page.locator('#o-state').fill('ST'); await page.locator('#o-zip').fill('12345');
  await page.getByRole('button', { name: 'Send my order' }).click(); await page.getByRole('heading', { name: 'Your order is on its way to us' }).waitFor();
  check('a guest\'s sent order is not saved anywhere (no orders written, nothing to attach to an account later)', orderCalls.length === 0, orderCalls.join(','));

  // 2. an account whose newest order was SENT, and a guest with a new order in progress who then signs in
  const email = `zz-merge-${Date.now()}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true, user_metadata: { full_name: 'Merge Test' } }); userId = cu.body.id;
  token = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password })).body;
  const sentItems = [{ productId: 'zebra', variant: 'Zebra', mech: 'chain', mount: 'inside', colorCode: 'X', colorName: 'Old', selection: null, width: 30, length: 50, qty: 1, roomLabel: 'Old room', addons: {}, price: 99, priceKind: 'estimate' }];
  const old = (await api('POST', '/rest/v1/orders', H(ANON, token.access_token), { user_id: userId, name: 'Old order', items: sentItems, status: 'sent' })).body[0];
  check('set-up: the account\'s newest order is a sent one', old?.status === 'sent');

  await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click();
  await page.locator('#s2-w').fill('44'); await page.locator('#s2-h').fill('66'); await page.waitForFunction(() => !document.querySelector('.s2-bar-btn').disabled); await page.locator('.s2-bar-btn').click(); await page.locator('.s2-flash').waitFor();
  check('the guest has one item in progress, kept in the browser', JSON.parse(await page.evaluate(() => localStorage.getItem('lb_guest_quote') || '[]')).length === 1);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify(token)]);     // "signs in" (as the other browser tests do)
  await page.goto(`${BASE}/order`); await page.locator('.s2-item').first().waitFor(); await page.waitForTimeout(2500);
  const text = await page.locator('main').innerText();
  check('after signing in the cart holds the guest\'s item (44 x 66), not the sent order\'s item (30 x 50)', (await page.locator('.s2-item').count()) === 1 && /44" wide × 66" high/.test(text) && !/30" wide|Old room/.test(text), text.replace(/\s+/g, ' ').slice(0, 140));
  const orders = (await api('GET', `/rest/v1/orders?select=id,name,status,items&user_id=eq.${userId}&order=created_at.asc`, H(ANON, token.access_token))).body;
  const sentNow = orders.find((o) => o.id === old.id), draft = orders.find((o) => o.status === 'draft');
  check('a new draft was made for it, with the guest\'s item saved in it', !!draft && draft.items.length === 1 && draft.items[0].width === 44, JSON.stringify(orders.map((o) => [o.name, o.status, o.items.length])));
  check('the sent order is exactly as it was sent (items, status)', sentNow.status === 'sent' && JSON.stringify(sentNow.items) === JSON.stringify(old.items));
  check('the guest\'s items are no longer kept in the browser (they are in the account now)', (await page.evaluate(() => localStorage.getItem('lb_guest_quote'))) === null);
  await page.goto(`${BASE}/orders`); await page.locator('.order-card').first().waitFor();
  check('My Orders lists the sent order as Sent and the new one as in progress and active', (await page.locator('.order-pill-sent').count()) === 1 && (await page.locator('.order-pill-active').count()) === 1 && /In progress/.test(await page.locator('main').innerText()));
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  try { if (token?.access_token) { const o = await api('GET', `/rest/v1/orders?select=id&user_id=eq.${userId}`, H(ANON, token.access_token)); for (const r of o.body || []) await api('DELETE', `/rest/v1/orders?id=eq.${r.id}`, H(ANON, token.access_token)); } } catch { /* ignore */ }
  if (userId) await api('DELETE', `/auth/v1/admin/users/${userId}`, H(SVC));
  await browser?.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
