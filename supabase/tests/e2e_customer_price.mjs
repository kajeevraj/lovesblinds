// Browser test of the customer side at 390 px against the live Supabase project: what the page shows (and does not show)
// about price groups and prices. Needs migration 10 and a preview server (BASE_URL, default http://localhost:4173).
// Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (the service role only to compute the expected price and the names).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const H = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });
const results = [];
const migrated = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/public_options`, { method: 'POST', headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{"p_line":"roller"}' }).then((r) => r.ok).catch(() => false);
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };

// helpers for the new size boxes (whole inches + a "+ fraction" dropdown) and the curtain steps (style, fullness, liner, panels)
const sizeOf = async (page, k) => { const w = await page.locator(`#s2-${k}`).inputValue(); const f = await page.locator(`#s2-${k}-frac`).inputValue(); return f ? (w ? `${w} ${f}` : f) : w; };
const pickCurtains = async (page) => {
  const st = (t) => page.locator('.s2-step', { has: page.locator('.s2-step-title', { hasText: new RegExp(`^\\s*\\d+\\s*${t}\\s*$`) }) });
  await st('Style').locator('.s2-card').nth(1).click(); await st('Fullness').locator('.s2-card').first().click();
  await st('Liner').locator('.s2-card').first().click(); await st('Panels').locator('.s2-card').first().click();
};
const rpc = async (fn, body) => (await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(ANON), body: JSON.stringify(body) })).json();
const names = await (await fetch(`${URL_}/rest/v1/fabrics?select=id,collection_name`, { headers: H(SVC) })).json();
const suppNames = (await (await fetch(`${URL_}/rest/v1/swatches?select=supplier_color_name&supplier_color_name=not.is.null&limit=2000`, { headers: H(SVC) })).json()).map((x) => x.supplier_color_name).filter((n) => n.length > 5);
// "Cordless spring" and "Softens sun and glare" are our own wording on the page, not a price group: ordinary words in our own copy are not leaks
const leak = (raw) => { const text = raw.replace(/Cordless spring|Softens sun and glare|Cellular Shades|Roller Shades|Zebra Shades|Roman Shades|Shangri-La Shades/gi, ''); return names.filter((f) => new RegExp(`\\b${f.collection_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)).map((f) => f.collection_name); };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const bodies = [];
  page.on('response', async (r) => { const u = r.url(); if (/rpc\/(public_catalog|estimate_price_for_swatch)|\/api\/catalog/.test(u)) { try { bodies.push([u, await r.text()]); } catch { /* ignore */ } } });
  const rtiles = () => page.locator('.s2-sw');                  // the new Roller page

  await page.goto(`${BASE}/products/roller`); await rtiles().first().waitFor();
  const html = await page.content();
  check('the Roller page shows no price on any swatch, tag or filter before a color is picked', !/\$\s?\d/.test(await page.locator('.s2-swgrid').first().innerText()) && (await page.locator('.s2-estimate-price').count()) === 0, 'no "$" in the grid, no estimate shown');
  check('before a color and size the bar shows no price, and the Add to cart button in the card is off and says what is missing', (await page.locator('.s2-estimate-price').count()) === 0 && await page.locator('.s2-add-btn').isDisabled() && /Pick a color/.test(await page.locator('.s2-add-hint').innerText()));
  check('the page and the catalog responses contain no price group names', leak(html + bodies.map((b) => b[1]).join('')).length === 0, leak(html + bodies.map((b) => b[1]).join('')).slice(0, 5).join(', ') || `${names.length} names checked`);

  // pick the first color (Solar is the first fabric type)
  const pickedLabel = (await rtiles().first().locator('.s2-sw-name').innerText()).trim();
  check('swatches show a name and a code only (no price, no collection)', /^[^$]+$/.test(await rtiles().first().innerText()) && (await rtiles().first().locator('.s2-sw-code').innerText()).length > 3);
  await rtiles().first().click();
  check('no price until a size is entered (a color alone is not enough)', (await page.locator('.s2-estimate-price').count()) === 0 && /Enter your size/.test(await page.locator('.s2-add-hint').innerText()), 'no estimate');
  await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
  await page.locator('.s2-estimate-price').waitFor();
  const p1 = Number((await page.locator('.s2-estimate-price').innerText()).replace(/\D/g, ''));
  // what the database says for the picked color at that size (service role is only used to look the color up)
  const cat = await rpc('public_catalog', { p_scope: ['roller'] });
  const firstSw = cat.flatMap((g) => g.swatches).find((x) => x.display_name === pickedLabel && x.family === 'solar');
  const want = await rpc('estimate_price_for_swatch', { p_line: 'roller', p_swatch_id: firstSw.id, p_options: { control: 'chain', mode: 'single' }, p_width: 40, p_height: 64 });
  check('after a color and a size the page shows one price, the one the database calculates', p1 > 0 && p1 === want.price, `page $${p1}, database $${want.price} for ${firstSw.display_name}`);
  check('the estimate carries the wording from the design', /Here's your estimate\. Send it and we'll confirm details and final price\./.test(await page.locator('.s2-estimate').innerText()));
  check('the sticky bar shows the same price and Add to cart is on', (await page.locator('.s2-estimate-price').innerText()).replace(/\D/g, '') === String(p1) && await page.locator('.s2-add-btn').isEnabled(), await page.locator('.s2-bar').innerText());
  const summary = await page.locator('.s2-estimate').innerText();
  check('the price comes with no breakdown: no cost, markup, grid, group or extra wording', !/markup|cost|grid|group|extra|collection/i.test(summary), summary.replace(/\s+/g, ' ').slice(0, 200));
  await page.locator('#s2-w').fill('60');
  await page.waitForFunction((old) => { const el = document.querySelector('.s2-estimate-price'); return el && Number(el.textContent.replace(/\D/g, '')) !== old; }, p1);
  const p2 = Number((await page.locator('.s2-estimate-price').innerText()).replace(/\D/g, ''));
  const want2 = await rpc('estimate_price_for_swatch', { p_line: 'roller', p_swatch_id: firstSw.id, p_options: { control: 'chain', mode: 'single' }, p_width: 60, p_height: 64 });
  check('the price updates live when the size changes', p2 === want2.price && p2 !== p1, `$${p1} -> $${p2}`);
  await page.locator('#s2-w').fill('60 1/2');
  await page.waitForFunction(() => /60 1\/2/.test(document.querySelector('.s2-estimate')?.innerText || ''));
  check('a 1/8-inch fraction is part of the size ("60 1/2")', true);
  await page.locator('#s2-w').fill('500');
  await page.getByText(/larger than our standard range/).first().waitFor();
  check('an oversize window says it is larger than our standard range, with no price', (await page.locator('.s2-estimate-price').count()) === 0 && /Add it to your cart and we'll reply with a price\./.test(await page.locator('.s2-estimate').innerText()) && (await page.locator('.s2-estimate-price').count()) === 0, await page.locator('.s2-estimate').innerText());
  check('an oversize window can still be added to the order', await page.locator('.s2-add-btn').isEnabled());

  // double-stack needs two colors before any price shows
  await page.locator('.s2-card', { hasText: 'Double-stack' }).click();
  check('double-stack says it needs two colors', /two colors/i.test(await page.locator('.s2-step-hint.s2-need').innerText()));
  await page.locator('#s2-w').fill('40');
  await rtiles().first().click();
  check('double-stack with only the front color shows no price', (await page.locator('.s2-estimate-price').count()) === 0 && /Pick a front and a back color|front and a back/i.test(await page.locator('.s2-add-hint').innerText()) && await page.locator('.s2-add-btn').isDisabled(), '');
  await page.locator('.s2-color').nth(1).locator('.s2-sw').first().click();
  await page.locator('.s2-estimate-price').waitFor();
  check('double-stack shows a price once both colors are picked', Number((await page.locator('.s2-estimate-price').innerText()).replace(/\D/g, '')) > 0);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('no sideways scroll at 390 px', sw <= 390, `${sw} px`);

  // curtains: price on request
  await page.goto(`${BASE}/products/drapery`); await rtiles().first().waitFor();
  await rtiles().first().click();
  await pickCurtains(page);
  check('Drapery curtains show no price until a size is entered', (await page.locator('.s2-estimate-price').count()) === 0 && !/\$\s?\d/.test(await page.locator('.s2-estimate').innerText()), await page.locator('.s2-estimate').innerText());
  if (migrated) {
    await page.locator('#s2-w').fill('300'); await page.locator('#s2-h').fill('96');
    await page.getByText(/send us your order and we.ll reply with a price/i).first().waitFor();
    check('a curtain size outside 40 to 236 wide or 42 to 236 high says "send us your order and we\'ll reply with a price" (no dollar amount)', !/\$\s?\d/.test(await page.locator('.s2-estimate').innerText()), await page.locator('.s2-estimate').innerText());
    await page.locator('#s2-w').fill('100'); await page.locator('.s2-estimate-price').waitFor();
    check('a curtain size inside the range shows a price, and it holds no cost, group or markup words', !/cost|markup|group|tier/i.test(await page.locator('.s2-estimate').innerText()));
  } else console.log('SKIP  curtain fabric price (migration 20 is not applied to this database)');
  check('the Drapery page has no price group names either', leak(await page.content()).length === 0, 'checked');

  // every catalog response of the session
  const all = bodies.map((b) => b[1]).join('');
  check('no catalog or estimate response of this session had price group names, supplier color name / grade / extra cost fields, or cost fields',
    leak(all).length === 0 && !/supplier_color_name|"grade"|extra_cost|collection_name|"cost"|markup/.test(all), `${bodies.length} responses, ${all.length} bytes checked`);
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
