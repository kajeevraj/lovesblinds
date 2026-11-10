// Color fixes part 4: remove the preview color overrides set in part 1 on the two chocolate zebras. They made Dark Chocolate (#4b3626) and Bittersweet Chocolate (#523927) too light
// and too warm: with no override the preview color is the photo's own solid band (src/lib/textureType.js zebraColors), as dark and as cool as the photo.
//   node scripts/apply-color-fixes.mjs --fixes part4            dry run
//   node scripts/apply-color-fixes.mjs --fixes part4 --apply    writes, with a manifest to undo
export const FIXES = [
  { name: 'Dark Chocolate', code: 'YZB2008', line: 'zebra', set: { preview_color: null }, expect: { preview_color: '#4b3626' } },
  { name: 'Bittersweet Chocolate', code: 'YZB3007', line: 'zebra', set: { preview_color: null }, expect: { preview_color: '#523927' } },
];
