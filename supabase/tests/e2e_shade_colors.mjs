// The 3D shade matches its picker tile, for EVERY White, Cream/Ivory and Gray color on all three roller types (solar, screen view, blackout) and on zebra (its solid
// band), plus the darkest and the most colorful colors of each type so nothing else moves. Live catalog, read-only; needs a preview server (BASE_URL, default
// http://localhost:4173). Each color is rendered through the real product page and the lit face of the shade is read from a screenshot:
//   - the face is within color distance 4 of the tile, and its warm/cool tint (Lab b*) within 2 of the tile's;
//   - nothing wavy or beating (moire): the slow structure left after taking out the plain lighting slope is under 6 levels;
//   - the weave shows where the photo has one (Jet Black, Onyx Black, a grey solar, Bark Brown) and a smooth blackout stays smooth; desktop and phone.
import { guard } from './lib/liveGuard.mjs';       // every write is checked: a test may only change what it created (see lib/liveGuard.mjs)
import { probeSession } from './lib/shadeProbe.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const MAX_DE = 4, MAX_DB = 2, MAX_WAVE = 6;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); guard.wrapBrowser(browser);

// ---- which colors: from the live catalog ----
const catalog = async (scope) => (await (await fetch(`${URL_}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${scope}}`)}`, { headers: { apikey: ANON } })).json());
const byType = { solar: [], 'screen-view': [], blackout: [], zebra: [] };
for (const g of await catalog('roller')) for (const s of g.swatches || []) (byType[g.family || s.family] || []).push(s);
for (const g of await catalog('zebra')) for (const s of g.swatches || []) byType.zebra.push(s);
const NEUTRAL = ['White', 'Cream/Ivory', 'Gray'], EXTRA = { 'Charcoal/Black': 8, Brown: 6, Blue: 3, Green: 3, 'Pink/Red': 3, Purple: 3 };
const pickColors = (list) => { const out = list.filter((s) => NEUTRAL.includes(s.color_family)); for (const [fam, n] of Object.entries(EXTRA)) out.push(...list.filter((s) => s.color_family === fam).slice(0, n)); return out; };
const plan = Object.fromEntries(Object.entries(byType).map(([t, l]) => [t, pickColors(l)]));
const total = Object.values(plan).reduce((s, l) => s + l.length, 0), neutral = Object.values(plan).reduce((s, l) => s + l.filter((x) => NEUTRAL.includes(x.color_family)).length, 0);
check(`the live catalog has the colors to test: ${neutral} White / Cream / Gray colors and ${total - neutral} dark and colorful ones, over 4 shade types`, neutral > 90 && Object.values(plan).every((l) => l.length > 15));

const run = async (label, vp, filter) => {
  const bad = [], worst = {}; let n = 0;
  await Promise.all(Object.entries(plan).map(async ([type, list]) => {
    const s = await probeSession(browser, vp); await s.select(type);
    for (const c of list.filter(filter)) {
      try {
        const r = await s.read(c.supplier_code); n++;
        const wrongColor = !r.id || !r.id.replace(/[^A-Za-z0-9]/g, '').includes(c.supplier_code.replace(/[^A-Za-z0-9]/g, ''));
        const dead = r.dE > MAX_DE || r.db > MAX_DB || r.sdWave > MAX_WAVE || wrongColor;
        if (dead) bad.push(`${type} ${c.display_name} (${c.supplier_code}, ${c.color_family}): tile ${r.tile} face ${r.faceHex}, distance ${r.dE.toFixed(1)}, b* ${r.db.toFixed(1)}, wave ${r.sdWave.toFixed(1)}${wrongColor ? ` WRONG COLOR PICKED ${r.id}` : ''}`);
        const w = worst[type] || (worst[type] = { dE: 0, db: 0, wave: 0 }); w.dE = Math.max(w.dE, r.dE); w.db = Math.max(w.db, r.db); w.wave = Math.max(w.wave, r.sdWave);
      } catch (e) { bad.push(`${type} ${c.display_name} (${c.supplier_code}): ${e.message.split('\n')[0]}`); }
    }
    if (s.errors.length) bad.push(`${type}: page errors ${s.errors.join(' | ')}`);
    await s.close();
  }));
  const summary = Object.entries(worst).map(([t, w]) => `${t} worst distance ${w.dE.toFixed(1)}, b* ${w.db.toFixed(1)}, wave ${w.wave.toFixed(1)}`).join('; ');
  check(`${label}: ${n} colors, every shade face is within distance ${MAX_DE} and b* ${MAX_DB} of its tile, with no waviness (wave under ${MAX_WAVE})`, bad.length === 0, bad.length ? `${bad.length} off: ${bad.slice(0, 12).join(' | ')}` : summary);
};
// ---- the weave: strong where the photo has one, flat where it does not (desktop and phone) ----
const WEAVES = [['solar', 'YS180006', 'Jet Black', 'strong'], ['blackout', 'YB180006', 'Onyx Black', 'strong'], ['solar', 'YS180004', 'Flint Gray (a grey solar)', 'strong'], ['screen-view', 'YSS-T12-305', 'Bark Brown (its pattern)', 'strong'],
  ['blackout', 'YB050252', 'Steel Gray (a smooth blackout)', 'smooth'], ['blackout', 'YB010001', 'Fresh White (a smooth blackout)', 'smooth']];
const weave = async (label, vp) => {
  const rows = []; let bad = [];
  const sessions = {}; const get = async (t) => (sessions[t] ||= (async () => { const s = await probeSession(browser, vp); await s.select(t); return s; })());
  for (const [type, code, name, kind] of WEAVES) {
    const s = await get(type), r = await s.read(code); rows.push({ name, kind, ...r });
    if (kind === 'strong' && r.sdHigh < 5) bad.push(`${name}: the weave is hardly visible (fine contrast ${r.sdHigh.toFixed(1)}, needs 5 or more)`);
    if (kind === 'smooth' && r.sdHigh > 4.5) bad.push(`${name}: a smooth fabric shows texture (fine contrast ${r.sdHigh.toFixed(1)}, limit 4.5)`);
    if (r.sdWave > MAX_WAVE) bad.push(`${name}: wavy or beating (${r.sdWave.toFixed(1)})`);
    if (r.dE > MAX_DE || r.db > MAX_DB) bad.push(`${name}: the weave moved the color (distance ${r.dE.toFixed(1)}, b* ${r.db.toFixed(1)})`);
  }
  for (const t of Object.values(sessions)) await (await t).close();
  const strong = rows.filter((r) => r.kind === 'strong').map((r) => r.sdHigh), smooth = rows.filter((r) => r.kind === 'smooth').map((r) => r.sdHigh);
  check(`${label}: strong weaves show clearly (fine contrast ${strong.map((v) => v.toFixed(0)).join(', ')}), smooth blackouts stay smooth (${smooth.map((v) => v.toFixed(1)).join(', ')}), nothing wavy, the average color still matches the tile`, bad.length === 0, bad.join(' | '));
};
try {
  await run('desktop 1280 px', { width: 1280, height: 900, dpr: 2 }, () => true);
  await run('phone 390 px (every 4th color)', { width: 390, height: 844, dpr: 2, mobile: true }, (_c, i) => i % 4 === 0);
  await weave('desktop', { width: 1280, height: 900, dpr: 2 });
  await weave('phone', { width: 390, height: 844, dpr: 2, mobile: true });
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
await browser.close();
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
