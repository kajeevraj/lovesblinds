// No network: the Zigbee hub. It exists only with a Zigbee line, once, at quantity 1, at the server's price; it is its own line in the emails, the order sheet and the totals.
import XLSX from 'xlsx';
import { isZigbeeItem, hubLine, isHubLine, zigbeeNote, hubTitle, HUB_BLURB, HUB_DEFAULT_PRICE } from '../../src/lib/hub.js';
import { cleanHubLines, estimateLine, internalEmailHtml, customerEmailHtml } from '../../api/quote.js';
import { validateOrder } from '../../api/_guard.js';
let bad = 0;
const check = (n, ok, d = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `\n      ${d}` : ''}`); };
const zig = { category: 'roller', productName: 'Roller Shades', mechId: 'motorized.battery.zigbee', mechName: 'Motorized, battery, App + Voice + Remote (Zigbee), right side', selection: { lineId: 'roller', mode: 'single', picks: [] }, width: 40, length: 64, qty: 2, estimate: { kind: 'email', unit: null }, description: 'Roller Shades · Zigbee', internalDescription: 'Roller Shades · Zigbee' };
const app = { ...zig, mechId: 'motorized.battery.app-remote' };
const chain = { ...zig, mechId: 'chain' };
const cartItem = (mech, id = 'roller') => ({ product: { id }, mech, selection: { mode: 'single' } });

check('only an App + Voice + Remote (Zigbee) motor needs the hub (not the app, Matter, remote only, chain, or the cellular motor)', isZigbeeItem(zig) && isZigbeeItem(cartItem('motorized.wired.zigbee', 'zebra')) && !isZigbeeItem(app) && !isZigbeeItem(chain) && !isZigbeeItem(cartItem('motorized.battery.matter')) && !isZigbeeItem(cartItem('motorized.battery.zigbee', 'cellular')) && !isZigbeeItem({ category: 'drapery', mechId: 'motorized' }));
check('the words: product page note, cart title and blurb', zigbeeNote(35) === "Needs a Zigbee hub. Add one in your cart for $35 if you don't have one." && `${hubTitle(35)} ${HUB_BLURB}` === 'Zigbee hub, $35. Needed once per home to control Zigbee shades with your phone or voice. Skip it if you already have one.');
check('the default price is $35', HUB_DEFAULT_PRICE === 35 && hubLine(35).estimate.unit === 35 && hubLine(35).qty === 1 && isHubLine(hubLine(35)));
const hub = hubLine(35);
check('the server keeps the hub only with a Zigbee line, only once, and at quantity 1', cleanHubLines([zig, hub, { ...hub, qty: 5 }]).filter(isHubLine).length === 1 && cleanHubLines([zig, { ...hub, qty: 5 }]).find(isHubLine).qty === 1 && cleanHubLines([app, chain, hub]).length === 2 && cleanHubLines([hub]).length === 0);
check('the guard lets the hub line through (no size, no picks)', validateOrder({ customer: { name: 'Ada', email: 'a@b.co' }, lines: [zig, hub] }).lines.length === 2);

// the server's price, not the browser's: from zigbee_hub_price, else $35
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => ({ ok: true, json: async () => ({ price: 40 }) });
const env = { SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'k' };
const priced = await estimateLine({ ...hub, estimate: { kind: 'price', unit: 1 } }, env);
check('the hub is priced from the database (here $40), never from what the browser sent', priced.kind === 'price' && priced.unit === 40 && priced.checked === true);
globalThis.fetch = async () => { throw new Error('offline'); };
const fallback = await estimateLine({ ...hub, estimate: { kind: 'price', unit: 1 } }, env);
check('if the price cannot be read the hub is $35 and marked unchecked', fallback.unit === 35 && fallback.checked === false);
globalThis.fetch = realFetch;

// emails, sheet and totals (no database: the server uses the prices the lines carry)
const lines = [
  { ...zig, price: { kind: 'price', unit: 244, checked: true } },
  { ...hub, price: { kind: 'price', unit: 35, checked: true } },
];
const totals = { total: 244 * 2 + 35, byEmail: 0 };
const internal = internalEmailHtml({ name: 'Ada', email: 'a@b.co' }, lines, '', totals), customer = customerEmailHtml({ name: 'Ada', email: 'a@b.co' }, lines, '', totals);
check('both emails list the Zigbee hub as its own line at $35, and the total includes it', /Zigbee hub[^<]*<\/li>|Zigbee hub[^<]*: <strong>\$35/.test(internal) && /Zigbee hub[^<]*: <strong>\$35/.test(customer) && /\$523/.test(internal) && /\$523/.test(customer), internal.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
check('the hub line says "quantity 1", nothing about blinds or sizes', /Zigbee hub[^<]*, quantity 1/.test(customer) && !/Zigbee hub[^<]*blind/.test(customer) && !/Zigbee hub[^<]*\d+"W/.test(customer));
const buf = await (await import('../../api/_orderSheet.js')).orderWorkbookBuffer({ name: 'Ada', email: 'a@b.co', address: { street: '1 St', city: 'X', state: 'NC', zip: '1', country: 'United States' } }, lines, '', totals);
const book = XLSX.read(buf); const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: '' });
const hubRow = rows.find((r) => r.some((c) => /Zigbee hub/.test(String(c))));
check('the order sheet has a row for the Zigbee hub: quantity 1, $35 each, $35 in the total column', !!hubRow && hubRow.includes(1) && hubRow.includes(35), JSON.stringify(hubRow));
console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
