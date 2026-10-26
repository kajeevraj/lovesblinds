// No network: the movement/motor model (src/lib/drive.js) and what it sends to the price function.
import { parseMech, formatMech, pricingOptions, mechName } from '../../src/lib/drive.js';
import { priceRequestFromItem } from '../../src/lib/priceRequest.js';
let bad = 0;
const check = (n, ok, d = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `\n      ${d}` : ''}`); };
const j = JSON.stringify;
check('plain codes round-trip and the default side is not written', formatMech('roller', parseMech('roller', 'chain')) === 'chain' && formatMech('roller', parseMech('roller', 'chain.left')) === 'chain.left' && formatMech('roller', parseMech('roller', 'zero-gravity')) === 'zero-gravity');
const m = 'motorized.battery.zigbee.solar.left';
check('a motorized code reads back and writes the same', j(parseMech('zebra', m)) === j({ movement: 'motorized', power: 'battery', solar: true, control: 'zigbee', side: 'left' }) && formatMech('zebra', parseMech('zebra', m)) === m, j(parseMech('zebra', m)));
check('wired never has a solar panel', !parseMech('roller', 'motorized.wired.matter.solar').solar && formatMech('roller', { movement: 'motorized', power: 'wired', solar: true, control: 'matter', side: 'right' }) === 'motorized.wired.matter');
check('old saved codes are translated (freestop, remote, matter, motor, remote_wand)', parseMech('cellular', 'freestop').movement === 'zero-gravity' && parseMech('roller', 'matter').control === 'matter' && parseMech('roller', 'motor').control === 'zigbee' && parseMech('shangri-la', 'remote_wand').movement === 'motorized' && parseMech('roller', 'remote').control === 'remote-only');
check('a movement the line does not offer falls back to its first (Roman has no chain)', parseMech('roman', 'chain').movement === 'cordless');
check('price options: chain and cordless send only the movement; motorized sends power, solar and control', j(pricingOptions('roller', 'chain.left')) === j({ control: 'chain' }) && j(pricingOptions('roman', 'zero-gravity')) === j({ control: 'zero-gravity' })
  && j(pricingOptions('roller', m)) === j({ control: 'motorized', power: 'battery', solar: 'panel', motor_control: 'zigbee' }) && j(pricingOptions('roller', 'motorized.wired.matter')) === j({ control: 'motorized', power: 'wired', solar: 'none', motor_control: 'matter' }));
check('the side never changes the price request', j(pricingOptions('roller', 'chain')) === j(pricingOptions('roller', 'chain.left')) && j(pricingOptions('roller', 'motorized.battery.app-remote')) === j(pricingOptions('roller', 'motorized.battery.app-remote.left')));
check('Curtains and Dream Curtains keep their plain codes', j(pricingOptions('drapery', 'remote')) === j({ control: 'remote' }) && mechName('drapery', 'manual', 'Manual track') === 'Manual track');
check('names for carts and emails', mechName('roller', 'chain.left') === 'Chain, left side' && mechName('roller', 'zero-gravity') === 'Zero gravity' && mechName('roller', m) === 'Motorized, battery + solar panel, App + Voice + Remote (Zigbee), left side', mechName('roller', m));
const pick = { swatchId: 'x' };
const r = priceRequestFromItem({ id: 'roller' }, { selection: { mode: 'single', picks: [pick] }, mech: 'motorized.battery.app-remote.solar', width: 40, length: 60 });
check('a saved motorized item rebuilds the same price request (shared with api/quote.js)', r.options.control === 'motorized' && r.options.solar === 'panel' && r.options.mode === 'single', j(r.options));
const dbl = priceRequestFromItem({ id: 'roller' }, { selection: { mode: 'double-stack', picks: [pick, { swatchId: 'y' }] }, mech: 'motorized.battery.app-remote', width: 40, length: 60 });
check('double-stack carries the motor choices for both shades', dbl.options.control === 'motorized' && dbl.options.back_swatch_id === 'y');
console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
