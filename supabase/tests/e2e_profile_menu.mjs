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
    await page.goto(`${BASE}/`); const signIn = page.locator('.s2-nav .gsi-btn'); await signIn.waitFor();
    const box = await signIn.boundingBox();
    check(`[${width}px] signed out: a "Sign in" button with the Google logo is in the top right of the top bar`, /Sign in/.test(await signIn.innerText()) && (await signIn.locator('svg').count()) === 1 && box.x + box.width > width - 40 && box.y < 80 && box.height >= 44, JSON.stringify(box));
    check(`[${width}px] signed out: there is no profile (person) icon`, (await page.locator('.profile-btn').count()) === 0);
    for (const path of ['/products', '/measure', '/contact']) { await page.goto(`${BASE}${path}`); await page.locator('.s2-nav .gsi-btn').waitFor(); }
    check(`[${width}px] the button is on every page`, true, 'home, products, measure guide, contact');
    await noOverflow(page, 'signed out top bar');
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

  // a profile saved before the address had separate boxes (one line of text) shows that line in the street box
  await api('PUT', `/auth/v1/admin/users/${userId}`, H(SVC), { user_metadata: { profile_ship_to: '9 Old Road, Town', profile_address: null } });
  {
    const fresh = (await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password })).body;     // a new sign-in sees the account as it is now
    const lc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await lc.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(fresh)]);
    const lp = await lc.newPage(); lp.setDefaultTimeout(20000); await lp.goto(`${BASE}/profile`); await lp.locator('#pf-street').waitFor(); await lp.waitForTimeout(1200);
    check('an address saved the old way (one line) appears in the street box, so nothing is lost', (await lp.locator('#pf-street').inputValue()) === '9 Old Road, Town' && (await lp.locator('#pf-city').inputValue()) === '' && (await lp.locator('#pf-country').inputValue()) === 'United States');
    await lc.close();
  }
  await page.getByRole('menuitem', { name: 'Edit profile' }).click();
  await page.getByRole('heading', { name: 'Your profile' }).waitFor();
  check('Edit profile opens the profile page at /profile', new URL(page.url()).pathname === '/profile');
  check('the profile page starts with their Google name', (await page.getByLabel('Name').inputValue()) === 'Ada Lovelace');
  await page.getByLabel('Name').fill('Ada B. Lovelace'); await page.getByLabel('Phone').fill('555 010 2030'); await page.locator('#pf-street').fill('1 Analytical Way'); await page.locator('#pf-apt').fill('Flat 2'); await page.locator('#pf-city').fill('London'); await page.locator('#pf-state').fill('England'); await page.locator('#pf-zip').fill('N1 1AA'); await page.locator('#pf-country').selectOption('United Kingdom');
  check('the profile address has the same fields as the order form (street, apartment optional, city, state / province, ZIP / postal code, country list)', (await page.locator('.profile-address label').allInnerTexts()).join('|') === 'Street address|Apartment, suite, etc. (optional)|City|State / province|ZIP / postal code|Country');
  await page.getByRole('button', { name: 'Save profile' }).click(); await page.getByText('Saved.').waitFor();
  const meta = (await api('GET', `/auth/v1/admin/users/${userId}`, H(SVC))).body.user_metadata;
  check('Save profile stores the name, phone and address on the account (Google fields untouched)', meta.profile_name === 'Ada B. Lovelace' && meta.profile_phone === '555 010 2030' && meta.profile_address?.street === '1 Analytical Way' && meta.profile_address.apt === 'Flat 2' && meta.profile_address.city === 'London' && meta.profile_address.state === 'England' && meta.profile_address.zip === 'N1 1AA' && meta.profile_address.country === 'United Kingdom' && meta.profile_ship_to === '1 Analytical Way, Flat 2, London, England N1 1AA, United Kingdom' && meta.full_name === 'Ada Lovelace', JSON.stringify(meta));
  await noOverflow(page, 'profile page');
  await page.reload(); await page.getByLabel('Name').waitFor(); await page.waitForTimeout(600);
  check('after a reload the saved details are there', (await page.getByLabel('Phone').inputValue()) === '555 010 2030' && (await page.getByLabel('Name').inputValue()) === 'Ada B. Lovelace' && (await page.locator('#pf-street').inputValue()) === '1 Analytical Way' && (await page.locator('#pf-country').inputValue()) === 'United Kingdom' && (await page.locator('#pf-zip').inputValue()) === 'N1 1AA');
  await page.locator('.profile-btn').click();
  check('the menu now shows the profile name', /Ada B\. Lovelace/.test(await page.locator('.profile-who').innerText()));
  await page.getByRole('menuitem', { name: 'Order history' }).click();
  check('Order history opens My Orders', new URL(page.url()).pathname === '/orders');
  await page.getByRole('heading', { name: /My orders/i }).first().waitFor();

  // the order details form starts from the profile
  await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor();
  await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
  await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled);
  await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor(); await page.waitForTimeout(1500);   // saved to their order
  await page.goto(`${BASE}/order?checkout=1`); await page.locator('#o-name').waitFor(); await page.waitForTimeout(800);
  const filled = await page.locator('.s2-form input, .s2-form select').evaluateAll((els) => els.map((e) => e.value));
  check('the order details form is pre-filled from the profile: name, email, phone and the whole address (street, apartment, city, state, ZIP, country)', ['Ada B. Lovelace', email, '555 010 2030', '1 Analytical Way', 'Flat 2', 'London', 'England', 'N1 1AA', 'United Kingdom'].every((v) => filled.includes(v)), filled.join(' | '));

  // signed in: an edit link survives a refresh (the saved order has to load before the item can be found)
  await page.goto(`${BASE}/order`); await page.locator('.s2-item').first().waitFor();
  await page.locator('.s2-item').first().click();
  await page.locator('#s2-w').waitFor(); const editUrl = page.url();
  await page.reload(); await page.locator('#s2-w').waitFor(); await page.locator('.s2-sw.on').waitFor();
  check('signed in: after a refresh in the middle of an edit the same item is open ("Save changes", choices filled in)', page.url() === editUrl && (await page.locator('.s2-add-btn').innerText()) === 'Save changes' && (await page.locator('#s2-w').inputValue()) === '40' && (await page.locator('.s2-sw.on').count()) === 1);
  await page.goto(`${BASE}/order?checkout=1`); await page.locator('#o-name').waitFor(); await page.waitForTimeout(800);
  // sending saves the estimate and quantity with the order, marks it sent, and the next window goes into a fresh order
  await page.route('**/api/quote', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, customerCopy: false }) }));
  await page.getByRole('button', { name: 'Send my order' }).click();
  await page.getByRole('heading', { name: 'Your order is on its way to us' }).waitFor(); await page.waitForTimeout(2500);
  const ordRes = await api('GET', `/rest/v1/orders?select=id,status,items,customer&user_id=eq.${userId}`, H(ANON, token.access_token));
  const hasCustomerColumn = ordRes.status === 200;
  const ord = hasCustomerColumn ? ordRes.body : (await api('GET', `/rest/v1/orders?select=id,status,items&user_id=eq.${userId}`, H(ANON, token.access_token))).body;
  const sentOrder = ord.find((x) => x.status === 'sent');
  check('a sent order keeps each item\'s estimate and quantity', !!sentOrder && sentOrder.items.length === 1 && sentOrder.items[0].price > 0 && sentOrder.items[0].priceKind === 'estimate' && sentOrder.items[0].qty === 1, JSON.stringify(sentOrder?.items?.[0] && { price: sentOrder.items[0].price, kind: sentOrder.items[0].priceKind, qty: sentOrder.items[0].qty }));
  check('a sent order keeps the customer details and the whole shipping address (migration 12: orders.customer)', hasCustomerColumn && sentOrder?.customer?.address?.street === '1 Analytical Way' && sentOrder.customer.address.city === 'London' && sentOrder.customer.address.state === 'England' && sentOrder.customer.address.zip === 'N1 1AA' && sentOrder.customer.address.country === 'United Kingdom' && sentOrder.customer.email === email && sentOrder.customer.name === 'Ada B. Lovelace', hasCustomerColumn ? JSON.stringify(sentOrder?.customer) : 'orders.customer column missing: apply migration 12');
  check('after sending, a fresh empty order is ready for the next window', ord.some((x) => x.status === 'draft' && x.items.length === 0), ord.map((x) => x.status).join(', '));
  // a sent order opens to look at, never to change; "Order again" copies it into a new draft
  const beforeItems = JSON.stringify(sentOrder.items);
  await page.goto(`${BASE}/orders`); await page.locator('.order-card').first().waitFor();
  await page.locator('.order-card', { hasText: 'Sent' }).first().click();
  await page.getByRole('button', { name: 'Order again' }).waitFor();
  const view = await page.locator('main').innerText();
  check('opening a sent order shows it read-only: its items, "Order again", and no edit, remove or send buttons', /can't be changed/.test(view) && (await page.getByRole('button', { name: 'Order again' }).count()) === 1 && (await page.getByRole('link', { name: /^Edit/ }).count()) === 0 && (await page.getByRole('button', { name: /Remove|Duplicate|Send my order/ }).count()) === 0 && /\$\d+/.test(view), view.replace(/\s+/g, ' ').slice(0, 160));
  check('...with the details it was sent with (name, address)', /Ada B\. Lovelace/.test(view) && /London/.test(view));
  await page.getByRole('button', { name: 'Order again' }).click();
  await page.waitForFunction(() => location.pathname === '/order'); await page.locator('.s2-item').first().waitFor();
  check('"Order again" adds the same items to the cart and opens it, ready to change', (await page.locator('.s2-item').count()) === 1 && /Zebra/.test(await page.locator('.s2-item').first().innerText()));
  await page.locator('.s2-item').first().click(); await page.locator('#s2-w').waitFor(); await page.locator('#s2-w').fill('50');
  await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled); await page.locator('.s2-add-btn').click();
  await page.waitForFunction(() => location.pathname === '/order'); await page.waitForTimeout(2500);
  const after = (await api('GET', `/rest/v1/orders?select=id,status,items&user_id=eq.${userId}`, H(ANON, token.access_token))).body;
  const sentAfter = after.find((x) => x.id === sentOrder.id);
  check('changing the copy never touches the sent order (same items, still sent)', sentAfter.status === 'sent' && JSON.stringify(sentAfter.items) === beforeItems && after.length === ord.length && after.some((x) => x.status === 'draft' && x.items.some((i) => i.width === 50)));
  const tamper = await api('PATCH', `/rest/v1/orders?id=eq.${sentOrder.id}`, H(ANON, token.access_token), { items: [] });
  const guardApplied = tamper.status >= 400;
  const still = (await api('GET', `/rest/v1/orders?select=items&id=eq.${sentOrder.id}`, H(ANON, token.access_token))).body[0];
  console.log(guardApplied ? '      (migration 13 is applied: the database itself refuses changes to a sent order)' : '      (migration 13 is not applied yet: only the site protects a sent order; the database guard arrives with it)');
  if (process.env.REQUIRE_MIGRATION13 === '1') check('the database refuses to change the items of a sent order (migration 13)', guardApplied && JSON.stringify(still.items) === beforeItems, `PATCH answered ${tamper.status}`);
  // an order in progress must not stay on screen after signing out
  await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor();
  await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
  await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled); await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
  // the order in progress is the copy made by "Order again" (the sent order is never reopened) plus the window just added
  check('before signing out the bar shows the two items in the order in progress', /Your cart: 2 items/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')));
  await page.locator('.profile-btn').click(); await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.locator('.s2-nav .gsi-btn').waitFor();
  check('after signing out the order in progress is gone from the bar, the order page and the browser', (await page.evaluate(() => (localStorage.getItem('lb_guest_quote') || '[]'))) === '[]' && !/Your cart: \d+ item/.test(await page.locator('.s2-bar-order').getAttribute('aria-label')));
  await page.goto(`${BASE}/order`); await page.waitForTimeout(800);
  check('and the order page is empty after signing out', /Your cart is empty/.test(await page.locator('main').innerText()));
  await page.goto(`${BASE}/`); await page.waitForTimeout(500);
  check('the home page shows no order bar after signing out', (await page.locator('.s2-bar').count()) === 0);
  check('Sign out returns the top bar to the Google "Sign in" button', (await page.locator('.profile-btn').count()) === 0 && /Sign in/.test(await page.locator('.s2-nav .gsi-btn').innerText()));
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
