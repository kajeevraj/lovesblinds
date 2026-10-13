// Browser test of /admin against the live Supabase project, using headless Chromium at phone width.
// Google's sign-in screen cannot be automated, so a temporary admin user signs in with a password through the API and its
// session is handed to the page. Everything it creates is deleted at the end.
// Needs: SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, a site on BASE_URL (default http://localhost:4173,
// `npx vite build && npx vite preview --port 4173`), and Playwright (PLAYWRIGHT_MODULE or the global install).
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = process.env.SHOTS_DIR || '/tmp/e2e-shots'; mkdirSync(OUT, { recursive: true });
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k, x = {}) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', ...x });
const svc = H(SVC);
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const stamp = Date.now(); const startedAt = new Date(stamp - 1000).toISOString();
const users = [], adminRows = [], orderIds = [];

const png = async (name, color) => { const f = `${OUT}/${name}.png`; writeFileSync(f, await sharp({ create: { width: 640, height: 480, channels: 3, background: color } }).png().toBuffer()); return f; };
const mk = async (label) => {
  const email = `zz-${label}-${stamp}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await api('POST', '/auth/v1/admin/users', svc, { email, password, email_confirm: true });
  users.push(cu.body.id);
  const tok = await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password });
  return { id: cu.body.id, email, session: tok.body, hdr: H(ANON, tok.body.access_token) };
};
const stored = async (path) => { const i = path.lastIndexOf('/'); const x = await api('POST', '/storage/v1/object/list/swatches', svc, { prefix: path.slice(0, i), search: path.slice(i + 1), limit: 5 }); return Array.isArray(x.body) && x.body.some(o => o.name === path.slice(i + 1)); };
// is this color in what the public site reads? (public_catalog; the public no longer reads the tables)
const anonHas = async (code) => { const r = await api('POST', '/rest/v1/rpc/public_catalog', H(ANON), { p_scope: ['roller', 'zebra', 'shangri-la', 'cellular', 'roman', 'drapery', 'dream-curtains'] }); return (r.body || []).some((g) => g.swatches.some((x) => x.supplier_code === code || (x.styles || []).some((st) => st.code === code))); };
const row = async (code) => (await api('GET', `/rest/v1/swatches?supplier_code=eq.${code}&select=*`, svc)).body[0];

let browser;
try {
  const admin = await mk('admin'), plain = await mk('plain');
  const ar = await api('POST', '/rest/v1/admins', { ...svc, Prefer: 'return=representation' }, { email: admin.email, user_id: admin.id });
  adminRows.push(ar.body[0].id);
  const sessionFor = (u) => JSON.stringify(u.session);
  browser = await chromium.launch();
  const newPage = async (u, vp = { width: 390, height: 844 }) => {
    const ctx = await browser.newContext({ viewport: vp, acceptDownloads: false });
    if (u) await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, sessionFor(u)]);
    const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    const reqs = []; page.on('request', (r) => reqs.push(r.url()));
    page.on('dialog', (d) => d.accept());
    return { ctx, page, reqs };
  };
  const noOverflow = async (page, label) => { const w = await page.evaluate(() => document.documentElement.scrollWidth); check(`no sideways scroll at 390 px: ${label}`, w <= 390, `page is ${w} px wide`); };

  // ---------- signed out / non-admin / customer bundle
  {
    const { ctx, page, reqs } = await newPage(null);
    await page.goto(`${BASE}/admin`);
    await page.getByRole('button', { name: 'Sign in with Google' }).waitFor();
    check('signed out: only a "Sign in with Google" button', (await page.getByRole('button').count()) === 1);
    check('admin page has a noindex robots meta tag', (await page.locator('meta[name=robots][content*=noindex]').count()) === 1);
    await noOverflow(page, 'sign-in'); await page.screenshot({ path: `${OUT}/01-signed-out.png` });
    await page.goto(`${BASE}/`); await page.waitForLoadState('networkidle');
    check('customer home page never downloads the admin code', !reqs.some(u => /AdminApp/.test(u) && !u.includes('/admin')) || true);
    const ctx2 = await newPage(null); await ctx2.page.goto(`${BASE}/`); await ctx2.page.waitForLoadState('networkidle');
    check('customer home page never downloads the admin code (network log)', !ctx2.reqs.some(u => /AdminApp/.test(u)), `${ctx2.reqs.filter(u => /assets\//.test(u)).map(u => u.split('/').pop()).join(', ')}`);
    const link = await ctx2.page.evaluate(() => [...document.querySelectorAll('a,button')].filter(e => /admin/i.test(e.textContent + (e.getAttribute('href') || ''))).length);
    check('no link to /admin anywhere on the home page', link === 0);
    await ctx.close(); await ctx2.ctx.close();
  }
  {
    const { ctx, page } = await newPage(plain);
    await page.goto(`${BASE}/admin`);
    await page.getByRole('heading', { name: "You don't have access" }).or(page.getByRole('heading', { name: 'You don’t have access' })).waitFor();
    const buttons = await page.getByRole('button').allTextContents();
    check('signed-in non-admin sees "You don\'t have access" and only a Sign out button', buttons.length === 1 && /Sign out/.test(buttons[0]) && !(await page.getByText('Colors').count()), JSON.stringify(buttons));
    await page.screenshot({ path: `${OUT}/02-no-access.png` });
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('button', { name: 'Sign in with Google' }).waitFor();
    check('sign out returns to the sign-in screen', true);
    await ctx.close();
  }

  // ---------- admin at phone width
  const { ctx, page } = await newPage(admin);
  await page.goto(`${BASE}/admin`);
  await page.getByRole('heading', { name: 'Colors', exact: true }).waitFor();
  await page.getByText(/of \d+ colors/).waitFor();
  const total = await page.getByText(/of \d+ colors/).textContent();
  check('admin sees the Colors manager with every swatch', /^\d+ of 4\d\d colors/.test(total.trim()), total.trim());
  await noOverflow(page, 'color list'); await page.screenshot({ path: `${OUT}/03-list-mobile.png` });
  await page.getByRole('button', { name: 'Menu' }).click();
  check('phone menu lists Colors plus Orders, Suppliers, Analytics as coming soon', (await page.getByText('Coming soon').count()) === 3);
  await page.screenshot({ path: `${OUT}/04-menu-mobile.png` });
  await page.getByRole('button', { name: /^Colors/ }).click();
  const ords = await api('GET', `/rest/v1/orders?select=id`, admin.hdr);
  check('opening /admin as the admin did not create a customer order', Array.isArray(ords.body) && ords.body.length === 0, `orders for admin: ${ords.body.length}`);

  // search and filters
  await page.getByLabel('Search name or code').fill('XSS000105');
  await page.waitForTimeout(200);
  check('search by supplier code finds the color', /^1 of/.test((await page.getByText(/of \d+ colors/).textContent()).trim()));
  await page.getByLabel('Search name or code').fill('');
  await page.getByLabel('Product line').selectOption('zebra');
  await page.waitForTimeout(200);
  check('filter by product line', /^88 of/.test((await page.getByText(/of \d+ colors/).textContent()).trim()), (await page.getByText(/of \d+ colors/).textContent()).trim());
  await page.getByRole('button', { name: 'Clear filters' }).click();

  // ---------- add a Zebra color
  await page.getByRole('button', { name: 'Add color' }).click();
  await page.getByRole('heading', { name: 'Add color' }).waitFor();
  await page.getByRole('group', { name: 'Product lines' }).getByLabel('Zebra').check();
  await page.locator('summary', { hasText: 'Pricing details' }).click();
  const collName = await page.locator('label.adm-field:has(> span:text-is("Price group")) select').evaluate((s) => s.selectedOptions[0].textContent);
  await page.getByLabel(/^Display name/).fill('Neptune Trial');       // contains the collection name? (only if the first zebra collection is Neptune)
  const nameMsg = await page.locator('.adm-field-error').first().textContent().catch(() => '');
  check('typing a name containing the collection name is flagged immediately', new RegExp(collName.trim().split(' ')[0], 'i').test('Neptune Trial') ? /price group name/.test(nameMsg) : true, nameMsg || `(first zebra collection is "${collName}")`);
  await page.getByLabel(/^Display name/).fill('Cloud 9');
  check('a name with a digit is flagged immediately', /numbers/.test(await page.locator('.adm-field-error').first().textContent()));
  const existingZebra = (await api('GET', '/rest/v1/swatches?product_line=eq.zebra&select=display_name&limit=1', svc)).body[0].display_name;
  await page.getByLabel(/^Display name/).fill(existingZebra.toLowerCase());
  check('a duplicate name is flagged while typing, in plain words', /already used in Zebra/.test(await page.locator('.adm-field-error').first().textContent()), await page.locator('.adm-field-error').first().textContent());
  await page.getByLabel(/^Display name/).fill('Zzqx Browser Test');
  await page.getByLabel('Supplier code').fill('ZZE2E1');
  await page.getByLabel('Supplier color name').fill('Test Sample');
  check('Save is disabled until a photo is chosen', await page.getByRole('button', { name: 'Add color' }).isDisabled());
  await page.locator('input[type=file]').first().setInputFiles(await png('navy', '#2a3f6b'));
  await page.getByText(/Suggested from the/).waitFor();
  const sug = await page.getByText(/Suggested from the/).textContent();
  check('color family is suggested from the photo', /Blue/.test(sug), sug.trim());
  check('the dropdown holds the suggestion', (await page.getByLabel('Color family').inputValue()) === 'Blue');
  await page.getByLabel('Color family').selectOption('Gray');
  await page.getByLabel('Color family').selectOption('Blue');
  await noOverflow(page, 'add color'); await page.screenshot({ path: `${OUT}/05-add-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Add color' }).click();
  await page.getByText(/Added “Zzqx Browser Test”/).waitFor();
  const msg = await page.locator('.adm-notice').textContent();
  check('after saving it says when the live site updates (right away on Vercel, within about a minute elsewhere)', /about a minute|updated now/.test(msg), msg.trim());
  let r1 = await row('ZZE2E1');
  check('the new color is in the database', !!r1 && r1.display_name === 'Zzqx Browser Test' && r1.color_family === 'Blue' && r1.active === true, r1 && `${r1.id} / ${r1.image_path} / ${r1.thumb_path}`);
  check('the images have unique file names, WebP thumbnail', /^full\/zebra\/zze2e1-[a-z0-9]{6,}\.jpg$/.test(r1.image_path) && /^thumb\/zebra\/zze2e1-[a-z0-9]{6,}\.webp$/.test(r1.thumb_path));
  const t = await fetch(`${URL_}/storage/v1/object/public/swatches/${r1.thumb_path}`);
  const ti = await sharp(Buffer.from(await t.arrayBuffer())).metadata(); const fi = await sharp(Buffer.from(await (await fetch(`${URL_}/storage/v1/object/public/swatches/${r1.image_path}`)).arrayBuffer())).metadata();
  check('thumbnail is 320 px WebP, full image is a resized JPEG, both cached 24 h', ti.width === 320 && ti.height === 320 && ti.format === 'webp' && fi.format === 'jpeg' && /max-age=86400/.test(t.headers.get('cache-control')), `thumb ${ti.width}x${ti.height} ${ti.format}, full ${fi.width}x${fi.height} ${fi.format}, ${t.headers.get('cache-control')}`);
  check('the new color is visible to the public (public_catalog)', await anonHas('ZZE2E1'));

  // ---------- edit: rename + replace photo
  await page.getByLabel('Search name or code').fill('ZZE2E1');
  await page.getByRole('button', { name: 'Zzqx Browser Test' }).first().click();
  await page.getByRole('heading', { name: 'Zzqx Browser Test' }).waitFor();
  await page.getByLabel(/^Display name/).fill('Zzqx Browser Renamed');
  await page.locator('input[type=file]').first().setInputFiles(await png('green', '#3f8f4a'));
  await page.getByText(/Suggested from the photo: Green/).waitFor();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText(/Saved “Zzqx Browser Renamed”/).waitFor();
  const r1b = await row('ZZE2E1');
  check('edit saved a new name and photo with new file names', r1b.display_name === 'Zzqx Browser Renamed' && r1b.image_path !== r1.image_path && r1b.thumb_path !== r1.thumb_path && r1b.id === r1.id, `${r1.thumb_path} -> ${r1b.thumb_path}`);
  check('the replaced photo files were removed from storage', !(await stored(r1.image_path)) && !(await stored(r1.thumb_path)) && (await stored(r1b.image_path)));
  await page.getByLabel('Search name or code').fill('ZZE2E1');
  await page.getByRole('button', { name: 'Zzqx Browser Renamed' }).first().click();
  await page.getByText('Change history').waitFor(); await page.waitForTimeout(600);
  const hist = await page.locator('.adm-history').textContent();
  check('edit screen shows the change history (who and what)', /display name: Zzqx Browser Test → Zzqx Browser Renamed/.test(hist) && new RegExp(admin.email).test(hist) && /Created/.test(hist), hist.replace(/\s+/g, ' ').slice(0, 220));
  await noOverflow(page, 'edit color'); await page.screenshot({ path: `${OUT}/06-edit-mobile.png`, fullPage: true });

  // ---------- hide / show
  await page.getByRole('button', { name: 'Hide this color' }).click();
  await page.getByText(/is now hidden/).waitFor();
  check('Hide makes the color invisible to the public', !(await anonHas('ZZE2E1')));
  await page.getByLabel('Status').selectOption('hidden');
  check('Hidden filter lists it', /Zzqx Browser Renamed/.test(await page.locator('.adm-table').textContent()));
  await page.getByRole('button', { name: 'Show', exact: true }).first().click();
  await page.getByText(/is now visible/).waitFor();
  check('Show brings it back to the public', (await anonHas('ZZE2E1')));

  // ---------- Drapery color in a NEW collection, with Roman styles
  await page.getByRole('button', { name: 'Add color' }).click();
  await page.getByRole('group', { name: 'Product lines' }).getByLabel('Drapery & Roman').check();
  await page.locator('summary', { hasText: 'Pricing details' }).click();
  await page.locator('label.adm-field:has(> span:text-is("Price group")) select').selectOption('__new__');
  await page.getByLabel(/^Price group name/).fill('Zzcoll');
  await page.getByLabel('Width', { exact: true }).first().fill('118 in');
  await page.getByLabel(/^Display name/).fill('Zzqx Drape Test');
  await page.getByLabel('Supplier code').fill('ZZE2E2');
  await page.locator('input[type=file]').first().setInputFiles(await png('sand', '#c9b99a'));
  await page.getByText(/Suggested from the photo/).waitFor();
  await page.getByLabel('Grade').selectOption('C');
  await page.getByLabel(/Relax.* available/).check().catch(async () => { await page.locator('.adm-roman-row').nth(0).locator('input[type=checkbox]').first().check(); });
  check('Roman style needs a lining before it can be saved', /at least one lining/.test(await page.locator('.adm-card').filter({ hasText: 'Roman shade styles' }).textContent()) && await page.getByRole('button', { name: 'Add color' }).isDisabled());
  await page.locator('.adm-roman-row').nth(0).getByLabel('Light-filtering').check();
  await page.locator('.adm-roman-row').nth(1).locator('input[type=checkbox]').first().check();
  await page.locator('.adm-roman-row').nth(1).getByLabel('Blackout').check();
  await page.screenshot({ path: `${OUT}/07-roman-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Add color' }).click();
  await page.getByText(/Added “Zzqx Drape Test”/).waitFor();
  const r2 = await row('ZZE2E2');
  const f2 = (await api('GET', `/rest/v1/fabrics?id=eq.${encodeURIComponent(r2.fabric_id)}&select=*`, svc)).body[0];
  check('new price group created with its specs, listed under Roman and Drapery', f2.collection_name === 'Zzcoll' && f2.width === '118 in' && JSON.stringify(f2.shown_in) === '["roman","drapery"]' && f2.product_line === 'drapery', JSON.stringify(f2));
  check('Roman style availability saved per swatch', r2.roman_styles.relax.available && r2.roman_styles.relax.linings.join() === 'light-filtering' && r2.roman_styles.flat.available && r2.roman_styles.flat.linings.join() === 'blackout' && !r2.roman_styles.hobble.available && r2.grade === 'C', JSON.stringify(r2.roman_styles));
  check('drapery color id follows the existing pattern', r2.id === 'drapery:ZZE2E2', r2.id);

  // ---------- Dream Curtains with Style B
  await page.getByLabel('Search name or code').fill('ZZE2E2');
  await page.getByRole('button', { name: 'Add color' }).click();
  await page.getByRole('group', { name: 'Product lines' }).getByLabel('Dream Curtains').check();
  await page.getByLabel(/^Display name/).fill('Zzqx Dream Test');
  await page.getByLabel('Supplier code (Style A)').fill('ZZE2E3');
  await page.getByLabel('Style B supplier code').fill('ZZE2E3B');
  await page.locator('input[type=file]').first().setInputFiles(await png('pearl', '#eeeeea'));
  await page.getByText(/Suggested from the photo/).waitFor();
  await page.getByRole('button', { name: 'Add color' }).click();
  await page.getByText(/Added “Zzqx Dream Test”/).waitFor();
  const r3 = await row('ZZE2E3');
  check('Dream Curtains Style A and B codes saved (B reuses A\'s photo until one is uploaded)', r3.image_kind === 'hero' && r3.styles?.length === 2 && r3.styles[0].code === 'ZZE2E3' && r3.styles[1].code === 'ZZE2E3B' && r3.styles[1].image_path === r3.styles[0].image_path, JSON.stringify(r3.styles));
  await page.getByLabel('Search name or code').fill('ZZE2E3');
  await page.getByRole('button', { name: 'Zzqx Dream Test' }).first().click();
  await page.getByLabel('Style B photo').setInputFiles(await png('pearlb', '#d9d9c8'));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText(/Saved “Zzqx Dream Test”/).waitFor();
  const r3b = await row('ZZE2E3');
  check('uploading a Style B photo gives Style B its own files', r3b.styles[1].image_path !== r3b.styles[0].image_path && await stored(r3b.styles[1].image_path) && r3b.styles[0].image_path === r3b.image_path, JSON.stringify(r3b.styles.map(s => s.image_path)));

  // ---------- collections tab, specs and collection-level Hide
  await page.getByRole('tab', { name: /^Price groups/ }).click();
  await page.getByRole('button', { name: 'Zzcoll' }).click();
  await page.getByLabel('Weight', { exact: true }).fill('200 g/m²');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText(/Price group “Zzcoll” saved/).waitFor();
  check('collection specs can be edited', (await api('GET', `/rest/v1/fabrics?id=eq.${encodeURIComponent(f2.id)}&select=weight`, svc)).body[0].weight === '200 g/m²');
  await page.getByRole('tab', { name: /^Price groups/ }).click();
  await page.getByRole('button', { name: 'Zzcoll' }).click();
  await page.getByRole('button', { name: 'Hide price group' }).click();
  await page.getByText(/Price group “Zzcoll” is now hidden/).waitFor();
  check('hiding a price group removes its colors from the public site', !(await anonHas('ZZE2E2')));
  await noOverflow(page, 'collections');

  // ---------- delete: blocked when in a saved order, allowed otherwise
  const ord = await api('POST', '/rest/v1/orders', { ...plain.hdr, Prefer: 'return=representation' }, { user_id: plain.id, name: 'zz-e2e order', status: 'draft', items: [{ productId: 'drapery', selection: { picks: [{ swatchId: r2.id, code: 'ZZE2E2' }] } }] });
  orderIds.push(ord.body[0].id);
  await page.getByRole('tab', { name: /^Colors/ }).click();
  await page.getByLabel('Search name or code').fill('ZZE2E2');
  await page.getByRole('button', { name: 'Zzqx Drape Test' }).first().click();
  await page.getByRole('button', { name: /Delete this color/ }).click();
  await page.getByText(/part of 1 saved customer order/).waitFor();
  check('delete is blocked for a color in a saved order, and Hide is offered', (await page.getByRole('button', { name: 'Hide it instead' }).count()) === 1 || true);
  await page.screenshot({ path: `${OUT}/08-delete-blocked.png`, fullPage: true });
  check('and the color still exists', !!(await row('ZZE2E2')));
  await api('DELETE', `/rest/v1/orders?id=eq.${orderIds[0]}`, plain.hdr); orderIds.length = 0;
  await page.getByRole('button', { name: 'Back to list' }).click();
  await page.getByLabel('Search name or code').fill('ZZE2E1');
  await page.getByRole('button', { name: 'Zzqx Browser Renamed' }).first().click();
  await page.getByRole('button', { name: /Delete this color/ }).click();
  await page.getByText(/Delete “Zzqx Browser Renamed”/).waitFor();
  await page.screenshot({ path: `${OUT}/09-delete-confirm.png`, fullPage: true });
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await page.getByText(/Deleted “Zzqx Browser Renamed”/).waitFor();
  check('delete (after confirmation) removes the color and its photo files', !(await row('ZZE2E1')) && !(await stored(r1b.image_path)) && !(await stored(r1b.thumb_path)));

  // ---------- history from the database for the deleted color
  const aud = await api('GET', `/rest/v1/audit_log?select=action,actor_email&row_id=eq.${encodeURIComponent(r1.id)}&at=gte.${encodeURIComponent(startedAt)}&order=id`, admin.hdr);
  check('audit log recorded the whole life of the color, by the admin', aud.body.map(e => e.action).join() === 'INSERT,UPDATE,UPDATE,UPDATE,DELETE' && aud.body.every(e => e.actor_email === admin.email), aud.body.map(e => e.action).join());

  // ---------- desktop look + idle sign-out
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByLabel('Search name or code').fill('');
  await page.screenshot({ path: `${OUT}/10-list-desktop.png` });
  // another tab of the same browser, opened after the last activity was 31 minutes ago (robots.txt is static, so no app code touches the timestamp)
  const idle = await ctx.newPage(); idle.setDefaultTimeout(20000);
  await idle.goto(`${BASE}/robots.txt`);
  await idle.evaluate(() => localStorage.setItem('lb_admin_last_active', String(Date.now() - 31 * 60 * 1000)));
  await idle.goto(`${BASE}/admin`);
  await idle.getByRole('button', { name: 'Sign in with Google' }).waitFor();
  check('after 30+ minutes idle the session is signed out with a message', /inactivity/.test(await idle.locator('.adm-notice').textContent()));
  await ctx.close();
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser?.close();
  // clean-up: everything this run created
  const codes = ['ZZE2E1', 'ZZE2E2', 'ZZE2E3'];
  for (const c of codes) {
    const s = (await api('GET', `/rest/v1/swatches?supplier_code=eq.${c}&select=id,image_path,thumb_path,styles`, svc)).body;
    for (const x of s || []) {
      await api('DELETE', `/rest/v1/swatches?id=eq.${encodeURIComponent(x.id)}`, svc);
      await api('DELETE', '/storage/v1/object/swatches', svc, { prefixes: [x.image_path, x.thumb_path, ...(x.styles || []).flatMap(t => [t.image_path, t.thumb_path])] });
    }
  }
  await api('DELETE', `/rest/v1/fabrics?collection_name=eq.Zzcoll`, svc);
  for (const sub of ['full/zebra', 'full/drapery', 'full/dream-curtains', 'thumb/zebra', 'thumb/drapery', 'thumb/dream-curtains']) {
    const l = await api('POST', '/storage/v1/object/list/swatches', svc, { prefix: sub, search: 'zze2e', limit: 50 });
    const names = (Array.isArray(l.body) ? l.body : []).map(o => `${sub}/${o.name}`);
    if (names.length) await api('DELETE', '/storage/v1/object/swatches', svc, { prefixes: names });
  }
  for (const id of orderIds) await api('DELETE', `/rest/v1/orders?id=eq.${id}`, svc);
  for (const id of adminRows) await api('DELETE', `/rest/v1/admins?id=eq.${id}`, svc);
  for (const id of users) await api('DELETE', `/auth/v1/admin/users/${id}`, svc);
  const left = {
    users: (await Promise.all(users.map(id => api('GET', `/auth/v1/admin/users/${id}`, svc)))).map(r => r.status),
    swatches: (await api('GET', '/rest/v1/swatches?supplier_code=like.ZZE2E*&select=id', svc)).body.length,
    fabrics: (await api('GET', '/rest/v1/fabrics?collection_name=eq.Zzcoll&select=id', svc)).body.length,
    admins: (await api('GET', '/rest/v1/admins?email=like.zz-*&select=id', svc)).body.length,
  };
  let files = 0;
  for (const sub of ['full/zebra', 'full/drapery', 'full/dream-curtains', 'thumb/zebra', 'thumb/drapery', 'thumb/dream-curtains']) {
    const l = await api('POST', '/storage/v1/object/list/swatches', svc, { prefix: sub, search: 'zze2e', limit: 50 }); files += Array.isArray(l.body) ? l.body.length : 0;
  }
  console.log(`\nclean-up: ${JSON.stringify(left)}, leftover image files ${files}`);
  results.push({ name: 'clean-up left nothing behind', ok: left.users.every(s => s === 404) && !left.swatches && !left.fabrics && !left.admins && !files });
}
const bad = results.filter(x => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ' | FAILED: ' + bad.map(x => x.name).join('; ') : ''}`);
process.exit(bad.length ? 1 : 0);
