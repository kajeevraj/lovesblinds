import { SHOWN_IN } from './constants.js';

const COLS = ['width', 'composition', 'weight', 'thickness', 'openness', 'opacity', 'use_area'];
const EXTRA = ['vaneSize', 'care', 'weightStyleA', 'weightStyleB'];

export const emptyCollection = () => ({ name: '', ...Object.fromEntries([...COLS, ...EXTRA].map((k) => [k, ''])) });

export const collectionToForm = (f) => ({
  name: f.collection_name,
  ...Object.fromEntries(COLS.map((k) => [k, f[k] ?? ''])),
  ...Object.fromEntries(EXTRA.map((k) => [k, f.extra_specs?.[k] ?? ''])),
});

// Database columns from the form. Blank means "do not display". Unmanaged extra_specs keys are kept.
export function formToCollection(v, existingExtra = {}) {
  const t = (s) => (String(s ?? '').trim() || null);
  const extra = { ...existingExtra };
  for (const k of EXTRA) { const val = t(v[k]); if (val) extra[k] = val; else delete extra[k]; }
  return { collection_name: v.name.trim(), ...Object.fromEntries(COLS.map((k) => [k, t(v[k])])), extra_specs: extra };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export function newCollectionRow(form, line, family, fabrics) {
  const base = line === 'drapery' ? `drapery:${slug(form.name)}` : `${line}:${family || '-'}:${slug(form.name)}`;
  let id = base, n = 2;
  while (fabrics.some((f) => f.id === id)) id = `${base}-${n++}`;
  const sort = Math.max(-1, ...fabrics.filter((f) => f.product_line === line).map((f) => f.sort_order)) + 1;
  return { id, product_line: line, shown_in: SHOWN_IN[line], family: line === 'roller' ? family : null,
    ...formToCollection(form), active: true, sort_order: sort };
}

// Key order does not matter (the database returns jsonb keys in its own order).
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : (v ?? null));
export const sameValue = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
export const diffPatch = (before, after) => Object.fromEntries(Object.entries(after).filter(([k, v]) => !sameValue(before[k], v)));
