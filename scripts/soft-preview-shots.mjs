// Screenshots of the Cellular, Roman and Shangri-La previews at NORMAL size (the whole preview with its buttons, not a zoomed crop), desktop and phone.
//   BASE_URL=http://localhost:4173 node scripts/soft-preview-shots.mjs <outDir> [sheet,sheet]
// Needs a preview server of the built site (npm run build; npx vite preview --port 4173). Reads the live catalog, writes nothing.
import sharp from 'sharp';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const OUT = process.argv[2], WANT = (process.argv[3] || '').split(',').filter(Boolean), BASE = process.env.BASE_URL || 'http://localhost:4173';
const VIEWS = { desktop: { width: 1280, height: 900, dpr: 1, mobile: false, cell: 520 }, phone: { width: 390, height: 844, dpr: 2, mobile: true, cell: 342 } };
const CELL = { chain: { desktop: 400, phone: 300 } };            // narrower cells on the five-across chain sheet
const ROMAN = ['Flat', 'Light-filtering lining'];
// a cell: [label, line, { pre: cards clicked before the color, codes, cards: cards clicked after it, amount (bottom), upper (top or middle rail), clicks: buttons under the picture }]
const pos = (line, o, name) => [['raised', 0], ['half', 50], ['lowered', 100]].map(([t, a]) => [`${name}, ${t}`, line, { ...o, amount: a }]);
const SHEETS = {
  positions: { cols: 3, cells: [...pos('cellular', { codes: ['YHC38L007'] }, 'Cellular'), ...pos('roman', { codes: ['SP26005002'], cards: ROMAN }, 'Roman'), ...pos('shangri-la', { codes: ['YSLH204'] }, 'Shangri-La')] },
  cellular: { cols: 3, cells: [
    ['Top-down/bottom-up, the top dropped', 'cellular', { pre: ['Top-down/bottom-up'], codes: ['YHC38L012'], amount: 90, upper: 45 }],
    ['Top-down/bottom-up, motorized (Top rail and Bottom rail rows)', 'cellular', { pre: ['Top-down/bottom-up'], codes: ['YHC38L005'], cards: ['Motorized'], amount: 75, upper: 25 }],
    ['Day & Night, both cloths showing', 'cellular', { pre: ['Day & night'], codes: ['YHC38SL01', 'YHC38LB630'] }],
    ['Day & Night, switched to the day fabric', 'cellular', { pre: ['Day & night'], codes: ['YHC38SL01', 'YHC38LB630'], clicks: ['Day fabric'] }],
    ['Day & Night, switched to the night fabric', 'cellular', { pre: ['Day & night'], codes: ['YHC38SL01', 'YHC38LB630'], clicks: ['Night fabric'] }],
    ['Standard, cord loop on the left (beige)', 'cellular', { codes: ['YHC38L003'], cards: ['Chain', 'Cord loop', 'Left'], dots: [['Cord loop color', 'Beige']], amount: 65 }],
  ] },
  styles: { cols: 3, cells: [
    ['Shangri-La, vanes closed (privacy)', 'shangri-la', { codes: ['YSLP603'], amount: 100 }],
    ['Shangri-La, vanes open', 'shangri-la', { codes: ['YSLP603'], clicks: ['Open vanes'] }],
    ['Shangri-La, motorized, half raised', 'shangri-la', { codes: ['YSLS903'], cards: ['Motorized'], amount: 50 }],
    ['Roman, Hobble', 'roman', { codes: ['SP26005002'], cards: ['Hobble', 'Light-filtering lining'], amount: 70 }],
    ['Roman, Relax', 'roman', { codes: ['SP26005002'], cards: ['Relax', 'Light-filtering lining'], amount: 70 }],
    ['Roman, Ribble', 'roman', { codes: ['SP26005002'], cards: ['Ribble', 'Light-filtering lining'], amount: 70 }],
    ['Roman, Plain fold', 'roman', { codes: ['SP26005002'], cards: ['Plain fold', 'Light-filtering lining'], amount: 70 }],
    ['Roman, Flat, light-filtering lining', 'roman', { codes: ['SP26029003'], cards: ROMAN, amount: 100 }],
    ['Roman, Flat, blackout lining', 'roman', { codes: ['SP26029003'], cards: ['Flat', 'Blackout lining'], amount: 100 }],
  ] },
  // the review of pull request 19: nothing on the wall beside a motorized shade, the rail color option, Stop on both remote rows, the linings, the day & night
  // handles side by side, and the chain coming straight out of the end of the cassette on every line that has one (with a zoomed crop of that end)
  review: { cols: 3, cells: [
    ['1. Shangri-La, motorized, half raised: nothing on the wall', 'shangri-la', { codes: ['YSLS903'], cards: ['Motorized'], amount: 50 }],
    ['2. Cellular, rail color Night Black', 'cellular', { codes: ['YHC38L003'], dots: [['Rail color', 'Night Black']], amount: 60 }],
    ['2. Roman, headrail color Iron Gray', 'roman', { codes: ['SP26057001'], cards: ROMAN, dots: [['Headrail color', 'Iron Gray']], amount: 60 }],
    ['2. Shangri-La, cassette color Sand Beige', 'shangri-la', { codes: ['YSLP1004'], dots: [['Cassette color', 'Sand Beige']], amount: 60 }],
    ['3. Top-down/bottom-up, motorized: Stop on both rows', 'cellular', { pre: ['Top-down/bottom-up'], codes: ['YHC38L005'], cards: ['Motorized'], amount: 75, upper: 25 }],
    ['3. Day & Night, motorized: Stop on both rows', 'cellular', { pre: ['Day & night'], codes: ['YHC38SL01', 'YHC38LB630'], cards: ['Motorized'] }],
    ['4. Roman, light-filtering lining', 'roman', { codes: ['SP26029003'], cards: ROMAN, amount: 100 }],
    ['4. Roman, blackout lining', 'roman', { codes: ['SP26029003'], cards: ['Flat', 'Blackout lining'], amount: 100 }],
    ['6. Day & Night on the day fabric: handles side by side', 'cellular', { pre: ['Day & night'], codes: ['YHC38SL01', 'YHC38LB630'], clicks: ['Day fabric'] }],
    ['4. Roman, outside mount, light-filtering lining', 'roman', { codes: ['SP26057001'], cards: ['Flat', 'Light-filtering lining', 'Outside mount'], amount: 75 }],
    ['4. Roman, outside mount, blackout lining', 'roman', { codes: ['SP26057001'], cards: ['Flat', 'Blackout lining', 'Outside mount'], amount: 75 }],
    ['4. Cellular blackout also dims the room a little', 'cellular', { pre: ['Blackout'], codes: ['YHC38LB005'], amount: 100 }],
  ] },
  chain: { cols: 5, cells: [
    ...[['Roller', 'roller', { codes: ['YS180004'] }], ['Zebra', 'zebra', { codes: ['YZB208'] }], ['Cellular', 'cellular', { codes: ['YHC38L012'] }], ['Roman', 'roman', { codes: ['SP26005002'], cards: ROMAN }], ['Shangri-La', 'shangri-la', { codes: ['YSLH204'] }]]
      .flatMap(([n, l, o]) => [[`7. ${n}, chain`, l, { ...o, cards: [...(o.cards || []), 'Chain'], amount: 60 }]]),
    ...[['Roller', 'roller', { codes: ['YS180004'] }], ['Zebra', 'zebra', { codes: ['YZB208'] }], ['Cellular', 'cellular', { codes: ['YHC38L012'] }], ['Roman', 'roman', { codes: ['SP26005002'], cards: ROMAN }], ['Shangri-La', 'shangri-la', { codes: ['YSLH204'] }]]
      .flatMap(([n, l, o]) => [[`7. ${n}, the cassette end, zoomed`, l, { ...o, cards: [...(o.cards || []), 'Chain'], amount: 60, zoom: true }]]),
  ] },
  colors: { cols: 3, cells: [
    ['Cellular, white', 'cellular', { codes: ['YHC38SL01'], amount: 70 }], ['Cellular, dark (blackout)', 'cellular', { pre: ['Blackout'], codes: ['YHC38LB20'], amount: 70 }], ['Cellular, textured', 'cellular', { codes: ['YHCK003'], amount: 70 }],
    ['Roman, white', 'roman', { codes: ['SP26057001'], cards: ROMAN, amount: 70 }], ['Roman, dark', 'roman', { codes: ['SP26036003'], cards: ROMAN, amount: 70 }], ['Roman, patterned', 'roman', { codes: ['SP26056005'], cards: ROMAN, amount: 70 }],
    ['Shangri-La, white', 'shangri-la', { codes: ['YSLH201'], amount: 70 }], ['Shangri-La, dark', 'shangri-la', { codes: ['YSLP1004'], amount: 70 }], ['Shangri-La, textured', 'shangri-la', { codes: ['YSLK904'], amount: 70 }],
  ] },
};
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = async (buf, text, width) => { const svg = Buffer.from(`<svg width="${width}" height="28"><rect width="${width}" height="28" fill="#1d1a14"/><text x="8" y="19" font-size="14" font-family="sans-serif" fill="#fff">${esc(text)}</text></svg>`); return sharp(buf).extend({ top: 28, background: '#1d1a14' }).composite([{ input: svg, left: 0, top: 0 }]).png().toBuffer(); };

