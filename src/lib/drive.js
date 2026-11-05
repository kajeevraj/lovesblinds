// How a shade is raised and lowered, as one string (`mech`) that carts, drafts and orders already store.
//   chain | chain.left | zero-gravity | two-in-one | motorized.battery.app-remote[.solar][.left]
// Pure code with no imports: the browser, the 3D preview and api/quote.js all read it the same way.
// Only the five shade lines use it; Curtains and Dream Curtains keep their own codes (see below).
//
// "Cordless" is gone: it is the same thing as Zero gravity. Saved codes that say `cordless` (and the older `freestop`) read as Zero gravity.

import { trackById } from './hardware.js';

export const DRIVE_LINES = ['roller', 'zebra', 'shangri-la', 'roman', 'cellular'];
export const usesDrive = (lineId) => DRIVE_LINES.includes(lineId);

export const MOVEMENT_NAME = { chain: 'Chain', 'zero-gravity': 'Zero gravity', motorized: 'Motorized', 'two-in-one': '2 in 1 motor' };
export const POWER_NAME = { battery: 'Battery', wired: 'Wired' };
export const MOTOR_CONTROL_NAME = {
  'remote-only': 'Remote only',
  'app-remote': 'App + Remote (Bluetooth)',
  zigbee: 'App + Voice + Remote (Zigbee)',
  matter: 'App + Voice + Remote (Matter)',
};
export const SIDE_NAME = { left: 'Left', right: 'Right' };
export const CELLULAR_MOTOR_NAME = { standard: 'Normal Cellular Motor', 'top-down-bottom-up': 'TDBU Cellular Motor', 'day-night': 'Day&Night Cellular Motor' };

// which movements each line offers, in display order (Zero gravity first, Chain last)
const MOVEMENTS = {
  roller: ['zero-gravity', 'motorized', 'two-in-one', 'chain'],
  zebra: ['zero-gravity', 'motorized', 'chain'],
  'shangri-la': ['motorized', 'chain'],
  roman: ['zero-gravity', 'motorized', 'chain'],
  cellular: ['zero-gravity', 'motorized', 'chain'],
};
// Roller double-stack ("Dual-layer"): no Chain and no 2 in 1 motor
const DOUBLE_MOVEMENTS = ['zero-gravity', 'motorized'];
export const movementsFor = (lineId, { double = false } = {}) => (lineId === 'roller' && double ? DOUBLE_MOVEMENTS : MOVEMENTS[lineId] || []);
// What a new page starts on: Zero gravity wherever it exists. (Shangri-La has none and keeps Chain, the plain choice with no motor cost.)
export const defaultMovement = (lineId, opts) => (lineId === 'shangri-la' ? 'chain' : movementsFor(lineId, opts)[0] || 'chain');

// the motor choices a line offers
export const motorControlsFor = (lineId, { double = false } = {}) => (
  lineId === 'cellular' ? ['remote-only']                                          // the cellular motor has no App, Zigbee, Matter or Wired choice
    : double ? ['remote-only', 'app-remote', 'matter']                             // double-stack: no Zigbee
      : ['remote-only', 'app-remote', 'zigbee', 'matter']);
export const powersFor = (lineId) => (lineId === 'roman' || lineId === 'cellular' ? ['battery'] : ['battery', 'wired']);   // Roman and Cellular: battery only
export const solarAllowed = (lineId, power) => power === 'battery';

// codes saved before the restructure -> what they mean now
const LEGACY = {
  cordless: 'zero-gravity',
  freestop: 'zero-gravity',
  remote: 'motorized.battery.remote-only',
  remote_wand: 'motorized.battery.remote-only',
  motor: 'motorized.battery.zigbee',
  matter: 'motorized.battery.matter',
};

export const DEFAULT_DRIVE = { movement: 'chain', power: 'battery', solar: false, control: 'app-remote', side: 'right' };

