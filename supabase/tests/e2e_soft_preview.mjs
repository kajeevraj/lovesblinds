// Browser test of the 3D preview on the Cellular, Roman and Shangri-La pages, at 390 and 1280 px. Live catalog, read-only; needs a preview server (BASE_URL,
// default http://localhost:4173). Runs with software WebGL. Checks, per line: the preview is the first picture of the gallery, calm (only the size label on the
// picture) and loaded as its own chunk; it follows every option (size, color, mount, movement with its handle, remote buttons, chain or cord loop in its color,
// motor side); a Cellular's top-down/bottom-up rails move independently (handles and the Top rail / Bottom rail remote rows) and Day & Night switches which
// cloth covers the window; a Roman folds as it rises, follows the style and the lining; a Shangri-La's vanes open and close; and no seam or repeat grid on a
// 40 x 64 shade.
import { guard } from './lib/liveGuard.mjs';       // every write is checked: a test may only change what it created (see lib/liveGuard.mjs)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const sharp = (await import('sharp')).default;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); guard.wrapBrowser(browser);
const ONLY = (process.env.ONLY_LINES || '').split(',').filter(Boolean);

async function open(vw, vh, line, dpr = 1) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: vw < 500, isMobile: vw < 500 });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const errors = [], scripts = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()); });
  await page.goto(`${BASE}/products/${line}`, { waitUntil: 'networkidle' });
  const P = {
    ctx, page, errors, scripts,
    card: (n) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first(),
    top: async () => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(450); },
    fill: async (id, v) => { await page.locator(`#s2-${id}`).fill(v); await page.locator(`#s2-${id}`).blur(); },
    pick: async (code, nth = 0) => { const c = page.locator('.s2-color').nth(nth); await c.locator('input[type=search]').fill(code); await page.waitForTimeout(450); await c.locator('.s2-swgrid .s2-sw').first().click(); await page.waitForTimeout(1600); },
    ready: () => page.waitForSelector('.pv-stage.ready', { timeout: 30000 }).then(() => true).catch(() => false),
    mover: (sel = '.pv-grip, .pv-bar, .pv-chain') => page.locator(sel).first(),
    amount: async (sel) => Number(await P.mover(sel).getAttribute('aria-valuenow')),
    setAmount: async (target, sel) => {
      await P.top(); const m = P.mover(sel); await m.focus();
      for (let i = 0; i < 140; i++) { const v = Number(await m.getAttribute('aria-valuenow')); if (Math.abs(v - target) <= 1) break; await page.keyboard.press(target === 0 ? 'Home' : target === 100 ? 'End' : v < target ? 'ArrowDown' : 'ArrowUp'); }
      await page.evaluate(() => document.activeElement?.blur()); await page.waitForTimeout(700);
    },
    // the picture, and where the shade is on it (the drag area is the shade's own rectangle), in picture pixels
    shot: async () => {
      await P.top(); await page.waitForTimeout(500);
      const buf = await page.locator('.pv-canvas').screenshot(), meta = await sharp(buf).metadata();
      const c = await page.locator('.pv-canvas').boundingBox(), d = await page.locator('.pv-drag').boundingBox(), k = meta.width / c.width;
      const { data } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      return { data, w: meta.width, h: meta.height, k, shade: { x: (d.x - c.x) * k, y: (d.y - c.y) * k, w: d.width * k, h: d.height * k } };
    },
    close: () => ctx.close(),
  };
  return P;
}
// share of the picture's pixels that differ by more than 10 levels (what a change of an option must move)
const diff = (a, b) => { if (a.data.length !== b.data.length) return 1; let n = 0; for (let i = 0; i < a.data.length; i += 3) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30) n++; return n / (a.data.length / 3); };
const diffPx = (a, b) => Math.round(diff(a, b) * (a.data.length / 3));
// the average color of a part of the shade: fx, fy, fw, fh are fractions of the shade's rectangle
const mean = (s, fx, fy, fw, fh) => {
  const x0 = Math.round(s.shade.x + fx * s.shade.w), y0 = Math.round(s.shade.y + fy * s.shade.h), x1 = Math.round(x0 + fw * s.shade.w), y1 = Math.round(y0 + fh * s.shade.h), m = [0, 0, 0]; let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(s.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(s.w, x1); x++) { const i = (y * s.w + x) * 3; m[0] += s.data[i]; m[1] += s.data[i + 1]; m[2] += s.data[i + 2]; n++; }
  return m.map((v) => v / Math.max(1, n));
};
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const tileColor = (page, nth = 0) => page.locator('.s2-color').nth(nth).locator('.s2-swgrid .s2-sw.on canvas').first().getAttribute('data-color');
// A repeat grid or a seam: what is left of the cloth's face when the fine weave is blurred away and the plain lighting slope is taken out. A texture that does not
// repeat cleanly shows up here as lines or patches one tile apart; an even cloth leaves almost nothing.
function slowStructure(s, fx, fy, fw, fh) {
  const x0 = Math.round(s.shade.x + fx * s.shade.w), y0 = Math.round(s.shade.y + fy * s.shade.h), W = Math.round(fw * s.shade.w), H = Math.round(fh * s.shade.h), L = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = ((y0 + y) * s.w + x0 + x) * 3; L[y * W + x] = 0.3 * s.data[i] + 0.59 * s.data[i + 1] + 0.11 * s.data[i + 2]; }
  const R = Math.max(2, Math.round(Math.min(W, H) / 30)), soft = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let t = 0, c = 0; for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy += 2) for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx += 2) { t += L[yy * W + xx]; c++; } soft[y * W + x] = t / c; }
  // best-fit plane out
  let sx = 0, sy = 0, sv = 0, sxx = 0, syy = 0, sxy = 0, sxv = 0, syv = 0; const N = W * H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = soft[y * W + x]; sx += x; sy += y; sv += v; sxx += x * x; syy += y * y; sxy += x * y; sxv += x * v; syv += y * v; }
  const mx = sx / N, my = sy / N, mv = sv / N, cxx = sxx / N - mx * mx, cyy = syy / N - my * my, cxy = sxy / N - mx * my, cxv = sxv / N - mx * mv, cyv = syv / N - my * mv, det = cxx * cyy - cxy * cxy || 1;
  const bx = (cxv * cyy - cyv * cxy) / det, by = (cyv * cxx - cxv * cxy) / det; let t = 0, worst = 0;
  // and the strongest straight line (a seam runs the whole width or height): the largest deviation of a row or column average
  const rows = new Float32Array(H), cols = new Float32Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = soft[y * W + x] - (mv + bx * (x - mx) + by * (y - my)); t += r * r; rows[y] += r / W; cols[x] += r / H; }
  for (const v of rows) worst = Math.max(worst, Math.abs(v)); for (const v of cols) worst = Math.max(worst, Math.abs(v));
  return { sd: Math.sqrt(t / N), line: worst };
}