async function cell(v, [text, line, o]) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: o.zoom ? 4 : v.dpr, hasTouch: v.mobile, isMobile: v.mobile });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  try {
    await page.goto(`${BASE}/products/${line}`, { waitUntil: 'networkidle' });
    const card = (name) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
    const top = async () => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(450); };
    for (const c of o.pre || []) { await card(c).click(); await page.waitForTimeout(400); }
    for (let i = 0; i < (o.codes || []).length; i++) { const sc = page.locator('.s2-color').nth(i); await sc.locator('input[type=search]').fill(o.codes[i]); await page.waitForTimeout(500); await sc.locator('.s2-swgrid .s2-sw').first().click(); await page.waitForTimeout(400); }
    await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
    for (const c of o.cards || []) { await card(c).click(); await page.waitForTimeout(400); }
    for (const [group, name] of o.dots || []) { if (!(await page.locator('.s2-more').evaluate((d) => d.open))) await page.locator('.s2-more summary').click(); await page.locator(`.s2-cdots[aria-label="${group}"] .s2-cdot`).filter({ hasText: new RegExp(`^${name}$`) }).first().click(); await page.waitForTimeout(300); }
    await page.waitForSelector('.pv-stage.ready'); await page.waitForTimeout(1500);
    const setA = async (sel, amt) => { await top(); const g = page.locator(sel).first(); await g.focus(); for (let i = 0; i < 140; i++) { const a = Number(await g.getAttribute('aria-valuenow')); if (Math.abs(a - amt) <= 1) break; await page.keyboard.press(amt === 0 ? 'Home' : amt === 100 ? 'End' : a < amt ? 'ArrowDown' : 'ArrowUp'); } await page.evaluate(() => document.activeElement?.blur()); };
    if (o.amount != null) await setA('.pv-grip, .pv-bar, .pv-chain', o.amount);
    if (o.upper != null) await setA('[data-rail=top], [data-rail=middle]', o.upper);
    for (const c of o.clicks || []) { await top(); await page.getByRole('button', { name: c, exact: true }).first().click(); await page.waitForTimeout(2200); }
    await page.addStyleTag({ content: '.s2-bar, .s2-pricebar { display: none !important; }' });       // the sticky price bar would cover the bottom of the preview in the picture
    await top(); await page.waitForTimeout(1200);
    if (o.zoom) {                                                      // the top corner of the shade on the chain's side, four times larger
      const d = await page.locator('.pv-drag').boundingBox(), side = Math.min(120, d.width * 0.6);
      const crop = await page.screenshot({ clip: { x: d.x + d.width - side * 0.82, y: d.y - side * 0.12, width: side, height: side } });
      return label(await sharp(crop).resize({ width: v.cell }).png().toBuffer(), text, v.cell);
    }
    const buf = await page.locator('.pv').screenshot();
    return label(await sharp(buf).resize({ width: v.cell }).png().toBuffer(), text, v.cell);
  } finally { await ctx.close(); }
}

