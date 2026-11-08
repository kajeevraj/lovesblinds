// Layout test at 390, 768 and 1280 px: the sticky price bar lines up (label, price and button on one center line, the button as tall as
// the price block, even padding, content on the same edges as the page above it), controls that sit side by side have the same height,
// and padding on cards uses the spacing scale. Needs a preview on BASE_URL (default http://localhost:4173).
import { guard, own } from './lib/liveGuard.mjs';       // every write is checked: a test may only change what it created (see lib/liveGuard.mjs)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const SCALE = [0, 4, 8, 12, 16, 24, 32, 48];
const browser = await chromium.launch(); guard.wrapBrowser(browser);
try {
  for (const [w, h] of [[390, 844], [768, 900], [1280, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } }); page.setDefaultTimeout(30000);
    await page.goto(`${BASE}/products/roller`); await page.locator('.s2-sw').first().waitFor();
    await page.locator('.s2-sw').first().click();
    await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64'); await page.locator('#s2-qty').fill('3');
    await page.getByText(/each · 3 blinds/).first().waitFor();
    await page.locator('.s2-add-btn').click(); await page.locator('.s2-added-card').waitFor();      // so the bar has its Checkout button
    const m = await page.evaluate(() => {
      const R = (s) => { const x = document.querySelector(s).getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom, h: x.height, cy: (x.top + x.bottom) / 2 }; };
      const bar = document.querySelector('.s2-bar'); const inner = getComputedStyle(document.querySelector('.s2-bar-inner'));
      const rows = (sel) => [...document.querySelectorAll(sel)].map((row) => [...row.children].filter((c) => c.tagName !== 'LABEL' && c.tagName !== 'SPAN' && c.offsetHeight).map((c) => Math.round(c.getBoundingClientRect().height * 10) / 10));
      const pads = (sel) => [...document.querySelectorAll(sel)].map((e) => { const c = getComputedStyle(e); return ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map((k) => parseFloat(c[k])); });
      return {
        txt: R('.s2-bar-blind'), btn: R('.s2-bar-checkout'), ord: R('.s2-bar-cartbtn'), crumbs: R('.s2-crumbs'), bar: bar.getBoundingClientRect().toJSON(),
        padT: parseFloat(inner.paddingTop), padB: parseFloat(inner.paddingBottom), padL: parseFloat(inner.paddingLeft), padR: parseFloat(inner.paddingRight),
        value: R('.s2-bar-price'), sub: R('.s2-bar-price'),
        sizeRows: rows('.s2-field-row'), qtyRow: rows('.s2-qty-row'), cardPads: pads('.s2-estimate, .s2-card'),
        vw: document.documentElement.clientWidth,
      };
    });
    check(`[${w}px] bar: the "This blind" half, the cart half and the Checkout button share one center line, and the Checkout button is 48 px`, Math.abs(m.txt.cy - m.btn.cy) < 0.6 && m.btn.h === 48 && Math.abs(m.ord.cy - m.btn.cy) < 0.6, `price block ${m.txt.h}px at ${m.txt.cy.toFixed(1)}, button ${m.btn.h}px at ${m.btn.cy.toFixed(1)}, order button at ${m.ord.cy.toFixed(1)}`);
    check(`[${w}px] bar: one clean row (nothing wraps onto a second line, the price stays inside its half)`, m.bar.height < 80 && m.value.r <= m.txt.r + 0.5 && m.value.t >= m.bar.top, `bar ${m.bar.height}px`);
    check(`[${w}px] bar: even padding top and bottom, and left and right`, m.padT === m.padB && m.padL === m.padR && Math.abs((m.txt.t - m.bar.top - 1) - (m.bar.bottom - m.btn.b)) < 1.5 || Math.abs((m.txt.t - m.bar.top) - (m.bar.bottom - m.txt.b)) < 1.6, `padding ${m.padT}/${m.padR}/${m.padB}/${m.padL}, space above ${(m.txt.t - m.bar.top).toFixed(1)} (includes the 1px edge), below ${(m.bar.bottom - m.txt.b).toFixed(1)}`);
    check(`[${w}px] bar: content starts and ends on the same edges as the page content above`, Math.abs(m.txt.l - m.crumbs.l) < 0.6 && Math.abs((m.vw - m.ord.r) - m.crumbs.l) < 0.6, `text ${m.txt.l}, page ${m.crumbs.l}; order button right gap ${(m.vw - m.ord.r).toFixed(1)}`);
    check(`[${w}px] width/height fields: input and fraction select are the same height`, m.sizeRows.every((r) => r.length >= 2 && r.every((x) => x === r[0])), JSON.stringify(m.sizeRows));
    check(`[${w}px] quantity: − button, number box and + button are the same height`, m.qtyRow.every((r) => r.length === 3 && r.every((x) => x === r[0])), JSON.stringify(m.qtyRow));
    check(`[${w}px] estimate card and option cards use the spacing scale for padding`, m.cardPads.every((p) => p.every((v) => SCALE.includes(Math.round(v)) || Math.round(v) === 15)), JSON.stringify([...new Set(m.cardPads.map((p) => p.join('/')))]));
    await page.close();
  }
  // order page cards
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } }); page.setDefaultTimeout(30000);
    await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor();
    await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
    await page.waitForFunction(() => !document.querySelector('.s2-add-btn').disabled); await page.locator('.s2-add-btn').click();
    await page.goto(`${BASE}/order?checkout=1`); await page.locator('.s2-co-summary').waitFor(); await page.getByRole('button', { name: 'See items' }).click(); await page.locator('.s2-item').first().waitFor();
    await page.waitForFunction(() => !/Calculating/.test(document.querySelector('.s2-items').innerText));
    const o = await page.evaluate(() => {
      const edge = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.left * 10) / 10, Math.round(r.right * 10) / 10]; };
      const pad = (s) => { const c = getComputedStyle(document.querySelector(s)); return [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map(parseFloat); };
      const title = document.querySelector('.s2-order-title').getBoundingClientRect();
      const edges = ['.s2-item', '.s2-co-summary', '.s2-details-title', '.s2-send'].map((s) => edge(s)[0]);
      const right = ['.s2-item', '.s2-co-summary', '.s2-send'].map((s) => edge(s)[1]);
      const fields = [...document.querySelectorAll('.s2-form input.s2-input')].map((e) => Math.round(e.getBoundingClientRect().height));
      return { titleLeft: Math.round(title.left * 10) / 10, edges, right, itemPad: pad('.s2-item'), totalPad: pad('.s2-co-summary'), fields };
    });
    check(`[${w}px] order page: cards, heading, button and form start on the same left edge and cards and button end on the same right edge`, o.edges.every((x) => Math.abs(x - o.titleLeft) < 0.6) && Math.abs(o.right[0] - o.right[1]) < 0.6 && Math.abs(o.right[1] - o.right[2]) < 0.6, JSON.stringify(o));
    check(`[${w}px] order page: card padding is even on all four sides and on the spacing scale`, [o.itemPad].every((p) => p.every((v) => v === p[0]) && SCALE.includes(p[0])) && o.totalPad.every((v) => SCALE.includes(v)), JSON.stringify([o.itemPad, o.totalPad]));
    check(`[${w}px] order page: single-line form boxes are all 48 px`, o.fields.every((x) => x === 48), o.fields.join(','));
    await page.close();
  }

  // ---- phone: the sticky preview shows as a compact strip while scrolling down, never covers the color grid or the selected-color card, and opens only
  // on a tap or back at the top (never on scrolling up); folding and opening never move the page
  {
    const wgl = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); guard.wrapBrowser(wgl);
    const ctx = await wgl.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const T = (t) => `[phone strip] ${t}`;
    await page.goto(`${BASE}/products/roller`, { waitUntil: 'networkidle' }); await page.locator('.s2-swgrid .s2-sw').first().waitFor(); await page.waitForTimeout(1500);
    const by = async (dy, steps = 1) => { for (let i = 0; i < steps; i++) { await page.evaluate((d) => window.scrollBy(0, d), dy / steps); await page.waitForTimeout(90); } await page.waitForTimeout(450); };       // scrolling by the finger, in steps
    const st = () => page.evaluate(() => { const el = document.querySelector('.s2-line-photo'), r = el.getBoundingClientRect(), cv = document.querySelector('.pv-canvas')?.getBoundingClientRect(); return { top: r.top, h: r.height, strip: parseFloat(document.documentElement.style.getPropertyValue('--pv-strip')) || r.height, compact: el.classList.contains('compact'), canvasH: cv ? cv.height : 0, canvasTop: cv ? cv.top : 0, canvasBottom: cv ? cv.bottom : 0, doc: document.documentElement.scrollHeight }; });
    const pageY = (sel) => page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return r.top + window.scrollY; }, sel);
    const top = (sel) => page.evaluate((q) => document.querySelector(q).getBoundingClientRect().top, sel);
    const open0 = await st();
    check(T('at the top the preview is open (full height) with its Hide preview button'), !open0.compact && open0.h >= 300 && (await page.getByRole('button', { name: 'Hide preview' }).count()) === 1, JSON.stringify(open0));
    await page.locator('.s2-swgrid .s2-sw').first().click(); await page.fill('#s2-w', '40'); await page.fill('#s2-h', '64'); await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
    await by(200, 2);
    const g0 = await pageY('.s2-swgrid'), before = await st();
    await by(1300, 12);
    const c1 = await st(), g1 = await pageY('.s2-swgrid');
    check(T('scrolling down past the gallery folds it to a compact strip: about a third of the open height'), c1.compact && c1.strip <= open0.h * 0.36 && c1.strip >= open0.h * 0.2, `${Math.round(c1.strip)} px vs ${Math.round(open0.h)} px open`);
    check(T('the strip is stuck to the top, the live shade (3D canvas) shows inside it and Hide preview is still there'), Math.abs(c1.top) <= 1 && c1.canvasH >= 60 && c1.canvasTop >= 0 && c1.canvasBottom <= c1.strip + 1 && (await page.getByRole('button', { name: 'Hide preview' }).count()) === 1, JSON.stringify(c1));
    check(T('folding moves nothing: the page is exactly as tall and the color grid is at the same place in the page as before'), c1.doc === before.doc && Math.abs(g1 - g0) < 1, `page ${before.doc} -> ${c1.doc}, grid at ${Math.round(g0)} -> ${Math.round(g1)}`);
    const shot0 = await page.locator('.pv-canvas').screenshot();
    await page.locator('.s2-swgrid .s2-sw').nth(3).evaluate((el) => el.click()); await page.waitForTimeout(2500);
    check(T('the shade in the strip keeps updating (a different color changes the picture)'), !shot0.equals(await page.locator('.pv-canvas').screenshot()) && (await st()).compact);
    for (const [name, sel] of [['the color grid', '.s2-swgrid'], ['the selected-color card', '.s2-swprev'], ['the size step', '.s2-step:has(#s2-w)']]) {
      await page.evaluate((q) => document.querySelector(q).scrollIntoView({ block: 'start' }), sel); await page.waitForTimeout(700);
      const s = await st(), t = await top(sel);
      check(T(`scrolled to ${name}: it lands below the strip, not under it`), t >= s.strip - 1, `top ${Math.round(t)} vs strip ${Math.round(s.strip)}`);
    }
    // scrolling up never reopens it, and nothing moves
    await by(300, 3);
    const w0 = await pageY('.s2-swgrid'), d0 = await st(); const y0 = await page.evaluate(() => window.scrollY);
    await by(-160, 4);
    const up = await st(), w1 = await pageY('.s2-swgrid'), y1 = await page.evaluate(() => window.scrollY);
    check(T('scrolling up does not open it (it stays compact) and nothing jumps: the page moved only by the scroll'), d0.compact && up.compact && Math.abs((y0 - y1) - 160) < 2 && Math.abs(w1 - w0) < 1 && up.doc === d0.doc, `strip ${Math.round(up.strip)} px, scrolled ${Math.round(y0 - y1)} px, grid page position ${Math.round(w0)} -> ${Math.round(w1)}`);
    // a tap opens it; it stays open through a short scroll down
    await page.locator('.pv-expand').click({ position: { x: 120, y: 60 } }); await page.waitForTimeout(500);       // a tap inside the visible strip
    const tapped = await st();
    check(T('tapping the compact strip opens it, and the page does not move'), !tapped.compact && tapped.strip >= 300 && tapped.doc === up.doc && Math.abs((await pageY('.s2-swgrid')) - w1) < 1, `${up.compact} -> ${tapped.compact}`);
    await by(100, 2);
    check(T('after a tap it stays open through a short scroll down (it does not snap shut under a finger)'), !(await st()).compact);
    await by(900, 9);
    check(T('and folds again after scrolling further down'), (await st()).compact);
    // back at the top
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);
    const topped = await st();
    check(T('back at the top of the page it is open again'), !topped.compact && topped.strip >= 300, JSON.stringify(topped));
    await by(600, 6); await page.getByRole('button', { name: 'Hide preview' }).click(); await page.waitForTimeout(400);
    check(T('Hide preview still folds the whole preview away'), await page.evaluate(() => document.querySelector('.s2-line-photo').classList.contains('collapsed')) && (await page.getByRole('button', { name: 'Show preview' }).count()) === 1);
    check(T('no sideways scroll'), (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    await wgl.close();
  }
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
