// Scans public/images/showcase/<slug>/ and writes src/data/showcase.json.
// With `sharp` available it also writes resized JPEG + WebP copies to public/images/showcase-opt/
// (hero 2000 px wide, line images 1200 px, quality 80). Without it, originals are used as-is.
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, extname, basename } from 'path';

const ROOT = 'public/images/showcase';
const OUT = 'public/images/showcase-opt';
const SLUGS = ['hero', 'roller', 'zebra', 'shangri-la', 'roman', 'cellular', 'drapery'];
const WIDTH = { hero: 2000 };           // everything else 1200
const isImage = (n) => /\.(jpe?g|png)$/i.test(n) && !n.startsWith('_') && !n.startsWith('.');

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }

const sectionOf = (slug, file) => {
  if (slug !== 'drapery') return null;
  if (/^drapery-dream-/i.test(file)) return 'dream-curtains';
  if (/^drapery-curtains-/i.test(file)) return 'curtains';
  return null;
};

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
const entries = [];
for (const slug of SLUGS) {
  const dir = join(ROOT, slug);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
  for (const file of readdirSync(dir).filter(isImage).sort()) {
    const input = join(dir, file);
    const stem = basename(file, extname(file));
    const entry = { file, slug, section: sectionOf(slug, file) };
    if (sharp) {
      const targetW = WIDTH[slug] || 1200;
      const outDir = join(OUT, slug);
      mkdirSync(outDir, { recursive: true });
      const base = sharp(input).rotate().resize({ width: targetW, withoutEnlargement: true });
      const info = await base.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(join(outDir, `${stem}.jpg`));
      await base.clone().webp({ quality: 80 }).toFile(join(outDir, `${stem}.webp`));
      Object.assign(entry, {
        width: info.width, height: info.height,
        src: `/images/showcase-opt/${slug}/${stem}.jpg`,
        webp: `/images/showcase-opt/${slug}/${stem}.webp`,
      });
    } else {
      const meta = { width: 0, height: 0 };
      Object.assign(entry, { ...meta, src: `/images/showcase/${slug}/${file}`, webp: null });
    }
    entries.push(entry);
  }
}
writeFileSync('src/data/showcase.json', JSON.stringify(entries, null, 2) + '\n');
console.log(`showcase manifest: ${entries.length} images${sharp ? '' : ' (sharp not available: originals used, no sizes)'}`);
