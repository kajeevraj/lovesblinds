// The room photo's preload (built into index.html by vite.config.js) and the page must ask for the same file. No network.
import { readFileSync } from 'node:fs';
import { pickWidth } from '../../src/room/photoSize.js';
const cfg = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');
const src = cfg.slice(cfg.indexOf('const earlyRoomPhoto'), cfg.indexOf('// Page titles'));
const expr = /const script = ([\s\S]*?)\n    return/.exec(src)[1];
const make = new Function('ROOM_WIDTHS', 'PHONE_QUERY_PX', `return ${expr}`);
const code = make([800, 1200, 1600, 2000], 720);
let bad = 0, n = 0;
for (const v of [320, 360, 390, 414, 600, 720, 721, 768, 1024, 1280, 1440, 1920, 2560]) for (const d of [1, 1.5, 2, 3]) {
  const added = []; const doc = { documentElement: { clientWidth: v }, createElement: () => ({ setAttribute() {} }), head: { appendChild: (l) => added.push(l.href) } };
  new Function('location', 'document', 'window', code)({ pathname: '/room-lab' }, doc, { devicePixelRatio: d });
  const want = `/room-lab/room-${pickWidth(v, d)}.webp`; n++;
  if (added[0] !== want) { bad++; console.log('FAIL', v, d, added[0], want); }
}
console.log(bad ? `${bad} of ${n} differ` : `PASS: preload and page agree on ${n} viewport and pixel-ratio pairs`);
process.exit(bad ? 1 : 0);
