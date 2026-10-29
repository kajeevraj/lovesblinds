// Which remote comes with a motorized shade, and how many channels it needs. Pure code with no imports beyond drive.js: the product
// pages, the cart, api/quote.js (which decides it again on the server for every order) and the admin all read it the same way.
//
//   Roller, Zebra, Shangri-La, Roman, Dream Curtains, Drapery: ch1 | ch6 | ch16   (1, 6 or 16 channel remote)
//   Cellular, one motor (standard):                            single-single | single-multi
//   Cellular, two motors (top-down/bottom-up, day & night):    dual-single | dual-multi
//
// Channels: the motorized shades in one order that share a room name (trimmed, case-insensitive) share a remote.
//   1 shade = 1 channel; 2 to 6 = 6 channels; 7 to 16 = 16 channels; more than 16 = 16 channels and a flag for us.
// A blank room name means the shade stands alone (1 channel). A shade counts once, however many motors it has; a double-stack counts as two shades.
import { usesDrive, parseMech } from './drive.js';

export const REMOTE_NAME = {
  ch1: '1 Channel', ch6: '6 Channels', ch16: '16 Channels',
  'single-single': 'Single Motor, Single Channel', 'single-multi': 'Single Motor, Multi Channel',
  'dual-single': 'Dual Motor, Single Channel', 'dual-multi': 'Dual Motor, Multi Channel',
};
export const REMOTE_TYPES = Object.keys(REMOTE_NAME);
export const SHARE_NOTE = 'Shades in the same room share one remote that runs them one at a time or all together.';

// what a motor control works with, shown under the remote
export const WORKS_NOTE = {
  'app-remote': 'Works with your phone (Smart Life app)',
  zigbee: 'Needs a Zigbee hub (sold separately, $35)',
  matter: 'Works with your Matter smart speaker or hub',
};

export const roomKey = (label) => String(label ?? '').trim().toLowerCase();

const mechOf = (it) => it.mechId ?? it.mech;
const lineOf = (it) => it.category || it.product?.id;

// is this item a motorized shade (it comes with a remote)?
export function isMotorized(it) {
  const line = lineOf(it), mech = mechOf(it);
  if (usesDrive(line)) return parseMech(line, mech).movement === 'motorized';
  return line === 'drapery' && it.selection?.section === 'dream-curtains' && (mech === 'remote' || mech === 'matter');
}

// how many shades one item is
export const shadeCount = (it) => Math.max(1, Number(it.qty) || 1) * (it.selection?.mode === 'double-stack' ? 2 : 1);

export function channelsFor(n) { return n <= 1 ? 1 : n <= 6 ? 6 : 16; }

// the remote's type for a line, from the channel count
export function remoteTypeFor(line, selection, channels) {
  if (line === 'cellular') {
    const dual = selection?.type === 'top-down-bottom-up' || selection?.type === 'day-night';
    return `${dual ? 'dual' : 'single'}-${channels > 1 ? 'multi' : 'single'}`;
  }
  return `ch${channels}`;
}

// How many motorized shades share a remote with a shade in this room: the ones already in the order plus this one's own.
// `others` are the other items (never the one being priced), `own` is how many shades this item adds.
export function sharedCount(room, others, own) {
  const k = roomKey(room);
  if (!k) return 1;
  return own + others.filter((o) => isMotorized(o) && roomKey(o.roomLabel) === k).reduce((n, o) => n + shadeCount(o), 0);
}

// { type, channels, count, over16 } for a shade in `room` with `own` shades next to `others`
export function remoteFor(line, selection, room, others, own) {
  const count = sharedCount(room, others, own);
  const channels = channelsFor(count);
  return { type: remoteTypeFor(line, selection, channels), channels, count, over16: count > 16 };
}

// Every motorized line of an order gets its remote (the server does this for each order it accepts).
export function assignRemotes(lines) {
  return lines.map((l, i) => {
    if (!isMotorized(l)) { const { remote, ...rest } = l; void remote; return rest; }          // never trust a remote sent by the browser
    const others = lines.filter((_, j) => j !== i);
    const own = roomKey(l.roomLabel) ? shadeCount(l) : 1;
    const r = remoteFor(lineOf(l), l.selection, l.roomLabel, others, own);
    return { ...l, remote: { type: r.type, name: REMOTE_NAME[r.type], channels: r.channels, count: r.count, over16: r.over16 } };
  });
}
