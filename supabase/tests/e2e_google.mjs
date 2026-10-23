// Browser test of the Google sign-in wiring (no real Google account is used): Google's script is replaced by a small stand-in that
// records what the site asks of it. Checks that the site asks Google to render the personalized button in the top bar, at the start
// of "Your details" and in the cart panel, asks for One Tap, and that the credential Google hands back is exchanged for a Supabase
// session (an ID token request carrying the nonce), with the guest's cart kept. Also that without Google's script every button still
// works (redirect sign-in).
// Needs a preview of a build made WITH a client id:  VITE_GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com npx vite build --outDir dist-gis
// then  npx vite preview --outDir dist-gis --port 4174   and   BASE_URL=http://localhost:4174 node supabase/tests/e2e_google.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4174';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `\n      ${detail}` : ''}`); };

const STUB = `
window.__gsi = { init: null, buttons: [], prompts: 0 };
window.google = { accounts: { id: {
  initialize(o) { window.__gsi.init = o; },
  renderButton(el, o) { window.__gsi.buttons.push(o); el.innerHTML = '<div class="fake-gsi" role="button" tabindex="0">Sign in as Ada (fake Google button)</div>'; },
  prompt() { window.__gsi.prompts += 1; }, cancel() {}, disableAutoSelect() {},
} } };`;

const browser = await chromium.launch();
try {
  // ---------- with Google's script
  for (const width of [1280, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } }); const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const T = (s) => `[${width}px] ${s}`;
    const tokenCalls = []; let guestAtToken = null;
    await page.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
    await page.route('**/auth/v1/authorize**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'redirected' }));
    await page.route('**/auth/v1/token?grant_type=id_token', async (r) => { tokenCalls.push(JSON.parse(r.request().postData())); guestAtToken = await page.evaluate(() => localStorage.getItem('lb_guest_quote')); await r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'stub' }) }); });
    await page.goto(`${BASE}/`); await page.waitForFunction(() => window.__gsi?.init);
    const init = await page.evaluate(() => ({ id: window.__gsi.init.client_id, nonce: window.__gsi.init.nonce, fedcm: window.__gsi.init.use_fedcm_for_prompt, auto: window.__gsi.init.auto_select }));
    check(T('Google is initialised with the client id, a hashed nonce, FedCM and no auto sign-in'), init.id === 'test-client.apps.googleusercontent.com' && /^[0-9a-f]{64}$/.test(init.nonce) && init.fedcm === true && init.auto === false, JSON.stringify(init));
    await page.waitForFunction(() => window.__gsi.prompts >= 1);
    check(T('One Tap is asked for when signed out'), true);
    if (width >= 760) {
      await page.locator('.s2-nav .fake-gsi').waitFor();
      check(T('desktop: the top bar button is Google\'s own (personalized) button, "Sign in" text, and our button is hidden'), (await page.locator('.s2-nav .gsi-btn').count()) === 0 && (await page.evaluate(() => window.__gsi.buttons[0].text)) === 'signin', JSON.stringify(await page.evaluate(() => window.__gsi.buttons)));
    } else {
      check(T('phone: the top bar keeps the compact Google "Sign in" button (One Tap does the personalizing)'), (await page.locator('.s2-nav .gsi-btn').count()) === 1 && (await page.locator('.s2-nav .fake-gsi').count()) === 0);
    }
    // a cart item, then the places that carry the button
    await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').first().click();
    await page.locator('#s2-w').fill('30'); await page.locator('#s2-h').fill('50'); await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled);
    await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();
    await page.locator('.s2-bar-order').click(); await page.locator('.s2-panel .fake-gsi').waitFor();
    check(T('the cart panel carries Google\'s button under "Sign in with Google to save your cart"'), /Sign in with Google to save your cart/.test(await page.locator('.s2-panel').innerText()));
    await page.locator('.s2-panel-go').click(); await page.locator('.s2-details-signin .fake-gsi').waitFor();
    const last = await page.evaluate(() => window.__gsi.buttons.at(-1));
    check(T('"Your details" starts with Google\'s button ("continue with")'), last.text === 'continue_with' && last.type === 'standard');
    // Google hands back a credential
    await page.evaluate(() => window.__gsi.init.callback({ credential: 'fake.id.token' }));
    await page.waitForTimeout(2500);
    check(T('the credential is exchanged for a session: an ID token request with the token and the raw nonce'), tokenCalls.length >= 1 && tokenCalls[0].id_token === 'fake.id.token' && tokenCalls[0].provider === 'google' && /^[0-9a-f]{32}$/.test(tokenCalls[0].nonce || ''), JSON.stringify(tokenCalls));
    check(T('the guest\'s cart is saved before the token is exchanged, so it survives sign-in'), !!guestAtToken && JSON.parse(guestAtToken).length === 1, String(guestAtToken));
    await ctx.close();
  }
  // ---------- Google's script cannot load: the buttons still work
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    await page.route('https://accounts.google.com/**', (r) => r.abort());
    let redirected = false;
    await page.route('**/auth/v1/authorize**', async (r) => { redirected = true; await r.fulfill({ status: 200, contentType: 'text/html', body: 'redirected' }); });
    await page.goto(`${BASE}/`); await page.locator('.s2-nav .gsi-btn').waitFor(); await page.waitForTimeout(800);
    check('if Google\'s script is blocked, our own "Sign in" button stays, and it starts the Google redirect sign-in', (await page.locator('.s2-nav .gsi-btn').count()) === 1);
    await page.locator('.s2-nav .gsi-btn').click(); await page.waitForTimeout(1500);
    check('...and clicking it goes to Supabase\'s Google sign-in', redirected);
    await ctx.close();
  }
} finally { await browser.close(); }
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
