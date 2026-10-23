// Browser test of the order bar (the cart) at 390 and 1280 px: the bar on product pages and other pages, the panel (bottom sheet on
// phones, side panel on desktop), adding, editing from the panel and from the order page, a refresh in the middle of an edit,
// removing, and sentence case for option names. Needs a preview on BASE_URL (default http://localhost:4173).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const TITLE_CASE = /Inside Mount|Outside Mount|Screen View|Top-Down|Day & Night|Plain Fold|Light Filtering|French Pleat|Euro Pleat|Pinch Pleat|Inverted Pleat|Ripple Fold/;
const browser = await chromium.launch();
try {
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const T = (s) => `[${w}px] ${s}`;
    const price = async () => Number((await page.locator('.s2-estimate-price').first().innerText()).replace(/\D/g, ''));
    const ready = async () => { await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled); };

    // other pages: no bar while the order is empty
    for (const path of ['/', '/products', '/measure']) { await page.goto(`${BASE}${path}`); await page.waitForTimeout(300); }
    check(T('the home, products and measuring pages show no bar while the cart is empty'), (await page.locator('.s2-bar').count()) === 0);

    // product page: the bar before and after adding
    await page.goto(`${BASE}/products/roller`); await page.locator('.s2-sw').first().waitFor();
    check(T('product page bar: nothing on the left until there is a price, "Your cart is empty" on the right, no Add button and no Checkout'), /This blind: choose a color and size/.test(await page.locator('.s2-bar-blind').innerText()) && (await page.locator('.s2-bar .s2-add-btn').count()) === 0 && (await page.locator('.s2-bar-checkout').count()) === 0 && /Your cart is empty/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')));
    await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64'); await page.locator('#s2-qty').fill('3');
    await page.locator('#s2-room').selectOption('Living room'); await ready();
    const unit = Number((await page.locator('.s2-estimate-each').innerText()).match(/\$(\d+) each/)[1]);
    check(T('the bar shows the item total large and "$X each · 3 blinds" small under it'), (await price()) === unit * 3 && (await page.locator('.s2-estimate-each').innerText()).trim() === `$${unit} each · 3 blinds`);
    check(T('closed bar is one row (no wrapping) and the Add button is inside the screen'), await page.evaluate(() => { const b = document.querySelector('.s2-bar').getBoundingClientRect(); return b.height < 80 && b.right <= innerWidth + 0.5 && document.querySelector('.s2-add-btn').getBoundingClientRect().right <= innerWidth; }));
    await page.locator('.s2-add-btn').click();
    await page.locator('.s2-added-card').waitFor();
    check(T('adding shows "Added to your cart" and updates the count and total at once'), /Added to your cart/.test(await page.locator('.s2-added-card').innerText()) && new RegExp(`Your cart: 1 item · \\$${unit * 3}`).test(await page.locator('.s2-bar-order').getAttribute('aria-label')));
    // add a second item, a Dream Curtains one (price by email is tested elsewhere)
    await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor();
    await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('30'); await page.locator('#s2-h').fill('50'); await ready();
    const zebraUnit = await price();
    await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();

    // other pages now show the order part alone
    await page.goto(`${BASE}/`); await page.locator('.s2-bar-only').waitFor();
    check(T('the home page shows only the cart part now, with the count and total'), (await page.locator('.s2-add-btn').count()) === 0 && new RegExp(`Your cart: 2 items · \\$${unit * 3 + zebraUnit}`).test(await page.locator('.s2-bar-order').getAttribute('aria-label')), (await page.locator('.s2-bar-order').getAttribute('aria-label')).replace(/\s+/g, ' '));
    for (const path of ['/products', '/measure']) { await page.goto(`${BASE}${path}`); await page.locator('.s2-bar-only').waitFor(); }
    check(T('the products list and the measuring guide show it too'), true);
    await page.goto(`${BASE}/order`); await page.locator('.s2-item').first().waitFor();
    check(T('the cart page has no bar'), (await page.locator('.s2-bar').count()) === 0);

    // the last step's buttons are never covered by the closed bar
    await page.goto(`${BASE}/products/roller`); await page.locator('.s2-sw').first().waitFor();
    await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64'); await ready();
    await page.locator('#s2-qty').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const cover = await page.evaluate(() => { const bar = document.querySelector('.s2-bar').getBoundingClientRect(); const els = [...document.querySelectorAll('.s2-qty-btn, .s2-qty-input, .s2-estimate a, .s2-estimate button')]; return els.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > bar.top + 0.5 && r.top < bar.bottom; }).length; });
    check(T('scrolled to the end, the bar does not cover the quantity buttons or anything above it'), cover === 0, `${cover} covered`);

    // the choices just made on that page are an unfinished draft; this test is about the finished items, so clear it
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('lb_draft_v1:')).forEach((k) => localStorage.removeItem(k)));
    await page.goto(`${BASE}/`); await page.locator('.s2-bar-only').waitFor();

    // the panel
    await page.locator('.s2-bar-order').click();
    await page.locator('.s2-panel').waitFor(); await page.waitForTimeout(500);
    const box = await page.locator('.s2-panel').boundingBox();
    check(T(w < 760 ? 'the panel is a bottom sheet on phones' : 'the panel slides up from the bar on desktop (a sheet on the right, over the cart half)'), w < 760 ? (box.width >= w - 1 && Math.abs(box.y + box.height - h) < 2) : (box.x + box.width >= w - 24 - 1 && box.width < w / 2 && Math.abs(box.y + box.height - h) < 2 && box.height < h), JSON.stringify(box));
    const panel = await page.locator('.s2-panel').innerText();
    check(T('the panel lists each item (product, color and code, size, blinds, price), the estimated total and the Checkout button'), /Roller Shades/.test(panel) && /40" wide × 64" high/.test(panel) && /Living room/.test(panel) && new RegExp(`\\$${unit * 3}`).test(panel) && /Zebra/.test(panel) && /\([A-Z0-9-]+\)/.test(panel) && new RegExp(`Estimated total\\s*\\$${unit * 3 + zebraUnit}`).test(panel) && /Checkout/.test(panel) && (await page.getByRole('button', { name: /^Remove/ }).count()) === 2 && (await page.getByRole('link', { name: /^Edit / }).count()) === 2);
    check(T('option names in the panel and on the page are in sentence case'), !TITLE_CASE.test(panel + await page.locator('main').innerText()));
    await page.keyboard.press('Escape');
    check(T('Escape closes the panel'), (await page.locator('.s2-panel').count()) === 0);

    // edit from the panel (the Edit link and clicking the item do the same)
    await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor();
    await page.getByRole('link', { name: /^Edit Roller/ }).click();
    await page.waitForFunction(() => /\?edit=/.test(location.search));
    await page.locator('#s2-w').waitFor(); await page.locator('.s2-sw.on').waitFor();
    check(T('clicking an item in the panel opens its page with every choice filled in and a "Save changes" button and Cancel link'), (await page.locator('.s2-add-btn').innerText()) === 'Save changes' && (await page.locator('#s2-w').inputValue()) === '40' && (await page.locator('#s2-h').inputValue()) === '64' && (await page.locator('#s2-qty').inputValue()) === '3' && (await page.locator('#s2-room').inputValue()) === 'Living room' && (await page.locator('.s2-sw.on').count()) === 1 && (await page.getByRole('link', { name: 'Cancel' }).count()) >= 1);
    const editUrl = page.url();
    // refresh in the middle of an edit
    await page.locator('#s2-w').fill('48 1/2');
    await page.reload(); await page.locator('#s2-w').waitFor();
    check(T('after a refresh the same item is open again, with the unsaved change kept (autosave)'), page.url() === editUrl && (await page.locator('.s2-add-btn').innerText()) === 'Save changes' && (await page.locator('#s2-w').inputValue()) === '48 1/2');
    // change the fraction and save
    await page.locator('#s2-w').fill('40 1/8'); await page.locator('#s2-qty').fill('2'); await page.waitForFunction(() => /each · 2 blinds/.test(document.querySelector('.s2-estimate-each')?.innerText || ''));
    await page.locator('.s2-add-btn').click();
    await page.waitForFunction(() => location.pathname === '/order'); await page.locator('.s2-item').first().waitFor();
    await page.waitForFunction(() => /40 1\/8" wide × 64" high/.test(document.querySelector('.s2-item').innerText) && !/Calculating/.test(document.querySelector('.s2-items').innerText));
    const first = await page.locator('.s2-item').first().innerText();
    check(T('Save changes updated the same item: 40 1/8", 2 blinds, still two items'), (await page.locator('.s2-item').count()) === 2 && /40 1\/8" wide × 64" high/.test(first) && /2 blinds/.test(first) && /Living room/.test(first));

    // edit from the order page, then Cancel
    await page.locator('.s2-item').nth(1).click();
    await page.locator('#s2-w').waitFor();
    check(T('clicking an item on the order page opens its page too (Zebra)'), /\/products\/zebra\?edit=/.test(page.url()) && (await page.locator('#s2-w').inputValue()) === '30');
    await page.getByRole('link', { name: 'Cancel' }).first().click();
    await page.waitForFunction(() => location.pathname === '/order');
    check(T('Cancel goes back to the cart and changes nothing'), (await page.locator('.s2-item').count()) === 2);

    // an unknown or stale edit link just opens a new blank page
    await page.goto(`${BASE}/products/roller?edit=nope`); await page.locator('.s2-sw').first().waitFor();
    check(T('an edit link for an item that is not in the order opens the page as a new item'), (await page.locator('.s2-add-btn').innerText()) === 'Add to cart' && (await page.locator('.s2-editing').count()) === 0);

    // remove from the panel
    await page.goto(`${BASE}/`); await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor();
    await page.getByRole('button', { name: /^Remove Zebra/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('.s2-panel-item').length === 1);
    check(T('Remove in the panel takes the item out and the total follows'), /Estimated total\s*\$\d+/.test(await page.locator('.s2-panel-foot').innerText()) && !/Zebra/.test(await page.locator('.s2-panel-items').innerText()));
    await page.locator('.s2-panel-go').click();
    await page.waitForFunction(() => location.pathname === '/order'); await page.locator('.s2-co-summary').waitFor();
    await page.getByRole('button', { name: 'See items' }).click(); await page.locator('.s2-item').first().waitFor();
    check(T('"Checkout" in the panel opens the checkout page (summary, items behind "See items")'), (await page.locator('.s2-item').count()) === 1 && page.url().includes('checkout=1') && (await page.locator('.s2-panel').count()) === 0);
    await page.goto(`${BASE}/order`); await page.locator('.s2-item').first().waitFor();
    await page.getByRole('button', { name: 'Remove' }).click();
    check(T('removing the last item empties the order (the bar is gone on other pages again)'), /Your cart is empty/.test(await page.locator('main').innerText()));
    await page.goto(`${BASE}/products`); await page.waitForTimeout(300);
    check(T('with an empty order the products page has no bar'), (await page.locator('.s2-bar').count()) === 0);

    // sentence case on every product page
    const badCase = [];
    for (const slug of ['roller', 'zebra', 'shangri-la', 'roman', 'cellular', 'drapery']) {
      await page.goto(`${BASE}/products/${slug}`); await page.locator('.s2-sw').first().waitFor();
      const bad = TITLE_CASE.exec(await page.locator('main').innerText());
      if (bad) badCase.push(`${slug}: ${bad[0]}`);
    }
    check(T('option names on all six product pages are in sentence case'), badCase.length === 0, badCase.join('; '));
    await ctx.close();
  }
  // the admin page has no order bar
  const a = await browser.newPage(); await a.goto(`${BASE}/admin`); await a.waitForTimeout(1500);
  check('the admin page has no order bar or panel', (await a.locator('.s2-bar, .s2-panel').count()) === 0);
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
