// Before/after of the 3D preview at NORMAL size (the whole preview, not a zoomed crop), desktop and phone, from two builds served side by side.
//   BEFORE_URL=http://localhost:4180 AFTER_URL=http://localhost:4173 node scripts/shade-compare.mjs <outDir>
// Prints, per color and viewport, how many times the pattern repeats across a 40 in shade (read from the page) next to the picture.
import sharp from 'sharp';
import { probeSession } from '../supabase/tests/lib/shadeProbe.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const OUT = process.argv[2], BEFORE = process.env.BEFORE_URL || 'http://localhost:4180', AFTER = process.env.AFTER_URL || 'http://localhost:4173';
const LIST = JSON.parse(process.env.COLORS || 'null') || [
  ['solar', 'YS180006', 'Jet Black (solar)'], ['blackout', 'YB180006', 'Onyx Black (blackout)'], ['solar', 'YS180004', 'Flint Gray (solar)'],
  ['screen-view', 'YSS-T12-305', 'Bark Brown (screen view)'], ['blackout', 'YB050252', 'Steel Gray (smooth blackout)'], ['screen-view', 'WSS360839', 'Brown basket (screen view)'],
];
const VIEWS = { desktop: { width: 1280, height: 900, dpr: 1, mobile: false }, phone: { width: 390, height: 844, dpr: 2, mobile: true } };
const label = async (buf, text) => { const m = await sharp(buf).metadata(); const svg = Buffer.from(`<svg width="${m.width}" height="30"><rect width="${m.width}" height="30" fill="#1d1a14"/><text x="8" y="21" font-size="15" font-family="sans-serif" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`); return sharp(buf).extend({ top: 30, background: '#1d1a14' }).composite([{ input: svg, left: 0, top: 0 }]).png().toBuffer(); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [vname, v] of Object.entries(VIEWS)) {
  const sess = {}; for (const [n, b] of [['before', BEFORE], ['after', AFTER]]) sess[n] = await probeSession(browser, { ...v, base: b });
  const rows = [];
  for (const [type, code, text] of LIST) {
    const cells = [];
    for (const n of ['before', 'after']) { await sess[n].select(type); const r = await sess[n].read(code, { shot: true }); cells.push(await label(await sharp(r.shot).resize({ width: vname === 'phone' ? 360 : 640 }).png().toBuffer(), `${n}: ${text}  fine ${r.sdHigh.toFixed(1)}, wave ${r.sdWave.toFixed(1)}, distance ${r.dE.toFixed(1)}`)); }
    const ms = await Promise.all(cells.map((c) => sharp(c).metadata())), W = ms[0].width + ms[1].width + 8, H = Math.max(ms[0].height, ms[1].height);
    rows.push(await sharp({ create: { width: W, height: H, channels: 3, background: '#e8e4dc' } }).composite([{ input: cells[0], left: 0, top: 0 }, { input: cells[1], left: ms[0].width + 8, top: 0 }]).png().toBuffer());
    console.log(vname, text, 'done');
  }
  for (const s of Object.values(sess)) await s.close();
  for (let i = 0; i * 2 < rows.length; i++) {
    const part = rows.slice(i * 2, i * 2 + 2), ms = await Promise.all(part.map((c) => sharp(c).metadata())), W = Math.max(...ms.map((m) => m.width)), Ht = ms.reduce((s, m) => s + m.height + 8, 0); let y = 0;
    await sharp({ create: { width: W, height: Ht, channels: 3, background: '#fff' } }).composite(part.map((c, k) => { const o = { input: c, left: 0, top: y }; y += ms[k].height + 8; return o; })).jpeg({ quality: 88 }).toFile(`${OUT}/cmp-${vname}-${i + 1}.jpg`);
  }
}
await browser.close();
