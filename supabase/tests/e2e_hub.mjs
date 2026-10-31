// Browser test of the Zigbee hub in the cart (live Supabase for prices; /api/quote is intercepted, nothing is sent). Needs a preview server (BASE_URL, default http://localhost:4173).
// The hub appears once per order only while a cart line uses an App + Voice + Remote (Zigbee) motor, is unchecked by default, adds $35 once,
// goes into the order as its own line (quantity 1), and disappears (unchecked) when the last Zigbee line is removed.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const num = (t) => Number(String(t).replace(/[^\d]/g, ''));
const HUB_TEXT = 'Zigbee hub, $35. Needed once per home to control Zigbee shades with your phone or voice. Skip it if you already have one.';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const [vw, vh] of [[390, 844], [1280, 900]]) {
    const T = (s) => `[${vw}px] ${s}`;
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, hasTouch: vw < 500, isMobile: vw < 500 });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    let sentBody = null;
    await page.route('**/api/quote', async (route) => { sentBody = JSON.parse(route.request().postData()); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, customerCopy: false }) }); });
    const card = (n) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
    const addRoller = async (control) => {
      await page.goto(`${BASE}/products/roller`, { waitUntil: 'networkidle' }); await page.locator('.s2-swgrid .s2-sw').first().waitFor();
      await page.locator('.s2-swgrid .s2-sw').first().click(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
      if (control) { await card('Motorized').click(); await card(control).click(); }
      await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled); await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    };
    const hubBox = page.locator('.s2-hub-check input');
    const totalNow = async () => num(await page.locator('.s2-total .s2-total-row strong').innerText());
    const openCart = async () => { await page.goto(`${BASE}/order`, { waitUntil: 'networkidle' }); await page.locator('.s2-item').first().waitFor(); await page.waitForFunction(() => !/…|Calculating/.test(document.querySelector('.s2-total .s2-total-row strong')?.innerText || '…'), null, { timeout: 30000 }); };

    // a chain shade: no hub anywhere
    await addRoller(null); await openCart();
    check(T('no Zigbee line: no hub in the cart page or the cart panel'), (await hubBox.count()) === 0 && await (async () => { await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' }); await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor(); const n = await page.locator('.s2-panel .s2-hub').count(); await page.keyboard.press('Escape'); await openCart(); return n === 0; })());
    const base = await totalNow();
    // a Zigbee line: the hub is offered, unchecked, with the owner's words
    await addRoller('App + Voice + Remote (Zigbee)'); await openCart();
    const withZ = await totalNow();
    check(T('a Zigbee line: the hub option appears once, unchecked, with the exact words'), (await hubBox.count()) === 1 && !(await hubBox.isChecked()) && (await page.locator('.s2-hub-text').innerText()).replace(/\s+/g, ' ') === HUB_TEXT, (await page.locator('.s2-hub-text').innerText().catch(() => '')));
    check(T('the hub is not in the total until it is checked'), (await page.locator('.s2-total-hub').count()) === 0 && withZ > base);
    await hubBox.check();
    check(T('checking it adds $35 to the total once, as its own line "1 × $35"'), (await totalNow()) === withZ + 35 && /Zigbee hub[\s\S]*1 × \$35/.test(await page.locator('.s2-total').innerText()));
    // a second Zigbee line: still one hub, still +$35 once
    await addRoller('App + Voice + Remote (Zigbee)'); await openCart();
    const two = await totalNow();
    check(T('a second Zigbee line: still one hub option, still checked, still one $35 in the total'), (await hubBox.count()) === 1 && (await hubBox.isChecked()) && (await page.locator('.s2-total-hub').count()) === 1 && two > withZ + 35);
    // the cart panel shows the same single checkbox, in step
    await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' }); await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor();
    const panelHub = page.locator('.s2-panel .s2-hub-check input');
    if (await panelHub.count()) {
      check(T('the cart panel has the hub too (once), checked'), (await panelHub.count()) === 1 && (await panelHub.isChecked()));
      await panelHub.uncheck(); await page.waitForTimeout(300);
      check(T('unchecking in the panel takes the $35 out of the panel total'), (await page.locator('.s2-panel .s2-total-hub').count()) === 0);
      await panelHub.check();
    } else check(T('the cart panel has the hub too'), false, 'no panel checkbox');
    await page.keyboard.press('Escape');
    await openCart();
    // sending: the hub is its own line, quantity 1
    await page.getByRole('button', { name: 'Checkout' }).first().click(); await page.locator('#o-name').waitFor();
    await page.fill('#o-name', 'Ada Test'); await page.fill('#o-email', 'ada@example.com'); await page.fill('#o-street', '1 Way'); await page.fill('#o-city', 'Raleigh'); await page.fill('#o-state', 'NC'); await page.fill('#o-zip', '27601');
    await page.getByRole('button', { name: 'Send my order' }).click(); await page.getByText('Your order is on its way to us').waitFor();
    const hubs = (sentBody?.lines || []).filter((l) => l.accessory === 'zigbee-hub');
    check(T('the order sent has exactly one hub line, quantity 1, and the confirmation lists it'), hubs.length === 1 && hubs[0].qty === 1 && hubs[0].productName === 'Zigbee hub' && /Zigbee hub[\s\S]*\$35/.test(await page.locator('.s2-sent-list').innerText()));
    check(T('after sending the next order starts without the hub'), await (async () => { await addRoller('App + Voice + Remote (Zigbee)'); await openCart(); return (await hubBox.count()) === 1 && !(await hubBox.isChecked()); })());

    // unchecked: not in the order
    sentBody = null;
    await page.getByRole('button', { name: 'Checkout' }).first().click(); await page.locator('#o-name').waitFor();
    await page.fill('#o-name', 'Ada Test'); await page.fill('#o-email', 'ada@example.com'); await page.fill('#o-street', '1 Way'); await page.fill('#o-city', 'Raleigh'); await page.fill('#o-state', 'NC'); await page.fill('#o-zip', '27601');
    await page.getByRole('button', { name: 'Send my order' }).click(); await page.getByText('Your order is on its way to us').waitFor();
    check(T('unchecked: no hub line in the order'), (sentBody?.lines || []).every((l) => l.accessory !== 'zigbee-hub') && (sentBody?.lines || []).length === 1);

    // removing every Zigbee line removes the hub option and unchecks it
    await addRoller('App + Voice + Remote (Zigbee)'); await openCart(); await hubBox.check();
    await page.getByRole('button', { name: /^Remove/ }).first().click(); await page.waitForTimeout(500);
    check(T('removing the last Zigbee line hides the hub and takes its $35 out'), (await hubBox.count()) === 0 && (await page.locator('.s2-total-hub').count()) === 0);
    await addRoller('App + Voice + Remote (Zigbee)'); await openCart();
    check(T('a Zigbee line added again offers the hub unchecked (it was unchecked when it left)'), (await hubBox.count()) === 1 && !(await hubBox.isChecked()));

    // the product page note
    await page.goto(`${BASE}/products/roller`, { waitUntil: 'networkidle' }); await page.locator('.s2-swgrid .s2-sw').first().waitFor();
    await card('Motorized').click(); await card('App + Voice + Remote (Zigbee)').click(); await page.waitForTimeout(500);
    const main = await page.locator('main').innerText();
    check(T('the product page says: Needs a Zigbee hub. Add one in your cart for $35 if you don\'t have one.'), /Needs a Zigbee hub\. Add one in your cart for \$35 if you don't have one\./.test(main) && !/sold separately/.test(main));
    check(T('no sideways scrolling and no page errors'), (await page.evaluate(() => document.documentElement.scrollWidth)) <= vw && errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
