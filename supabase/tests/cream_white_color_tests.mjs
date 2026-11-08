// The cream / white fix (src/lib/swatchColor.js), no browser:
//  - the minimum warm tint never makes a color warmer than its own photo: it is only used when the photo is near-neutral grey; a photo with a color of
//    its own keeps its hue and saturation and only its lightness moves;
//  - White and Cream have a saturation cap so they read as soft off-whites, never yellow;
//  - Soft Cream and Pale Cream (the two reported) are no longer yellow compared with their photos.
import { deriveHex, chromaOf, lightnessOf, rgbOf, colorDistance, hexOf, NEUTRAL_C, FAMILY_LOOK } from '../../src/lib/swatchColor.js';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const N = 32 * 32, flat = (c) => { const a = new Uint8ClampedArray(N * 3); for (let i = 0; i < N; i++) a.set(c, i * 3); return a; };
const hue = (hex) => { const c = rgbOf(hex), lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = c.map(lin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883, f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return (Math.atan2(200 * (f(Y) - f(Z)), 500 * (f(X) - f(Y))) * 180 / Math.PI + 360) % 360; };
const rng = (seed) => { let a = seed; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// 1. the two reported colors: their real photo averages (Soft Cream #ddd8d6, Pale Cream #e5dfdb) are near-neutral greys
const soft = deriveHex(flat(rgbOf('#ddd8d6')), 'Cream/Ivory'), pale = deriveHex(flat(rgbOf('#e5dfdb')), 'Cream/Ivory');
check('Soft Cream: a soft off-white, no longer yellow (chroma <= 9; it was #f0e2cc, chroma 14), and close to its photo (distance <= 8)', chromaOf(soft) <= 9 && colorDistance(soft, '#ddd8d6') <= 8, `${soft} chroma ${chromaOf(soft).toFixed(1)} distance ${colorDistance(soft, '#ddd8d6').toFixed(1)}`);
check('Pale Cream: a soft off-white, no longer yellow (chroma <= 9; it was #f3e5cf), and close to its photo (distance <= 8)', chromaOf(pale) <= 9 && colorDistance(pale, '#e5dfdb') <= 8, `${pale} chroma ${chromaOf(pale).toFixed(1)} distance ${colorDistance(pale, '#e5dfdb').toFixed(1)}`);
check('a cream is still a cream: still warmer than a white (chroma above 4), hue yellow-ish (70 to 110 degrees)', chromaOf(soft) > 4 && hue(soft) > 60 && hue(soft) < 115, `${hue(soft).toFixed(0)}°`);

// 2. never warmer than the photo: random photos WITH a color of their own (chroma >= NEUTRAL_C) in every family; chroma of the result <= the photo's (+0.6),
//    and for the families without a chroma cap the hue stays the photo's own
const r = rng(7), fams = Object.keys(FAMILY_LOOK).filter((f) => f !== 'Pattern/Multi'), bad = [];
let n = 0;
for (let k = 0; k < 600; k++) {
  const fam = fams[k % fams.length], L0 = 40 + r() * 58, h = r() * 2 * Math.PI, C0 = NEUTRAL_C + 0.5 + r() * 14;
  // make a photo of Lab(L0, C0, h) by searching a gamut-safe rgb: start from grey and push
  const target = (() => { const g = Math.round(L0 * 2.2); const base = [g, g, g]; return base.map((v, i) => Math.max(0, Math.min(255, v + [Math.cos(h) * C0 * 1.1, Math.sin(h) * C0 * 1.1 - Math.cos(h) * C0 * 0.5, -Math.sin(h) * C0 * 1.6][i]))); })();
  const photo = hexOf(target), cp = chromaOf(photo);
  if (cp < NEUTRAL_C) continue;
  const out = deriveHex(flat(target), fam); n++;
  if (chromaOf(out) > cp + 0.6) bad.push(`${fam} photo ${photo} (C ${cp.toFixed(1)}) -> ${out} (C ${chromaOf(out).toFixed(1)})`);
  else if (!FAMILY_LOOK[fam].maxC && cp > 6 && chromaOf(out) > 3 && Math.abs(((hue(out) - hue(photo) + 540) % 360) - 180) > 12 && FAMILY_LOOK[fam].chroma >= 30) bad.push(`${fam} hue moved ${photo} -> ${out}`);
}
check(`a photo with a color of its own is never made warmer (chroma never above the photo's) in any family: ${n} random photos`, bad.length === 0, bad.slice(0, 4).join(' | '));
// the explicit cases
const creamPhoto = '#eee4d0', creamOut = deriveHex(flat(rgbOf(creamPhoto)), 'Cream/Ivory');
check('a cream photo with its own color keeps its hue (within 8 degrees) and does not gain saturation', Math.abs(hue(creamOut) - hue(creamPhoto)) <= 8 && chromaOf(creamOut) <= chromaOf(creamPhoto) + 0.6, `${creamPhoto} -> ${creamOut}`);
const darkCream = deriveHex(flat(rgbOf('#c9bfa8')), 'Cream/Ivory');
check('a darker cream photo only gets lighter (lightness moves into the cream band; hue kept, chroma not increased)', lightnessOf(darkCream) > lightnessOf('#c9bfa8') && chromaOf(darkCream) <= chromaOf('#c9bfa8') + 0.6 && Math.abs(hue(darkCream) - hue('#c9bfa8')) <= 8, `${'#c9bfa8'} -> ${darkCream}`);
const beigePhoto = deriveHex(flat(rgbOf('#b8ab94')), 'Beige/Tan');
check('a beige whose photo has some color keeps it (no extra tint added)', chromaOf(beigePhoto) <= chromaOf('#b8ab94') + 0.6, `${beigePhoto}`);
// the tint is only for near-neutral photos
const greyPhoto = deriveHex(flat([226, 226, 226]), 'Cream/Ivory'), tinted = deriveHex(flat(rgbOf('#e3dfd8')), 'Cream/Ivory');
check('only a near-neutral grey photo gets the minimum warm tint (a grey cream is still creamy); a photo that already has a little color keeps its own', chromaOf(greyPhoto) >= 5 && chromaOf(greyPhoto) <= 9 && chromaOf(tinted) <= chromaOf('#e3dfd8') + 0.6, `${greyPhoto} / ${tinted}`);
check('a near-neutral photo in the White family is not tinted at all (stays neutral, soft white)', chromaOf(deriveHex(flat([200, 200, 200]), 'White')) <= 1.2);

// 3. saturation caps
const caps = { White: 4.4, 'Cream/Ivory': 11.5 }, capBad = [];
for (const fam of Object.keys(caps)) for (let k = 0; k < 200; k++) { const c = [200 + r() * 55, 190 + r() * 60, 150 + r() * 100], out = deriveHex(flat(c), fam); if (chromaOf(out) > caps[fam]) capBad.push(`${fam} ${hexOf(c)} -> ${out} C ${chromaOf(out).toFixed(1)}`); }
check('White never exceeds chroma 4 and Cream never exceeds 11 (plus up to 0.5 for rounding to 8-bit colors), however colorful the photo (400 photos)', capBad.length === 0, capBad.slice(0, 3).join(' | '));
check('a bright yellow photo in the White family comes out as a soft white, not yellow', chromaOf(deriveHex(flat([250, 240, 170]), 'White')) <= 4.2 && lightnessOf(deriveHex(flat([250, 240, 170]), 'White')) >= 92);
check('a yellow photo in the Cream family comes out a soft cream (chroma <= 11.3), not yellow', chromaOf(deriveHex(flat([245, 230, 150]), 'Cream/Ivory')) <= 11.3);
const bad2 = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad2.length}/${results.length} passed${bad2.length ? ` | FAILED: ${bad2.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad2.length ? 1 : 0);
