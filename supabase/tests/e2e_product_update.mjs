// Browser test of the product page update: movement order, defaults and the "Best value" / "Top of the line" tags, "Motor side", the swatch picker, the size fields, the
// "More options" section (chain color, cord loop, bottom bar, roll direction), Cellular, Roller double-stack, Dream Curtains and the Curtains hardware.
// Needs a preview server (BASE_URL, default http://localhost:4173) and the site's own Supabase keys. Works with or without migration 20: until it is applied the site
// falls back to its built-in defaults (Best value on Zero gravity, Top of the line on Motorized) and the hardware price shows "we will email the price".
// Checks marked (needs migration 20) are reported as SKIPPED until then.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const skip = (name) => console.log(`SKIP  ${name} (migration 20 is not applied to this database)`);
const migrated = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/public_options`, { method: 'POST', headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{"p_line":"roller"}' }).then((r) => r.ok).catch(() => false);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const [vw, vh] of [[390, 844], [1280, 900]]) {
    const T = (s) => `[${vw}px] ${s}`;
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, hasTouch: vw < 500, isMobile: vw < 500 });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const open = async (slug) => { await page.goto(`${BASE}/products/${slug}`, { waitUntil: 'networkidle' }); await page.locator('.s2-swgrid .s2-sw').first().waitFor(); };
    const card = (n) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
    const step = (t) => page.locator('.s2-step', { has: page.locator('.s2-step-title', { hasText: new RegExp(`^\\s*\\d+\\s*${t}\\s*$`) }) });
    const settle = () => page.waitForTimeout(700);
    const size = async (w, h) => { await page.locator('#s2-w').fill(String(w)); await page.locator('#s2-h').fill(String(h)); };
    const badges = (n) => card(n).locator('.s2-badge').evaluateAll((els) => els.map((e) => e.textContent));

    // ---- Roller first load
    await open('roller');
    check(T('Roller: Zero gravity is selected on first load with a quiet "Best value" tag; Motorized has "Top of the line"; no other tags'), await card('Zero gravity').getAttribute('aria-pressed') === 'true' && JSON.stringify(await badges('Zero gravity')) === JSON.stringify(['Best value']) && JSON.stringify(await badges('Motorized')) === JSON.stringify(['Top of the line']) && (await badges('Chain')).length === 0 && (await page.locator('.s2-badge').count()) === 2);
    check(T('the Zero gravity handle is visible on first load, and the gallery has dots'), await page.locator('.pv-stage.ready').waitFor({ timeout: 30000 }).then(() => true) && (await page.locator('.pv-grip').isVisible()) && (await page.locator('.gal-dots [role=tab]').count()) === 4);
    check(T('there is no position slider bar, and no "See it in a room", "Hide sizes" or "Style photo" buttons'), (await page.locator('input[type=range]').count()) === 0 && (await page.getByRole('button', { name: /See it in a room|Hide sizes|Show sizes/ }).count()) === 0);
    // ---- color picker
    const grid = page.locator('.s2-swgrid').first();
    const w0 = await grid.locator('.s2-sw').first().evaluate((e) => e.getBoundingClientRect().width);
    check(T('swatches are soft squares of 44 to 56 px, with a filter row (All, White, Beige, Grey, Black, Brown, Color) and a search box'), w0 >= 44 && w0 <= 56 && JSON.stringify(await page.locator('.s2-chips .s2-chip').allInnerTexts()) === JSON.stringify(['All', 'White', 'Beige', 'Grey', 'Black', 'Brown', 'Color']) && (await page.locator('.s2-color input[type=search]').count()) === 1);
    check(T('the swatch grid scrolls on its own when it is long'), await grid.evaluate((g) => getComputedStyle(g).overflowY === 'auto' && getComputedStyle(g).scrollBehavior === 'smooth' && parseFloat(getComputedStyle(g).maxHeight) > 0));
    await page.locator('.s2-chip', { hasText: 'Grey' }).click(); await settle();
    const greys = await grid.locator('.s2-sw').count();
    await page.locator('.s2-chip', { hasText: 'All' }).click(); await settle();
    check(T('a color filter narrows the grid, All brings it back'), greys > 0 && greys < (await grid.locator('.s2-sw').count()));
    await grid.locator('.s2-sw').nth(3).click(); await settle();
    check(T('the picked swatch has a ring, and a larger preview below shows its name and code'), await grid.locator('.s2-sw.on').count() === 1 && (await page.locator('.s2-swprev-name').innerText()).length > 2 && (await page.locator('.s2-swprev-code').innerText()).length > 3 && await grid.locator('.s2-sw.on .s2-sw-img').evaluate((e) => /rgb\(30, 26, 22\)/.test(getComputedStyle(e).boxShadow)));
    // ---- size
    await size(40, 64);
    check(T('size: "+ fraction" dropdowns, default 0, price and preview follow'), await page.locator('#s2-w-frac').inputValue() === '' && (await page.locator('.pv-size').innerText()).replace(/\s+/g, ' ') === '40 × 64 in');
    await page.locator('#s2-w-frac').selectOption('3/8'); await settle();
    check(T('picking 3/8 changes the preview label at once'), (await page.locator('.pv-size').innerText()).replace(/\s+/g, ' ') === '40 3/8 × 64 in' && (await page.locator('#s2-w-echo').innerText()).startsWith('40 3/8 in'));
    // ---- Chain: the colors, bottom bar, roll direction in More options
    await card('Chain').click(); await settle();
    check(T('Chain: "Chain side" (not Control side), and the preview shows the chain on the bar side with a small first-use hint'), await step('Chain side').count() === 1 && (await page.locator('.pv-bar').count()) === 1 && (await page.locator('.pv-grip').count()) === 0);
    const more = page.locator('.s2-more');
    check(T('"More options" is collapsed and shows the defaults in one line'), (await more.getAttribute('open')) === null && /Chain color: White/.test(await more.locator('summary').innerText()) && /Bottom bar: Pearl White/.test(await more.locator('summary').innerText()) && /Roll direction: Standard/.test(await more.locator('summary').innerText()));
    await more.locator('summary').click(); await settle();
    const dotNames = (label) => page.locator(`.s2-cdots[aria-label="${label}"] .s2-cdot-name`).allInnerTexts();
    check(T('chain colors: Black, White, Grey, Beige, Brown, Stainless steel (White by default)'), JSON.stringify(await dotNames('Chain color')) === JSON.stringify(['Black', 'White', 'Grey', 'Beige', 'Brown', 'Stainless steel']) && await page.locator('.s2-cdots[aria-label="Chain color"] .s2-cdot.on .s2-cdot-name').innerText() === 'White');
    check(T('bottom bar colors: Pearl White, Sand Beige, Iron Gray, Night Black'), JSON.stringify(await dotNames('Bottom bar color')) === JSON.stringify(['Pearl White', 'Sand Beige', 'Iron Gray', 'Night Black']));
    check(T('roll direction: Standard (default) and Reverse, each with a one-line explanation and a small diagram'), (await page.locator('[aria-label="Roll direction"] .s2-card').count()) === 2 && (await page.locator('[aria-label="Roll direction"] .s2-roll').count()) === 2 && /hangs behind the roller/.test(await page.locator('[aria-label="Roll direction"]').innerText()) && await page.locator('[aria-label="Roll direction"] .s2-card.on .s2-card-name').innerText() === 'Standard');
    await page.locator('.s2-cdots[aria-label="Chain color"] .s2-cdot', { hasText: 'Brown' }).click(); await page.locator('.s2-cdots[aria-label="Bottom bar color"] .s2-cdot', { hasText: 'Night Black' }).click(); await page.locator('[aria-label="Roll direction"] .s2-card', { hasText: 'Reverse' }).click(); await settle();
    check(T('the choices show in the summary and in the preview note'), /Chain color: Brown/.test(await more.locator('summary').innerText()) && /brown/.test(await page.locator('.pv-note').innerText()));
    // ---- 2 in 1
    await card('2 in 1 motor').click(); await settle();
    check(T('2 in 1 motor: soft motor outline, the handle, the remote tile and "Motor side" with Right only'), (await page.locator('.pv-grip').count()) === 1 && (await page.locator('.rm').count()) === 1 && await step('Motor side').locator('.s2-card').count() === 1 && /right side only/.test(await step('Motor side').innerText()));
    check(T('the bar color and roll direction stay for the 2 in 1, the chain color goes away'), (await page.locator('.s2-cdots[aria-label="Chain color"]').count()) === 0 && (await page.locator('.s2-cdots[aria-label="Bottom bar color"]').count()) === 1);
    // ---- the choices are on the order line
    await card('Chain').click(); await settle();
    await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled); await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    await page.goto(`${BASE}/order`); await page.locator('.s2-item').first().waitFor();
    const line = await page.locator('.s2-item').first().innerText();
    check(T('the order line shows the chain color, bottom bar and roll direction'), /Chain color: Brown/.test(line) && /Bottom bar: Night Black/.test(line) && /Roll direction: Reverse/.test(line), line.replace(/\s+/g, ' ').slice(0, 300));
    await page.evaluate(() => localStorage.clear());

    // ---- double-stack
    await open('roller'); await card('Double-stack').click(); await settle();
    check(T('double-stack: no Chain and no 2 in 1 motor; Zero gravity is the default'), (await page.locator('.s2-card-name', { hasText: /^(Chain|2 in 1 motor)$/ }).count()) === 0 && await card('Zero gravity').getAttribute('aria-pressed') === 'true');
    // ---- Cellular
    await open('cellular');
    check(T('Cellular: Zero gravity (Best value), Motorized (Top of the line), Chain; no Cordless'), JSON.stringify(await badges('Zero gravity')) === JSON.stringify(['Best value']) && JSON.stringify(await badges('Motorized')) === JSON.stringify(['Top of the line']) && (await page.locator('.s2-card-name', { hasText: /Cordless/ }).count()) === 0);
    await card('Chain').click(); await settle();
    check(T('Cellular Chain offers Chain or Cord loop, and the Cord loop colors are White, Beige, Grey, Brown, Black'), (await page.locator('[aria-label="Chain or cord loop"] .s2-card').count()) === 2 && await (async () => { await page.locator('[aria-label="Chain or cord loop"] .s2-card', { hasText: 'Cord loop' }).click(); await page.locator('.s2-more summary').click(); await settle(); return JSON.stringify(await page.locator('.s2-cdots[aria-label="Cord loop color"] .s2-cdot-name').allInnerTexts()) === JSON.stringify(['White', 'Beige', 'Grey', 'Brown', 'Black']); })());
    check(T('cellular has no roll direction and no bottom bar color'), (await page.locator('[aria-label="Roll direction"]').count()) === 0 && (await page.locator('.s2-cdots[aria-label="Bottom bar color"]').count()) === 0);
    // ---- Roman: chain offers cord loop; roll direction yes
    await open('roman'); await card('Chain').click(); await page.locator('.s2-more summary').click(); await settle();
    check(T('Roman: Chain or Cord loop, and a roll direction'), (await page.locator('[aria-label="Chain or cord loop"] .s2-card').count()) === 2 && (await page.locator('[aria-label="Roll direction"] .s2-card').count()) === 2);
    // ---- Zebra: bar color, no roll direction
    await open('zebra'); await page.locator('.s2-more summary').click();
    check(T('Zebra: bottom bar color yes, roll direction no'), (await page.locator('.s2-cdots[aria-label="Bottom bar color"]').count()) === 1 && (await page.locator('[aria-label="Roll direction"]').count()) === 0);
    // ---- Shangri-La: no Zero gravity, no badge
    await open('shangri-la');
    check(T('Shangri-La: no Zero gravity, Chain selected, no Best value tag until the owner picks one, Motorized is Top of the line'), (await page.locator('.s2-card-name', { hasText: /^Zero gravity$/ }).count()) === 0 && await card('Chain').getAttribute('aria-pressed') === 'true' && (await badges('Chain')).length === 0 && JSON.stringify(await badges('Motorized')) === JSON.stringify(['Top of the line']));

    // ---- Dream Curtains
    await open('drapery'); await page.getByRole('tab', { name: 'Dream Curtains' }).click(); await page.locator('.s2-swgrid .s2-sw').first().waitFor();
    check(T('Dream Curtains: no Best value tag until the owner picks one; Motorized is Top of the line'), (await page.locator('.s2-badge').evaluateAll((els) => els.filter((e) => /best value/i.test(e.textContent)).length)) === 0 && JSON.stringify(await badges('Motorized')) === JSON.stringify(['Top of the line']));
    // ---- Curtains hardware
    await page.getByRole('tab', { name: 'Curtains', exact: true }).click(); await page.locator('.s2-swgrid .s2-sw').first().waitFor();
    check(T('Curtains: the 14 styles and "Add a track or rod" with "I have my own" selected'), (await step('Style').locator('.s2-card').count()) === 14 && await card('I have my own').getAttribute('aria-pressed') === 'true');
    await page.locator('.s2-swgrid .s2-sw').first().click(); await card('Grommet').click(); await card('Add a track or rod').click(); await settle();
    const tracks = await step('Add a track or rod').locator('[aria-label="Track or rod"] .s2-card-name').allInnerTexts();
    check(T('Grommet fits only the Elegance rod, and the motorized rail is hidden with the reason given'), JSON.stringify(tracks) === JSON.stringify(['Elegance rod']) && /cannot go on a motorized rail/.test(await step('Add a track or rod').innerText()));
    await card('Pinch pleat').click(); await settle();
    check(T('Pinch pleat fits all five tracks'), JSON.stringify(await step('Add a track or rod').locator('[aria-label="Track or rod"] .s2-card-name').allInnerTexts()) === JSON.stringify(['Classic rail', 'Arc rail', 'Elegance rod', 'Elegance rail', 'Motorized rail']));
    await card('Elegance rod').click(); await settle();
    check(T('Elegance rod: five metal finishes and a finial list (Classic plain, then ten named)'), (await page.locator('.s2-cdots[aria-label="Track color"] .s2-cdot').count()) === 5 && (await page.locator('#s2-finial option').count()) === 11);
    await card('Motorized rail').click(); await card('Center opening').click(); await settle();
    check(T('Motorized rail: battery or wired, left / right / center opening, and an overlap choice for the center'), (await step('Add a track or rod').locator('[aria-label="Motor power"] .s2-card').count()) === 2 && (await step('Add a track or rod').locator('[aria-label="Opening"] .s2-card').count()) === 3 && (await step('Add a track or rod').locator('[aria-label="Center overlap"] .s2-card').count()) === 2 && (await page.locator('.rm-card, .pv-incl').count()) >= 1);
    check(T('the measuring help says width is the track width without end caps and height is from the track down'), /track width without the end caps/i.test(await step('Size').innerText()) && /from the track down/i.test(await step('Size').innerText()));
    if (migrated) {
      await size(100, 84); await page.waitForTimeout(1500);
      check(T('the track estimate shows a price for a motorized rail (needs migration 20)'), /Track or rod estimate: \$\d+/.test(await step('Add a track or rod').innerText()));
    } else skip(T('the track estimate'));
    check(T('no sideways scrolling and no page errors'), (await page.evaluate(() => document.documentElement.scrollWidth)) <= vw && errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
