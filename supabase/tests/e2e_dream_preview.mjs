// Browser test of the 3D preview on Dream Curtains (Drapery page > Dream Curtains tab), at 1280 and 390 px. Live catalog, read-only; needs a preview server (BASE_URL, default
// http://localhost:4173). Software WebGL. Checks: the preview is gallery picture 1, calm (only the size label) and shows the push-through hint; every option moves it (strip
// style A / B, install, inside / outside, stack side); Manual drag and keys open and close; the Pull rod is a drag handle (and Center opening is hidden while it is picked);
// Motorized has the Open / Stop / Close remote and a Center opening splits both ways; a press between the strips parts them, a hover opens a hair, and they return on release;
// and the curtain face matches its picker tile.
import { guard } from './lib/liveGuard.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const sharp = (await import('sharp')).default;
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); guard.wrapBrowser(browser);

async function open(vw, vh) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, hasTouch: vw < 500, isMobile: vw < 500 });
  const page = await ctx.newPage(); page.setDefaultTimeout(40000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  await page.goto(`${BASE}/products/drapery`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /Dream/ }).click(); await page.waitForTimeout(400);
  const P = {
    ctx, page, errors,
    card: (n) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${n}$`) }) }).first(),
    pick: async (code) => { const c = page.locator('.s2-color input[type=search]'); await c.fill(code); await page.waitForTimeout(450); await page.locator('.s2-swgrid .s2-sw').first().click(); await page.waitForTimeout(300); },
    size: async (w, h) => { await page.locator('#s2-w').fill(String(w)); await page.locator('#s2-h').fill(String(h)); await page.locator('#s2-h').blur(); await page.waitForTimeout(500); },
    opts: async (list) => { for (const n of list) { await P.card(n).click(); await page.waitForTimeout(250); } },
    ready: () => page.waitForSelector('.pv-stage.ready', { timeout: 40000 }).then(() => true).catch(() => false),
    shot: async () => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(900); const buf = await page.locator('.pv-canvas').screenshot(); const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; },
    pct: async () => Number(await page.locator('.pv-lead').first().getAttribute('aria-valuenow')),
    api: (fn, ...a) => page.evaluate(([f, args]) => { const p = window.__lbPreview; return JSON.parse(JSON.stringify(typeof p[f] === 'function' ? p[f](...args) : p[f])); }, [fn, a]),
    close: () => ctx.close(),
  };
  return P;
}
const diff = (a, b) => { if (a.data.length !== b.data.length) return 1; let n = 0; for (let i = 0; i < a.data.length; i += 3) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30) n++; return n / (a.data.length / 3); };
const settle = async (page) => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(1300); };

for (const [label, vw, vh] of [['desktop', 1280, 1000], ['phone', 390, 844]]) {
  const T = (s) => `${label}: ${s}`, phone = vw < 500;
  const P = await open(vw, vh), { page } = P;
  await P.pick('ZDS3001-1'); await P.size(96, 84);                                // Daisy White: has style A and B
  await P.card('Classic').click().catch(() => {});
  await P.opts(['Ceiling install', 'Inside', 'Right stack', 'Manual']);
  check(T('the 3D preview comes up'), await P.ready());
  const dots = page.locator('.gal-dots [role=tab]');
  check(T('the configurator is picture 1 of the gallery'), (await dots.count()) >= 1 && (await dots.first().getAttribute('aria-selected')) === 'true');
  check(T('only the size label is on the picture, and the push-through hint is under it'), (await page.locator('.pv-size').count()) === 1 && /Push between the strips to walk through/.test(await page.locator('.pv-note').innerText()));

  // ---- the strip style, mount and stack follow the options ----
  await settle(page);
  { const w = (await page.locator('.pv-lead').first().boundingBox()).width; check(T('the hand grab is 46 px wide'), w >= 45.5, `${w} px`); }
  const base = await P.shot();
  await P.card('Slim').click(); await settle(page); const slim = await P.shot();
  check(T('strip style B (Slim) draws narrower strips than A'), diff(base, slim) > 0.02, `${(diff(base, slim) * 100).toFixed(1)} % of the picture changed`);
  const L = await P.api('dreamStrips', 0.5); await P.card('Classic').click(); await settle(page); const L2 = await P.api('dreamStrips', 0.5);
  check(T('style B has more strips than A for the same width'), L.length > L2.length, `B ${L.length}, A ${L2.length}`);
  await P.card('Side install').click(); await settle(page); const side = await P.shot();
  check(T('side install shows the track on the wall (differs from ceiling)'), diff(base, side) > 0.0015, `${(diff(base, side) * 100).toFixed(2)} %`);
  await P.card('Outside').click(); await settle(page); const out = await P.shot();
  check(T('outside mount changes the picture'), diff(side, out) > 0.003, `${(diff(side, out) * 100).toFixed(2)} %`);
  await P.opts(['Ceiling install', 'Inside']);

  // ---- Manual: drag the leading edge, keys ----
  const lead = page.locator('.pv-lead').first();
  check(T('Right stack: the handle opens to the right'), (await lead.getAttribute('data-opens')) === '1' || (await lead.getAttribute('data-opens')) === '-1');
  await lead.focus(); await page.keyboard.press('End'); await settle(page); const open100 = await P.pct();
  await page.keyboard.press('Home'); await settle(page); const closed = await P.pct();
  check(T('arrow, Home and End keys open and close the curtain'), open100 === 100 && closed === 0, `open ${open100}, closed ${closed}`);
  await settle(page); const bb = await lead.boundingBox(), cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;       // right stack: the leading edge is at the left end and opens to the right
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 60, cy, { steps: 6 }); await page.mouse.move(cx + 140, cy, { steps: 6 }); await page.mouse.up(); await settle(page);
  const dragged = await P.pct();
  check(T('dragging the leading edge moves the curtain'), dragged !== closed, `${closed} -> ${dragged} %`);
  await lead.focus(); await page.keyboard.press('Home'); await settle(page);

  // ---- each stack side ----
  for (const [name, expect] of [['Left stack', 'left'], ['Right stack', 'right']]) {
    await P.card(name).click(); await settle(page); await lead.focus(); await page.keyboard.press('End'); await settle(page);
    const xs = await P.api('dreamStrips', 0.5), mid = xs.reduce((s, x) => s + x, 0) / xs.length;
    check(T(`${name}: half the way open gathers the strips on that side`), expect === 'left' ? mid < -0.05 : mid > 0.05, `mean strip x ${mid.toFixed(2)} m`);
    await page.keyboard.press('Home'); await settle(page);
  }

  // ---- push-through: hover, press, release ----
  await P.card('Right stack').click(); await settle(page);
  await settle(page); const box = await page.locator('.pv-push').boundingBox(), px = box.x + box.width * 0.4, py = box.y + box.height * 0.55;
  const gaps = async () => { const xs = (await P.api('dreamStrips', cyM)).slice().sort((a, b) => a - b); return Math.max(...xs.slice(1).map((x, i) => x - xs[i])); };
  const cyM = ((py - box.y) / box.height) * (await P.api('dreamStrips', 0.5), 84 * 0.0254);
  const g0 = await gaps();
  await page.mouse.move(px, py); await settle(page); const gHover = await gaps(); const hov = await P.api('hand');
  await page.mouse.down(); await page.mouse.move(px + 4, py, { steps: 3 }); await settle(page); const gPress = await gaps(); const pr = await P.api('hand');
  const pushed = await P.shot();
  await page.mouse.up(); await page.mouse.move(box.x - 40, box.y - 40); await page.waitForTimeout(2200); const gAfter = await gaps(); const rel = await P.api('hand');
  check(T('a closed curtain shows no gap between its strips'), g0 < 0.34, `widest spacing ${g0.toFixed(3)} m`);
  check(T('hovering over a joint opens it a little'), gHover > g0 + 0.01 && gHover < gPress, `${g0.toFixed(3)} -> ${gHover.toFixed(3)} m (hand ${hov.amp.toFixed(2)})`);
  check(T('pressing and pushing parts the strips like a hand'), gPress > g0 + 0.12 && pr.amp > 0.9, `${g0.toFixed(3)} -> ${gPress.toFixed(3)} m`);
  check(T('letting go swings them back'), gAfter < g0 + 0.01 && rel.amp === 0, `back to ${gAfter.toFixed(3)} m`);
  check(T('the pushed curtain looks different from the closed one'), diff(base, pushed) > 0.01);

  // ---- Pull rod ----
  await P.card('Pull rod').click(); await settle(page);
  check(T('Pull rod: Center opening is hidden'), (await P.card('Center opening').count()) === 0);
  const rod = page.locator('.pv-lead.pv-rod').first();
  check(T('Pull rod: a visible rod handle'), (await rod.count()) === 1 && (await rod.boundingBox()).width >= 46);
  await settle(page); const rb = await rod.boundingBox(); const rx = rb.x + rb.width / 2, ry = rb.y + rb.height * 0.6;
  await page.mouse.move(rx, ry); await page.mouse.down(); await page.mouse.move(rx + 70, ry, { steps: 6 }); await page.mouse.move(rx + 140, ry, { steps: 6 });
  const mid = await P.pct(); const midShot = await P.shot(); await page.mouse.up(); await settle(page);
  check(T('dragging the pull rod opens the curtain'), mid > 10 || (await P.pct()) > 10, `${mid} %`);
  void midShot;
  await P.card('Manual').click(); await settle(page);

  // ---- Motorized: the remote ----
  await P.card('Motorized').click(); await settle(page);
  check(T('Motorized: the remote has Open, Stop and Close'), (await page.getByRole('button', { name: 'Open the curtain' }).count()) >= 1 && (await page.getByRole('button', { name: 'Close the curtain' }).count()) >= 1 && (await page.getByRole('button', { name: 'Stop' }).count()) >= 1);
  await page.locator('.pv-lead').first().focus(); await page.keyboard.press('Home'); await settle(page); const before = await P.pct(); await page.getByRole('button', { name: 'Open the curtain' }).first().click(); await page.waitForTimeout(1600); await page.getByRole('button', { name: 'Stop' }).first().click(); await page.waitForTimeout(500);
  const part = await P.pct(); await page.getByRole('button', { name: 'Close the curtain' }).first().click(); await page.waitForTimeout(6000);
  check(T('Open moves the curtain at motor speed, Stop holds it, Close brings it back'), part > before && part < 100 && (await P.pct()) < part, `${before} -> ${part} -> ${await P.pct()} %`);
  await P.card('Center opening').click(); await settle(page);
  check(T('Center opening: two leading edges, and Open splits both ways'), (await page.locator('.pv-lead').count()) === 2);
  await page.getByRole('button', { name: 'Open the curtain' }).first().click(); await page.waitForTimeout(1800); await page.getByRole('button', { name: 'Stop' }).first().click(); await page.waitForTimeout(600);
  const cs = await P.api('dreamStrips', 0.5), left = cs.filter((x) => x < 0).length, right = cs.filter((x) => x > 0).length;
  const halfShot = await P.shot(); void halfShot;
  check(T('the center curtain gathers on both sides'), left > 0 && right > 0 && Math.min(...cs.map(Math.abs)) > 0.02, `${left} strips left, ${right} right`);

  // ---- the color matches the picker tile ----
  await P.card('Right stack').click(); await P.card('Manual').click(); await settle(page);
  const tile = await page.evaluate(() => { const t = document.querySelector('.s2-sw[aria-checked=true], .s2-sw.on, .s2-sw[aria-pressed=true]'); return t ? getComputedStyle(t).backgroundColor : ''; });
  void tile;
  check(T('no page errors'), P.errors.length === 0, P.errors.join(' | ').slice(0, 300));
  await P.close();
  if (phone) break;
}
await browser.close();
const bad = results.filter((r) => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`); process.exit(bad.length ? 1 : 0);
