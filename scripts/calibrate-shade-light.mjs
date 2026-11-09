// Calibrates the 3D light per shade type. Renders 13 known colors (9 greys and 4 tints) on each of solar, screen view, blackout and zebra through the real product
// pages (a headless browser; the live catalog with the preview colors of 13 swatches overridden), reads the face of the shade, and prints, per type and channel,
// the straight-line fit  face = a x texture + b  that src/room/lightCalibration.js is built from, plus how far each color lands from its tile.
//
//   BASE_URL=http://localhost:4173 node scripts/calibrate-shade-light.mjs [solar,screen-view,blackout,zebra] [--json out.json]
// Needs a preview server of the built site (npm run build; npx vite preview --port 4173).
import { writeFileSync } from 'node:fs';
import { probeSession, hexRgb, dE } from '../supabase/tests/lib/shadeProbe.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const TYPES = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'solar,screen-view,blackout,zebra').split(',');
const JSON_OUT = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const COLORS = ['#101010', '#2a2a2a', '#505050', '#787878', '#a0a0a0', '#c4c4c4', '#dcdcdc', '#ececec', '#f6f6f6', '#e6dcc8', '#8c6a4a', '#6f86a8', '#c8b8a0'];
const CODES = { solar: ['YS180006', 'YS180003', 'YS180002', 'YS180004', 'YS120002', 'YS120004', 'YS120001', 'YS120007', 'YS190002', 'YS190005', 'YS190001', 'YS190007', 'YS200804'],
  'screen-view': ['XSS000105', 'XSS000107', 'XSS000101', 'XSS000505', 'XSS000540', 'XSS000539', 'XSS000405', 'XSS000404', 'XSS030101', 'XSS030107', 'XSS050M16', 'XSS050M01', 'XSS000106'],
  blackout: ['YB180006', 'YB180003', 'YB180002', 'YB120002', 'YB120004', 'YB120001', 'YB120007', 'YB190002', 'YB190005', 'YB190001', 'YB190007', 'YB050007', 'YB050009'],
  zebra: ['YZB202', 'YZB201', 'YZB208', 'YZB210', 'YZB802', 'YZB804', 'YZB801', 'YZB807', 'YZB902', 'YZB901', 'YZB904', 'YZB2003', 'YZB2005'] };
const fit = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); }); const a = sxy / sxx; return { a, b: my - a * mx, r: Math.sqrt(xs.reduce((s, x, i) => s + (ys[i] - (my + a * (x - mx))) ** 2, 0) / n) }; };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const all = {};
for (const t of TYPES) {
  const overrides = Object.fromEntries(CODES[t].map((c, i) => [c, { preview_color: COLORS[i] }]));
  const s = await probeSession(browser, { overrides }); await s.select(t);
  const rows = []; for (let i = 0; i < COLORS.length; i++) rows.push(await s.read(CODES[t][i]));
  await s.close(); all[t] = rows.map((r) => ({ tile: r.tile, face: r.face, dE: +r.dE.toFixed(1), db: +r.db.toFixed(1) }));
  console.log(`\n== ${t}`);
  for (const r of rows) console.log(`  tile ${r.tile}  face ${r.face.map((v) => v.toFixed(0)).join(',')}  distance ${r.dE.toFixed(1)}  b* off ${r.db.toFixed(1)}`);
  // face as a function of the tile color (what the texture is aimed at today): the inverse of this is what the calibration needs
  const f = [0, 1, 2].map((c) => fit(rows.map((r) => hexRgb(r.tile)[c]), rows.map((r) => r.face[c])));
  console.log('  face = a x tile + b   R: ' + f[0].a.toFixed(3) + ' x + ' + f[0].b.toFixed(1) + '   G: ' + f[1].a.toFixed(3) + ' x + ' + f[1].b.toFixed(1) + '   B: ' + f[2].a.toFixed(3) + ' x + ' + f[2].b.toFixed(1) + '   (rms ' + f.map((x) => x.r.toFixed(1)).join('/') + ')');
}
await browser.close();
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(all, null, 1));
void dE;
