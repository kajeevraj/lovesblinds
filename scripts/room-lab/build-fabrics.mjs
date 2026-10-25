// Builds the fabric textures the /room-lab 3D models use, from the real catalog swatches.
//
//   node scripts/room-lab/build-fabrics.mjs
//
// For each pick below it reads the public catalog (the same public_catalog() function the product pages use: display names and
// pictures only, never supplier data), checks the supplier code still has the display name we expect, downloads the swatch picture
// from the public `swatches` bucket, cuts a flat piece of fabric out of it and writes
//   public/room-lab/fabrics/<key>.webp   a 256 px texture (committed, served from our own site: no request to Supabase)
//   src/room/fabrics.json                key, line, code, display name, average colour, physical size one texture covers (metres)
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (same as the site build). Not part of `npm run build`: the outputs are committed.
//
// Scale: a catalog swatch picture shows about 10 cm of cloth, so a piece cut from the middle covers `tile` metres (0.075 for a 75% crop).
// Zebra swatches are cut into one solid band over one sheer band (the band split is `split`), so a texture is one full stripe period.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!BASE || !KEY) { console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'); process.exit(1); }

const T = 0.075;                       // metres covered by a 75% centre crop of a swatch picture
// kind: 'weave' (a flat piece of cloth), 'zebra' (solid band rows + sheer band rows, see ZEBRA below)
const PICKS = [
  // Roller, light filtering (catalog family "solar", translucent)
  { key: 'rlf-soft-cream', scope: 'roller', code: 'YS205908', name: 'Soft Cream', tile: [T, T] },
  { key: 'rlf-fawn-beige', scope: 'roller', code: 'YS120002', name: 'Fawn Beige', tile: [T, T] },
  { key: 'rlf-mineral-gray', scope: 'roller', code: 'YS200804', name: 'Mineral Gray', tile: [T, T] },
  { key: 'rlf-blue', scope: 'roller', code: 'YS208608', name: 'Blue', crop: { left: 0, top: 0, width: 406, height: 360 }, tile: [T, T] },
  { key: 'rlf-iced-coffee', scope: 'roller', code: 'YS120004', name: 'Iced Coffee', tile: [T, T] },
  // Roller, solar (catalog family "screen-view"; 1 to 5% openness)
  { key: 'rsol-linen', scope: 'roller', code: 'XSS050M16', name: 'Linen', tile: [T, T] },
  { key: 'rsol-latte', scope: 'roller', code: 'YSS-L2-503', name: 'Latte', tile: [T, T] },
  { key: 'rsol-cement-gray', scope: 'roller', code: 'YSS-A12-106', name: 'Cement Gray', tile: [T, T] },
  { key: 'rsol-sterling-gray', scope: 'roller', code: 'YSS-L2-505', name: 'Sterling Gray', tile: [T, T] },
  { key: 'rsol-basalt-charcoal', scope: 'roller', code: 'WSS660864', name: 'Basalt Charcoal', tile: [T, T] },
  // Roller, blackout
  { key: 'rbo-plaster-white', scope: 'roller', code: 'YB203905', name: 'Plaster White', tile: [T, T] },
  { key: 'rbo-haze-gray', scope: 'roller', code: 'YB203504', name: 'Haze Gray', tile: [T, T] },
  { key: 'rbo-blue', scope: 'roller', code: 'YB208608', name: 'Blue', tile: [T, T] },
  { key: 'rbo-caramel-brown', scope: 'roller', code: 'YB202905', name: 'Caramel Brown', tile: [T, T] },
  { key: 'rbo-thunder-gray', scope: 'roller', code: 'YB200804', name: 'Thunder Gray', tile: [T, T] },
  // Curtains
  { key: 'cur-gossamer-white', scope: 'drapery', code: 'SP26029001', name: 'Gossamer White', tile: [T, T] },
  { key: 'cur-mushroom-beige', scope: 'drapery', code: 'SP26029003', name: 'Mushroom Beige', tile: [T, T] },
  { key: 'cur-granola-beige', scope: 'drapery', code: 'SP26015008', name: 'Granola Beige', tile: [T, T] },
  { key: 'cur-anchor-gray', scope: 'drapery', code: 'SP26003005', name: 'Anchor Gray', tile: [T, T] },
  { key: 'cur-cedar-brown', scope: 'drapery', code: 'SP26030009', name: 'Cedar Brown', tile: [T, T] },
];

// Zebra: rows (in the swatch picture) of one solid band and the sheer band under it, measured from the pictures.
const ZEBRA = [
  { key: 'zeb-cream', code: 'YZB202', name: 'Cream', solid: [172, 328], sheer: [352, 548] },
  { key: 'zeb-camel-khaki', code: 'YZB5003', name: 'Camel Khaki', solid: [228, 402], sheer: [425, 540] },
  { key: 'zeb-platinum-gray', code: 'YZB5004', name: 'Platinum Gray', solid: [306, 434], sheer: [206, 290] },
  { key: 'zeb-cinnamon-latte', code: 'YZB5005', name: 'Cinnamon Latte', solid: [320, 455], sheer: [222, 300] },
  { key: 'zeb-tuxedo-black', code: 'YZB5006', name: 'Tuxedo Black', solid: [322, 456], sheer: [222, 302] },
];
const SPLIT = 0.6;                      // share of a zebra texture that is the solid band
const ZEBRA_TILE = [0.16, 0.17];        // metres: texture width, one full period (solid + sheer band) height

