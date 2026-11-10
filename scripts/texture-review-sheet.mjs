// The REVIEW SHEET: for every color, grouped by texture type, the supplier photo next to a close-up of the 3D preview fabric (a 40 x 64 shade, lowered, at normal size on a
// 1280 px desktop: not zoomed), marked Generated or Photo, with the ones where the type looks uncertain flagged. One picture per type.
//   BASE_URL=http://localhost:4173 node scripts/texture-review-sheet.mjs <outDir> [type,type]     (needs a preview server of the built site; reads the live catalog; writes nothing)
// Needs docs/texture-types/report.json (node scripts/classify-textures.mjs) and the photos (downloaded here from the public bucket).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173', OUT = process.argv[2], WANT = (process.argv[3] || '').split(',').filter(Boolean);
const SB = process.env.SUPABASE_URL, REPORT = JSON.parse(readFileSync(new URL('../docs/texture-types/report.json', import.meta.url), 'utf8'));
const TYPES = ['slub', 'mesh', 'twill', 'linen', 'tweed', 'motif', 'print', 'stripe', 'smooth'];
const LABEL = { slub: 'Slub streaks', mesh: 'Fine mesh / basketweave', twill: 'Twill / diagonal', linen: 'Linen look', tweed: 'Tweed / multicolor', motif: 'Geometric motif', print: 'Print / jacquard', stripe: 'Vertical stripe', smooth: 'Smooth' };
const PAGE = { roller: 'roller', zebra: 'zebra', 'shangri-la': 'shangri-la', cellular: 'cellular', drapery: 'roman', 'dream-curtains': 'drapery' };
const FAMCARD = { solar: 'Solar', 'screen-view': 'Screen view', blackout: 'Blackout', 'light-filtering': 'Light filtering' };
const todo = REPORT.filter((r) => !WANT.length || WANT.includes(r.type));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const photo = async (r) => { const res = await fetch(`${SB}/storage/v1/object/public/swatches/${r.thumb || `thumb/${r.line}/${r.code}.webp`}`); return res.ok ? Buffer.from(await res.arrayBuffer()) : null; };
const tp = {}; { const cat = await Promise.all(['roller', 'zebra', 'shangri-la', 'cellular', 'roman', 'dream-curtains'].map(async (sc) => (await (await fetch(`${SB}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${sc}}`)}`, { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY } })).json()))); for (const g of cat.flat()) for (const s of g.swatches || []) tp[s.id] = s.thumb_path; }
const CELL = 150;

// one worker per line: it keeps its page open and moves from color to color
async function worker(lineKey, list, results) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }), page = await ctx.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', () => {});
  const dream = lineKey === 'dream-curtains';
  let open = null;
  for (const r of list) {
    try {
      const target = PAGE[r.line], famKey = `${target}|${r.family || ''}`;
      if (open !== (dream ? 'dream' : famKey)) {
        await page.goto(`${BASE}/products/${dream ? 'drapery' : target}`, { waitUntil: 'networkidle' });
        if (dream) await page.getByRole('tab', { name: /Dream/ }).click();
        await page.locator('.s2-swgrid .s2-sw').first().waitFor();
        if (!dream) { await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill(target === 'zebra' ? '72' : '64'); }
        const card = (n) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${n}$`) }) }).first();
        if (r.family && FAMCARD[r.family]) { await card(FAMCARD[r.family]).click(); await page.waitForTimeout(500); }
        if (target === 'cellular') { await card('Chain').click().catch(() => {}); await page.waitForTimeout(300); }
        open = dream ? 'dream' : famKey;
      }
      await page.evaluate(() => { window.__lbLooks = {}; });
      await page.locator('.s2-color input[type=search]').fill(r.code); await page.waitForTimeout(450);
      const tile = page.locator('.s2-swgrid .s2-sw').first(); await tile.click();
      let crop = null, look = null;
      if (dream) {
        const cv = tile.locator('canvas'); await page.waitForFunction((el) => el.dataset.ready === '1', await cv.elementHandle());
        const url = await cv.evaluate((c) => c.toDataURL('image/png')); crop = Buffer.from(url.split(',')[1], 'base64');
        look = { mode: await cv.getAttribute('data-mode'), source: await cv.getAttribute('data-source') };
      } else {
        await page.waitForFunction(() => Object.keys(window.__lbLooks || {}).length > 0).catch(() => {});
        await page.waitForTimeout(1800);
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
        const g = page.locator('.pv-grip, .pv-bar').first(); await g.focus(); await page.keyboard.press('End'); await page.evaluate(() => document.activeElement?.blur()); await page.waitForTimeout(900);
        const cv = await page.locator('.pv-canvas').boundingBox(), d = await page.locator('.pv-drag').boundingBox();
        const size = Math.round(Math.min(d.width * 0.62, d.height * 0.42, 190));
        const shot = await page.screenshot({ clip: { x: Math.round(d.x + d.width * 0.5 - size / 2), y: Math.round(d.y + d.height * 0.30), width: size, height: size } });
        crop = shot; look = Object.values(await page.evaluate(() => window.__lbLooks || {}))[0] || null; void cv;
      }
      results.push({ ...r, crop, look });
    } catch (e) { results.push({ ...r, crop: null, look: null, error: e.message.split('\n')[0] }); }
  }
  await ctx.close();
}

