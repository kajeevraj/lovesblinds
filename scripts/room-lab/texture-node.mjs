// Makes the 256 px 3D fabric texture for one swatch picture, in Node (sharp). Same steps as src/room/textureBrowser.js; the maths is in src/room/textureCore.js.
//   const webp = await makeTextureWebp(imageBuffer, 'weave' | 'zebra')   -> Buffer (WebP), or throws
import sharp from 'sharp';
import { TEX, SPLIT, flatten, findBands } from '../../src/room/textureCore.js';

export async function makeTextureWebp(buf, kind) {
  const base = sharp(buf).rotate().removeAlpha();
  const meta = await base.clone().metadata();
  const { width: W, height: H } = meta.autoOrient ? { width: meta.autoOrient.width, height: meta.autoOrient.height } : meta;
  if (kind === 'zebra') {
    const x0 = Math.floor(W * 0.15), cw = Math.floor(W * 0.7);
    const strip = await base.clone().extract({ left: x0, top: 0, width: cw, height: H }).resize({ width: 16, height: H, fit: 'fill' }).greyscale().raw().toBuffer();
    const lum = new Float32Array(H);
    for (let y = 0; y < H; y++) { let t = 0; for (let x = 0; x < 16; x++) t += strip[y * 16 + x]; lum[y] = t / 16; }
    const bands = findBands(lum);
    const sh = Math.round(TEX * SPLIT);
    const piece = (rows, h) => base.clone().extract({ left: x0, top: rows[0], width: cw, height: Math.max(2, rows[1] - rows[0]) }).resize({ width: TEX, height: h, fit: 'fill' }).png().toBuffer();
    let solid, sheer;
    if (bands) {
      solid = await piece(bands.solid, sh);
      sheer = bands.sheer ? await piece(bands.sheer, TEX - sh) : await sharp({ create: { width: TEX, height: TEX - sh, channels: 3, background: '#f4f2ee' } }).png().toBuffer();
    } else {                                                           // no clear stripes: the middle of the picture as cloth, and a pale sheer band
      solid = await piece([Math.floor(H * 0.2), Math.floor(H * 0.8)], sh);
      sheer = await sharp({ create: { width: TEX, height: TEX - sh, channels: 3, background: '#f4f2ee' } }).png().toBuffer();
    }
    return sharp({ create: { width: TEX, height: TEX, channels: 3, background: '#fff' } }).composite([{ input: solid, top: 0, left: 0 }, { input: sheer, top: sh, left: 0 }]).webp({ quality: 80 }).toBuffer();
  }
  const side = Math.floor(Math.min(W, H) * 0.75);
  const raw = await base.clone().extract({ left: Math.floor((W - side) / 2), top: Math.floor((H - side) / 2), width: side, height: side }).resize({ width: TEX, height: TEX, fit: 'fill' }).raw().toBuffer();
  const flat = flatten(raw);
  return sharp(Buffer.from(flat.buffer), { raw: { width: TEX, height: TEX, channels: 3 } }).webp({ quality: 80 }).toBuffer();
}
