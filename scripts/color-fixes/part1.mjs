// Color fixes part 1 (the phase 1 review): see scripts/apply-color-fixes.mjs. Already applied to live (manifest in docs/go-live-manifests/).
export const FIXES = [
  { name: 'Ash Gray', code: 'WSS660105', line: 'roller', set: { color_family: 'Gray' }, expect: { color_family: 'White' } },
  { name: 'Granite Gray', code: 'WSS360105', line: 'roller', set: { color_family: 'Gray' }, expect: { color_family: 'White' } },
  { name: 'Shadow Gray', code: 'YSS-A12-103', line: 'roller', set: { color_family: 'Gray' }, expect: { color_family: 'White' } },
  { name: 'White Slate', code: 'WSS481277', line: 'roller', set: { color_family: 'Gray' }, expect: { color_family: 'White' } },
  { name: 'Salt White', code: 'SP26027008', line: 'drapery', set: { preview_color: '#efede9', texture_mode: 'pattern', weave: 'voile' }, expect: { color_family: 'White' } },
  { name: 'Bark Brown', code: 'YSS-T12-305', line: 'roller', set: { preview_color: '#4a3829' }, expect: { color_family: 'Brown' } },
  { name: 'Cocoa Chocolate', code: 'XSS000539', line: 'roller', set: { preview_color: '#4a3223' }, expect: { color_family: 'Brown' } },
  { name: 'Dark Chocolate', code: 'YZB2008', line: 'zebra', set: { preview_color: '#4b3626' }, expect: { color_family: 'Brown' } },
  { name: 'Bittersweet Chocolate', code: 'YZB3007', line: 'zebra', set: { preview_color: '#523927' }, expect: { color_family: 'Brown' } },
];
