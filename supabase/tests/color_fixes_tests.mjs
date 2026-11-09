// scripts/apply-color-fixes.mjs against an in-process fake of the REST endpoint (no real project is touched): the approved color fixes (4 families to Gray,
// Salt White soft white + Pattern + sheer open weave, 4 brown preview colors) with a dry run, a manifest and a one-command undo.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const mk = (id, name, code, line, fam) => ({ id, display_name: name, supplier_code: code, product_line: line, color_family: fam, preview_color: null, texture_mode: null, weave: null });
const rows = [
  mk('r1', 'Ash Gray', 'WSS660105', 'roller', 'White'), mk('r2', 'Granite Gray', 'WSS360105', 'roller', 'White'), mk('r3', 'Shadow Gray', 'YSS-A12-103', 'roller', 'White'), mk('r4', 'White Slate', 'WSS481277', 'roller', 'White'),
  mk('d1', 'Salt White', 'SP26027008', 'drapery', 'White'),
  mk('b1', 'Bark Brown', 'YSS-T12-305', 'roller', 'Brown'), mk('b2', 'Cocoa Chocolate', 'XSS000539', 'roller', 'Brown'), mk('z1', 'Dark Chocolate', 'YZB2008', 'zebra', 'Brown'), mk('z2', 'Bittersweet Chocolate', 'YZB3007', 'zebra', 'Brown'),
  mk('x1', 'Clean White', 'YS180002', 'roller', 'White'),                          // must never be touched
];
const writes = [];
const server = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks).toString(), u = new URL(req.url, 'http://x'), q = u.searchParams;
  const send = (code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(typeof data === 'string' ? data : JSON.stringify(data)); };
  if (u.pathname !== '/rest/v1/swatches') return send(404, '{}');
  const match = (r) => [...q.entries()].every(([k, v]) => ['select', 'limit'].includes(k) || (v.startsWith('eq.') ? String(r[k]) === v.slice(3) : true));
  if (req.method === 'GET') return send(200, rows.filter(match).map((r) => ({ ...r })));
  if (req.method === 'PATCH') { writes.push({ id: q.get('id'), body: JSON.parse(body) }); const r = rows.find(match); if (r) Object.assign(r, JSON.parse(body)); return send(204, ''); }
  send(405, '{}');
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`, LOGS = mkdtempSync(join(tmpdir(), 'cf-'));
const run = (...a) => new Promise((resolve) => { const c = spawn('node', [join(ROOT, 'scripts/apply-color-fixes.mjs'), ...a], { env: { ...process.env, SUPABASE_URL: BASE, SUPABASE_SERVICE_ROLE_KEY: 'k', BACKFILL_LOG_DIR: LOGS } }); let stdout = '', stderr = ''; c.stdout.on('data', (d) => { stdout += d; }); c.stderr.on('data', (d) => { stderr += d; }); c.on('close', (status) => resolve({ status, stdout, stderr })); });
const snap = () => JSON.stringify(rows);
try {
  const before = snap();
  const dry = await run();
  check('the dry run shows before and after for all 9 colors and writes nothing', snap() === before && writes.length === 0 && dry.stdout.split('\n').filter((l) => /->/.test(l)).length === 9 && /dry run, nothing written/.test(dry.stdout), dry.stdout.split('\n').slice(0, 2).join(' | '));
  const apply = await run('--apply');
  const by = (id) => rows.find((r) => r.id === id);
  check('Ash Gray, Granite Gray, Shadow Gray and White Slate move from White to Gray', ['r1', 'r2', 'r3', 'r4'].every((id) => by(id).color_family === 'Gray'));
  check('Salt White stays White, with a soft white preview color, Pattern texture and the sheer open weave', by('d1').color_family === 'White' && by('d1').preview_color === '#efede9' && by('d1').texture_mode === 'pattern' && by('d1').weave === 'voile');
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return { l: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], rb: c[0] - c[2] }; };
  check('the four browns have a brown preview color (warm: red 20 or more above blue; not black: lightness above 45)', ['b1', 'b2', 'z1', 'z2'].every((id) => { const c = lum(by(id).preview_color); return c.rb >= 20 && c.l > 45 && by(id).color_family === 'Brown'; }), ['b1', 'b2', 'z1', 'z2'].map((id) => by(id).preview_color).join(' '));
  check('nothing else was touched (Clean White is as it was) and only the fields named were written', JSON.stringify(by('x1')) === JSON.stringify(mk('x1', 'Clean White', 'YS180002', 'roller', 'White')) && writes.every((w) => Object.keys(w.body).every((k) => ['color_family', 'preview_color', 'texture_mode', 'weave'].includes(k))));
  const files = readdirSync(LOGS), man = JSON.parse(readFileSync(join(LOGS, files[0]), 'utf8'));
  check('the manifest records the previous value of every field it changed, and the one-command undo line', files.length === 1 && man.rows.length === 9 && man.rows.find((r) => r.name === 'Ash Gray').before.color_family === 'White' && man.rows.find((r) => r.name === 'Salt White').before.weave === null && /--undo/.test(apply.stdout));
  by('b1').preview_color = '#5a4030';                                             // the owner tweaked one brown afterwards
  const undo = await run('--undo', join(LOGS, files[0]));
  check('--undo puts everything back exactly (families White, Salt White and three browns empty) but keeps the brown the owner tweaked since', undo.status === 0 && ['r1', 'r2', 'r3', 'r4'].every((id) => by(id).color_family === 'White') && by('d1').preview_color === null && by('d1').texture_mode === null && by('d1').weave === null && ['b2', 'z1', 'z2'].every((id) => by(id).preview_color === null) && by('b1').preview_color === '#5a4030', undo.stdout.trim());
  // a color that is not as expected stops everything before any write
  by('r2').display_name = 'Something Else'; writes.length = 0;
  const stop = await run('--apply');
  check('a color that is not as expected stops the whole run before anything is written', stop.status === 1 && /STOP/.test(stop.stderr) && writes.length === 0, stop.stderr.trim());
  by('r2').display_name = 'Granite Gray';
  const bad = JSON.parse(readFileSync(join(LOGS, files[0]), 'utf8')); bad.base = 'http://elsewhere'; (await import('node:fs')).writeFileSync(join(LOGS, 'o.json'), JSON.stringify(bad));
  check('a manifest from another project is refused', (await run('--undo', join(LOGS, 'o.json'))).status === 1);
  // ---- part 2: White colors moved to Gray / Cream-Ivory / Pattern-Multi (same script, `--fixes part2`) ----
  const { FIXES: P2 } = await import('../../scripts/color-fixes/part2.mjs');
  rows.length = 0; writes.length = 0;
  P2.forEach((f, i) => rows.push(mk(`p${i}`, f.name, f.code, f.line, 'White')));
  rows.push(mk('hold', 'Bronze', 'WSS385858', 'roller', 'White'), mk('wl2', 'White Linen', 'YHCKB002', 'cellular', 'White'), mk('keep', 'Tundra White', 'SP26025001', 'drapery', 'White'));      // must never be touched
  const before2 = snap(), dry2 = await run('--fixes', 'part2');
  check('part 2 dry run: shows the 19 moves and writes nothing', snap() === before2 && writes.length === 0 && P2.length === 19 && dry2.stdout.split('\n').filter((l) => /->/.test(l)).length === 19 && /dry run, nothing written/.test(dry2.stdout));
  check('part 2 is exactly the approved list: 5 to Gray, 8 to Cream/Ivory, 6 to Pattern/Multi, only the color family changes, every color is checked to be White now', ['Gray', 'Cream/Ivory', 'Pattern/Multi'].map((f) => P2.filter((x) => x.set.color_family === f).length).join() === '5,8,6' && P2.every((x) => Object.keys(x.set).join() === 'color_family' && x.expect.color_family === 'White'));
  check('the colors are told apart by code and line (two Tundra Whites, two Wisp Whites are different colors)', new Set(P2.map((x) => `${x.line}|${x.code}`)).size === 19 && P2.filter((x) => x.name === 'Tundra White').length === 2);
  const ap2 = await run('--fixes', 'part2', '--apply'), fam = (id) => rows.find((r) => r.id === id).color_family;
  check('part 2 --apply moves each color to its family', P2.every((f, i) => fam(`p${i}`) === f.set.color_family) && ap2.status === 0, ap2.stdout.split('\n').slice(-3, -1).join(' | '));
  check('Bronze (on hold), the blackout White Linen and the drapery Tundra White are untouched', fam('hold') === 'White' && fam('wl2') === 'White' && fam('keep') === 'White' && writes.every((w) => !['hold', 'wl2', 'keep'].includes(w.id)));
  const f2 = readdirSync(LOGS).filter((n) => /part2/.test(n)), m2 = JSON.parse(readFileSync(join(LOGS, f2[0]), 'utf8'));
  check('the part 2 manifest records the previous family of all 19 and the one-command undo line', f2.length === 1 && m2.rows.length === 19 && m2.rows.every((r) => r.before.color_family === 'White') && /--undo/.test(ap2.stdout));
  rows.find((r) => r.id === 'p3').color_family = 'Beige/Tan';                              // the owner changes one afterwards
  const un2 = await run('--undo', join(LOGS, f2[0]));
  check('part 2 --undo puts the families back to White, but keeps the one the owner changed since', un2.status === 0 && P2.every((f, i) => i === 3 || fam(`p${i}`) === 'White') && fam('p3') === 'Beige/Tan', un2.stdout.trim());
  rows.find((r) => r.id === 'p5').color_family = 'Beige/Tan'; writes.length = 0;                   // a color that is now in a third family: the whole run stops before any write
  const st2 = await run('--fixes', 'part2', '--apply');
  check('part 2 stops before writing anything if a color is no longer as expected', st2.status === 1 && /STOP/.test(st2.stderr) && writes.length === 0, st2.stderr.trim());
  rows.find((r) => r.id === 'p3').color_family = 'White'; rows.find((r) => r.id === 'p5').color_family = 'Cream/Ivory';          // p3 back to White; p5 already in its target family: not an error, just nothing to do
  const same = await run('--fixes', 'part2');
  check('a color that is already in its target family is simply "already as wanted" (the run is safe to repeat)', same.status === 0 && /Off-white\s+zebra\s+already as wanted/.test(same.stdout), same.stdout.split('\n').find((l) => /Off-white/.test(l)));
  check('an unknown fix list is refused', (await run('--fixes', 'nope')).status === 1);
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
server.close(); rmSync(LOGS, { recursive: true, force: true });
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
