// Browser tests for the deep-review branch: the privacy and terms pages, the "Page not found" page, and the footer links.
// Needs a preview on BASE_URL (default http://localhost:4173).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch();
try {
  for (const [label, vp] of [['390px', { width: 390, height: 844 }], ['1280px', { width: 1280, height: 800 }]]) {
    const page = await (await browser.newContext({ viewport: vp })).newPage(); page.setDefaultTimeout(30000);
    await page.goto(`${BASE}/`); await page.locator('.s2-footer-legal').waitFor();
    check(`[${label}] the footer has Privacy policy and Terms of sale links`, (await page.locator('.s2-footer-legal a').allInnerTexts()).join('|') === 'Privacy policy|Terms of sale');
    await page.getByRole('link', { name: 'Privacy policy' }).click(); await page.locator('h1').waitFor();
    const priv = await page.locator('main').innerText();
    check(`[${label}] the privacy page names Google, Supabase, Vercel and Resend, the data we keep, and says no payment is taken`, page.url().endsWith('/privacy') && ['Google', 'Supabase', 'Vercel', 'Resend', 'name, email, phone number and shipping address', 'messages', 'do not take payment'].every((t) => new RegExp(t, 'i').test(priv)));
    check(`[${label}] the privacy page is not indexed and has the yellow placeholders`, (await page.locator('meta[name=robots]').getAttribute('content')) === 'noindex, nofollow' && (await page.locator('.legal-todo').count()) > 0);
    await page.goto(`${BASE}/terms`); await page.locator('h1').waitFor();
    const terms = await page.locator('main').innerText();
    check(`[${label}] the terms page covers estimates, final price in 48 hours, returns, warranty and lead times`, /estimate/i.test(terms) && /48 hours/.test(terms) && /Returns/.test(terms) && /Warranty/.test(terms) && /Lead times/.test(terms) && /No payment is taken/.test(terms));
    await page.goto(`${BASE}/definitely-not-a-page`); await page.locator('h1').waitFor();
    check(`[${label}] an unknown address shows "Page not found" (no redirect), with links to Products and Contact`, page.url().endsWith('/definitely-not-a-page') && (await page.locator('h1').innerText()) === 'Page not found' && await page.getByRole('link', { name: 'See products' }).isVisible() && await page.getByRole('link', { name: 'Contact us' }).isVisible() && (await page.title()).startsWith('Page not found'));
    await page.getByRole('link', { name: 'See products' }).click(); await page.waitForURL('**/products');
    check(`[${label}] See products goes to Products`, page.url().endsWith('/products'));
    await page.goto(`${BASE}/products/nope`); await page.waitForURL('**/products');
    check(`[${label}] an unknown product still lands on Products`, page.url().endsWith('/products'));
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`[${label}] no sideways scroll`, ov <= 0);
    await page.close();
  }
} catch (e) { console.log('TEST ERROR:', e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser.close();
const bad = results.filter((x) => !x.ok);
console.log(`${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
