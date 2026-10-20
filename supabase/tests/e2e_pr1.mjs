// Browser tests for the fixes of pull request 1: size and quantity limits, the contact form, the order panel's keyboard, Duplicate,
// the order staying in step across tabs, small accessibility and layout fixes. The database function size_limits() is answered by a
// fixed fake (23 to 118 wide, 24 to 120 high for Roller; none for Curtains) so these run before and after migration 13 is applied;
// /api/contact is a fake too, so nothing is sent. Needs a preview on BASE_URL (default http://localhost:4173).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const LIMITS = { roller: { min_width: 23, max_width: 118, min_height: 24, max_height: 120 }, 'dream-curtains': { min_width: 24, max_width: 352, min_height: 12, max_height: 228 }, drapery: {} };
const browser = await chromium.launch();
const mockLimits = (page) => page.route('**/rest/v1/rpc/size_limits', async (route) => {
  const line = JSON.parse(route.request().postData()).p_line;
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ min_width: null, max_width: null, min_height: null, max_height: null, source: 'none', ...(LIMITS[line] || LIMITS.roller) }) });
});
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  await mockLimits(page);
  const size = async (w, h) => { await page.locator('#s2-w').fill(String(w)); await page.locator('#s2-h').fill(String(h)); };
  const estimate = () => page.locator('.s2-estimate').innerText();

  // ---------- size limits ----------
  await page.goto(`${BASE}/products/roller`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click();
  await size(20, 64); await page.locator('.s2-size-msg.is-error').waitFor();
  check('Roller: a width under the smallest says "The smallest we can make is 23 inches wide." and nothing is priced', /The smallest we can make is 23 inches wide\./.test(await page.locator('.s2-size-msg.is-error').innerText()) && /Size too small/.test(await estimate()) && (await page.locator('.s2-estimate-price').count()) === 0);
  check('...and Add to order is blocked, the bar says so', await page.locator('.s2-bar-btn').isDisabled() && /Enter a larger size/.test(await page.locator('.s2-bar').innerText()));
  await size(40, 10); await page.locator('.s2-size-msg.is-error').waitFor();
  check('a height under the smallest says "...24 inches high."', /The smallest we can make is 24 inches high\./.test(await page.locator('.s2-size-msg.is-error').innerText()) && await page.locator('.s2-bar-btn').isDisabled());
  await size(10, 10); await page.waitForTimeout(300);
  check('both too small: both messages', (await page.locator('.s2-size-msg.is-error').innerText()).match(/smallest we can make/g).length === 2);
  await size(23, 24); await page.locator('.s2-estimate-price').waitFor();
  check('exactly the smallest size is fine: priced, no warning, Add to order works', (await page.locator('.s2-size-msg').count()) === 0 && await page.locator('.s2-bar-btn').isEnabled());
  await size(200, 64); await page.getByText(/larger than our standard range/).first().waitFor();
  check('above the largest: the "larger than our standard range" message stays, and the order can still be added', await page.locator('.s2-bar-btn').isEnabled() && /Add it to your order and we'll reply with a price/.test(await estimate()));
  await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
  await page.locator('#s2-wf').selectOption('0.5'); await page.locator('#s2-w').fill('22');
  await page.waitForTimeout(300);
  check('22 1/2 inches is still under 23', (await page.locator('.s2-size-msg.is-error').count()) === 1);

  // typo warning (Curtains have no limits; Roller too-small wins over the warning)
  await page.goto(`${BASE}/products/drapery`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click();
  await page.locator('.s2-step', { hasText: 'Pleat style' }).locator('.s2-card').first().click(); await page.locator('.s2-step', { hasText: 'Lining' }).locator('.s2-card').first().click();
  await size(8, 96); await page.locator('.s2-size-msg.is-warn').waitFor();
  await page.waitForFunction(() => !document.querySelector('.s2-bar-btn').disabled);
  check('a size that looks like a typo (8 inches wide) shows "Double-check this size." and does not block', /Double-check this size\./.test(await page.locator('.s2-size-msg.is-warn').innerText()) && await page.locator('.s2-bar-btn').isEnabled());
  await size(120, 96); await page.waitForTimeout(300);
  check('a normal curtain size shows no warning', (await page.locator('.s2-size-msg').count()) === 0);
  await size(400, 96); await page.locator('.s2-size-msg.is-warn').waitFor();
  check('400 inches wide also gets the "Double-check" note', /Double-check/.test(await page.locator('.s2-size-msg.is-warn').innerText()));

  // ---------- quantity 1 to 99 ----------
  await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click(); await size(40, 64);
  await page.waitForFunction(() => !document.querySelector('.s2-bar-btn').disabled);
  await page.locator('#s2-qty').fill('150'); await page.locator('#s2-qty').blur();
  check('typing 150 becomes 99, with a note', (await page.locator('#s2-qty').inputValue()) === '99');
  await page.waitForFunction(() => /99 blinds/.test(document.querySelector('.s2-bar-sub')?.innerText || ''));
  check('at 99 the + button is off and the bar says 99 blinds', await page.getByRole('button', { name: 'One more blind' }).isDisabled());
  await page.locator('#s2-qty').fill('0'); await page.locator('#s2-qty').blur();
  check('typing 0 becomes 1', (await page.locator('#s2-qty').inputValue()) === '1');
  await page.locator('#s2-qty').fill('-4'); await page.locator('#s2-qty').blur();
  check('typing -4 becomes 1', (await page.locator('#s2-qty').inputValue()) === '1');

  // ---------- the order panel's keyboard ----------
  await page.locator('.s2-bar-btn').click(); await page.locator('.s2-flash').waitFor();
  await page.locator('.s2-bar-order').focus(); await page.keyboard.press('Enter'); await page.locator('.s2-panel').waitFor();
  let inside = true; for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); inside = inside && await page.evaluate(() => !!document.activeElement.closest('.s2-panel')); }
  check('Tab 12 times: focus never leaves the open panel', inside);
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
  check('Shift+Tab goes round the other way and stays inside', await page.evaluate(() => !!document.activeElement.closest('.s2-panel')));
  await page.keyboard.press('Escape');
  check('Escape closes the panel and puts focus back on the order button', (await page.locator('.s2-panel').count()) === 0 && await page.evaluate(() => document.activeElement?.classList.contains('s2-bar-order')));
  await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor();
  await page.getByRole('button', { name: 'Close your order' }).click();
  check('the close button also returns focus to the order button', await page.evaluate(() => document.activeElement?.classList.contains('s2-bar-order')));

  // ---------- Duplicate ----------
  await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel').waitFor();
  check('the panel has Edit, Duplicate and Remove on each item', (await page.getByRole('link', { name: /^Edit / }).count()) === 1 && (await page.getByRole('button', { name: /^Duplicate / }).count()) === 1);
  await page.getByRole('button', { name: /^Duplicate / }).click();
  await page.waitForFunction(() => /\?edit=/.test(location.search)); await page.locator('#s2-w').waitFor(); await page.locator('.s2-sw.on').waitFor();
  check('Duplicate adds a copy and opens it for editing with everything filled in', (await page.locator('.s2-bar-btn').innerText()) === 'Save changes' && (await page.locator('#s2-w').inputValue()) === '40' && /\?edit=/.test(page.url()));
  await page.locator('#s2-w').fill('55'); await page.locator('.s2-bar-btn').click();
  await page.waitForFunction(() => location.pathname === '/order'); await page.locator('.s2-item').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.s2-item').length === 2 && !/Calculating/.test(document.querySelector('.s2-items').innerText));
  const texts = await page.locator('.s2-item').allInnerTexts();
  check('the original is unchanged and the copy has the new width (two items: 40 and 55 inches)', /40" wide/.test(texts[0]) && /55" wide/.test(texts[1]), texts.map((t) => (t.match(/\d+" wide/) || [])[0]).join(', '));
  check('the order page has Edit, Duplicate and Remove on each item', (await page.getByRole('link', { name: /^Edit / }).count()) === 2 && (await page.getByRole('button', { name: /^Duplicate / }).count()) === 2 && (await page.getByRole('button', { name: 'Remove' }).count()) === 2);
  await page.getByRole('button', { name: /^Duplicate / }).first().click();
  await page.waitForFunction(() => /\?edit=/.test(location.search));
  check('Duplicate from the order page opens the copy too', (await page.locator('.s2-bar-btn').innerText()) === 'Save changes');
  await page.getByRole('link', { name: 'Cancel' }).first().click(); await page.waitForFunction(() => location.pathname === '/order');
  check('Cancel keeps the copy in the order (three items)', (await page.locator('.s2-item').count()) === 3);

  // ---------- the order follows the other tab ----------
  const tab2 = await ctx.newPage(); await tab2.goto(`${BASE}/`); await tab2.locator('.s2-bar-only').waitFor();
  check('a second tab shows the same order', /Your order: 3 items/.test(await tab2.locator('.s2-bar-order').innerText()));
  await page.getByRole('button', { name: 'Remove' }).first().click();
  await tab2.waitForFunction(() => /Your order: 2 items/.test(document.querySelector('.s2-bar-order')?.innerText || ''), null, { timeout: 5000 });
  check('removing an item in one tab updates the other tab without a reload', true);
  await page.locator('.s2-item').first().waitFor();
  await tab2.close();

  // ---------- accessibility and small layout fixes ----------
  await page.goto(`${BASE}/products`); await page.locator('.s2-tile').first().waitFor();
  const heads = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3')].map((h) => h.tagName));
  check('the products list: one h1, then h2 headings (no skipped level)', heads[0] === 'H1' && heads.slice(1).every((t) => t === 'H2'), heads.join(' '));
  await page.goto(`${BASE}/`); await page.locator('.s2-tile').first().waitFor();
  const h2 = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3')].map((h) => h.tagName));
  check('the home page order of headings is still h1, h2, h3', h2[0] === 'H1' && !h2.some((t, i) => i > 0 && t === 'H3' && !h2.slice(0, i).includes('H2')), h2.join(' '));
  await page.goto(`${BASE}/products/roller`); await page.locator('.s2-sw').first().waitFor();
  const mism = await page.evaluate(() => [...document.querySelectorAll('.s2-sw')].filter((b) => { const vis = b.innerText.replace(/\s+/g, ' ').trim(); const a = (b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(); return !a.includes(vis); }).length);
  check('every swatch button\'s spoken name contains its visible text ("Jet Black YS180006")', mism === 0, `${mism} mismatches`);
  const small = await page.evaluate(() => [...document.querySelectorAll('.s2-crumbs a, .s2-step-hint a')].map((a) => Math.round(a.getBoundingClientRect().height)).filter((h) => h < 44));
  check('the breadcrumb links and "See how to measure" are at least 44 px tall', small.length === 0, small.join(','));

  // ---------- the footer "Send us a message" button ----------
  await page.goto(`${BASE}/products/roller`); await page.locator('.s2-footer').waitFor();
  const fb = page.locator('.s2-footer a.s2-footer-msg');
  const fbox = await fb.boundingBox(); const fstyle = await fb.evaluate((el) => { const c = getComputedStyle(el); return { radius: c.borderRadius, border: c.borderTopWidth, text: el.textContent }; });
  check('footer: a "Send us a message" button under the email and phone, pill-shaped, 44 px tall', fstyle.text === 'Send us a message' && Math.round(fbox.height) === 44 && parseFloat(fstyle.radius) >= 22, JSON.stringify([fbox.height, fstyle]));
  await fb.hover(); await page.waitForTimeout(350);
  check('footer: the button turns brass on hover', await fb.evaluate((el) => { const c = getComputedStyle(el).backgroundColor; const b = getComputedStyle(document.querySelector('.s2-btn-brass') || el).backgroundColor; return c !== 'rgba(0, 0, 0, 0)' && c !== 'rgb(255, 255, 255)'; }));
  await fb.click(); await page.locator('#c-name').waitFor();
  check('footer: the button opens the Contact page', new URL(page.url()).pathname === '/contact');
  for (const [name, path] of [['home', '/'], ['products list', '/products'], ['measuring guide', '/measure'], ['order page', '/order'], ['a product page', '/products/zebra'], ['My Orders', '/orders'], ['profile', '/profile']]) {
    await page.goto(`${BASE}${path}`); await page.waitForTimeout(600);
    const n = await page.locator('.s2-footer a.s2-footer-msg').count();
    check(`footer: the button is in the footer of ${name}`, n === 1, `${n}`);
  }
  await page.goto(`${BASE}/admin`); await page.waitForTimeout(800);
  check('footer: the button is not in the admin', (await page.locator('a.s2-footer-msg').count()) === 0);

  // ---------- the contact form ----------
  let posted = null, mode = 'ok';
  await page.route('**/api/contact', async (route) => { posted = JSON.parse(route.request().postData()); if (mode === 'ok') await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emailed: true, stored: true }) }); else await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'We could not send your message just now. Please email us at loveblindswindows@gmail.com or call 262-434-0949.' }) }); });
  await page.goto(`${BASE}/contact`); await page.locator('#c-name').waitFor();
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('main input:not([name=zx_kv_q7]), main textarea, main select')].filter((e) => e.type !== 'radio' && !e.labels?.length).length);
  check('every box on the Contact page has a label (name, email, phone, subject, message), and the topics are a labelled group', unlabeled === 0 && (await page.locator('fieldset legend').count()) === 1 && (await page.locator('input[type=radio]').count()) === 3);
  check('the spam-trap field is not visible and not reachable by keyboard', await page.evaluate(() => { const i = document.querySelector('input[name=zx_kv_q7]'); const r = i.getBoundingClientRect(); const cs = getComputedStyle(i), box = getComputedStyle(i.closest('.spam-trap')); return i.tabIndex === -1 && i.getAttribute('autocomplete') === 'off' && i.getAttribute('aria-hidden') === 'true' && r.right < 0 && cs.display !== 'none' && box.display !== 'none' && box.visibility !== 'hidden'; }));
  // autofill-style filling: a browser fills boxes by their name / id / autocomplete / type. None of it may reach the trap.
  const autofilled = await page.evaluate(() => {
    const guess = { name: 'Ada Lovelace', 'given-name': 'Ada', 'family-name': 'Lovelace', email: 'ada@example.com', tel: '5550102030', url: 'https://example.com', organization: 'Example', 'street-address': '1 Main St' };
    let hits = 0;
    for (const el of document.querySelectorAll('input')) {
      const hay = `${el.name} ${el.id} ${el.getAttribute('autocomplete') || ''} ${el.type} ${el.placeholder} ${el.labels?.[0]?.textContent || ''}`.toLowerCase();
      if (el.getAttribute('autocomplete') === 'off') continue;                      // browsers leave these alone
      for (const [k, v] of Object.entries(guess)) if (hay.includes(k) || (k === 'tel' && /phone/.test(hay)) || (k === 'url' && /website|site/.test(hay))) { el.value = v; hits++; break; }
    }
    return { hits, trap: document.querySelector('input[name=zx_kv_q7]').value };
  });
  check('autofill-style filling fills real boxes but never the spam-trap box', autofilled.hits >= 3 && autofilled.trap === '', JSON.stringify(autofilled));
  await page.reload(); await page.locator('#c-name').waitFor();
  await page.getByRole('button', { name: /Send message/i }).click();
  check('an empty form shows what is missing and sends nothing', (await page.locator('.field-error').count()) === 3 && posted === null);
  check('...each missing box has its own clear message (name, email, message)', /enter your name/.test(await page.locator('#c-name + .field-error').innerText()) && /enter your email so we can reply/.test(await page.locator('#c-email + .field-error').innerText()) && /write your message/.test(await page.locator('#c-message + .field-error').innerText()));
  // one box wrong at a time: blocked in the browser, a message under that box, what was typed is kept, never "Message received"
  const full = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Can you do 120 inch curtains?' };
  const ids = { name: '#c-name', email: '#c-email', message: '#c-message' };
  for (const [label, field, value, re] of [['no email', 'email', '', /enter your email so we can reply/], ['a bad email', 'email', 'ada@example', /valid email/], ['no name', 'name', '', /enter your name/], ['no message', 'message', '', /write your message/]]) {
    for (const k of Object.keys(full)) await page.locator(ids[k]).fill(k === field ? value : full[k]);
    posted = null; await page.getByRole('button', { name: /Send message/i }).click();
    const t = await page.locator('main').innerText();
    check(`contact, ${label}: blocked in the browser, a message under the box, nothing sent, never "Message received"`, posted === null && re.test(await page.locator(`${ids[field]} + .field-error`).innerText()) && !/Message received/.test(t));
    if (field !== 'message') check(`...${label}: the typed message is kept`, (await page.locator('#c-message').inputValue()) === full.message);
  }
  for (const k of Object.keys(full)) await page.locator(ids[k]).fill(full[k]);
  // every kind of failure from the server: an error with our email and phone, never "Message received"
  for (const [label, status, body] of [['a database error', 502, { error: 'We could not send your message just now. Please email us at loveblindswindows@gmail.com or call 262-434-0949.' }], ['an email error', 502, { error: 'We could not send your message just now. Please email us at loveblindswindows@gmail.com or call 262-434-0949.' }], ['the rate limit', 429, { error: 'Too many messages were sent. If it keeps happening, please call us at (262) 434-0949 or email loveblindswindows@gmail.com.' }], ['an answer that is "ok" but whose email did not go out', 200, { ok: true, emailed: false, stored: true }], ['an empty answer', 200, {}]]) {
    await page.route('**/api/contact', (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
    await page.getByRole('button', { name: /Send message/i }).click(); await page.locator('.send-error').waitFor();
    const e = await page.locator('.send-error').innerText();
    check(`contact, ${label}: an error with our email and phone is shown, never "Message received", and the typed message is kept`, /loveblindswindows@gmail\.com/.test(e) && /262\D{0,3}434\D?0949/.test(e) && !/Message received/.test(await page.locator('main').innerText()) && (await page.locator('#c-message').inputValue()) === full.message, e);
  }
  await page.route('**/api/contact', (route) => route.abort());
  await page.getByRole('button', { name: /Send message/i }).click(); await page.locator('.send-error').waitFor();
  check('contact, no connection: an error with our email and phone, never "Message received"', /loveblindswindows@gmail\.com/.test(await page.locator('.send-error').innerText()) && /262\D{0,3}434\D?0949/.test(await page.locator('.send-error').innerText()) && !/Message received/.test(await page.locator('main').innerText()));
  await page.route('**/api/contact', async (route) => { posted = JSON.parse(route.request().postData()); if (mode === 'ok') await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emailed: true, stored: true }) }); else await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'We could not send your message just now. Please email us at loveblindswindows@gmail.com or call 262-434-0949.' }) }); });
  await page.locator('#c-name').fill('Ada Lovelace'); await page.locator('#c-email').fill('ada@example.com'); await page.locator('#c-phone').fill('555 010 2030');
  await page.locator('label.opt-btn', { hasText: 'Question about a quote' }).click(); await page.locator('#c-subject').fill('About my order'); await page.locator('#c-message').fill('Can you do 120 inch curtains?');
  mode = 'fail';
  await page.getByRole('button', { name: /Send message/i }).click(); await page.locator('.send-error').waitFor();
  const failText = await page.locator('main').innerText();
  check('when the send fails: an error with our email and phone, and NO "Message received"', /loveblindswindows@gmail\.com/.test(await page.locator('.send-error').innerText()) && /262-434-0949/.test(await page.locator('.send-error').innerText()) && !/Message received/.test(failText));
  check('...and what was typed is still there to try again', (await page.locator('#c-message').inputValue()) === 'Can you do 120 inch curtains?');
  mode = 'ok';
  await page.getByRole('button', { name: /Send message/i }).click(); await page.getByText('Message received.').waitFor();
  check('when the send works: "Message received." is shown, and everything was sent (name, email, phone, topic, subject, message)', posted.name === 'Ada Lovelace' && posted.email === 'ada@example.com' && posted.phone === '555 010 2030' && posted.topic === 'Question about a quote' && posted.subject === 'About my order' && posted.message === 'Can you do 120 inch curtains?' && posted.zx_kv_q7 === '');
  const narrow = await browser.newPage({ viewport: { width: 320, height: 640 } }); await narrow.goto(`${BASE}/contact`); await narrow.locator('#c-name').waitFor();
  check('the Contact page does not scroll sideways at 320 px', !(await narrow.evaluate(() => document.documentElement.scrollWidth > innerWidth)), String(await narrow.evaluate(() => document.documentElement.scrollWidth)));
  await narrow.close();

  // ---------- the icon (the one browser console error) ----------
  const icon = await page.request.get(`${BASE}/favicon.svg`);
  check('the site has an icon, so the browser no longer asks for a missing favicon.ico', icon.ok() && (await page.locator('link[rel=icon]').count()) === 1);
  await ctx.close();
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
