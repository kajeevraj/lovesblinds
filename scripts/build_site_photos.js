// Turns the approved Stage 2 photos in assets/photos/*.jpg into responsive WebP copies in
// public/images/site/<name>-<width>.webp (480, 800 and the original width) and writes
// src/data/sitePhotos.json ({ name: { width, height, widths } }). Runs before every build.
import { readdirSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import sharp from 'sharp';

const SRC = 'assets/photos';
const OUT = 'public/images/site';
const WIDTHS = [480, 800];

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const manifest = {};
for (const file of readdirSync(SRC).filter((n) => /\.jpe?g$/i.test(n)).sort()) {
  const name = basename(file, extname(file));
  const input = sharp(join(SRC, file)).rotate();
  const { width, height } = await input.clone().metadata();
  const widths = [...WIDTHS.filter((w) => w < width), width];
  for (const w of widths) {
    await input.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(OUT, `${name}-${w}.webp`));
  }
  manifest[name] = { width, height, widths };
}
// the picture shown when a link to the site is shared: the homepage hero, cropped to 1200 x 630
await sharp(join(SRC, 'hero-living.jpg')).rotate().resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toFile('public/og-image.jpg');
writeFileSync('src/data/sitePhotos.json', JSON.stringify(manifest, null, 1) + '\n');
console.log(`site photos: ${Object.keys(manifest).length} written`);
