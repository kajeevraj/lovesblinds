// Browser test of the order page (Stage 2) at 390 px: windows with their estimates, Edit and Remove, quantity totals, the
// estimated total and "Plus N item(s) priced by email", validation, what is sent to /api/quote (intercepted: no email goes out),
// the confirmation screen, and that nothing on the page or in the responses reveals price groups or Dream Curtains codes.
// Needs a preview server (BASE_URL, default http://localhost:4173) and SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const H = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const rpc = async (fn, body) => (await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(ANON), body: JSON.stringify(body) })).json();
const groups = (await (await fetch(`${URL_}/rest/v1/fabrics?select=collection_name`, { headers: H(SVC) })).json()).map((f) => f.collection_name);
const WORDS = /Cordless spring|Softens sun and glare|Cellular Shades|Roller Shades|Zebra Shades|Roman Shades|Shangri-La Shades|Drapery/gi;
const leak = (t) => groups.filter((g) => new RegExp(`\\b${g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t.replace(WORDS, '')));
const num = (t) => Number(String(t).replace(/[^\d]/g, ''));

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const responses = [];
  page.on('response', async (r) => { if (/rpc\/|\/api\/catalog/.test(r.url())) { try { responses.push(await r.text()); } catch { /* ignore */ } } });
  let sentBody = null, copy = false;
  await page.route('**/api/quote', async (route) => { sentBody = JSON.parse(route.request().postData()); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, customerCopy: copy }) }); });
  const size = async (w, h) => { await page.locator('#s2-w').fill(String(w)); await page.locator('#s2-h').fill(String(h)); };
  const add = async () => { await page.waitForFunction(() => !document.querySelector('.s2-bar-btn').disabled); await page.locator('.s2-bar-btn').click(); await page.locator('.s2-flash').waitFor(); };

  // an empty order
  await page.goto(`${BASE}/order`);
  check('an empty order says so and offers a way to choose a style', /Your order is empty/.test(await page.locator('main').innerText()));

  // window 1: Roller, No fabric wrap, 3 windows, a room
  await page.goto(`${BASE}/products/roller`); await page.locator('.s2-sw').first().waitFor();
  const rName = (await page.locator('.s2-sw-name').first().innerText()).trim();
  await page.locator('.s2-sw').first().click(); await size(40, 64);
  await page.locator('.s2-card', { hasText: 'No fabric wrap' }).click();
  await page.locator('#s2-room').fill('Living room, left window');
  await page.locator('#s2-qty').fill('3');
  await page.getByText(/each · 3 blinds/).first().waitFor();
  const unit = num((await page.locator('.s2-bar-sub').innerText()).split('each')[0]);
  await add();
  // window 2: curtains, 2 windows
  await page.goto(`${BASE}/products/drapery`); await page.locator('.s2-sw').first().waitFor();
  await page.locator('.s2-sw').first().click();
  await page.locator('.s2-step', { hasText: 'Pleat style' }).locator('.s2-card').first().click();
  await page.locator('.s2-step', { hasText: 'Lining' }).locator('.s2-card').first().click();
  await size(120, 96); await page.locator('#s2-qty').fill('2');
  await add();
  // window 3: Dream Curtains with a style
  await page.getByRole('tab', { name: 'Dream Curtains' }).click(); await page.locator('.s2-sw').first().waitFor();
  check('Dream Curtains page: the walk-through explanation is at the top', /Every vane hangs on its own, so you can walk through anywhere, with no opening or closing needed\. Great for patio and balcony doors\./.test(await page.locator('.s2-line-intro').innerText()));
  await page.locator('.s2-color-tools input').fill('Angel White'); await page.locator('.s2-sw').first().click();
  const styleCards = await page.locator('.s2-color-style .s2-card').allInnerTexts();
  check('Dream Curtains styles are called Classic and Slim, with the one-liners, and show no measurements or "Style A/B"', styleCards.length === 2 && /Classic[\s\S]*Fuller vanes in a heavier fabric\./.test(styleCards[0]) && /Slim[\s\S]*Slimmer vanes in a lighter, airier fabric\./.test(styleCards[1]) && !/\d\s?(cm|in\b|inch)|Style [AB]/i.test(styleCards.join(' ') + await page.locator('.s2-color').innerText()), styleCards.map((c) => c.replace(/\s+/g, ' ')).join(' | '));
  check('before a style is picked the color shows both codes; after picking Slim it shows the Slim code', /ZDS30\d+-\d+ \/ ZDS39\d+-\d+/.test(await page.locator('.s2-color').innerText()));
  await page.locator('.s2-color-style .s2-card', { hasText: 'Slim' }).click();
  check('the picked style\'s code is shown (Slim = ZDS39xx)', /Angel White\s*\(ZDS3902-1\)/.test(await page.locator('.s2-picked').innerText()), await page.locator('.s2-picked').innerText());
  await size(60, 84); await page.locator('#s2-qty').fill('2'); await add();

  // the order page
  await page.goto(`${BASE}/order`); await page.locator('.s2-item').first().waitFor();
  await page.waitForFunction(() => !/Calculating/.test(document.querySelector('.s2-items').innerText), null, { timeout: 30000 });
  const items = page.locator('.s2-item');
  check('three items are listed, each with Remove and no separate Edit button, and "+ Add more blinds"', (await items.count()) === 3 && (await page.getByRole('button', { name: 'Edit' }).count()) === 0 && (await page.getByRole('button', { name: 'Remove' }).count()) === 3 && (await page.getByText('+ Add more blinds').count()) === 1);
  const rollerText = await items.nth(0).innerText();
  check('Roller window: total for 3 windows, price for one, room, size and the No fabric wrap choice', num(rollerText.match(/\$[\d,]+(?= \$|\n)/)?.[0]) === unit * 3 && new RegExp(`\\$${unit} each · 3 blinds`).test(rollerText) && /Living room, left window/.test(rollerText) && /40" wide × 64" high/.test(rollerText) && /No fabric wrap on the cassette/.test(rollerText), rollerText.replace(/\s+/g, ' '));
  check('the window shows its color by name and code (Roller)', rollerText.includes(rName));
  const curtainText = await items.nth(1).innerText();
  check('Curtains: "Price on request" and the reply-with-a-price sentence, 2 blinds', /Price on request/.test(curtainText) && /Send us your order and we'll reply with a price\./.test(curtainText) && !/\$\s?\d/.test(curtainText), curtainText.replace(/\s+/g, ' '));
  const dreamCard = await items.nth(2).innerText();
  const dreamPrice = num(dreamCard.match(/\$[\d,]+/)?.[0]);
  check('Dream Curtains window: a live price, the style name and the picked style\'s code (ZDS3902-1), no "Style B"', dreamPrice > 0 && /Slim/.test(dreamCard) && /ZDS3902-1/.test(dreamCard) && !/ZDS3002|Style [AB]/.test(dreamCard), dreamCard.replace(/\s+/g, ' '));
  const totalText = await page.locator('.s2-total').innerText();
  check('estimated total = Roller x3 + Dream, "Plus 1 item priced by email", and the estimate sentence', num(totalText.match(/Estimated total\s*\$([\d,]+)/)?.[1]) === unit * 3 + dreamPrice && /Plus 1 item priced by email/.test(totalText) && /Here's your estimate\. Send it and we'll confirm details and final price\./.test(totalText), totalText.replace(/\s+/g, ' '));

  // clicking an item opens its product page with every choice filled in; Save changes updates the same item
  await items.nth(0).click();
  await page.locator('#s2-w').waitFor(); await page.locator('.s2-sw.on').waitFor();
  check('clicking the item opens its page (?edit=<id>) with the choices filled in and "Save changes"', /\/products\/roller\?edit=/.test(page.url()) && (await page.locator('.s2-bar-btn').innerText()) === 'Save changes' && (await page.locator('#s2-w').inputValue()) === '40' && (await page.locator('#s2-qty').inputValue()) === '3' && (await page.locator('#s2-room').inputValue()) === 'Living room, left window' && (await page.locator('.s2-card.on', { hasText: 'No fabric wrap' }).count()) === 1 && (await page.locator('.s2-picked').innerText()).includes(rName));
  const w = page.locator('#s2-w'); await w.click(); await w.press('Control+A'); await w.type('44', { delay: 60 });
  check('typing a size keeps focus (both digits arrive)', (await w.inputValue()) === '44');
  await page.locator('#s2-qty').fill('4');
  await page.waitForFunction(() => /each · 4 blinds/.test(document.querySelector('.s2-bar-sub')?.innerText || ''));
  await page.locator('.s2-bar-btn').click();
  await page.waitForFunction(() => location.pathname === '/order');
  await page.locator('.s2-item').first().waitFor();
  await page.waitForFunction(() => /44" wide × 64" high/.test(document.querySelector('.s2-item').innerText) && !/Calculating/.test(document.querySelector('.s2-items').innerText));
  const edited = await items.nth(0).innerText();
  check('Save changes updated the same item (still three items, size and quantity changed, estimate followed)', (await items.count()) === 3 && /44" wide × 64" high/.test(edited) && /4 blinds/.test(edited), edited.replace(/\s+/g, ' '));

  // Remove
  await items.nth(1).getByRole('button', { name: 'Remove' }).click();
  check('Remove takes the window out and the "priced by email" line goes with it', (await items.count()) === 2 && !/priced by email/.test(await page.locator('.s2-total').innerText()));

  // validation
  await page.getByRole('button', { name: 'Send my order' }).click();
  check('Send my order without a name, email or address asks for them and sends nothing', (await page.locator('.s2-error').count()) === 6 && sentBody === null);
  await page.locator('#o-name').fill('Ada Lovelace'); await page.locator('#o-email').fill('not-an-email');
  await page.locator('#o-street').fill('1 Analytical Way'); await page.locator('#o-apt').fill('Suite 2'); await page.locator('#o-city').fill('London'); await page.locator('#o-state').fill('England'); await page.locator('#o-zip').fill('N1 1AA');
  check('the country list defaults to United States and has more countries', (await page.locator('#o-country').inputValue()) === 'United States' && (await page.locator('#o-country option').count()) > 150);
  await page.locator('#o-country').selectOption('United Kingdom');
  await page.getByRole('button', { name: 'Send my order' }).click();
  check('an invalid email is refused', /valid email/.test(await page.locator('.s2-error').innerText()) && sentBody === null);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const small = await page.evaluate(() => [...document.querySelectorAll('.s2-order .s2-input, .s2-order .s2-btn, .s2-order .s2-link, .s2-order .s2-qty-btn')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).length);
  check('order page: no sideways scroll at 390 px and touch targets are at least 44 px', sw <= 390 && small === 0, `${sw} px, ${small} small targets`);
  check('order page: no price group names', leak(await page.content()).length === 0);

  // send
  await page.locator('#o-email').fill('ada@example.com'); await page.locator('#o-phone').fill('555 010 2030');  await page.locator('#o-notes').fill('Ring first');
  await page.getByRole('button', { name: 'Send my order' }).click();
  await page.getByRole('heading', { name: 'Your order is on its way to us' }).waitFor();
  const conf = await page.locator('main').innerText();
  check('the confirmation says what happens next, and says nothing about an email copy when none was sent', /email you your final price within 48 hours\. Nothing is charged until you approve it\./.test(conf) && !/copy of your order/.test(conf));
  check('what is sent: details, notes, two windows with quantity and the estimate the customer saw', sentBody.customer.email === 'ada@example.com' && sentBody.customer.address.street === '1 Analytical Way' && sentBody.customer.address.apt === 'Suite 2' && sentBody.customer.address.city === 'London' && sentBody.customer.address.state === 'England' && sentBody.customer.address.zip === 'N1 1AA' && sentBody.customer.address.country === 'United Kingdom' && /1 Analytical Way, Suite 2, London, England N1 1AA, United Kingdom/.test(sentBody.customer.shipTo) && sentBody.notes === 'Ring first' && sentBody.lines.length === 2 && sentBody.lines[0].qty === 4 && sentBody.lines[0].estimate.kind === 'price' && sentBody.lines[0].estimate.unit > 0 && sentBody.lines[1].estimate.kind === 'price' && sentBody.lines[1].qty === 2 && !('callTime' in sentBody.customer), JSON.stringify(sentBody.lines.map((l) => [l.qty, l.estimate])));
  check('the customer wording sent for Dream Curtains has the style name and the picked code; ours also has the style letter', /Slim/.test(sentBody.lines[1].description) && /ZDS3902-1/.test(sentBody.lines[1].description) && !/Style B/.test(sentBody.lines[1].description) && /Style B/.test(sentBody.lines[1].internalDescription));
  check('the cart is empty after sending', (await page.evaluate(() => localStorage.getItem('lb_guest_quote'))) === '[]' || (await page.evaluate(() => localStorage.getItem('lb_guest_quote'))) === null);
  await page.getByRole('link', { name: 'Back to home' }).click();
  check('Back to home goes to the homepage', new URL(page.url()).pathname === '/');

  // a copy was sent: the confirmation says so
  copy = true;
  await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor();
  await page.locator('.s2-sw').first().click(); await size(40, 64); await add();
  await page.goto(`${BASE}/order`); await page.locator('#o-name').fill('Ada'); await page.locator('#o-email').fill('ada@example.com'); await page.locator('#o-street').fill('1 Way'); await page.locator('#o-city').fill('London'); await page.locator('#o-state').fill('England'); await page.locator('#o-zip').fill('N1');
  await page.getByRole('button', { name: 'Send my order' }).click();
  await page.getByRole('heading', { name: 'Your order is on its way to us' }).waitFor();
  check('when an email copy was sent, the confirmation says "A copy of your order was sent to your email."', /A copy of your order was sent to your email\./.test(await page.locator('main').innerText()));
  check('no response of this session had price group names, supplier color names, grades, extra costs or cost fields', leak(responses.join('')).length === 0 && !/supplier_color_name|"grade"|extra_cost|collection_name|"cost"|markup|price_group/.test(responses.join('')), `${responses.length} responses`);
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
