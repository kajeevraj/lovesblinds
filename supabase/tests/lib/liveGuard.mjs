// The write guard every test that talks to Supabase imports first:   import { guard } from './lib/liveGuard.mjs';
//
// The rule: a test may only change rows (and files, and users) that IT created in this run, and must delete them again.
// It must never edit, toggle or delete an existing row. The guard enforces that for every request a test makes, from Node (it wraps fetch)
// and from a browser page (guard.browser(context) puts a check in front of every write the page sends).
//
//  * Reads (GET / HEAD, and the read-only RPCs) are always fine.
//  * An insert (POST to a table, a user, a file) is fine; the id / key / path it returns is remembered as "owned".
//  * PATCH / DELETE of a row, user or file is only fine when the request names something owned (id=eq.<owned id>, a tag the test registered
//    with guard.own(tag), ...). Anything else stops the test with "LIVE GUARD: ..." (the request is not sent) and the run exits with an error.
//  * An unknown RPC is refused (it could write); a known write RPC needs an owned argument.
//  * Upserts (Prefer: resolution=merge-duplicates) are refused.
//  * A test that has to edit a SHARED row (a price, an option, a markup, a real color) wraps that part in guard.sharedRows('why', async () => {...}):
//    against the live project the part is skipped (with a SKIP line); against the staging project it runs.
//
// Which project a test talks to: LB_TARGET=live (the default; the SUPABASE_* variables) or LB_TARGET=staging (see scripts/run-tests.mjs, which maps
// STAGING_SUPABASE_* onto SUPABASE_* for the child process and sets LB_TARGET). Against the live project the rules above are never relaxed.

import { writeFileSync } from 'node:fs';

const TARGET = (process.env.LB_TARGET || 'live').toLowerCase();
const URL_ = process.env.SUPABASE_URL || '';
let HOST = ''; try { HOST = new URL(URL_).host; } catch { /* no Supabase configured: nothing to guard */ }

// RPCs that only read (prices, catalog, checks)
const READ_RPCS = new Set([
  'public_catalog', 'public_options', 'estimate_price', 'estimate_price_for_swatch', 'estimate_price_debug', 'estimate_price_debug_for_swatch',
  'hardware_estimate', 'hardware_parts', 'hardware_breakdown', 'drapery_estimate', 'drapery_parts', 'drapery_breakdown', 'zigbee_hub_price',
  'is_admin', 'swatch_display_names', 'swatch_order_count', 'size_limits',
]);
// Internal price functions that tests call as an anonymous or non-admin user to check they are REFUSED. They only read, and price_import_apply is
// allowed only with a payload that changes nothing (empty grids, nothing to remove, no adders, no meta), so a hole in the database's permissions
// could not make the probe change a price.
const PROBE_RPCS = new Set(['price_for_swatch', 'swatch_placement', 'price_breakdown', 'price_single', 'roll_numbers']);
const emptyImport = (body) => { try { const j = JSON.parse(body || '{}'); const e = (v) => v == null || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length); return e(j.p_grids) && e(j.p_remove_keys) && e(j.p_adders) && e(j.p_meta); } catch { return false; } };
// RPCs that write: allowed only when the body names something this run owns
const WRITE_RPCS = new Set(['set_swatch_lines', 'rate_limit_hit']);

let relaxed = 0;                  // > 0 inside guard.sharedRows
const writes = [];                // every write that was allowed (so a run can say whether the test writes at all)
const owned = new Set();          // ids, keys, tags, user ids, file paths this run created (or registered)
const violations = [];

const isHex = (s) => typeof s === 'string' && s.length >= 4;
export const own = (...tokens) => { for (const t of tokens.flat()) if (isHex(t)) owned.add(String(t)); };

const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const mentionsOwned = (text) => { const d = dec(text); for (const t of owned) if (d.includes(t)) return true; return false; };

// what a created row tells us about itself
function learn(json) {
  const rows = Array.isArray(json) ? json : json && typeof json === 'object' ? [json] : [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    for (const f of ['id', 'key']) if (isHex(r[f])) owned.add(String(r[f]));
    if (isHex(r.email) && /^zz|example\.com$/i.test(r.email)) owned.add(r.email);       // a test user or admin it just made
  }
}

