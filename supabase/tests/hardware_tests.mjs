// No network: curtain styles, which tracks fit which style, the hardware choices, Dream Curtains rules, the remote rule for motorized rails and the order text.
import { CURTAIN_STYLES, TRACKS, tracksFor, cleanHardware, hardwareRequest, hardwareText, colorsOf, METAL_FINISHES, FINIALS, styleIdFromSaved, dreamText, pullRodOk, RETURNS, LINERS, PANELS, OPENINGS, DREAM_STACKS } from '../../src/lib/hardware.js';
import { buildSelection } from '../../src/lib/lineSelection.js';
import { summarize } from '../../src/lib/selectionText.js';
import { isMotorized, remoteFor, assignRemotes } from '../../src/lib/remote.js';
import { mechName } from '../../src/lib/drive.js';
let bad = 0;
const check = (n, ok, d = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `\n      ${d}` : ''}`); };
const j = JSON.stringify;
const ids = (list) => list.map((x) => x.id);
const full = (id) => CURTAIN_STYLES.find((s) => s.id === id).fullness;

check('styles and fullness exactly as the order form says', j(full('grommet')) === j(['1x', '2x']) && ['pinch-pleat', 'goblet', 'inverted-pleat', 'euro-pleat-2', 'french-pleat-2', 'korean-pleat-2', 'out-invert-pleat'].every((s) => j(full(s)) === j(['2.1-2.3x', '2.6x', '3x']))
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
console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
