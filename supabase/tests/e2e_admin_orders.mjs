// Browser test of the admin Orders section (list, filter, search, detail, note, status) against the live project, at phone and
// desktop width. A temporary admin signs in with a password through the API and its session is handed to the page (Google's screen
// cannot be automated). Three test orders are made by the server and removed at the end by the temporary admin. The status change is
// checked against a fake answer (the status list changes with migration 16); the database side is in live_orders_admin_tests.mjs.
// Needs the live Supabase variables, a site on BASE_URL (default http://localhost:4173) and Playwright. Exits 2 without migration 14.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const ref = new URL(URL_).hostname.split('.')[0];
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const tag = `zz-m16-${Date.now()}`; const users = [], adminRows = []; let adminHdr = null, browser;
const line = (o = {}) => ({ qty: 2, productName: 'Roller Shades', description: 'Roller Shades, Single · Solar · Jet Black (YS180006)', internalDescription: 'Roller Shades, Single · Solar · Aries Black (YS180006) [Jet Black]', width: 40.5, length: 64, roomLabel: 'Den', windowLabel: 'Left window', mountId: 'inside', price: { kind: 'price', unit: 139 }, ...o });
try {
  const probe = await api('GET', '/rest/v1/sent_orders?select=id&limit=1', H(SVC));
  if (probe.status === 404 || (probe.status === 400 && /sent_orders/.test(JSON.stringify(probe.body)))) { console.log('Migration 14 is not applied yet.'); process.exit(2); }
  const email = `${tag}-admin@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  const cu = await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true }); users.push(cu.body.id);
  const tok = await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password }); adminHdr = H(ANON, tok.body.access_token);
  adminRows.push((await api('POST', '/rest/v1/admins', H(SVC), { email, user_id: cu.body.id })).body[0].id);
  const mkOrder = (name, extra = {}) => api('POST', '/rest/v1/sent_orders', H(SVC), { customer: { name, email: `${name}@example.com`, phone: '555-0100', address: { street: '1 Way', apt: '', city: 'Raleigh', state: 'NC', zip: '27601', country: 'United States' } }, lines: [line(), line({ qty: 1, price: { kind: 'email', unit: null }, roomLabel: 'Hall', windowLabel: '' })], notes: 'Please call after 5', total: 278, by_email_count: 1, customer_copy: true, ...extra });
  await mkOrder(`${tag}-Ada`); await mkOrder(`${tag}-Ben`, { total: null, by_email_count: 2 }); await mkOrder(`${tag}-Cy`);

  browser = await chromium.launch();
  for (const [label, vp] of [['390px', { width: 390, height: 844 }], ['1280px', { width: 1280, height: 800 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(tok.body)]);
    const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    let patched = null;
    await page.route('**/rest/v1/sent_orders?id=eq.*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      const body = JSON.parse(route.request().postData());
      if (body.status && body.status !== 'new') { patched = body; const r = await route.fetch({ postData: JSON.stringify({ admin_note: body.admin_note }), headers: { ...route.request().headers(), prefer: 'return=representation' } }); const rows = await r.json(); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ...rows[0], status: body.status }]) }); }
      return route.continue();
    });
    await page.goto(`${BASE}/admin`); await page.getByRole('button', { name: 'Orders' }).first().click().catch(async () => { await page.getByRole('button', { name: 'Menu' }).click(); await page.getByRole('button', { name: 'Orders' }).click(); });
    await page.locator('.adm-table').waitFor();
    check(`[${label}] Orders is a real section now (an Orders heading and a table, not "Coming soon")`, (await page.locator('.adm-main h1').innerText()) === 'Orders' && !/Coming soon/.test(await page.locator('.adm-main').innerText()));
    await page.getByPlaceholder('Search name or email').fill(tag);
    const rows = page.locator('.adm-table tbody tr');
    check(`[${label}] the list shows the orders with date, customer, items, estimated total and status`, (await rows.count()) === 3 && /blinds/.test(await rows.first().innerText()) && /New/.test(await rows.first().innerText()) && /\$278/.test(await page.locator('.adm-table').innerText()) && /Price by email/.test(await page.locator('.adm-table').innerText()));
    check(`[${label}] the status buttons show counts`, /New \(\d+\)/.test(await page.locator('.adm-tabs').innerText()) && /Shipped \(0\)|Shipped \(\d+\)/.test(await page.locator('.adm-tabs').innerText()));
    await page.getByPlaceholder('Search name or email').fill(`${tag}-Ben`);
    check(`[${label}] search by name narrows the list`, (await rows.count()) === 1 && /Ben/.test(await rows.first().innerText()));
    await page.getByPlaceholder('Search name or email').fill(tag);
    await page.getByRole('button', { name: new RegExp(`${tag}-Ada`) }).click(); await page.getByRole('heading', { name: 'Status and notes' }).waitFor();
    const body = await page.locator('.adm-main').innerText();
    check(`[${label}] the detail shows the customer, address, phone, notes, items with sizes and the estimate`, body.includes(`${tag}-Ada@example.com`) && /Raleigh NC 27601/.test(body) && /555-0100/.test(body) && /Please call after 5/.test(body) && /40 1\/2" × 64"/.test(body) && /\$139 each · \$278/.test(body) && /Price by email/.test(body) && /Estimated total: \$278 \+ 1 by email/.test(body) && /Aries Black/.test(body) && /Sent to the customer/.test(body));
    check(`[${label}] nothing in the detail can edit the order itself (only a status and a note)`, (await page.locator('.adm-main input:not([type=search])').count()) === 0 && (await page.locator('.adm-main textarea').count()) === 1 && (await page.locator('.adm-main select').count()) === 1);
    const save = page.getByRole('button', { name: 'Save', exact: true });
    check(`[${label}] Save waits until something changes`, await save.isDisabled());
    const noteText = `Called, sizes confirmed ${label}`; await page.locator('textarea').fill(noteText); await save.click(); await page.getByText('Saved.').waitFor();
    const stored = (await api('GET', `/rest/v1/sent_orders?select=admin_note,status&customer->>name=eq.${tag}-Ada`, H(SVC))).body[0];
    check(`[${label}] a note is saved to the database`, stored.admin_note === noteText && stored.status === 'new');
    await page.locator('select').selectOption('confirmed'); await save.click(); await page.getByText('Saved.').waitFor();
    check(`[${label}] changing the status sends only the status and the note`, patched && patched.status === 'confirmed' && Object.keys(patched).sort().join() === 'admin_note,status', JSON.stringify(patched));
    check(`[${label}] the four statuses are New, Confirmed, Ordered, Shipped`, (await page.locator('select option').allInnerTexts()).join('|') === 'New|Confirmed|Ordered|Shipped');
    const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`[${label}] no sideways scroll`, w <= 0, `${w}`);
    await page.getByRole('button', { name: '← All orders' }).click(); await page.locator('.adm-table').waitFor();
    check(`[${label}] back to the list, which shows the new status`, /Confirmed/.test(await page.locator('.adm-table').innerText()));
    await ctx.close();
  }
  // a signed-in customer who is not an admin never sees Orders
  const pe = `${tag}-plain@example.com`, pp = `Tmp-${crypto.randomUUID()}`;
  const pu = await api('POST', '/auth/v1/admin/users', H(SVC), { email: pe, password: pp, email_confirm: true }); users.push(pu.body.id);
  const ptok = await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email: pe, password: pp });
  const pctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await pctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(ptok.body)]);
  const ppage = await pctx.newPage(); await ppage.goto(`${BASE}/admin`); await ppage.getByText('You don’t have access').waitFor();
  check('a signed-in customer who is not an admin sees "You don’t have access", and no orders', !(await ppage.locator('body').innerText()).includes(tag));
} catch (e) { console.log('TEST ERROR:', e.message.split('\n')[0]); results.push({ name: 'script ran to completion', ok: false }); }
finally {
  if (browser) await browser.close();
  if (adminHdr) { const del = await api('DELETE', `/rest/v1/sent_orders?customer->>name=like.${tag}-*`, adminHdr); console.log(`cleanup: removed ${Array.isArray(del.body) ? del.body.length : 0} test order row(s)`); }
  for (const id of adminRows) await api('DELETE', `/rest/v1/admins?id=eq.${id}`, H(SVC)).catch(() => {});
  for (const id of users) await api('DELETE', `/auth/v1/admin/users/${id}`, H(SVC)).catch(() => {});
}
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