const report = (msg) => {
  const m = `LIVE GUARD: ${msg}`;
  violations.push(m);
  process.exitCode = 1;
  console.error(`\n${m}\n`);
  return new Error(m);
};

// ---- the policy: returns null when allowed, or the reason it is refused ----------------------------------------------------------------------------
function judge(method, urlStr, bodyText, headers = {}) {
  if (relaxed) return null;                                          // inside guard.sharedRows (staging only)
  let u; try { u = new URL(urlStr); } catch { return null; }
  if (u.host !== HOST) return null;                                  // not Supabase (the site's own /api, Google, ...)
  method = String(method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;
  const path = u.pathname, q = `${u.pathname}${u.search}`;
  const prefer = String(headers.Prefer || headers.prefer || '');
  const body = bodyText || '';

  if (path.startsWith('/rest/v1/rpc/')) {
    const fn = path.slice('/rest/v1/rpc/'.length);
    if (READ_RPCS.has(fn) || PROBE_RPCS.has(fn)) return null;
    if (fn === 'price_import_apply') return emptyImport(body) ? null : 'price_import_apply with a payload that would change prices';
    if (WRITE_RPCS.has(fn)) return mentionsOwned(body) ? null : `the RPC ${fn} is called with something this test did not create (${body.slice(0, 80)})`;
    return `the RPC ${fn} is not on the read-only list and could write`;
  }
  if (path.startsWith('/rest/v1/')) {
    const table = path.slice('/rest/v1/'.length);
    if (method === 'POST') return /resolution=(merge|ignore)-duplicates/.test(prefer) ? `an upsert into ${table} could change an existing row` : null;
    if (method === 'PATCH' || method === 'DELETE' || method === 'PUT') {
      return mentionsOwned(u.search) ? null : `${method} ${table}${dec(u.search).slice(0, 120)} changes rows this test did not create`;
    }
    return null;
  }
  if (path.startsWith('/auth/v1/admin/users')) {
    if (method === 'POST' && path === '/auth/v1/admin/users') return null;       // a new test user
    return mentionsOwned(path) ? null : `${method} ${path} changes a user this test did not create`;
  }
  if (path.startsWith('/auth/v1/')) return null;                                  // sign-in, sign-out, token refresh: no data changes
  if (path.startsWith('/storage/v1/object/list/') || path.startsWith('/storage/v1/object/sign/') || path.startsWith('/storage/v1/object/info/')) return null;
  if (path.startsWith('/storage/v1/object/')) {
    if (method === 'POST' || method === 'PUT') {
      const p = dec(path.replace('/storage/v1/object/', ''));
      return mentionsOwned(p) ? null : (headers['x-upsert'] === 'true' ? `an upsert of the file ${p} could replace an existing file` : null);
    }
    if (method === 'DELETE') {
      let targets = [dec(path.replace('/storage/v1/object/', ''))];         // the path form: bucket/file
      try { const j = JSON.parse(body); if (Array.isArray(j.prefixes)) targets = j.prefixes.map((p) => `${targets[0]}/${p}`); } catch { /* the path form */ }
      const bad = targets.filter((t) => !t.slice(t.indexOf('/') + 1) || !t.includes('/') || !mentionsOwned(t));          // a whole bucket, or a file this test did not upload
      return bad.length ? `deleting files this test did not upload (${bad.slice(0, 2).join(', ')})` : null;
    }
  }
  return `${method} ${q.slice(0, 120)} is a write the guard does not know`;
}

const note = (method, urlStr) => { try { const u = new URL(urlStr); const m = String(method).toUpperCase(); if (u.host === HOST && !/^(GET|HEAD|OPTIONS)$/.test(m) && !/^\/auth\/v1\/(token|logout|user|verify|recover|otp)/.test(u.pathname) && !u.pathname.startsWith('/storage/v1/object/list/') && !/\/rpc\/(public_|estimate_|hardware_|drapery_|zigbee_|is_admin|swatch_display_names|size_limits)/.test(u.pathname)) writes.push(`${m} ${u.pathname}`); } catch { /* ignore */ } };

// ---- Node: wrap fetch -----------------------------------------------------------------------------------------------------------------------------
let installed = false;
function installFetch() {
  if (installed || !HOST) return; installed = true;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url || String(input);
    const method = init.method || (typeof input === 'object' && input.method) || 'GET';
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k, String(v)]));
    const body = typeof init.body === 'string' ? init.body : '';
    const why = judge(method, url, body, headers);
    if (why) throw report(`${method} ${new URL(url).pathname} stopped: ${why}`);
    note(method, url);
    const res = await real(input, init);
    try {
      const u = new URL(url);
      if (res.ok && u.host === HOST && String(method).toUpperCase() === 'POST' && (u.pathname.startsWith('/rest/v1/') && !u.pathname.startsWith('/rest/v1/rpc/') || u.pathname === '/auth/v1/admin/users')) {
        learn(await res.clone().json().catch(() => null));
      }
      if (res.ok && u.host === HOST && /^(POST|PUT)$/i.test(String(method)) && u.pathname.startsWith('/storage/v1/object/') && !/\/list\//.test(u.pathname)) own(dec(u.pathname.replace('/storage/v1/object/', '')));
    } catch { /* learning is best effort */ }
    return res;
  };
}

