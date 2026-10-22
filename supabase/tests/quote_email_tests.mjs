// Server-side order email tests (api/quote.js) against the live Supabase project: estimates are worked out again on the
// server, the customer email carries each item's estimate and the total but no supplier data, the internal email carries the
// price group and the supplier codes, and the sheet gets the price columns. Sends nothing (no email service is called).
// Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import XLSX from 'xlsx';
import { withCatalog, withEstimates, lineListHtml, internalEmailHtml, customerEmailHtml, buildWorkbook, priceText, totalText, ESTIMATE_NOTE } from '../../api/quote.js';
import { sentEstimate } from '../../src/lib/orders.js';
import { priceRequestFromItem } from '../../src/lib/priceRequest.js';

const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const rpc = async (fn, body) => (await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(ANON), body: JSON.stringify(body) })).json();
const catalog = async (scope) => (await rpc('public_catalog', { p_scope: [scope] })).flatMap((g) => g.swatches.map((s) => ({ ...s, group: g })));
const groups = (await (await fetch(`${URL_}/rest/v1/fabrics?select=collection_name`, { headers: H(SVC) })).json()).map((f) => f.collection_name);
const WORDS = /Cordless spring|Softens sun and glare|Cellular Shades|Roller Shades|Zebra Shades|Roman Shades|Shangri-La Shades|Drapery/gi;
const leak = (html) => groups.filter((g) => new RegExp(`\\b${g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(html.replace(WORDS, '')));

const roller = (await catalog('roller')).find((s) => s.family === 'solar');
const dreams = await catalog('dream-curtains');
const dream = dreams.find((s) => s.styles?.length);
const curtain = (await catalog('drapery'))[0];
const pick = (s, over = {}) => ({ swatchId: s.id, line: s.product_line, family: s.family || null, fabricId: s.fabric_id, code: s.supplier_code, displayName: s.display_name, role: null, style: null, ...over });
const line = (id, name, selection, o = {}) => ({ category: id, productName: name, selection, mechId: o.mech, width: o.width ?? 40, length: o.length ?? 64, qty: o.qty ?? 1, roomLabel: o.room || '', mountId: 'inside', mechName: o.mechName || 'Control', estimate: o.estimate || { kind: 'price', unit: 1 } });

const sent = [
  line('roller', 'Roller Shades', { lineId: 'roller', mode: 'single', cover: 'none', picks: [pick(roller)] }, { mech: 'chain', mechName: 'Continuous chain', qty: 3, room: 'Living <room>', estimate: { kind: 'price', unit: 1 } }),
  line('drapery', 'Drapery', { lineId: 'drapery', section: 'curtains', pleat: 'Ripple Fold', lining: 'none', picks: [pick(curtain)] }, { mech: 'manual', width: 120, length: 96, qty: 2, estimate: { kind: 'request', unit: null } }),
  line('drapery', 'Drapery', { lineId: 'drapery', section: 'dream-curtains', picks: [pick(dream, { line: 'dream-curtains', style: 'B', code: dream.styles.find((x) => x.style === 'B').code })] }, { mech: 'manual', width: 60, length: 84, estimate: { kind: 'price', unit: 5 } }),
];

const { lines: cat } = await withCatalog(sent);
const { lines, total, byEmail } = await withEstimates(cat);
const totals = { total, byEmail };
const customer = { name: 'Ada <b>Lovelace</b>', email: 'ada@example.com', phone: '555', address: { street: '1 Analytical Way', apt: 'Suite <2>', city: 'London', state: 'England', zip: 'N1 1AA', country: 'United Kingdom' }, shipTo: 'old one-line value' };

// the order sheet, read back the way Excel would show it: rows of cells (column A is the narrow margin, B..J hold the table)
const sheetOf = async (c, ls, notes, t) => { const buf = Buffer.from(await (await buildWorkbook(c, ls, notes, t)).xlsx.writeBuffer()); const wb = XLSX.read(buf); return { wb, rows: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }) }; };

const wantRoller = await rpc('estimate_price_for_swatch', { p_line: 'roller', p_swatch_id: roller.id, p_options: { control: 'chain', mode: 'single', wrap_cassette: 'none' }, p_width: 40, p_height: 64 });
const wantDream = await rpc('estimate_price_for_swatch', { p_line: 'dream-curtains', p_swatch_id: dream.id, p_options: { control: 'manual' }, p_width: 60, p_height: 84 });
check('the server works the Roller estimate out again, with the No fabric wrap deduction, ignoring the $1 the browser claimed', lines[0].price.kind === 'price' && lines[0].price.unit === wantRoller.price && lines[0].price.checked, `server $${lines[0].price.unit}, database $${wantRoller.price}`);
check('curtains have no dollar estimate (price sent by email)', lines[1].price.kind === 'request' && priceText(lines[1]) === 'Price sent by email');
check('Dream Curtains are priced again on the server too', lines[2].price.unit === wantDream.price, `$${wantDream.price} (browser claimed $5)`);
check('the estimated total is the sum of price x quantity for priced windows, and one item is priced by email', total === wantRoller.price * 3 + wantDream.price && byEmail === 1, `$${total}, plus ${byEmail}`);
check('"$X each · $Y for 3" for quantity 3', priceText(lines[0]) === `$${wantRoller.price} each · $${wantRoller.price * 3} for 3 blinds`, priceText(lines[0]));
const req = priceRequestFromItem({ id: 'roller' }, { selection: sent[0].selection, mech: 'chain', width: 40, length: 64 });
check('the price request carries the supplier "no wrap" option and nothing else secret', req.options.wrap_cassette === 'none' && !JSON.stringify(req).match(/cost|grid|group|markup/i));

const cust = customerEmailHtml(customer, lines, 'a note', totals);
const intl = internalEmailHtml(customer, lines, 'a note', totals);
check('customer email: each item has its estimate, the total, "Plus 1 item priced by email" and the estimate sentence', cust.includes(`$${wantRoller.price} each`) && cust.includes('Price sent by email') && cust.includes('Estimated total') && /Plus 1 item priced by email/.test(cust) && cust.includes(ESTIMATE_NOTE));
const dcode = dream.styles.find((x) => x.style === 'B').code, acode = dream.styles.find((x) => x.style === 'A').code;
check('customer email: Dream Curtains show the style name and the picked style\'s code like any other line, not the other style\'s code or "Style B"', /Slim/.test(cust) && cust.includes(dcode) && !cust.includes(acode) && !/Style [AB]/.test(cust), dcode);
check('customer email counts blinds ("3 blinds")', /, 3 blinds/.test(cust) && !/qty/.test(cust));
check('customer email: no price group names and no cost, markup, grid or deduction wording', leak(cust).length === 0 && !/markup|cost\b|grid|deduction|price group|collection/i.test(cust), leak(cust).join(', '));
check('internal email: the style name with its letter', /ZDS\d/.test(intl) && /Slim \(Style B\)/.test(intl));
check('internal email: the price group (supplier collection) for the Roller window', groups.some((g) => intl.includes(g)));
check('internal email says the browser figure differed from the recalculated one', /customer's browser showed \$1/.test(intl));
check('names and rooms are escaped in the emails', !/<b>Lovelace/.test(cust + intl) && /&lt;room&gt;/.test(cust));
check('the spreadsheet gets the unit price, the total for the quantity, and the estimated subtotal', await (async () => {
  const { rows } = await sheetOf(customer, lines, '', totals);
  const r = rows.find((x) => String(x[1] || '').startsWith('Roller'));
  const sub = rows.find((x) => x[8] === 'Subtotal');
  const notes = rows.find((x) => /^Notes:/.test(String(x[1] || '')));
  return r && r[8] === wantRoller.price && r[9] === wantRoller.price * 3 && sub && sub[9] === total && notes && /Plus 1 item priced by email/.test(notes[1]);
})());
const demo = await sheetOf(customer, lines, 'Ring first', totals);
const R = demo.rows;
const head = R.findIndex((x) => x[1] === 'Description');
check('IABAT template: title band, our address, email and phone, then Customer and Ship to Address', R[0][0] === 'Loves Blinds and Window Treatments' && R[1].includes('512 Glenwyck Court Fuquay Varina, NC 27526') && R[2].includes('loveblindswindows@gmail.com') && R[3].includes('Phone number: 262-434-0949') && /^Customer: Ada/.test(R[5][1]) && /^Ship to Address : 1 Analytical Way, Suite <2>, London, England N1 1AA, United Kingdom/.test(R[5][6]), JSON.stringify(R.slice(0, 6)));
check('IABAT template: exactly the nine columns, in order, and nothing after Total', JSON.stringify(R[head].slice(1)) === JSON.stringify(['Description', 'Color', 'Quantity', 'Width', 'Length', 'Drive System', 'Location', 'Price per unit', 'Total']) && R[head].length === 10, JSON.stringify(R[head]));
check('IABAT template: 15 item rows (empty rows show a zero), then Subtotal, Shipping, Total before Tax, Tax, Total', R.slice(head + 1, head + 16).length === 15 && ['Subtotal', 'Shipping', 'Total before Tax', 'Tax', 'Total'].every((l, i) => R[head + 16 + i][8] === l), R.slice(head + 16, head + 21).map((x) => x[8]).join(','));
check('IABAT template: the Notes box carries the customer notes', /^Notes: .*Ring first/s.test(R[head + 17][1]), R[head + 17][1]);
check('order sheet: Description is "line - price group (options)" and Color is "code supplier color name"', /^Roller Shades, Single - \S.*\(Inside mount, .*No fabric wrap/.test(R[head + 1][1]) && new RegExp(`^${roller.supplier_code}\\b`).test(R[head + 1][2]), `${R[head + 1][1]} | ${R[head + 1][2]}`);
check('order sheet: Location is the room and window, Drive System is the control', R[head + 1][7] === 'Living <room>' && R[head + 1][6] === 'Continuous chain');
const fr = await sheetOf(customer, [{ ...lines[0], width: 43.5, length: 76 }, { ...lines[0], width: 37.125, length: 86.5, windowLabel: 'Left' }, { ...lines[0], width: 43.75, length: 40, roomLabel: 'Hall' }], '', totals);
const fh = fr.rows.findIndex((x) => x[1] === 'Description');
check('order sheet: sizes are fractions ("43 1/2", "37 1/8", "86 1/2", "43 3/4"), whole inches stay numbers, never decimals', fr.rows[fh + 1][4] === '43 1/2' && fr.rows[fh + 1][5] === 76 && fr.rows[fh + 2][4] === '37 1/8' && fr.rows[fh + 2][5] === '86 1/2' && fr.rows[fh + 3][4] === '43 3/4' && !fr.rows.slice(fh + 1, fh + 4).some((x) => /\d\.\d/.test(`${x[4]} ${x[5]}`)), JSON.stringify(fr.rows.slice(fh + 1, fh + 4).map((x) => [x[4], x[5]])));
check('order sheet: room and window go together in Location ("Living <room> - Left")', fr.rows[fh + 2][7] === 'Living <room> - Left');
const many = await sheetOf(customer, Array.from({ length: 20 }, () => lines[0]), '', totals);
check('order sheet: more than 15 items extend the table and the totals follow it', many.rows.findIndex((x) => x[8] === 'Subtotal') - many.rows.findIndex((x) => x[1] === 'Description') === 21);
check('an order whose estimate lookup fails still goes through with the browser figure, marked unchecked', await (async () => {
  const r = await withEstimates(cat, { SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_ANON_KEY: 'x' });
  return r.lines[0].price.kind === 'price' && r.lines[0].price.checked === false && /could not be re-checked/.test(lineListHtml(r.lines, true));
})());
check('totalText with nothing priced is "Price sent by email"', totalText({ total: 0, byEmail: 2 }) === 'Price sent by email');

check('My Orders: a sent order shows its estimated total and the items priced by email', sentEstimate({ status: 'sent', items: [{ price: 135, priceKind: 'estimate', qty: 3 }, { price: null, priceKind: 'email', qty: 2 }] }) === 'Estimated total $405 · plus 1 item priced by email');
check('My Orders: orders saved before Stage 2 and orders not yet sent show no price line', sentEstimate({ status: 'sent', items: [{ qty: 1 }] }) === null && sentEstimate({ status: 'draft', items: [{ price: 5, priceKind: 'estimate', qty: 1 }] }) === null);

check('both emails show the whole shipping address, a part per line, escaped', ['1 Analytical Way<br>Suite &lt;2&gt;<br>London, England N1 1AA<br>United Kingdom'].every((a) => cust.includes(a) && intl.includes(a)) && /Shipping to:/.test(cust) && /Ship to:/.test(intl));
check('the order sheet header has the full address on one line', R.some((r) => /Ship to Address : 1 Analytical Way, Suite <2>, London, England N1 1AA, United Kingdom/.test(r[6] || '')));
check('an order from an older page that only has the one-line address still shows it', customerEmailHtml({ name: 'A', email: 'a@b.c', shipTo: '9 Old Rd' }, lines, '', totals).includes('9 Old Rd'));

const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
