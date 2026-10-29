// How a shade is raised and lowered, as one string (`mech`) that carts, drafts and orders already store.
//   chain | chain.left | cordless | zero-gravity | motorized.battery.app-remote[.solar][.left]
// Pure code with no imports: the browser, the 3D preview and api/quote.js all read it the same way.
// Only the five motorized-shade lines use it; Curtains and Dream Curtains keep their plain codes (manual, remote, matter).

export const DRIVE_LINES = ['roller', 'zebra', 'shangri-la', 'roman', 'cellular'];
export const usesDrive = (lineId) => DRIVE_LINES.includes(lineId);

export const MOVEMENT_NAME = { chain: 'Chain', cordless: 'Cordless', 'zero-gravity': 'Zero gravity', motorized: 'Motorized' };
export const POWER_NAME = { battery: 'Battery', wired: 'Wired' };
export const MOTOR_CONTROL_NAME = {
  'app-remote': 'App + Remote',
  'remote-only': 'Remote control only',
  zigbee: 'App + Voice + Remote (Zigbee)',
  matter: 'App + Voice + Remote (Matter)',
};
export const SIDE_NAME = { left: 'Left', right: 'Right' };

// which movements each line offers, in display order
export const MOVEMENTS = {
  roller: ['chain', 'cordless', 'zero-gravity', 'motorized'],
  zebra: ['chain', 'cordless', 'zero-gravity', 'motorized'],
  'shangri-la': ['chain', 'motorized'],
  roman: ['cordless', 'zero-gravity', 'motorized'],
  cellular: ['cordless', 'zero-gravity', 'motorized'],
};

// codes saved before the restructure -> what they mean now
const LEGACY = {
  freestop: 'zero-gravity',
  remote: 'motorized.battery.remote-only',
  remote_wand: 'motorized.battery.remote-only',
  motor: 'motorized.battery.zigbee',
  matter: 'motorized.battery.matter',
};

export const DEFAULT_DRIVE = { movement: 'chain', power: 'battery', solar: false, control: 'app-remote', side: 'right' };

// the string -> { movement, power, solar, control, side }; a code the line does not know falls back to its first movement
export function parseMech(lineId, mech) {
  const first = MOVEMENTS[lineId]?.[0] || 'chain';
  if (!usesDrive(lineId)) return { ...DEFAULT_DRIVE, movement: mech || first, plain: true };
  let s = String(mech || '');
  if (LEGACY[s]) s = LEGACY[s];
  if (s === 'manual' || s === 'cord') s = 'chain';
  const [mv, ...rest] = s.split('.');
  const movement = (MOVEMENTS[lineId] || []).includes(mv) ? mv : first;
  const d = { ...DEFAULT_DRIVE, movement };
  if (movement === 'motorized') {
    d.power = rest.includes('wired') ? 'wired' : 'battery';
    d.control = Object.keys(MOTOR_CONTROL_NAME).find((k) => rest.includes(k)) || 'app-remote';
    d.solar = d.power === 'battery' && rest.includes('solar');
  }
  if (movement === 'chain' || movement === 'motorized') d.side = rest.includes('left') ? 'left' : 'right';
  return d;
}

export function formatMech(lineId, d) {
  if (!usesDrive(lineId)) return d.movement;
  if (d.movement === 'motorized') {
    const power = d.power === 'wired' ? 'wired' : 'battery';
    return ['motorized', power, d.control || 'app-remote', power === 'battery' && d.solar ? 'solar' : null, d.side === 'left' ? 'left' : null].filter(Boolean).join('.');
  }
  return d.movement === 'chain' && d.side === 'left' ? 'chain.left' : d.movement;
}

// the options sent to the price function: the movement is the `control` code; the motor choices ride along for the add-ons
export function pricingOptions(lineId, mech) {
  if (!usesDrive(lineId)) return { control: mech };
  const d = parseMech(lineId, mech);
  if (d.movement !== 'motorized') return { control: d.movement };
  return { control: 'motorized', power: d.power, solar: d.solar ? 'panel' : 'none', motor_control: d.control };
}

// the one-line name shown in carts, emails and the order sheet
export function mechName(lineId, mech, plainName) {
  if (!usesDrive(lineId)) return plainName || mech;
  const d = parseMech(lineId, mech);
  if (d.movement === 'motorized') {
    return ['Motorized', `${POWER_NAME[d.power].toLowerCase()}${d.solar ? ' + solar panel' : ''}`, MOTOR_CONTROL_NAME[d.control], `${SIDE_NAME[d.side].toLowerCase()} side`].join(', ');
  }
  return d.movement === 'chain' ? `Chain, ${SIDE_NAME[d.side].toLowerCase()} side` : MOVEMENT_NAME[d.movement];
}
