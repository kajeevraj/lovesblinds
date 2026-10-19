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
const customer = { name: 'Ada <b>Lovelace</b>', email: 'ada@example.com', phone: '555', shipTo: '1 Way' };

const wantRoller = await rpc('estimate_price_for_swatch', { p_line: 'roller', p_swatch_id: roller.id, p_options: { control: 'chain', mode: 'single', wrap_cassette: 'none' }, p_width: 40, p_height: 64 });
const wantDream = await rpc('estimate_price_for_swatch', { p_line: 'dream-curtains', p_swatch_id: dream.id, p_options: { control: 'manual' }, p_width: 60, p_height: 84 });
check('the server works the Roller estimate out again, with the No fabric wrap deduction, ignoring the $1 the browser claimed', lines[0].price.kind === 'price' && lines[0].price.unit === wantRoller.price && lines[0].price.checked, `server $${lines[0].price.unit}, database $${wantRoller.price}`);
check('curtains have no dollar estimate (price sent by email)', lines[1].price.kind === 'request' && priceText(lines[1]) === 'Price sent by email');
check('Dream Curtains are priced again on the server too', lines[2].price.unit === wantDream.price, `$${wantDream.price} (browser claimed $5)`);
check('the estimated total is the sum of price x quantity for priced windows, and one item is priced by email', total === wantRoller.price * 3 + wantDream.price && byEmail === 1, `$${total}, plus ${byEmail}`);
check('"$X each · $Y for 3" for quantity 3', priceText(lines[0]) === `$${wantRoller.price} each · $${wantRoller.price * 3} for 3`, priceText(lines[0]));
const req = priceRequestFromItem({ id: 'roller' }, { selection: sent[0].selection, mech: 'chain', width: 40, length: 64 });
check('the price request carries the supplier "no wrap" option and nothing else secret', req.options.wrap_cassette === 'none' && !JSON.stringify(req).match(/cost|grid|group|markup/i));

const cust = customerEmailHtml(customer, lines, 'a note', totals);
const intl = internalEmailHtml(customer, lines, 'a note', totals);
check('customer email: each item has its estimate, the total, "Plus 1 item priced by email" and the estimate sentence', cust.includes(`$${wantRoller.price} each`) && cust.includes('Price sent by email') && cust.includes('Estimated total') && /Plus 1 item priced by email/.test(cust) && cust.includes(ESTIMATE_NOTE));
check('customer email: Dream Curtains show the style name, never a ZDS code or "Style B"', /Slim/.test(cust) && !/ZDS\d/.test(cust) && !/Style [AB]/.test(cust));
check('customer email: no price group names and no cost, markup, grid or deduction wording', leak(cust).length === 0 && !/markup|cost\b|grid|deduction|price group|collection/i.test(cust), leak(cust).join(', '));
check('internal email: supplier codes (ZDS) and the style name with its letter', /ZDS\d/.test(intl) && /Slim \(Style B\)/.test(intl));
check('internal email: the price group (supplier collection) for the Roller window', groups.some((g) => intl.includes(g)));
check('internal email says the browser figure differed from the recalculated one', /customer's browser showed \$1/.test(intl));
check('names and rooms are escaped in the emails', !/<b>Lovelace/.test(cust + intl) && /&lt;room&gt;/.test(cust));
check('the spreadsheet gets the unit price, the total for the quantity, and the estimated subtotal', (() => {
  const ws = buildWorkbook(customer, lines, '', totals);
  const rows = XLSX.utils.sheet_to_json(ws.Sheets.Quote, { header: 1 });
  const r = rows.find((x) => String(x[0] || '').startsWith('Roller'));
  const sub = rows.find((x) => String(x[0] || '').startsWith('Subtotal'));
  return r && r[7] === wantRoller.price && r[8] === wantRoller.price * 3 && sub && sub[8] === total && rows.some((x) => /Plus 1 item priced by email/.test(x[0] || ''));
})());
check('an order whose estimate lookup fails still goes through with the browser figure, marked unchecked', await (async () => {
  const r = await withEstimates(cat, { SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_ANON_KEY: 'x' });
  return r.lines[0].price.kind === 'price' && r.lines[0].price.checked === false && /could not be re-checked/.test(lineListHtml(r.lines, true));
})());
check('totalText with nothing priced is "Price sent by email"', totalText({ total: 0, byEmail: 2 }) === 'Price sent by email');

check('My Orders: a sent order shows its estimated total and the items priced by email', sentEstimate({ status: 'sent', items: [{ price: 135, priceKind: 'estimate', qty: 3 }, { price: null, priceKind: 'email', qty: 2 }] }) === 'Estimated total $405 · plus 1 item priced by email');
check('My Orders: orders saved before Stage 2 and orders not yet sent show no price line', sentEstimate({ status: 'sent', items: [{ qty: 1 }] }) === null && sentEstimate({ status: 'draft', items: [{ price: 5, priceKind: 'estimate', qty: 1 }] }) === null);

const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
