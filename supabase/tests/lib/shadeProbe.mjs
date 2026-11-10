// Renders a color on a real product page (roller or zebra) in a headless browser and reads the shade's face from a screenshot. Shared by the calibration of the
// 3D light (scripts/calibrate-shade-light.mjs) and the tests that check every color (supabase/tests/e2e_shade_colors.mjs).
//
//   const s = await probeSession(browser, { width: 1280, height: 900, overrides: { YS180002: { preview_color: '#ececec' } } });
//   await s.select('blackout');                       // 'solar' | 'screen-view' | 'blackout' (roller), 'zebra', 'cellular' | 'cellular-blackout',
//                                                     // 'roman' | 'roman-blackout' (flat style, light-filtering or blackout lining), 'shangri-la' (vanes closed)
//   const r = await s.read('YB010001');               // { tile: '#ecece8', face: [r,g,b], lab, ... }
//
// The face is the average of a patch of the lit cloth above the handle (a Zebra: the solid band, the darker half of the rows in the closed position, because
// a sheer band is never darker than its solid band). The tile color is what the picker tile shows for the same color (canvas data-color).
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const LINE_OF = { zebra: 'zebra', cellular: 'cellular', 'cellular-blackout': 'cellular', roman: 'roman', 'roman-blackout': 'roman', 'shangri-la': 'shangri-la' };
const AMOUNT_OF = { zebra: 55, roman: 85, 'roman-blackout': 85 };       // a roman nearly lowered: the patch is on the flat face, above its folds
const sharp = (await import('sharp')).default;

