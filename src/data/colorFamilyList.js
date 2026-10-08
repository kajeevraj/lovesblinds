// The color families, in display order. Shared by the build scripts, the validator and the picker.
export const COLOR_FAMILY_LIST = ['White', 'Cream/Ivory', 'Beige/Tan', 'Gray', 'Charcoal/Black', 'Brown', 'Blue', 'Green', 'Pink/Red', 'Purple', 'Pattern/Multi'];

// A color name that contains one of these words decides the family, before any image analysis.
// When a name has several (for example "White Grey"), the word that comes first wins.
export const NAME_WORDS = {
  white: 'White',
  ivory: 'Cream/Ivory', cream: 'Cream/Ivory',
  beige: 'Beige/Tan', tan: 'Beige/Tan', sand: 'Beige/Tan', khaki: 'Beige/Tan', latte: 'Beige/Tan',
  gray: 'Gray', grey: 'Gray', silver: 'Gray',
  charcoal: 'Charcoal/Black', black: 'Charcoal/Black',
  brown: 'Brown', coffee: 'Brown', chocolate: 'Brown',
  blue: 'Blue', navy: 'Blue',
  green: 'Green',
  pink: 'Pink/Red', red: 'Pink/Red',
  purple: 'Purple', lilac: 'Purple', mauve: 'Purple',
};

export function familyFromName(name) {
  if (!name) return null;
  const words = String(name).toLowerCase().match(/[a-z]+/g) || [];
  for (const w of words) if (NAME_WORDS[w]) return NAME_WORDS[w];
  return null;
}
