// Browser test of the round-3 changes at 390 and 1280 px: the bar's main button (Add to cart / Checkout / Save changes), "These blinds",
// the phone bar (nothing clipped or under the divider), "Add this blind to your cart first?", the top Cart button opening the panel,
// checkout errors (scroll, focus, "N things to fix"), the checkout summary, the confirmation list, plain offline errors, "Saved" and
// Undo, the editing banner, Finish choosing, Add another like this, wording (Zebra Shades, Price by email), My orders, and the small fixes.
// A temporary customer is used for My orders and deleted afterwards. Needs a preview on BASE_URL (default http://localhost:4173) and
// SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Sends no email (the order and contact endpoints are answered by the test).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const migrated = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/public_options`, { method: 'POST', headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{"p_line":"roller"}' }).then((r) => r.ok).catch(() => false);
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `\n      ${detail}` : ''}`); };

// helpers for the new size boxes (whole inches + a "+ fraction" dropdown) and the curtain steps (style, fullness, liner, panels)
const sizeOf = async (page, k) => { const w = await page.locator(`#s2-${k}`).inputValue(); const f = await page.locator(`#s2-${k}-frac`).inputValue(); return f ? (w ? `${w} ${f}` : f) : w; };
const pickCurtains = async (page) => {
  const st = (t) => page.locator('.s2-step', { has: page.locator('.s2-step-title', { hasText: new RegExp(`^\\s*\\d+\\s*${t}\\s*$`) }) });
  await st('Style').locator('.s2-card').nth(1).click(); await st('Fullness').locator('.s2-card').first().click();
  await st('Liner').locator('.s2-card').first().click(); await st('Panels').locator('.s2-card').first().click();
};
let browser, userId;
const ready = (page) => page.waitForFunction(() => { const b = document.querySelector('.s2-add-btn'); return b && !b.disabled; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  browser = await chromium.launch();
  for (const width of [390, 1280]) {
    const phone = width < 760;
    const T = (s) => `[${width}px] ${s}`;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    let sentBody = null, mode = 'ok';
    await page.route('**/api/quote', async (route) => {
      sentBody = JSON.parse(route.request().postData());
      if (mode === 'offline') return route.abort();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, customerCopy: false }) });
    });
    const label = () => page.locator('.s2-bar-main-btn').innerText().catch(() => '(none)');
    const pick = async (slug) => { await page.goto(`${BASE}/products/${slug}`); await page.locator('.s2-sw').first().waitFor(); };
    const addBlind = async (slug, w, h, opts = {}) => { await pick(slug); await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill(w); await page.locator('#s2-h').fill(h); if (opts.room) await page.locator('#s2-room').selectOption(opts.room); await ready(page); await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor(); };

    // ---------- the bar's main button follows the page
    await pick('roller');
    check(T('nothing chosen and an empty cart: the bar has no main button and says "This blind: choose a color and size"'), (await page.locator('.s2-bar-main-btn').count()) === 0 && /This blind: choose a color and size/.test(await page.locator('.s2-bar-blind').innerText()));
    await page.locator('.s2-sw').first().click();
    check(T('a color but no size, empty cart: still no main button'), (await page.locator('.s2-bar-main-btn').count()) === 0);
    await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64'); await ready(page);
    check(T('ready and not added: the bar button is "Add to cart", and the card keeps its own'), (await label()) === 'Add to cart' && (await page.locator('.s2-estimate .s2-add-btn').count()) === 1);
    await page.locator('#s2-qty').fill('3'); await sleep(300);
    check(T('quantity 3: the label is "These blinds"; desktop shows "3 × $x = $y"'), /These blinds/i.test(await page.locator('.s2-bar-blind').textContent()) && (phone || /^3 × \$\d+ = \$\d+$/.test((await page.locator('.s2-bar-price').innerText()).trim())));
    await page.locator('#s2-qty').fill('1'); await sleep(200);
    check(T('quantity 1: back to "This blind"'), /This blind/i.test(await page.locator('.s2-bar-blind').textContent()) && !/These blinds/i.test(await page.locator('.s2-bar-blind').textContent()));
    await page.locator('.s2-bar-main-btn').click(); await page.locator('.s2-added-card').waitFor();
    check(T('tapping the bar button adds the blind: the card confirms and the bar button becomes "Checkout"'), (await label()) === 'Checkout' && /Your cart: 1 item/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')));
    await page.locator('#s2-qty').fill('2'); await sleep(200);
    check(T('changing the quantity after adding brings "Add to cart" back'), (await label()) === 'Add to cart');
    await page.locator('#s2-qty').fill('1'); await sleep(200);

    // ---------- the phone bar: nothing clipped, nothing under the divider
    for (const [vw, vh] of [[320, 568], [360, 640], [390, 844], [768, 900], [1280, 900]]) {
      if ((vw < 760) !== phone && vw !== 768) continue;
      if (vw === 768 && phone) continue;
      await page.setViewportSize({ width: vw, height: vh }); await sleep(300);
      const m = await page.evaluate(() => { const o = document.querySelector('.s2-bar-order'), bl = document.querySelector('.s2-bar-blind'), dv = document.querySelector('.s2-bar-divider'), bt = document.querySelector('.s2-bar-main-btn'); const kids = [...bl.querySelectorAll('*')].map((e) => e.getBoundingClientRect().right); return { cart: o.scrollWidth > o.clientWidth + 1, blindClip: bl.scrollWidth > bl.clientWidth + 1, underDivider: Math.max(...kids) > dv.getBoundingClientRect().left + 0.5, textVsBtn: document.querySelector('.s2-bar-order-text').getBoundingClientRect().right > bt.getBoundingClientRect().left + 0.5, sw: document.documentElement.scrollWidth > innerWidth, btnH: bt.getBoundingClientRect().height, inside: bt.getBoundingClientRect().right <= innerWidth }; });
      check(T(`bar at ${vw} px: no clipped text, nothing under the divider, 48 px button, no sideways scroll`), !m.cart && !m.blindClip && !m.underDivider && !m.textVsBtn && !m.sw && m.btnH === 48 && m.inside, JSON.stringify(m));
    }
    await page.setViewportSize({ width, height: phone ? 844 : 900 });
    if (phone) { const k = await page.locator('.s2-bar-order-text').innerText(); check(T('phone bar: the small line says "Cart" (not hidden)'), /^Cart/.test(k.trim()), k); }

    // ---------- Checkout with a ready blind on the page: "Add this blind to your cart first?"
    await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('30'); await page.locator('#s2-h').fill('50'); await ready(page);
    await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor(); await page.locator('.s2-panel-go').click();
    await page.getByRole('dialog', { name: /Add this blind to your cart first/ }).waitFor();
    check(T('Checkout with a ready blind on the page asks "Add this blind to your cart first?" with Add and Skip'), (await page.getByRole('button', { name: 'Add', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Skip' }).count()) === 1);
    await page.getByRole('button', { name: 'Skip' }).click(); await page.locator('#s2-details-title').waitFor();
    const afterSkip = await page.evaluate(() => JSON.parse(localStorage.getItem('lb_guest_quote') || '[]').length);
    check(T('Skip goes to checkout without the blind (the cart still has 1 item, nothing is left incomplete)'), afterSkip === 1 && page.url().includes('checkout=1'));
    await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('30'); await page.locator('#s2-h').fill('50'); await ready(page);
    await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel-go').click(); await page.getByRole('dialog', { name: /Add this blind/ }).waitFor();
    await page.getByRole('button', { name: 'Add', exact: true }).click(); await page.locator('#s2-details-title').waitFor();
    check(T('Add puts the blind in the cart and goes to checkout (2 items)'), (await page.evaluate(() => JSON.parse(localStorage.getItem('lb_guest_quote') || '[]').length)) === 2);

    // ---------- checkout: summary on top, errors, plain offline message, confirmation list
    check(T('checkout opens at the top with a summary "N blinds · $total · See items"; the items are folded away'), (await page.evaluate(() => scrollY)) < 40 && /2 blinds · \$\d+/.test(await page.locator('.s2-co-summary').innerText()) && (await page.locator('.s2-item').count()) === 0);
    await page.getByRole('button', { name: 'See items' }).click();
    check(T('"See items" shows the items'), (await page.locator('.s2-item').count()) === 2);
    await page.getByRole('button', { name: 'Send my order' }).scrollIntoViewIfNeeded(); await page.getByRole('button', { name: 'Send my order' }).click(); await sleep(500);
    check(T('Send with missing fields: "6 things to fix" above the button, and the first error is focused and on screen'), /^6 things to fix$/.test((await page.locator('.s2-fix-summary').innerText()).trim()) && (await page.evaluate(() => document.activeElement?.id)) === 'o-name' && await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    await page.locator('#o-name').fill('Alex Rivera'); await sleep(100);
    check(T('the count goes down as fields are fixed'), /^5 things to fix$/.test((await page.locator('.s2-fix-summary').innerText()).trim()));
    await page.locator('#o-email').fill('alex@example.com'); await page.locator('#o-street').fill('12 Oak Street'); await page.locator('#o-city').fill('Raleigh'); await page.locator('#o-state').fill('NC'); await page.locator('#o-zip').fill('27601');
    mode = 'offline';
    await page.getByRole('button', { name: 'Send my order' }).click(); await page.locator('.s2-send-error').waitFor();
    const off = await page.locator('.s2-send-error').innerText();
    check(T('offline: our plain message with the email and phone, never "Failed to fetch"'), /could not reach our server/i.test(off) && /loveblindswindows@gmail\.com/.test(off) && /434-0949/.test(off) && !/failed to fetch/i.test(off), off);
    mode = 'ok';
    await page.getByRole('button', { name: 'Send my order' }).click(); await page.getByRole('heading', { name: /on its way/ }).waitFor(); await sleep(300);
    check(T('confirmation: scrolled to the top'), (await page.evaluate(() => scrollY)) < 40);
    const conf = await page.locator('.s2-sent-list').innerText();
    check(T('confirmation: lists the items, quantities and the estimated total that were sent'), /What you sent/.test(conf) && /Zebra Shades/.test(conf) && /Roller Shades/.test(conf) && /1 blind/.test(conf) && /Estimated total\s*\$\d+/.test(conf) && sentBody.lines.length === 2, conf.replace(/\s+/g, ' '));
    check(T('no "Zebra / Dual Shades" anywhere in what was sent'), !/Dual/.test(JSON.stringify(sentBody)));

    // ---------- the top Cart button opens the panel, which links to the full cart page
    await addBlind('zebra', '30', '50', { room: 'Bedroom' }); await addBlind('roller', '40', '64', { room: 'Living room' });
    await page.goto(`${BASE}/products`); await page.locator('.s2-tile').first().waitFor();
    await page.locator('.s2-order-pill').click(); await page.locator('.s2-panel').waitFor();
    check(T('the top "Cart (n)" button opens the cart panel'), /Cart \(2\)/.test(await page.locator('.s2-order-pill').innerText()) && (await page.locator('.s2-panel-item').count()) === 2 && new URL(page.url()).pathname === '/products');
    await page.getByRole('link', { name: 'Full cart page' }).click(); await page.locator('.s2-item').first().waitFor();
    check(T('the panel has a link to the full cart page'), new URL(page.url()).pathname === '/order' && (await page.locator('h1').innerText()) === 'Your cart');
    check(T('the cart tab title is "Your cart"'), /^Your cart/.test(await page.title()));
    check(T('the cart page has no "Sign in with Google to save your cart" prompt'), !/Sign in with Google to save your cart/.test(await page.locator('main').innerText()));

    // ---------- Saved, Undo, editing banner
    await page.locator('.s2-item').first().getByRole('link', { name: /^Edit/ }).click(); await page.locator('.s2-editing').waitFor();
    const banner = await page.locator('.s2-editing').innerText();
    check(T('the editing banner names the item'), /You’re changing: .*Bedroom|You’re changing: .*Living room/.test(banner), banner);
    check(T('while editing the bar button is "Save changes" and there is no Checkout'), (await label()) === 'Save changes' && (await page.locator('.s2-bar-checkout').count()) === 0);
    await page.locator('#s2-w').fill('31'); await ready(page); await page.locator('.s2-bar-main-btn').click(); await page.locator('.s2-item').first().waitFor();
    check(T('Save changes (from the bar) returns to the cart page, which says "Saved"'), (await page.locator('.s2-saved').innerText()).includes('Saved'));
    await page.locator('.s2-item').nth(1).getByRole('button', { name: 'Remove' }).click();
    check(T('Remove shows "Removed ..." with Undo'), /Removed/.test(await page.locator('.s2-undo').innerText()) && (await page.locator('.s2-item').count()) === 1);
    await page.getByRole('button', { name: 'Undo' }).click(); await sleep(200);
    check(T('Undo puts it back where it was'), (await page.locator('.s2-item').count()) === 2);

    // ---------- Add another like this
    await pick('roller'); await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64'); await page.locator('#s2-room').selectOption('Kitchen'); await page.locator('#s2-window').fill('Left'); await ready(page);
    await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    check(T('the card says "Add another like this" (no "Build another")'), (await page.getByRole('button', { name: 'Add another like this' }).count()) === 1 && (await page.getByRole('button', { name: 'Build another' }).count()) === 0);
    await page.getByRole('button', { name: 'Add another like this' }).click(); await page.locator('#s2-w').waitFor(); await sleep(500);
    check(T('Add another like this keeps the product, color, options and room, and clears the size and window label'), (await page.locator('.s2-sw.on').count()) === 1 && (await page.locator('#s2-room').inputValue()) === 'Kitchen' && (await sizeOf(page, 'w')) === '' && (await sizeOf(page, 'h')) === '' && (await page.locator('#s2-window').inputValue()) === '' && await page.locator('.s2-add-btn').isDisabled());
    check(T('...and scrolls to the Size step'), await page.evaluate(() => { const e = [...document.querySelectorAll('.s2-step')].find((x) => /Size/.test(x.querySelector('.s2-step-title').innerText)); const r = e.getBoundingClientRect(); return r.top >= -5 && r.top < innerHeight * 0.4; }));

    // ---------- Finish choosing: the note's button, and scroll to the first missing step
    await pick('roman'); await page.locator('.s2-sw').first().click(); await sleep(300);
    await page.goto(`${BASE}/measure`); await page.locator('.s2-incnote').waitFor();
    check(T('the note for an unfinished blind has "Finish choosing" on it'), (await page.locator('.s2-incnote').getByRole('button', { name: 'Finish choosing' }).count()) === 1 && !/Open cart/.test(await page.locator('.s2-incnote').innerText()));
    await page.locator('.s2-incnote').getByRole('button', { name: 'Finish choosing' }).click(); await page.locator('.s2-sw.on').waitFor(); await sleep(700);
    check(T('Finish choosing opens the page scrolled to the first missing step (Style, for a Roman shade with only a color)'), await page.evaluate(() => { const e = [...document.querySelectorAll('.s2-step')].find((x) => /^\d+\s*Style$/.test(x.querySelector('.s2-step-title').innerText.trim())); const r = e.getBoundingClientRect(); return r.top >= -5 && r.top < innerHeight * 0.4; }));
    check(T('no script errors'), errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ---------- wording, small fixes (one phone-size visit)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    await page.goto(`${BASE}/products`); await page.locator('.s2-tile').first().waitFor();
    check('Zebra Shades is called "Zebra Shades" on the products list', /Zebra Shades/.test(await page.locator('main').innerText()) && !/Dual/.test(await page.locator('main').innerText()));
    // price by email wording
    await page.goto(`${BASE}/products/roller`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('200'); await page.locator('#s2-h').fill('64');
    await page.getByText(/larger than our standard range/).first().waitFor();
    check('oversize: the card heading is "Larger than our standard range"', (await page.locator('.s2-estimate-title').innerText()) === 'Larger than our standard range' && !/Custom size/.test(await page.locator('.s2-estimate').innerText()));
    await page.locator('#s2-w').fill('20'); await page.locator('#s2-h').fill('64'); await sleep(500);
    check('too small: the hint under the button shows the size message, not "Calculating…"', /smallest we can make is 23 inches wide/.test(await page.locator('.s2-add-hint').innerText()) && !/Calculating/.test(await page.locator('.s2-add-hint').innerText()));
    await page.locator('#s2-w').fill('200'); await sleep(900); await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    check('oversize in the bar and the panel: "Price by email"', /Price by email/.test(await page.locator('.s2-bar').innerText()));
    await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor(); await page.waitForFunction(() => !/Calculating/.test(document.querySelector('.s2-panel').innerText));
    check('the panel says "Price by email" (not "Price sent by email" or "Price on request")', /Price by email/.test(await page.locator('.s2-panel').innerText()) && !/sent by email|on request/i.test(await page.locator('.s2-panel').innerText()));
    await page.keyboard.press('Escape');
    await page.goto(`${BASE}/products/drapery`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click();
    await pickCurtains(page);
    if (migrated) {
      await page.locator('#s2-w').fill('300'); await page.locator('#s2-h').fill('96'); await page.waitForFunction(() => document.querySelector('.s2-estimate-title')?.innerText === 'Price by email');
      check('curtains: a size we do not price (outside 40 to 236 wide, 42 to 236 high) has the card heading "Price by email"', (await page.locator('.s2-estimate-title').innerText()) === 'Price by email');
    } else console.log('SKIP  curtain "Price by email" heading (before migration 20 curtains have no price at all)');
    // Dream Curtains: Classic preselected, no empty picture boxes, no "Selected:" line, both codes only until a style is chosen
    await page.getByRole('tab', { name: 'Dream Curtains' }).click(); await page.locator('.s2-sw').first().waitFor();
    await page.locator('.s2-color-tools input').fill('Angel White'); await sleep(300);
    const codesBefore = await page.locator('.s2-sw-code').first().innerText();
    check('Dream Curtains: before a color is picked the tile shows both codes', /\/ /.test(codesBefore), codesBefore);
    await page.locator('.s2-sw').first().click(); await page.locator('.s2-color-style .s2-card').first().waitFor();
    check('Dream Curtains: Classic is preselected', (await page.locator('.s2-color-style .s2-card.on').innerText()).includes('Classic'));
    check('Dream Curtains: the tile now shows only the chosen style\'s code', !/\//.test(await page.locator('.s2-sw.on .s2-sw-code').innerText()));
    check('Dream Curtains: no picture boxes on the style cards and no "Selected:" line', (await page.locator('.s2-color-style .s2-card-pic').count()) === 0 && (await page.locator('.s2-picked').count()) === 0);
    await page.locator('.s2-color-style .s2-card', { hasText: 'Slim' }).click(); check('...and Slim is one tap away', (await page.locator('.s2-color-style .s2-card.on').innerText()).includes('Slim'));
    // swatch magnifier tap area, jargon lines
    await page.goto(`${BASE}/products/roller`); await page.locator('.s2-swgrid .s2-sw').first().waitFor();
    check('every swatch has at least a 44 px tap area, and 4 to 5 fit on a row at 390 px', await page.locator('.s2-swgrid .s2-sw').first().evaluate((e) => { const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }) && await page.locator('.s2-swgrid').evaluate((g) => { const tops = [...g.querySelectorAll('.s2-sw')].slice(0, 12).map((e) => Math.round(e.getBoundingClientRect().top)); const perRow = tops.filter((t) => t === tops[0]).length; return perRow >= 4 && perRow <= 5; }));
    const body = await page.locator('main').innerText();
    check('plain lines under the jargon options (Motorized, Zero gravity, cassette)', /Raise and lower with a remote or your phone, no pulling\./.test(body) && /Grab the bottom rail and move it to any height\. Let go and it stays right there\./.test(body) && !/Cordless/.test(body) && /The cassette is the cover over the top of the shade\./.test(body));
    await page.goto(`${BASE}/products/drapery`); await page.locator('.s2-sw').first().waitFor();
    await page.getByRole('tab', { name: 'Dream Curtains' }).click(); await page.waitForTimeout(500);
    check('"Manual" has its plain line (Dream Curtains)', /Slide the curtain by hand along the track\./.test(await page.locator('main').innerText()));
    // Day and Night on two lines
    await page.goto(`${BASE}/products/cellular`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-card', { hasText: 'Day & night' }).click(); await page.locator('#c-day-search').waitFor();
    await page.locator('#c-day-search').locator('xpath=ancestor::div[contains(@class,"s2-color")]').locator('.s2-sw').first().click(); await page.locator('#c-night-search').locator('xpath=ancestor::div[contains(@class,"s2-color")]').locator('.s2-sw').first().click();
    await page.locator('#s2-w').fill('28'); await page.locator('#s2-h').fill('40'); await ready(page);
    const lines = await page.locator('.s2-estimate-summary > div').allInnerTexts();
    check('Day & night: "Day: ..." and "Night: ..." on their own lines', lines.some((l) => /^Day: /.test(l)) && lines.some((l) => /^Night: /.test(l)), lines.join(' | '));
    // measuring guide, contact, home
    await page.goto(`${BASE}/measure`); check('measuring guide closing line: "Enter them as you build each blind."', /Enter them as you build each blind\./.test(await page.locator('main').innerText()) && !/Send them along/.test(await page.locator('main').innerText()));
    await page.goto(`${BASE}/`); await page.locator('.s2-hero-card').waitFor();
    await page.locator('.s2-hero-card').getByRole('link', { name: 'Start shopping' }).click(); await sleep(900);
    check('home: "Start shopping" scrolls to the six style tiles and stays on the home page', new URL(page.url()).pathname === '/' && await page.evaluate(() => { const r = document.querySelector('#products').getBoundingClientRect(); return r.top >= -5 && r.top < 200; }));
    await page.route('**/api/contact', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emailed: true }) }));
    await page.goto(`${BASE}/contact`); await page.locator('#c-name').fill('Alex'); await page.locator('#c-email').fill('a@b.co'); await page.locator('textarea').first().fill('Hello'); await page.getByRole('button', { name: /send message/i }).click(); await page.locator('.success-banner').waitFor(); await sleep(500);
    check('contact: after sending, the confirmation is on screen', await page.evaluate(() => { const r = document.querySelector('.success-banner').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    // footer links alike
    const fl = await page.evaluate(() => [...document.querySelectorAll('.s2-footer-contact a:not(.s2-footer-msg)')].map((a) => { const c = getComputedStyle(a); return `${c.color}|${c.textDecorationLine}|${c.fontSize}`; }));
    check('footer: the email and phone links look the same', fl.length >= 2 && new Set(fl).size === 1, fl.join(' ; '));
    await ctx.close();
  }

  // ---------- My orders: only sent orders, the cart link, Order again on the card
  {
    const email = `zz-r3-${Date.now()}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
    const cu = await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true, user_metadata: { full_name: 'Round Three' } }); userId = cu.body.id;
    const token = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password })).body;
    const cat = (await api('POST', '/rest/v1/rpc/public_catalog', H(ANON), { p_scope: ['zebra'] })).body.flatMap((g) => g.swatches)[0];
    const item = { id: 'abc123abc123', productId: 'zebra', variant: 'Zebra', mech: 'chain', mount: 'inside', colorCode: cat.supplier_code, colorName: cat.display_name, selection: { lineId: 'zebra', picks: [{ role: null, swatchId: cat.id, line: 'zebra', family: null, fabricId: cat.fabric_id, code: cat.supplier_code, displayName: cat.display_name, style: null, thumb: null }] }, width: 30, length: 50, qty: 2, roomLabel: 'Bedroom', windowLabel: 'Left', addons: {}, price: 100, priceKind: 'estimate' };
    await api('POST', '/rest/v1/orders', H(ANON, token.access_token), { user_id: userId, name: 'Order 1', items: [item], status: 'sent', customer: { name: 'Round Three', email } });
    await api('POST', '/rest/v1/orders', H(ANON, token.access_token), { user_id: userId, name: 'Order 2', items: [], status: 'draft' });
    for (const width of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 } });
      await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('zz-seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('zz-seeded', '1'); } } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(token)]);
      const page = await ctx.newPage(); page.setDefaultTimeout(30000);
      await page.goto(`${BASE}/orders`); await page.locator('.order-card').first().waitFor();
      const txt = await page.locator('main').innerText();
      check(`[${width}px] My orders lists only the sent order (not the empty draft), with its products and rooms`, (await page.locator('.order-card').count()) === 1 && /Sent/.test(txt) && /Products:\s*Zebra Shades/.test(txt) && /Rooms:\s*Bedroom/.test(txt) && !/In progress|Active/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 300));
      check(`[${width}px] My orders: "Your cart" link at the top, no "+ New order", and Sign out is a small text link`, (await page.getByRole('link', { name: /^Your cart/ }).count()) === 1 && !/New order/.test(txt) && (await page.locator('.orders-signout').evaluate((e) => !e.classList.contains('s2-btn'))));
      await page.locator('.order-card .order-again').click(); await page.locator('.s2-item').first().waitFor();
      check(`[${width}px] "Order again" on the card adds the blinds to the cart and opens the cart page`, new URL(page.url()).pathname === '/order' && (await page.locator('.s2-item').count()) === 1 && /2 blinds|blind/.test(await page.locator('.s2-item').first().innerText()));
      await ctx.close();
    }
  }
} finally {
  if (userId) { await api('DELETE', `/rest/v1/orders?user_id=eq.${userId}`, H(SVC)).catch(() => {}); await api('DELETE', `/auth/v1/admin/users/${userId}`, H(SVC)).catch(() => {}); }
  if (browser) await browser.close();
}
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
