// npm run validate-catalog
// Fails on: duplicate id, missing image/thumb file, swatch with no fabric, unreferenced file
// under public/images/swatches, or counts that differ from scripts/expected-counts.json.
// When a new swatch package lands, update expected-counts.json in the same commit.
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { mergeCatalogs, orderCatalogs } from '../src/data/mergeSwatches.js';

const DATA_DIR = 'src/data';
const IMG_ROOT = 'public/images/swatches';
const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);

const names = readdirSync(DATA_DIR).filter(n => /^swatches.*\.json$/.test(n));
const catalogs = orderCatalogs(names.map(name => ({ name, data: JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8')) })));
if (catalogs.length === 0) fail(`no swatches*.json in ${DATA_DIR}`);

// Duplicate ids inside one file are errors; the same id across files is skipped by the merge (warning).
for (const { name, data } of catalogs) {
  for (const kind of ['fabrics', 'swatches']) {
    const seen = new Set();
    for (const r of data[kind] || []) {
      if (seen.has(r.id)) fail(`duplicate ${kind.slice(0, -1)} id "${r.id}" in ${name}`);
      seen.add(r.id);
    }
  }
}
const { fabrics, swatches, skipped } = mergeCatalogs(catalogs);
for (const s of skipped) warnings.push(`${s.kind} id "${s.id}" in ${s.from} already exists; kept the earlier record`);

const fabricIds = new Set(fabrics.map(f => f.id));
const referenced = new Set();
const ref = (p, who) => {
  if (!p) { fail(`${who}: missing image path`); return; }
  if (!p.startsWith('/images/swatches/')) { fail(`${who}: path outside /images/swatches/: ${p}`); return; }
  const file = join('public', p);
  referenced.add(file);
  if (!existsSync(file)) fail(`${who}: file missing ${p}`);
};
for (const s of swatches) {
  if (!fabricIds.has(s.fabricId)) fail(`swatch ${s.id}: no fabric with id "${s.fabricId}"`);
  ref(s.image, `swatch ${s.id} image`);
  ref(s.thumb, `swatch ${s.id} thumb`);
  for (const st of s.styles || []) {
    ref(st.image, `swatch ${s.id} style ${st.style} image`);
    ref(st.thumb, `swatch ${s.id} style ${st.style} thumb`);
  }
}

const walk = (dir) => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
if (existsSync(IMG_ROOT)) {
  for (const f of walk(IMG_ROOT)) if (!referenced.has(f)) fail(`unreferenced file ${f}`);
} else fail(`${IMG_ROOT} does not exist`);

// Counts
const expected = JSON.parse(readFileSync('scripts/expected-counts.json', 'utf8'));
const cmp = (label, got, want) => { if (got !== want) fail(`count ${label}: got ${got}, expected ${want}`); };
cmp('fabrics', fabrics.length, expected.fabrics);
cmp('swatches', swatches.length, expected.swatches);
for (const [line, want] of Object.entries(expected.byLine)) cmp(line, swatches.filter(s => s.line === line).length, want);
for (const [k, want] of Object.entries(expected.byLineFamily)) {
  const [line, family] = k.split('/');
  cmp(k, swatches.filter(s => s.line === line && s.family === family).length, want);
}
const known = new Set(Object.keys(expected.byLine));
for (const s of swatches) if (!known.has(s.line)) { fail(`swatch ${s.id}: line "${s.line}" has no expected count`); break; }

warnings.forEach(w => console.warn('warn:', w));
if (errors.length) {
  errors.slice(0, 50).forEach(e => console.error('FAIL:', e));
  if (errors.length > 50) console.error(`...and ${errors.length - 50} more`);
  process.exit(1);
}
console.log(`validate-catalog OK: ${swatches.length} swatches, ${fabrics.length} fabrics, ${referenced.size} image files`);
