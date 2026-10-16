// The same naming rules the database enforces, so problems show while typing. The database still has the last word.
import { scopeLabel, LINE_LABELS } from './constants.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (haystack, needle) => !!needle && new RegExp(`(^|[^a-z0-9_])${esc(needle.toLowerCase())}($|[^a-z0-9_])`).test(haystack.toLowerCase());

// Every place a color is sold: its own line plus the lines it is linked into (one record, one name and code everywhere).
export function placementsOf(swatches, links = []) {
  const byId = new Map(swatches.map((s) => [s.id, s]));
  return [
    ...swatches.map((s) => ({ id: s.id, line: s.product_line, family: s.family || null, name: s.display_name, code: s.supplier_code, active: s.active })),
    ...(links || []).filter((l) => byId.has(l.swatch_id)).map((l) => { const s = byId.get(l.swatch_id); return { id: s.id, line: l.product_line, family: l.family || null, name: s.display_name, code: s.supplier_code, active: s.active }; }),
  ];
}

// Returns a plain-words problem, or '' when the name is fine in `line` (and `family`, for Roller and Cellular).
// `selfId` is the color being edited: its own rows never clash with it.
export function checkName(name, { line, family, selfId, swatches, fabrics, links = [] }) {
  const n = name ?? '';
  if (!n.trim()) return '';
  if (n !== n.trim()) return 'Remove the space at the start or end.';
  if (/\s{2,}/.test(n)) return 'Remove the double space.';
  if (/[0-9]/.test(n)) return 'Color names can’t contain numbers.';
  const coll = fabrics.find((f) => hasWord(n, f.collection_name));
  if (coll) return `The name can’t include the price group name “${coll.collection_name}”. Customers must not see supplier names.`;
  const code = swatches.find((s) => s.id !== selfId && hasWord(n, s.supplier_code));
  if (code) return `The name can’t include the supplier code “${code.supplier_code}”.`;
  const perFamily = line === 'roller' || line === 'cellular';
  const dup = placementsOf(swatches, links).find((p) => p.id !== selfId && p.line === line && p.name.toLowerCase() === n.toLowerCase()
    && (!perFamily || (p.family || null) === (family || null)));
  if (dup) return `“${n}” is already used in ${scopeLabel(line, family)} by the color with code ${dup.code}${dup.active ? '' : ' (hidden)'}. Pick another name, or leave ${LINE_LABELS[line]} unticked.`;
  return '';
}

export function checkCode(code, { line, selfId, swatches, links = [] }) {
  const c = code ?? '';
  if (!c.trim()) return '';
  if (c !== c.trim()) return 'Remove the space at the start or end.';
  const dup = placementsOf(swatches, links).find((p) => p.id !== selfId && p.line === line && p.code.toLowerCase() === c.toLowerCase());
  if (dup) return `That supplier code is already used in ${LINE_LABELS[line]} (by “${dup.name}”).`;
  return '';
}
