// No network: the movement/motor model (src/lib/drive.js) and what it sends to the price function.
import { parseMech, formatMech, pricingOptions, mechName, movementsFor, defaultMovement, motorControlsFor, powersFor } from '../../src/lib/drive.js';
import { extrasFor, extrasText } from '../../src/lib/choices.js';
import { buildSelection } from '../../src/lib/lineSelection.js';
import { REMOTE_NAME, isMotorized } from '../../src/lib/remote.js';
import { summarize } from '../../src/lib/selectionText.js';
import { priceRequestFromItem } from '../../src/lib/priceRequest.js';
let bad = 0;
const check = (n, ok, d = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `\n      ${d}` : ''}`); };
const j = JSON.stringify;
check('plain codes round-trip and the default side is not written', formatMech('roller', parseMech('roller', 'chain')) === 'chain' && formatMech('roller', parseMech('roller', 'chain.left')) === 'chain.left' && formatMech('roller', parseMech('roller', 'zero-gravity')) === 'zero-gravity');
const m = 'motorized.battery.zigbee.solar.left';
check('a motorized code reads back and writes the same', j(parseMech('zebra', m)) === j({ movement: 'motorized', power: 'battery', solar: true, control: 'zigbee', side: 'left' }) && formatMech('zebra', parseMech('zebra', m)) === m, j(parseMech('zebra', m)));
check('wired never has a solar panel', !parseMech('roller', 'motorized.wired.matter.solar').solar && formatMech('roller', { movement: 'motorized', power: 'wired', solar: true, control: 'matter', side: 'right' }) === 'motorized.wired.matter');
check('old saved codes are translated (freestop, remote, matter, motor, remote_wand)', parseMech('cellular', 'freestop').movement === 'zero-gravity' && parseMech('roller', 'matter').control === 'matter' && parseMech('roller', 'motor').control === 'zigbee' && parseMech('shangri-la', 'remote_wand').movement === 'motorized' && parseMech('roller', 'remote').control === 'remote-only');
check('a movement the line does not offer falls back to the default (Shangri-La has no Zero gravity; a double-stack has no Chain)', parseMech('shangri-la', 'zero-gravity').movement === 'chain' && parseMech('roller', 'chain', { double: true }).movement === 'zero-gravity' && parseMech('zebra', 'two-in-one').movement === 'zero-gravity');
check('price options: chain and zero gravity send only the movement; motorized sends power, solar and control', j(pricingOptions('roller', 'chain.left')) === j({ control: 'chain' }) && j(pricingOptions('roman', 'zero-gravity')) === j({ control: 'zero-gravity' })
  && j(pricingOptions('roller', m)) === j({ control: 'motorized', power: 'battery', solar: 'panel', motor_control: 'zigbee' }) && j(pricingOptions('roller', 'motorized.wired.matter')) === j({ control: 'motorized', power: 'wired', solar: 'none', motor_control: 'matter' }));
check('the side never changes the price request', j(pricingOptions('roller', 'chain')) === j(pricingOptions('roller', 'chain.left')) && j(pricingOptions('roller', 'motorized.battery.app-remote')) === j(pricingOptions('roller', 'motorized.battery.app-remote.left')));
check('Dream Curtains: manual, motorized and pull-rod; the old remote and matter read as motorized', j(pricingOptions('drapery', 'motorized')) === j({ control: 'motorized' }) && j(pricingOptions('drapery', 'remote')) === j({ control: 'motorized' }) && parseMech('drapery', 'matter').movement === 'motorized'
  && j(pricingOptions('drapery', 'pull-rod')) === j({ control: 'pull-rod' }) && mechName('drapery', 'manual', 'Manual') === 'Manual' && mechName('drapery', 'matter', 'x') === 'Motorized');
check('names for carts and emails', mechName('roller', 'chain.left') === 'Chain, left side' && mechName('roller', 'zero-gravity') === 'Zero gravity' && mechName('roller', m) === 'Motorized, battery + solar panel, App + Voice + Remote (Zigbee), left side', mechName('roller', m));
const pick = { swatchId: 'x' };
const r = priceRequestFromItem({ id: 'roller' }, { selection: { mode: 'single', picks: [pick] }, mech: 'motorized.battery.app-remote.solar', width: 40, length: 60 });
check('a saved motorized item rebuilds the same price request (shared with api/quote.js)', r.options.control === 'motorized' && r.options.solar === 'panel' && r.options.mode === 'single', j(r.options));
const dbl = priceRequestFromItem({ id: 'roller' }, { selection: { mode: 'double-stack', picks: [pick, { swatchId: 'y' }] }, mech: 'motorized.battery.app-remote', width: 40, length: 60 });
check('double-stack carries the motor choices for both shades', dbl.options.control === 'motorized' && dbl.options.back_swatch_id === 'y');

// ---- the restructure of this round ----
check('Cordless is gone: a saved cordless code loads as Zero gravity, in every line, and names itself that way', ['roller', 'zebra', 'roman', 'cellular'].every((l) => parseMech(l, 'cordless').movement === 'zero-gravity' && mechName(l, 'cordless') === 'Zero gravity' && j(pricingOptions(l, 'cordless')) === j({ control: 'zero-gravity' })) && !Object.values(['roller', 'zebra', 'roman', 'cellular', 'shangri-la']).some((l) => movementsFor(l).includes('cordless')));
check('movement order: Zero gravity, Motorized, 2 in 1 (roller only), Chain last', j(movementsFor('roller')) === j(['zero-gravity', 'motorized', 'two-in-one', 'chain']) && j(movementsFor('zebra')) === j(['zero-gravity', 'motorized', 'chain']) && j(movementsFor('roman')) === j(['zero-gravity', 'motorized', 'chain'])
  && j(movementsFor('cellular')) === j(['zero-gravity', 'motorized', 'chain']) && j(movementsFor('shangri-la')) === j(['motorized', 'chain']) && !movementsFor('zebra').includes('two-in-one'));
check('Zero gravity is the default on every line that has it (Shangri-La keeps Chain)', ['roller', 'zebra', 'roman', 'cellular'].every((l) => defaultMovement(l) === 'zero-gravity') && defaultMovement('shangri-la') === 'chain' && defaultMovement('roller', { double: true }) === 'zero-gravity');
check('2 in 1 motor: roller only, right side only, its own price code, it comes with a remote, and it has a name', parseMech('roller', 'two-in-one.left').side === 'right' && formatMech('roller', parseMech('roller', 'two-in-one.left')) === 'two-in-one' && j(pricingOptions('roller', 'two-in-one')) === j({ control: 'two-in-one' })
  && mechName('roller', 'two-in-one') === '2 in 1 motor, right side' && isMotorized({ category: 'roller', mech: 'two-in-one' }) && !isMotorized({ category: 'roller', mech: 'zero-gravity' }));
check('roller double-stack: no Chain, no 2 in 1, no Zigbee; Remote only, App + Remote (Bluetooth), Matter; battery or wired', j(movementsFor('roller', { double: true })) === j(['zero-gravity', 'motorized']) && j(motorControlsFor('roller', { double: true })) === j(['remote-only', 'app-remote', 'matter'])
  && parseMech('roller', 'motorized.battery.zigbee', { double: true }).control === 'app-remote' && parseMech('roller', 'motorized.battery.zigbee').control === 'zigbee' && j(powersFor('roller')) === j(['battery', 'wired']));
check('Roman: battery motor only (a saved wired Roman reads as battery)', j(powersFor('roman')) === j(['battery']) && parseMech('roman', 'motorized.wired.matter').power === 'battery' && !formatMech('roman', parseMech('roman', 'motorized.wired.matter')).includes('wired'));
check('Cellular motor: no App, Zigbee, Matter or Wired; battery, remote only, left or right (default right); solar kept', j(motorControlsFor('cellular')) === j(['remote-only']) && j(powersFor('cellular')) === j(['battery'])
  && j(parseMech('cellular', 'motorized.wired.matter.solar.left')) === j({ movement: 'motorized', power: 'battery', solar: true, control: 'remote-only', side: 'left' }) && parseMech('cellular', 'motorized').side === 'right');
check('the cellular motor follows the style, is saved on the order line and shows in its name', ['standard', 'top-down-bottom-up', 'day-night'].map((t) => {
  const { selection } = buildSelection({ id: 'cellular' }, { type: t, pick: { swatchId: 'a', code: 'X', displayName: 'N' }, day: null, night: null, mech: 'motorized.battery.remote-only' });
  return `${selection.motorType}|${mechName('cellular', 'motorized.battery.remote-only', 'x', selection)}`;
}).join(' ; ') === 'Normal Cellular Motor|Motorized, Normal Cellular Motor, battery, left side ; TDBU Cellular Motor|Motorized, TDBU Cellular Motor, battery, left side ; Day&Night Cellular Motor|Motorized, Day&Night Cellular Motor, battery, left side'.replace(/left/g, 'right'));
check('cellular remote names: Single Motor-Single Channel, Single Motor-Multi Channel, Dual Motor-Single Channel, Dual Motor-Multi Channel', REMOTE_NAME['single-single'] === 'Single Motor-Single Channel' && REMOTE_NAME['single-multi'] === 'Single Motor-Multi Channel' && REMOTE_NAME['dual-single'] === 'Dual Motor-Single Channel' && REMOTE_NAME['dual-multi'] === 'Dual Motor-Multi Channel');
check('the new $0 choices have defaults and apply only where they belong', j(extrasFor('roller', 'chain')) === j({ chainColor: 'white', barColor: 'pearl-white', rollDir: 'standard' }) && j(extrasFor('roller', 'zero-gravity')) === j({ barColor: 'pearl-white', rollDir: 'standard' })
  && j(extrasFor('zebra', 'chain')) === j({ chainColor: 'white', barColor: 'pearl-white' }) && j(extrasFor('cellular', 'chain')) === j({ cordType: 'chain', chainColor: 'white' }) && j(extrasFor('cellular', 'zero-gravity')) === '{}'
  && j(extrasFor('roman', 'chain', { cordType: 'cord-loop', cordColor: 'beige' })) === j({ cordType: 'cord-loop', cordColor: 'beige', rollDir: 'standard' }) && j(extrasFor('shangri-la', 'chain')) === j({ chainColor: 'white', rollDir: 'standard' })
  && extrasFor('roller', 'chain', { chainColor: 'nonsense' }).chainColor === 'white' && extrasFor('roller', 'zero-gravity', {}, { double: true }).bottomWrap === 'wrapped');
check('the new choices are saved on the order line and read in the order text', (() => {
  const { selection } = buildSelection({ id: 'roller' }, { mode: 'single', front: { swatchId: 'a', code: 'X', displayName: 'N' }, mech: 'chain', extras: { chainColor: 'stainless-steel', barColor: 'night-black', rollDir: 'reverse' } });
  const text = summarize({ product: { name: 'Roller Shades' }, selection }).parts.join(' | ');
  return selection.extras.chainColor === 'stainless-steel' && /Chain color: Stainless steel/.test(text) && /Bottom bar: Night Black/.test(text) && /Roll direction: Reverse/.test(text);
})());
check('colors the supplier names exactly: Pearl White, Sand Beige, Iron Gray, Night Black', extrasText({ barColor: 'pearl-white' })[0] === 'Bottom bar: Pearl White' && extrasText({ barColor: 'sand-beige' })[0] === 'Bottom bar: Sand Beige' && extrasText({ barColor: 'iron-gray' })[0] === 'Bottom bar: Iron Gray' && extrasText({ barColor: 'night-black' })[0] === 'Bottom bar: Night Black');
check('double-stack prices both shades with the bottom rail choice (supplier deduction), motors and zero gravity per shade', (() => {
  const pk = { swatchId: 'x' };
  const w = priceRequestFromItem({ id: 'roller' }, { selection: { mode: 'double-stack', picks: [pk, { swatchId: 'y' }], extras: { bottomWrap: 'none' } }, mech: 'zero-gravity', width: 40, length: 60 });
  return w.options.control === 'zero-gravity' && w.options.wrap_bottom_rail === 'none' && w.options.back_swatch_id === 'y';
})());
console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
