// Color fixes part 2: White colors whose photo shows another family. Run with:  node scripts/apply-color-fixes.mjs --fixes part2   (dry run), then --apply.
// Only the color family changes. A color's preview color is left empty: with its new family the tile lands within 7.3 color distance of its photo (checked
// against every photo), so none needs an override. Bronze (roller, WSS385858) is deliberately NOT in this list: it is on hold for the owner's decision.
const W = { color_family: 'White' };
const to = (family) => ({ color_family: family });
export const FIXES = [
  // -> Gray
  { name: 'Tundra White', code: 'YZB901', line: 'zebra', set: to('Gray'), expect: W },
  { name: 'Tundra White', code: 'WSS380192', line: 'roller', set: to('Gray'), expect: W },
  { name: 'Platinum Gray', code: 'XSS000105', line: 'roller', set: to('Gray'), expect: W },
  { name: 'White Gray', code: 'YB204304', line: 'roller', set: to('Gray'), expect: W },
  { name: 'Dove White', code: 'YZB1001', line: 'zebra', set: to('Gray'), expect: W },
  // -> Cream/Ivory
  { name: 'Off-white', code: 'YZB501', line: 'zebra', set: to('Cream/Ivory'), expect: W },
  { name: 'Sunbeam Yellow', code: 'YSLM602', line: 'shangri-la', set: to('Cream/Ivory'), expect: W },
  { name: 'Breeze White', code: 'SP26049006', line: 'drapery', set: to('Cream/Ivory'), expect: W },
  { name: 'Whisper White', code: 'SP26004001', line: 'drapery', set: to('Cream/Ivory'), expect: W },
  { name: 'Wisp White', code: 'SP26041001', line: 'drapery', set: to('Cream/Ivory'), expect: W },
  { name: 'Porcelain White', code: 'SP26003001', line: 'drapery', set: to('Cream/Ivory'), expect: W },
  { name: 'White Linen', code: 'YHCK002', line: 'cellular', set: to('Cream/Ivory'), expect: W },          // the warm beige one (light-filtering); the cooler blackout White Linen YHCKB002 stays
  { name: 'Powder White', code: 'ZDS3008-2', line: 'dream-curtains', set: to('Cream/Ivory'), expect: W },
  // -> Pattern/Multi
  { name: 'Clean White', code: 'SP26060003', line: 'drapery', set: to('Pattern/Multi'), expect: W },
  { name: 'Crisp White', code: 'SP26060001', line: 'drapery', set: to('Pattern/Multi'), expect: W },
  { name: 'Pristine White', code: 'SP26060002', line: 'drapery', set: to('Pattern/Multi'), expect: W },
  { name: 'Moonbeam White', code: 'SP26062005', line: 'drapery', set: to('Pattern/Multi'), expect: W },
  { name: 'Milk White', code: 'SP26010002', line: 'drapery', set: to('Pattern/Multi'), expect: W },
  { name: 'Pinstripe', code: 'XS140004', line: 'roller', set: to('Pattern/Multi'), expect: W },
];
