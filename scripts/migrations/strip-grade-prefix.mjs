// One-off: drop the stray "GRADE " label from drapery/roman specs.composition.
// The grade letter already lives in each swatch's own `grade` field, which is left as stored.
// Text-level replace keeps the file's formatting; the script then proves nothing else changed.
import { readFileSync, writeFileSync } from 'fs';

const FILE = 'src/data/swatches.json';
const before = readFileSync(FILE, 'utf8');
const A = JSON.parse(before);

const after = before.replace(/("composition": ")GRADE\s+/g, '$1');
const B = JSON.parse(after);

let changed = 0;
A.swatches.forEach((s, i) => {
  const t = B.swatches[i];
  const sc = s.specs?.composition, tc = t.specs?.composition;
  if (sc !== tc) {
    if (!(typeof sc === 'string' && sc.replace(/^GRADE\s+/, '') === tc)) throw new Error(`unexpected change on ${s.id}`);
    changed++;
    t.specs.composition = sc;                 // restore, then compare everything else
  }
});
if (JSON.stringify(A) !== JSON.stringify(B)) throw new Error('something other than composition changed');
console.log(`stripped GRADE prefix on ${changed} records`);
writeFileSync(FILE, after);
