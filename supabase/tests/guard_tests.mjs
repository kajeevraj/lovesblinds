// The write guard (lib/liveGuard.mjs), offline: what it lets through and what it stops. No network is used.
process.env.SUPABASE_URL ||= 'https://example-live.supabase.co';
const { guard, own } = await import('./lib/liveGuard.mjs');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const base = new URL(process.env.SUPABASE_URL).origin;
const j = (m, p, body = '', h = {}) => guard.judge(m, base + p, body, h);
const quiet = (fn) => { const e = console.error; console.error = () => {}; try { return fn(); } finally { console.error = e; } };
const pv = guard.violations.length;

check('reads are always allowed (tables, RPCs, storage listing, other hosts)', j('GET', '/rest/v1/swatches?select=*') === null && j('HEAD', '/rest/v1/x') === null && j('POST', '/rest/v1/rpc/public_catalog', '{}') === null && j('POST', '/storage/v1/object/list/swatches', '{}') === null && guard.judge('PATCH', 'https://example.com/rest/v1/swatches?id=eq.x', '', {}) === null);
check('inserts are allowed, upserts are refused', j('POST', '/rest/v1/swatches', '{}') === null && /upsert/.test(j('POST', '/rest/v1/swatches', '{}', { Prefer: 'resolution=merge-duplicates,return=representation' })));
check('editing or deleting a row nobody here created is refused (a real price, option, color, markup)', /did not create/.test(j('PATCH', '/rest/v1/price_adders?adder_key=eq.motor-cost&line_id=eq.dream-curtains', '{"amount":1}')) && /did not create/.test(j('DELETE', '/rest/v1/swatches?id=eq.drapery%3ASP26030004')) && /did not create/.test(j('PATCH', '/rest/v1/hardware_rates?id=eq.zigbee_hub')));
own('zz-test-row-123', 'zz-user-id-456');
check('after registering what it created, editing that is allowed (also url-encoded)', j('PATCH', '/rest/v1/swatches?id=eq.zz-test-row-123') === null && j('DELETE', '/rest/v1/swatches?id=eq.' + encodeURIComponent('zz-test-row-123')) === null && j('DELETE', '/auth/v1/admin/users/zz-user-id-456') === null);
check('a filter that only looks similar to an owned id is still refused', j('PATCH', '/rest/v1/swatches?id=eq.zz-test-row-12') !== null);
check('deleting a user it did not create is refused', /did not create/.test(j('DELETE', '/auth/v1/admin/users/11111111-2222-3333-4444-555555555555')));
check('an RPC that is not on the read-only list is refused; a write RPC needs something owned', /not on the read-only list/.test(j('POST', '/rest/v1/rpc/drop_everything', '{}')) && /did not create/.test(j('POST', '/rest/v1/rpc/set_swatch_lines', '{"p_swatch":"roller:solar:sag"}')) && j('POST', '/rest/v1/rpc/set_swatch_lines', '{"p_swatch":"zz-test-row-123"}') === null);
check('refusal probes: internal price functions are allowed as probes, price_import_apply only with an empty payload', j('POST', '/rest/v1/rpc/price_for_swatch', '{}') === null && j('POST', '/rest/v1/rpc/price_import_apply', '{"p_line":"roller","p_grids":[],"p_remove_keys":null,"p_adders":null,"p_meta":null}') === null && /would change prices/.test(j('POST', '/rest/v1/rpc/price_import_apply', '{"p_line":"roller","p_grids":[{"grid_key":"x"}]}')));
check('files: uploading is fine, deleting only what was uploaded; never a whole bucket', j('POST', '/storage/v1/object/swatches/full/zz-test-row-123.jpg') === null && j('DELETE', '/storage/v1/object/swatches', '{"prefixes":["full/zz-test-row-123.jpg"]}') === null && /did not upload/.test(j('DELETE', '/storage/v1/object/swatches', '{"prefixes":["full/roller/YS180006.jpg"]}')) && /did not upload/.test(j('DELETE', '/storage/v1/object/swatches')));
check('sign-in and sign-out are not data changes', j('POST', '/auth/v1/token?grant_type=password', '{}') === null && j('POST', '/auth/v1/logout') === null);
check('a refusal is reported, makes the run fail and the request is never sent (Node fetch wrapper)', await (async () => {
  const sent = []; const orig = globalThis.fetch;
  // the wrapper was installed over the real fetch at import; calling it with a refused write must throw before any network use
  let threw = null; try { quiet(() => {}); const e = console.error; console.error = () => {}; try { await globalThis.fetch(base + '/rest/v1/pricing_lines?id=eq.roller', { method: 'PATCH', body: '{"markup":0.6}' }); } finally { console.error = e; } } catch (err) { threw = err; }
  void sent; void orig;
  return threw && /LIVE GUARD/.test(threw.message) && guard.violations.length === pv + 1 && process.exitCode === 1;
})());
process.exitCode = 0;           // that refusal was the test, not a failure
guard.violations.length = 0;
check('shared-row edits are skipped against the live project and run against staging', await (async () => {
  let ran = false; const log = console.log; console.log = () => {}; try { await guard.sharedRows('x', async () => { ran = true; }); } finally { console.log = log; }
  return guard.isLive ? ran === false : ran === true;
})());
// ---- where a writing test runs (resolved when the guard is imported, so each case is a fresh process) ----
import { spawnSync } from 'node:child_process';
const run = (env, file = 'live_tests.mjs') => spawnSync('node', [new URL(`./${file}`, import.meta.url).pathname], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8', timeout: 60000 });
const LIVE = { SUPABASE_URL: 'https://livelive.supabase.co', VITE_SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' };
const ST = { STAGING_SUPABASE_URL: 'https://stagestage.supabase.co', STAGING_SUPABASE_ANON_KEY: 'sa', STAGING_SUPABASE_SERVICE_ROLE_KEY: 'ss' };
let r = run(LIVE);
check('a writing test run directly stops (exit 3, with a message) when there is no staging project and no explicit own-rows override', r.status === 3 && /runs on the staging project, not on live/.test(r.stderr), `${r.status} ${r.stderr.slice(0, 80)}`);
r = run({ ...LIVE, ...ST, LB_TARGET: 'staging', SUPABASE_URL: 'https://livelive.supabase.co', LB_LIVE_URL: 'https://livelive.supabase.co' });
check('a run meant for staging whose SUPABASE_URL is the live project stops', r.status === 3 && /meant for the staging project but SUPABASE_URL is the live project/.test(r.stderr), `${r.status} ${r.stderr.slice(0, 80)}`);
r = run({ ...LIVE, ...ST });
check('a writing test run directly with the staging settings goes to staging by itself', /running it on the STAGING project/.test(r.stdout), r.stdout.slice(0, 120));
check('...and never sends anything to the live project (its host does not appear in any request the run made)', !/livelive/.test(r.stdout + r.stderr), (r.stdout + r.stderr).slice(0, 200));
r = run({ ...LIVE, LB_ALLOW_LIVE_OWN_ROWS: '1' });
check('with LB_ALLOW_LIVE_OWN_ROWS=1 it runs on live (still under the write guard)', r.status !== 3 && !/runs on the staging project/.test(r.stderr), `${r.status}`);
r = run(LIVE, 'e2e_cart.mjs');
check('a read-only test is not affected (no staging needed)', !/runs on the staging project/.test(r.stderr));
check('a write to a different Supabase project than the one the test targets is refused (reads are fine)', /different Supabase project/.test(j2('POST', 'https://other.supabase.co/rest/v1/swatches')) && j2('GET', 'https://other.supabase.co/rest/v1/swatches') === null);
function j2(m, u) { return guard.judge(m, u, '', {}) || ''; }
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
