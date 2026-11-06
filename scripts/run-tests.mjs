// Runs the test suites against the right project.
//
//   offline   no database at all (maths, copy, the write guard itself)
//   readOnly  read the LIVE catalog and prices, never write (browser checks of the site, price checks, the catalog function)
//   writes    create their own rows, edit them and delete them again: these run on the STAGING project, never on live
//
//   node scripts/run-tests.mjs                 everything: offline + read-only on live, writers on staging
//   node scripts/run-tests.mjs --skip-writes   offline and read-only only (when staging is not set up yet)
//   node scripts/run-tests.mjs --only live_tests,e2e_cart
//   node scripts/run-tests.mjs --live-own-rows run the writers on LIVE instead, under the write guard (own rows only; edits of shared rows are skipped).
//                                              Use sparingly: a leftover row on live is possible if a run is cut off.
//   node scripts/run-tests.mjs --list
//
// Staging is configured with STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY and STAGING_SUPABASE_SERVICE_ROLE_KEY (docs/staging-setup.md).
// Browser tests need a site build that points at the project they test; this script builds and serves one for live (port 4173) and one for staging (4175).
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(join(ROOT, 'supabase/tests/targets.json'), 'utf8'));
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7) || (args.includes('--only') ? args[args.indexOf('--only') + 1] : '');
const onlySet = only ? new Set(only.split(',')) : null;
const env = process.env;

if (has('--list')) { for (const k of ['offline', 'readOnly', 'writes']) console.log(`${k}: ${T[k].join(' ')}`); process.exit(0); }

const STAGING = env.STAGING_SUPABASE_URL && env.STAGING_SUPABASE_ANON_KEY && env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const ref = (u) => { try { return new URL(u).hostname.split('.')[0]; } catch { return ''; } };
if (STAGING && ref(env.STAGING_SUPABASE_URL) === ref(env.SUPABASE_URL)) { console.error('STOP: STAGING_SUPABASE_URL is the live project.'); process.exit(1); }

const LIVE_PORT = 4173, ST_PORT = 4175;
const servers = [];
const up = async (port) => { try { return (await fetch(`http://localhost:${port}/`)).ok; } catch { return false; } };
async function serve(name, port, buildEnv) {
  if (await up(port)) return;
  const out = `dist-${name}`;
  console.log(`building the site for ${name} ...`);
  const b = spawnSync('npx', ['vite', 'build', '--outDir', out], { cwd: ROOT, env: { ...env, ...buildEnv }, encoding: 'utf8' });
  if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
  servers.push(spawn('npx', ['vite', 'preview', '--outDir', out, '--port', String(port), '--strictPort'], { cwd: ROOT, env: { ...env, ...buildEnv }, stdio: 'ignore' }));
  for (let i = 0; i < 40 && !(await up(port)); i++) await new Promise((r) => setTimeout(r, 500));
}
const liveEnv = {};
const stagingEnv = STAGING ? { SUPABASE_URL: env.STAGING_SUPABASE_URL, VITE_SUPABASE_URL: env.STAGING_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: env.STAGING_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: env.STAGING_SUPABASE_SERVICE_ROLE_KEY, LB_TARGET: 'staging', LB_LIVE_URL: env.SUPABASE_URL, BASE_URL: `http://localhost:${ST_PORT}` } : null;

