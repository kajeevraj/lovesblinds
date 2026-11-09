// How opaque a see-through shade (a Screen view roller) is drawn, by its color. The product's base opacity (data.js, 0.72 for screen view) is how much of a
// LIGHT cloth you look through to the bright window behind. A dark mesh does not let the window wash it out: from inside the room it still reads dark, so the
// darker the cloth, the more opaque it is drawn (a near-black screen is about 97 % opaque, a white one keeps the product's 72 %). Pure, so it is tested offline.
export function screenOpacity(base, hex) {
  if (!(base < 1) || !/^#[0-9a-fA-F]{6}$/.test(hex || '')) return base;
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), lum = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
  return Math.min(1, 1 - (1 - base) * lum ** 1.5);
}