// ---- Browser: a check in front of every write the page sends -------------------------------------------------------------------------------------------
async function browser(target) {
  if (!HOST) return;
  await target.route((u) => u.host === HOST, async (route) => {
    const r = route.request();
    const why = judge(r.method(), r.url(), r.postData() || '', r.headers());
    if (why) { report(`the page's ${r.method()} ${new URL(r.url()).pathname} was blocked: ${why}`); await route.abort('failed'); return; }
    note(r.method(), r.url());
    await route.fallback();
  });
  const ctx = typeof target.context === 'function' ? target.context() : target;
  ctx.on('response', async (res) => {
    try {
      const rq = res.request(), u = new URL(res.url());
      if (u.host !== HOST || rq.method() !== 'POST' || !res.ok()) return;
      if (u.pathname.startsWith('/rest/v1/') && !u.pathname.startsWith('/rest/v1/rpc/')) learn(await res.json().catch(() => null));
      if (/^\/storage\/v1\/object\//.test(u.pathname) && !/\/list\//.test(u.pathname)) own(dec(u.pathname.replace('/storage/v1/object/', '')));
    } catch { /* ignore */ }
  });
}

// Puts the check on every context / page a Playwright browser opens afterwards:   guard.wrapBrowser(browser)
function wrapBrowser(b) {
  const nc = b.newContext.bind(b), np = b.newPage.bind(b);
  b.newContext = async (...a) => { const c = await nc(...a); await browser(c); return c; };
  b.newPage = async (...a) => { const p = await np(...a); await browser(p.context()); return p; };
  return b;
}

// ---- shared rows ----------------------------------------------------------------------------------------------------------------------------------
// Runs fn only where editing a shared row cannot hurt (the staging project); against live it is skipped. Inside fn the ownership check is relaxed.
async function sharedRows(why, fn) {
  if (TARGET === 'live') { console.log(`SKIP  ${why} (edits rows that already exist; runs on the staging project only)`); return false; }
  relaxed++; try { await fn(); } finally { relaxed--; }
  return true;
}
export const guard = {
  target: TARGET, isLive: TARGET === 'live', host: HOST,
  own, sharedRows, browser, wrapBrowser, violations, owned: () => [...owned],
  install: installFetch,
  judge,                                                       // for the guard's own tests
};

installFetch();
// a violation fails the run even if a test swallowed the error
process.on('exit', () => {
  if (violations.length && !process.exitCode) process.exitCode = 1;
  if (process.env.LB_GUARD_OUT) { try { writeFileSync(process.env.LB_GUARD_OUT, JSON.stringify({ writes: writes.length, sample: [...new Set(writes)].slice(0, 6), violations: violations.length })); } catch { /* ignore */ } }
});