const rpc = async (scope) => {
  const r = await fetch(`${BASE}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${scope}}`)}&apikey=${KEY}`);
  if (!r.ok) throw new Error(`catalog ${scope}: ${r.status}`);
  return r.json();
};
const find = (rows, code) => rows.flatMap((f) => f.swatches || []).find((s) => s.supplier_code === code);
const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
// A swatch photo is lit unevenly (a bright corner, a shadow). Repeating it would show a grid of light patches, so take out the slow
// brightness changes (subtract a blurred copy, add back the average colour) and keep the weave.
async function flatten(buf, size = 256) {
  const pad = 64;                                          // mirror the picture outwards first, so the blur has no dark or light rim at the edges
  const ext = await sharp(buf).extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: 'mirror' }).png().toBuffer();
  const big = size + 2 * pad;
  const { data: a } = await sharp(ext).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: b } = await sharp(ext).removeAlpha().blur(size / 14).raw().toBuffer({ resolveWithObject: true });
  const mean = [0, 0, 0];
  for (let y = pad; y < pad + size; y++) for (let x = pad; x < pad + size; x++) for (let c = 0; c < 3; c++) mean[c] += b[(y * big + x) * 3 + c];
  for (let c = 0; c < 3; c++) mean[c] /= size * size;
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) {
    const i = ((y + pad) * big + x + pad) * 3 + c;
    out[(y * size + x) * 3 + c] = Math.max(0, Math.min(255, a[i] - b[i] + mean[c]));
  }
  return sharp(out, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}
const cache = {};
const picture = async (scope, code, name) => {
  cache[scope] ||= await rpc(scope);
  const sw = find(cache[scope], code);
  if (!sw) throw new Error(`${code} is not in the ${scope} catalog any more`);
  if (sw.display_name !== name) throw new Error(`${code} is now called "${sw.display_name}" (expected "${name}")`);
  const url = `${BASE}/storage/v1/object/public/swatches/${sw.image_path.split('/').map(encodeURIComponent).join('/')}`;
  return { buf: Buffer.from(await (await fetch(url)).arrayBuffer()), sw };
};

mkdirSync('public/room-lab/fabrics', { recursive: true });
const out = {};
const meanColor = async (buf) => { const { channels } = await sharp(buf).stats(); return toHex(channels[0].mean, channels[1].mean, channels[2].mean); };

for (const p of PICKS) {
  const { buf } = await picture(p.scope, p.code, p.name);
  const meta = await sharp(buf).metadata();
  let region = p.crop;
  if (!region) {                                           // 75% centre square
    const side = Math.floor(Math.min(meta.width, meta.height) * 0.75);
    region = { left: Math.floor((meta.width - side) / 2), top: Math.floor((meta.height - side) / 2), width: side, height: side };
  }
  const tex = await flatten(await sharp(buf).extract(region).resize({ width: 256, height: 256, fit: 'fill' }).toBuffer());
  await sharp(tex).webp({ quality: 80 }).toFile(`public/room-lab/fabrics/${p.key}.webp`);
  out[p.key] = { kind: 'weave', line: p.scope, code: p.code, name: p.name, color: await meanColor(tex), tile: p.tile };
  console.log(p.key, out[p.key].color);
}

for (const z of ZEBRA) {
  const { buf } = await picture('zebra', z.code, z.name);
  const meta = await sharp(buf).metadata();
  const x0 = Math.floor(meta.width * 0.12), cw = Math.floor(meta.width * 0.76);
  const band = async ([a, b], h) => sharp(buf).extract({ left: x0, top: a, width: cw, height: b - a }).resize({ width: 256, height: h, fit: 'fill' }).toBuffer();
  const sh = Math.round(256 * SPLIT);
  const solid = await band(z.solid, sh);
  const sheer = await band(z.sheer, 256 - sh);
  const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#fff' } }).composite([{ input: solid, top: 0, left: 0 }, { input: sheer, top: sh, left: 0 }]).png().toBuffer();
  await sharp(tile).webp({ quality: 80 }).toFile(`public/room-lab/fabrics/${z.key}.webp`);
  out[z.key] = { kind: 'zebra', line: 'zebra', code: z.code, name: z.name, color: await meanColor(solid), sheerColor: await meanColor(sheer), tile: ZEBRA_TILE, split: SPLIT };
  console.log(z.key, out[z.key].color);
}
writeFileSync('src/room/fabrics.json', JSON.stringify(out, null, 1) + '\n');
