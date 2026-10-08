// npm run color-families
// Gives every swatch a colorFamily. A family word in the color name wins (see colorFamilyList.js);
// otherwise it comes from the thumbnail (average color of the center area in LAB, plus a pattern check).
// Output: src/data/colorFamilies.json.
// Manual fixes go in src/data/colorFamilyOverrides.json ({ "<swatch id>": "<family>" }); they win
// over this script and are never touched by it.
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { mergeCatalogs, orderCatalogs } from '../src/data/mergeSwatches.js';
import { classifyFile, FAMILIES } from './lib-color.mjs';
import { familyFromName } from '../src/data/colorFamilyList.js';

const names = readdirSync('src/data').filter(n => /^swatches.*\.json$/.test(n));
const { swatches } = mergeCatalogs(orderCatalogs(names.map(name => ({ name, data: JSON.parse(readFileSync(join('src/data', name), 'utf8')) }))));

const out = {};
const counts = {};
let named = 0;
for (const s of swatches) {
  // A family word in the color name wins; the image is only analyzed when the name does not decide it.
  const byName = familyFromName(s.colorName);
  const family = byName || (await classifyFile(join('public', s.thumb), s.line)).family;
  out[s.id] = family;
  if (byName) named++;
  counts[family] = (counts[family] || 0) + 1;
}
writeFileSync('src/data/colorFamilies.json', JSON.stringify(out, null, 1) + '\n');
console.log(`colorFamilies: ${named} by name, ${swatches.length - named} by image`);
console.log('colorFamilies:', FAMILIES.map(f => `${f} ${counts[f] || 0}`).join(', '));
