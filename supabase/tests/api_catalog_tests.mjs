// The /api/catalog function for every line the site asks for (and a few it should refuse), against the real catalog.
// Needs SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
import handler from '../../api/catalog.js';
import { LINE_SCOPE, edgePath } from '../../src/data/catalogQuery.js';
import { LINES } from '../../src/data/lines.js';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const call = async (query, method = 'GET') => { const res = { h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; } }; await handler({ method, query }, res); return res; };

for (const line of Object.keys(LINE_SCOPE)) {
  const r = await call({ line });
  check(`/api/catalog?line=${line} answers 200 with colors and is cached`, r.code === 200 && JSON.parse(r.body).some((g) => g.swatches.length) && /s-maxage=60/.test(r.h['Cache-Control']), `${r.code}`);
}
const active = LINES.filter((l) => l.active).map((l) => l.id);
check('every active line of the site is a line the function knows (so the page never asks for one it refuses)', active.every((id) => Object.hasOwn(LINE_SCOPE, id)), active.filter((id) => !Object.hasOwn(LINE_SCOPE, id)).join(','));
check('the path the pages ask for is exactly /api/catalog?line=<line>', edgePath('roller') === '/api/catalog?line=roller');
let r = await call({ line: 'nope' }); check('an unknown line is refused with 400 and is never cached', r.code === 400 && r.h['Cache-Control'] === 'no-store');
r = await call({}); check('no line is refused with 400', r.code === 400);
r = await call({ line: ['roller', 'zebra'] }); check('the line given twice is refused with 400 (not a crash)', r.code === 400);
r = await call({ line: 'roller' }, 'POST'); check('only GET and HEAD are allowed', r.code === 405);

const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
