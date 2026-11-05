// The color a fabric shows as (src/lib/swatchColor.js), no browser: an admin override wins; otherwise the swatch's own picture is placed inside
// its color family, so two greys differ, Jet Black stays black, a white stays white (not cream) and a cream stays cream.
import { deriveHex, previewHex, familyHex, rgbOf, lumaOf, colorDistance, FAMILY_LOOK, isHex } from '../../src/lib/swatchColor.js';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const N = 64 * 64;
// a flat picture of one color, and the supplier-style striped macro (white weft on a black body)
const flat = (c) => { const a = new Uint8ClampedArray(N * 3); for (let i = 0; i < N; i++) a.set(c, i * 3); return a; };
const stripes = (body, thread, share = 0.28) => { const a = new Uint8ClampedArray(N * 3); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) a.set(y % 10 < Math.round(10 * share) ? thread : body, (y * 64 + x) * 3); return a; };
const sat = (hex) => { const c = rgbOf(hex), L = lumaOf(c); return Math.max(...c.map((v) => Math.abs(v - L))); };

const jet = deriveHex(stripes([34, 35, 40], [236, 236, 238]), 'Charcoal/Black');
check('Jet Black (white weft on black, the picture averages grey 100+) stays black: lightness <= 56 and nearly neutral', lumaOf(rgbOf(jet)) <= 56 && sat(jet) <= 5, jet);
const jetFlatGrey = deriveHex(flat([133, 135, 142]), 'Charcoal/Black');
check('even a plain mid-grey photo in the Black family cannot come out lighter than the black band allows', lumaOf(rgbOf(jetFlatGrey)) <= 57, jetFlatGrey);
const whiteFromGrey = deriveHex(flat([189, 189, 189]), 'White');
check('a white whose photo is mid-grey (189) still reads as white: lightness >= 236 and no cream tint (R-B <= 4)', lumaOf(rgbOf(whiteFromGrey)) >= 235 && Math.abs(rgbOf(whiteFromGrey)[0] - rgbOf(whiteFromGrey)[2]) <= 4, whiteFromGrey);
const whiteCreamy = deriveHex(flat([240, 228, 205]), 'White');
check('a white whose photo is warm cannot turn cream (tint capped to 4 levels)', sat(whiteCreamy) <= 4.5, whiteCreamy);
const cream = deriveHex(flat([238, 228, 204]), 'Cream/Ivory');
check('a cream stays cream: warm (R - B >= 20)', rgbOf(cream)[0] - rgbOf(cream)[2] >= 20, cream);
const creamFromWhitePhoto = deriveHex(flat([240, 240, 240]), 'Cream/Ivory');
check('a Cream color with a near-white photo is still given its cream tint', rgbOf(creamFromWhitePhoto)[0] - rgbOf(creamFromWhitePhoto)[2] >= 15, creamFromWhitePhoto);
const g1 = deriveHex(flat([78, 77, 82]), 'Gray'), g2 = deriveHex(flat([188, 188, 193]), 'Gray'), g3 = deriveHex(flat([140, 140, 142]), 'Gray');
check('three different greys render as three clearly different colors (each pair more than 25 apart)', colorDistance(g1, g2) > 25 && colorDistance(g2, g3) > 10 && colorDistance(g1, g3) > 15, `${g1} ${g3} ${g2}`);
check('a grey stays grey: tint capped (every channel within 10 of its lightness)', [g1, g2, g3].every((h) => sat(h) <= 10.5));
const beige = deriveHex(flat([236, 236, 238]), 'Beige/Tan');
check('a Beige whose photo is nearly white or grey still reads beige: warm tint (R - B >= 18)', rgbOf(beige)[0] - rgbOf(beige)[2] >= 18, beige);
const dark = deriveHex(flat([121, 100, 75]), 'Beige/Tan');
check('a dark khaki keeps its own depth inside the Beige family (lightness 100 to 125)', lumaOf(rgbOf(dark)) > 95 && lumaOf(rgbOf(dark)) < 125, dark);
check('every family has a color of its own, and the family color is inside its own band', Object.keys(FAMILY_LOOK).every((f) => isHex(familyHex(f)) && lumaOf(rgbOf(familyHex(f))) >= FAMILY_LOOK[f].L[0] - 1 && lumaOf(rgbOf(familyHex(f))) <= FAMILY_LOOK[f].L[1] + 1));
check('the admin override wins as is (case folded); a bad override is ignored', previewHex('#AABBCC', '#112233', 'Gray') === '#aabbcc' && previewHex('blue', '#112233', 'Gray') === '#112233' && previewHex(null, null, 'Gray') === familyHex('Gray'));
check('without a picture the family color is used, and a unknown family still gets a color', deriveHex(new Uint8ClampedArray(0), 'Gray') === familyHex('Gray') && isHex(familyHex('Nope')));
check('colorDistance: the same color 0, black vs white about 100, 3 levels apart under 3', colorDistance('#808080', '#808080') === 0 && colorDistance('#000000', '#ffffff') > 95 && colorDistance('#808080', '#838383') < 3);
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
