// Builds (or rebuilds) the STAGING Supabase project: the same tables, functions and rules as live (the migrations in supabase/migrations, in order),
// plus a copy of the catalog and price tables read from the live project. No customer data is copied: no orders, sent orders, messages, rate limits,
// users, admins or audit history. Tests that write run against this project (see docs/staging-setup.md and scripts/run-tests.mjs).
//
// Needs these environment variables (the staging ones are the settings of the NEW project; the live ones are already set):
//   STAGING_SUPABASE_URL   STAGING_DB_URL (the project's "Session pooler" connection string, with the database password filled in)
//   SUPABASE_URL  SUPABASE_SERVICE_ROLE_KEY   (live: only READ requests are made to it)
//
//   node scripts/staging-setup.mjs            builds / rebuilds staging (asks nothing; refuses to touch the live project)
//   node scripts/staging-setup.mjs --check    only checks the settings and that staging is not the live project
//
// Rebuilding is safe to repeat: the migrations are written to be re-run, and the copied tables are emptied and refilled from live.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const LIVE_URL = env.SUPABASE_URL, LIVE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ST_URL = env.STAGING_SUPABASE_URL, ST_DB = env.STAGING_DB_URL;
const PSQL = env.STAGING_PSQL;           // for the local dry run in the tests only: a command that runs psql against a scratch database
const fail = (m) => { console.error(`\nSTOP: ${m}\n`); process.exit(1); };
const ref = (u) => { try { return new URL(u).hostname.split('.')[0]; } catch { return ''; } };

// ---- safety: staging must be a different project from live -------------------------------------------------------------------------------------------
if (!LIVE_URL || !LIVE_KEY) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the live project, read-only here) are not set.');
if (!PSQL) {
  if (!ST_URL || !ST_DB) fail('STAGING_SUPABASE_URL and STAGING_DB_URL are not set. docs/staging-setup.md says how to get them.');
  if (ref(ST_URL) === ref(LIVE_URL)) fail('STAGING_SUPABASE_URL is the live project. Staging must be a separate project.');
  if (ST_DB.includes(ref(LIVE_URL))) fail('STAGING_DB_URL mentions the live project reference. Staging must be a separate project.');
  if (!ST_DB.includes(ref(ST_URL))) fail('STAGING_DB_URL does not belong to the project in STAGING_SUPABASE_URL (the project reference is missing from it).');
}
console.log(`live (read only): ${ref(LIVE_URL)}   staging: ${PSQL ? '(local dry run)' : ref(ST_URL)}`);
if (process.argv.includes('--check')) { console.log('Settings look right.'); process.exit(0); }

// ---- psql helpers ---------------------------------------------------------------------------------------------------------------------------------------
const runFile = (file) => {
  const args = ['-v', 'ON_ERROR_STOP=1', '-q', '-f', file];
  const r = PSQL ? spawnSync('bash', ['-c', `${PSQL} ${args.map((a) => `'${a}'`).join(' ')}`], { encoding: 'utf8', maxBuffer: 1 << 28 }) : spawnSync('psql', [ST_DB, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) fail(`${file}\n${(r.stderr || '').split('\n').filter((l) => /ERROR|FATAL/.test(l)).slice(0, 4).join('\n') || r.stderr}`);
};
const tmp = mkdtempSync(join(tmpdir(), 'staging-')); if (PSQL) spawnSync('chmod', ['755', tmp]);
const runSql = (name, sql) => { const f = join(tmp, name); writeFileSync(f, sql); runFile(f); };

// ---- the tables copied from live (catalog and prices; nothing a customer made) --------------------------------------------------------------------------
const A = ['product_lines', 'pricing_lines', 'fabrics', 'swatches', 'swatch_links', 'price_grids', 'grid_fabrics', 'price_adders', 'price_flags', 'collection_markups', 'option_groups', 'option_values', 'size_rules'];
const B = [...A, 'hardware_rates', 'drapery_tiers', 'drapery_fabrics'];
async function copyTables(tables, label) {
  console.log(`copying ${tables.length} tables from live (${label}) ...`);
  const parts = [`begin;`];
  for (const t of tables) parts.push(`alter table public.${t} disable trigger user;`);
  parts.push(`truncate ${tables.map((t) => `public.${t}`).join(', ')} restart identity cascade;`);
  for (const t of tables) {
    const rows = []; for (let from = 0; ; from += 1000) {
      const r = await fetch(`${LIVE_URL}/rest/v1/${t}?select=*&order=${t === 'collection_markups' ? 'fabric_id' : 'created_at'}.asc&offset=${from}&limit=1000`, { headers: { apikey: LIVE_KEY, Authorization: `Bearer ${LIVE_KEY}` } });
      if (r.status === 404 || r.status === 400) { // a table or column that does not exist (yet) on live
        const r2 = await fetch(`${LIVE_URL}/rest/v1/${t}?select=*&offset=${from}&limit=1000`, { headers: { apikey: LIVE_KEY, Authorization: `Bearer ${LIVE_KEY}` } });
        if (!r2.ok) { if (from === 0) break; fail(`could not read ${t} from live (${r2.status})`); }
        const j2 = await r2.json(); rows.push(...j2); if (j2.length < 1000) break; continue;
      }
      if (!r.ok) fail(`could not read ${t} from live (${r.status})`);
      const j = await r.json(); rows.push(...j); if (j.length < 1000) break;
    }
    const tag = `$d${Math.random().toString(36).slice(2, 8)}$`;
    if (rows.length) parts.push(`insert into public.${t} select * from json_populate_recordset(null::public.${t}, ${tag}${JSON.stringify(rows)}${tag}::json);`);
    console.log(`  ${t}: ${rows.length}`);
  }
  for (const t of tables) parts.push(`alter table public.${t} enable trigger user;`);
  parts.push('commit;');
  runSql(`copy-${tables.length}.sql`, parts.join('\n'));
}

// ---- the build ------------------------------------------------------------------------------------------------------------------------------------------
const migrations = readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
if (PSQL && env.STAGING_STUBS) { console.log('local dry run: loading the stand-ins for Supabase\'s own schemas'); runFile(env.STAGING_STUBS); }
console.log('prelude: the orders table (created by hand on live before the migrations began)');
runFile(join(ROOT, 'supabase/staging/prelude.sql'));
const upTo = (n) => migrations.filter((f) => Number(f.slice(8, 14)) <= n);
for (const f of upTo(11)) { console.log(`migration ${f}`); runFile(join(ROOT, 'supabase/migrations', f)); }
await copyTables(A, 'catalog, first pass (the later migrations expect the option and price rows to exist)');
for (const f of migrations.filter((f) => !upTo(11).includes(f))) { console.log(`migration ${f}`); runFile(join(ROOT, 'supabase/migrations', f)); }
await copyTables(B, 'final: exactly as live');
console.log('\nStaging is built. Next: node scripts/run-tests.mjs');
