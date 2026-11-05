// No network: curtain styles, which tracks fit which style, the hardware choices, Dream Curtains rules, the remote rule for motorized rails and the order text.
import { CURTAIN_STYLES, TRACKS, tracksFor, cleanHardware, hardwareRequest, hardwareText, colorsOf, METAL_FINISHES, FINIALS, styleIdFromSaved, dreamText, pullRodOk, RETURNS, LINERS, PANELS, OPENINGS, DREAM_STACKS } from '../../src/lib/hardware.js';
import { buildSelection } from '../../src/lib/lineSelection.js';
import { summarize } from '../../src/lib/selectionText.js';
import { isMotorized, remoteFor, assignRemotes } from '../../src/lib/remote.js';
import { mechName } from '../../src/lib/drive.js';
import { priceRequest, priceRequestFromItem, runEstimate } from '../../src/lib/priceRequest.js';
let bad = 0;
const check = (n, ok, d = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `\n      ${d}` : ''}`); };
const j = JSON.stringify;
const ids = (list) => list.map((x) => x.id);
const full = (id) => CURTAIN_STYLES.find((s) => s.id === id).fullness;

check('styles and fullness exactly as the order form says', j(full('grommet')) === j(['1x', '2x']) && j(full('pinch-pleat')) === j(['2.1x', '2.6x', '3x']) && ['goblet', 'inverted-pleat', 'euro-pleat-2', 'french-pleat-2', 'korean-pleat-2', 'out-invert-pleat'].every((s) => j(full(s)) === j(['2.3x', '2.6x', '3x']))
  && ['euro-pleat-3', 'french-pleat-3', 'korean-pleat-3'].every((s) => j(full(s)) === j(['2.8x', '3.5x', '4x'])) && j(full('ripple-hook')) === j(['2.6x', '2.8x']) && j(full('ripple-button')) === j(['2.6x']) && j(full('rod-pocket')) === j(['1x', '2x']) && CURTAIN_STYLES.length === 14);
check('return, liner and panels choices', j(ids(RETURNS)) === j(['pleat', '2', '3.5']) && RETURNS[0].label === 'Same as pleat spacing' && j(ids(LINERS)) === j(['none', 'light-filtering', 'blackout']) && j(ids(PANELS)) === j(['single', 'pair']));
const fit = (style) => ids(tracksFor(style));
check('only the tracks that fit the style are offered', j(fit('pinch-pleat')) === j(['classic-rail', 'arc-rail', 'elegance-rod', 'elegance-rail', 'motorized-rail']) && j(fit('ripple-button')) === j(['classic-rail', 'elegance-rail', 'motorized-rail'])
  && j(fit('ripple-hook')) === j(['arc-rail', 'elegance-rail', 'motorized-rail']) && j(fit('grommet')) === j(['elegance-rod']) && j(fit('rod-pocket')) === j(['elegance-rod']));
check('a motorized rail is not available for grommet or rod pocket (hidden)', !fit('grommet').includes('motorized-rail') && !fit('rod-pocket').includes('motorized-rail') && cleanHardware({ track: 'motorized-rail' }, 'grommet') === null && cleanHardware({ track: 'motorized-rail' }, 'rod-pocket') === null);
check('a track that does not fit the style is dropped', cleanHardware({ track: 'classic-rail' }, 'ripple-hook') === null && cleanHardware({ track: 'arc-rail' }, 'ripple-button') === null && cleanHardware({ track: 'arc-rail' }, 'ripple-hook')?.track === 'arc-rail');
check('colors: classic white; arc white or black; decorative five metal finishes; motorized white', j(ids(colorsOf('classic-rail'))) === j(['white']) && j(ids(colorsOf('arc-rail'))) === j(['white', 'black']) && j(colorsOf('elegance-rod').map((c) => c.label)) === j(['Brushed Bronze', 'Black Matt', 'Antique Tin Matte', 'Brushed Brass', 'Brushed Nickel Matte']) && METAL_FINISHES.length === 5 && colorsOf('elegance-rail').length === 5 && j(ids(colorsOf('motorized-rail'))) === j(['white']));
check('finials: Classic plain plus the ten named ones; only decorative rods and rails take one', FINIALS.length === 11 && FINIALS[0].id === 'classic' && FINIALS.map((f) => f.label).slice(1).join(',') === 'Spacecraft,Moonstone,Celestial Oval,Imperial Crest,Crystal Diamond,Crystal Bubble,Concave-Top Ball,Sculpted Cylinder,Heritage Drum,Gilded Helix'
  && cleanHardware({ track: 'elegance-rod', finial: 'moonstone' }, 'pinch-pleat').finial === 'moonstone' && cleanHardware({ track: 'arc-rail', finial: 'moonstone' }, 'pinch-pleat').finial === undefined);
const m = cleanHardware({ track: 'motorized-rail', opening: 'center', overlap: '2', power: 'wired', layers: 'double' }, 'pinch-pleat');
check('motorized rail: battery or wired, left / right / center opening, overlap only for center', m.power === 'wired' && m.opening === 'center' && m.overlap === '2' && cleanHardware({ track: 'motorized-rail', opening: 'left' }, 'pinch-pleat').overlap === undefined && cleanHardware({ track: 'motorized-rail' }, 'pinch-pleat').opening === 'right' && j(ids(OPENINGS)) === j(['left', 'right', 'center']));
check('the price request: width in inches, the style family, double layers, finial premium or classic, motorized', (() => {
  const r = hardwareRequest(cleanHardware({ track: 'elegance-rail', finial: 'gilded-helix', layers: 'double' }, 'ripple-hook'), 'ripple-hook', 100);
  return r.width === 100 && r.options.track === 'elegance-rail' && r.options.style_family === 'ripple-hook' && r.options.layers === 'double' && r.options.finial === 'premium' && r.options.motorized === false
    && hardwareRequest(cleanHardware({ track: 'motorized-rail' }, 'pinch-pleat'), 'pinch-pleat', 100).options.motorized === true && hardwareRequest(null, 'pinch-pleat', 100) === null && hardwareRequest({ track: 'arc-rail' }, 'pinch-pleat', 0) === null;
})());
check('a style saved before this list maps to its new style', styleIdFromSaved('French Pleat 2') === 'french-pleat-2' && styleIdFromSaved('Ripple Fold') === 'ripple-hook' && styleIdFromSaved('Euro pleat (3 finger)') === 'euro-pleat-3' && styleIdFromSaved('nope') === null);

// the order line
const pick = { swatchId: 's1', code: 'C1', displayName: 'Linen' };
const curtains = (hw) => buildSelection({ id: 'drapery' }, { section: 'curtains', pick, styleId: 'ripple-hook', fullness: '2.6x', returnTo: '3.5', lining: 'blackout', panels: 'pair', hardware: hw, mech: 'manual' });
const withHw = curtains({ track: 'motorized-rail', layers: 'single', mount: 'wall', coversTrack: true, opening: 'center', overlap: 'return', power: 'battery' });
check('curtains are complete only with a color, style, fullness, liner and panels; hardware is optional; a chosen track with no valid style or track stays incomplete', withHw.missing.length === 0 && curtains(null).missing.length === 0 && curtains(null).selection.hardware === undefined
  && buildSelection({ id: 'drapery' }, { section: 'curtains', pick, styleId: 'ripple-hook', lining: 'none', mech: 'manual' }).missing.join() === 'a fullness,single or pair'
  && buildSelection({ id: 'drapery' }, { section: 'curtains', pick, styleId: 'ripple-hook', fullness: '2.6x', lining: 'none', panels: 'pair', hardwareIncomplete: true, mech: 'manual' }).missing.join() === 'a track or rod');
const text = summarize({ product: { name: 'Drapery' }, selection: withHw.selection }).parts.join(' | ');
check('the hardware and the curtain choices read in the order text (cart, emails, sheet, admin)', /Ripple fold \(hook\)/.test(text) && /Fullness 2.6x/.test(text) && /Return: 3.5 in/.test(text) && /Pair/.test(text) && /Track or rod: Motorized rail/.test(text) && /Wall \(side\) mount, fabric covers the track/.test(text) && /Center opening, overlap same as return/.test(text) && /Battery motor, remote included/.test(text), text);
check('the drive system column names the track', mechName('drapery', 'manual', 'x', withHw.selection) === 'Motorized rail, battery motor' && mechName('drapery', 'manual', 'x', curtains(null).selection) === 'Own track or rod' && mechName('drapery', 'manual', 'x', curtains({ track: 'arc-rail' }).selection) === 'Arc rail');
check('a motorized rail comes with a remote that follows the room rule; other tracks and own hardware do not', (() => {
  const a = { category: 'drapery', mech: 'manual', selection: withHw.selection, qty: 1, roomLabel: 'Den' };
  const b = { category: 'drapery', mech: 'manual', selection: curtains({ track: 'arc-rail' }).selection, qty: 1, roomLabel: 'Den' };
  const lines = assignRemotes([a, { ...a }, b]);
  return isMotorized(a) && !isMotorized(b) && lines[0].remote.type === 'ch6' && lines[1].remote.type === 'ch6' && !lines[2].remote && remoteFor('drapery', a.selection, 'Den', [], 1).type === 'ch1';
})());

// Dream Curtains
const dream = (control, stack) => buildSelection({ id: 'drapery' }, { section: 'dream-curtains', dream: pick, dreamOpts: { install: 'ceiling', fit: 'inside', stack }, mech: control });
check('Dream Curtains: mount (side or ceiling, then inside or outside), stack, and Pull rod only for left or right', dream('manual', 'left').missing.length === 0 && dream('manual', null).missing.includes('a stack') && buildSelection({ id: 'drapery' }, { section: 'dream-curtains', dream: pick, mech: 'manual' }).missing.join() === 'an install type,inside or outside,a stack'
  && pullRodOk('left') && pullRodOk('right') && !pullRodOk('center') && j(ids(DREAM_STACKS)) === j(['left', 'right', 'center']));
check('Dream Curtains text and motorized remote', /Ceiling install, inside/.test(summarize({ product: { name: 'Drapery' }, selection: dream('manual', 'center').selection }).parts.join('|')) && dreamText({ install: 'side', fit: 'outside', stack: 'right' }).join(';') === 'Side install, outside;Right stack'
  && isMotorized({ category: 'drapery', mech: 'motorized', selection: { section: 'dream-curtains' } }) && isMotorized({ category: 'drapery', mech: 'remote', selection: { section: 'dream-curtains' } }) && !isMotorized({ category: 'drapery', mech: 'pull-rod', selection: { section: 'dream-curtains' } }));
check('hardwareText: nothing for "I have my own"', hardwareText(null).length === 0 && j(hardwareText({ track: 'arc-rail', color: 'black', layers: 'double', mount: 'ceiling' })).includes('double'));

// ---- curtain prices: what is asked, and how the answers add up (fabric + the track or rod)
const line = { id: 'drapery' };
const c0 = { section: 'curtains', pick: { swatchId: 'sw1' }, styleId: 'ripple-hook', fullness: '2.8x', lining: 'blackout', panels: 'pair' };
const req = priceRequest(line, c0, 'manual', 150, 96);
check('a curtain is priced once style, fullness, liner and size are in: fullness as a number, the style family, the liner', req?.kind === 'curtain' && req.options.fullness === 2.8 && req.options.style_family === 'ripple-hook' && req.options.lining === 'blackout' && req.swatchId === 'sw1' && req.width === 150 && req.height === 96 && req.hardware === null);
check('no curtain price until every choice and a size are in', priceRequest(line, { ...c0, fullness: null }, 'manual', 150, 96) === null && priceRequest(line, { ...c0, lining: null }, 'manual', 150, 96) === null && priceRequest(line, c0, 'manual', '', '') === null && priceRequest(line, { ...c0, hardware: { track: 'arc-rail' }, hardwareIncomplete: true }, 'manual', 150, 96) === null);
const reqHw = priceRequest(line, { ...c0, hardware: { track: 'elegance-rod', finial: 'moonstone', layers: 'single' }, styleId: 'pinch-pleat', fullness: '2.6x' }, 'manual', 100, 84);
check('a curtain with a decorative rod also asks for the hardware price, at the curtain width', reqHw.hardware.width === 100 && reqHw.hardware.options.track === 'elegance-rod' && reqHw.hardware.options.finial === 'premium');
const fake = (answers, calls = []) => async (url, init) => { const fn = url.split('/rpc/')[1]; calls.push(fn); return { ok: true, json: async () => answers[fn] }; };
const calls = [];
check('the answer is the fabric price plus the hardware price (both from the database)', (await runEstimate(reqHw, 'http://x', 'k', fake({ drapery_estimate: { price: 300 }, hardware_estimate: { price: 135 } }, calls))).price === 435 && calls.join() === 'drapery_estimate,hardware_estimate');
check('a size or color the database cannot price is "by email", with or without hardware', (await runEstimate(reqHw, 'http://x', 'k', fake({ drapery_estimate: { price_on_request: true } }))).price_on_request === true && (await runEstimate(reqHw, 'http://x', 'k', fake({ drapery_estimate: { price: 300 }, hardware_estimate: { price_on_request: true } }))).price_on_request === true);
check('a curtain with no hardware asks only for the fabric', await (async () => { const c = []; const r = await runEstimate(req, 'http://x', 'k', fake({ drapery_estimate: { price: 211 } }, c)); return r.price === 211 && c.join() === 'drapery_estimate'; })());
check('a saved curtain rebuilds the same request (the server checks every order with it)', (() => {
  const sel = { section: 'curtains', picks: [{ swatchId: 'sw1' }], pleat: 'Pinch pleat', fullness: '2.6x', lining: 'light-filtering', panels: 'pair', hardware: { track: 'arc-rail', color: 'white', layers: 'single', mount: 'ceiling', coversTrack: false } };
  const r = priceRequestFromItem({ id: 'drapery' }, { selection: sel, mech: 'manual', width: 100, length: 84 });
  return r?.kind === 'curtain' && r.options.fullness === 2.6 && r.options.style_family === 'pleated' && r.options.lining === 'light-filtering' && r.hardware.options.track === 'arc-rail' && priceRequestFromItem({ id: 'drapery' }, { selection: { section: 'curtains', picks: [{ swatchId: 'a' }], pleat: 'Pinch pleat' }, mech: 'manual', width: 100, length: 84 }) === null;
})());
console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
