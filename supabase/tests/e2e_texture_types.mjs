// Texture type and source on the real product pages (live catalog, read-only; needs a preview server, BASE_URL default http://localhost:4173):
//   - the 3D shade draws each color as its type says: Generated for slub, mesh, twill, linen, stripe, smooth; Photo for tweed, motif, print (Bark Brown a photo, Jet Black generated);
//   - a generated slub / linen / smooth cloth shows no visible repeat on a 40 x 64 in shade (the repeat score, the strongest self-similarity of the fine structure at any shift
//     beyond the weave itself, stays under 0.62);
//   - a Zebra's solid band is the color of the photo's own solid band (read from the full photo, independently of the page): distance 4, b* 2, and the 3D shows the type's texture.
import { guard } from './lib/liveGuard.mjs';       // every write is checked: a test may only change what it created (see lib/liveGuard.mjs)
import { probeSession, dE, toLab, hexRgb } from './lib/shadeProbe.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const sharp = (await import('sharp')).default;
const { zebraColors, defaultSource } = await import('../../src/lib/textureType.js');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;
const TYPES = JSON.parse((await import('node:fs')).readFileSync(new URL('../../src/data/textureTypes.json', import.meta.url), 'utf8'));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); guard.wrapBrowser(browser);
const catalog = async (scope) => (await (await fetch(`${URL_}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${scope}}`)}`, { headers: { apikey: ANON } })).json());
const roller = []; for (const g of await catalog('roller')) for (const s of g.swatches || []) roller.push({ ...s, family: g.family || s.family });
const zebra = []; for (const g of await catalog('zebra')) for (const s of g.swatches || []) zebra.push(s);
const typeOf = (s) => s.texture_type || TYPES[s.id];

// the repeat score: the strongest normalized self-similarity of the fine structure at shifts beyond `minLag` pixels
function repeatScore(rgb, w, h, minLag) {
  const L = new Float32Array(w * h); for (let i = 0; i < w * h; i++) L[i] = 0.3 * rgb[i * 3] + 0.59 * rgb[i * 3 + 1] + 0.11 * rgb[i * 3 + 2];
  const R = 4, hp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, c = 0; for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) { s += L[yy * w + xx]; c++; } hp[y * w + x] = L[y * w + x] - s / c; }
  let best = 0;
  for (let dy = 0; dy <= Math.floor(h / 2); dy += 2) for (let dx = -Math.floor(w / 2); dx <= Math.floor(w / 2); dx += 2) {
    if (Math.hypot(dx, dy) < minLag) continue;
    let ab = 0, aa = 0, bb = 0; for (let y = 0; y + dy < h; y += 2) for (let x = Math.max(0, -dx); x < Math.min(w, w - dx); x += 2) { const a = hp[y * w + x], b = hp[(y + dy) * w + x + dx]; ab += a * b; aa += a * a; bb += b * b; }
    const r = ab / Math.sqrt(aa * bb || 1); if (r > best) best = r;
  }
  return best;
}
const byCode = (list, code) => list.find((s) => s.supplier_code === code);

for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844, mobile: true, dpr: 2 }]]) {
  // ---- roller: type and source of one color per type ----
  const PICK = [['solar', 'YS180006', 'Jet Black'], ['screen-view', 'YSS-T12-305', 'Bark Brown']];
  const bad = [], rep = [];
  let s = await probeSession(browser, vp); await s.select('solar');
  const wanted = [];
  for (const t of ['slub', 'linen', 'smooth', 'mesh', 'twill', 'tweed']) { const c = roller.find((x) => x.family === 'solar' && typeOf(x) === t && !x.preview_color); if (c) wanted.push([t, c]); }
  for (const [type, code] of [['solar', 'YS180006']]) { const r = await s.read(code, { zoom: true }); const look = r.look; if (!look || look.source !== 'generated') bad.push(`Jet Black ${look?.source}`); }
  for (const [t, c] of wanted) {
    try {
      const r = await s.read(c.supplier_code, { zoom: true }), look = r.look, exp = defaultSource(t);
      if (!look) { bad.push(`${t} ${c.display_name}: nothing drawn`); continue; }
      if (look.source !== exp) bad.push(`${t} ${c.display_name} (${c.supplier_code}): drawn ${look.source}, expected ${exp}`);
      if (['slub', 'linen', 'smooth'].includes(t) && r.zoom) {
        const zm = await sharp(r.zoom).metadata(), { data, info } = await sharp(r.zoom).extract({ left: Math.round(zm.width * 0.1), top: 0, width: Math.round(zm.width * 0.8), height: Math.round(zm.height * 0.7) }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        { const sc = repeatScore(data, info.width, info.height, 24); rep.push(`${t} ${c.supplier_code} ${sc.toFixed(2)}`); if (t !== 'smooth' && sc >= 0.62) bad.push(`${t} ${c.display_name}: repeat score ${sc.toFixed(2)} (needs under 0.62)`); }
      }
    } catch (e) { bad.push(`${t} ${c.display_name}: ${e.message.split('\n')[0]}`); }
  }
  check(`${label}: roller colors are drawn as their type says (Jet Black generated; slub, linen, smooth, mesh, twill generated; tweed from the photo) and generated cloth shows no repeat`, bad.length === 0 && wanted.length >= 4, bad.join(' | ') || rep.join(', '));
  await s.close();
  s = await probeSession(browser, vp); await s.select('screen-view');
  const bark = await s.read('YSS-T12-305');
  check(`${label}: Bark Brown (a pattern) is drawn from its photo`, bark.look?.source === 'photo' || ['motif', 'print', 'tweed'].includes(bark.look?.type), JSON.stringify(bark.look));
  await s.close();

  // ---- zebra: solid band color from the photo's solid band, texture by type ----
  s = await probeSession(browser, vp); await s.select('zebra');
  const zbad = [], zrows = [];
  for (const name of ['Tuxedo Black', 'Soot Gray', 'Cream', 'Truffle Chocolate', 'Mocha Chocolate', 'Angel White']) {
    const c = zebra.find((x) => x.display_name === name); if (!c) { zbad.push(`${name}: not in the catalog`); continue; }
    if (c.preview_color) { zrows.push(`${name} skipped (preview_color ${c.preview_color})`); continue; }
    try {
      const r = await s.read(c.supplier_code), res = await fetch(`${URL_}/storage/v1/object/public/swatches/${c.thumb_path}`);
      const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const z = zebraColors(data, info.width, info.height, c.color_family), d = dE(hexRgb(r.tile), hexRgb(z.hex)), db = Math.abs(toLab(hexRgb(r.tile))[2] - toLab(hexRgb(z.hex))[2]);
      zrows.push(`${name} tile ${r.tile} photo ${z.hex} d${d.toFixed(1)}`);
      if (d > 4 || db > 2) zbad.push(`${name}: tile ${r.tile} vs the photo's solid band ${z.hex} (distance ${d.toFixed(1)}, b* ${db.toFixed(1)})`);
      if (r.look?.weave !== 'zebra') zbad.push(`${name}: not drawn as a zebra`);
      if (r.sdHigh === undefined) zbad.push(`${name}: no reading`);
    } catch (e) { zbad.push(`${name}: ${e.message.split('\n')[0]}`); }
  }
  check(`${label}: Zebra solid bands match the photo's solid band (distance 4, b* 2)`, zbad.length === 0, zbad.join(' | ') || zrows.join('; '));
  check(`${label}: no page errors`, s.errors.length === 0, s.errors.join(' | '));
  await s.close();
}
await browser.close();
const badn = results.filter((x) => !x.ok);
console.log(`\n${results.length - badn.length}/${results.length} passed${badn.length ? ` | FAILED: ${badn.map((b) => b.name).join('; ')}` : ''}`);
process.exit(badn.length ? 1 : 0);
