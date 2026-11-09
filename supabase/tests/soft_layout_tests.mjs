// The maths behind the Cellular, Roman and Shangri-La previews (src/room/softLayout.js, shadeKinds.js, lightCalibration.js). No browser, no network.
//   node supabase/tests/soft_layout_tests.mjs
const L = await import('../../src/room/softLayout.js');
const K = await import('../../src/room/shadeKinds.js');
const C = await import('../../src/room/lightCalibration.js');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const H = 64 * L.IN, W = 40 * L.IN;

// ---- Cellular ----
{
  const up0 = L.cellularLayout('standard', H, [0]), down = L.cellularLayout('standard', H, [1]), half = L.cellularLayout('standard', H, [0.5]);
  check('cellular: raised, it is a short neat bundle under the headrail (under 14 cm on a 64 in shade), with no cloth hanging open', up0.pb < 0.14 && up0.sections[0].ext < 1e-6, `stack ${(up0.pb * 100).toFixed(1)} cm`);
  check('cellular: lowered, the bottom rail is at the sill and every pleat hangs open', near(down.bottom[1], H, 1e-9) && down.sections[0].bundle < 1e-6 && near(down.sections[0].shown, down.N, 1e-6));
  check('cellular: the pleats are 3/4 in apart and the ones with no room are pressed into the bundle on the bottom rail', near(half.sections[0].ext, half.sections[0].shown * L.CELL.PITCH, 1e-9) && near(half.sections[0].bundle, half.sections[0].hidden * L.CELL.SQUASH, 1e-9) && near(half.sections[0].ext + half.sections[0].bundle, half.sections[0].bottom - half.sections[0].top, 1e-9));
  // top-down/bottom-up: two rails, each on its own
  const a = L.cellularLayout('top-down-bottom-up', H, [0.8, 0.2]), b = L.cellularLayout('top-down-bottom-up', H, [0.8, 0.5]), c = L.cellularLayout('top-down-bottom-up', H, [0.6, 0.2]);
  check('TDBU: moving the top rail leaves the bottom rail where it is, and the other way round', near(a.bottom[0], b.bottom[0]) && b.upper[0] > a.upper[0] + 0.1 && near(a.upper[0], c.upper[0]) && c.bottom[0] < a.bottom[0] - 0.1);
  check('TDBU: the cloth hangs from the top rail, on two cords from the headrail, and the glass above it is bare', near(a.sections[0].top, a.upper[1]) && a.cords && near(a.cords[1], a.upper[0]) && near(a.cover.top, a.upper[0]) && a.cover.top > L.CELL.HEAD_H + 0.1);
  const pushed = L.cellularLayout('top-down-bottom-up', H, [0.3, 0.7]);
  check('TDBU: the rails never cross (the cloth between them is at least its pressed bundle)', pushed.bottom[0] - pushed.upper[1] >= pushed.bundleAll - 1e-9 && pushed.sections[0].ext < 1e-6);
  for (const style of L.CELL_STYLES) for (const k of style === 'standard' ? [0] : [0, 1]) {
    const am = k === 0 ? [0.63, 0.1] : [0.9, 0.37], f = L.cellularHandle(style, H, am, k);
    check(`${style}: the handle of rail ${k} leads back to the same position`, near(L.cellularAmountAt(style, H, k, f), am[k], 1e-6), `${L.cellularAmountAt(style, H, k, f)}`);
  }
  // day & night
  const day = L.cellularLayout('day-night', H, K.DAY_NIGHT.day), night = L.cellularLayout('day-night', H, K.DAY_NIGHT.night);
  check('Day & Night, day: the day cloth (above the middle rail) covers the window and the blackout is pressed flat under it', near(day.sections[0].ext, day.F, 1e-6) && day.sections[1].ext < 1e-6 && near(day.bottom[1], H, 1e-9));
  check('Day & Night, night: the blackout (below the middle rail) covers the window and the day cloth is pressed flat under the headrail', near(night.sections[1].ext, night.F, 1e-6) && night.sections[0].ext < 1e-6 && near(night.bottom[1], H, 1e-9));
  check('Day & Night: one middle rail between the two cloths, and either cloth is long enough for the whole window', near(day.sections[0].bottom, day.upper[0]) && near(day.sections[1].top, day.upper[1]) && day.F > H * 0.88);
}

