// Dev check for src/lib/colorFamily.js: runs the shared function over archived swatch thumbnails (decoded with sharp,
// the way the old build script did) and compares with the families that were seeded. Usage: node scripts/check-color-family.mjs
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { classifyPixels } from '../src/lib/colorFamily.js';
import { familyFromName } from '../src/data/colorFamilyList.js';

const dir = ['src/data', 'archive/data'].find(d => existsSync(join(d, 'swatches.json')));
const J = (n, fb) => (existsSync(join(dir, n)) ? JSON.parse(readFileSync(join(dir, n), 'utf8')) : fb);
const swatches = J('swatches.json').swatches;
const stored = { ...J('colorFamilies.json'), ...J('colorFamilyOverrides.json', {}) };
const auto = J('colorFamilies.json');
let same = 0, byNameCount = 0, differs = [];
for (const s of swatches) {
  if (familyFromName(s.colorName)) { byNameCount++; continue; }
  // the 320 px square the admin page analyzes
  const { data, info } = await sharp(join('public', s.thumb)).resize(320, 320, { fit: 'cover' }).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const got = classifyPixels(data, info.width, info.height, s.line, 4).family;
  if (got === auto[s.id]) same++; else differs.push(`${s.id}: ${got} (script said ${auto[s.id]}, stored ${stored[s.id]})`);
}
console.log(`decided by name: ${byNameCount}; by picture: ${same + differs.length}; same as the original script: ${same}; different: ${differs.length}`);
console.log(differs.slice(0, 25).join('\n'));
