// Color fixes part 3: Shangri-La colors whose texture is a photo crop. Their supplier photos are angled product shots (vanes and sheers in perspective), so the
// crop shows diagonal lines and creases that are not the cloth. They switch to the Pattern texture (a soft linen weave in the color's own preview color), like
// the other 17 Shangri-La colors. Only texture_mode changes; the color, family and photo are left alone.
//   node scripts/apply-color-fixes.mjs --fixes part3            dry run
//   node scripts/apply-color-fixes.mjs --fixes part3 --apply    writes, with a manifest to undo
const set = { texture_mode: 'pattern' }, expect = { texture_mode: 'photo' };
export const FIXES = [
  { name: 'Snow White', code: 'YSLH201', line: 'shangri-la', set, expect },
  { name: 'Lily White', code: 'YSLP601', line: 'shangri-la', set, expect },
  { name: 'Cream', code: 'YSLP102', line: 'shangri-la', set, expect },
  { name: 'Canary Yellow', code: 'YSLP1002', line: 'shangri-la', set, expect },
];
