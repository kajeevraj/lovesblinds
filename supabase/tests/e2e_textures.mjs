// Picker tiles, the "This blind" chip and the 3D preview use the SAME texture and the SAME color (live swatches, read-only; needs a preview server, BASE_URL
// default http://localhost:4173). Roller: Jet Black, Clean White, Soft Cream, Pale Cream, Cashew Beige. Zebra: always the pattern, drawn as solid and sheer
// bands (default 3 in + 2 in) on the tile and the 3D shade. Soft Cream and Pale Cream are soft off-whites that match their photos, not yellow.
import { guard } from './lib/liveGuard.mjs';       // every write is checked: a test may only change what it created (see lib/liveGuard.mjs)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const sharp = (await import('sharp')).default;
const { colorDistance, hexOf, chromaOf } = await import('../../src/lib/swatchColor.js');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); guard.wrapBrowser(browser);
const canvasStats = (loc) => loc.evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, m = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += d[i + k]; return { mean: m.map((v) => v / (d.length / 4)), w: c.width, h: c.height, mode: c.dataset.mode, color: c.dataset.color }; });
try {
  for (const [vw, vh] of [[390, 844], [1280, 900]]) {
    const T = (s) => `[${vw}px] ${s}`;
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: vw < 500, isMobile: vw < 500 });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const open = async (line, h) => { await page.goto(`${BASE}/products/${line}`, { waitUntil: 'networkidle' }); await page.locator('.s2-swgrid .s2-sw').first().waitFor(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill(String(h)); await page.evaluate(() => { window.__lbLooks = {}; }); };
    const pick = async (q) => { await page.evaluate(() => { window.__lbLooks = {}; }); await page.locator('.s2-color input[type=search]').fill(q); await page.waitForTimeout(500); const t = page.locator('.s2-swgrid .s2-sw').first(); await t.click(); await page.waitForTimeout(2800); return t; };
    const setAmount = async (amt) => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500); const g = page.locator('.pv-grip, .pv-bar').first(); await g.focus(); for (let i = 0; i < 120; i++) { const v = Number(await g.getAttribute('aria-valuenow')); if (Math.abs(v - amt) <= 1) break; await page.keyboard.press(v < amt ? 'ArrowDown' : 'ArrowUp'); } await page.evaluate(() => document.activeElement?.blur()); await page.waitForTimeout(1000); };
    const shadeMean = async () => { await page.locator('.pv-canvas').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); const buf = await page.locator('.pv-canvas').screenshot(); const { width, height } = await sharp(buf).metadata(); const g = await page.locator('.pv-grip, .pv-bar').first().boundingBox(), c = await page.locator('.pv-canvas').boundingBox(); const k = width / c.width, gx = (g.x + g.width / 2 - c.x) * k, gy = (g.y + g.height / 2 - c.y) * k; const { data } = await sharp(buf).extract({ left: Math.round(gx - 0.1 * width), top: Math.round(gy - 0.3 * height), width: Math.round(0.2 * width), height: Math.round(0.2 * height) }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const m = [0, 0, 0]; for (let i = 0; i < data.length; i += 3) for (let c2 = 0; c2 < 3; c2++) m[c2] += data[i + c2] / (data.length / 3); return hexOf(m); };

    // ---- roller: tile, chip and 3D are one texture in one color ----
    await open('roller', 64);
    const seen = {};
    for (const [name, q] of [['Jet Black', 'YS180006'], ['Clean White', 'YS180002'], ['Soft Cream', 'YS205908'], ['Pale Cream', 'XS170003'], ['Cashew Beige', 'YS180003']]) {
      const tile = await pick(q); await setAmount(50);
      const cv = tile.locator('canvas'); await page.waitForFunction((el) => el.dataset.ready === '1', await cv.elementHandle());
      const tl = await canvasStats(cv), chipCv = page.locator('.s2-bar-blind .s2-dot canvas'); await chipCv.waitFor(); await page.waitForFunction((el) => el.dataset.ready === '1', await chipCv.elementHandle());
      const chip = await canvasStats(chipCv), looks = await page.evaluate(() => window.__lbLooks), l3 = Object.values(looks)[0], shade = await shadeMean();
      seen[name] = tl.color;
      check(T(`${name}: the tile is drawn in its color ${tl.color} (its own average is within 2 of it) as a ${tl.mode} texture`), colorDistance(hexOf(tl.mean), tl.color) <= 2 && (tl.mode === 'photo' || tl.mode === 'pattern'), `average ${hexOf(tl.mean)}`);
      check(T(`${name}: the "This blind" chip is the same texture and color as the tile (${chip.mode} ${chip.color})`), chip.color === tl.color && chip.mode === tl.mode && colorDistance(hexOf(chip.mean), tl.color) <= 2);
      check(T(`${name}: the 3D preview uses the same texture mode and the same color (${l3?.mode} ${l3?.hex})`), !!l3 && l3.mode === tl.mode && l3.hex === tl.color, JSON.stringify(looks));
      check(T(`${name}: the 3D shade lands within color distance 7 of the tile`), colorDistance(shade, tl.color) <= 7, `shade ${shade} tile ${tl.color}`);
    }
    // soft off-whites that match their photos
    for (const [name, q] of [['Soft Cream', 'YS205908'], ['Pale Cream', 'XS170003']]) {
      await pick(q);
      const photo = await page.locator('.s2-swprev-img img').evaluate(async (img) => { await img.decode?.(); const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 48, 48); const d = x.getImageData(0, 0, 48, 48).data, m = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += d[i + k]; return m.map((v) => v / (d.length / 4)); });
      check(T(`${name}: a soft off-white (chroma <= 9), within color distance 9 of its close-up photo's average ${hexOf(photo)}, not yellow`), chromaOf(seen[name]) <= 9 && colorDistance(seen[name], hexOf(photo)) <= 9, `tile ${seen[name]} chroma ${chromaOf(seen[name]).toFixed(1)} distance ${colorDistance(seen[name], hexOf(photo)).toFixed(1)}`);
    }
    check(T('the supplier photo stays under the grid as "Close-up of the weave"'), (await page.locator('.s2-swprev-cap').innerText()).trim() === 'Close-up of the weave');

    // ---- zebra: always the pattern, solid and sheer bands (3 in + 2 in by default) ----
    await open('zebra', 72);
    for (const [name, q] of [['Cream', 'YZB202'], ['Twilight Gray', 'YZB208'], ['Truffle Brown', 'YZB210']]) {
      const tile = await pick(q); await setAmount(55);
      const cv = tile.locator('canvas'); await page.waitForFunction((el) => el.dataset.ready === '1', await cv.elementHandle());
      const info = await cv.evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, half = c.height / 2, L = []; for (let y = 0; y < half; y++) { let t = 0; for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; t += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; } L.push(t / c.width); } const mid = (Math.max(...L) + Math.min(...L)) / 2, solid = L.filter((v) => v < mid).length / L.length; return { solid, swing: Math.max(...L) - Math.min(...L), mode: c.dataset.mode, color: c.dataset.color }; });
      const looks = await page.evaluate(() => window.__lbLooks), l3 = Object.values(looks)[0];
      check(T(`Zebra ${name}: the tile is the pattern, banded: the solid band is 60 % of each stripe (3 in of 5), visibly darker than the sheer band`), info.mode === 'pattern' && Math.abs(info.solid - 0.6) <= 0.04 && info.swing > 25, JSON.stringify(info));
      check(T(`Zebra ${name}: the 3D shade is the pattern too, in the tile's color ${info.color}`), l3?.mode === 'pattern' && l3.weave === 'zebra' && l3.hex === info.color, JSON.stringify(looks));
    }
    check(T('no page errors'), errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser.close();
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
