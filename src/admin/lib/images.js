// Photo handling in the browser: one upload becomes a full image (longest side 1000 px, JPEG) and a 320 px square
// WebP thumbnail (cropped to fill, like the thumbnails already on the site). Both go to the "swatches" bucket under
// unique names, so a replacement never shows a stale copy from the 24-hour cache.
import { supabase } from '../../lib/supabase.js';

export const BUCKET = 'swatches';
const FULL_MAX = 1000, FULL_QUALITY = 0.88, THUMB_PX = 320, THUMB_QUALITY = 0.62;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

const toBlob = (canvas, type, q) => new Promise((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process this photo.'))), type, q));

export async function prepareImage(file) {
  if (!file) throw new Error('Choose a photo first.');
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Please choose a JPG, PNG or WebP photo.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That photo is larger than 25 MB. Please choose a smaller one.');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('That file could not be read as a photo. Try another one.'); }
  const { width: w, height: h } = bmp;
  if (Math.min(w, h) < 200) throw new Error('That photo is too small. Please use one at least 200 px on its short side.');

  // full image: scale down only
  const scale = Math.min(1, FULL_MAX / Math.max(w, h));
  const fc = document.createElement('canvas');
  fc.width = Math.round(w * scale); fc.height = Math.round(h * scale);
  const fx = fc.getContext('2d');
  fx.fillStyle = '#fff'; fx.fillRect(0, 0, fc.width, fc.height);       // PNGs with transparency become white, not black
  fx.drawImage(bmp, 0, 0, fc.width, fc.height);
  const full = await toBlob(fc, 'image/jpeg', FULL_QUALITY);

  // thumbnail: square, cropped to fill
  const tc = document.createElement('canvas');
  tc.width = THUMB_PX; tc.height = THUMB_PX;
  const tx = tc.getContext('2d', { willReadFrequently: true });
  const side = Math.min(w, h);
  tx.fillStyle = '#fff'; tx.fillRect(0, 0, THUMB_PX, THUMB_PX);
  tx.drawImage(bmp, (w - side) / 2, (h - side) / 2, side, side, 0, 0, THUMB_PX, THUMB_PX);
  let thumb = await toBlob(tc, 'image/webp', THUMB_QUALITY);
  if (thumb.type !== 'image/webp') thumb = await toBlob(tc, 'image/jpeg', 0.8);     // very old browsers cannot encode WebP
  bmp.close?.();
  const px = tx.getImageData(0, 0, THUMB_PX, THUMB_PX);
  return { full, thumb, previewUrl: URL.createObjectURL(thumb), pixels: { data: px.data, width: THUMB_PX, height: THUMB_PX } };
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'color';
const rand = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 10) : Math.random().toString(36).slice(2, 12));
const extOf = (blob) => (blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg');

// Uploads a prepared photo; returns the two storage paths. Throws with the storage error message.
export async function uploadPrepared(line, code, prepared) {
  const name = `${slug(code)}-${rand()}`;
  const imagePath = `full/${line}/${name}.${extOf(prepared.full)}`;
  const thumbPath = `thumb/${line}/${name}.${extOf(prepared.thumb)}`;
  const opts = (blob) => ({ cacheControl: '86400', contentType: blob.type, upsert: false });
  const a = await supabase.storage.from(BUCKET).upload(imagePath, prepared.full, opts(prepared.full));
  if (a.error) throw a.error;
  const b = await supabase.storage.from(BUCKET).upload(thumbPath, prepared.thumb, opts(prepared.thumb));
  if (b.error) { await removePaths([imagePath]); throw b.error; }
  return { image_path: imagePath, thumb_path: thumbPath };
}

// Best effort: a leftover file is harmless, so failures are only logged.
export async function removePaths(paths) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(list);
  if (error) console.warn('[admin] could not remove old images', list, error.message);
}
