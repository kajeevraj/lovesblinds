// Browser test of the profile circle in the top bar and the Edit profile page, at 390 px and desktop width, against the live
// project. A temporary customer signs in with a password through the API and its session is handed to the page; the account and
// its orders are deleted afterwards. Needs a preview on BASE_URL (default http://localhost:4173) and the three env vars.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const stamp = Date.now(); let userId, token, browser;
try {
  const email = `zz-prof-${stamp}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true, user_metadata: { full_name: 'Ada Lovelace', avatar_url: '' } }); userId = cu.body.id;
  token = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password })).body;
  browser = await chromium.launch();
  const noOverflow = async (page, label) => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); check(`no sideways scroll: ${label}`, w[0] <= w[1], `${w[0]} of ${w[1]} px`); };

  for (const width of [390, 1280]) {
    // ---------- signed out
    const out = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await out.newPage(); page.setDefaultTimeout(20000);
    await page.goto(`${BASE}/`); const circle = page.locator('.profile-btn'); await circle.waitFor();
    const box = await circle.boundingBox();
    check(`[${width}px] signed out: the profile circle is in the top right of the top bar`, box.x + box.width > width - 40 && box.y < 80 && box.width >= 44, JSON.stringify(box));
    for (const path of ['/products', '/measure', '/contact']) { await page.goto(`${BASE}${path}`); await page.locator('.profile-btn').waitFor(); }
    check(`[${width}px] the circle is on every page`, true, 'home, products, measure guide, contact');
    await circle.click();
    const items = await page.getByRole('menuitem').allInnerTexts();
    check(`[${width}px] signed out: the menu offers only "Sign in with Google"`, items.join('|') === 'Sign in with Google', items.join('|'));
    const dd = await page.locator('.profile-dropdown').boundingBox();
    check(`[${width}px] the menu stays on screen`, dd.x >= 0 && dd.x + dd.width <= width, JSON.stringify(dd));
    await page.keyboard.press('Escape');
    check(`[${width}px] Escape closes it and focus returns to the circle`, (await page.locator('.profile-dropdown').count()) === 0 && await circle.evaluate((el) => el === document.activeElement));
    await circle.click(); await page.mouse.click(5, 400);
    check(`[${width}px] clicking outside closes it`, (await page.locator('.profile-dropdown').count()) === 0);
    await out.close();
  }

  // ---------- signed in (phone width)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // only the first load gets the injected session; later loads use what the site itself stored (as a real visitor would)
  await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('zz-seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('zz-seeded', '1'); } } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(token)]);
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  await page.goto(`${BASE}/`); await page.locator('.profile-btn.is-signed-in').waitFor();
  check('signed in: the circle shows their initials when there is no Google picture', (await page.locator('.profile-btn').innerText()).trim() === 'AL', (await page.locator('.profile-btn').innerText()).trim());
  check('signed in: the old "Sign in" button is gone', (await page.getByRole('button', { name: /^Sign in$/ }).count()) === 0);
  await page.locator('.profile-btn').click();
  const items = await page.getByRole('menuitem').allInnerTexts();
  check('signed in: the menu has Edit profile, Order history and Sign out', items.join('|') === 'Edit profile|Order history|Sign out', items.join('|'));
  check('the menu shows their name and email', /Ada Lovelace/.test(await page.locator('.profile-who').innerText()) && (await page.locator('.profile-who').innerText()).includes(email));
  await page.keyboard.press('ArrowDown');
  check('arrow keys move through the menu items', (await page.evaluate(() => document.activeElement.textContent)) === 'Order history');
  await noOverflow(page, 'menu open');

  await page.getByRole('menuitem', { name: 'Edit profile' }).click();
  await page.getByRole('heading', { name: 'Your profile' }).waitFor();
  check('Edit profile opens the profile page at /profile', new URL(page.url()).pathname === '/profile');
  check('the profile page starts with their Google name', (await page.getByLabel('Name').inputValue()) === 'Ada Lovelace');
  await page.getByLabel('Name').fill('Ada B. Lovelace'); await page.getByLabel('Phone').fill('555 010 2030'); await page.getByLabel('Shipping address').fill('1 Analytical Way, London');
  await page.getByRole('button', { name: 'Save profile' }).click(); await page.getByText('Saved.').waitFor();
  const meta = (await api('GET', `/auth/v1/admin/users/${userId}`, H(SVC))).body.user_metadata;
  check('Save profile stores the name, phone and address on the account (Google fields untouched)', meta.profile_name === 'Ada B. Lovelace' && meta.profile_phone === '555 010 2030' && meta.profile_ship_to === '1 Analytical Way, London' && meta.full_name === 'Ada Lovelace', JSON.stringify(meta));
  await noOverflow(page, 'profile page');
  await page.reload(); await page.getByLabel('Name').waitFor(); await page.waitForTimeout(600);
  check('after a reload the saved details are there', (await page.getByLabel('Phone').inputValue()) === '555 010 2030' && (await page.getByLabel('Name').inputValue()) === 'Ada B. Lovelace');
  await page.locator('.profile-btn').click();
  check('the menu now shows the profile name', /Ada B\. Lovelace/.test(await page.locator('.profile-who').innerText()));
  await page.getByRole('menuitem', { name: 'Order history' }).click();
  check('Order history opens My Orders', new URL(page.url()).pathname === '/orders');
  await page.getByRole('button', { name: /^My Orders/ }).first().waitFor();

  // the order details form starts from the profile
  await page.goto(`${BASE}/products/zebra`); await page.locator('.sw-tile').first().waitFor();
  await page.locator('.sw-tile').first().click(); await page.locator('dialog[open] button.btn-sage').click();
  await page.getByRole('button', { name: 'Add to Order' }).click(); await page.getByRole('button', { name: 'Added to your order' }).waitFor(); await page.waitForTimeout(1500);   // saved to their order
  await page.goto(`${BASE}/review`); await page.locator('input.input').first().waitFor(); await page.waitForTimeout(800);
  const filled = await page.locator('input.input').evaluateAll((els) => els.map((e) => e.value));
  check('the order details form is pre-filled from the profile (name, email, phone, address)', ['Ada B. Lovelace', email, '555 010 2030', '1 Analytical Way, London'].every((v) => filled.includes(v)), filled.join(' | '));

  await page.locator('.profile-btn').click(); await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.locator('.profile-btn:not(.is-signed-in)').waitFor();
  check('Sign out returns the circle to the signed-out icon', (await page.locator('.profile-btn.is-signed-in').count()) === 0 && (await page.locator('.profile-btn svg').count()) === 1);
  await page.locator('.profile-btn').click();
  check('and the menu offers Sign in with Google again', (await page.getByRole('menuitem').allInnerTexts()).join('|') === 'Sign in with Google');
  await ctx.close();
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser?.close();
  if (userId) {
    if (token?.access_token) { const o = await api('GET', `/rest/v1/orders?select=id&user_id=eq.${userId}`, H(ANON, token.access_token)); for (const r of o.body || []) await api('DELETE', `/rest/v1/orders?id=eq.${r.id}`, H(ANON, token.access_token)); }
    await api('DELETE', `/auth/v1/admin/users/${userId}`, H(SVC));
  }
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
