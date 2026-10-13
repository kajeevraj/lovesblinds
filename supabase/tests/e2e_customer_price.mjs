// Browser test of the customer side at 390 px against the live Supabase project: what the page shows (and does not show)
// about price groups and prices. Needs migration 10 and a preview server (BASE_URL, default http://localhost:4173).
// Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (the service role only to compute the expected price and the names).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const H = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const rpc = async (fn, body) => (await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(ANON), body: JSON.stringify(body) })).json();
const names = await (await fetch(`${URL_}/rest/v1/fabrics?select=id,collection_name`, { headers: H(SVC) })).json();
const suppNames = (await (await fetch(`${URL_}/rest/v1/swatches?select=supplier_color_name&supplier_color_name=not.is.null&limit=2000`, { headers: H(SVC) })).json()).map((x) => x.supplier_color_name).filter((n) => n.length > 5);
const leak = (text) => names.filter((f) => new RegExp(`\\b${f.collection_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)).map((f) => f.collection_name);
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const bodies = [];
  page.on('response', async (r) => { const u = r.url(); if (/rpc\/(public_catalog|estimate_price_for_swatch)|\/api\/catalog/.test(u)) { try { bodies.push([u, await r.text()]); } catch { /* ignore */ } } });
  const tiles = () => page.locator('.sw-tile');

  await page.goto(`${BASE}/products/roller`); await tiles().first().waitFor();
  const html = await page.content();
  check('the Roller page shows no price on any swatch, tag or filter before a color is picked', !/\$\s?\d/.test(await page.locator('.sw-grid').first().innerText()) && !/\$\s?\d/.test(await page.locator('.order-summary-box').innerText()), 'no "$" in the grid or the summary');
  check('the page and the catalog responses contain no price group names', leak(html + bodies.map((b) => b[1]).join('')).length === 0, leak(html + bodies.map((b) => b[1]).join('')).slice(0, 5).join(', ') || `${names.length} names checked`);

  // pick the first color
  const pickedLabel = (await tiles().first().locator('.sw-label').innerText()).trim();
  await tiles().first().click();
  await page.locator('dialog[open] button.btn-sage').click();
  check('no price until a size is entered (a color alone is not enough)', (await page.locator('.order-price').count()) === 0, 'no price block');
  await page.getByLabel('Width (in)').fill('40'); await page.getByLabel('Height (in)').fill('64');
  await page.locator('.order-price-amount').waitFor();
  const p1 = Number((await page.locator('.order-price-amount').innerText()).replace(/\D/g, ''));
  // what the database says for the picked color at that size (service role is only used to look the color up)
  const cat = await rpc('public_catalog', { p_scope: ['roller'] });
  const firstSw = cat.flatMap((g) => g.swatches).find((x) => x.display_name === pickedLabel && x.family === 'screen-view');
  const want = await rpc('estimate_price_for_swatch', { p_line: 'roller', p_swatch_id: firstSw.id, p_options: { control: 'chain', mode: 'single' }, p_width: 40, p_height: 64 });
  check('after a color and a size the page shows one price, the one the database calculates', p1 > 0 && p1 === want.price, `page $${p1}, database $${want.price} for ${firstSw.display_name}`);
  const summary = await page.locator('.order-summary-box').innerText();
  check('the price comes with no breakdown: no cost, markup, grid, group or extra wording', !/markup|cost|grid|group|extra|collection/i.test(summary.replace(/Still to choose.*/s, '')), summary.replace(/\s+/g, ' ').slice(0, 200));
  await page.getByLabel('Width (in)').fill('60');
  await page.waitForFunction((old) => { const el = document.querySelector('.order-price-amount'); return el && Number(el.textContent.replace(/\D/g, '')) !== old; }, p1);
  const p2 = Number((await page.locator('.order-price-amount').innerText()).replace(/\D/g, ''));
  const want2 = await rpc('estimate_price_for_swatch', { p_line: 'roller', p_swatch_id: firstSw.id, p_options: { control: 'chain', mode: 'single' }, p_width: 60, p_height: 64 });
  check('the price updates live when the size changes', p2 === want2.price && p2 !== p1, `$${p1} -> $${p2}`);
  await page.getByLabel('Width (in)').fill('500');
  await page.getByText(/needs a custom quote/).waitFor();
  check('a size past the grid says it needs a quote, with no price', (await page.locator('.order-price-amount').count()) === 0, await page.locator('.order-price').innerText());
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('no sideways scroll at 390 px', sw <= 390, `${sw} px`);

  // curtains: price on request
  await page.goto(`${BASE}/products/drapery`); await tiles().first().waitFor();
  await tiles().first().click(); await page.locator('dialog[open] button.btn-sage').click();
  await page.getByText(/send us your order and we.ll reply with a price/i).waitFor();
  check('Drapery curtains still say "send us your order and we\'ll reply with a price" (no dollar amount)', !/\$\s?\d/.test(await page.locator('.order-price').innerText()), await page.locator('.order-price').innerText());
  check('the Drapery page has no price group names either', leak(await page.content()).length === 0, 'checked');

  // every catalog response of the session
  const all = bodies.map((b) => b[1]).join('');
  check('no catalog or estimate response of this session had price group names, supplier color names, grades or extra costs',
    leak(all).length === 0 && !/supplier_color_name|"grade"|extra_cost|collection_name/.test(all) && !suppNames.some((n) => all.includes(`"${n}"`)), `${bodies.length} responses, ${all.length} bytes checked`);
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