const LINES = {
  cellular: { title: 'Cellular', white: 'YHC38SL01', dark: 'YHC38SL20', other: 'YHC38L012' },
  roman: { title: 'Roman', white: 'SP26057001', dark: 'SP26036003', other: 'SP26056005' },
  'shangri-la': { title: 'Shangri-La', white: 'YSLH201', dark: 'YSLP1004', other: 'YSLH203' },
};

try {
  for (const [vw, vh] of [[390, 844], [1280, 900]]) for (const [line, def] of Object.entries(LINES)) {
    if (ONLY.length && !ONLY.includes(line)) continue;
    const T = (s) => `[${vw}px] ${def.title}: ${s}`, phone = vw < 700;
    const P = await open(vw, vh, line), { page } = P;
    await page.locator('.s2-swgrid .s2-sw').first().waitFor();
    // ---- the calm preview, first in the gallery, in its own chunk ----
    check(T('the 3D preview comes up before a color is picked (a sample color, and it says so)'), await P.ready() && (phone || /sample color/i.test(await page.locator('.pv-note').innerText())));
    check(T('the 3D code is its own chunk, fetched for this page'), P.scripts.some((u) => /PreviewPane|previewScene/.test(u)), P.scripts.filter((u) => /assets/.test(u)).map((u) => u.split('/').pop()).join(', ').slice(0, 300));
    const dots = page.locator('.gal-dots [role=tab]');
    check(T('the configurator is picture 1 of the gallery, then the style photos'), (await dots.count()) >= 2 && (await dots.first().getAttribute('aria-selected')) === 'true' && /live preview/i.test(await dots.first().getAttribute('aria-label')));
    check(T('no size label before a size is entered'), (await page.locator('.pv-size').count()) === 0);
    await P.pick(def.white); await P.fill('w', '40'); await P.fill('h', '64'); await page.waitForTimeout(700); await P.top();
    check(T('one quiet size label under the window reads the typed size, and nothing else is written on the picture'), (await page.locator('.pv-size').innerText()).replace(/\s+/g, ' ') === '40 × 64 in'
      && (await page.locator('.pv-stage').evaluate((st) => [...st.querySelectorAll('span, p, label, div')].filter((e) => !e.closest('.pv-photo-under') && e.children.length === 0 && e.textContent.trim() && !e.classList.contains('pv-size')).length)) === 0
      && (await page.locator('.pv-xlabel, .pv-solar-label, .pv-solar-line, .pv-dim').count()) === 0);
    await P.setAmount(100);
    if (line === 'shangri-la') { await page.waitForTimeout(1800); await page.locator('.pv-ctl button').first().click(); await page.waitForTimeout(1500); }          // at the bottom the vanes open by themselves: close them (privacy) to read the face
    const white = await P.shot(), wTile = await tileColor(page);
    const fy = line === 'roman' ? 0.5 : 0.3, face = mean(white, 0.3, fy, 0.4, 0.25);          // the part of the cloth where the color is calibrated (a light-filtering cloth is a touch brighter above it and dimmer below: daylight)
    check(T(`a white is white: the face ${face.map((v) => Math.round(v)).join(',')} is within 10 of its tile ${wTile} (plain RGB; e2e_shade_colors holds every color to distance 4 in Lab), and neutral`), dist(face, hexRgb(wTile)) <= 10 && Math.abs(face[0] - face[2]) <= 6 + Math.abs(hexRgb(wTile)[0] - hexRgb(wTile)[2]));
    // ---- color ----
    await P.pick(def.dark); const dark = await P.shot(), dTile = await tileColor(page), dFace = mean(dark, 0.3, fy, 0.4, 0.25);
    check(T(`a new color redraws the shade in that color (dark face ${dFace.map((v) => Math.round(v)).join(',')}, tile ${dTile})`), dist(dFace, hexRgb(dTile)) <= 9 && lum(face) - lum(dFace) > 60);
    // ---- headrail / rail / cassette color: a real choice, Pearl White unless another is picked ----
    const headLabel = { cellular: 'Rail color', roman: 'Headrail color', 'shangri-la': 'Cassette color' }[line], head = (s) => mean(s, 0.2, 0.006, 0.6, 0.012);
    if (!(await page.locator('.s2-more').evaluate((d) => d.open))) await page.locator('.s2-more summary').click();
    const headDots = page.locator(`.s2-cdots[aria-label="${headLabel}"] .s2-cdot`);
    check(T(`"${headLabel}" offers the supplier's four colors, Pearl White by default, and the dark cloth has a light ${headLabel.split(' ')[0].toLowerCase()}`), (await headDots.allInnerTexts()).map((t) => t.trim()).join('|') === 'Pearl White|Sand Beige|Iron Gray|Night Black' && (await headDots.first().getAttribute('aria-pressed')) === 'true' && lum(head(dark)) > 170, `${(await headDots.allInnerTexts()).join('|')}; ${head(dark).map(Math.round)}`);
    await headDots.filter({ hasText: /^Night Black$/ }).click(); await page.waitForTimeout(700); const blackHead = await P.shot();
    check(T(`picking Night Black redraws it in black, and the options summary says "${headLabel}: Night Black"`), lum(head(blackHead)) < 90 && new RegExp(`${headLabel}: Night Black`).test(await page.locator('.s2-more-sum').innerText()), `${head(blackHead).map(Math.round)}`);
    await headDots.filter({ hasText: /^Pearl White$/ }).click(); await page.waitForTimeout(500);
    // ---- size and mount ----
    await P.fill('w', '60'); await page.waitForTimeout(700); const wide = await P.shot();
    check(T('a new size redraws the window to scale'), (await page.locator('.pv-size').innerText()).replace(/\s+/g, ' ') === '60 × 64 in' && wide.shade.w / wide.shade.h > dark.shade.w / dark.shade.h * 1.3);
    await P.fill('w', '40'); await page.waitForTimeout(500);
    await page.getByText('Outside mount', { exact: true }).first().click(); await page.waitForTimeout(700); const outside = await P.shot();
    check(T('outside mount redraws it over the trim'), diff(dark, outside) > 0.02);
    await page.getByText('Inside mount', { exact: true }).first().click(); await page.waitForTimeout(600);
    // ---- movement ----
    const moves = await page.locator('.s2-card-name').allInnerTexts();
    if (moves.includes('Zero gravity')) {
      await P.card('Zero gravity').click(); await page.waitForTimeout(500); await P.top();
      check(T('Zero gravity: a real handle on the bottom, and it moves the shade with the arrow keys'), (await page.locator('.pv-grip').count()) === 1 && (await page.locator('.pv-bar').count()) === 0);
      await P.setAmount(30); check(T('the handle moves the shade'), Math.abs((await P.amount()) - 30) <= 2);
      if (!phone) {
        const g = await page.locator('.pv-grip').boundingBox(), sh = await page.locator('.pv-drag').boundingBox();
        await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down(); await page.mouse.move(g.x + g.width / 2, sh.y + sh.height * 0.85, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
        const after = await P.amount(), g2 = await page.locator('.pv-grip').boundingBox();
        check(T('dragging the handle down lowers the shade, and the handle stays under the pointer'), after > 60 && Math.abs(g2.y + g2.height / 2 - (sh.y + sh.height * 0.85)) < 14, `amount ${after}`);
      }
    }
    await P.card('Chain').click(); await page.waitForTimeout(600); await P.setAmount(60);
    const chainR = await P.shot();
    // the chain comes straight out of the end of the cassette: no bracket or cover there (the end of the cassette is the same color as its middle)
    const endOf = (s) => mean(s, 0.955, 0.008, 0.035, 0.016), midOf = (s) => mean(s, 0.45, 0.008, 0.1, 0.016);
    check(T('no bracket or cover over the cassette where the chain is'), dist(endOf(chainR), midOf(chainR)) < 26, `end ${endOf(chainR).map(Math.round)}, middle ${midOf(chainR).map(Math.round)}`);
    check(T('Chain: no handle and no bar: the chain itself moves the shade, and the note says which side'), (await page.locator('.pv-grip').count()) === 0 && (await page.locator('.pv-chain').count()) === 1 && (await page.locator('.pv-handle').count()) === 0 && (phone || /chain, on the right/i.test(await page.locator('.pv-note').innerText())));
    await P.card('Left').click(); await page.waitForTimeout(600); const chainL = await P.shot();
    const right = (s) => lum(mean(s, 0.9, 0.1, 0.1, 0.3)), left = (s) => lum(mean(s, 0, 0.1, 0.1, 0.3));
    check(T('the chain moves to the side that is chosen'), diffPx(chainR, chainL) > 30 && Math.abs(right(chainR) - right(chainL)) > 0.05 && Math.abs(left(chainR) - left(chainL)) > 0.05, `${diffPx(chainR, chainL)} px changed`);
    if (!(await page.locator('.s2-more').evaluate((d) => d.open))) await page.locator('.s2-more summary').click(); await page.waitForTimeout(300);
    const dotBtn = page.locator('.s2-cdots[aria-label="Chain color"] .s2-cdot').filter({ hasText: /^Black$/ }).first();
    if (await dotBtn.count()) {
      await dotBtn.click(); await page.waitForTimeout(600); const chainB = await P.shot();
      check(T('the chain is drawn in its chosen color'), diffPx(chainL, chainB) > 20 && lum(mean(chainB, 0, 0.1, 0.1, 0.3)) < left(chainL), `${diffPx(chainL, chainB)} px changed`);
    } else check(T('the chain is drawn in its chosen color'), false, 'no chain color choice found');
    if (line !== 'shangri-la') {
      await P.card('Cord loop').click(); await page.waitForTimeout(700); const cord = await P.shot();
      check(T('Cord loop: drawn as a smooth cord (not beads), and the note says so'), diffPx(chainL, cord) > 20 && (phone || /cord loop, on the left/i.test(await page.locator('.pv-note').innerText())), `${diffPx(chainL, cord)} px changed`);
    }
    await P.card('Motorized').click(); await page.waitForTimeout(900); await P.top();
    check(T('Motorized: the working remote sits under the picture'), (await page.locator('.pv-incl .rm-key').count()) === 3 && (await page.locator('.pv-stage .pv-incl').count()) === 0);
    await P.setAmount(40); const a0 = await P.amount();
    await page.getByRole('button', { name: 'Lower the shade' }).click(); await page.waitForTimeout(1300);
    await page.getByRole('button', { name: 'Stop' }).click(); const a1 = await P.amount(); await page.waitForTimeout(600);
    check(T('the remote lowers the shade at a steady speed and Stop holds it'), a1 > a0 + 3 && (await P.amount()) === a1, `${a0} -> ${a1}`);
    const mR = await P.shot(); await P.card('Right').click(); await page.waitForTimeout(700); const mL = await P.shot();
    check(T('the motor side follows the choice (the small charging port on the end cap moves)'), diffPx(mR, mL) >= 1, `${diffPx(mR, mL)} px changed`);
    // nothing is drawn on the wall beside the window (no bracket, no remote holder): the wall there is the same with a chain and with a motor
    const wallOf = (s) => [mean(s, -0.3, 0.3, 0.2, 0.4), mean(s, 1.1, 0.3, 0.2, 0.4)];
    check(T('motorized draws nothing on the wall beside the window'), dist(wallOf(mL)[0], wallOf(chainL)[0]) < 3 && dist(wallOf(mL)[1], wallOf(chainL)[1]) < 3 && dist(wallOf(mL)[0], wallOf(mL)[1]) < 12, `${wallOf(mL).map((c) => c.map(Math.round)).join(' / ')} vs ${wallOf(chainL).map((c) => c.map(Math.round)).join(' / ')}`);
    check(T('no sideways scrolling and no console errors'), (await page.evaluate(() => document.documentElement.scrollWidth)) <= vw && P.errors.length === 0, P.errors.join(' | '));
    await P.close();
  }

  // ---- Cellular: raised bundle, pleats, top-down/bottom-up, day & night ----
  if (!ONLY.length || ONLY.includes('cellular')) for (const [vw, vh] of [[390, 844], [1280, 900]]) {
    const T = (s) => `[${vw}px] Cellular: ${s}`;
    const P = await open(vw, vh, 'cellular', 2), { page } = P;
    await page.locator('.s2-swgrid .s2-sw').first().waitFor(); await P.pick('YHC38L012'); await P.fill('w', '40'); await P.fill('h', '64'); await P.ready();
    await P.setAmount(0); const up = await P.shot();
    const glass = lum(mean(up, 0.3, 0.3, 0.4, 0.3)), cloth = (s, fy) => lum(mean(s, 0.3, fy, 0.4, 0.02));
    check(T('raised, it stacks into a short bundle under the headrail (no roller): cloth to at most 9% of the height, clear glass below'), cloth(up, 0.04) < glass - 40 && cloth(up, 0.09) > cloth(up, 0.04) + 40 && cloth(up, 0.2) > glass - 15, `cloth at 4% ${cloth(up, 0.04).toFixed(0)}, at 9% (the rail's shadow on the glass) ${cloth(up, 0.09).toFixed(0)}, at 20% ${cloth(up, 0.2).toFixed(0)}, glass ${glass.toFixed(0)}`);
    await P.setAmount(100); const down = await P.shot();
    // fine horizontal pleat lines: the rows of the face vary top to bottom far more than its columns do left to right, at a fine pitch, and there is no honeycomb
    const prof = (s, horizontal) => { const n = 120, out = []; for (let i = 0; i < n; i++) out.push(lum(horizontal ? mean(s, 0.3, 0.3 + (0.2 * i) / n, 0.4, 0.2 / n) : mean(s, 0.3 + (0.4 * i) / n, 0.3, 0.4 / n, 0.2))); const hp = out.map((v, i) => v - (out[Math.max(0, i - 3)] + out[Math.min(n - 1, i + 3)]) / 2); return Math.sqrt(hp.reduce((a, b) => a + b * b, 0) / n); };
    const rowsSd = prof(down, true), colsSd = prof(down, false);
    check(T('the face is smooth with fine horizontal pleat lines (rows vary, columns do not: no honeycomb pattern)'), rowsSd > 0.8 && rowsSd > colsSd * 2.5, `rows ${rowsSd.toFixed(2)}, columns ${colsSd.toFixed(2)}`);
    const ss = slowStructure(down, 0.1, 0.12, 0.8, 0.76);
    check(T('no seam or repeat grid on a 40 x 64 shade'), ss.sd < 4 && ss.line < 4, `slow structure ${ss.sd.toFixed(2)}, strongest line ${ss.line.toFixed(2)}`);

    // top-down/bottom-up
    await P.top(); await P.card('Top-down/bottom-up').click(); await page.waitForTimeout(600); await P.pick('YHC38L012'); await P.ready(); await P.top();
    const TOP = '[data-rail=top]', BOT = '[data-rail=bottom]';
    check(T('TDBU with Zero gravity has two handles: one on the top rail, one on the bottom rail'), (await page.locator('.pv-grip').count()) === 2 && (await page.locator(`.pv-grip${TOP}`).count()) === 1 && (await page.locator(`.pv-grip${BOT}`).count()) === 1
      && (await page.locator(TOP).getAttribute('aria-label')) === 'Top rail' && (await page.locator(BOT).getAttribute('aria-label')) === 'Bottom rail');
    await P.setAmount(90, BOT); await P.setAmount(40, TOP);
    const b1 = await P.amount(BOT), t1 = await P.amount(TOP);
    check(T('the top rail moves on its own (the bottom rail stays where it is)'), Math.abs(t1 - 40) <= 2 && Math.abs(b1 - 90) <= 2, `top ${t1}, bottom ${b1}`);
    const dropped = await P.shot();
    check(T('with the top dropped, the glass above the top rail is bare and the cloth hangs below it'), lum(mean(dropped, 0.3, 0.1, 0.4, 0.12)) > lum(mean(dropped, 0.3, 0.55, 0.4, 0.12)) + 25, `above ${lum(mean(dropped, 0.3, 0.1, 0.4, 0.12)).toFixed(0)}, cloth ${lum(mean(dropped, 0.3, 0.55, 0.4, 0.12)).toFixed(0)}`);
    await P.setAmount(70, BOT);
    check(T('the bottom rail moves on its own (the top rail stays where it is)'), Math.abs((await P.amount(BOT)) - 70) <= 2 && (await P.amount(TOP)) === t1);
    const gy = async (sel) => { const b = await page.locator(sel).boundingBox(); return b.y + b.height / 2; };
    check(T('the top handle is above the bottom handle'), (await gy(TOP)) < (await gy(BOT)) - 20);
    await P.setAmount(0, BOT);
    check(T('the rails never cross: raising the bottom rail all the way takes the top rail up with it'), (await P.amount(TOP)) === 0 && (await P.amount(BOT)) === 0);
    await P.setAmount(80, BOT); await P.setAmount(20, TOP);
    await P.card('Motorized').click(); await page.waitForTimeout(900); await P.top();
    const rows = await page.locator('.pv-incl .rm-row-label').allInnerTexts();
    check(T('motorized TDBU uses the Top rail and Bottom rail button rows, each with up, stop and down'), rows.join('|') === 'Top rail|Bottom rail' && (await page.locator('.pv-incl .rm-key').count()) === 6 && (await page.locator('.pv-incl .rm-row').first().locator('.rm-key').evaluateAll((b) => b.map((x) => x.dataset.btn).join())) === 'topUp,topStop,topDown' && (await page.locator('.pv-bar').count()) === 2, rows.join('|'));
    const tb = await P.amount(TOP), bb = await P.amount(BOT);
    await page.getByRole('button', { name: 'Lower the top rail' }).click(); await page.waitForTimeout(1300); await page.getByRole('button', { name: 'Stop the top rail' }).click();
    const ta = await P.amount(TOP); await page.waitForTimeout(500);
    check(T('"Lower the top rail" moves only the top rail; its Stop button holds it'), ta > tb + 3 && (await P.amount(BOT)) === bb && (await P.amount(TOP)) === ta, `top ${tb} -> ${ta}, bottom ${bb} -> ${await P.amount(BOT)}`);
    await page.getByRole('button', { name: 'Raise the bottom rail' }).click(); await page.waitForTimeout(1000); await page.getByRole('button', { name: 'Stop the bottom rail' }).click(); await page.waitForTimeout(300);
    check(T('"Raise the bottom rail" moves only the bottom rail'), (await P.amount(BOT)) < bb - 3 && (await P.amount(TOP)) === ta);

    // day & night
    await P.top(); await P.card('Day & night').click(); await page.waitForTimeout(600);
    await P.pick('YHC38SL01', 0); await P.pick('YHC38LB20', 1); await P.ready(); await P.top();
    const MID = '[data-rail=middle]';
    const dayTile = hexRgb(await tileColor(page, 0)), nightTile = hexRgb(await tileColor(page, 1));
    check(T('Day & Night has one middle rail between the two cloths, and Day fabric / Night fabric buttons under the picture'), (await page.locator(MID).count()) === 1 && (await page.locator(MID).getAttribute('aria-label')) === 'Middle rail' && (await page.getByRole('button', { name: 'Day fabric', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Night fabric', exact: true }).count()) === 1);
    const both = await P.shot(), m0 = await P.amount(MID), bt0 = await P.amount(BOT);
    const fracOf = (a) => 0.06 + 0.9 * (a / 100);
    check(T('the day cloth is above the middle rail and the blackout below it'), dist(mean(both, 0.3, fracOf(m0) * 0.4, 0.4, 0.06), dayTile) < 16 && dist(mean(both, 0.3, (fracOf(m0) + fracOf(bt0)) / 2, 0.4, 0.05), nightTile) < 16, `above ${mean(both, 0.3, fracOf(m0) * 0.4, 0.4, 0.06).map(Math.round)}, below ${mean(both, 0.3, (fracOf(m0) + fracOf(bt0)) / 2, 0.4, 0.05).map(Math.round)}`);
    await page.getByRole('button', { name: 'Night fabric', exact: true }).click(); await page.waitForTimeout(1600);
    const night = await P.shot();
    check(T('Night fabric: the blackout covers the window'), (await page.locator('.pv-ctl').getAttribute('data-cover')) === 'night' && (await P.amount(MID)) <= 1 && (await P.amount(BOT)) >= 99 && dist(mean(night, 0.3, 0.3, 0.4, 0.4), nightTile) < 12, `${mean(night, 0.3, 0.3, 0.4, 0.4).map(Math.round)}`);
    await page.getByRole('button', { name: 'Day fabric', exact: true }).click(); await page.waitForTimeout(1600);
    const day = await P.shot();
    check(T('Day fabric: the light-filtering cloth covers the window'), (await page.locator('.pv-ctl').getAttribute('data-cover')) === 'day' && (await P.amount(MID)) >= 99 && dist(mean(day, 0.3, 0.3, 0.4, 0.4), dayTile) < 14, `${mean(day, 0.3, 0.3, 0.4, 0.4).map(Math.round)}`);
    // switched to the day cloth the two rails are close together: their handles sit side by side, clear of each other, and each still moves its own rail
    const box = async (sel) => page.locator(sel).boundingBox(), mb = await box(MID), bb2 = await box(BOT);
    const apart = mb.x + mb.width <= bb2.x + 1 || bb2.x + bb2.width <= mb.x + 1 || mb.y + mb.height <= bb2.y + 1;
    check(T('switched to the day fabric, the two handles do not overlap (the middle rail\'s to the left, the bottom rail\'s to the right)'), apart && mb.x < bb2.x, `middle ${Math.round(mb.x)},${Math.round(mb.y)} ${Math.round(mb.width)}x${Math.round(mb.height)}; bottom ${Math.round(bb2.x)},${Math.round(bb2.y)}`);
    await P.setAmount(50, MID);
    const slid = await P.shot();
    check(T('sliding the middle rail by hand changes which cloth covers the window'), Math.abs((await P.amount(MID)) - 50) <= 2 && (await P.amount(BOT)) >= 99 && dist(mean(slid, 0.3, 0.15, 0.4, 0.1), dayTile) < 16 && dist(mean(slid, 0.3, 0.75, 0.4, 0.1), nightTile) < 16);
    check(T('no console errors'), P.errors.length === 0, P.errors.join(' | '));
    await P.close();
  }

  // ---- Roman: folds, styles, lining ----
  if (!ONLY.length || ONLY.includes('roman')) for (const [vw, vh] of [[390, 844], [1280, 900]]) {
    const T = (s) => `[${vw}px] Roman: ${s}`;
    const P = await open(vw, vh, 'roman', 2), { page } = P;
    await page.locator('.s2-swgrid .s2-sw').first().waitFor(); await P.pick('SP26005002'); await P.fill('w', '40'); await P.fill('h', '64'); await P.ready();
    await P.card('Flat').click(); await page.waitForTimeout(500); await P.card('Light-filtering lining').click(); await page.waitForTimeout(1500);
    await P.setAmount(100); const flat = await P.shot();
    // dark horizontal lines across the cloth (a stitched row, a rib, the shadow under a fold): rows at least 6 levels darker than the cloth just above and below them
    const edges = (s, y0 = 0.13, y1 = 0.94) => {
      const n = Math.round((y1 - y0) * 260), L = []; for (let i = 0; i < n; i++) L.push(lum(mean(s, 0.25, y0 + ((y1 - y0) * i) / n, 0.5, (y1 - y0) / n)));
      let c = 0, lastAt = -9; for (let i = 1; i < n - 1; i++) { const around = Math.max(...L.slice(Math.max(0, i - 3), i + 4)); if (L[i] < around - 6 && L[i] <= L[i - 1] && L[i] < L[i + 1] && i - lastAt > 1) { c++; lastAt = i; } } return c;
    };
    check(T('lowered, the Flat style is one flat face with no fold lines'), edges(flat) === 0, `${edges(flat)} lines`);
    const ss = slowStructure(flat, 0.1, 0.12, 0.8, 0.8);
    check(T('no seam or repeat grid on a 40 x 64 shade'), ss.sd < 4 && ss.line < 4, `slow structure ${ss.sd.toFixed(2)}, strongest line ${ss.line.toFixed(2)}`);
    const tiles = await page.evaluate(() => Object.entries(window.__lbTiles || {}).filter(([k]) => !/^sample/.test(k)).map(([, v]) => v)), reps = (40 * 0.0254) / tiles[0];
    check(T('real-world scale: the weave repeats 8 to 30 times across a 40 in shade (a close-up covers about 10 cm)'), reps >= 8 && reps <= 30, `${reps.toFixed(1)} repeats`);
    await P.setAmount(35); const half = await P.shot();
    const n = edges(half, 0.3, 0.75);
    check(T('raised part way, the cloth folds into evenly stacked horizontal folds'), n >= 3 && n <= 9, `${n} fold edges`);
    await P.setAmount(0); const up = await P.shot();
    const at = (s, y) => mean(s, 0.3, y, 0.4, 0.04);
    check(T('fully raised, the folds stack at the top (cloth to at most a fifth of the height, clear glass below)'), dist(at(up, 0.34), at(flat, 0.34)) > 20 && dist(at(up, 0.6), at(flat, 0.6)) > 20 && dist(at(up, 0.06), at(flat, 0.06)) < 40 && edges(up, 0.04, 0.22) >= 4, `${edges(up, 0.04, 0.22)} fold edges in the stack`);
    // styles: every one the line offers
    await P.setAmount(100);
    const shots = { flat };
    for (const [name, id] of [['Plain fold', 'plain-fold'], ['Ribble', 'ribble'], ['Hobble', 'hobble'], ['Relax', 'relax']]) {
      await P.top(); await P.card(name).click(); await page.waitForTimeout(500);
      if (await P.card('Light-filtering lining').getAttribute('aria-pressed') !== 'true') { await P.card('Light-filtering lining').click(); }
      await page.waitForTimeout(900); shots[id] = await P.shot();
    }
    const lines = Object.fromEntries(Object.entries(shots).map(([k, s]) => [k, edges(s)]));
    check(T('the line\'s own styles change the fold look: Plain fold, Ribble and Hobble draw a line every 8 in (7 on a 64 in shade), Flat none'), lines.flat === 0 && [6, 7, 8].includes(lines['plain-fold']) && [6, 7, 8].includes(lines.ribble) && [6, 7, 8].includes(lines.hobble), JSON.stringify(lines));
    check(T('each style is a different picture'), diff(shots['plain-fold'], shots.ribble) > 0.002 && diff(shots.ribble, shots.hobble) > 0.01 && diff(shots.flat, shots.relax) > 0.01, `${diff(shots['plain-fold'], shots.ribble).toFixed(4)} ${diff(shots.ribble, shots.hobble).toFixed(4)} ${diff(shots.flat, shots.relax).toFixed(4)}`);
    const g = lum(mean(shots.relax, 0.44, 0.955, 0.12, 0.015)), corner = lum(mean(shots.relax, 0.05, 0.955, 0.08, 0.015)), cloth = lum(mean(shots.relax, 0.3, 0.4, 0.4, 0.2)), flatCorner = lum(mean(shots.flat, 0.05, 0.955, 0.08, 0.015));
    check(T('Relax: the bottom edge hangs in a soft curve (lower in the middle than at the sides) with gentle folds'), Math.abs(g - cloth) < 70 && Math.abs(corner - flatCorner) > 15 && edges(shots.relax, 0.7, 1.0) >= 1, `near the sill: middle ${g.toFixed(0)} (cloth ${cloth.toFixed(0)}); at the side ${corner.toFixed(0)}, where a flat shade has cloth (${flatCorner.toFixed(0)})`);
    // lining: light filtering glows (brighter towards the top), blackout is even; the face keeps its color
    await P.top(); await P.card('Flat').click(); await page.waitForTimeout(400); await P.card('Light-filtering lining').click(); await page.waitForTimeout(1500); const lf = await P.shot();
    await P.card('Blackout lining').click(); await page.waitForTimeout(1500); const bo = await P.shot();
    const slope = (s) => lum(mean(s, 0.3, 0.16, 0.4, 0.1)) - lum(mean(s, 0.3, 0.8, 0.4, 0.1)), tile = hexRgb(await tileColor(page));
    const wallAt = (s) => lum(mean(s, -0.3, 0.2, 0.18, 0.6));
    check(T('a blackout lining makes the room a little dimmer (the wall, not the cloth); light filtering leaves it bright'), wallAt(lf) - wallAt(bo) > 10 && wallAt(lf) - wallAt(bo) < 40 && Math.abs(wallAt(lf) - wallAt(flat)) < 2, `wall: light filtering ${wallAt(lf).toFixed(0)}, blackout ${wallAt(bo).toFixed(0)}`);
    check(T('the lining changes how much light comes through: light filtering glows from the top, blackout is lit evenly'), slope(lf) > slope(bo) + 9 && Math.abs(slope(bo)) < 6, `top minus bottom: light filtering ${slope(lf).toFixed(1)}, blackout ${slope(bo).toFixed(1)}`);
    check(T('a blackout lining does not darken the face'), dist(mean(bo, 0.3, 0.3, 0.4, 0.25), tile) < 9 && dist(mean(lf, 0.3, 0.3, 0.4, 0.25), tile) < 12, `tile ${tile}, light filtering ${mean(lf, 0.3, 0.3, 0.4, 0.25).map(Math.round)}, blackout ${mean(bo, 0.3, 0.3, 0.4, 0.25).map(Math.round)}`);
    check(T('no console errors'), P.errors.length === 0, P.errors.join(' | '));
    await P.close();
  }

  // ---- Shangri-La: vanes ----
  if (!ONLY.length || ONLY.includes('shangri-la')) for (const [vw, vh] of [[390, 844], [1280, 900]]) {
    const T = (s) => `[${vw}px] Shangri-La: ${s}`;
    const P = await open(vw, vh, 'shangri-la', 2), { page } = P;
    await page.locator('.s2-swgrid .s2-sw').first().waitFor(); await P.pick('YSLH204'); await P.fill('w', '40'); await P.fill('h', '64'); await P.ready(); await P.top();
    const ctl = page.locator('.pv-ctl'), vBtn = () => ctl.locator('button').first(), vanesNow = () => page.evaluate(() => window.__lbPreview?.vanes ?? 0);
    const rowsOf = (s) => { const n = 200, L = []; for (let i = 0; i < n; i++) L.push(lum(mean(s, 0.3, 0.3 + (0.4 * i) / n, 0.4, 0.4 / n))); return L; };
    const spread = (L) => { const s = L.slice().sort((a, b) => a - b); return s[Math.floor(s.length * 0.95)] - s[Math.floor(s.length * 0.05)]; };
    const peaks = (L) => { let c = 0; const m = L.reduce((a, b) => a + b, 0) / L.length; for (let i = 1; i < L.length; i++) if (L[i - 1] < m && L[i] >= m) c++; return c; };
    check(T('chain: no Raise or Lower buttons, and no vane control while the shade is not at the bottom (the vanes start closed: privacy)'), (await ctl.count()) === 0 && (await page.getByRole('button', { name: /Raise the shade|Lower the shade/ }).count()) === 0 && (await vanesNow()) === 0);
    await P.setAmount(100); await page.waitForTimeout(1800);
    const open_ = await P.shot(), tile = hexRgb(await tileColor(page));
    check(T('the shade reaches the bottom and the vanes open on their own; the control appears under the picture and reads "Close vanes"'), (await P.amount()) >= 99 && (await ctl.getAttribute('data-vanes')) === 'open' && (await vBtn().innerText()) === 'Close vanes' && (await vBtn().getAttribute('aria-pressed')) === 'true'
      && await ctl.evaluate((c) => c.getBoundingClientRect().top >= document.querySelector('.pv-stage').getBoundingClientRect().bottom - 1) && await vBtn().evaluate((b) => b.getBoundingClientRect().height >= 40));
    const Lo = rowsOf(open_), want = Math.round((0.4 * 64) / 2);
    check(T('open: soft horizontal vanes 2 in apart with the view through the two sheers between them'), spread(Lo) > 25 && Math.abs(peaks(Lo) - want) <= 2, `spread ${spread(Lo).toFixed(0)}, ${peaks(Lo)} vanes in 40% of the height (about ${want})`);
    await vBtn().click(); await page.waitForTimeout(1500); const closed = await P.shot();
    check(T('"Close vanes" at the bottom closes them and they stay closed (privacy with the shade down)'), (await ctl.getAttribute('data-vanes')) === 'closed' && (await vBtn().innerText()) === 'Open vanes' && (await P.amount()) >= 99);
    check(T('closed: the vanes overlap into one soft face in the fabric\'s color'), dist(mean(closed, 0.3, 0.3, 0.4, 0.4), tile) < 9 && spread(rowsOf(closed)) < 30 && lum(mean(open_, 0.3, 0.1, 0.4, 0.25)) > lum(mean(closed, 0.3, 0.1, 0.4, 0.25)) + 8, `face ${mean(closed, 0.3, 0.3, 0.4, 0.4).map(Math.round)} tile ${tile}, spread ${spread(rowsOf(closed)).toFixed(0)}`);
    const ss = slowStructure(closed, 0.1, 0.12, 0.8, 0.8);
    check(T('no seam or repeat grid on a 40 x 64 shade (only the soft, even vane lines)'), ss.line < 6 && ss.sd < 5, `slow structure ${ss.sd.toFixed(2)}, strongest line ${ss.line.toFixed(2)}`);
    // the two animations: the same length, one the other run backwards (timed inside the page)
    const timing = await page.evaluate(() => new Promise((res) => {
      const c = window.__lbPreview, out = {}; const run = (to, key, next) => { const t0 = performance.now(); let a = null, b = null; c.setVanes(to); const tick = () => { const v = c.vanes, t = performance.now() - t0; if (a == null && (to ? v > 0.02 : v < 0.98)) a = t; if (b == null && (to ? v > 0.98 : v < 0.02)) b = t; if (b != null || t > 4000) { out[key] = [a, b, t]; next(); } else requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
      run(true, 'open', () => run(false, 'close', () => res(out)));
    }));
    const dOpen = timing.open[1] - timing.open[0], dClose = timing.close[1] - timing.close[0];
    check(T('closing the vanes takes as long as opening them (the same movement, run backwards)'), dOpen > 300 && Math.abs(dClose - dOpen) / dOpen < 0.3, `open ${dOpen.toFixed(0)} ms, close ${dClose.toFixed(0)} ms`);
    await vBtn().click(); await page.waitForTimeout(1500);
    await page.locator('.pv-grip, .pv-bar, .pv-chain').first().focus(); for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150);
    const held = await P.amount();
    await page.waitForTimeout(2200);
    const raised = await P.amount();
    check(T('moving the shade up with the vanes open closes the vanes first (the shade waits at the bottom), then it rises'), held >= 99 && raised < 85 && raised > 70 && (await vanesNow()) < 0.02 && (await ctl.count()) === 0, `held ${held}, then ${raised}`);
    await P.setAmount(100); await page.waitForTimeout(1800);
    check(T('lowered again, the vanes open again by themselves'), (await ctl.getAttribute('data-vanes')) === 'open');
    await P.setAmount(0); await page.waitForTimeout(2500); const up = await P.shot();
    check(T('raised, it rolls into the cassette (clear glass below it)'), lum(mean(up, 0.3, 0.2, 0.4, 0.6)) > lum(mean(closed, 0.3, 0.2, 0.4, 0.6)) + 20, `amount ${await P.amount()}`);
    // the chain itself: pulling the lowering strand all the way opens the vanes at the bottom; pulling the other strand closes them first, then the shade rises
    const hit = (n) => page.locator(`.pv-chain-hit[data-strand="${n}"]`);
    const pull = async (n, dy) => { const b = await hit(n).boundingBox(), x = b.x + b.width / 2, y = b.y + 30; await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + dy, { steps: 14 }); await page.mouse.up(); };
    if (vw > 700) {
      await pull('lower', 900); await page.waitForTimeout(1800);
      check(T('chain: pulling the lowering strand all the way down lowers the shade and the vanes open at the bottom'), (await P.amount()) >= 99 && (await ctl.getAttribute('data-vanes')) === 'open', `amount ${await P.amount()}`);
      await pull('raise', 120); await page.waitForTimeout(2500);
      check(T('chain: pulling the other strand closes the vanes first, then the shade rises'), (await P.amount()) < 99 && (await vanesNow()) < 0.02, `amount ${await P.amount()}`);
    }
    await P.card('Motorized').click(); await page.waitForTimeout(900); await P.top();
    check(T('motorized: the remote has up, stop and down, and there is no vane control until the shade is at the bottom'), (await page.locator('.pv-incl .rm-key').count()) === 3 && (await ctl.count()) === 0);
    await P.setAmount(70); await page.getByRole('button', { name: 'Lower the shade' }).click();
    await page.waitForFunction(() => document.querySelector('.pv-ctl')?.dataset.vanes === 'open', null, { timeout: 15000 }).catch(() => {});
    check(T('motorized: Down runs the shade to the bottom, then the vanes open automatically'), (await P.amount()) >= 99 && (await ctl.getAttribute('data-vanes')) === 'open', `amount ${await P.amount()}`);
    await page.getByRole('button', { name: 'Raise the shade' }).click(); await page.waitForTimeout(250);
    const hold = await P.amount(); await page.waitForTimeout(3500); await page.getByRole('button', { name: 'Stop' }).click();
    check(T('motorized: Up closes the vanes first, then raises the shade'), hold >= 99 && (await P.amount()) < 95 && (await vanesNow()) < 0.02, `${hold} then ${await P.amount()}`);
    check(T('no console errors'), P.errors.length === 0, P.errors.join(' | '));
    await P.close();
  }
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser.close();
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
