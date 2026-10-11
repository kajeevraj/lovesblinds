// npm run validate-catalog
// Fails on: duplicate id, missing image/thumb file, swatch with no fabric, unreferenced file
// under public/images/swatches, or counts that differ from scripts/expected-counts.json.
// When a new swatch package lands, update expected-counts.json in the same commit.
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { mergeCatalogs, orderCatalogs } from '../src/data/mergeSwatches.js';
import { COLOR_FAMILY_LIST } from '../src/data/colorFamilyList.js';

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
for (const f of fabrics) {
  const comp = f.specs?.composition;
  if (typeof comp === 'string' && /^\s*GRADE\b/i.test(comp)) fail(`fabric ${f.id}: composition starts with "GRADE"`);
}
const referenced = new Set();
const ref = (p, who) => {
  if (!p) { fail(`${who}: missing image path`); return; }
  if (!p.startsWith('/images/swatches/')) { fail(`${who}: path outside /images/swatches/: ${p}`); return; }
  const file = join('public', p);
  referenced.add(file);
  if (!existsSync(file)) fail(`${who}: file missing ${p}`);
};
for (const s of swatches) {
  // Grade is its own field; the label must never leak into the composition text.
  const comp = s.specs?.composition;
  if (typeof comp === 'string' && /^\s*GRADE\b/i.test(comp)) fail(`swatch ${s.id}: composition starts with "GRADE" (grade belongs in the grade field)`);
  if (s.line === 'drapery' && !/^[A-E]$/.test(s.grade || '')) fail(`swatch ${s.id}: drapery swatch needs grade A to E`);
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

// Color families: every swatch needs one (script result, or an override that wins over it).
const FAMILIES = COLOR_FAMILY_LIST;
const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback);
const autoFam = readJson('src/data/colorFamilies.json', {});
const overFam = readJson('src/data/colorFamilyOverrides.json', {});
const ids = new Set(swatches.map(s => s.id));
const reviewedFam = readJson('src/data/colorFamilyReviewed.json', {});
for (const [id, f] of Object.entries(reviewedFam)) {
  if (!ids.has(id)) fail(`colorFamilyReviewed.json: unknown swatch id "${id}"`);
  if (!FAMILIES.includes(f)) fail(`colorFamilyReviewed.json: "${id}" has unknown family "${f}"`);
}
for (const s of swatches) {
  const f = overFam[s.id] || autoFam[s.id];
  if (!f) fail(`swatch ${s.id}: no color family (run npm run color-families)`);
  else if (!FAMILIES.includes(f)) fail(`swatch ${s.id}: unknown color family "${f}"`);
}
for (const [id, f] of Object.entries(overFam)) {
  if (!ids.has(id)) fail(`colorFamilyOverrides.json: unknown swatch id "${id}"`);
  if (!FAMILIES.includes(f)) fail(`colorFamilyOverrides.json: "${id}" has unknown family "${f}"`);
}

// Display names: the customer-facing color names (src/data/displayNames.json, keyed by swatch id).
// Every swatch needs one, unique within its product line, and it may not carry a digit, a supplier
// collection name, or any supplier code. The supplier's own color name and code are never edited.
const FAMILY_SCOPED_LINES = ['roller', 'cellular'];
const displayNames = readJson('src/data/displayNames.json', null);
if (!displayNames) fail('src/data/displayNames.json is missing');
else {
  const collections = [...new Set(fabrics.map(f => f.fabric))];
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const seenName = new Map();
  for (const [id] of Object.entries(displayNames)) if (!ids.has(id)) fail(`displayNames.json: unknown swatch id "${id}"`);
  for (const s of swatches) {
    const n = displayNames[s.id];
    if (typeof n !== 'string' || !n.trim()) { fail(`swatch ${s.id}: no display name`); continue; }
    if (n !== n.trim() || /\s{2,}/.test(n)) fail(`swatch ${s.id}: display name "${n}" has extra spaces`);
    if (/\d/.test(n)) fail(`swatch ${s.id}: display name "${n}" contains a number`);
    const hit = collections.find(c => new RegExp(`\\b${esc(c)}\\b`, 'i').test(n));
    if (hit) fail(`swatch ${s.id}: display name "${n}" contains the collection name "${hit}"`);
    for (const other of swatches) {
      if (other.code && n.toLowerCase().includes(other.code.toLowerCase())) { fail(`swatch ${s.id}: display name "${n}" contains the supplier code ${other.code}`); break; }
    }
    // Roller and Cellular pickers show one family at a time, so a name only has to be unique inside its family.
    const scope = FAMILY_SCOPED_LINES.includes(s.line) ? `${s.line}/${s.family}` : s.line;
    const key = `${scope}|${n.trim().toLowerCase()}`;
    if (seenName.has(key)) fail(`display name "${n}" is used twice in ${scope}: ${seenName.get(key)} and ${s.id}`);
    else seenName.set(key, s.id);
  }
}

warnings.forEach(w => console.warn('warn:', w));
if (errors.length) {
  errors.slice(0, 50).forEach(e => console.error('FAIL:', e));
  if (errors.length > 50) console.error(`...and ${errors.length - 50} more`);
  process.exit(1);
}
console.log(`validate-catalog OK: ${swatches.length} swatches, ${fabrics.length} fabrics, ${referenced.size} image files`);
