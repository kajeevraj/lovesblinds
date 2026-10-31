// The picker thumbnail and the 3D preview show a fabric in the same color: for Jet Black, a white, two greys and a beige the tile's color and the
// shade's color are within a small color distance; the tile is really drawn in that color; the supplier photo stays as the large preview, labelled
// "Close-up of the weave"; and an admin override (swatches.preview_color, simulated in the catalog answer, so this runs before migration 20) is used by
// both, while a bad one is ignored. Live swatches; needs a preview server (BASE_URL, default http://localhost:4173).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const sharp = (await import('sharp')).default;
const { colorDistance, hexOf } = await import('../../src/lib/swatchColor.js');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const COLORS = [['Jet Black', 'YS180006'], ['Clean White', 'YS180002'], ['Flint Gray', 'Flint'], ['Concrete Gray', 'Concrete'], ['Cashew Beige', 'YS180003']];
const OVERRIDES = { YS180006: '#2a5d9f', YS180002: 'not-a-color' };      // a blue Jet Black, and a bad value on the white
const open = async (w, h, overrides) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  if (overrides) {
    const patch = async (route) => { const res = await route.fetch(); let rows; try { rows = await res.json(); } catch { return route.fulfill({ response: res }); } rows = rows.map((g) => ({ ...g, swatches: (g.swatches || []).map((s) => (OVERRIDES[s.supplier_code] ? { ...s, preview_color: OVERRIDES[s.supplier_code] } : s)) })); await route.fulfill({ response: res, body: JSON.stringify(rows), headers: { ...res.headers(), 'content-length': undefined } }); };
    await page.route('**/rest/v1/rpc/public_catalog*', patch); await page.route('**/api/catalog*', patch);
  }
  await page.goto(`${BASE}/products/roller`, { waitUntil: 'networkidle' }); await page.locator('.s2-swgrid .s2-sw').first().waitFor();
  await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
  return { page, errors, ctx };
};
const pickAndRead = async (page, q) => {
  await page.locator('.s2-color input[type=search]').fill(q); await page.waitForTimeout(500);
  const t = page.locator('.s2-swgrid .s2-sw').first(); await t.click(); await page.waitForTimeout(2500);
  const cv = t.locator('canvas'); await cv.waitFor(); await page.waitForFunction((el) => el.dataset.ready === '1', await cv.elementHandle());
  const tileHex = await cv.getAttribute('data-color');
  const mean = await cv.evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, m = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += d[i + k]; return m.map((v) => v / (d.length / 4)); });
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);       // (a phone folds the preview to a compact strip, without its handle, once scrolled down)
  const g = page.locator('.pv-grip, .pv-bar').first(); await g.focus(); for (let i = 0; i < 120; i++) { const v = Number(await g.getAttribute('aria-valuenow')); if (Math.abs(v - 50) <= 2) break; await page.keyboard.press(v < 50 ? 'ArrowDown' : 'ArrowUp'); } await page.evaluate(() => document.activeElement?.blur()); await page.waitForTimeout(1000);
  await page.locator('.pv-canvas').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const buf = await page.locator('.pv-canvas').screenshot(); const { width, height } = await sharp(buf).metadata();
  const gb = await g.boundingBox(), cb = await page.locator('.pv-canvas').boundingBox(), k = width / cb.width, gx = (gb.x + gb.width / 2 - cb.x) * k, gy = (gb.y + gb.height / 2 - cb.y) * k;
  const { data } = await sharp(buf).extract({ left: Math.round(gx - 0.1 * width), top: Math.round(gy - 0.3 * height), width: Math.round(0.2 * width), height: Math.round(0.2 * height) }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = [0, 0, 0]; for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) m[c] += data[i + c] / (data.length / 3);
  const chip = page.locator('.s2-bar-blind .s2-dot canvas'); await chip.waitFor(); await page.waitForFunction((el) => el.dataset.ready === '1', await chip.elementHandle());
  const chipHex = await chip.getAttribute('data-color'), chipMean = await chip.evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, m = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += d[i + k]; return m.map((v) => v / (d.length / 4)); });
  return { tileHex, tileMean: hexOf(mean), shadeHex: hexOf(m), chipHex, chipMean: hexOf(chipMean) };
};
try {
  for (const [vw, vh] of [[390, 844], [1280, 900]]) {
    const T = (s) => `[${vw}px] ${s}`;
    const { page, errors, ctx } = await open(vw, vh, false);
    for (const [name, q] of COLORS) {
      const r = await pickAndRead(page, q);
      check(T(`${name}: the picker tile is drawn in its color ${r.tileHex} (the tile's own average is within 2 of it)`), colorDistance(r.tileMean, r.tileHex) <= 2, `average ${r.tileMean}`);
      check(T(`${name}: the bottom bar "This blind" chip is drawn in the same color as the tile (${r.chipHex}), not the supplier photo`), r.chipHex === r.tileHex && colorDistance(r.chipMean, r.tileHex) <= 2, `chip ${r.chipHex} avg ${r.chipMean}`);
      check(T(`${name}: the picker thumbnail ${r.tileHex} and the preview fabric ${r.shadeHex} are within color distance 7`), colorDistance(r.shadeHex, r.tileHex) <= 7, `distance ${colorDistance(r.shadeHex, r.tileHex).toFixed(1)}`);
    }
    check(T('the supplier photo stays as the large preview under the grid, labelled "Close-up of the weave"'), (await page.locator('.s2-swprev-cap').innerText()).trim() === 'Close-up of the weave' && (await page.locator('.s2-swprev-img img').count()) === 1);
    check(T('no page errors'), errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // an admin override is used as is by both the tile and the shade; a bad one is ignored
  const { page, ctx } = await open(1280, 900, true);
  const jet = await pickAndRead(page, 'YS180006');
  check('override: Jet Black with preview_color #2a5d9f shows exactly that in the picker', jet.tileHex === '#2a5d9f' && colorDistance(jet.tileMean, '#2a5d9f') <= 2, `${jet.tileHex} avg ${jet.tileMean}`);
  check('override: the bottom bar chip shows it too', jet.chipHex === '#2a5d9f');
  check('override: and the 3D shade is within color distance 7 of it (blue, not black)', colorDistance(jet.shadeHex, '#2a5d9f') <= 7, `shade ${jet.shadeHex}`);
  const white = await pickAndRead(page, 'YS180002');
  check('a bad override (not a hex color) is ignored: the white keeps its own derived color', /^#[0-9a-f]{6}$/.test(white.tileHex) && white.tileHex !== 'not-a-color' && colorDistance(white.shadeHex, white.tileHex) <= 7, `${white.tileHex} / ${white.shadeHex}`);
  const beige = await pickAndRead(page, 'YS180003');
  check('a color with no override is untouched by the others (Cashew Beige is still beige)', parseInt(beige.tileHex.slice(1, 3), 16) - parseInt(beige.tileHex.slice(5, 7), 16) >= 12, beige.tileHex);
  await ctx.close();
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser.close();
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
