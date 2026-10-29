// No network: which remote a motorized shade gets, and the room-count rule for its channels (src/lib/remote.js).
import { assignRemotes, remoteFor, isMotorized, channelsFor, roomKey } from '../../src/lib/remote.js';
let bad = 0;
const check = (n, ok, d = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `\n      ${d}` : ''}`); };
const roller = (o = {}) => ({ category: 'roller', mechId: 'motorized.battery.app-remote', selection: { mode: 'single' }, qty: 1, roomLabel: 'Living room', ...o });
const types = (lines) => assignRemotes(lines).map((l) => l.remote?.type ?? null);
check('1, 2-6, 7-16 and 17+ shades map to 1, 6, 16 and 16 channels', [1, 2, 6, 7, 16, 17, 40].map(channelsFor).join() === '1,6,6,16,16,16,16');
for (const [n, want] of [[1, 'ch1'], [2, 'ch6'], [3, 'ch6'], [6, 'ch6'], [7, 'ch16'], [8, 'ch16'], [16, 'ch16'], [17, 'ch16']]) {
  const lines = Array.from({ length: n }, () => roller());
  check(`${n} separate shades in one room: every line gets ${want}`, types(lines).every((t) => t === want), types(lines).join(','));
}
check('one line with a quantity counts every shade (qty 3 = 6 Channels, qty 8 = 16 Channels)', types([roller({ qty: 3 })])[0] === 'ch6' && types([roller({ qty: 8 })])[0] === 'ch16');
const over = assignRemotes(Array.from({ length: 17 }, () => roller()));
check('17 shades in one room: 16 Channels and the "over 16" flag on every line; 16 shades have no flag', over.every((l) => l.remote.over16 && l.remote.type === 'ch16') && !assignRemotes(Array.from({ length: 16 }, () => roller())).some((l) => l.remote.over16));
check('room names that differ only by case or spaces are one room', types([roller({ roomLabel: 'Living room' }), roller({ roomLabel: '  LIVING ROOM ' }), roller({ roomLabel: 'living Room' })]).every((t) => t === 'ch6') && roomKey(' Den ') === 'den');
check('different rooms do not share', types([roller({ roomLabel: 'Den' }), roller({ roomLabel: 'Office' })]).join() === 'ch1,ch1');
check('blank rooms: each shade counts alone, even with many blank shades or a quantity', types([roller({ roomLabel: '' }), roller({ roomLabel: '' }), roller({ roomLabel: '   ', qty: 5 })]).every((t) => t === 'ch1'));
check('a blank room does not join a named room', types([roller({ roomLabel: '' }), roller({ roomLabel: 'Den' })]).join() === 'ch1,ch1');
check('a double-stack counts as two shades', types([roller({ selection: { mode: 'double-stack' } })])[0] === 'ch6');
check('shades that are not motorized do not count and get no remote', (() => { const r = assignRemotes([roller({ mechId: 'chain' }), roller({ mechId: 'cordless' }), roller()]); return r[0].remote === undefined && r[1].remote === undefined && r[2].remote.type === 'ch1'; })());
check('a remote sent by the browser on a non-motorized line is dropped', assignRemotes([roller({ mechId: 'chain', remote: { type: 'ch16' } })])[0].remote === undefined);
check('legacy saved codes (remote, matter, motor, remote_wand) still count as motorized', ['remote', 'matter', 'motor'].every((m) => isMotorized(roller({ mechId: m }))) && isMotorized({ category: 'shangri-la', mechId: 'remote_wand', qty: 1 }));
const cell = (type, o = {}) => ({ category: 'cellular', mechId: 'motorized.wired.matter', selection: { type }, qty: 1, roomLabel: 'Den', ...o });
check('cellular: standard = single motor, top-down and day & night = dual motor; channels follow the same rule', types([cell('standard')])[0] === 'single-single' && types([cell('top-down-bottom-up')])[0] === 'dual-single' && types([cell('day-night')])[0] === 'dual-single'
  && types([cell('standard'), cell('standard')]).join() === 'single-multi,single-multi' && types([cell('day-night', { qty: 2 })])[0] === 'dual-multi');
check('cellular and roller in one room share the count but keep their own remote body', types([cell('standard'), roller({ roomLabel: 'Den' })]).join() === 'single-multi,ch6');
check('Shangri-La, Roman use the 1/6/16 channel remote', types([{ category: 'shangri-la', mechId: 'motorized.battery.app-remote', qty: 1, roomLabel: 'A' }, { category: 'roman', mechId: 'motorized.wired.zigbee', qty: 1, roomLabel: 'B' }]).join() === 'ch1,ch1');
check('Dream Curtains motor uses the roller remote; regular Curtains never get one', types([{ category: 'drapery', mechId: 'remote', selection: { section: 'dream-curtains' }, qty: 1, roomLabel: 'A' }])[0] === 'ch1' && types([{ category: 'drapery', mechId: 'manual', selection: { section: 'curtains' }, qty: 1 }])[0] === null);
const r = remoteFor('roller', { mode: 'single' }, 'Den', [roller({ roomLabel: 'den', qty: 2 })], 1);
check('the product page rule: shades already in the room plus this one (2 + 1 = 3 = 6 Channels)', r.count === 3 && r.type === 'ch6');
console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
