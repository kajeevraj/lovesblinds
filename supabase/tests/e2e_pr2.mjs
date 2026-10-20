// Browser and build tests for pull request 2: the restyled inner pages (Products list, Contact, Measuring guide, My Orders, Profile),
// a title and description for every page, the share picture, the sitemap and the product data. Needs `npm run build` and a preview on
// BASE_URL (default http://localhost:4173); the signed-in pages use a temporary customer (needs the three env vars; skipped without).
import { readFileSync, existsSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const sharp = (await import('sharp')).default;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const LINES = ['roller', 'zebra', 'shangri-la', 'roman', 'cellular', 'drapery'];
const SUPPLIER = /price group|priceGroup|supplier|wholesale cost|cost_|ZDS\d|\bgrid\b|markup/i;

// ---------- the built HTML (what Google and link previews see: no scripts run) ----------
const html = (p) => readFileSync(`dist${p === '/' ? '' : p}/index.html`, 'utf8');
const tag = (h, re) => (h.match(re) || [])[1];
const pages = [['/', 'home'], ['/products', 'products'], ...LINES.map((l) => [`/products/${l}`, l]), ['/measure', 'measure'], ['/contact', 'contact'], ['/order', 'order'], ['/orders', 'orders'], ['/profile', 'profile']];
const titles = new Map(), descs = new Map();
for (const [p, label] of pages) {
  const h = html(p);
  const t = tag(h, /<title>([^<]*)<\/title>/), d = tag(h, /<meta name="description" content="([^"]*)"/);
  const og = tag(h, /<meta property="og:image" content="([^"]*)"/), canon = tag(h, /<link rel="canonical" href="([^"]*)"/);
  titles.set(t, label); descs.set(d, label);
  check(`build: ${label} has its own title, a description of a sensible length, a canonical address and the share picture in the HTML itself`, !!t && t.length <= 70 && !!d && d.length >= (['order', 'orders', 'profile'].includes(label) ? 20 : 70) && d.length <= 165 && canon === `https://lovesblinds.com${p === '/' ? '' : p}`.replace(/^(https:\/\/lovesblinds\.com)$/, '$1/') && og === 'https://lovesblinds.com/og-image.jpg' && /twitter:card" content="summary_large_image/.test(h), `${t} / ${d?.length} / ${canon}`);
  check(`build: ${label} has no em dash and nothing from the supplier in its tags`, !/—/.test(t + d) && !SUPPLIER.test(h.slice(h.indexOf('<!--seo-start-->'), h.indexOf('<!--seo-end-->'))));
}
check('build: every page has a different title and a different description', titles.size === pages.length && descs.size === pages.length);
check('build: only the order, My Orders and Profile pages are marked noindex', pages.every(([p, l]) => /name="robots" content="noindex/.test(html(p)) === ['order', 'orders', 'profile'].includes(l)));
const ld = (p) => [...html(p).matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/\\u003c/g, '<')));
for (const l of LINES) {
  const j = ld(`/products/${l}`);
  check(`build: ${l} page has valid Product data (name, description, picture, brand) and no price`, j.length === 1 && j[0]['@type'] === 'Product' && !!j[0].name && j[0].description.length > 40 && /^https:\/\/lovesblinds\.com\/images\/site\/.+\.webp$/.test(j[0].image) && j[0].brand.name === "Love's Blinds" && !j[0].offers && existsSync(`dist${new URL(j[0].image).pathname}`), JSON.stringify(j[0])?.slice(0, 120));
}
check('build: the home page has Organization data and the other pages none', ld('/')[0]?.['@type'] === 'Organization' && ld('/products').length === 0 && ld('/contact').length === 0);
const sm = readFileSync('dist/sitemap.xml', 'utf8'); const urls = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
check('build: the sitemap lists the home page, the Products list, the six product pages, the measuring guide and Contact (and nothing else)', urls.length === 10 && ['/', '/products', '/measure', '/contact', ...LINES.map((l) => `/products/${l}`)].every((p) => urls.includes(`https://lovesblinds.com${p}`)) && !/orders|profile|admin|\/order</.test(sm));
check('build: robots.txt points to the sitemap and keeps the admin and API out', /Sitemap: https:\/\/lovesblinds\.com\/sitemap\.xml/.test(readFileSync('dist/robots.txt', 'utf8')) && /Disallow: \/admin/.test(readFileSync('dist/robots.txt', 'utf8')));
const meta = await sharp('dist/og-image.jpg').metadata();
check('build: the share picture is 1200 x 630 and under 300 KB', meta.width === 1200 && meta.height === 630 && readFileSync('dist/og-image.jpg').length < 300000, `${meta.width}x${meta.height}, ${readFileSync('dist/og-image.jpg').length} bytes`);
const hero = await sharp('assets/photos/hero-living.jpg').resize(1200, 630, { fit: 'cover', position: 'attention' }).raw().toBuffer({ resolveWithObject: false });
const got = await sharp('dist/og-image.jpg').raw().toBuffer(); let diff = 0; for (let i = 0; i < hero.length; i += 97) diff += Math.abs(hero[i] - got[i]);
check('build: the share picture is the homepage hero', diff / (hero.length / 97) < 6, `average difference ${(diff / (hero.length / 97)).toFixed(2)}`);

