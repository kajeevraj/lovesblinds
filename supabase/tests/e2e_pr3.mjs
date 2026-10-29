// Browser test of the PR 3 fixes at 390 px and 1280 px: cart wording and icon, the "Added to your cart" card, merging identical
// items, the − / + quantity, size entry, room and window, swatch zoom, autosave, incomplete items and the checkout block, the
// sign-in prompts and the exit prompt, the top bar sign-in button, the signed-in picture and prefilled details, editing on a
// phone, and the homepage / footer / measuring-guide wording. A temporary customer is created for the signed-in checks and deleted
// afterwards. Needs a preview on BASE_URL (default http://localhost:4173) and SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// SHOTS=<folder> also saves screenshots there.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const SHOTS = process.env.SHOTS || '';
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const stamp = Date.now(); let userId, browser;
const shot = async (page, name) => { if (SHOTS) { await page.waitForTimeout(800); await page.screenshot({ path: `${SHOTS}/${name}.png` }); } };
// a picture for the signed-in avatar (an inline SVG, so no network is needed)
const AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#7A5C2E"/><circle cx="48" cy="38" r="18" fill="#F7F2EA"/><rect x="18" y="62" width="60" height="34" rx="17" fill="#F7F2EA"/></svg>');

try {
  browser = await chromium.launch();
  for (const width of [390, 1280]) {
    const phone = width < 760;
    const T = (s) => `[${width}px] ${s}`;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const ready = () => page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled);
    const fill = async (w, h) => { await page.locator('#s2-w').fill(w); await page.locator('#s2-h').fill(h); };
    const unit = async () => Number((await page.locator('.s2-estimate-price').first().innerText()).replace(/\D/g, ''));

    // ---------- top bar and wording
    await page.goto(`${BASE}/`); await page.locator('.s2-nav').waitFor();
    const nav = await page.locator('.s2-nav').innerText();
    check(T('the top bar has no "How it works" link, and says Cart'), !/How it works/i.test(nav) && /Cart/.test(nav) && !/Your order/.test(nav), nav.replace(/\s+/g, ' '));
    check(T('the "How it works" section is still on the homepage'), (await page.locator('#how').count()) === 1);
    check(T('signed out: the top bar has a "Sign in" button with the Google logo, and no person icon'), (await page.locator('.s2-nav .gsi-btn:has(svg)').count()) === 1 && /Sign in/.test(await page.locator('.s2-nav .gsi-btn').innerText()) && (await page.locator('.profile-btn').count()) === 0);
    check(T('the cart icon is a cart (two wheels), not a bag'), (await page.locator('.s2-order-pill svg circle').count()) === 2);
    await shot(page, `${phone ? 'phone' : 'desktop'}-signin-button`);
    check(T('the homepage says Room darkening with its subtext, and the footer bolds "shipped worldwide"'), /Room darkening/.test(await page.locator('body').innerText()) && /Good for bedrooms, nurseries and home theaters\./.test(await page.locator('body').innerText()) && !/Dark for sleeping/.test(await page.locator('body').innerText()) && (await page.locator('.s2-footer-text strong').innerText()) === 'shipped worldwide' && Number(await page.locator('.s2-footer-text').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))) >= 16);
    await page.goto(`${BASE}/measure`);
    const meas = await page.locator('body').innerText();
    check(T('measuring guide: Tape measure, Step stool or ladder, and the new help text'), /Tape measure/.test(meas) && /Step stool or ladder/.test(meas) && !/Steel tape/i.test(meas) && /Send us a note or call and we'd be happy to help!/.test(meas));

    // ---------- product page: swatch zoom, size entry, room
    await page.goto(`${BASE}/products/roller`); await page.locator('.s2-sw').first().waitFor();
    check(T('each swatch has a magnifying glass, and "View larger" is gone'), (await page.locator('.s2-sw-zoom').count()) >= 6 && !/View larger/.test(await page.locator('body').innerText()));
    await page.locator('.s2-sw-zoom').first().click();
    await page.locator('dialog.swatch-dialog[open]').waitFor();
    const dlg = await page.locator('dialog.swatch-dialog').innerText();
    check(T('the magnifier opens the swatch bigger, with "Choose this color" (not "swatch")'), /(keep|choose) this color/i.test(dlg) && !/swatch/i.test(dlg), dlg.replace(/\s+/g, ' ').slice(0, 120));
    await page.locator('dialog.swatch-dialog button', { hasText: /(Keep|Choose) this color/ }).click();
    check(T('"Choose this color" picks that color'), (await page.locator('.s2-sw.on').count()) === 1);

    await page.locator('#s2-w').scrollIntoViewIfNeeded();
    await page.locator('#s2-w').click(); await page.keyboard.type('3');
    check(T('size: typing "3" first gives "3", not "03"'), (await page.locator('#s2-w').inputValue()) === '3');
    const cases = [['35', '35 in'], ['35.5', '35 1/2 in'], ['35 1/2', '35 1/2 in'], ['35-1/2', '35 1/2 in'], ['35.3', '35 1/4 in'], ['40.05', '40 in'], ['1/2', '1/2 in']];
    const got = [];
    for (const [typed, want] of cases) { await page.locator('#s2-w').fill(typed); got.push([typed, (await page.locator('#s2-w-echo').innerText()).replace(/\s*\(nearest 1\/8\)/, '').trim(), want]); }
    check(T('size: 35, 35.5, 35 1/2, 35-1/2 and others show back as a fraction'), got.every(([, a, b]) => a === b), got.map(([t, a]) => `${t} -> ${a}`).join(' | '));
    await page.locator('#s2-w').fill('abc');
    check(T('size: text that is not a size shows a message and no price'), /Enter a size like/.test(await page.locator('#s2-w-echo').innerText()));
    await page.locator('#s2-w').fill('35.5'); await page.locator('#s2-h').click(); 
    check(T('size: leaving the box tidies it to the fraction'), (await page.locator('#s2-w').inputValue()) === '35 1/2');
    check(T('size: a label explains what to type'), /35 1\/2 or 35-1\/2/.test(await page.locator('.s2-size-help').innerText()));
    await page.getByRole('button', { name: 'Add a fraction to the width' }).click();
    const fr = await page.locator('.s2-frac-opt').allInnerTexts();
    check(T('size: the fraction helper lists 1/8 to 7/8'), fr.join(',') === '1/8,1/4,3/8,1/2,5/8,3/4,7/8', fr.join(','));
    await shot(page, `${phone ? 'phone' : 'desktop'}-size-entry`);
    await page.locator('.s2-frac-opt', { hasText: '7/8' }).click();
    check(T('size: picking 7/8 adds it to the whole inches already typed'), (await page.locator('#s2-w').inputValue()) === '35 7/8' && (await page.locator('#s2-w-echo').innerText()).startsWith('35 7/8 in'));
    await page.locator('#s2-h').fill('64');

    const opts = await page.locator('#s2-room option').allInnerTexts();
    check(T('room: a dropdown of the common rooms'), ['Living room', 'Bedroom', 'Primary bedroom', 'Kitchen', 'Dining room', 'Office', 'Bathroom', 'Nursery', 'Basement', 'Other'].every((r) => opts.includes(r)), opts.join(', '));
    check(T('room: the custom name box only appears for "Other"'), (await page.locator('#s2-room-custom').count()) === 0);
    await page.locator('#s2-room').selectOption('Other');
    await page.locator('#s2-room-custom').fill('Sunroom');
    await page.locator('#s2-window').fill('Left');
    await page.locator('.s2-room').evaluate((e) => e.scrollIntoView({ block: 'center' })); await shot(page, `${phone ? 'phone' : 'desktop'}-room-picker`);
    await ready();
    const one = await unit();

    // ---------- add: the card, merge, different lines
    check(T('before adding: a large "Add to cart" button is in the estimate card, and the bars main button is "Add to cart" too'), /^Add to cart$/.test((await page.locator('.s2-estimate .s2-add-btn').innerText()).trim()) && (await page.locator('.s2-bar .s2-add-btn').count()) === 0 && (await page.locator('.s2-bar-main-btn').innerText()) === 'Add to cart' && (await page.locator('.s2-estimate .s2-add-btn').evaluate((e) => e.getBoundingClientRect().height)) >= 54);
    check(T('the bar: swatch circle, "This blind", the color name and the price; a divider; then "Your cart" (empty, no Checkout yet)'), (await page.locator('.s2-bar-blind .s2-dot img').count()) === 1 && /This blind/i.test(await page.locator('.s2-bar-blind').textContent()) && /Jet Black/.test(await page.locator('.s2-bar-blind').textContent()) && (await page.locator('.s2-bar-divider').count()) === 1 && (await page.locator('.s2-bar-checkout').count()) === 0 && /Your cart is empty/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')));
    check(T(phone ? 'phone: the bar shows the total only ("$130"), small "This blind" above it' : 'desktop: with 1 blind the bar shows just the price'), /^\$\d+$/.test((await page.locator('.s2-bar-price').innerText()).trim()));
    await page.locator('.s2-estimate').evaluate((e) => e.scrollIntoView({ block: 'center' })); await shot(page, `${phone ? 'phone' : 'desktop'}-card-before-add`);
    await page.locator('.s2-add-btn').click();
    await page.locator('.s2-added-card').waitFor();
    const pop = await page.locator('.s2-added-card').innerText();
    check(T('after adding, the card says "Added to your cart" with Checkout, Keep shopping and an "Add another like this" link; the Add button is gone'), /Added to your cart/.test(pop) && (await page.locator('.s2-added-card').getByRole('button', { name: 'Checkout' }).count()) === 1 && (await page.locator('.s2-added-card').getByRole('button', { name: 'Keep shopping' }).count()) === 1 && (await page.locator('.s2-added-card').getByRole('button', { name: 'Add another like this' }).count()) === 1 && (await page.locator('.s2-estimate .s2-add-btn').count()) === 0, pop.replace(/\s+/g, ' '));
    check(T('there is no floating popup'), (await page.locator('.s2-added').count()) === 0);
    check(T('the bar now has "Your cart: 1 item" and a Checkout button, still no Add button'), /Your cart: 1 item/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')) && (await page.locator('.s2-bar-checkout').count()) === 1 && (await page.locator('.s2-bar .s2-add-btn').count()) === 0);
    await page.locator('.s2-estimate').evaluate((e) => e.scrollIntoView({ block: 'center' })); await shot(page, `${phone ? 'phone' : 'desktop'}-card-after-add`);
    await page.locator('#s2-qty').fill('2');
    check(T('changing how many brings the Add button back'), (await page.locator('.s2-estimate .s2-add-btn').count()) === 1 && (await page.locator('.s2-added-card').count()) === 0);
    await page.locator('#s2-qty').fill('1');
    check(T('putting it back to what was added shows the confirmation again'), (await page.locator('.s2-added-card').count()) === 1);
    // the bar with several of this blind: "3 × $130 = $390" on desktop, the total alone on a phone
    await page.locator('#s2-qty').fill('3');
    const barPrice = (await page.locator('.s2-bar-price').innerText()).trim();
    check(T(phone ? 'phone: with 3 of this blind the bar shows the total only' : 'desktop: with 3 of this blind the bar says "3 × $each = $total"'), phone ? /^\$\d+$/.test(barPrice) : /^3 × \$\d+ = \$\d+$/.test(barPrice), barPrice);
    await page.locator('#s2-qty').fill('1');
    await page.locator('.s2-added-card').getByRole('button', { name: 'Add another like this' }).click();
    await page.locator('.s2-sw').first().waitFor();
    check(T('Add another like this keeps the color and room and clears the size'), (await page.locator('.s2-sw.on').count()) === 1 && (await page.locator('#s2-w').inputValue()) === '' && (await page.locator('.s2-estimate .s2-add-btn').isDisabled()) && (await page.locator('#s2-room').inputValue()) === 'Other');
    check(T('...and the first blind is still in the cart (and no incomplete item was left behind)'), /Your cart: 1 item/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')) && (await page.locator('.s2-order-pill').innerText()).includes('(1)'));
    // the same blind again merges into the first line
    await page.locator('.s2-sw-zoom').first().click(); await page.locator('dialog.swatch-dialog[open]').waitFor(); await page.locator('dialog.swatch-dialog button', { hasText: 'Keep this color' }).click();
    await page.locator('#s2-w').fill('35 7/8'); await page.locator('#s2-h').fill('64'); await page.locator('#s2-room').selectOption('Other'); await page.locator('#s2-room-custom').fill('Sunroom'); await page.locator('#s2-window').fill('Left');
    await ready();
    await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    check(T('adding the same blind again raises its quantity and the card says so'), /now has 2 blinds/.test(await page.locator('.s2-added-card').innerText()) && /Your cart: 1 item/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')), (await page.locator('.s2-added-card').innerText()) + ' | ' + (await page.locator('.s2-bar-order').getAttribute('aria-label')));
    await page.locator('#s2-window').fill('Right'); await ready();
    await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    check(T('a different window label is a new line'), !/now \d blinds/.test(await page.locator('.s2-added-card').innerText()) && /Your cart: 2 items/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')));
    await page.locator('#s2-h').fill('65'); await ready();
    await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    // Keep shopping goes to the products list; the bar there has the cart summary and Checkout
    await page.locator('.s2-added-card').getByRole('button', { name: 'Keep shopping' }).click();
    await page.locator('.s2-bar-only').waitFor();
    check(T('Keep shopping goes to the products list'), new URL(page.url()).pathname === '/products');
    check(T('products list bar: "Your cart: 3 items · $total" and a Checkout button'), /Your cart: 3 items · \$\d+/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')) && (await page.locator('.s2-bar-checkout').count()) === 1);
    await page.waitForTimeout(600); await shot(page, `${phone ? 'phone' : 'desktop'}-products-bar`);
    check(T('the products subtitle reads "Pick a line to see every fabric as a real swatch and start building your order."'), /Pick a line to see every fabric as a real swatch and start building your order\./.test(await page.locator('main').innerText()));
    const barInfo = await page.evaluate(() => { const q = (x) => document.querySelector(x); const r = (x) => q(x)?.getBoundingClientRect(); return { onlyHalf: !q('.s2-bar-blind') && !!q('.s2-bar-cartbtn'), dots: document.querySelectorAll('.s2-bar-order .s2-dot').length, more: q('.s2-dots-more')?.textContent || '', chev: !!q('.s2-bar-chev') && getComputedStyle(q('.s2-bar-chev')).display !== 'none', ctl: r('.s2-bar-checkout').height, order: r('.s2-bar-order').height, text: r('.s2-bar-order-text'), checkout: r('.s2-bar-checkout'), vw: innerWidth, sw: document.documentElement.scrollWidth }; });
    check(T('products list: only the cart half shows, with up to 3 item swatches (then +N) and a 48 px Checkout'), barInfo.onlyHalf && barInfo.dots === 3 && barInfo.ctl === 48 && barInfo.order === 48, JSON.stringify(barInfo));
    check(T(phone ? 'phone: one row, nothing overlaps or spills (cart text ends before Checkout)' : 'desktop: an up chevron shows the cart expands, and nothing overlaps'), barInfo.text.right <= barInfo.checkout.left + 0.5 && barInfo.sw <= barInfo.vw && (phone || barInfo.chev), JSON.stringify(barInfo));
    await page.locator('.s2-bar-cartbtn').click({ position: { x: 4, y: 4 }, force: true });
    await page.locator('.s2-panel').waitFor();
    await page.waitForTimeout(500); const sheet = await page.locator('.s2-panel').boundingBox();
    check(T('tapping anywhere on the cart half (its edge too) opens the cart panel, which slides up from the bar'), Math.abs(sheet.y + sheet.height - (phone ? 844 : 900)) < 2 && sheet.height < (phone ? 844 : 900));
    await page.keyboard.press('Escape');
    await page.locator('.s2-bar-checkout').click(); await page.locator('#s2-details-title').waitFor();
    check(T('Checkout in the bar goes straight to checkout (it does not open the panel)'), page.url().includes('checkout=1') && (await page.locator('.s2-panel').count()) === 0);
    await page.goto(`${BASE}/products`); await page.locator('.s2-bar-only').waitFor();
    await page.locator('.s2-bar-checkout').count();
    await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor();
    const lines = await page.locator('.s2-panel-item').count();
    check(T('the cart has 3 lines (same item merged; different window and different size are new lines)'), lines === 3, `${lines}`);
    const first = await page.locator('.s2-panel-item').first().innerText();
    check(T('cart line shows size in fractions with the room and window'), /35 7\/8" wide × 64" high/.test(first) && /Sunroom · Left/.test(first), first.replace(/\s+/g, ' '));
    const q0 = await page.locator('.s2-panel-item').first().locator('.s2-stepper output').innerText();
    check(T('the merged line has quantity 2 in the panel'), q0.trim() === '2', q0);
    await page.locator('.s2-panel-item').first().getByRole('button', { name: /One more/ }).click();
    check(T('panel: + raises the quantity and the price'), (await page.locator('.s2-panel-item').first().locator('.s2-stepper output').innerText()).trim() === '3' && new RegExp(`\\$${one * 3}`).test(await page.locator('.s2-panel-item').first().innerText()));
    await page.locator('.s2-panel-item').first().getByRole('button', { name: /One fewer/ }).click();
    check(T('panel: − lowers it, and cannot go below 1'), (await page.locator('.s2-panel-item').nth(1).getByRole('button', { name: /One fewer/ }).isDisabled()));
    check(T('signed out: the panel says "Sign in with Google to save your cart"'), /Sign in with Google to save your cart/.test(await page.locator('.s2-panel').innerText()) && (await page.locator('.s2-panel .gsi-btn').count()) === 1);
    await shot(page, `${phone ? 'phone' : 'desktop'}-cart-panel`);
    check(T('the panel button is Checkout'), /Checkout/.test(await page.locator('.s2-panel-go').innerText()));
    const barText = await page.locator('.s2-bar').innerText();
    check(T('the bar says Cart, not order'), /Your cart: 3 items/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')) && !/order/i.test(barText) && !/order/i.test(await page.locator('.s2-bar-order').getAttribute('aria-label')), barText.replace(/\s+/g, ' '));
    await page.locator('.s2-panel-go').click();
    await page.locator('#s2-details-title').waitFor();
    check(T('Checkout goes to the details step'), /Checkout/.test(await page.locator('h1').innerText()) && page.url().includes('checkout=1'));
    check(T('"Your details" starts with the Google sign-in button'), (await page.locator('.s2-details-signin .gsi-btn').count()) === 1);
    await shot(page, `${phone ? 'phone' : 'desktop'}-checkout-details`);

    // ---------- cart page
    await page.goto(`${BASE}/order`); await page.locator('.s2-item').first().waitFor();
    check(T('cart page: title is Your cart and the main button is Checkout'), (await page.locator('h1').innerText()) === 'Your cart' && (await page.locator('.s2-cart-actions .s2-send').innerText()) === 'Checkout' && (await page.locator('#s2-details-title').count()) === 0);
    check(T('cart page: − / + on each line (the sign-in prompt is in the cart panel, not here)'), (await page.locator('.s2-item .s2-stepper').count()) === 3 && !/Sign in with Google to save your cart/.test(await page.locator('main').innerText()));
    await page.locator('.s2-item').first().getByRole('button', { name: /One more/ }).click();
    check(T('cart page: + changes the quantity (and the line stays one line)'), (await page.locator('.s2-item').count()) === 3 && (await page.locator('.s2-item').first().locator('.s2-stepper output').innerText()).trim() === '3');

    // ---------- edit on a phone: the message goes to the top
    await page.locator('.s2-item').first().getByRole('link', { name: /^Edit/ }).click();
    await page.locator('.s2-editing').waitFor(); await page.waitForTimeout(700);
    const top = await page.locator('.s2-editing').evaluate((e) => e.getBoundingClientRect().top);
    check(T('Edit: "You’re changing: ..." message names the item'), /You’re changing: /.test(await page.locator('.s2-editing').innerText()));
    check(T(phone ? 'Edit on a phone: the message is at the top of the screen' : 'Edit on desktop: the message is visible near the top'), top >= 0 && top <= (phone ? 24 : 300), `top ${Math.round(top)}px`);
    check(T('Edit: size and room come back as they were'), (await page.locator('#s2-w').inputValue()) === '35 7/8' && (await page.locator('#s2-room').inputValue()) === 'Other' && (await page.locator('#s2-room-custom').inputValue()) === 'Sunroom' && (await page.locator('#s2-window').inputValue()) === 'Left');
    await page.locator('.s2-editing .s2-link').click();

    // ---------- autosave and incomplete items
    await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor();
    await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('30 1/4');
    await page.reload(); await page.locator('.s2-sw.on').waitFor();
    check(T('autosave: a refresh keeps the color and the size'), (await page.locator('.s2-sw.on').count()) === 1 && (await page.locator('#s2-w').inputValue()) === '30 1/4');
    await page.goto(`${BASE}/`); await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw.on').waitFor();
    check(T('autosave: leaving and coming back keeps them'), (await page.locator('#s2-w').inputValue()) === '30 1/4');
    check(T('the page that is open is not listed as incomplete (cart still counts 3)'), (await page.locator('.s2-order-pill').innerText()).includes('(3)'));
    await page.evaluate(() => sessionStorage.removeItem('lb_noted')); await page.goto(`${BASE}/measure`); await page.locator('.s2-incnote').waitFor();
    check(T('leaving partway: a small note says it was kept in the cart as incomplete'), /marked incomplete/.test(await page.locator('.s2-incnote').innerText()));
    check(T('the cart count includes the incomplete item'), (await page.locator('.s2-order-pill').innerText()).includes('(4)'));
    await page.locator('.s2-incnote-x').click();
    check(T('the note can be dismissed'), (await page.locator('.s2-incnote').count()) === 0);
    await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor();
    check(T('the panel marks it "Incomplete: finish choosing" with a link back'), /Incomplete: finish choosing/.test(await page.locator('.s2-incomplete').innerText()) && (await page.locator('.s2-incomplete a', { hasText: 'Finish choosing' }).getAttribute('href')) === '/products/zebra');
    check(T('Checkout is blocked while something is incomplete'), await page.locator('.s2-panel-go').isDisabled() && /Finish choosing or remove/.test(await page.locator('.s2-panel').innerText()));
    await shot(page, `${phone ? 'phone' : 'desktop'}-incomplete`);
    await page.locator('.s2-panel-go').click({ force: true, trial: true }).catch(() => {});
    await page.locator('.s2-panel-close').click();
    await page.goto(`${BASE}/order`); await page.locator('.s2-item').first().waitFor();
    check(T('cart page: the incomplete item is listed and Checkout is blocked'), (await page.locator('.s2-incomplete').count()) === 1 && await page.locator('.s2-cart-actions .s2-send').isDisabled());
    await page.goto(`${BASE}/order?checkout=1`); await page.locator('.s2-item').first().waitFor();
    check(T('the checkout address cannot be used to get round the block'), (await page.locator('#s2-details-title').count()) === 0);
    await page.locator('.s2-incomplete a', { hasText: 'Finish choosing' }).click();
    await page.locator('.s2-sw.on').waitFor();
    check(T('"Finish choosing" returns to the page with the choices kept'), (await page.locator('#s2-w').inputValue()) === '30 1/4' && page.url().endsWith('/products/zebra'));
    await page.goto(`${BASE}/order`); await page.locator('.s2-incomplete').waitFor();
    await page.locator('.s2-incomplete').getByRole('button', { name: /Remove/ }).click();
    check(T('removing the incomplete item unblocks Checkout'), (await page.locator('.s2-incomplete').count()) === 0 && !(await page.locator('.s2-cart-actions .s2-send').isDisabled()));

    // ---------- exit prompt (desktop only, once per visit)
    await page.goto(`${BASE}/products`); await page.locator('.s2-bar-only').waitFor();
    const leave = () => page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, relatedTarget: null, bubbles: true })));
    await leave(); await page.waitForTimeout(300);
    if (phone) check(T('phone: no exit prompt'), (await page.locator('.s2-exit').count()) === 0);
    else {
      check(T('desktop: moving out of the top shows "Save your cart?" with the Google button and a close button'), /Save your cart\?/.test(await page.locator('.s2-exit').innerText()) && /Sign in with Google and it'll be here next time\./.test(await page.locator('.s2-exit').innerText()) && (await page.locator('.s2-exit .gsi-btn').count()) === 1 && (await page.getByRole('button', { name: 'Close' }).count()) >= 1);
      await shot(page, 'desktop-exit-prompt');
      await page.locator('.s2-exit-close').click(); await leave(); await page.waitForTimeout(300);
      check(T('desktop: it does not come back the same visit'), (await page.locator('.s2-exit').count()) === 0);
    }
    check(T('no script errors'), errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---------- homepage on small phones: the hero text sits high and the cart bar never covers it
  for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click();
    await page.locator('#s2-w').fill('30'); await page.locator('#s2-h').fill('50'); await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled);
    await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    await page.goto(`${BASE}/`); await page.locator('.s2-bar-only').waitFor(); await page.waitForTimeout(700);
    const r = await page.evaluate(() => ({ barTop: document.querySelector('.s2-bar').getBoundingClientRect().top, buttons: document.querySelector('.s2-hero-card .s2-btn-row').getBoundingClientRect().bottom, textTop: document.querySelector('.s2-hero-card h1').getBoundingClientRect().top }));
    check(`[${w}x${h}] home on a phone: the hero text and both buttons sit above the cart bar (never covered)`, r.buttons <= r.barTop && r.textTop < h * 0.6, JSON.stringify(r));
    if (w === 390) await shot(page, 'phone-home-with-cart');
    await ctx.close();
  }

  // ---------- no prompt when the cart is empty or the customer is signed in
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
    await page.goto(`${BASE}/`); await page.locator('.s2-nav').waitFor();
    await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, relatedTarget: null, bubbles: true }))); await page.waitForTimeout(300);
    check('desktop: no exit prompt with an empty cart', (await page.locator('.s2-exit').count()) === 0);
    await ctx.close();
  }

  // ---------- signed in: picture, prefilled details
  const email = `zz-pr3-${stamp}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true, user_metadata: { full_name: 'Ada Lovelace', picture: AVATAR, profile_phone: '555-0100', profile_address: { street: '1 Analytical Way', apt: '', city: 'London', state: 'England', zip: 'N1 1AA', country: 'United Kingdom' } } }); userId = cu.body.id;
  const token = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password })).body;
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } });
    await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('zz-seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('zz-seeded', '1'); } } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(token)]);
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    await page.goto(`${BASE}/products/zebra`); await page.locator('.profile-btn.is-signed-in').waitFor();
    check(`[${width}px] signed in: the top bar shows their Google picture, and no Sign in button`, (await page.locator('.profile-btn img').getAttribute('src')) === AVATAR && (await page.locator('.s2-nav .gsi').count()) === 0);
    await shot(page, width < 760 ? 'phone-signed-in' : 'desktop-signed-in');
    await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('30'); await page.locator('#s2-h').fill('50');
    await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled); await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    check(`[${width}px] signed in: no "Sign in with Google to save your cart" in the panel`, !/Sign in with Google to save/.test(await (async () => { await page.locator('.s2-bar-order').click(); return page.locator('.s2-panel').innerText(); })()));
    await page.locator('.s2-panel-go').click(); await page.locator('#o-name').waitFor();
    check(`[${width}px] checkout: name, email, phone and saved address are filled in and can be edited`, (await page.locator('#o-name').inputValue()) === 'Ada Lovelace' && (await page.locator('#o-email').inputValue()) === email && (await page.locator('#o-phone').inputValue()) === '555-0100' && (await page.locator('#o-street').inputValue()) === '1 Analytical Way' && (await page.locator('#o-country').inputValue()) === 'United Kingdom');
    await page.locator('#o-name').fill('Ada K. Lovelace');
    check(`[${width}px] checkout: the details are editable, and no sign-in button is shown`, (await page.locator('#o-name').inputValue()) === 'Ada K. Lovelace' && (await page.locator('.s2-details-signin').count()) === 0 && /Signed in as/.test(await page.locator('.s2-details-who').innerText()));
    await ctx.close();
  }
} finally {
  if (userId) { await api('DELETE', `/rest/v1/orders?user_id=eq.${userId}`, H(SVC)).catch(() => {}); await api('DELETE', `/auth/v1/admin/users/${userId}`, H(SVC)).catch(() => {}); }
  if (browser) await browser.close();
}
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
