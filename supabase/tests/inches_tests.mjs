// Pure tests of the size parser (src/lib/inches.js): what a customer may type, what it means, and how it reads back. No network.
import { parseInches, formatInches, sizeFromNumbers, toInches } from '../../src/lib/inches.js';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `\n      ${detail}` : ''}`); };
const eq = (name, got, want) => check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

for (const [typed, want] of [['35', 35], ['35.5', 35.5], ['35 1/2', 35.5], ['35-1/2', 35.5], ['35  1/2', 35.5], [' 35 1/2 ', 35.5], ['35.3', 35.25], ['35.06', 35], ['35.07', 35.125], ['40.0625', 40.125], ['1/2', 0.5], ['7/8', 0.875], ['35 1/2"', 35.5], ['35 1/2 in', 35.5], ['35.5 inches', 35.5], ['.5', 0.5], ['35.', 35], ['35 2/4', 35.5], ['35 3/16', 35.25], ['100', 100], ['118 7/8', 118.875]]) eq(`"${typed}" means ${want}`, parseInches(typed), want);
for (const typed of ['', '  ', 'abc', '35 x', '35 1/0', '0', '0.01', '-5', '35,5', '35 1/', '/2', '35..5', '1/0', '35 1 / 2 x', 'NaN']) eq(`"${typed}" is not a size`, parseInches(typed), null);
for (const [n, want] of [[35.5, '35 1/2'], [36, '36'], [37.125, '37 1/8'], [43.75, '43 3/4'], [86.5, '86 1/2'], [0.5, '1/2'], [64.3, '64 1/4'], ['40', '40'], ['', ''], [0, ''], [null, ''], [undefined, ''], ['abc', ''], [40.0625, '40 1/8'], [23.99, '24']]) eq(`${JSON.stringify(n)} reads back as "${want}"`, formatInches(n), want);
eq('a saved width and height fill the two boxes', JSON.stringify(sizeFromNumbers(35.5, 64)), JSON.stringify({ w: '35 1/2', h: '64' }));
eq('toInches gives the decimal that is priced', toInches('35 1/2'), '35.5');
eq('toInches of nothing is empty (nothing is priced)', toInches(''), '');
eq('typing "3" first is just 3', parseInches('3'), 3);
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
