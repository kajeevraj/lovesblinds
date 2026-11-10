// Screenshots of the 3D preview (normal size) each next to its supplier photo: the zebra colors and one roller color per texture type; desktop and phone.
//   node scripts/texture-screens.mjs <outDir>      (preview server at BASE_URL, default http://localhost:4173; reads the live catalog and photos; writes nothing)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { probeSession } from '../supabase/tests/lib/shadeProbe.mjs';
const sharp = createRequire(import.meta.url)('sharp');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const OUT = process.argv[2] || 'texture-screens', SB = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY; mkdirSync(OUT, { recursive: true });
const cat = async (scope) => (await (await fetch(`${SB}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${scope}}`)}`, { headers: { apikey: ANON } })).json());
const all = {}; for (const sc of ['roller', 'zebra']) for (const g of await cat(sc)) for (const s of g.swatches || []) all[s.supplier_code] = { ...s, fam: g.family || s.family };
const ZEBRA = ['YZB2008', 'YZB3007', 'YZB3306', 'YZB807', 'YZB5006', 'YZB2005', 'YZB202', 'YZB201'];             // Dark Chocolate, Bittersweet, Truffle, Mocha, Tuxedo Black, Soot Gray, Cream, Angel White (a folded photo)
const ROLLER = [['slub', 'YS180006'], ['mesh', 'WSS360105'], ['twill', 'YB050011'], ['linen', 'YS205908'], ['tweed', 'XS230003'], ['motif', 'YSS-T12-305'], ['print', 'YSS-T10-302'], ['stripe', 'XS140004'], ['smooth', 'YB010001']];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const photo = async (s, h) => sharp(Buffer.from(await (await fetch(`${SB}/storage/v1/object/public/swatches/${s.thumb_path}`)).arrayBuffer())).resize({ height: h }).png().toBuffer();
const label = (t, w) => sharp({ create: { width: w, height: 28, channels: 3, background: '#fff' } }).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="28"><text x="6" y="19" font-family="sans-serif" font-size="14">${t.replace(/&/g, '&amp;')}</text></svg>`) }]).png().toBuffer();
for (const [tag, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844, mobile: true, dpr: 2 }]]) {
  for (const [group, items] of [['zebra', ZEBRA.map((c) => ['zebra', c])], ['roller', ROLLER]]) {
    const s = await probeSession(browser, vp); const cache = {};
    for (const [t, code] of items) {
      const sw = all[code]; if (!sw) { console.log('missing', code); continue; }
      const sel = group === 'zebra' ? 'zebra' : sw.fam === 'blackout' ? 'blackout' : sw.fam === 'screen-view' ? 'screen-view' : 'solar';
      await s.select(sel); const r = await s.read(code, { shot: true }), look = r.look || {};
      const shot = await sharp(r.shot).png().toBuffer(), meta = await sharp(shot).metadata(), ph = await photo(sw, meta.height), pm = await sharp(ph).metadata();
      const w = meta.width + pm.width + 10, cap = `${sw.display_name} (${code}, ${group})  type ${look.type || t}  ${look.source || ''}  tile ${r.tile}   |  photo left, 3D preview right`;
      await sharp({ create: { width: w, height: meta.height + 28, channels: 3, background: '#fff' } }).composite([{ input: await label(cap, w), top: 0, left: 0 }, { input: ph, top: 28, left: 0 }, { input: shot, top: 28, left: pm.width + 10 }]).png().toFile(`${OUT}/${tag}-${group}-${code}.png`);
      console.log(tag, code, look.type, look.source);
    }
    await s.close();
  }
}
await browser.close();
