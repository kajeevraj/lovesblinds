// The picture maths behind the fabric textures (src/room/textureCore.js), no browser: a catalog photo is re-centred on the swatch's real color
// and its contrast capped, so a supplier macro photo (white weft on black averages grey) still reads as its real color at normal size.
import { retarget, retargetZebra, TEX } from '../../src/room/textureCore.js';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const stats = (rgb) => { const n = rgb.length / 3, m = [0, 0, 0]; for (let i = 0; i < rgb.length; i += 3) for (let c = 0; c < 3; c++) m[c] += rgb[i + c] / n; let v = 0; for (let i = 0; i < rgb.length; i += 3) { const l = 0.3 * rgb[i] + 0.59 * rgb[i + 1] + 0.11 * rgb[i + 2] - (0.3 * m[0] + 0.59 * m[1] + 0.11 * m[2]); v += l * l / n; } return { mean: m, sd: Math.sqrt(v) }; };
// the Jet Black photo: thin white threads on black (mean ~ 132 grey, sd ~ 74)
const photo = new Uint8ClampedArray(TEX * TEX * 3); for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) { const v = y % 20 < 10 ? 235 : 30; for (let c = 0; c < 3; c++) photo[(y * TEX + x) * 3 + c] = v + (c === 2 ? 6 : 0); }
const before = stats(photo);
check('set-up: the supplier-style photo averages light grey with a very strong stripe', before.mean[0] > 100 && before.mean[0] < 160 && before.sd > 60, JSON.stringify({ mean: before.mean.map(Math.round), sd: Math.round(before.sd) }));
const black = stats(retarget(photo, [59, 58, 60]));
check('Jet Black: the texture\'s average color is the swatch\'s real color (within 1 level of #3b3a3c)', black.mean.every((m, i) => Math.abs(m - [59, 58, 60][i]) <= 1), black.mean.map(Math.round).join(','));
check('its contrast is capped (sd <= 16) so no stripe pattern can alias into moire at small sizes', black.sd <= 16.5, String(Math.round(black.sd)));
const white = stats(retarget(photo, [218, 214, 206]));
check('a white lands on its color too, and the texture stays inside 0..255 (no clipping of the weave)', white.mean.every((m, i) => Math.abs(m - [218, 214, 206][i]) <= 2), white.mean.map(Math.round).join(','));
const flat = new Uint8ClampedArray(TEX * TEX * 3).fill(120); const f2 = stats(retarget(flat, [150, 150, 150]));
check('a flat photo is shifted to the target without adding any pattern', f2.sd < 0.5 && Math.abs(f2.mean[0] - 150) <= 1);
const mild = new Uint8ClampedArray(TEX * TEX * 3); for (let i = 0; i < mild.length; i++) mild[i] = 100 + ((i / 3 | 0) % 7) * 2; const m2 = stats(mild), m3 = stats(retarget(mild, [100, 100, 100]));
check('a gentle weave keeps its full contrast (the cap only applies to strong patterns)', Math.abs(m3.sd - m2.sd) < 0.8, `${m2.sd.toFixed(1)} -> ${m3.sd.toFixed(1)}`);
// a zebra picture lit unevenly (a dark vertical bar across the solid band) must not repeat as dark bars
const zeb = new Uint8ClampedArray(TEX * TEX * 3); const solidRows = Math.round(TEX * 0.6);
for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) { const shade = y < solidRows ? 210 - 60 * Math.exp(-((x - 128) ** 2) / 600) : 250; for (let c = 0; c < 3; c++) zeb[(y * TEX + x) * 3 + c] = shade; }
const zt = retargetZebra(zeb, [200, 196, 188]); const col = (x) => { let t = 0; for (let y = 0; y < solidRows; y++) t += zt[(y * TEX + x) * 3]; return t / solidRows; };
check('a zebra: the left-to-right lighting is taken out of the solid band (center vs edge within 6 levels, was 60)', Math.abs(col(128) - col(10)) < 6, `${col(128).toFixed(1)} vs ${col(10).toFixed(1)}`);
check('a zebra: the solid band lands on the target color; the sheer band is kept light', Math.abs(col(60) - 200) < 3 && zt[((solidRows + 20) * TEX + 60) * 3] > 235);
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
