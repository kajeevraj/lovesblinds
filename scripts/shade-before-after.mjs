// Before/after screenshots of the 3D preview for a list of colors: the whole preview and a zoomed crop of the shade, desktop and phone, from two builds served
// side by side (BEFORE_URL: the old build, AFTER_URL: the new one). Writes one sheet per viewport.
//   BEFORE_URL=http://localhost:4180 AFTER_URL=http://localhost:4173 node scripts/shade-before-after.mjs <outDir> [desktop|phone]
import sharp from 'sharp';
import { probeSession } from '../supabase/tests/lib/shadeProbe.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const OUT = process.argv[2], ONLY = process.argv[3], BEFORE = process.env.BEFORE_URL || 'http://localhost:4180', AFTER = process.env.AFTER_URL || 'http://localhost:4173';
const LIST = JSON.parse(process.env.COLORS || 'null') || [
  ['blackout', 'YB010001', 'Fresh White (blackout)'], ['blackout', 'DBL2002', 'Pure White (blackout)'], ['blackout', 'DBG2001', 'Ivory (blackout)'],
  ['zebra', 'YZB5101', 'Blizzard White (zebra)'], ['zebra', 'YZB201', 'Angel White (zebra)'], ['zebra', 'YZB501', 'Off-white (zebra)'],
  ['solar', 'YS180002', 'Clean White (solar)'], ['solar', 'YS180006', 'Jet Black (solar)'], ['screen-view', 'YSS-T12-305', 'Bark Brown (screen view)'],
  ['blackout', 'YB180006', 'Onyx Black (blackout)'], ['solar', 'YS180004', 'Flint Gray (solar)'], ['blackout', 'YB050252', 'Steel Gray (smooth blackout)'],
];
const VIEWS = { desktop: { width: 1280, height: 900, dpr: 2, mobile: false }, phone: { width: 390, height: 844, dpr: 2, mobile: true } };
const label = async (buf, text) => { const m = await sharp(buf).metadata(); const svg = Buffer.from(`<svg width="${m.width}" height="30"><rect width="${m.width}" height="30" fill="#1d1a14"/><text x="8" y="21" font-size="15" fill="#fff" font-family="sans-serif">${text.replace(/&/g, '&amp;')}</text></svg>`); return sharp({ create: { width: m.width, height: m.height + 30, channels: 3, background: '#fff' } }).composite([{ input: svg, top: 0, left: 0 }, { input: buf, top: 30, left: 0 }]).png().toBuffer(); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [vname, v] of Object.entries(VIEWS)) {
  if (ONLY && ONLY !== vname) continue;
  const rows = [];
  const sess = {};
  for (const [name, base] of [['before', BEFORE], ['after', AFTER]]) sess[name] = await probeSession(browser, { ...v, base });
  for (const [type, code, text] of LIST) {
    const r = {};
    for (const name of ['before', 'after']) { await sess[name].select(type); r[name] = await sess[name].read(code, { shot: true, zoom: true }); }
    const H = 330, cells = [];
    for (const [name, k] of [['before', 'shot'], ['after', 'shot']]) cells.push(await label(await sharp(r[name][k]).resize({ height: H }).png().toBuffer(), `${name}: face ${r[name].faceHex} (tile ${r[name].tile}, distance ${r[name].dE.toFixed(1)})`));
    for (const name of ['before', 'after']) cells.push(await label(await sharp(r[name].zoom).resize({ height: H }).png().toBuffer(), `${name} zoomed`));
    const ms = await Promise.all(cells.map((c) => sharp(c).metadata())), W = ms.reduce((s, m) => s + m.width + 8, 0);
    let x = 0; const comps = cells.map((c, i) => { const o = { input: c, left: x, top: 0 }; x += ms[i].width + 8; return o; });
    rows.push(await label(await sharp({ create: { width: W, height: ms[0].height, channels: 3, background: '#e8e4dc' } }).composite(comps).png().toBuffer(), text));
    console.log(vname, text, 'before', r.before.faceHex, `d${r.before.dE.toFixed(1)}`, 'after', r.after.faceHex, `d${r.after.dE.toFixed(1)}`, 'tile', r.after.tile, `sd ${r.before.sd.toFixed(1)} -> ${r.after.sd.toFixed(1)} (fine ${r.after.sdHigh.toFixed(1)}, wave ${r.after.sdWave.toFixed(1)})`);
  }
  for (const s of Object.values(sess)) await s.close();
  // sheets of 4 colors each (the images are large)
  for (let i = 0; i * 4 < rows.length; i++) {
    const part = rows.slice(i * 4, i * 4 + 4), ms = await Promise.all(part.map((c) => sharp(c).metadata())), W = Math.max(...ms.map((m) => m.width)), Ht = ms.reduce((s, m) => s + m.height + 8, 0);
    let y = 0; await sharp({ create: { width: W, height: Ht, channels: 3, background: '#fff' } }).composite(part.map((c, k) => { const o = { input: c, left: 0, top: y }; y += ms[k].height + 8; return o; })).jpeg({ quality: 86 }).toFile(`${OUT}/ba-${vname}-${i + 1}.jpg`);
  }
}
await browser.close();