// ---------- in the browser ----------
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); page.setDefaultTimeout(20000);
const head = () => page.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name=description]')?.content, robots: document.querySelector('meta[name=robots]')?.content || null, canon: document.querySelector('link[rel=canonical]')?.href, og: document.querySelector('meta[property="og:image"]')?.content, ld: [...document.querySelectorAll('script[type="application/ld+json"]')].length }));
const seen = new Set();
for (const [p, label] of pages) {
  await page.goto(`${BASE}${p}`); await page.waitForTimeout(500); const h = await head(); seen.add(h.title);
  const built = tag(html(p), /<title>([^<]*)<\/title>/);
  check(`browser: ${label}: the tab title is the page's own and matches the HTML`, h.title === built, h.title);
}
check('browser: every page has a different tab title', seen.size === pages.length);
await page.goto(`${BASE}/`); await page.waitForTimeout(400);
await page.locator('.s2-nav-links a', { hasText: 'Contact' }).first().click(); await page.waitForTimeout(300);
let h = await head();
check('moving between pages without reloading updates the title, description, address and share tags', h.title === 'Contact us | Love\'s Blinds' && /Send us a message|Send us/.test(h.desc) && h.canon.endsWith('/contact') && h.og.endsWith('/og-image.jpg') && h.robots === null, JSON.stringify(h));
await page.goto(`${BASE}/products/zebra`); await page.waitForTimeout(500); h = await head();
check('a product page in the browser has one Product data block, and leaving it removes it', h.ld === 1 && (await page.evaluate(() => { history.pushState({}, '', '/products'); dispatchEvent(new PopStateEvent('popstate')); return 1; })) && (await page.waitForTimeout(400), (await head()).ld === 0));
await page.goto(`${BASE}/orders`); await page.waitForTimeout(500); h = await head();
check('browser: My Orders is marked noindex, and Products is not', h.robots === 'noindex, nofollow' && (await (async () => { await page.goto(`${BASE}/products`); await page.waitForTimeout(400); return (await head()).robots === null; })()));
await ctx.close();

