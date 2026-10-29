// The 3D preview: every fabric reads as its real color at normal size, with no moire, and the solar panel sits behind the cloth.
// Live swatches; needs a preview server (BASE_URL, default http://localhost:4173). Pixels are read from screenshots of the preview canvas.
// Jet Black (YS180006), Clean White (YS180002) and Flint Gray are the darkest, the lightest and a mid grey of the Roller colors.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const sharp = (await import('sharp')).default;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const card = (p, n) => p.locator('.s2-card').filter({ has: p.locator('.s2-card-name', { hasText: new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
const raw = async (buf, box) => { const { data, info } = await sharp(buf).extract(box).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, ...info }; };
const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
const statsOf = ({ data, width, height }) => { const n = width * height, m = [0, 0, 0]; for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) m[c] += data[i + c] / n; const ml = 0.3 * m[0] + 0.59 * m[1] + 0.11 * m[2]; let v = 0; for (let i = 0; i < data.length; i += 3) v += (lum(data, i) - ml) ** 2 / n; return { mean: m, sd: Math.sqrt(v) }; };
const LOOKS = [['Jet Black', 'YS180006', [59, 58, 60], 'darkest'], ['Clean White', 'YS180002', [235, 231, 223], 'lightest'], ['Flint Gray', 'Gray', [157, 156, 158], 'mid grey']];
try {
  for (const [vw, vh, dpr] of [[390, 844, 2], [1280, 900, 1], [1280, 900, 0.6]]) {
    const T = (s) => `[${vw}px @${dpr}x] ${s}`;
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: vw < 500, isMobile: vw < 500 });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const pick = async (q) => { await page.locator('.s2-color input[type=search]').fill(q); await page.waitForTimeout(400); await page.locator('.s2-swgrid .s2-sw').first().click(); await page.waitForTimeout(2200); };
    const setAmount = async (amt) => { const g = page.locator('.pv-grip, .pv-bar').first(); await g.focus(); for (let i = 0; i < 120; i++) { const v = Number(await g.getAttribute('aria-valuenow')); if (Math.abs(v - amt) <= 2) break; await page.keyboard.press(v < amt ? 'ArrowDown' : 'ArrowUp'); } await page.evaluate(() => document.activeElement?.blur()); await page.waitForTimeout(1000); };
    const snap = async () => { await page.locator('.pv-canvas').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); return page.locator('.pv-canvas').screenshot(); };
    const shadeBox = async (buf) => { const { width, height } = await sharp(buf).metadata(); const g = await page.locator('.pv-grip, .pv-bar').first().boundingBox(), c = await page.locator('.pv-canvas').boundingBox(); const k = width / c.width, gx = (g.x + g.width / 2 - c.x) * k, gy = (g.y + g.height / 2 - c.y) * k; return { left: Math.round(gx - 0.1 * width), top: Math.round(gy - 0.3 * height), width: Math.round(0.2 * width), height: Math.round(0.2 * height) }; };
    await page.goto(`${BASE}/products/roller`, { waitUntil: 'networkidle' }); await page.locator('.s2-swgrid .s2-sw').first().waitFor();
    await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
    for (const [name, q, target, role] of LOOKS) {
      await pick(q); await setAmount(50);
      const buf = await snap(); const s = statsOf(await raw(buf, await shadeBox(buf)));
      const off = s.mean.map((m, i) => Math.round(m - target[i]));
      check(T(`${name} (${role}) reads as its real color on the shade: average within 16 levels of ${target.join(',')}`), off.every((o) => Math.abs(o) <= 16), `rendered ${s.mean.map(Math.round).join(',')} off ${off.join(',')}`);
      check(T(`${name}: no moire or wavy pattern on the cloth (luminance spread over the shade <= 6)`), s.sd <= 6, `sd ${s.sd.toFixed(1)}`);
    }
    // darkest is darker than the mid grey, which is darker than the lightest
    const lumOf = async (q) => { await pick(q); await setAmount(50); const b = await snap(); const s = statsOf(await raw(b, await shadeBox(b))); return 0.3 * s.mean[0] + 0.59 * s.mean[1] + 0.11 * s.mean[2]; };
    const [lb, lg, lw] = [await lumOf('YS180006'), await lumOf('Gray'), await lumOf('YS180002')];
    check(T('Jet Black < mid grey < white, with clear gaps (>40 levels)'), lb + 40 < lg && lg + 40 < lw, `${lb.toFixed(0)} / ${lg.toFixed(0)} / ${lw.toFixed(0)}`);

    // the solar panel: on the glass behind the cloth
    await pick('YS180006');
    await card(page, 'Motorized').click(); await page.waitForTimeout(500);
    const crop = async (buf) => { const { width, height } = await sharp(buf).metadata(); return sharp(buf).extract({ left: Math.round(width * 0.12), top: 0, width: Math.round(width * 0.76), height }).removeAlpha(); };       // the gallery arrows are page buttons over the canvas edges; they can sit a few px apart between two shots
    const diffs = async (a, b) => { const A = await (await crop(a)).raw().toBuffer({ resolveWithObject: true }), B = await (await crop(b)).raw().toBuffer(); let n = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1; for (let i = 0; i < A.data.length; i += 3) { if (Math.abs(A.data[i] - B[i]) + Math.abs(A.data[i + 1] - B[i + 1]) + Math.abs(A.data[i + 2] - B[i + 2]) > 24) { n++; const p = i / 3, x = p % A.info.width, y = (p / A.info.width) | 0; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } } return { n, minX, maxX, minY, maxY, w: A.info.width, h: A.info.height }; };
    // for each shade position the picture is taken with and without the panel, the shade itself not touched in between
    const withAndWithout = async (amt) => { await card(page, 'Add a solar panel').click(); await page.waitForTimeout(700); await setAmount(amt); const yes = await snap(); await card(page, 'No solar panel').click(); await page.waitForTimeout(900); const no = await snap(); return diffs(no, yes); };
    const dUp = await withAndWithout(3), dHalf = await withAndWithout(50), dCross = await withAndWithout(12);
    check(T('shade half down: the solar panel is hidden behind the cloth (the picture is identical with and without it)'), dHalf.n === 0, `${dHalf.n} pixels differ`);
    check(T('shade raised: the panel shows on the glass, on the motor side (right), in the top part of the window, nowhere else'), dUp.n > 40 && dUp.minX > dUp.w * 0.4 && dUp.maxY < dUp.h * 0.5, JSON.stringify(dUp));
    check(T('shade lowered across the panel: the panel is cut by the cloth\'s bottom edge (it never covers the cloth)'), dCross.n < dUp.n, `${dCross.n} px vs ${dUp.n} fully uncovered`);
    check(T('no page errors'), errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser.close();
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
