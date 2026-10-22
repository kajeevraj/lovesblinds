// Every item photo on the order page and in the order panel really loads (not blank), at 390 and 1280 px, for each kind of item.
// Needs a preview on BASE_URL (default http://localhost:4173).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch();
try {
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } }); page.setDefaultTimeout(30000);
    const failed = []; page.on('response', (r) => { if (/images\/site\//.test(r.url()) && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    const size = async () => { await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64'); await page.waitForFunction(() => !document.querySelector('.s2-bar-btn').disabled); };
    const add = async () => { await page.locator('.s2-bar-btn').click(); await page.locator('.s2-added').waitFor(); await page.getByRole('button', { name: 'Keep shopping' }).click(); await page.waitForTimeout(150); };
    const open = async (slug) => { await page.goto(`${BASE}/products/${slug}`); await page.locator('.s2-sw').first().waitFor(); };
    // one item of each kind of photo: Roller (Solar, Screen view, Blackout), Zebra, Shangri-La, Roman, Cellular (standard, top-down), Curtains, Dream Curtains
    for (const fabric of ['Solar', 'Screen view', 'Blackout']) { await open('roller'); await page.locator('.s2-card', { hasText: new RegExp(`^${fabric}`) }).first().click(); await page.locator('.s2-sw').first().click(); await size(); await add(); }
    await open('zebra'); await page.locator('.s2-sw').first().click(); await size(); await add();
    await open('shangri-la'); await page.locator('.s2-sw').first().click(); await size(); await add();
    await open('roman'); await page.locator('.s2-sw').first().click();
    await page.locator('.s2-step', { hasText: 'Style' }).locator('.s2-card:not([disabled])').first().click();
    await page.locator('.s2-step', { hasText: 'Lining' }).locator('.s2-card:not([disabled])').first().click(); await size(); await add();
    await open('cellular'); await page.locator('.s2-sw').first().click(); await size(); await add();
    await open('cellular'); await page.locator('.s2-card', { hasText: 'Top-down/bottom-up' }).click(); await page.locator('.s2-sw').first().click(); await size(); await add();
    await open('drapery'); await page.locator('.s2-sw').first().click();
    await page.locator('.s2-step', { hasText: 'Pleat style' }).locator('.s2-card').first().click(); await page.locator('.s2-step', { hasText: 'Lining' }).locator('.s2-card').first().click(); await size(); await add();
    await page.getByRole('tab', { name: 'Dream Curtains' }).click(); await page.locator('.s2-sw').first().click();
    if (await page.locator('.s2-color-style .s2-card').count()) await page.locator('.s2-color-style .s2-card').first().click();
    await size(); await add();

    const loaded = (sel) => page.evaluate(async (s) => {
      const imgs = [...document.querySelectorAll(s)];
      await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; setTimeout(r, 5000); }))));
      return imgs.map((i) => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), eager: i.loading === 'eager' }));
    }, sel);
    await page.goto(`${BASE}/order`); await page.locator('.s2-item').first().waitFor();
    const order = await loaded('.s2-item img');
    check(`[${w}px] order page: all 10 item photos load, are shown at full size and are not lazy`, order.length === 10 && order.every((i) => i.ok && i.w >= 72 && i.h >= 56 && i.eager), JSON.stringify(order.filter((i) => !i.ok || !i.eager)) || `${order.length} photos`);
    await page.goto(`${BASE}/`); await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel-photo').first().waitFor();
    const panel = await loaded('.s2-panel-photo');
    check(`[${w}px] order panel: all 10 item photos load`, panel.length === 10 && panel.every((i) => i.ok && i.w >= 60 && i.h >= 40), JSON.stringify(panel.filter((i) => !i.ok)));
    check(`[${w}px] no photo request failed`, failed.length === 0, failed.join(', '));
    await page.close();
  }
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
