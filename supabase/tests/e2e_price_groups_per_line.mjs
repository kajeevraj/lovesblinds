// Browser test (390 px) of "Pricing details" in the color editor: one row per line the color is in, each with its own price
// group, a single-group line shown as plain text, changes saved with Save, shown in the change history, and the cache cleared
// for that line. Needs migration 10, a preview on BASE_URL (default http://localhost:4173), and the usual three env vars.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const stamp = Date.now(); const users = [], adminRows = [], cleanup = [];
let browser;
try {
  const email = `zz-pgl-${stamp}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true }); users.push(cu.body.id);
  const ar = await api('POST', '/rest/v1/admins', H(SVC), { email, user_id: cu.body.id }); adminRows.push(ar.body[0].id);
  const tok = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password })).body;
  const admin = H(ANON, tok.access_token);

  // two Shangri-La price groups with different prices, and a zebra home color to link
  const sf = (await api('GET', '/rest/v1/fabrics?select=id,collection_name&product_line=eq.shangri-la&active=eq.true&order=sort_order', H(SVC))).body;
  const priced = []; for (const f of sf) { const b = (await api('POST', '/rest/v1/rpc/estimate_price_debug', admin, { p_line: 'shangri-la', p_fabric_id: f.id, p_options: { control: 'matter' }, p_width: 50, p_height: 70 })).body; if (b.status === 'ok') priced.push({ ...f, price: b.price }); }
  const g1 = priced[0], g2 = priced.find((x) => x.price !== g1.price);
  const zf = (await api('GET', '/rest/v1/fabrics?select=id,shown_in&product_line=eq.zebra&active=eq.true&order=sort_order&limit=1', H(SVC))).body[0];
  const code = `ZZPGL${stamp}`, id = `zebra:${code}`, tag = String(stamp).slice(-6).replace(/[0-9]/g, (d) => 'abcdefghij'[d]);
  const name = `Zzp Group ${tag}`;
  const ins = await api('POST', '/rest/v1/swatches', H(SVC), { id, fabric_id: zf.id, product_line: 'zebra', shown_in: zf.shown_in, display_name: name, supplier_code: code, color_family: 'Gray', image_path: 'full/zz.jpg', thumb_path: 'thumb/zz.webp', sort_order: 9999 });
  if (ins.status >= 300) throw new Error('could not create the test color: ' + JSON.stringify(ins.body));
  cleanup.push(() => api('DELETE', `/rest/v1/swatches?id=eq.${encodeURIComponent(id)}`, H(SVC)));

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(tok)]);
  const page = await ctx.newPage(); page.setDefaultTimeout(30000); page.on('dialog', (d) => d.accept());
  const purges = []; page.on('request', (r) => { if (/\/api\/catalog-purge/.test(r.url())) purges.push(r.postData()); });
  const open = async () => { await page.goto(`${BASE}/admin`); await page.getByRole('heading', { name: 'Colors', exact: true }).waitFor(); await page.getByLabel('Search name or code').fill(code); await page.getByRole('button', { name }).first().click(); await page.getByRole('heading', { name }).waitFor(); await page.locator('summary', { hasText: 'Pricing details' }).click(); };
  const row = (l) => page.locator(`details.adm-details [data-line="${l}"]`);

  await open();
  check('a color in one line shows one Pricing details row, with its current group', (await page.locator('details.adm-details [data-line]').count()) === 1 && /Currently using/.test(await row('zebra').innerText()), (await row('zebra').innerText()).replace(/\s+/g, ' ').slice(0, 120));

  // tick a second line: its row appears at once, on that line's standard group, with its own dropdown
  await page.getByRole('group', { name: 'Product lines' }).getByLabel('Shangri-La').check();
  await row('shangri-la').waitFor();
  const t1 = await row('shangri-la').innerText();
  check('ticking Shangri-La adds its own row: current group shown, marked standard, "new line", with its own dropdown', /Currently using/.test(t1) && /standard/.test(t1) && /new line/.test(t1) && (await row('shangri-la').locator('select').count()) === 1, t1.replace(/\s+/g, ' ').slice(0, 200));
  check('the original line keeps its own separate row and dropdown', (await row('zebra').locator('select').count()) === 1 && (await page.locator('details.adm-details [data-line]').count()) === 2);

  // a line with a single price group is plain text
  await page.getByRole('group', { name: 'Product lines' }).getByLabel('Cellular').check();
  await row('cellular').waitFor();
  const tc = await row('cellular').innerText();
  check('a line with only one price group shows it as plain text, not a dropdown', /the only one in this line/.test(tc) && (await row('cellular').locator('select').count()) === 1 /* the family select only */ && !(await row('cellular').locator('label:has-text("Price group for")').count()), tc.replace(/\s+/g, ' ').slice(0, 200));
  await page.getByRole('group', { name: 'Product lines' }).getByLabel('Cellular').uncheck();

  // change the Shangri-La group and save
  await row('shangri-la').locator('select').selectOption(g2.id);
  check('changing the group of the new line updates "Currently using" at once', new RegExp(g2.collection_name).test((await row('shangri-la').locator('[data-testid="current-group"]').innerText())), (await row('shangri-la').locator('[data-testid="current-group"]').innerText()).replace(/\s+/g, ' '));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText(new RegExp(`Saved “${name}”`)).waitFor();
  const lnk = (await api('GET', `/rest/v1/swatch_links?select=fabric_id,product_line&swatch_id=eq.${encodeURIComponent(id)}`, H(SVC))).body;
  check('Save stored the chosen price group for the second line', lnk.length === 1 && lnk[0].product_line === 'shangri-la' && lnk[0].fabric_id === g2.id, JSON.stringify(lnk));
  const priceFor = async (line, opts, w, h) => (await api('POST', '/rest/v1/rpc/estimate_price_for_swatch', H(ANON), { p_line: line, p_swatch_id: id, p_options: opts, p_width: w, p_height: h })).body.price;
  check('the customer price in Shangri-La is that group\'s price', (await priceFor('shangri-la', { control: 'matter' }, 50, 70)) === g2.price, `$${g2.price}`);
  const notice = await page.locator('.adm-notice').textContent();
  check('the live-site cache was cleared for the second line (and the first)', purges.some((b) => /shangri-la/.test(b || '') && /zebra/.test(b || '')), `purge requests: ${purges.join(' | ')}`);
  check('the notice says when the live site updates', /updated now|about a minute/.test(notice), notice.trim());

  // reopen: both rows show the saved groups; change the group again and look at the history
  await open();
  check('reopened: both lines show their saved groups', /Currently using/.test(await row('shangri-la').innerText()) && (await row('shangri-la').locator('select').inputValue()) === g2.id && (await page.locator('details.adm-details [data-line]').count()) === 2);
  await row('shangri-la').locator('select').selectOption(g1.id);
  check('changing a saved line marks its row "changed, saved with the Save button"', /changed, saved with the Save button/.test(await row('shangri-la').innerText()));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText(new RegExp(`Saved “${name}”`)).waitFor();
  check('the customer price in Shangri-La follows the change (and Zebra is untouched)', (await priceFor('shangri-la', { control: 'matter' }, 50, 70)) === g1.price && g1.price !== g2.price, `Shangri-La $${g2.price} -> $${g1.price}`);
  await open(); await page.getByText('Change history').waitFor(); await page.waitForTimeout(800);
  const hist = await page.locator('.adm-history').textContent();
  check('the change history shows the line being added and the later price group change, by line', /Added to Shangri-La/.test(hist) && /Price group changed in Shangri-La/.test(hist), hist.replace(/\s+/g, ' ').slice(0, 260));
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('no sideways scroll at 390 px', sw <= 390, `${sw} px`);
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser?.close();
  for (const fn of cleanup.reverse()) { try { await fn(); } catch { /* best effort */ } }
  for (const a of adminRows) await api('DELETE', `/rest/v1/admins?id=eq.${a}`, H(SVC));
  for (const u of users) await api('DELETE', `/auth/v1/admin/users/${u}`, H(SVC));
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
