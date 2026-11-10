// Admin: Products > Colors > a color has "Texture type" (measured from the photo, overridable) and "Texture source" (Generated / Photo) with a small live preview, and a
// Zebra color has its solid and sheer band widths (defaults 3 in and 2 in). A temporary admin signs in through the API. The swatch update is intercepted
// (nothing real is changed) and the answer carries the migration-24 columns, so this runs before migration 24 is applied; the photos are read from the
// live bucket (staging has none). What the editor would have sent is checked.
import { guard } from './lib/liveGuard.mjs';       // every write is checked: a test may only change what it created (see lib/liveGuard.mjs)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE = process.env.LB_LIVE_URL || URL_;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
let userId, adminRowId, browser;
try {
  const email = `zz-tx-${Date.now()}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  userId = (await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true })).body.id;
  const tok = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password })).body;
  adminRowId = (await api('POST', '/rest/v1/admins', H(SVC), { email, user_id: userId })).body[0].id;
  browser = await chromium.launch(); guard.wrapBrowser(browser);
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(tok)]);
  const page = await ctx.newPage(); page.setDefaultTimeout(25000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const patches = [];
  await page.route('**/rest/v1/swatches*', async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') { patches.push(JSON.parse(req.postData() || '{}')); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ id: 'mock' }]) }); }
    if (req.method() === 'GET') { const res = await route.fetch(); let rows; try { rows = await res.json(); } catch { return route.fulfill({ response: res }); } if (Array.isArray(rows)) rows = rows.map((r) => ({ texture_mode: null, texture_type: null, texture_source: null, weave: null, weave_strength: null, zebra_solid_in: null, zebra_sheer_in: null, preview_color: null, ...r })); return route.fulfill({ response: res, body: JSON.stringify(rows), headers: { ...res.headers(), 'content-length': undefined } }); }
    return route.continue();
  });
  const linePatches = [];
  await page.route('**/rest/v1/product_lines*', async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') { linePatches.push(JSON.parse(req.postData() || '{}')); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ id: 'zebra' }]) }); }
    if (req.method() === 'GET') { const res = await route.fetch(); let rows; try { rows = await res.json(); } catch { return route.fulfill({ response: res }); } if (Array.isArray(rows)) rows = rows.map((r) => ({ band_solid_in: null, band_sheer_in: null, ...r })); return route.fulfill({ response: res, body: JSON.stringify(rows), headers: { ...res.headers(), 'content-length': undefined } }); }
    return route.continue();
  });
  if (new URL(URL_).host !== new URL(LIVE).host) await page.route(`${URL_}/storage/v1/object/public/swatches/**`, async (route) => { const r = await fetch(route.request().url().replace(URL_, LIVE)); route.fulfill({ status: r.status, body: Buffer.from(await r.arrayBuffer()), headers: { 'content-type': r.headers.get('content-type') || 'image/jpeg', 'access-control-allow-origin': '*' } }); });
  const edit = async (code, heading) => { await page.goto(`${BASE}/admin`); await page.getByRole('heading', { name: 'Colors', exact: true }).waitFor(); await page.getByLabel('Search name or code').fill(code); await page.waitForTimeout(400); await page.getByRole('button', { name: heading }).first().click(); await page.getByRole('heading', { name: heading.source ? heading : heading }).first().waitFor(); };
  const prev = () => page.getByLabel('Texture preview');
  const ready = async () => { await page.waitForFunction(() => document.querySelector('canvas[aria-label="Texture preview"]')?.dataset.ready === '1'); await page.waitForTimeout(300); };
  const mode = () => prev().getAttribute('data-mode'), hexOf = () => prev().getAttribute('data-color');
  const solidShare = () => prev().evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, half = c.height / 2, L = []; for (let y = 0; y < half; y++) { let t = 0; for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; t += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; } L.push(t / c.width); } const mid = (Math.max(...L) + Math.min(...L)) / 2; return L.filter((v) => v < mid).length / L.length; });

  // ---- the Zebra line: one default for every color ----
  await page.goto(`${BASE}/admin`); await page.getByRole('heading', { name: 'Colors', exact: true }).waitFor();
  await page.locator('.adm-nav-item', { hasText: /^Products/ }).click(); await page.getByRole('heading', { name: 'Products' }).waitFor();
  await page.getByRole('button', { name: 'Zebra / Dual Shades' }).first().click();
  const lsolid = page.getByLabel('Line solid band width in inches'), lsheer = page.getByLabel('Line sheer band width in inches');
  await lsolid.waitFor();
  check('Products > Zebra has "Zebra bands": the line\'s default solid and sheer widths, empty with 3 and 2 as hints', (await lsolid.inputValue()) === '' && (await lsolid.getAttribute('placeholder')) === '3' && (await lsheer.getAttribute('placeholder')) === '2');
  await lsolid.fill('0');
  check('a bad width (0) shows an error and blocks Save', /between 0.5 and 12/.test(await page.getByTestId('line-bands').innerText()) && await page.getByRole('button', { name: 'Save band widths' }).isDisabled());
  await lsolid.fill('4'); await lsheer.fill('1.5'); await page.getByRole('button', { name: 'Save band widths' }).click(); await page.getByText(/Saved the band widths/).waitFor();
  check('Save sends the two line defaults to the zebra line only', linePatches.length === 1 && linePatches[0].band_solid_in === 4 && linePatches[0].band_sheer_in === 1.5 && Object.keys(linePatches[0]).length === 2, JSON.stringify(linePatches));
  // the answer from now on carries those defaults (as the database would)
  await page.unroute('**/rest/v1/product_lines*');
  await page.route('**/rest/v1/product_lines*', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') { const res = await route.fetch(); let rows; try { rows = await res.json(); } catch { return route.fulfill({ response: res }); } if (Array.isArray(rows)) rows = rows.map((r) => ({ band_solid_in: r.id === 'zebra' ? 4 : null, band_sheer_in: r.id === 'zebra' ? 1.5 : null, ...r })).map((r) => (r.id === 'zebra' ? { ...r, band_solid_in: 4, band_sheer_in: 1.5 } : r)); return route.fulfill({ response: res, body: JSON.stringify(rows), headers: { ...res.headers(), 'content-length': undefined } }); }
    return route.continue();
  });

  // ---- a Zebra color: always the pattern, optional own widths over the line's default ----
  patches.length = 0;
  await edit('YZB210', /Truffle Brown/);
  await ready();
  check('Zebra: the Texture field shows a live preview drawn from the photo\'s solid band (generated by type), with the Texture type choice and Generated / Photo', (await mode()) === 'pattern' && (await page.getByLabel('Texture type').count()) === 1 && (await page.getByRole('radio', { name: 'Generated' }).isChecked()) && (await page.getByRole('radio', { name: 'Photo' }).count()) === 1);
  const solid = page.getByLabel('Solid band width in inches'), sheer = page.getByLabel('Sheer band width in inches');
  check('the color\'s own boxes are empty and show the LINE\'s default (4 and 1.5) as hints; the preview already shows 4 in solid of every 5.5 (73 %)', (await solid.inputValue()) === '' && (await solid.getAttribute('placeholder')) === '4' && (await sheer.getAttribute('placeholder')) === '1.5' && Math.abs((await solidShare()) - 4 / 5.5) < 0.05, String(await solidShare()));
  await solid.fill('2'); await page.waitForTimeout(800); await ready();
  check('typing 2 in solid for this color redraws the preview live (2 of 3.5 = 57 %: its own solid width, the line\'s sheer width)', Math.abs((await solidShare()) - 2 / 3.5) < 0.05, String(await solidShare()));
  await solid.fill('0'); await page.waitForTimeout(300);
  check('an out-of-range width (0) shows an error and blocks Save', /between 0.5 and 12/.test(await page.getByTestId('texture-field').innerText()) && await page.getByRole('button', { name: 'Save changes' }).isDisabled());
  await solid.fill('2');
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.getByText(/Saved “Truffle Brown”/).waitFor();
  check('Save sends only the override that was typed (solid 2; the empty sheer box and the type are left alone), to this color only', patches.length === 1 && patches[0].zebra_solid_in === 2 && !('texture_type' in patches[0]) && !('texture_source' in patches[0]) && !('zebra_sheer_in' in patches[0]), JSON.stringify(patches));

  // ---- a roller color with a flat photo: Smooth, Generated by default; switch to Photo, change the type ----
  patches.length = 0;
  await edit('YS180006', /Jet Black/);
  await ready();
  await page.getByText(/Measured: /).waitFor();
  const radios = page.getByRole('radiogroup', { name: 'Texture source' }), tsel = page.getByLabel('Texture type');
  check('Roller Jet Black: Texture type is Automatic (measured), source is Generated by default, preview is the generated cloth', (await radios.count()) === 1 && /^Automatic: /.test(await tsel.locator('option').first().innerText()) && await page.getByRole('radio', { name: 'Generated' }).isChecked() && (await mode()) === 'pattern');
  const photoHex = await hexOf();
  await page.getByRole('radio', { name: 'Photo' }).check(); await page.waitForTimeout(700); await ready();
  check('choosing Photo redraws the preview from the photo crop in the very same color', (await mode()) === 'photo' && (await hexOf()) === photoHex, `${photoHex} -> ${await hexOf()}`);
  check('it says the choice was made by hand and offers "Use the type\'s default"', /Set by hand/.test(await page.getByTestId('texture-field').innerText()) && (await page.getByRole('button', { name: /Use the type/ }).count()) === 1);
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.getByText(/Saved “Jet Black”/).waitFor();
  check('Save sends only texture_source photo', patches.length === 1 && Object.keys(patches[0]).join() === 'texture_source' && patches[0].texture_source === 'photo', JSON.stringify(patches));
  patches.length = 0;
  await edit('YS180006', /Jet Black/); await ready();
  await page.getByRole('radio', { name: 'Generated' }).check(); await page.getByLabel('Texture type').selectOption('twill'); await page.waitForTimeout(700); await ready();
  check('choosing the type Twill redraws the preview in the same color and says so', (await hexOf()) === photoHex && (await prev().getAttribute('data-type')) === 'twill' && /Set by hand/.test(await page.getByTestId('texture-field').innerText()));
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.getByText(/Saved “Jet Black”/).waitFor();
  check('Save sends texture_type twill (and texture_source generated)', patches.length === 1 && patches[0].texture_type === 'twill' && patches[0].texture_source === 'generated', JSON.stringify(patches));

  // ---- Weave strength: a slider per color, Auto by default ----
  patches.length = 0;
  await edit('YS180006', /Jet Black/); await ready();
  const spread = () => prev().evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, L = []; for (let i = 0; i < d.length; i += 4) L.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]); const m = L.reduce((a, b) => a + b, 0) / L.length; return Math.sqrt(L.reduce((a, b) => a + (b - m) ** 2, 0) / L.length); });
  const slider = page.getByLabel('Weave strength', { exact: true }), auto = page.getByLabel('Weave strength auto');
  check('Weave strength: shown with Auto ticked and the slider off (the default is auto)', (await slider.count()) === 1 && await auto.isChecked() && await slider.isDisabled() && /Auto/.test(await page.getByTestId('weave-strength').innerText()));
  const sdAuto = await spread();
  await auto.uncheck(); await page.waitForTimeout(300);
  check('unticking Auto starts the slider at 100 % of auto (the picture does not change)', await slider.isEnabled() && /100 % of auto/.test(await page.getByTestId('weave-strength').innerText()) && Math.abs((await spread()) - sdAuto) < 1.5, `${sdAuto.toFixed(1)} -> ${(await spread()).toFixed(1)}`);
  await slider.fill('2'); await page.waitForTimeout(800); await ready();
  const sdStrong = await spread();
  check('200 % of auto redraws the preview with a stronger weave (more contrast), in the same average color', sdStrong > sdAuto * 1.15 && (await hexOf()) === photoHex, `${sdAuto.toFixed(1)} -> ${sdStrong.toFixed(1)}`);
  await slider.fill('0'); await page.waitForTimeout(800); await ready();
  const sdFlat = await spread();
  check('0 % flattens the weave (almost no contrast left)', sdFlat < sdAuto * 0.25, `${sdAuto.toFixed(1)} -> ${sdFlat.toFixed(1)}`);
  await auto.check(); await page.waitForTimeout(300);
  check('ticking Auto again goes back to the photo\'s own weave', await slider.isDisabled() && Math.abs((await spread()) - sdAuto) < 1.5);
  await auto.uncheck(); await slider.fill('2');
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.getByText(/Saved “Jet Black”/).waitFor();
  check('Save sends weave_strength 2 and nothing else', patches.length === 1 && patches[0].weave_strength === 2 && Object.keys(patches[0]).join() === 'weave_strength', JSON.stringify(patches));
  patches.length = 0;

  // ---- a cellular color whose photo is pleated: Generated by default ----
  patches.length = 0;
  await edit('YHCKB001', /Beige Linen/);
  await ready();
  await page.getByText(/Measured: /).waitFor();
  check('Cellular Beige Linen (pleated photo): Generated, preview is the generated cloth', await page.getByRole('radio', { name: 'Generated' }).isChecked() && (await mode()) === 'pattern');
  // the Weave choice for a Pattern color
  const wsel = page.getByLabel('Weave', { exact: true });
  check('a Generated color offers a Weave choice, Automatic first (drawn from the photo)', (await wsel.count()) === 1 && /Automatic: drawn from the photo/.test(await wsel.locator('option').first().innerText()));
  const wbefore = await prev().evaluate((c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice(0, 4000).join());
  await wsel.selectOption('voile'); await page.waitForTimeout(800); await ready();
  const alphaSeen = await prev().evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let open = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 120) open++; return open / (d.length / 4); });
  check('choosing the sheer open weave redraws the preview with see-through gaps (30 to 50 % open) in the same color', alphaSeen > 0.25 && alphaSeen < 0.55 && (await prev().evaluate((c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice(0, 4000).join())) !== wbefore, alphaSeen.toFixed(2));
  patches.length = 0;
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.getByText(/Saved “Beige Linen”/).waitFor();
  check('Save sends the weave (voile)', patches.length === 1 && patches[0].weave === 'voile', JSON.stringify(patches));
  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser?.close();
if (adminRowId) await api('DELETE', `/rest/v1/admins?id=eq.${adminRowId}`, H(SVC));
if (userId) await api('DELETE', `/auth/v1/admin/users/${userId}`, H(SVC));
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
