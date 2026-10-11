// The same naming rules the database enforces, so problems show while typing. The database still has the last word.
import { scopeLabel, LINE_LABELS } from './constants.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (haystack, needle) => !!needle && new RegExp(`(^|[^a-z0-9_])${esc(needle.toLowerCase())}($|[^a-z0-9_])`).test(haystack.toLowerCase());

// Returns a plain-words problem, or '' when the name is fine.
export function checkName(name, { line, family, selfId, swatches, fabrics }) {
  const n = name ?? '';
  if (!n.trim()) return '';
  if (n !== n.trim()) return 'Remove the space at the start or end.';
  if (/\s{2,}/.test(n)) return 'Remove the double space.';
  if (/[0-9]/.test(n)) return 'Color names can’t contain numbers.';
  const coll = fabrics.find((f) => hasWord(n, f.collection_name));
  if (coll) return `The name can’t include the collection name “${coll.collection_name}”. Customers must not see supplier names.`;
  const code = swatches.find((s) => s.id !== selfId && hasWord(n, s.supplier_code));
  if (code) return `The name can’t include the supplier code “${code.supplier_code}”.`;
  const perFamily = line === 'roller' || line === 'cellular';
  const dup = swatches.find((s) => s.id !== selfId && s.product_line === line && s.display_name.toLowerCase() === n.toLowerCase()
    && (!perFamily || (s.family || null) === (family || null)));
  if (dup) return `That name is already used in ${scopeLabel(line, family)}${dup.active ? '' : ' (by a hidden color)'}.`;
  return '';
}

export function checkCode(code, { line, selfId, swatches }) {
  const c = code ?? '';
  if (!c.trim()) return '';
  if (c !== c.trim()) return 'Remove the space at the start or end.';
  const dup = swatches.find((s) => s.id !== selfId && s.product_line === line && s.supplier_code.toLowerCase() === c.toLowerCase());
  if (dup) return `That supplier code is already used in ${LINE_LABELS[line]} (by “${dup.display_name}”).`;
  return '';
}
