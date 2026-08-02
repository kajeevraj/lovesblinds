// Swatch + product-photo resolution with graceful fallback.
// Replaces the mock `hasPhotoForCombo` in data.js.
//
// The whole point: the site must look complete even though you don't have
// every image yet. Every lookup degrades gracefully instead of breaking.

// ---- Swatches (the little fabric color chips in the picker) -------------
// A color always renders: if the real fabric crop exists, use it; otherwise
// fall back to the name-derived hex chip. Nothing is ever blank.
export function swatchImage(color) {
  return color?.swatch || null;           // e.g. "/swatches/zebra/YZB3304.jpg"
}
export function swatchColor(color) {
  return color?.hex || "#CFC8BA";         // always defined
}

// ---- Product / room photos (the big image that updates on color pick) ---
// Resolution order, most specific -> least. Drop a file at ANY level and it
// wins automatically; you can AI-generate at whatever granularity you like.
//
//   /products/<category>/<code>__<mech>__<mount>.jpg   most specific
//   /products/<category>/<code>__<mech>.jpg
//   /products/<category>/<code>.jpg                    per-color (typical)
//   /products/<category>/_placeholder.jpg              category placeholder
//
// We can't stat files in the browser, so we rely on a generated manifest of
// which images actually exist (build it with scripts/build_photo_manifest.js).
import PHOTO_MANIFEST from "../data/photoManifest.js"; // { "zebra/YZB3304.jpg": true, ... }

const exists = (path) => !!PHOTO_MANIFEST[path.replace(/^\/products\//, "")];

export function productPhoto(category, code, mechId, mountId) {
  const candidates = [
    `/products/${category}/${code}__${mechId}__${mountId}.jpg`,
    `/products/${category}/${code}__${mechId}.jpg`,
    `/products/${category}/${code}.jpg`,
    `/products/${category}/_placeholder.jpg`,
  ];
  for (const c of candidates) {
    if (c.endsWith("_placeholder.jpg") || exists(c)) return c;
  }
  return "/products/_placeholder.jpg";
}

// Convenience for the "does a real (non-placeholder) photo exist?" badge in admin.
export function hasRealPhoto(category, code, mechId, mountId) {
  return (
    exists(`/products/${category}/${code}__${mechId}__${mountId}.jpg`) ||
    exists(`/products/${category}/${code}__${mechId}.jpg`) ||
    exists(`/products/${category}/${code}.jpg`)
  );
}
