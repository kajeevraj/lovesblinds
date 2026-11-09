// The color fixes approved after the phase 1 review (run AFTER migration 24 is applied; live-visible as soon as they are applied):
//   * Ash Gray, Granite Gray, Shadow Gray, White Slate (roller, screen view): color family White -> Gray.
//   * Salt White (drapery SP26027008, a white open weave photographed on black): stays White; preview color a soft white, Pattern texture, weave "voile"
//     (a sheer open weave, see-through between its threads) so it reads light and open, not dark.
//   * Bark Brown, Cocoa Chocolate (roller) and Dark Chocolate, Bittersweet Chocolate (zebra): a preview color that reads brown, not black.
//
//   node scripts/apply-color-fixes.mjs                          dry run (default): shows before and after for each color, writes nothing
//   node scripts/apply-color-fixes.mjs --apply                  does it and writes a manifest to backfill-logs/
//   node scripts/apply-color-fixes.mjs --undo <manifest.json>   puts back exactly what it changed (a value the owner changed since is left alone)
// Each color is found by supplier code + line and checked by name; a color that is not exactly as expected stops the run before anything is written.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXES = [
  { name: 'Ash Gray', code: 'WSS660105', line: 'roller', set: { color_family: 'Gray' }, expect: { color_family: 'White' } },
  { name: 'Granite Gray', code: 'WSS360105', line: 'roller', set: { color_family: 'Gray' }, expect: { color_family: 'White' } },
  { name: 'Shadow Gray', code: 'YSS-A12-103', line: 'roller', set: { color_family: 'Gray' }, expect: { color_family: 'White' } },
  { name: 'White Slate', code: 'WSS481277', line: 'roller', set: { color_family: 'Gray' }, expect: { color_family: 'White' } },
  { name: 'Salt White', code: 'SP26027008', line: 'drapery', set: { preview_color: '#efede9', texture_mode: 'pattern', weave: 'voile' }, expect: { color_family: 'White' } },
  { name: 'Bark Brown', code: 'YSS-T12-305', line: 'roller', set: { preview_color: '#4a3829' }, expect: { color_family: 'Brown' } },
  { name: 'Cocoa Chocolate', code: 'XSS000539', line: 'roller', set: { preview_color: '#4a3223' }, expect: { color_family: 'Brown' } },
  { name: 'Dark Chocolate', code: 'YZB2008', line: 'zebra', set: { preview_color: '#4b3626' }, expect: { color_family: 'Brown' } },
  { name: 'Bittersweet Chocolate', code: 'YZB3007', line: 'zebra', set: { preview_color: '#523927' }, expect: { color_family: 'Brown' } },
];

const BASE = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed.'); process.exit(1); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), LOG_DIR = process.env.BACKFILL_LOG_DIR || join(ROOT, 'backfill-logs');
const args = process.argv.slice(2), APPLY = args.includes('--apply'), UNDO = args.includes('--undo') ? args[args.indexOf('--undo') + 1] : null;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }, json = { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const FIELDS = ['color_family', 'preview_color', 'texture_mode', 'weave', 'display_name', 'supplier_code', 'product_line'];
const get = async (q) => { const r = await fetch(`${BASE}/rest/v1/swatches?${q}`, { headers: H }); if (!r.ok) { const t = await r.text(); throw new Error(/does not exist/.test(t) ? 'a column from migration 24 does not exist yet: apply migration 24 first' : `${r.status} ${t}`); } return r.json(); };
const patch = async (id, body, extra = '') => { const r = await fetch(`${BASE}/rest/v1/swatches?id=eq.${encodeURIComponent(id)}${extra}`, { method: 'PATCH', headers: json, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); };

if (UNDO) {
  const m = JSON.parse(readFileSync(UNDO, 'utf8'));
  if (m.kind !== 'apply-color-fixes' || m.base !== BASE) { console.error('That manifest is not from this script or is for another project.'); process.exit(1); }
  let restored = 0, kept = 0;
  for (const row of m.rows) {
    const [cur] = await get(`select=${FIELDS.join(',')}&id=eq.${encodeURIComponent(row.id)}`);
    if (!cur) continue;
    const back = {};
    for (const f of Object.keys(row.after)) { if (cur[f] === row.after[f]) back[f] = row.before[f]; else kept++; }      // only what this run wrote, and not what the owner changed since
    if (Object.keys(back).length) { await patch(row.id, back); restored++; }
  }
  console.log(`undone: ${restored} colors put back, ${kept} values left as the owner changed them`);
  process.exit(0);
}

const plan = [];
try {
  for (const fx of FIXES) {
    const rows = await get(`select=id,${FIELDS.join(',')}&supplier_code=eq.${encodeURIComponent(fx.code)}&product_line=eq.${fx.line}`);
    if (rows.length !== 1) throw new Error(`${fx.name} (${fx.code}, ${fx.line}): expected exactly one color, found ${rows.length}`);
    const cur = rows[0];
    if (cur.display_name !== fx.name) throw new Error(`${fx.code} is "${cur.display_name}", not "${fx.name}"`);
    for (const [f, v] of Object.entries(fx.expect)) if (cur[f] !== v && !Object.keys(fx.set).includes(f)) throw new Error(`${fx.name}: ${f} is "${cur[f]}", expected "${v}"`);
    for (const f of Object.keys(fx.set)) if (!(f in cur)) throw new Error(`${fx.name}: the column ${f} does not exist yet (apply migration 24 first)`);
    plan.push({ fx, cur });
  }
} catch (e) { console.error(`STOP: ${e.message}`); process.exit(1); }

const manifest = { kind: 'apply-color-fixes', base: BASE, at: new Date().toISOString(), rows: [] };
for (const { fx, cur } of plan) {
  const before = {}, after = {}; for (const [f, v] of Object.entries(fx.set)) { before[f] = cur[f]; after[f] = v; }
  const changes = Object.keys(after).filter((f) => before[f] !== after[f]);
  console.log(`${fx.name.padEnd(22)} ${fx.line.padEnd(8)} ${changes.length ? changes.map((f) => `${f}: ${before[f] ?? '(empty)'} -> ${after[f]}`).join(', ') : 'already as wanted'}`);
  if (APPLY && changes.length) {
    const body = Object.fromEntries(changes.map((f) => [f, after[f]]));
    await patch(cur.id, body, fx.expect.color_family && 'color_family' in fx.set ? `&color_family=eq.${encodeURIComponent(fx.expect.color_family)}` : '');      // a family change only if the family is still the expected one
    manifest.rows.push({ id: cur.id, name: fx.name, before: Object.fromEntries(changes.map((f) => [f, before[f]])), after: body });
  }
}
if (APPLY) {
  mkdirSync(LOG_DIR, { recursive: true });
  const file = join(LOG_DIR, `color-fixes-${manifest.at.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(manifest, null, 1));
  console.log(`applied to ${manifest.rows.length} colors.\nmanifest: ${file}\nto undo:  node scripts/apply-color-fixes.mjs --undo ${file}`);
} else console.log('dry run, nothing written (add --apply)');
