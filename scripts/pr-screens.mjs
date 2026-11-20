// Screenshots of the product-page preview at NORMAL size (not zoomed), desktop 1440 wide and phone 390 wide, for the review of the texture / chain / vanes work:
//   - every line (Roller, Zebra, Cellular, Roman, Shangri-La) with a light, a dark and a white fabric
//   - Zebra: Jet Black, Dark Chocolate, Bittersweet Chocolate, Safari Khaki, Vanilla Latte (the two chocolates are shown as they will be once the stale preview_color is removed: SIMULATED, nothing on live changes)
//   - the chain mid-drag on each line; Shangri-La at the bottom with the vanes open, and partway up with the vanes closed
//   node scripts/pr-screens.mjs <outDir>      (preview server at BASE_URL, default http://localhost:4173; reads the live catalog; writes nothing)
import { mkdirSync } from 'node:fs';
import { probeSession } from '../supabase/tests/lib/shadeProbe.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const OUT = process.argv[2] || 'shots', SB = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY; mkdirSync(OUT, { recursive: true });
const cat = async (scope) => (await (await fetch(`${SB}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${scope}}`)}`, { headers: { apikey: ANON } })).json());
const by = { solar: [], zebra: [], cellular: [], roman: [], 'shangri-la': [] };
for (const g of await cat('roller')) for (const s of g.swatches || []) if ((g.family || s.family) === 'solar') by.solar.push(s);
for (const g of await cat('zebra')) for (const s of g.swatches || []) by.zebra.push(s);
for (const g of await cat('cellular')) for (const s of g.swatches || []) if ((s.family || g.family) !== 'blackout') by.cellular.push(s);
for (const g of await cat('roman')) for (const s of g.swatches || []) if (s.roman_styles?.flat?.available) by.roman.push(s);
for (const g of await cat('shangri-la')) for (const s of g.swatches || []) by['shangri-la'].push(s);
const pickOf = (list, fam) => (fam === 'dark' ? ['Charcoal/Black', 'Brown', 'Blue', 'Green', 'Gray'].map((f) => list.find((s) => s.color_family === f && s.thumb_path)).find(Boolean) : list.find((s) => s.color_family === fam && s.thumb_path));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const NO_OVERRIDE = { YZB2008: { preview_color: null }, YZB3007: { preview_color: null } };
const shot = async (s, name) => { await s.page.evaluate(() => window.scrollTo(0, 0)); await s.page.waitForTimeout(500); await s.page.locator('.pv').screenshot({ path: `${OUT}/${name}.png` }); console.log(name); };
for (const [tag, vp] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844, mobile: true, dpr: 1 }]]) {
  const phone = tag === 'phone';
  // ---- fabrics on every line
  const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);          // ONLY=shangri-la,chain retakes just those
  for (const line of ['solar', 'zebra', 'cellular', 'roman', 'shangri-la'].filter((l) => !ONLY.length || ONLY.includes(l))) {
    const s = await probeSession(browser, { ...vp, overrides: NO_OVERRIDE }); await s.select(line);
    for (const [kind, fam] of [['light', 'Beige/Tan'], ['dark', 'dark'], ['white', 'White']]) {
      const sw = pickOf(by[line], fam); if (!sw) { console.log('none', line, kind); continue; }
      const r = await s.read(sw.supplier_code); if (r.skipped) continue; await shot(s, `${tag}-${line === 'solar' ? 'roller' : line}-${kind}-${sw.supplier_code}`);
    }
    await s.close();
  }
  // ---- zebra colors
  if (!ONLY.length || ONLY.includes('zebra')) { const s = await probeSession(browser, { ...vp, overrides: NO_OVERRIDE }); await s.select('zebra');
    for (const [name, code] of [['jet-black', 'DZB3105'], ['dark-chocolate', 'YZB2008'], ['bittersweet', 'YZB3007'], ['safari-khaki', 'YZB3003'], ['vanilla-latte', 'YZB3004']]) { await s.read(code); await shot(s, `${tag}-zebra-${name}-${code}`); }
    await s.close(); }
  // ---- the chain mid-drag, on each line
  for (const [line, probeType, code] of [['roller', 'solar', 'YS180006'], ['zebra', 'zebra', 'YZB202'], ['cellular', 'cellular', null], ['roman', 'roman', null], ['shangri-la', 'shangri-la', 'YSLH204']].filter(([l]) => !ONLY.length || ONLY.includes('chain') || ONLY.includes(l))) {
    const s = await probeSession(browser, vp); await s.select(probeType);
    const c = code || by[probeType][0].supplier_code;
    await s.read(c);
    for (const nm of ['Chain', 'Cord loop']) { if (await s.page.locator('.pv-chain').count()) break; const card = s.page.locator('.s2-card').filter({ has: s.page.locator('.s2-card-name', { hasText: new RegExp(`^${nm}$`) }) }).first(); if (await card.count()) { await card.click(); await s.page.waitForTimeout(900); } } await s.page.evaluate(() => window.scrollTo(0, 0)); await s.page.waitForTimeout(500);
    await s.page.waitForSelector('.pv-chain', { timeout: 15000 }).catch(() => {});
    const b = await s.page.locator('.pv-chain-hit[data-strand="lower"]').boundingBox(); if (!b) { console.log('no chain on', line); await s.close(); continue; }
    const x = b.x + b.width / 2, y = b.y + 24, dy = phone ? 40 : 110;
    if (!phone) { await s.page.mouse.move(x, y); await s.page.mouse.down(); await s.page.mouse.move(x, y + dy, { steps: 8 }); }
    else { const cdp = await s.ctx.newCDPSession(s.page); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * i) / 8 }] }); s.cdp = cdp; }
    await shot(s, `${tag}-chain-mid-drag-${line}`);
    if (!phone) await s.page.mouse.up(); else await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // ---- Shangri-La: bottom with the vanes open, then partway up with the vanes closed
    if (line === 'shangri-la') {
      await s.page.locator('.pv-chain').focus(); await s.page.keyboard.press('End'); await s.page.waitForTimeout(2200); await shot(s, `${tag}-shangri-la-bottom-vanes-open`);
      for (let i = 0; i < 14; i++) await s.page.keyboard.press('ArrowUp'); await s.page.waitForTimeout(3200); await shot(s, `${tag}-shangri-la-partway-up-vanes-closed`);
    }
    await s.close();
  }
}
await browser.close();
