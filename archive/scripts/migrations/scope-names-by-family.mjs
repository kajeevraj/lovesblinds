// One-off: Roller and Cellular show one family at a time in the picker, so display names only need to be
// unique inside their family. A supplier color name that is unique inside its family goes back to being
// used as it is; every other name (including the approved new ones) is left as it is.
import { readFileSync, writeFileSync } from 'fs';
const J = f => JSON.parse(readFileSync(f, 'utf8'));
const d = J('src/data/swatches.json');
const names = J('src/data/displayNames.json');
const coll = [...new Set(d.fabrics.map(f => f.fabric))];
const banned = n => coll.some(c => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(n));
const changes = [];
for (const line of ['roller', 'cellular']) {
  const sw = d.swatches.filter(s => s.line === line);
  const count = new Map();
  for (const s of sw) { const k = `${s.family}|${s.colorName.toLowerCase()}`; count.set(k, (count.get(k) || 0) + 1); }
  for (const s of sw) {
    if (count.get(`${s.family}|${s.colorName.toLowerCase()}`) === 1 && !banned(s.colorName) && names[s.id] !== s.colorName) {
      changes.push(`${s.id}: "${names[s.id]}" -> "${s.colorName}"`);
      names[s.id] = s.colorName;
    }
  }
}
writeFileSync('src/data/displayNames.json', JSON.stringify(names, null, 1) + '\n');
console.log(`${changes.length} names went back to the supplier name:\n` + changes.join('\n'));
