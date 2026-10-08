// Writes small WebP tiles for the swatch grid to public/images/swatches-opt/<line>/<code>.webp (320 px square, cropped).
// The grid shows these; the larger view and the order use the original 600 px files. If a tile is missing
// the page falls back to the original, so a build without sharp still works (just heavier).
import { readdirSync, readFileSync, mkdirSync, existsSync, rmSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { mergeCatalogs, orderCatalogs } from '../src/data/mergeSwatches.js';

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }
if (!sharp) { console.log('swatch tiles: sharp not available, skipped'); process.exit(0); }

const OUT = 'public/images/swatches-opt';
const names = readdirSync('src/data').filter(n => /^swatches.*\.json$/.test(n));
const { swatches } = mergeCatalogs(orderCatalogs(names.map(name => ({ name, data: JSON.parse(readFileSync(join('src/data', name), 'utf8')) }))));

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
let n = 0, bytes = 0;
await Promise.all(swatches.map(async (s) => {
  const out = join('public', s.image.replace('/images/swatches/', '/images/swatches-opt/').replace(/\.jpe?g$/i, '.webp'));
  mkdirSync(dirname(out), { recursive: true });
  const info = await sharp(join('public', s.image)).resize(320, 320, { fit: 'cover' }).webp({ quality: 62 }).toFile(out);
  n++; bytes += info.size;
}));
console.log(`swatch tiles: ${n} files, avg ${Math.round(bytes / n / 1024)} KB`);