// ---- Roman ----
{
  const pitch = L.ROMAN.FOLD - L.ROMAN.STEP;
  const down = L.romanLayout('flat', H, W, 1), up0 = L.romanLayout('flat', H, W, 0), half = L.romanLayout('flat', H, W, 0.5);
  check('roman: lowered, it is one flat face with no folds', down.n === 0 && !down.folded && down.bands.length === 0 && near(down.FB, H - L.ROMAN.HEM, 1e-9));
  check('roman: a fold forms about every 8 in of cloth', near(L.ROMAN.FOLD, 8 * L.IN) && half.n === Math.floor(half.d / pitch) && up0.n >= 6 && up0.n <= 8, `folds raised: ${up0.n}`);
  const bottoms = up0.bands.map((b) => b.bottom), steps = bottoms.slice(1).map((v, i) => v - bottoms[i]);
  check('roman: the folds are stacked evenly (each finished fold peeks out the same amount below the one in front)', steps.every((s) => near(s, L.ROMAN.STEP, 1e-9)) && up0.bands[0].j === up0.n && up0.bands[up0.bands.length - 1].j === 1);
  check('roman: raised, the stack sits under the headrail (its lowest edge within 30 cm of the top on a 64 in shade)', up0.edge < 0.3 && up0.R >= L.ROMAN.HEAD_H, `${(up0.edge * 100).toFixed(1)} cm`);
  let mono = true, cont = true, prev = null;
  for (let i = 0; i <= 400; i++) { const l = L.romanLayout('flat', H, W, i / 400); if (prev && (l.edge < prev.edge - 1e-9 || l.edge - prev.edge > 0.02)) { mono = false; } if (prev && l.n !== prev.n && Math.abs(l.FB - prev.FB) > 0.03 && Math.abs(l.FB - (prev.bands[0]?.bottom ?? prev.FB)) > 0.03) cont = false; prev = l; }
  check('roman: the bottom edge moves smoothly, with no jump when a fold is finished', mono && cont);
  for (const style of L.ROMAN_STYLE_IDS) { const f = L.romanHandle(style, H, W, 0.37); check(`roman ${style}: the handle leads back to the same position`, near(L.romanAmountAt(style, H, W, f), 0.37, 1e-6)); }
  const relax = L.romanLayout('relax', H, W, 1);
  check('roman relax: gentle folds stay at the bottom when lowered, and the bottom edge sags in the middle', relax.n >= 1 && relax.sag > 0.03 && relax.sag <= 0.085 && L.romanLayout('flat', H, W, 1).sag === 0);
  const pf = L.romanLayout('plain-fold', H, W, 1);
  check('roman plain fold, ribble, hobble: their lines sit on the ring rows, 8 in apart', pf.lines.length >= 6 && pf.lines.slice(1).every((y, i) => near(y - pf.lines[i], L.ROMAN.FOLD, 1e-9)));
  check('roman: an unknown style is drawn flat', L.romanStyle('nope') === 'flat' && L.romanStyle(null) === 'flat' && L.ROMAN_STYLE_IDS.join() === 'flat,relax,plain-fold,ribble,hobble');
}

// ---- Shangri-La ----
{
  const closed = L.shangriLayout(H, 1, 0), open = L.shangriLayout(H, 1, 1), halfOpen = L.shangriLayout(H, 0.5, 1);
  check('shangri-la closed: every vane overlaps the next one (privacy)', closed.rise > L.SHANGRI.PITCH && closed.sep < 0.01);
  check('shangri-la open: the vanes lie nearly level, so more than half of the height between them is clear', open.rise < L.SHANGRI.PITCH * 0.45 && open.sep > 0.04, `rise ${(open.rise * 1000).toFixed(1)} mm of ${(L.SHANGRI.PITCH * 1000).toFixed(1)}`);
  check('shangri-la: the vanes open only when the shade is all the way down', halfOpen.open === 0 && near(halfOpen.sep, closed.sep) && open.open === 1);
  check('shangri-la: the vanes are 2 in apart and travel with the bottom rail (the cloth rolls into the cassette)', near(closed.vanes[0] - closed.vanes[1], 2 * L.IN, 1e-9) && near(closed.vanes[0], closed.rail - 0.004, 1e-9) && L.shangriLayout(H, 0.5, 0).vanes.length < closed.vanes.length);
  check('shangri-la: the handle leads back to the same position', near(L.shangriAmountAt(H, L.shangriHandle(H, 0.42)), 0.42, 1e-6));
}

