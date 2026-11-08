// scripts/backfill-textures.mjs against an in-process fake of the REST and storage endpoints (no real project is touched):
//  - the dry run writes nothing;
//  - --apply adds ONLY new texflat/ files, never touches tex256/ or any existing object, and never replaces an existing texflat/ file;
//  - texture_mode is stored only where empty (an owner's value is kept) and Zebra is stored as pattern;
//  - the manifest lists every file created and the previous value of every row changed;
//  - --undo <manifest> removes exactly those files and restores exactly those rows, but leaves a row the owner changed since;
//  - a manifest from another project is refused.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };

// a flat weave picture
const W = 400, px = Buffer.alloc(W * W * 3); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = 180 + 6 * Math.sin(x * 1.1) * Math.cos(y * 1.1) + (x % 7); for (let c = 0; c < 3; c++) px[(y * W + x) * 3 + c] = v; }
const jpg = await sharp(px, { raw: { width: W, height: W, channels: 3 } }).jpeg().toBuffer();
// the fake project
const objects = new Map([['full/roller/a.jpg', jpg], ['thumb/roller/a.webp', jpg], ['tex256/roller/a.webp', Buffer.from('OLD-A')], ['full/roller/b.jpg', jpg], ['thumb/roller/b.webp', jpg], ['full/zebra/z.jpg', jpg], ['thumb/zebra/z.webp', jpg], ['texflat/roller/b.webp', Buffer.from('ALREADY-THERE')]]);
const rows = [
  { id: 'roller:a', product_line: 'roller', image_path: 'full/roller/a.jpg', thumb_path: 'thumb/roller/a.webp', texture_mode: null, styles: null },
  { id: 'roller:b', product_line: 'roller', image_path: 'full/roller/b.jpg', thumb_path: 'thumb/roller/b.webp', texture_mode: 'pattern', styles: null },      // the owner chose Pattern by hand
  { id: 'zebra:z', product_line: 'zebra', image_path: 'full/zebra/z.jpg', thumb_path: 'thumb/zebra/z.webp', texture_mode: null, styles: null },
];
const log = [];
const server = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks), u = new URL(req.url, 'http://x');
  log.push(`${req.method} ${u.pathname}`);
  const send = (code, data, type = 'application/json') => { res.writeHead(code, { 'content-type': type }); res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)); };
  const objPath = decodeURIComponent(u.pathname.replace(/^\/storage\/v1\/object\/(public\/)?swatches\//, ''));
  if (u.pathname.startsWith('/storage/v1/object/')) {
    if (req.method === 'GET') return objects.has(objPath) ? send(200, objects.get(objPath), 'image/jpeg') : send(404, '{}');
    if (req.method === 'POST') { if (objects.has(objPath) && req.headers['x-upsert'] !== 'true') return send(409, JSON.stringify({ message: 'The resource already exists' })); objects.set(objPath, body); return send(200, '{}'); }
    if (req.method === 'DELETE') { objects.delete(objPath); return send(200, '{}'); }
  }
  if (u.pathname === '/rest/v1/swatches') {
    if (req.method === 'GET') { const id = u.searchParams.get('id'); const list = id ? rows.filter((r) => r.id === id.replace('eq.', '')) : rows; return send(200, list.map((r) => ({ ...r }))); }
    if (req.method === 'PATCH') {
      const id = u.searchParams.get('id').replace('eq.', ''), cond = u.searchParams.get('texture_mode'), r = rows.find((x) => x.id === id);
      if (r && (!cond || (cond === 'is.null' ? r.texture_mode === null : r.texture_mode === cond.replace('eq.', '')))) Object.assign(r, JSON.parse(body.toString()));
      return send(204, '');
    }
  }
  send(404, '{}');
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`, LOGS = mkdtempSync(join(tmpdir(), 'bf-'));
// async (the fake project lives in THIS process, so it must keep answering while the script runs)
const run = (...a) => new Promise((resolve) => { const c = spawn('node', [join(ROOT, 'scripts/backfill-textures.mjs'), ...a], { env: { ...process.env, SUPABASE_URL: BASE, SUPABASE_SERVICE_ROLE_KEY: 'k', BACKFILL_LOG_DIR: LOGS } }); let stdout = '', stderr = ''; c.stdout.on('data', (d) => { stdout += d; }); c.stderr.on('data', (d) => { stderr += d; }); c.on('close', (status) => resolve({ status, stdout, stderr })); });
const snap = () => JSON.stringify([[...objects.keys()].sort(), rows]);
try {
  const before = snap();
  const dry = await run();
  check('the dry run writes nothing (no object, no row, no manifest) and says what it would do', snap() === before && !log.some((l) => /^(POST|DELETE|PATCH)/.test(l)) && readdirSync(LOGS).length === 0 && /dry run, nothing written/.test(dry.stdout), dry.stdout.trim().split('\n').pop());
  const apply = await run('--apply');
  const created = [...objects.keys()].filter((k) => k.startsWith('texflat/')).sort();
  check('--apply adds texflat/ files only: one per picture, in the new folder', apply.status === 0 && created.join() === 'texflat/roller/a.webp,texflat/roller/b.webp,texflat/zebra/z.webp', created.join() + ' | ' + apply.stderr);
  check('the older texture tex256/ is untouched (same bytes), and every other existing object too', objects.get('tex256/roller/a.webp').toString() === 'OLD-A' && [...before ? JSON.parse(before)[0] : []].filter((k) => !k.startsWith('texflat/')).every((k) => objects.has(k)) && !objects.has('tex256/zebra/z.webp') && !objects.has('tex256/roller/b.webp'));
  check('an existing texflat/ file is never replaced', objects.get('texflat/roller/b.webp').toString() === 'ALREADY-THERE');
  check('the new textures are real 256 x 256 images', (await Promise.all(['texflat/roller/a.webp', 'texflat/zebra/z.webp'].map((k) => sharp(objects.get(k)).metadata()))).every((m) => m.width === 256 && m.height === 256 && m.format === 'webp'));
  check('texture_mode is stored where it was empty (a flat photo: photo; Zebra: pattern) and the owner\'s own value is kept', rows[0].texture_mode === 'photo' && rows[2].texture_mode === 'pattern' && rows[1].texture_mode === 'pattern');
  const files = readdirSync(LOGS), man = JSON.parse(readFileSync(join(LOGS, files[0]), 'utf8'));
  check('the manifest lists the 2 files it created and the 2 rows it changed with their previous value (null)', files.length === 1 && man.files.sort().join() === 'texflat/roller/a.webp,texflat/zebra/z.webp' && man.rows.length === 2 && man.rows.every((r) => r.from === null) && /--undo/.test(apply.stdout), JSON.stringify(man.rows));
  // the owner changes one row afterwards; then undo
  rows[0].texture_mode = 'pattern';
  const undo = await run('--undo', join(LOGS, files[0]));
  check('--undo removes exactly the files the run created (not the pre-existing texflat/ file, not tex256/)', undo.status === 0 && !objects.has('texflat/roller/a.webp') && !objects.has('texflat/zebra/z.webp') && objects.has('texflat/roller/b.webp') && objects.get('tex256/roller/a.webp').toString() === 'OLD-A', undo.stdout.trim());
  check('--undo puts texture_mode back where the run set it (zebra: null) and leaves the row the owner changed since (roller:a stays pattern) and the owner\'s own (roller:b)', rows[2].texture_mode === null && rows[0].texture_mode === 'pattern' && rows[1].texture_mode === 'pattern');
  check('after the undo the project holds exactly what it held before (apart from the owner\'s later edit)', JSON.stringify([...objects.keys()].sort()) === JSON.stringify(JSON.parse(before)[0]));
  const other = await run('--undo', join(LOGS, files[0]).replace(/$/, ''));        // same project: allowed again (idempotent)
  check('running --undo twice is harmless', other.status === 0);
  const m2 = { ...man, base: 'http://elsewhere' }; const fs = await import('node:fs'); fs.writeFileSync(join(LOGS, 'other.json'), JSON.stringify(m2));
  const bad = await run('--undo', join(LOGS, 'other.json'));
  check('a manifest from another project is refused', bad.status === 1 && /another project/.test(bad.stderr));
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
server.close(); rmSync(LOGS, { recursive: true, force: true });
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