export const toLab = (rgb) => {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = rgb.map(lin), X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
export const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgbHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const dE = (a, b) => { const A = toLab(a), B = toLab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };

export async function probeSession(browser, { width = 1280, height = 900, dpr = 1, overrides = null, mobile = false, base = BASE } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  if (overrides) {
    const patch = async (route) => {
      const res = await route.fetch(); let rows; try { rows = await res.json(); } catch { return route.fulfill({ response: res }); }
      rows = rows.map((g) => ({ ...g, swatches: (g.swatches || []).map((s) => (overrides[s.supplier_code] ? { ...s, ...overrides[s.supplier_code] } : s)) }));
      await route.fulfill({ response: res, body: JSON.stringify(rows), headers: { ...res.headers(), 'content-length': undefined } });
    };
    await page.route('**/rest/v1/rpc/public_catalog*', patch); await page.route('**/api/catalog*', patch);
  }
  let line = null;
  const open = async (l) => {
    if (line === l) return; line = l;
    await page.goto(`${base}/products/${l}`, { waitUntil: 'networkidle' }); await page.locator('.s2-swgrid .s2-sw').first().waitFor();
    await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill(l === 'zebra' ? '72' : '64');
    if (l === 'cellular') { await card('Chain').click(); await page.waitForTimeout(300); }                        // a plain bottom rail: no handle over the cloth
  };
  const card = (name) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${name}$`) }) }).first();
  const setAmount = async (amt) => {
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    const g = page.locator('.pv-grip, .pv-bar, .pv-chain').first(); await g.focus();
    for (let i = 0; i < 120; i++) { const v = Number(await g.getAttribute('aria-valuenow')); if (Math.abs(v - amt) <= 1) break; await page.keyboard.press(v < amt ? 'ArrowDown' : 'ArrowUp'); }
    await page.evaluate(() => document.activeElement?.blur());
  };
  let type = null;
  const api = {
    page, ctx, errors, dpr,
    async select(t) {
      type = t; await open(LINE_OF[t] || 'roller');
      if (t === 'cellular' || t === 'cellular-blackout') { await card(t === 'cellular' ? 'Light filtering' : 'Blackout').click(); await page.waitForTimeout(500); }
      else if (!LINE_OF[t]) { await card({ solar: 'Solar', 'screen-view': 'Screen view', blackout: 'Blackout' }[t]).click(); await page.waitForTimeout(500); }
    },
    // renders `code` and reads it; opts.shot = true also returns the screenshot of the preview
    async read(code, opts = {}) {
      await page.evaluate(() => { window.__lbLooks = {}; });
      await page.locator('.s2-color input[type=search]').fill(code); await page.waitForTimeout(450);
      const tile = page.locator('.s2-swgrid .s2-sw').first(); await tile.click();
      await page.waitForFunction(() => Object.keys(window.__lbLooks || {}).length > 0).catch(() => {});
      await page.waitForTimeout(1500);
      const cv = tile.locator('canvas'); await page.waitForFunction((el) => el.dataset.ready === '1', await cv.elementHandle());
      const tileHex = await cv.getAttribute('data-color'), mode = await cv.getAttribute('data-mode');
      if (type === 'roman' || type === 'roman-blackout') {                   // the flat style, with the lining the type names (a fabric that does not offer it reads as skipped)
        await card('Flat').click(); await page.waitForTimeout(200);
        const lining = card(type === 'roman' ? 'Light-filtering lining' : 'Blackout lining');
        if (!(await lining.count()) || await lining.isDisabled()) return { code, type, skipped: 'this fabric does not offer that lining' };
        await lining.click(); await page.waitForTimeout(1500);
      }
      await setAmount(AMOUNT_OF[type] || 50); await page.waitForTimeout(1000);
      await page.locator('.pv-canvas').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      const buf = await page.locator('.pv-canvas').screenshot(), meta = await sharp(buf).metadata();
      const g = await page.locator('.pv-grip, .pv-bar, .pv-chain').first().boundingBox(), c = await page.locator('.pv-canvas').boundingBox(), k = meta.width / c.width;
      const gx = (g.x + g.width / 2 - c.x) * k, gy = (g.y + g.height / 2 - c.y) * k;
      const box = { left: Math.max(0, Math.round(gx - 0.1 * meta.width)), top: Math.max(0, Math.round(gy - 0.3 * meta.height)), width: Math.round(0.2 * meta.width), height: Math.round(0.2 * meta.height) };
      const { data, info } = await sharp(buf).extract(box).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const n = info.width * info.height, mean = [0, 0, 0]; for (let i = 0; i < data.length; i += 3) for (let q = 0; q < 3; q++) mean[q] += data[i + q] / n;
      let face = mean, rowsUsed = info.height;
      if (type === 'zebra') {                                                // the darker half of the rows: the solid band
        const rows = []; for (let y = 0; y < info.height; y++) { let l = 0, r = [0, 0, 0]; for (let x = Math.floor(info.width * 0.2); x < Math.floor(info.width * 0.8); x++) { const i = (y * info.width + x) * 3; for (let q = 0; q < 3; q++) r[q] += data[i + q]; l += 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]; } const w = Math.floor(info.width * 0.6); rows.push({ l: l / w, r: r.map((v) => v / w) }); }
        rows.sort((a, b) => a.l - b.l); const keep = rows.slice(Math.floor(rows.length * 0.08), Math.floor(rows.length * 0.5)); rowsUsed = keep.length;
        face = [0, 1, 2].map((q) => keep.reduce((s, r) => s + r.r[q], 0) / keep.length);
      }
      // the spread of the patch: `sd` all of it; `sdHigh` the fine structure (what a visible weave raises: the patch minus its own blurred copy); `sdWave` the slow
      // structure left after taking out the plain top-to-bottom lighting slope (what moire or waviness raises)
      const lum = []; for (let i = 0; i < data.length; i += 3) lum.push(0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]);
      const sd = (arr) => { const m = arr.reduce((a, b) => a + b, 0) / arr.length; return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length); };
      const W = info.width, H = info.height, R = Math.max(2, Math.round(Math.min(W, H) / 14)), soft = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, cnt = 0; for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy += 2) for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx += 2) { s += lum[yy * W + xx]; cnt++; } soft[y * W + x] = s / cnt; }
      const high = lum.map((v, i) => v - soft[i]);
      // best-fit plane of the blurred patch removed
      let sx = 0, sy = 0, sv = 0, sxx = 0, syy = 0, sxy = 0, sxv = 0, syv = 0; const N = W * H;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = soft[y * W + x]; sx += x; sy += y; sv += v; sxx += x * x; syy += y * y; sxy += x * y; sxv += x * v; syv += y * v; }
      const mx = sx / N, my = sy / N, mv = sv / N, cxx = sxx / N - mx * mx, cyy = syy / N - my * my, cxy = sxy / N - mx * my, cxv = sxv / N - mx * mv, cyv = syv / N - my * mv, det = cxx * cyy - cxy * cxy || 1;
      const bx = (cxv * cyy - cyv * cxy) / det, by = (cyv * cxx - cxv * cxy) / det, wave = []; for (let y = Math.floor(H * 0.4); y < H; y++) for (let x = 0; x < W; x++) wave.push(soft[y * W + x] - (mv + bx * (x - mx) + by * (y - my)));
      const out = { code, type, tile: tileHex, mode, face: face.map((v) => +v.toFixed(1)), faceHex: rgbHex(face), lab: toLab(face), tileLab: toLab(hexRgb(tileHex)), sd: sd(lum), sdHigh: sd(high), sdWave: sd(wave), rowsUsed, look: Object.values(await page.evaluate(() => window.__lbLooks || {}))[0] || null, id: Object.keys(await page.evaluate(() => window.__lbLooks || {}))[0] || null };
      out.dE = dE(face, hexRgb(tileHex)); out.db = Math.abs(out.lab[2] - out.tileLab[2]);
      if (opts.shot) out.shot = buf;
      if (opts.zoom) out.zoom = await sharp(buf).extract({ left: Math.max(0, Math.round(gx - 0.2 * meta.width)), top: Math.max(0, Math.round(gy - 0.36 * meta.height)), width: Math.round(0.4 * meta.width), height: Math.round(0.3 * meta.height) }).png().toBuffer();
      return out;
    },
    close: () => ctx.close(),
  };
  return api;
}