const groups = {}; for (const r of todo) { const k = r.line === 'drapery' ? 'drapery' : r.line === 'dream-curtains' ? 'dream-curtains' : r.line; (groups[`${k}|${r.family || ''}`] ||= []).push(r); }
const results = []; const queue = Object.entries(groups).map(([k, list]) => ({ key: k, line: k.split('|')[0], list })); let qi = 0;
await Promise.all(Array.from({ length: 4 }, async () => { while (qi < queue.length) { const q = queue[qi++]; await worker(q.line, q.list, results); console.log('done', q.key, q.list.length); } }));
await browser.close();

mkdirSync(OUT, { recursive: true });
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
for (const t of TYPES) {
  const list = results.filter((r) => r.type === t).sort((a, b) => (a.line + a.name).localeCompare(b.line + b.name)); if (!list.length) continue;
  const cols = 4, W = CELL * 2 + 10, H = CELL + 34, comps = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i], x = (i % cols) * (W + 12), y = Math.floor(i / cols) * (H + 8) + 44;
    const ph = r.thumb ? null : null; void ph;
    const pBuf = await (async () => { const b = await (await fetch(`${SB}/storage/v1/object/public/swatches/${tp[r.id]}`)).arrayBuffer().catch(() => null); return b ? sharp(Buffer.from(b)).resize(CELL, CELL, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer() : null; })();
    const cBuf = r.crop ? await sharp(r.crop).resize(CELL, CELL, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer() : null;
    const src = r.look?.source === 'photo' ? 'Photo' : r.look ? 'Generated' : '?';
    const flag = r.uncertain ? ' | CHECK: type uncertain' : r.error ? ' | CHECK: not drawn' : '';
    if (pBuf) comps.push({ input: pBuf, left: x, top: y });
    if (cBuf) comps.push({ input: cBuf, left: x + CELL + 10, top: y });
    comps.push({ input: Buffer.from(`<svg width="${W}" height="30"><rect width="${W}" height="30" fill="${r.uncertain || r.error ? '#fde8c8' : '#f4f1ea'}"/><text x="4" y="12" font-size="11" font-family="sans-serif" fill="#1d1a14">${esc(`${r.name} (${r.code})`.slice(0, 38))}</text><text x="4" y="25" font-size="11" font-family="sans-serif" fill="${src === 'Photo' ? '#7a5c2e' : '#2f6b3a'}">${esc(`${src} | ${r.line === 'drapery' ? 'roman' : r.line}${r.reviewed ? ' | reviewed' : ''}${flag}`.slice(0, 52))}</text></svg>`), left: x, top: y + CELL + 2 });
  }
  const rows = Math.ceil(list.length / cols), height = rows * (H + 8) + 52, width = cols * (W + 12);
  comps.push({ input: Buffer.from(`<svg width="${width}" height="40"><text x="6" y="26" font-size="20" font-family="sans-serif" font-weight="bold" fill="#1d1a14">${esc(LABEL[t])} (${t}): ${list.length} colors. Left: the supplier photo. Right: the 3D preview fabric (close-up, normal size).</text></svg>`), left: 0, top: 4 });
  await sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).composite(comps).jpeg({ quality: 86 }).toFile(`${OUT}/${t}.jpg`);
  console.log(`${t}.jpg ${width} x ${height}`);
}
writeFileSync(`${OUT}/index.json`, JSON.stringify(results.map(({ crop, ...r }) => r), null, 1));
