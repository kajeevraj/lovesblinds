// Browser test of the redesigned product pages (Stage 2) at 390 px against the live Supabase project:
// the price shown equals the database price for every line, the price display rules (no price early, oversize wording,
// curtains by email, two colors for double-stack and Day & Night), quantity totals, the No fabric wrap deduction,
// and that no price group or supplier field reaches the page. Needs a preview server (BASE_URL, default http://localhost:4173)
// and SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (the service role only for the price group names).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const H = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const rpc = async (fn, body) => (await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(ANON), body: JSON.stringify(body) })).json();
const names = await (await fetch(`${URL_}/rest/v1/fabrics?select=id,collection_name`, { headers: H(SVC) })).json();
const OUR_WORDS = /Zero gravity|Cordless spring|Softens sun and glare|Cellular Shades|Roller Shades|Zebra Shades|Roman Shades|Shangri-La Shades/gi;     // our own wording (a price group can share a line's name), not price group names
const leak = (raw) => { const text = raw.replace(OUR_WORDS, ''); return names.filter((f) => new RegExp(`\\b${f.collection_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)).map((f) => f.collection_name); };
const catalogs = {};
const catalog = async (scope) => (catalogs[scope] ||= (await rpc('public_catalog', { p_scope: [scope] })).flatMap((g) => g.swatches));
const money = (t) => Number(String(t).replace(/[^\d]/g, ''));

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const bodies = [];
  page.on('response', async (r) => { if (/rpc\/(public_catalog|estimate_price_for_swatch)|\/api\/catalog/.test(r.url())) { try { bodies.push(await r.text()); } catch { /* ignore */ } } });
  const open = async (slug) => { await page.goto(`${BASE}/products/${slug}`); await page.locator('.s2-sw').first().waitFor(); };
  const size = async (w, h) => { await page.locator('#s2-w').fill(String(w)); await page.locator('#s2-h').fill(String(h)); };
  const estimate = () => page.locator('.s2-estimate-price');
  const pagePrice = async () => { await estimate().waitFor(); return money(await estimate().first().evaluate((el) => el.firstChild.textContent)); };
  // a swatch is a picture; its name is its title and its button is named "Name code"
  const tileInfo = async (i = 0, scope = page) => { const b = scope.locator('.s2-swgrid .s2-sw').nth(i); const name = (await b.getAttribute('title')).trim(); const label = (await b.getAttribute('aria-label')).trim(); return { name, code: label.slice(name.length).trim() }; };
  const swatchId = async (cat, t, family) => (await catalog(cat)).find((x) => x.display_name === t.name && (!family || x.family === family) && (x.styles?.[0]?.code === t.code.split(' / ')[0] || x.supplier_code === t.code || !x.styles))?.id;
  const dbPrice = (line, swatchIdv, options, w, h) => rpc('estimate_price_for_swatch', { p_line: line, p_swatch_id: swatchIdv, p_options: options, p_width: w, p_height: h });

  // ---------- Roller: top cover, quantity ----------
  await open('roller');
  const rt = await tileInfo(); await page.locator('.s2-sw').first().click();
  const rid = await swatchId('roller', rt, 'solar');
  await size(40, 64);
  const wrapped = await pagePrice();
  const dbWrapped = await dbPrice('roller', rid, { control: 'zero-gravity', mode: 'single' }, 40, 64);
  check('Roller: the default top cover is the fabric-wrapped cassette and the price is the database price', wrapped === dbWrapped.price, `page $${wrapped}, database $${dbWrapped.price}`);
  const covers = await page.locator('.s2-card', { hasText: /Fabric-wrapped cassette|No fabric wrap/ }).allInnerTexts();
  check('Roller: the Top cover step offers exactly "Fabric-wrapped cassette" and "No fabric wrap"', covers.length === 2 && /Fabric-wrapped cassette/.test(covers[0]) && /No fabric wrap/.test(covers[1]) && await page.locator('.s2-card.on', { hasText: 'Fabric-wrapped cassette' }).count() === 1, covers.map((c) => c.split('\n')[0]).join(' | '));
  await page.locator('.s2-card', { hasText: 'No fabric wrap' }).click();
  await page.waitForFunction((old) => { const el = document.querySelector('.s2-estimate-price'); return el && Number(el.firstChild.textContent.replace(/\D/g, '')) !== old; }, wrapped);
  const noWrap = await pagePrice();
  const dbNoWrap = await dbPrice('roller', rid, { control: 'zero-gravity', mode: 'single', wrap_cassette: 'none' }, 40, 64);
  check('Roller: "No fabric wrap" lowers the price by the supplier deduction, exactly the database price', noWrap === dbNoWrap.price && noWrap < wrapped, `$${wrapped} -> $${noWrap} (database $${dbNoWrap.price})`);
  check('Roller: the page never shows a cost or the deduction amount', !/deduction|\$3\b|cost|markup/i.test(await page.locator('.s2-estimate').innerText()));

  // quantity
  check('the quantity starts at 1 and the bar shows one price', (await page.locator('#s2-qty').inputValue()) === '1' && !/each/.test(await page.locator('.s2-bar').innerText()));
  check('the quantity question says "How many blinds this size?" and cannot go below 1', /How many blinds this size\?/.test(await page.locator('.s2-qty').innerText()) && await page.getByRole('button', { name: 'One fewer blind' }).isDisabled());
  await page.locator('#s2-qty').fill('3');
  await page.getByText(/each · 3 blinds/).first().waitFor();
  const barTotal = (await page.locator('.s2-estimate-price').innerText()).trim(), barSub = (await page.locator('.s2-estimate-each').innerText()).trim();
  const estText = await page.locator('.s2-estimate').innerText();
  check('with 3 blinds the card total is the big number with "$X each · 3 blinds" under it, and the bar says "3 × $X = $total"', barTotal === `$${noWrap * 3}` && barSub === `$${noWrap} each · 3 blinds` && new RegExp(`^YOUR ESTIMATE\\s*\\$${noWrap * 3}\\s*\\$${noWrap} each · 3 blinds`, 'i').test(estText.replace(/\n+/g, ' ')) && (estText.match(/3 blinds/g) || []).length === 1 && new RegExp(`3 × \\$${noWrap} = \\$${noWrap * 3}`).test(await page.locator('.s2-bar-price').textContent()), `${barTotal} / ${barSub}`);
  await page.locator('#s2-qty').fill('0'); await page.locator('#s2-qty').blur();
  check('typing 0 becomes 1', (await page.locator('#s2-qty').inputValue()) === '1');
  await page.locator('#s2-qty').fill('3');
  await page.locator('#s2-room').selectOption('Other'); await page.locator('#s2-room-custom').fill('Test room');
  await page.locator('.s2-add-btn').click();
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lb_guest_quote') || '[]'));
  check('Add to cart keeps the quantity, the size, the room and the top cover choice', saved.length === 1 && saved[0].qty === 3 && saved[0].width === 40 && saved[0].length === 64 && saved[0].roomLabel === 'Test room' && saved[0].selection?.cover === 'none', JSON.stringify({ qty: saved[0]?.qty, cover: saved[0]?.selection?.cover }));

  // oversize + early states
  await page.locator('#s2-w').fill('500');
  await page.getByText(/larger than our standard range/).first().waitFor();
  check('Roller oversize: the larger-than-standard wording, "Price sent by email", and Add to cart still works', /Add it to your cart and we'll reply with a price\./.test(await page.locator('.s2-estimate').innerText()) && (await page.locator('.s2-estimate-price').count()) === 0 && await page.locator('.s2-add-btn').isEnabled());

  // ---------- Zebra ----------
  await open('zebra');
  check('Zebra: no price and no Add to cart before a color and size', (await estimate().count()) === 0 && await page.locator('.s2-add-btn').isDisabled());
  const zt = await tileInfo(); await page.locator('.s2-sw').first().click(); await size(40, 64);
  const zid = await swatchId('zebra', zt);
  const zdb = await dbPrice('zebra', zid, { control: 'zero-gravity' }, 40, 64);
  check('Zebra: the page price is the database price', (await pagePrice()) === zdb.price, `$${zdb.price}`);
  const zWrapped = await pagePrice();
  await page.locator('.s2-card', { hasText: 'No fabric wrap' }).click();
  await page.waitForFunction((old) => { const el = document.querySelector('.s2-estimate-price'); return el && Number(el.firstChild.textContent.replace(/\D/g, '')) !== old; }, zWrapped);
  const zdbNo = await dbPrice('zebra', zid, { control: 'zero-gravity', wrap_cassette: 'none' }, 40, 64);
  check('Zebra: the Top cover step ("Fabric-wrapped cassette" default, "No fabric wrap") uses the supplier deduction, exactly the database price', (await pagePrice()) === zdbNo.price && zdbNo.price < zdb.price, `$${zdb.price} -> $${zdbNo.price}`);
  check('Zebra: the gallery has the configurator and three style photos', (await page.locator('.gal-dots [role=tab]').count()) === 4);

  // ---------- Shangri-La ----------
  await open('shangri-la');
  const st = await tileInfo(); await page.locator('.s2-sw').first().click(); await size(40, 64);
  const sid = await swatchId('shangri-la', st);
  const sdb = await dbPrice('shangri-la', sid, { control: 'chain' }, 40, 64);
  check('Shangri-La: the page price is the database price (Chain)', (await pagePrice()) === sdb.price, `$${sdb.price}`);
  const sl = await page.locator('main').innerText();
  check('Shangri-La is horizontal only: no format or vertical choice anywhere', !/vertical|sheer vertical|format/i.test(sl));

  // ---------- Roman ----------
  await open('roman');
  const mt = await tileInfo(); await page.locator('.s2-sw').first().click(); await size(40, 64);
  check('Roman: no price until a style and a lining are chosen', (await estimate().count()) === 0 && /Pick a style/.test(await page.locator('.s2-add-hint').innerText()));
  const style = page.locator('.s2-step', { hasText: 'Style' }).locator('.s2-card:not([disabled])').first();
  await style.click();
  const lin = page.locator('.s2-step', { hasText: 'Lining' }).locator('.s2-card:not([disabled])').first();
  const liningLabel = (await lin.locator('.s2-card-name').innerText()).trim();
  await lin.click();
  const lid = /^Blackout/.test(liningLabel) ? 'blackout' : /^Light/.test(liningLabel) ? 'light-filtering' : 'none';
  const mid = await swatchId('roman', mt);
  const mdb = await dbPrice('roman', mid, { control: 'zero-gravity', lining: lid }, 40, 64);
  check('Roman: with color, style and lining the page price is the database price', (await pagePrice()) === mdb.price, `${liningLabel}: $${mdb.price}`);

  // ---------- Cellular ----------
  await open('cellular');
  const ct = await tileInfo(); await page.locator('.s2-sw').first().click(); await size(40, 64);
  const cfam = (await catalog('cellular')).find((x) => x.display_name === ct.name)?.family;
  const cid = await swatchId('cellular', ct, 'light-filtering');
  const cdb = await dbPrice('cellular', cid, { control: 'zero-gravity', type: 'standard' }, 40, 64);
  check('Cellular: the standard price is the database price', (await pagePrice()) === cdb.price, `$${cdb.price}`);
  await page.locator('.s2-card', { hasText: 'Day & night' }).click();
  check('Cellular Day & Night says it needs two colors and shows no price yet', /two colors/i.test(await page.locator('.s2-step-hint.s2-need').innerText()) && (await estimate().count()) === 0);
  await page.locator('.s2-color').nth(0).locator('.s2-sw').first().click();
  check('Cellular Day & Night with only the day color shows no price', (await estimate().count()) === 0 && /day and a night/.test(await page.locator('.s2-add-hint').innerText()));
  const nightTile = page.locator('.s2-color').nth(1).locator('.s2-sw').first();
  const dayName = await tileInfo(0, page.locator('.s2-color').nth(0)); const nightName = await tileInfo(0, page.locator('.s2-color').nth(1));
  await nightTile.click();
  const dnPage = await pagePrice();
  const did = await swatchId('cellular', dayName, 'light-filtering'), nid = await swatchId('cellular', nightName, 'blackout');
  const dndb = await dbPrice('cellular', nid, { control: 'zero-gravity', type: 'day-night', day_swatch_id: did }, 40, 64);
  check('Cellular Day & Night: once both colors are chosen the price is the database price', dnPage === dndb.price, `$${dndb.price}`);

  // ---------- Drapery ----------
  await open('drapery');
  const curtainColor = (await tileInfo()).name;
  await page.locator('.s2-sw').first().click();
  const stepOf = (title) => page.locator('.s2-step', { has: page.locator('.s2-step-title', { hasText: new RegExp(`^\\s*\\d+\\s*${title}\\s*$`) }) });
  await stepOf('Style').locator('.s2-card').nth(1).click();
  await stepOf('Fullness').locator('.s2-card').first().click();
  await stepOf('Liner').locator('.s2-card').first().click();
  await stepOf('Panels').locator('.s2-card').first().click();
  const migrated = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/public_options`, { method: 'POST', headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{"p_line":"roller"}' }).then((r) => r.ok).catch(() => false);
  check('Curtains: no price and no dollar amount until a size is entered, and the Add button waits', (await estimate().count()) === 0 && !/\$\s?\d/.test(await page.locator('.s2-estimate').innerText()) && await page.locator('.s2-add-btn').isDisabled());
  await size(120, 96);
  if (migrated) {
    const dswId = (await catalog('drapery')).find((x) => x.display_name === (curtainColor))?.id;
    const want = (await rpc('drapery_estimate', { p_swatch: dswId, p_options: { fullness: 2.1, style_family: 'pleated', lining: 'none' }, p_width: 120, p_height: 96 }));
    await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled);
    check('Curtains: with a size the fabric price shows and is the database price (supplier cost x the markup)', want.price != null ? (await pagePrice()) === want.price : /Price by email/.test(await page.locator('.s2-estimate').innerText()), JSON.stringify(want));
    await size(300, 96); await page.getByText(/Send us your order and we.ll reply with a price/).first().waitFor();
    check('Curtains: a size outside 40 to 236 wide or 42 to 236 high is "Price by email"', (await estimate().count()) === 0);
    await size(120, 96);
  } else {
    await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled);
    console.log('SKIP  curtain fabric price (migration 20 is not applied to this database)');
  }
  check('Curtains can be added once a size is entered', await page.locator('.s2-add-btn').isEnabled());
  await page.getByRole('tab', { name: 'Dream Curtains' }).click();
  await page.locator('.s2-sw').first().waitFor();
  const dt = await tileInfo();
  await page.locator('.s2-sw').first().click();
  check('Dream Curtains: after a color the style (A or B) is still to be chosen, and no price shows', (await estimate().count()) === 0 && (await page.locator('.s2-color-style .s2-card').count()) === 2);
  await page.locator('.s2-color-style .s2-card').first().click();
  await size(60, 84);
  const dcat = await catalog('dream-curtains');
  const dsw = dcat.find((x) => x.display_name === dt.name);
  const ddb = await dbPrice('dream-curtains', dsw.id, { control: 'manual' }, 60, 84);
  if (ddb.price != null) check('Dream Curtains: a live price, equal to the database price', (await pagePrice()) === ddb.price, `$${ddb.price}`);
  else check('Dream Curtains: the database says custom size, so the page says so', await page.getByText(/larger than our standard range/).count() > 0);

  // ---------- phone width, privacy ----------
  for (const slug of ['roller', 'zebra', 'shangri-la', 'roman', 'cellular', 'drapery']) {
    await open(slug);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    const small = await page.evaluate(() => [...document.querySelectorAll('.s2-chip, .s2-card, .s2-sw, .s2-add-btn, .s2-tab, .s2-input')].filter((e) => e.offsetParent && (e.getBoundingClientRect().height < 43.5)).length);
    check(`${slug}: no sideways scroll at 390 px and touch targets are at least 44 px`, sw <= 390 && small === 0, `${sw} px, ${small} small targets`);
    check(`${slug}: no price group names on the page`, leak(await page.content()).length === 0);
  }
  const all = bodies.join('');
  check('no catalog or estimate response had price group names, supplier color names, grades, extra costs or cost fields', leak(all).length === 0 && !/supplier_color_name|"grade"|extra_cost|collection_name|"cost"|markup|price_group/.test(all), `${bodies.length} responses, ${all.length} bytes checked`);
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
