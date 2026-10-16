// Imports supplier cost workbooks into the pricing tables (grids, collections each grid covers, adders).
//
//   node scripts/import-pricing.mjs                       dry run for every workbook in private/supplier-sheets/: parse, map, report
//   node scripts/import-pricing.mjs --line roller         one line
//   node scripts/import-pricing.mjs --apply               write to the Supabase project (service role), in chunks
//   node scripts/import-pricing.mjs --json out.json       also write the payload that would be sent (for local tests)
//
// The workbooks hold supplier COSTS. They live in private/ (git-ignored) and must never be committed. The "--" tab of the
// Dream Curtains workbook (customer names and orders) is never read.
// Uses the same parser as the admin re-import (src/lib/pricing/parseSupplier.js).
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import XLSX from 'xlsx';
import { parseSupplierWorkbook, detectLine, LINE_SHEETS } from '../src/lib/pricing/parseSupplier.js';
import { mapToFabrics } from '../src/lib/pricing/collections.js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f); const arg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DIR = arg('--dir') || 'private/supplier-sheets';
const APPLY = has('--apply'); const ONLY = arg('--line'); const JSON_OUT = arg('--json');
const FABRICS_FILE = arg('--fabrics'); const SQL_DIR = arg('--sql-dir');   // local tests: fabrics from a file, output as SQL instead of REST
for (const f of ['.env.seed.local', '.env.local']) if (existsSync(f)) for (const l of readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Decisions that are not in the sheets (see docs/pricing-stage1-plan.md)
const OVERRIDES = {};   // none needed: "Gare" is renamed to "Gaea" in the catalog, so the sheet's Gaea/sundance (BLACKOUT) grid maps by name

function readSheets(file) {
  const wb = XLSX.read(readFileSync(file), { type: 'buffer', cellDates: false });
  const sheets = {};
  for (const name of wb.SheetNames) {
    if (name.trim() === '--') continue;                                   // customer data: do not even load it
    const ws = wb.Sheets[name]; const ref = XLSX.utils.decode_range(ws['!ref']);
    ref.s = { r: 0, c: 0 }; ref.e.c = Math.min(ref.e.c, 400);
    sheets[name] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: ref });
  }
  return { sheets, names: wb.SheetNames };
}

async function fetchFabrics() {
  if (FABRICS_FILE) return JSON.parse(readFileSync(FABRICS_FILE, 'utf8'));
  const r = await fetch(`${URL_}/rest/v1/fabrics?select=id,product_line,family,collection_name,width&limit=1000`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  if (!r.ok) throw new Error(`could not read fabrics: HTTP ${r.status}`);
  return r.json();
}

const rpc = async (body) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/price_import_apply`, { method: 'POST', headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`price_import_apply failed: HTTP ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
};

const fabrics = await fetchFabrics();
const files = Object.entries(LINE_SHEETS).map(([line, { file }]) => [line, `${DIR}/${file}.xlsx`]).filter(([line, f]) => (!ONLY || ONLY === line) && existsSync(f));
if (!files.length) { console.error(`no workbooks found in ${DIR}`); process.exit(1); }
const payloads = {};
for (const [line, file] of files) {
  const { sheets, names } = readSheets(file);
  const detected = detectLine(names);
  if (detected !== line) console.log(`WARNING ${file}: sheet names suggest "${detected}", importing as "${line}"`);
  const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
  const parsed = parseSupplierWorkbook(line, sheets, `${line}.xlsx`);
  const { grids, unmapped, fabricsWithoutGrid } = mapToFabrics(parsed, fabrics, { overrides: OVERRIDES });
  const cells = grids.reduce((s, g) => s + g.cost.length, 0);
  const anomalyCount = grids.reduce((s, g) => s + g.anomalies.filter((a) => a.type === 'decreases').reduce((n, a) => n + a.count, 0), 0);
  console.log(`\n=== ${line}: ${grids.length} grids, ${cells} cost cells, ${parsed.adders.length} adders, ${anomalyCount} cent-level decreases`);
  console.log('    systems:', [...new Set(grids.map((g) => g.systems.join('+') + (g.special ? ' (special)' : '')))].join(', '));
  console.log('    collections linked:', new Set(grids.flatMap((g) => g.fabrics.map((f) => f.fabric_id))).size);
  if (unmapped.length) console.log('    NOT MAPPED (sheet name has no fabric):', unmapped.map((u) => `${u.name}${u.family ? ` (${u.family})` : ''}`).join(', '));
  if (fabricsWithoutGrid.length) console.log('    OUR FABRICS WITH NO GRID:', fabricsWithoutGrid.map((f) => f.id).join(', '));
  for (const a of parsed.adders) console.log(`    adder: ${a.adder_key} ${a.kind} ${a.amount}${a.unit === 'per_sqft' ? '/sq ft' : ''} when ${JSON.stringify(a.applies_when)}`);
  for (const n of parsed.notes) console.log('    note:', n.slice(0, 200));
  payloads[line] = { line, grids, adders: parsed.adders, meta: { file_name: `${line}.xlsx`, sha256: sha, summary: { grids: grids.length, cells, adders: parsed.adders.length, unmapped: unmapped.map((u) => u.name), notes: parsed.notes } } };
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(payloads));
if (SQL_DIR) {
  for (const p of Object.values(payloads)) {
    const lit = (o) => `$j$${JSON.stringify(o)}$j$::jsonb`;
    writeFileSync(`${SQL_DIR}/import_${p.line}.sql`, `select set_config('request.jwt.claims','{"role":"service_role"}',false);\nselect public.price_import_apply('${p.line}', ${lit(p.grids)}, null, ${lit(p.adders)}, ${lit(p.meta)});\n`);
  }
  console.log('wrote SQL files to', SQL_DIR);
}

if (APPLY) {
  if (!URL_ || !SVC) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed for --apply'); process.exit(1); }
  for (const p of Object.values(payloads)) {
    let batch = [], size = 0, first = true, total = { grids_added: 0, grids_updated: 0, collections_linked: 0 };
    const flush = async (last) => {
      const r = await rpc({ p_line: p.line, p_grids: batch, p_remove_keys: last ? [] : null, p_adders: last ? p.adders : null, p_meta: last ? p.meta : null });
      total.grids_added += r.grids_added; total.grids_updated += r.grids_updated; total.collections_linked += r.collections_linked; batch = []; size = 0; first = false;
    };
    for (const g of p.grids) { const s = JSON.stringify(g).length; if (size + s > 1_500_000 && batch.length) await flush(false); batch.push(g); size += s; }
    await flush(true);
    console.log(`applied ${p.line}:`, JSON.stringify(total));
  }
} else console.log('\nDRY RUN: nothing was written. Add --apply to write to Supabase.');