// the string -> { movement, power, solar, control, side }; a code the line does not know falls back to the line's default movement
// opts.double: Roller double-stack (no Chain, no 2 in 1, no Zigbee)
export function parseMech(lineId, mech, opts = {}) {
  const first = defaultMovement(lineId, opts);
  if (!usesDrive(lineId)) return { ...DEFAULT_DRIVE, movement: plainMovement(lineId, mech) || first, plain: true };
  let s = String(mech || '');
  if (LEGACY[s]) s = LEGACY[s];
  if (s === 'manual' || s === 'cord') s = 'chain';
  const [mv, ...rest] = s.split('.');
  const movement = movementsFor(lineId, opts).includes(mv) ? mv : first;
  const d = { ...DEFAULT_DRIVE, movement };
  if (movement === 'motorized') {
    const power = rest.includes('wired') ? 'wired' : 'battery';
    d.power = powersFor(lineId).includes(power) ? power : 'battery';
    const ctl = Object.keys(MOTOR_CONTROL_NAME).find((k) => rest.includes(k));
    const okControls = motorControlsFor(lineId, opts);
    d.control = okControls.includes(ctl) ? ctl : (lineId === 'cellular' ? 'remote-only' : 'app-remote');
    d.solar = d.power === 'battery' && rest.includes('solar');
  }
  if (movement === 'chain' || movement === 'motorized') d.side = rest.includes('left') ? 'left' : 'right';
  if (movement === 'two-in-one') d.side = 'right';                                  // the 2 in 1 motor is on the right only
  return d;
}

// Curtains and Dream Curtains: manual | motorized | pull-rod (Dream Curtains). Older Dream Curtains orders say remote or matter: both mean motorized.
const PLAIN_ALIAS = { remote: 'motorized', matter: 'motorized' };
function plainMovement(lineId, mech) {
  if (!mech) return null;
  return lineId === 'drapery' ? (PLAIN_ALIAS[mech] || mech) : mech;
}

export function formatMech(lineId, d) {
  if (!usesDrive(lineId)) return d.movement;
  if (d.movement === 'motorized') {
    const power = d.power === 'wired' ? 'wired' : 'battery';
    return ['motorized', power, d.control || 'app-remote', power === 'battery' && d.solar ? 'solar' : null, d.side === 'left' ? 'left' : null].filter(Boolean).join('.');
  }
  if (d.movement === 'two-in-one') return 'two-in-one';
  return d.movement === 'chain' && d.side === 'left' ? 'chain.left' : d.movement;
}

// the options sent to the price function: the movement is the `control` code; the motor choices ride along for the add-ons
export function pricingOptions(lineId, mech, opts = {}) {
  if (!usesDrive(lineId)) return { control: plainMovement(lineId, mech) || mech };
  const d = parseMech(lineId, mech, opts);
  if (d.movement === 'two-in-one') return { control: 'two-in-one' };
  if (d.movement !== 'motorized') return { control: d.movement };
  return { control: 'motorized', power: d.power, solar: d.solar ? 'panel' : 'none', motor_control: d.control };
}

// the one-line name shown in carts, emails and the order sheet.
// `selection` (optional) adds what only the style knows: the cellular motor's name follows the style.
export function mechName(lineId, mech, plainName, selection = null) {
  if (!usesDrive(lineId)) {
    if (lineId === 'drapery' && selection?.section === 'curtains') {                // curtains: the track or rod is the control
      const t = trackById(selection.hardware?.track);
      return t ? `${t.label}${t.motorized ? `, ${selection.hardware.power === 'wired' ? 'wired' : 'battery'} motor` : ''}` : 'Own track or rod';
    }
    if (lineId === 'drapery') return { manual: 'Manual', motorized: 'Motorized', 'pull-rod': 'Pull rod' }[plainMovement(lineId, mech)] || plainName || mech;
    return plainName || mech;
  }
  const d = parseMech(lineId, mech, { double: selection?.mode === 'double-stack' });
  if (d.movement === 'motorized') {
    const bits = ['Motorized'];
    if (lineId === 'cellular') bits.push(CELLULAR_MOTOR_NAME[selection?.type] || CELLULAR_MOTOR_NAME.standard);
    bits.push(`${POWER_NAME[d.power].toLowerCase()}${d.solar ? ' + solar panel' : ''}`);
    if (lineId !== 'cellular') bits.push(MOTOR_CONTROL_NAME[d.control]);
    bits.push(`${SIDE_NAME[d.side].toLowerCase()} side`);
    return bits.join(', ');
  }
  if (d.movement === 'two-in-one') return '2 in 1 motor, right side';
  return d.movement === 'chain' ? `Chain, ${SIDE_NAME[d.side].toLowerCase()} side` : MOVEMENT_NAME[d.movement];
}

// the motor's own name for the order line (Cellular only: Normal / TDBU / Day&Night), else null
export const cellularMotorName = (type) => CELLULAR_MOTOR_NAME[type] || CELLULAR_MOTOR_NAME.standard;