// ---------- measuring guide content, phone top bar, contact topics ----------
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); const pg = await c.newPage(); pg.setDefaultTimeout(20000);
  await pg.goto(`${BASE}/measure`); await pg.locator('h1').waitFor();
  const heads = await pg.locator('.measure-block h2').allInnerTexts();
  check('measuring guide: has Inside mount, Outside mount and Curtains and Dream Curtains step by step sections (all visible, no toggle)', ['Inside mount, step by step', 'Outside mount, step by step', 'Curtains and Dream Curtains, step by step'].every((t) => heads.some((h) => h.includes(t))) && (await pg.locator('.mount-tab').count()) === 0, heads.join(' | '));
  const text = await pg.locator('.measure-main').innerText();
  const need = ["Don't add anything for overlap, we'll add it for you.", "Don't add or subtract anything, we'll work out the overlap and floor gap.", 'outside edge to outside edge', 'From the top of the frame down to the bottom of the sill or frame', 'From the spot where the track or rod will go, straight down to the floor', "Don't make any deductions."];
  check('measuring guide: outside mount and curtains only ask the customer to measure, with the exact "we do the calculations" sentences, and the "Don\'t make any deductions" tip stays', need.every((t) => text.includes(t)), need.filter((t) => !text.includes(t)).join(' | '));
  check('measuring guide: width steps say to measure at the top, middle and bottom (outside mount and curtains), never "measure once"', (await pg.locator('#outside .meas-step').first().innerText()).includes('Measure at the top, middle and bottom, and use the widest number.') && (await pg.locator('#curtains .meas-step').first().innerText()).includes('Measure at the top, middle and bottom, and use the widest number.') && !/Measure once/.test(text));
  check('measuring guide: the curtain height label is "Track or rod to floor · measure in 3 places"', text.includes('Track or rod to floor · measure in 3 places') && !/height × 3/.test(await pg.locator('#curtains').innerText()));
  const outside = await pg.locator('#outside').innerText(), curtains = await pg.locator('#curtains').innerText();
  const bad = /add (the )?overlap|\d+(\.\d+)? inch(es)? (on each|above|below|in total|in each|by default)|bracket|clearance|0\.8|3\"|2\"|1\.5|inches on each side|plus \d/i;
  check('measuring guide: no instruction anywhere to add overlap, clearance or a floor gap (no overlap, clearance or bracket numbers)', !bad.test(outside.replace("Don't add anything for overlap, we'll add it for you.", '')) && !bad.test(curtains.replace("Don't add or subtract anything, we'll work out the overlap and floor gap.", '')) && !/Add the overlap|Leave the floor gap|Check for clearance|Choose where the shade starts/.test(text), (outside + curtains).match(bad)?.[0] || '');
  check('measuring guide: the three step sections have numbered steps (inside 4, outside 3, curtains 3)', (await pg.locator('#inside .meas-step').count()) === 4 && (await pg.locator('#outside .meas-step').count()) === 3 && (await pg.locator('#curtains .meas-step').count()) === 3);
  check('measuring guide: the table of contents links to every section', (await pg.locator('.measure-toc-list a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).join() === '#tools,#choose,#inside,#outside,#curtains,#tips,#submit' && (await pg.locator('#submit').count()) === 1);
  await pg.waitForTimeout(800);
  const figs = await pg.evaluate(() => [...document.querySelectorAll('.measure-figures figure')].map((f) => { const i = f.querySelector('img'); const cap = f.querySelector('figcaption'); return { loaded: i.complete && i.naturalWidth > 0, lazy: i.loading, extra: Math.round(f.getBoundingClientRect().height - i.getBoundingClientRect().height - cap.getBoundingClientRect().height) }; }));
  check('measuring guide on a phone: both diagrams are loaded without scrolling and there is no empty space under them (only padding and the caption)', figs.length === 2 && figs.every((f) => f.loaded && f.lazy === 'eager' && f.extra <= 50), JSON.stringify(figs));
  await c.close();
  for (const width of [390, 320]) {
    const cx = await browser.newContext({ viewport: { width, height: 800 } }); const pg2 = await cx.newPage(); await pg2.goto(`${BASE}/`); await pg2.locator('.s2-nav-links a').first().waitFor(); await pg2.waitForTimeout(400);
    const n = await pg2.evaluate((w) => { const links = [...document.querySelectorAll('.s2-nav-links a')]; const box = document.querySelector('.s2-nav-links'); return { names: links.map((a) => a.textContent), inView: links.every((a) => { const r = a.getBoundingClientRect(); return r.left >= 0 && r.right <= w && r.width > 0; }), noScroll: box.scrollWidth <= box.clientWidth && document.documentElement.scrollWidth <= w, tall: links.every((a) => a.getBoundingClientRect().height >= 43.5), rows: new Set(links.map((a) => Math.round(a.getBoundingClientRect().top))).size }; }, width);
    check(`[${width}px] top bar: Products, How to measure, How it works and Contact are all visible with no sideways scrolling (${width === 390 ? 'one line' : 'may wrap'}), each 44 px tall`, n.names.join('|') === 'Products|How to measure|How it works|Contact' && n.inView && n.noScroll && n.tall && (width === 320 || n.rows === 1), JSON.stringify(n));
    for (const path of ['/products', '/measure', '/contact', '/products/roller']) { await pg2.goto(`${BASE}${path}`); await pg2.waitForTimeout(500); const ok = await pg2.evaluate((w) => [...document.querySelectorAll('.s2-nav-links a')].every((a) => { const r = a.getBoundingClientRect(); return r.left >= 0 && r.right <= w; }) && document.documentElement.scrollWidth <= w, width); if (!ok) check(`[${width}px] top bar on ${path}`, false); }
    await cx.close();
  }
  const cc = await browser.newContext({ viewport: { width: 390, height: 800 } }); const pg3 = await cc.newPage(); await pg3.goto(`${BASE}/contact`); await pg3.locator('fieldset legend').waitFor();
  const topics = await pg3.locator('.contact-topics label').allInnerTexts();
  check('contact: the topics are General question, Question about an order or estimate, Trade / wholesale', topics.join('|') === 'General question|Question about an order or estimate|Trade / wholesale', topics.join('|'));
  await cc.close();
}

// ---------- the restyled pages: new design at 320, 390 and 1280 ----------
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
let uid, token;
const H = (k, b = k) => ({ apikey: k, Authorization: `Bearer ${b}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, h, b) => { const r = await fetch(URL_ + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
if (URL_ && ANON && SVC) {
  const email = `zz-pr2-${Date.now()}@example.com`, password = `Tmp-${crypto.randomUUID()}`;
  uid = (await api('POST', '/auth/v1/admin/users', H(SVC), { email, password, email_confirm: true, user_metadata: { full_name: 'Ada Lovelace' } })).id;
  token = await api('POST', '/auth/v1/token?grant_type=password', H(ANON), { email, password });
  const UH = H(ANON, token.access_token);
  await api('POST', '/rest/v1/orders', UH, { user_id: uid, name: 'Bedroom blinds', status: 'draft', items: [] });
}
const ref = URL_ ? new URL(URL_).hostname.split('.')[0] : '';
try {
  for (const width of [320, 390, 1280]) {
    for (const [label, path, signedIn] of [['Products list', '/products', false], ['Contact', '/contact', false], ['Measuring guide', '/measure', false], ['My Orders (signed out)', '/orders', false], ['Profile (signed out)', '/profile', false], ['My Orders', '/orders', true], ['Profile', '/profile', true]]) {
      if (signedIn && !token) continue;
      const c = await browser.newContext({ viewport: { width, height: 900 } });
      if (signedIn) await c.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('zz')) { localStorage.setItem(k, v); sessionStorage.setItem('zz', '1'); } } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(token)]);
      const pg = await c.newPage(); pg.setDefaultTimeout(20000); await pg.goto(`${BASE}${path}`); await pg.locator('h1').first().waitFor(); await pg.waitForTimeout(signedIn ? 2000 : 700);
      const r = await pg.evaluate(() => {
        const q = (s) => [...document.querySelectorAll(s)];
        const h1 = document.querySelector('h1'); const cs = getComputedStyle(h1);
        const levels = q('h1,h2,h3,h4').map((e) => +e.tagName[1]); let skip = 0; for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skip++;
        const small = q('main a, main button, main input:not([type=radio]):not([name=zx_kv_q7]), main textarea, .s2-inner .s2-btn').filter((e) => e.offsetParent && !e.closest('.spam-trap') && !e.closest('.measure-toc-list') && !e.matches('.s2-link') && e.getBoundingClientRect().height < 43.5 && e.getBoundingClientRect().width > 0).map((e) => `${e.tagName}.${e.className}`.slice(0, 40));
        return { sw: document.documentElement.scrollWidth, h1s: q('h1').length, h1font: cs.fontFamily, bg: getComputedStyle(document.body).backgroundColor, wrapper: !!document.querySelector('.s2.s2-inner'), eyebrow: !!document.querySelector('.s2-eyebrow'), skip, oldBtn: q('.btn-sage, .btn-ghost, .section-title, .section-eyebrow').length, small: [...new Set(small)] };
      });
      check(`[${width}px] ${label}: new design (cream page, Playfair heading, eyebrow, no old buttons), one h1, no skipped heading level`, r.wrapper && /Playfair/.test(r.h1font) && r.eyebrow && r.h1s === 1 && r.skip === 0 && r.oldBtn === 0, JSON.stringify(r));
      check(`[${width}px] ${label}: no sideways scroll and every button, link and box is at least 44 px tall`, r.sw <= width && r.small.length === 0, `${r.sw}px; ${r.small.join(', ')}`);
      await c.close();
    }
  }
} finally { if (uid) await api('DELETE', `/auth/v1/admin/users/${uid}`, H(SVC)); await browser.close(); }
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
