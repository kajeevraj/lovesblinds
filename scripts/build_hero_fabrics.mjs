// Builds the fabric textures the /hero-lab 3D models use, from the real catalog swatches.
//
//   node scripts/build_hero_fabrics.mjs
//
// For each pick below it reads the public catalog (the same `public_catalog()` function the product pages use, so only display
// names and pictures, never supplier data), checks the supplier code still has the display name we expect, downloads the full
// swatch picture from the public `swatches` bucket, crops a clean fabric region where the photo is not a flat swatch, and writes:
//   public/hero-lab/fabrics/<key>.webp   a 512 px texture (committed, served from our own site: no request to Supabase)
//   src/hero/fabrics.json                key, line, code, display name, average color, physical tile size in metres
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (same as the site build). Not part of `npm run build`: the outputs are committed.
//
// To use another color in the hero: add a row here, run the script, and point the product at the new key in src/hero/products.js.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!BASE || !KEY) { console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'); process.exit(1); }

// scope = the catalog scope that lists the color; crop = region of the full picture to use (null = the whole picture);
// tile = physical size in metres that one copy of the texture covers when it repeats on the model; mirror = repeat it face to
// face (hides the seam on a fabric that is not made to tile; off for stripes, which need to keep one band width).
const PICKS = [
  { key: 'roller-blue', scope: 'roller', code: 'YS208608', name: 'Blue', crop: { left: 0, top: 0, width: 406, height: 360 }, tile: [0.34, 0.34] },
  { key: 'zebra-granite-gray', scope: 'zebra', code: 'YZB3304', name: 'Granite Gray', crop: { left: 0, top: 160, width: 486, height: 340 }, tile: [0.36, 0.25] },
  { key: 'shangri-la-linen', scope: 'shangri-la', code: 'YSLM605', name: 'Linen', crop: { left: 232, top: 395, width: 70, height: 70 }, tile: [0.2, 0.13] },
  { key: 'cellular-avocado-green', scope: 'cellular', code: 'YHC38L003', name: 'Avocado Green', crop: { left: 40, top: 88, width: 480, height: 60 }, tile: [0.4, 0.05] },
  { key: 'roman-hazelnut-beige', scope: 'roman', code: 'SP26041004', name: 'Hazelnut Beige', crop: null, tile: [0.4, 0.37] },
  { key: 'curtains-mushroom-beige', scope: 'drapery', code: 'SP26029003', name: 'Mushroom Beige', crop: null, tile: [0.4, 0.37] },
  { key: 'dream-anchor-gray', scope: 'drapery,dream-curtains', code: 'ZDS3001-17', name: 'Anchor Gray', crop: null, tile: [0.9, 0.9], mirror: true },
];

const rpc = async (scope) => {
  const r = await fetch(`${BASE}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${scope}}`)}&apikey=${KEY}`);
  if (!r.ok) throw new Error(`catalog ${scope}: ${r.status}`);
  return r.json();
};
const find = (rows, code) => rows.flatMap((f) => f.swatches || []).find((s) => s.supplier_code === code);
const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

mkdirSync('public/hero-lab/fabrics', { recursive: true });
mkdirSync('src/hero', { recursive: true });
const cache = {};
const out = {};
for (const p of PICKS) {
  cache[p.scope] ||= await rpc(p.scope);
  const sw = find(cache[p.scope], p.code);
  if (!sw) throw new Error(`${p.code} is not in the ${p.scope} catalog any more`);
  if (sw.display_name !== p.name) throw new Error(`${p.code} is now called "${sw.display_name}" (expected "${p.name}")`);
  const url = `${BASE}/storage/v1/object/public/swatches/${sw.image_path.split('/').map(encodeURIComponent).join('/')}`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  let img = sharp(buf);
  if (p.crop) img = img.extract(p.crop);
  const tex = await img.resize({ width: 512, height: 512, fit: 'fill' }).toBuffer();   // square power-of-two texture (stretched; the physical tile size below undoes it)
  await sharp(tex).webp({ quality: 74 }).toFile(`public/hero-lab/fabrics/${p.key}.webp`);
  const { channels } = await sharp(tex).stats();
  out[p.key] = { line: p.scope.split(',')[0], code: p.code, name: sw.display_name, color: toHex(channels[0].mean, channels[1].mean, channels[2].mean), texture: `/hero-lab/fabrics/${p.key}.webp`, tile: p.tile, mirror: p.mirror === true };
  console.log(p.key, out[p.key].color);
}
writeFileSync('src/hero/fabrics.json', JSON.stringify(out, null, 2) + '\n');