const results = [];
const EXPECTED = T.expectedFailures || {};
function run(name, where) {
  mkdirSync(join(ROOT, '.test-logs'), { recursive: true });
  const e = { ...env, ...(where === 'staging' ? stagingEnv : { LB_TARGET: 'live', BASE_URL: env.BASE_URL || `http://localhost:${LIVE_PORT}` }), LB_RUNNER: '1', LB_GUARD_OUT: join(ROOT, '.test-logs', `${name}.guard.json`) };
  if (name === 'e2e_google') e.BASE_URL = 'http://localhost:4174';
  if (where === 'live-own-rows') e.LB_ALLOW_LIVE_OWN_ROWS = '1';
  const t0 = Date.now();
  const r = spawnSync('node', [join(ROOT, 'supabase/tests', `${name}.mjs`)], { cwd: ROOT, env: e, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 40 * 60 * 1000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const last = out.trim().split('\n').filter((l) => /passed|PASS: |all passed|Migration .* not applied/.test(l)).pop() || out.trim().split('\n').pop() || '';
  const failed = (out.match(/FAILED: (.*)$/m) || [])[1];
  const failedNames = failed ? failed.split('; ').filter((n) => n !== 'script ran to completion' || true) : [];
  const unexpected = failedNames.filter((n) => !(EXPECTED[name] || []).includes(n));
  const guard = /LIVE GUARD/.test(out);
  let wrote = 0; try { wrote = JSON.parse(readFileSync(join(ROOT, '.test-logs', `${name}.guard.json`), 'utf8')).writes || 0; } catch { /* the test never loaded the guard (offline) */ }
  const readOnlyWrote = (where === 'offline' || where === 'live (reads)') && wrote > 0;
  const ok = !readOnlyWrote && (r.status === 0 || (failedNames.length && !unexpected.length && !guard && !/TEST ERROR/.test(out)));
  results.push({ name, where, ok, status: r.status, last: last.trim().slice(0, 160), unexpected, expected: failedNames.length - unexpected.length, secs: Math.round((Date.now() - t0) / 1000), guard });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} ${where.padEnd(14)} ${readOnlyWrote ? `A READ-ONLY TEST WROTE (${wrote} write(s)): move it to "writes" in targets.json or fix it. ` : ''}${last.trim().slice(0, 110)}${failedNames.length && ok ? `  (${failedNames.length} expected failure(s): ${failedNames.join(', ')})` : ''}`);
  if (!ok) writeLog(name, out);
}
import { writeFileSync } from 'node:fs';
function writeLog(name, out) { try { writeFileSync(join(ROOT, '.test-logs', `${name}.log`), out); } catch { /* ignore */ } }

const pick = (list) => list.filter((n) => !onlySet || onlySet.has(n));
const offline = pick(T.offline), readOnly = pick(T.readOnly), writes = pick(T.writes);

try {
  for (const n of offline) run(n, 'offline');
  if (readOnly.length) {
    await serve('live', LIVE_PORT, liveEnv);
    if (readOnly.includes('e2e_google') && !(await up(4174))) await serve('gis', 4174, { VITE_GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com' });
    for (const n of readOnly) run(n, 'live (reads)');
  }
  if (writes.length) {
    if (has('--live-own-rows')) {
      console.log('\nRunning the writing tests on LIVE under the write guard (own rows only; edits of existing rows are skipped).');
      await serve('live', LIVE_PORT, liveEnv);
      for (const n of writes) run(n, 'live-own-rows');
    } else if (has('--skip-writes')) {
      console.log(`\nSkipped on purpose (--skip-writes): ${writes.join(', ')}`);
    } else if (!STAGING) {
      console.log(`\nNOT RUN: ${writes.length} writing test(s) need the staging project, and STAGING_SUPABASE_URL / STAGING_SUPABASE_ANON_KEY / STAGING_SUPABASE_SERVICE_ROLE_KEY are not set.\nSee docs/staging-setup.md. Skipped: ${writes.join(', ')}`);
      results.push({ name: 'writing tests', where: 'staging', ok: false, last: 'not run: staging is not set up', unexpected: [] });
    } else {
      await serve('staging', ST_PORT, stagingEnv);
      for (const n of writes) run(n, 'staging');
    }
  }
} finally { for (const s of servers) { try { s.kill(); } catch { /* ignore */ } } }

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} suites passed${bad.length ? ` | NOT OK: ${bad.map((b) => b.name).join(', ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
void existsSync;