// ---- kinds ----
{
  check('movers: a top-down cellular has a bottom rail and a top rail, day & night a bottom rail and a middle rail, everything else one part (a roller double-stack: two shades)',
    K.moversFor('cellular', { style: 'top-down-bottom-up' }).map((m) => m.id).join() === 'bottom,top' && K.moversFor('cellular', { style: 'day-night' }).map((m) => m.label).join() === 'Bottom rail,Middle rail'
    && K.moversFor('cellular', { style: 'standard' }).length === 1 && K.moversFor('roman').length === 1 && K.moversFor('shangri-la').length === 1 && K.moversFor('roller', { double: true }).length === 2 && K.moversFor('zebra').length === 1);
  check('start positions: one per mover, the upper rail above the bottom one', ['standard', 'top-down-bottom-up', 'day-night'].every((s) => { const a = K.startAmounts('cellular', { style: s }); return a.length === K.moversFor('cellular', { style: s }).length && (a.length < 2 || a[1] < a[0]); }) && K.startAmounts('roller', { double: true }).join() === '0.5,0' && K.startAmounts('roller').join() === '0.55');
  check('light types: cellular by family, roman by lining, one for shangri-la, none for roller and zebra', K.lightTypeFor('cellular', { family: 'blackout' }) === 'cellular-blackout' && K.lightTypeFor('cellular', { family: 'light-filtering' }) === 'cellular' && K.lightTypeFor('roman', { lining: 'blackout' }) === 'roman-blackout' && K.lightTypeFor('roman', {}) === 'roman' && K.lightTypeFor('shangri-la') === 'shangri-la' && K.lightTypeFor('roller') === null);
  check('light filtering glows more at the top than at the bottom; blackout is lit evenly', ['cellular', 'roman'].every((t) => K.SOFT_OPTICS[t].grad[0] > K.SOFT_OPTICS[t].grad[1] + 0.2 && K.SOFT_OPTICS[`${t}-blackout`].grad[0] === K.SOFT_OPTICS[`${t}-blackout`].grad[1]));
  const types = ['cellular', 'cellular-blackout', 'roman', 'roman-blackout', 'shangri-la'];
  check('every new type has its own calibrated light line', types.every((t) => C.LIGHT[t] && C.LIGHT[t].a.every((v) => v > 0.9 && v < 1.2) && C.typeOfLook({ line: 'cellular', lightType: t }) === t) && C.typeOfLook({ line: 'roller', family: 'solar' }) === 'solar');
  const bad = [];
  for (const t of types) for (const hex of ['#f4f4f2', '#ecece8', '#d9d2c2', '#8a8a8a', '#3a3a3a', '#6f86a8']) {
    const face = C.faceOf(C.litTarget(hex, t), t, hex), want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    if (face.some((v, i) => Math.abs(v - want[i]) > 0.01)) bad.push(`${t} ${hex} -> ${face.map((v) => v.toFixed(1))}`);
  }
  check('the texture is aimed so that the lit face shows the tile color exactly, whites included (no cream, no grey)', bad.length === 0, bad.join(' | '));
  const s = K.sampleSpec('cellular', 'cellular');
  check('before a color is picked the preview wears a generated sample (no picture to download)', s.look.textureMode === 'pattern' && /^#[0-9a-f]{6}$/.test(s.look.previewColor) && s.look.lightType === 'cellular' && K.sampleSpec('roman', 'roman').look.line === 'drapery');
}

const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
