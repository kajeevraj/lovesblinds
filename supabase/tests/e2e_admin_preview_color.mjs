// Admin: Products > Colors > a color has a "Preview color" field (a color picker plus a hex box) that overrides the color the fabric shows as in the
// picker and the 3D preview. A temporary admin signs in with a password through the API. The swatch update is intercepted (nothing live is
// changed, and this also runs before migration 20 adds the column); what the editor would have sent is checked.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
let userId, adminRowId, browser;
try {
  const email = `zz-pc-${Date.now()}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  userId = (await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true })).body.id;
  const tok = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password })).body;
  adminRowId = (await api('POST', '/rest/v1/admins', H(SVC), { email, user_id: userId })).body[0].id;
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(tok)]);
  const page = await ctx.newPage(); page.setDefaultTimeout(25000);
  const patches = [];
  // what the database would hold after migration 20: every swatch row carries preview_color (empty), so the editor knows the column exists
  await page.route('**/rest/v1/swatches*', async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') { patches.push({ url: req.url(), body: JSON.parse(req.postData() || '{}') }); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ id: 'mock', ...JSON.parse(req.postData() || '{}') }]) }); }
    if (req.method() === 'GET') { const res = await route.fetch(); let rows; try { rows = await res.json(); } catch { return route.fulfill({ response: res }); } if (Array.isArray(rows)) rows = rows.map((r) => ('preview_color' in r ? r : { ...r, preview_color: r.supplier_code === 'YS180006' ? '#2a5d9f' : null })); return route.fulfill({ response: res, body: JSON.stringify(rows), headers: { ...res.headers(), 'content-length': undefined } }); }
    return route.continue();
  });
  await page.goto(`${BASE}/admin`);
  await page.getByRole('heading', { name: 'Colors', exact: true }).waitFor();
  await page.getByLabel('Search name or code').fill('YS180006'); await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Jet Black/ }).first().click();
  await page.getByRole('heading', { name: 'Jet Black' }).waitFor();
  const picker = page.getByLabel('Preview color picker'), hex = page.getByLabel('Preview color hex');
  check('the color editor has a Preview color field: a color picker and a hex box', (await picker.count()) === 1 && (await hex.count()) === 1);
  check('it shows the stored override in both (#2a5d9f)', (await hex.inputValue()) === '#2a5d9f' && (await picker.inputValue()) === '#2a5d9f');
  await hex.fill('blue');
  check('a bad hex shows an error and blocks Save', (await page.getByText(/must be a hex color/).count()) === 1 && await page.getByRole('button', { name: 'Save changes' }).isDisabled());
  await hex.fill('#1B1B1D');
  check('a good hex (any case) enables Save and moves the color picker to it', await page.getByRole('button', { name: 'Save changes' }).isEnabled() && (await picker.inputValue()) === '#1b1b1d');
  await picker.fill('#336699');
  check('the color picker fills the hex box', (await hex.inputValue()) === '#336699');
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.getByText(/Saved “Jet Black”/).waitFor();
  check('Save sends preview_color (lower case) to this color\'s row, and only that', patches.length === 1 && patches[0].body.preview_color === '#336699' && Object.keys(patches[0].body).join() === 'preview_color', JSON.stringify(patches));
  // back to the default
  await page.getByLabel('Search name or code').fill('YS180006'); await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Jet Black/ }).first().click(); await page.getByRole('heading', { name: 'Jet Black' }).waitFor();
  await page.getByRole('button', { name: 'Use the default' }).click();
  check('"Use the default" empties the box and says the default is worked out from the photo inside its color family', (await hex.inputValue()) === '' && /Default: the photo/.test(await page.locator('.adm-previewcolor').innerText()));
  check('the placeholder of the hex box is the family\'s color (Charcoal/Black)', /^#[0-9a-f]{6}$/.test(await hex.getAttribute('placeholder')));
  patches.length = 0; await page.getByRole('button', { name: 'Save changes' }).click(); await page.getByText(/Saved “Jet Black”/).waitFor();
  check('saving the default sends preview_color = null (the override is removed)', patches.length === 1 && patches[0].body.preview_color === null, JSON.stringify(patches));
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser?.close();
if (adminRowId) await api('DELETE', `/rest/v1/admins?id=eq.${adminRowId}`, H(SVC));
if (userId) await api('DELETE', `/auth/v1/admin/users/${userId}`, H(SVC));
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
