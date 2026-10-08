// Scans public/explainers/** and writes src/data/explainers.json.
// With `sharp` available it also writes resized WebP copies to public/explainers-opt/ (cards 640 px,
// Measure Guide diagrams 1100 px). Rasters (png/jpg/webp) win over an svg of the same name, so a photo
// dropped in with the same name as an svg replaces it with no code change.
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'public/explainers';
const OUT = 'public/explainers-opt';
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }

const walk = (dir) => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
const manifest = {};
for (const file of existsSync(ROOT) ? walk(ROOT).sort() : []) {
  const ext = extname(file).toLowerCase();
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  const key = rel.slice(0, -ext.length);
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    const entry = { src: `/explainers/${rel}` };
    if (sharp) {
      const max = key.startsWith('measure/') ? 1100 : 640;
      const outFile = join(OUT, `${key}.webp`);
      mkdirSync(join(OUT, key.split('/').slice(0, -1).join('/')), { recursive: true });
      const info = await sharp(file).resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(outFile);
      Object.assign(entry, { webp: `/explainers-opt/${key}.webp`, width: info.width, height: info.height });
    }
    manifest[key] = entry;
  } else if (ext === '.svg' && !manifest[key]) {
    manifest[key] = { src: `/explainers/${rel}`, svg: true, width: 240, height: 180 };
  }
}
// Rasters win over svg of the same name.
for (const [k, v] of Object.entries(manifest)) if (v.svg && ['.png', '.jpg', '.jpeg', '.webp'].some(e => existsSync(join(ROOT, k + e)))) delete manifest[k];
writeFileSync('src/data/explainers.json', JSON.stringify(manifest, null, 1) + '\n');
console.log(`explainers: ${Object.keys(manifest).length} images${sharp ? '' : ' (sharp not available: originals only)'}`);
