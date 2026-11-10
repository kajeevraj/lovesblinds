// The chain is the control on every line that has one (Roller, Zebra, Cellular, Roman, Shangri-La): no step buttons, no center handle, no bar. Live catalog, read-only; needs a
// preview server (BASE_URL, default http://localhost:4173).
//   - both strands have a touch area of at least 44 px, a grab cursor; the chain is focusable and the arrow keys raise and lower
//   - dragging the lowering strand down lowers the shade, dragging the other strand down raises it; the shade follows and stops when the pointer is let go
//   - the chain's beads move with the drag; the hint says "Pull the chain to raise or lower."
//   - desktop with the mouse, a phone with touch
import { guard } from './lib/liveGuard.mjs';       // every write is checked: a test may only change what it created (see lib/liveGuard.mjs)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); guard.wrapBrowser(browser);
const LINES = [['roller', 'Roller', 64], ['zebra', 'Zebra', 72], ['cellular', 'Cellular', 64], ['roman', 'Roman', 64], ['shangri-la', 'Shangri-La', 64]];
try {
  for (const [vw, vh, phone] of [[1280, 900, false], [390, 844, true]]) {
    for (const [line, label, hgt] of LINES) {
      const T = (s) => `[${vw}px] ${label}: ${s}`;
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
      const page = await ctx.newPage(); page.setDefaultTimeout(30000);
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE}/products/${line}`, { waitUntil: 'networkidle' });
      await page.locator('.s2-swgrid .s2-sw').first().waitFor();
      await page.locator('.s2-swgrid .s2-sw').first().click();
      await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill(String(hgt)); await page.locator('#s2-h').blur();
      const chainCard = page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: /^Chain$/ }) }).first();
      if (await chainCard.count()) await chainCard.click();
      if (line === 'cellular') { const lf = page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: /^Light filtering$/ }) }).first(); if (await lf.count()) await lf.click(); }
      await page.waitForSelector('.pv-stage.ready', { timeout: 30000 }); await page.waitForSelector('.pv-chain', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(800);
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
      const amount = async () => Number(await page.locator('.pv-chain').getAttribute('aria-valuenow'));
      check(T('the chain is the control: no step buttons, no center handle, no bar, no Zero gravity handle'), (await page.locator('.pv-chain').count()) === 1 && (await page.locator('.pv-grip, .pv-bar, .pv-handle').count()) === 0 && (await page.getByRole('button', { name: /Raise the shade|Lower the shade/ }).count()) === 0);
      const hits = await page.locator('.pv-chain-hit').evaluateAll((h) => h.map((x) => { const r = x.getBoundingClientRect(); return { w: r.width, h: r.height, cursor: getComputedStyle(x).cursor, ta: getComputedStyle(x).touchAction }; }));
      check(T('both strands have a touch area of at least 44 px, a grab cursor and no page scrolling under the finger'), hits.length === 2 && hits.every((x) => x.w >= 44 && x.h >= 44 && x.cursor === 'grab' && x.ta === 'none'), JSON.stringify(hits));
      check(T('the hint says "Pull the chain to raise or lower." (a cord loop says cord)'), /Pull the (chain|cord) to raise or lower\./.test(await page.locator('.pv-note').innerText()));
      // keyboard
      await page.locator('.pv-chain').focus(); const k0 = await amount();
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
      const k1 = await amount(); for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp'); const k2 = await amount();
      check(T('the chain takes focus and the arrow keys lower and raise the shade'), k1 > k0 + 8 && k2 < k1 - 4, `${k0} -> ${k1} -> ${k2}`);
      await page.evaluate(() => document.activeElement?.blur());
      // drag
      const drag = async (strand, dy) => {
        const b = await page.locator(`.pv-chain-hit[data-strand="${strand}"]`).boundingBox(), x = b.x + b.width / 2, y = b.y + 24;
        if (!phone) { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + dy / 2, { steps: 6 }); const mid = await amount(); await page.mouse.move(x, y + dy, { steps: 6 }); await page.mouse.up(); return mid; }
        const cdp = await ctx.newCDPSession(page), pt = (yy) => [{ x, y: yy }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y) });
        for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y + (dy / 2) * i / 6) });
        await page.waitForTimeout(100); const mid = await amount();
        for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y + dy / 2 + (dy / 2) * i / 6) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); return mid;
      };
      const a0 = await amount(), mid = await drag('lower', 120); await page.waitForTimeout(500); const a1 = await amount();
      check(T('dragging the lowering strand down lowers the shade, following the pointer'), mid > a0 + 3 && a1 > mid + 3, `${a0} -> ${mid} -> ${a1}`);
      await page.waitForTimeout(600); const a1b = await amount();
      check(T('and the shade stops when the pointer is let go'), a1b === a1, `${a1} -> ${a1b}`);
      const beads = (await page.evaluate(() => window.__lbPreview?.amounts?.[0])) != null;
      const r0 = await amount(), m2 = await drag('raise', 100); await page.waitForTimeout(500); const r1 = await amount();
      check(T('dragging the other strand down raises the shade'), r1 < r0 - 3 && m2 < r0, `${r0} -> ${m2} -> ${r1}`);
      check(T('no page errors'), errors.length === 0 && beads, errors.join(' | '));
      await ctx.close();
    }
  }
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser.close();
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
