// Browser test of the Products and Pricing admin screens against the live Supabase project, headless Chromium at 390 px.
// A temporary admin signs in with a password through the API and its session is handed to the page. Everything edited is
// restored and everything created is deleted. Needs the same environment as e2e_admin_browser.mjs and the workbooks in private/.
import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = process.env.SHOTS_DIR || '/tmp/e2e-shots'; mkdirSync(OUT, { recursive: true });
const SHEETS = process.env.SHEETS_DIR || 'private/supplier-sheets';
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k, x = {}) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', ...x });
const svc = H(SVC);
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const stamp = Date.now(); const users = [], adminRows = [], files = [];
let browser;
try {
  const email = `zz-pe2e-${stamp}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await api('POST', '/auth/v1/admin/users', svc, { email, password, email_confirm: true }); users.push(cu.body.id);
  const ar = await api('POST', '/rest/v1/admins', { ...svc, Prefer: 'return=representation' }, { email, user_id: cu.body.id }); adminRows.push(ar.body[0].id);
  const tok = await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password });
  const png = `${OUT}/option.png`; writeFileSync(png, await sharp({ create: { width: 600, height: 400, channels: 3, background: '#7a8f7c' } }).png().toBuffer());
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(tok.body)]);
  const page = await ctx.newPage(); page.setDefaultTimeout(30000); page.on('dialog', (d) => d.accept());
  const noOverflow = async (label) => { const w = await page.evaluate(() => document.documentElement.scrollWidth); check(`no sideways scroll at 390 px: ${label}`, w <= 390, `page is ${w} px wide`); };
  const menu = async (name) => { await page.getByRole('button', { name: 'Menu' }).click(); await page.locator('.adm-side').getByRole('button', { name: new RegExp(`^${name}`) }).click(); };

  await page.goto(`${BASE}/admin`); await page.getByRole('heading', { name: 'Colors', exact: true }).waitFor();
  const labels = await page.evaluate(() => [...document.querySelectorAll('.adm-nav-item')].map((e) => e.textContent.replace('Coming soon', ' (soon)')));
  check('menu has Colors, Products, Pricing, Orders, then Suppliers and Analytics as coming soon', labels.join('|').replace(/\s+/g, ' ') === 'Colors|Products|Pricing|Orders|Suppliers (soon)|Analytics (soon)', labels.join(' | '));

  // ------------------------------------------------------------ Products
  await menu('Products'); await page.getByRole('heading', { name: 'Products' }).waitFor();
  check('Products lists the 10 lines (6 live, 4 archived) plus hidden woven wood', (await page.locator('.adm-table tbody tr').count()) === 11, `${await page.locator('.adm-table tbody tr').count()} rows`);
  await noOverflow('products list'); await page.screenshot({ path: `${OUT}/p1-products.png`, fullPage: true });
  await page.getByRole('button', { name: 'Zebra / Dual Shades' }).first().click();
  await page.getByRole('tab', { name: 'Options' }).click();
  await page.getByRole('heading', { name: /^Control \(control\)/ }).waitFor();
  const firstExpl = page.locator('input[aria-label="One-line explanation"]').first();
  const oldExpl = await firstExpl.inputValue();
  await firstExpl.fill(oldExpl + ' (edited by test)');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.getByText(/saved\./).first().waitFor();
  const zv = (await api('GET', '/rest/v1/option_values?group_id=eq.zebra:control&order=sort_order&limit=1', svc)).body[0];
  check('editing an option explanation saves it', zv.explanation === oldExpl + ' (edited by test)', zv.explanation);
  await api('PATCH', `/rest/v1/option_values?id=eq.${zv.id}`, svc, { explanation: zv.explanation.replace(' (edited by test)', '') });
  // add an option to a free group, hide it, then remove it with the service role
  await page.locator('.adm-subcard').first().getByLabel('Label').fill('Zz test control');
  await page.locator('.adm-subcard').first().getByRole('button', { name: 'Add option' }).click();
  await page.getByText('Option added.').waitFor();
  const added = (await api('GET', '/rest/v1/option_values?code=eq.zz-test-control', svc)).body;
  check('adding an option to a free group works (code made from the label)', added.length === 1 && added[0].group_id === 'zebra:control', JSON.stringify(added.map((a) => a.id)));
  // picture upload on the new option
  const row = page.locator('tr', { has: page.locator('input[aria-label="Label"][value="Zz test control"]') });
  await row.getByRole('button', { name: 'Change picture' }).click();
  await row.locator('input[type=file]').setInputFiles(png);
  await page.getByText('Picture uploaded.').waitFor();
  const withPic = (await api('GET', '/rest/v1/option_values?code=eq.zz-test-control', svc)).body[0];
  files.push(withPic.image_path);
  const pr = await fetch(`${URL_}/storage/v1/object/public/option-images/${withPic.image_path}`);
  check('uploading an option picture stores it under a unique name with a 24-hour cache', /^zebra\/[a-z0-9-]+-[a-z0-9]+\.jpg$/.test(withPic.image_path) && pr.status === 200 && /max-age=86400/.test(pr.headers.get('cache-control') || ''), `${withPic.image_path} HTTP ${pr.status}`);
  await row.getByRole('button', { name: 'Hide', exact: true }).click(); await page.getByText(/is now hidden/).first().waitFor();
  await noOverflow('product options');
  // roller's mode group is tied to code: no add form
  await page.getByRole('button', { name: 'Back to products' }).click();
  await page.getByRole('button', { name: 'Roller Shades' }).first().click(); await page.getByRole('tab', { name: 'Options' }).click();
  check('a group tied to the site\'s code (roller mode) has no "Add an option" form', (await page.locator('.adm-card', { has: page.getByRole('heading', { name: /^Single or double-stack/ }) }).locator('.adm-subcard').count()) === 0);
  // size rules
  await page.getByRole('button', { name: 'Back to products' }).click();
  await page.getByRole('button', { name: 'Roman Shades' }).first().click(); await page.getByRole('tab', { name: 'Size rules' }).click();
  await page.getByText('Limits from the supplier price grids').waitFor();
  const limTxt = await page.locator('.adm-card', { has: page.getByRole('heading', { name: /Limits from the supplier/ }) }).innerText();
  check('Roman size limits come from the grids (width 23–94, drop 24–104 for cord and motor)', /23–94/.test(limTxt) && /24–104/.test(limTxt) && /24–96/.test(limTxt) && /From grid/.test(limTxt), limTxt.replace(/\s+/g, ' ').slice(0, 260));
  await page.getByRole('button', { name: 'Add a size rule' }).click(); await page.getByText('Rule added (unverified).').waitFor();
  const rule = page.locator('.adm-card', { has: page.getByText('Unverified').first() }).last();
  await rule.getByLabel(/Who it is about/).fill('Zz cordless Roman shades');
  await rule.getByLabel('Max width (in)').fill('94');
  await rule.getByRole('checkbox', { name: /Cordless spring/ }).check();
  check('the customer message is written from the rule ("… can be up to 94 in wide.")', /Zz cordless Roman shades can be up to 94 in wide\./.test(await rule.locator('.adm-preview').innerText()), await rule.locator('.adm-preview').innerText());
  await rule.getByRole('button', { name: 'Save rule' }).click(); await page.getByText(/Size rule saved/).waitFor();
  const sr = (await api('GET', `/rest/v1/size_rules?subject=eq.${encodeURIComponent('Zz cordless Roman shades')}`, svc)).body[0];
  check('a saved size rule is unverified until you confirm it', sr && sr.verified === false && Number(sr.max_width) === 94 && JSON.stringify(sr.when_values) === '{"control":["cordless"]}', JSON.stringify(sr));
  await noOverflow('size rules'); await page.screenshot({ path: `${OUT}/p2-sizes.png`, fullPage: true });

  // ------------------------------------------------------------ Pricing
  await menu('Pricing'); await page.getByRole('heading', { name: 'Pricing', exact: true }).waitFor();
  await page.getByText('Customer would see').waitFor();
  const shown = await page.locator('.adm-price-big').innerText();
  const first = (await api('GET', '/rest/v1/fabrics?product_line=eq.roller&order=sort_order&limit=1&select=id', svc)).body[0].id;
  const wantA = await api('POST', '/rest/v1/rpc/estimate_price', H(ANON, tok.body.access_token), { p_line: 'roller', p_fabric_id: first, p_options: { control: 'chain', mode: 'single' }, p_width: 40, p_height: 60 });
  check('price checker (roller, first collection, chain, 40 x 60) shows the same price a customer gets', shown.replace(/\D/g, '') === String(wantA.body.price), `${shown} vs ${wantA.body.price}`);
  const bt = await page.locator('.adm-kv').first().innerText();
  check('the breakdown shows the price group, the grid, the sheet cell, the cost, the adders, the markup and the final price', /Price group/.test(bt) && /Roller shades-cord!\w+\d+/.test(bt) && /Cost from the grid/.test(bt) && /Markup\s+50%/.test(bt) && /Customer price/.test(bt), bt.replace(/\s+/g, ' ').slice(0, 300));
  await noOverflow('price checker'); await page.screenshot({ path: `${OUT}/p3-checker.png`, fullPage: true });
  // price checker: one search box finds a color by name or code and fills in the line, price group and color
  await page.getByLabel(/Find a color/).fill('ZDS3001-17');
  await page.getByRole('listbox', { name: 'Matching colors' }).getByRole('option').first().waitFor();
  const hit = await page.getByRole('listbox', { name: 'Matching colors' }).getByRole('option').first().innerText();
  check('searching by code ZDS3001-17 lists the color with its line and price group (admin only)', /Anchor Gray/i.test(hit) && /Sunflower/.test(hit) && /Dream Curtains/.test(hit) && /price group/i.test(hit), hit.replace(/\s+/g, ' '));
  await page.getByRole('listbox', { name: 'Matching colors' }).getByRole('option').first().getByRole('button').click();
  check('choosing a result fills in the line', (await page.getByLabel('Product line').inputValue()) === 'dream-curtains', await page.getByLabel('Product line').inputValue());
  await page.locator('.adm-search').getByText(/Pricing\s+Anchor Gray/).waitFor();
  check('the chosen color and price group are shown', /Pricing\s+Anchor Gray/i.test(await page.locator('.adm-search').innerText()), (await page.locator('.adm-search').innerText()).replace(/\s+/g, ' ').slice(-160));
  const byCode = await (async () => { await page.getByLabel(/Find a color/).fill('xss'); await page.getByRole('listbox', { name: 'Matching colors' }).getByRole('option').first().waitFor(); return page.getByRole('listbox', { name: 'Matching colors' }).getByRole('option').count(); })();
  check('searching by a supplier code works', byCode > 0, `${byCode} results for "xss"`);
  await page.getByLabel(/Find a color/).fill('');
  // dream curtains motor: from the supplier, +$100
  await page.getByLabel('Control').selectOption('remote');   // Dream Curtains keeps its remote and Matter motors
  await page.getByLabel('Width (in)').fill('100'); await page.getByLabel('Height / drop (in)').fill('100');
  await page.getByText('from the supplier').first().waitFor();
  const dtxt = await page.locator('.adm-kv').first().innerText();
  check('the breakdown shows the price group and the extra cost apart', /Price group\s+Sunflower/.test(dtxt) && /Extra cost\s+\+\$0\.00/.test(dtxt) && /Price before extra cost/.test(dtxt), dtxt.replace(/\s+/g, ' ').slice(0, 200));
  check('Dream Curtains motor shows the +$100 adder marked "from the supplier"', /\+\$100/.test(dtxt) && /from the supplier/.test(dtxt), dtxt.replace(/\s+/g, ' ').slice(0, 300));
  // option labels show the customer amount, not the supplier cost
  await page.getByLabel('Product line').selectOption('roller');
  await page.getByLabel(/Find a color/).fill('XSS000105'); await page.getByRole('listbox', { name: 'Matching colors' }).getByRole('option').first().getByRole('button').click();
  await page.getByLabel('Control').selectOption('chain');
  await page.getByLabel('Width (in)').fill('40'); await page.getByLabel('Height / drop (in)').fill('64');
  await page.getByText(/No fabric wrap on the cassette \(−\$4 on the customer price/).waitFor();
  check('"No fabric wrap on the cassette" shows its customer effect (−$4), not the cost (−$3)', true, await page.locator('.adm-bar').first().innerText());
  // cellular double: a size outside
  await page.getByLabel('Product line').selectOption('roller');
  await page.getByLabel('Width (in)').fill('500');
  await page.getByText(/Custom size, we’ll quote it/).first().waitFor();
  check('a size past the grid shows "Custom size, we\'ll quote it" with the reason', /past the largest value/.test(await page.locator('.adm-result').innerText()), (await page.locator('.adm-result').innerText()).replace(/\s+/g, ' '));
  // markups
  await page.getByRole('tab', { name: 'Markups' }).click(); await page.getByRole('heading', { name: 'Markup per product line' }).waitFor();
  check('markups: eight lines at 50%', (await page.locator('input[aria-label^="Markup % for"]').evaluateAll((els) => els.map((e) => e.value))).every((v) => v === '50'), 'all 50');
  await noOverflow('markups');
  // grids
  await page.getByRole('tab', { name: 'Grids' }).click(); await page.getByText(/\d+ grids/).first().waitFor();
  await page.locator('.adm-table tbody tr').first().getByRole('button', { name: 'View' }).click();
  await page.locator('.adm-grid').waitFor();
  check('grid viewer shows the axes, the cells and the roll widths (sheet vs ours)', (await page.locator('.adm-grid td').count()) > 500 && (await page.locator('td[data-label="Roll: sheet"]').count()) > 0 && (await page.locator('td[data-label="Roll: ours"]').count()) > 0, `${await page.locator('.adm-grid td').count()} cells`);
  await page.screenshot({ path: `${OUT}/p4-grid.png`, fullPage: true });
  await page.getByLabel('Line').selectOption('dream-curtains'); await page.getByRole('button', { name: 'View' }).first().click(); await page.locator('.adm-grid').waitFor();
  check('Dream Curtains grid: the 115 in price dip is highlighted', (await page.locator('.adm-grid td.is-dip').count()) >= 42, `${await page.locator('.adm-grid td.is-dip').count()} highlighted cells`);
  // adders and flags
  await page.getByRole('tab', { name: /Adders/ }).click(); await page.getByRole('heading', { name: /Things to confirm/ }).waitFor();
  const ft = await page.locator('.adm-flags').innerText();
  check('flags list the supplier questions (axis orientation, double-stack, Day & Night, Dream motor placeholder)', /Which sheet axis is the width/.test(ft) && /Double-stack/.test(ft) && /Day & Night/.test(ft) && /Motor cost/i.test(ft), ft.length + ' chars');
  const at = (await page.locator('.adm-table').last().innerText()) + ' ' + (await page.locator('input[aria-label^="Amount for"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label')} = ${e.value}`).join(' ; ')));
  const parts = { wraps: /No fabric wrap on the cassette/i, motor70: /Motor \(any type[^=]*= 70/i, solar30: /Solar panel[^=]*= 30/i, woven: /No coating/i, dream: /not in the supplier sheet/i };
  const missing = Object.entries(parts).filter(([, re]) => !re.test(at)).map(([k]) => k);
  check('adders include roller wraps, the $70 motor, the $30 solar panel, woven wood, and the Dream motor', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}; text: ${at.replace(/\s+/g, ' ').slice(0, 400)}` : 'all present');
  await noOverflow('adders and flags');
  // re-import: an unchanged workbook shows nothing to apply; dream curtains has the "--" tab
  await page.getByRole('tab', { name: 'Re-import' }).click();
  for (const f of ['zebra', 'roman', 'dream-curtains']) {
    if (!existsSync(`${SHEETS}/${f}.xlsx`)) { check(`re-import ${f}`, false, 'workbook missing'); continue; }
    await page.locator('input[type=file]').first().setInputFiles(`${SHEETS}/${f}.xlsx`);
    await page.getByRole('heading', { name: /^Preview:/ }).waitFor();
    const pv = await page.locator('.adm-card', { has: page.getByRole('heading', { name: /^Preview:/ }) }).innerText();
    check(`re-import preview of the unchanged ${f} workbook: nothing to apply`, /0 new grids/.test(pv) && /0 grids changed/.test(pv) && /Nothing changed/.test(pv), pv.replace(/\s+/g, ' ').slice(0, 200));
  }
  await noOverflow('re-import');
  await ctx.close();
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser?.close();
  await api('DELETE', '/rest/v1/option_values?code=eq.zz-test-control', svc);
  await api('DELETE', `/rest/v1/size_rules?subject=eq.${encodeURIComponent('Zz cordless Roman shades')}`, svc);
  if (files.length) await api('DELETE', '/storage/v1/object/option-images', svc, { prefixes: files });
  for (const id of adminRows) await api('DELETE', `/rest/v1/admins?id=eq.${id}`, svc);
  for (const id of users) await api('DELETE', `/auth/v1/admin/users/${id}`, svc);
  const left = { users: (await Promise.all(users.map((id) => api('GET', `/auth/v1/admin/users/${id}`, svc)))).map((r) => r.status), options: (await api('GET', '/rest/v1/option_values?code=eq.zz-test-control&select=id', svc)).body.length, rules: (await api('GET', `/rest/v1/size_rules?subject=like.*Zz*&select=id`, svc)).body.length };
  console.log(`\nclean-up: ${JSON.stringify(left)}`);
  results.push({ name: 'clean-up left nothing behind', ok: left.users.every((s) => s === 404) && !left.options && !left.rules });
}
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ' | FAILED: ' + bad.map((x) => x.name).join('; ') : ''}`);
process.exit(bad.length ? 1 : 0);
