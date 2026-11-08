// The fabric texture steps in Node (sharp): the same functions the browser runs (src/lib/textureAnalysis.js, src/room/textureCore.js), so the backfill and the
// review report decide exactly what the admin upload decides.
//   const { rgb, w, h } = await decodePhoto(buffer)            the full photo as RGB bytes (longest side <= 1000, like the admin's full image)
//   const { webp, analysis } = await makeTextureWebp(buffer)    the 256 px seamless Photo-crop texture and what the analysis said ('photo' | 'pattern')
import sharp from 'sharp';
import { TEX, photoCropTexture } from '../../src/room/textureCore.js';
import { analyzePhoto } from '../../src/lib/textureAnalysis.js';

export async function decodePhoto(buf, max = 1000) {
  const { data, info } = await sharp(buf).rotate().removeAlpha().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  return { rgb: new Uint8ClampedArray(data), w: info.width, h: info.height };
}

export async function makeTextureWebp(buf) {
  const { rgb, w, h } = await decodePhoto(buf), analysis = analyzePhoto(rgb, w, h);
  const tex = photoCropTexture(rgb, w, h, analysis.rect);
  const webp = await sharp(Buffer.from(tex.buffer, tex.byteOffset, tex.byteLength), { raw: { width: TEX, height: TEX, channels: 3 } }).webp({ quality: 80 }).toBuffer();
  return { webp, analysis };
}
