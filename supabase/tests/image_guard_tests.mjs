// The guard that keeps tests away from the LIVE project's pictures, and the local copy that replaces them (offline: no project is asked; the "live" host here is made up).
//  - a Node fetch of a live storage URL fails the test (LIVE GUARD), except the one picture a read-only live check may fetch;
//  - LB_IMAGE_MODE=measure counts such requests and answers them from the local copy instead;
//  - the local image server serves the local copy with CORS, 404s what it does not have, and never asks any project;
//  - a path can never leave the cache folder.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..');
const cache = mkdtempSync(join(tmpdir(), 'lb-img-')); mkdirSync(join(cache, 'swatches/thumb/zebra'), { recursive: true });
const PIC = Buffer.from('fake-webp-bytes'); writeFileSync(join(cache, 'swatches/thumb/zebra/a.webp'), PIC);
const LIVE = 'https://livefake.supabase.co', URLPIC = `${LIVE}/storage/v1/object/public/swatches/thumb/zebra/a.webp`;
const base = { PATH: process.env.PATH, SUPABASE_URL: LIVE, VITE_SUPABASE_ANON_KEY: 'anon', LB_TARGET: 'live', LB_IMAGE_CACHE: cache, LB_GUARD_OUT: join(cache, 'out.json'), STAGING_SUPABASE_URL: '' };
const child = (code, env = {}) => spawnSync('node', ['--input-type=module', '-e', `import { guard } from ${JSON.stringify(join(HERE, 'lib/liveGuard.mjs'))};\n${code}`], { env: { ...base, ...env }, encoding: 'utf8', cwd: ROOT });

try {
  // strict, no picture allowed: the fetch is stopped
  let r = child(`try { await fetch(${JSON.stringify(URLPIC)}); console.log('SENT'); } catch (e) { console.log('STOPPED ' + e.message.slice(0, 60)); }`, { LB_MAX_LIVE_IMAGES: '0' });
  check('a Node fetch of a live storage picture is stopped by the guard and the run fails', /STOPPED LIVE GUARD/.test(r.stdout) && r.status !== 0, `${r.stdout.trim()} exit ${r.status}`);
  // a read-only live check may fetch one picture: the first is sent (nothing listens at the made-up host, so it errors AFTER being let through), the second is stopped
  r = child(`let a, b; try { await fetch(${JSON.stringify(URLPIC)}); } catch (e) { a = /LIVE GUARD/.test(e.message) ? 'guard' : 'network'; } try { await fetch(${JSON.stringify(URLPIC)}); } catch (e) { b = /LIVE GUARD/.test(e.message) ? 'guard' : 'network'; } console.log(a + ',' + b + ',' + guard.imageStats.passedToLive);`, { LB_MAX_LIVE_IMAGES: '1' });
  check('a read-only live check may fetch ONE picture; the second is stopped', r.stdout.trim() === 'network,guard,1', r.stdout.trim());
  // the default allowance is one
  r = child(`let n = 0; for (let i = 0; i < 3; i++) { try { await fetch(${JSON.stringify(URLPIC)}); } catch (e) { if (/LIVE GUARD/.test(e.message)) n++; } } console.log(n + ',' + guard.imageStats.passedToLive);`);
  check('the default is one picture per read-only live check', r.stdout.trim() === '2,1', r.stdout.trim());
  // a staging run never gets one (a writing test)
  r = child(`let n = 0; for (let i = 0; i < 2; i++) { try { await fetch(${JSON.stringify(URLPIC)}); } catch (e) { if (/LIVE GUARD/.test(e.message)) n++; } } console.log(n + ',' + guard.imageStats.passedToLive);`, { SUPABASE_URL: 'https://stagingfake.supabase.co', LB_TARGET: 'staging', LB_LIVE_URL: LIVE });
  check('a run against staging may not fetch any live picture', r.stdout.trim() === '2,0', r.stdout.trim());
  // reads of anything else on live are not touched
  r = child(`try { await fetch('${LIVE}/rest/v1/swatches?select=id'); } catch (e) { console.log(/LIVE GUARD/.test(e.message) ? 'guard' : 'network'); }`, { LB_MAX_LIVE_IMAGES: '0' });
  check('other reads (the catalog, prices) are not affected', r.stdout.trim() === 'network', r.stdout.trim());
  // measure mode: counted, answered from the local copy
  r = child(`const a = await fetch(${JSON.stringify(URLPIC)}); const b = await fetch('${LIVE}/storage/v1/object/public/swatches/thumb/zebra/none.webp'); console.log(a.status + ',' + (await a.text()) + ',' + b.status + ',' + guard.imageStats.requests + ',' + guard.imageStats.passedToLive);`, { LB_IMAGE_MODE: 'measure' });
  check('measure mode counts live picture requests and answers them from the local copy (none reaches live)', r.stdout.trim() === '200,fake-webp-bytes,404,2,0' && r.status === 0, `${r.stdout.trim()} exit ${r.status}`);
  // the helpers
  const lib = await import(`${join(HERE, 'lib/imageCache.mjs')}?t=${Date.now()}`);
  process.env.LB_IMAGE_CACHE = cache;
  check('a storage URL is read into bucket and path, and other URLs are not', JSON.stringify(lib.parseStorageUrl(URLPIC)) === JSON.stringify({ bucket: 'swatches', path: 'thumb/zebra/a.webp', host: 'livefake.supabase.co' }) && lib.parseStorageUrl(`${LIVE}/rest/v1/x`) === null);
  check('a path cannot leave the cache folder', lib.cacheFile('swatches', '../../etc/passwd') === null && lib.cacheFile('swatches', 'thumb/a.webp') !== null);
  // the image server
  const srv = spawnSync('node', ['--input-type=module', '-e', `
    const { startImageServer } = await import(${JSON.stringify(join(ROOT, 'scripts/image-server.mjs'))});
    const s = await startImageServer(0 || 45871 + Math.floor(Math.random() * 500));
    const ok = await fetch(s.url + '/storage/v1/object/public/swatches/thumb/zebra/a.webp'), no = await fetch(s.url + '/storage/v1/object/public/swatches/thumb/zebra/zz.webp'), up = await fetch(s.url + '/storage/v1/object/public/swatches/..%2f..%2fetc%2fpasswd');
    console.log([ok.status, ok.headers.get('access-control-allow-origin'), ok.headers.get('content-type'), (await ok.text()), no.status, up.status].join('|')); s.server.close();`], { env: { ...base }, encoding: 'utf8', cwd: ROOT });
  check('the local image server serves the copy with CORS and the right type, answers 404 for what it does not have, and refuses a path outside the folder', srv.stdout.trim() === '200|*|image/webp|fake-webp-bytes|404|404', `${srv.stdout.trim()} ${srv.stderr.slice(0, 150)}`);
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
rmSync(cache, { recursive: true, force: true });
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