for (const [name, sheet] of Object.entries(SHEETS)) {
  if (WANT.length && !WANT.includes(name)) continue;
  for (const [vname, v0] of Object.entries(VIEWS)) {
    const v = { ...v0, cell: CELL[name]?.[vname] || v0.cell };
    const cells = new Array(sheet.cells.length); let next = 0;
    await Promise.all([0, 1, 2].map(async () => { while (next < sheet.cells.length) { const i = next++; cells[i] = await cell(v, sheet.cells[i]); } }));
    const ms = await Promise.all(cells.map((c) => sharp(c).metadata())), rows = Math.ceil(cells.length / sheet.cols), rowH = [];
    for (let r = 0; r < rows; r++) rowH.push(Math.max(...ms.slice(r * sheet.cols, (r + 1) * sheet.cols).map((m) => m.height)));
    const W = sheet.cols * v.cell + (sheet.cols - 1) * 8, H = rowH.reduce((a, b) => a + b + 8, 0);
    const parts = cells.map((c, i) => ({ input: c, left: (i % sheet.cols) * (v.cell + 8), top: rowH.slice(0, Math.floor(i / sheet.cols)).reduce((a, b) => a + b + 8, 0) }));
    await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(parts).jpeg({ quality: 88 }).toFile(`${OUT}/${name}-${vname}.jpg`);
    console.log(`${name}-${vname}.jpg`, `${W} x ${H}`);
  }
}
await browser.close();
