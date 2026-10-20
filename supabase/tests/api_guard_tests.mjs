// Tests of the protection on the order and contact endpoints (api/quote.js, api/contact.js, api/_guard.js), with the email
// service, the rate-limit counter and the message store replaced by fakes, so nothing is sent and nothing is written.
// Reads the real catalog for one Roller color (SUPABASE_URL, VITE_SUPABASE_ANON_KEY) to build a realistic order.
import { handleQuote, checkSizes } from '../../api/quote.js';
import { handleContact, firstName, confirmationText, CONFIRMATION_SUBJECT } from '../../api/contact.js';
import { rateLimit, validateOrder, digest, LIMITS, SPAM_TRAP } from '../../api/_guard.js';

const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const env = { ...process.env, RESEND_API_KEY: 'test', SEND_CUSTOMER_CONFIRMATION: 'true' };

const cat = (await (await fetch(`${URL_}/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent('{roller}')}&apikey=${ANON}`)).json()).flatMap((g) => g.swatches);
const sw = cat.find((s) => s.family === 'solar');
const pick = { swatchId: sw.id, line: 'roller', family: 'solar', fabricId: sw.fabric_id, code: sw.supplier_code, displayName: sw.display_name, role: null, style: null };
const line = (o = {}) => ({ category: 'roller', productName: 'Roller Shades', selection: { lineId: 'roller', mode: 'single', picks: [pick] }, mechId: 'chain', mechName: 'Continuous chain', width: 40, length: 64, qty: 2, roomLabel: 'Den', description: 'd', internalDescription: 'i', estimate: { kind: 'price', unit: 1 }, ...o });
const body = (o = {}) => ({ customer: { name: 'Ada', email: 'ada@example.com', phone: '1', address: { street: '1 Way', city: 'London', state: 'E', zip: 'N1', country: 'United States' } }, lines: [line()], notes: 'hi', ...o });
const fakeRes = () => { const r = { code: 0, json: null, status(c) { r.code = c; return r; }, json_(j) { r.json = j; return r; } }; r.json = function (j) { r.body = j; return r; }; return r; };
const req = (b, h = {}) => ({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9', ...h }, body: b });
const mkResend = (result = {}) => { const sent = []; return { sent, emails: { send: async (m) => { sent.push(m); return result.error ? { error: { message: 'boom' } } : { data: { id: 'x' } }; } } }; };
const noLimit = async () => ({ limited: false, checked: true });
const okFetch = async () => ({ ok: true, json: async () => ({ min_width: 23, max_width: 118, min_height: 24, max_height: 120 }) });
const run = async (b, o = {}) => { const res = fakeRes(); const resend = o.resend || mkResend(); await handleQuote(req(b, o.headers), res, { env: o.env || env, resend, rateLimit: o.rateLimit || noLimit }); return { res, resend }; };

// ---------- the order endpoint ----------
let r = await run(body());
check('a good order is sent (internal email and customer copy) and answers ok', r.res.code === 200 && r.res.body.ok && r.resend.sent.length === 2, `${r.res.code} ${JSON.stringify(r.res.body)}`);
r = await run({ ...body(), zx_kv_q7: 'http://spam.example' });
import { readFileSync } from 'node:fs';
check('the spam-trap field name is meaningless (not name, email, phone, website, url or address)', !/name|email|phone|website|url|address|mail|tel/i.test(SPAM_TRAP), SPAM_TRAP);
check('both forms send the spam-trap field under the same name the server checks', ['src/customer.jsx', 'src/orderpage.jsx'].every((f) => readFileSync(f, 'utf8').includes(`name="${SPAM_TRAP}"`)));
check('the hidden spam-trap field: nothing is sent and it is never answered "ok"', r.res.code === 400 && !r.res.body.ok && r.resend.sent.length === 0);
r = await run(body(), { headers: { 'content-length': '999999' } });
check('a request over the size cap is refused (413) and nothing is sent', r.res.code === 413 && r.resend.sent.length === 0);
r = await run(body({ notes: 'x'.repeat(250000) }));
check('a huge body without a content-length header is refused too', r.res.code === 413);
r = await run(body({ lines: Array.from({ length: 51 }, () => line()) }));
check('more than 50 items is refused (400) with a clear message', r.res.code === 400 && /up to 50 items/.test(r.res.body.error) && r.resend.sent.length === 0, r.res.body?.error);
r = await run(body({ lines: Array.from({ length: 50 }, () => line()) }));
check('exactly 50 items is accepted', r.res.code === 200);
for (const q of [0, 100, 1.5, -2, 'abc', null]) { r = await run(body({ lines: [line({ qty: q })] })); check(`quantity ${JSON.stringify(q)} is refused (must be a whole number from 1 to 99)`, r.res.code === 400 && /1 to 99/.test(r.res.body.error), r.res.body?.error); }
r = await run(body({ lines: [line({ qty: 99 })] })); check('quantity 99 is accepted', r.res.code === 200);
r = await run(body({ lines: [line({ qty: '3' })] })); check('quantity "3" (text) is read as the number 3', r.res.code === 200 && /, 3 blinds/.test(r.resend.sent[0].html));
r = await run(body({ lines: [line({ width: -5 })] })); check('a negative width is refused', r.res.code === 400);
r = await run(body({ lines: [line({ length: 100000 })] })); check('an absurd height is refused', r.res.code === 400);
r = await run(body({ customer: { ...body().customer, email: 'not an email' } })); check('an invalid email is refused', r.res.code === 400 && /valid email/.test(r.res.body.error));
r = await run(body({ customer: { ...body().customer, name: '' } })); check('a missing name is refused', r.res.code === 400);
r = await run(body({ customer: { ...body().customer, name: { x: 1 } } })); check('a name that is not text is refused, not a crash', r.res.code === 400);
r = await run(body({ notes: 'n'.repeat(5000) }));
check('notes are cut to 2,000 characters in the email', r.res.code === 200 && !r.resend.sent[0].html.includes('n'.repeat(2001)) && r.resend.sent[0].html.includes('n'.repeat(2000)));
r = await run(body({ customer: { ...body().customer, name: 'Eve\r\nBcc: victim@example.com' } }));
check('a line break in the name cannot add an email header (the subject is one line)', !/[\r\n]/.test(r.resend.sent[0].subject), JSON.stringify(r.resend.sent[0].subject));
check('replies to the order email go to the customer', r.resend.sent[0].replyTo === 'ada@example.com');
r = await run(body(), { rateLimit: async () => ({ limited: true, checked: true }) });
check('over the rate limit: 429 with our phone and email, and nothing is sent', r.res.code === 429 && /262-434-0949/.test(r.res.body.error) && /loveblindswindows@gmail\.com/.test(r.res.body.error) && r.resend.sent.length === 0, r.res.body?.error);
r = await run(body(), { resend: mkResend({ error: true }) });
check('if the email service refuses the order, the customer is told (it is not shown as sent)', r.res.code === 500 && /262-434-0949/.test(r.res.body.error) && !/boom/.test(r.res.body.error), JSON.stringify(r.res.body));
r = await run(body(), { env: { ...env, RESEND_API_KEY: '' } });
check('no email service set up: a clear error, not a crash', r.res.code === 500);

// ---------- the rate limiter ----------
const calls = [];
const rl = await rateLimit([{ key: `order:ip:${digest('203.0.113.9')}`, limit: 5, windowSeconds: 3600 }, { key: `order:email:${digest('ada@example.com')}`, limit: 3, windowSeconds: 3600 }], { SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' }, async (u, o) => { calls.push(JSON.parse(o.body)); return { ok: true, json: async () => calls.length === 2 ? false : true }; });
check('the rate limiter counts both the IP and the email, and says limited when either is over', rl.limited === true && calls.length === 2 && calls[0].p_limit === 5 && calls[1].p_limit === 3 && calls.every((c) => c.p_window_seconds === 3600));
check('only hashes are stored: no raw IP address or email in the counter keys', calls.every((c) => !/203\.0\.113|ada@/.test(c.p_key)) && calls[0].p_key.startsWith('order:ip:'), calls.map((c) => c.p_key).join(' | '));
let fo = await rateLimit([{ key: 'k', limit: 1, windowSeconds: 60 }], { SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' }, async () => { throw new Error('down'); });
check('if the counter cannot be reached the request is allowed (fails open)', fo.limited === false && fo.checked === false);
fo = await rateLimit([{ key: 'k', limit: 1, windowSeconds: 60 }], { SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' }, async () => ({ ok: false, status: 404 }));
check('if migration 13 is not applied yet (404) the request is allowed', fo.limited === false);
check('limits are the ones asked for: 5 orders an hour per IP, 3 per email, 50 items, 99 each', LIMITS.orderPerIpHour === 5 && LIMITS.orderPerEmailHour === 3 && LIMITS.items === 50 && LIMITS.qty === 99);

// ---------- sizes on the server ----------
let msg = await checkSizes([line({ width: 20 })], { SUPABASE_URL: 'http://x', VITE_SUPABASE_ANON_KEY: 'k' }, okFetch);
check('the server refuses a width below the smallest we can make', /Item 1: The smallest we can make is 23 inches wide\./.test(msg), msg);
msg = await checkSizes([line(), line({ length: 10 })], { SUPABASE_URL: 'http://x', VITE_SUPABASE_ANON_KEY: 'k' }, okFetch);
check('...and a height below the smallest, naming the item', /Item 2: The smallest we can make is 24 inches high\./.test(msg), msg);
msg = await checkSizes([line({ width: 500 })], { SUPABASE_URL: 'http://x', VITE_SUPABASE_ANON_KEY: 'k' }, okFetch);
check('a size above the largest is not refused (the price comes by email)', msg === null);
msg = await checkSizes([line({ width: 5 })], { SUPABASE_URL: 'http://x', VITE_SUPABASE_ANON_KEY: 'k' }, async () => { throw new Error('down'); });
check('if the limits cannot be read the order is not blocked', msg === null);
const res2 = fakeRes(); const resend2 = mkResend();
await handleQuote(req(body({ lines: [line({ width: 20 })] })), res2, { env: { ...env, SUPABASE_URL: 'http://x', VITE_SUPABASE_ANON_KEY: 'k' }, resend: resend2, rateLimit: noLimit, fetch: okFetch });
check('an order with a too-small item is answered 400 and nothing is sent', res2.code === 400 && /smallest we can make/.test(res2.body.error) && resend2.sent.length === 0, res2.body?.error);

// ---------- the contact endpoint ----------
const cbody = (o = {}) => ({ name: 'Ada', email: 'ada@example.com', phone: '555', topic: 'General question', subject: 'Hello\r\nBcc: x@y.z', message: 'Hi <b>there</b>', ...o });
const stores = [];
const cfetch = (ok = true) => async (u, o) => { stores.push(JSON.parse(o.body)); return { ok, status: ok ? 201 : 404 }; };
const crun = async (b, o = {}) => { const res = fakeRes(); const resend = o.resend || mkResend(); await handleContact(req(b, o.headers), res, { env: o.env || { ...env, SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' }, resend, fetch: o.fetch || cfetch(true), rateLimit: o.rateLimit || noLimit }); return { res, resend }; };
let c = await crun(cbody());
check('contact: a good message is emailed to us and stored, answered ok', c.res.code === 200 && c.res.body.ok && c.res.body.emailed && c.res.body.stored && c.resend.sent[0].to === 'loveblindswindows@gmail.com' && stores.at(-1).emailed === true && stores.at(-1).phone === '555', JSON.stringify(c.res.body));
check('contact: replies go to the customer, the subject is one line, HTML is escaped', c.resend.sent[0].replyTo === 'ada@example.com' && !/[\r\n]/.test(c.resend.sent[0].subject) && c.resend.sent[0].html.includes('&lt;b&gt;there&lt;/b&gt;') && !c.resend.sent[0].html.includes('<b>there'));
stores.length = 0;
c = await crun(cbody({ zx_kv_q7: 'x' })); check('contact: the spam-trap field sends and stores nothing and is never answered ok', c.res.code === 400 && !c.res.body.ok && c.resend.sent.length === 0 && stores.length === 0 && /loveblindswindows@gmail\.com/.test(c.res.body.error));
// every refusal: an error, a message for the right field, nothing sent, nothing stored, never ok
for (const [label, patch, field, re] of [
  ['no email', { email: '' }, 'email', /enter your email so we can reply/], ['a missing email field', { email: undefined }, 'email', /enter your email/],
  ['a bad email', { email: 'nope' }, 'email', /valid email/], ['an email with no dot', { email: 'ada@example' }, 'email', /valid email/],
  ['no name', { name: '' }, 'name', /enter your name/], ['a blank name', { name: '   ' }, 'name', /enter your name/],
  ['no message', { message: '' }, 'message', /write your message/], ['a blank message', { message: '  \n ' }, 'message', /write your message/],
]) {
  stores.length = 0; c = await crun(cbody(patch));
  check(`contact: ${label} is refused with a message under the right field, nothing sent or stored, never ok`, c.res.code === 400 && !c.res.body.ok && re.test(c.res.body.fields?.[field] || '') && c.resend.sent.length === 0 && stores.length === 0, JSON.stringify(c.res.body));
}
stores.length = 0; c = await crun({}); check('contact: an empty request lists all three missing fields', c.res.code === 400 && Object.keys(c.res.body.fields).sort().join() === 'email,message,name' && c.resend.sent.length === 0);
c = await crun(cbody({ phone: '' })); check('contact: the phone number stays optional', c.res.code === 200 && c.res.body.ok);
stores.length = 0; c = await crun(cbody({ topic: 'Question about a quote' }));
check('contact: a page opened before the rename (old topic name) still works and is saved under the new name', c.res.code === 200 && c.res.body.ok && stores.at(-1).topic === 'Question about an order or estimate');
c = await crun(cbody({ message: 'x'.repeat(5001) })); check('contact: a message over 5,000 characters is refused', c.res.code === 400 || c.res.code === 413);
c = await crun(cbody(), { headers: { 'content-length': '50000' } }); check('contact: a request over the size cap is refused (413)', c.res.code === 413);
c = await crun(cbody(), { rateLimit: async () => ({ limited: true }) }); check('contact: over the rate limit: 429 and nothing sent', c.res.code === 429 && c.resend.sent.length === 0);
stores.length = 0; c = await crun(cbody(), { resend: mkResend({ error: true }) });
check('contact: if the email to us fails, it is an error with our email and phone and no confirmation (the message is still kept, marked not emailed)', c.res.code === 502 && !c.res.body.ok && !c.res.body.emailed && /loveblindswindows@gmail\.com/.test(c.res.body.error) && /262-434-0949/.test(c.res.body.error) && c.resend.sent.length === 1 && stores.length === 1 && stores[0].emailed === false);
c = await crun(cbody(), { env: { ...env, RESEND_API_KEY: '', SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' } });
check('contact: with no email service set up it is an error, not "received"', c.res.code === 502 && !c.res.body.ok);
c = await crun(cbody(), { resend: { sent: [], emails: { send: async () => { throw new Error('network'); } } } });
check('contact: if the email service throws, it is an error', c.res.code === 502 && !c.res.body.ok);
// our email went out but saving fails: it reached us, so it IS received; the failure is logged and tried once more
stores.length = 0; const logged = []; const realErr = console.error; console.error = (...a) => logged.push(a.join(' '));
c = await crun(cbody(), { fetch: cfetch(false) });
console.error = realErr;
check('contact: email went out but saving failed (database error): "received" (ok), the confirmation still goes, the failure is logged, saving was tried twice', c.res.code === 200 && c.res.body.ok === true && c.res.body.emailed === true && c.res.body.stored === false && c.res.body.confirmation === true && c.resend.sent.length === 2 && stores.length === 2 && logged.filter((l) => /not stored/.test(l)).length === 2, JSON.stringify(c.res.body));
let n = 0; stores.length = 0;
c = await crun(cbody(), { fetch: async (u, o) => { n++; stores.push(JSON.parse(o.body)); return n === 1 ? { ok: false, status: 500 } : { ok: true, status: 201 }; } });
check('contact: if the first save fails and the retry works, it is saved and ok', c.res.code === 200 && c.res.body.ok && c.res.body.stored === true && stores.length === 2);
console.error = () => {}; c = await crun(cbody(), { fetch: async () => { throw new Error('db down'); } }); 
check('contact: email went out but the database cannot be reached: still "received"', c.res.code === 200 && c.res.body.ok && c.res.body.emailed && !c.res.body.stored);
c = await crun(cbody(), { env: { ...env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' } }); console.error = realErr;
check('contact: email went out but the database is not set up: still "received"', c.res.code === 200 && c.res.body.ok && c.res.body.emailed && !c.res.body.stored);
c = await crun(cbody(), { resend: mkResend({ error: true }), fetch: cfetch(false) });
check('contact: if both fail, it is an error with our email and phone', c.res.code === 502 && !c.res.body.ok && /loveblindswindows@gmail\.com/.test(c.res.body.error) && /262-434-0949/.test(c.res.body.error), c.res.body?.error);
stores.length = 0; c = await crun(cbody({ name: 'Grace Hopper', email: 'grace@example.com' }));
check('contact: a valid message reaches us, is saved, and the customer gets the confirmation, and only then ok', c.res.code === 200 && c.res.body.ok === true && c.res.body.emailed && c.res.body.stored && c.res.body.confirmation && stores.length === 1 && stores[0].email === 'grace@example.com' && stores[0].emailed === true && c.resend.sent.length === 2 && c.resend.sent[0].to === 'loveblindswindows@gmail.com' && c.resend.sent[1].to === 'grace@example.com');

// ---------- the confirmation to the customer ----------
const WORDING = (n) => `Hi ${n}, thanks for reaching out to Love’s Blinds. We got your message and will reply within 1 business day. If it’s urgent, call us at (262) 434-0949. If you didn’t send us a message, you can ignore this email.`;
c = await crun(cbody({ name: 'Ada Lovelace', message: 'Secret project: 120 inch curtains http://evil.example', subject: 'Order 4411', phone: '555-0199' }));
const conf = c.resend.sent[1];
check('contact confirmation: sent after our own copy, to the customer, reply-to our address, fixed subject', c.resend.sent.length === 2 && c.resend.sent[0].to === 'loveblindswindows@gmail.com' && conf.to === 'ada@example.com' && conf.replyTo === 'loveblindswindows@gmail.com' && conf.subject === CONFIRMATION_SUBJECT && c.res.body.confirmation === true, `${c.resend.sent.length} emails`);
check('contact confirmation: exactly the agreed wording with only the first name filled in (HTML and plain text)', conf.text === WORDING('Ada') && conf.html.includes(WORDING('Ada').replace(/’/g, '’')) && confirmationText('Ada Lovelace') === WORDING('Ada'));
check('contact confirmation: nothing else they typed is in it (not the message, subject, phone, last name or topic)', !/Secret|evil|curtains|4411|0199|Lovelace|General question/.test(conf.html + conf.text + conf.subject));
check('contact confirmation: it has the same look as the order confirmation (Georgia heading, grey signature)', /font-family:Georgia,serif;color:#2c2c2a/.test(conf.html) && /color:#888;font-size:12px/.test(conf.html) && /Loves Blinds and Window Treatments/.test(conf.html));
check('contact confirmation: it is sent whatever SEND_CUSTOMER_CONFIRMATION says (off, and on)', (await crun(cbody(), { env: { ...env, SEND_CUSTOMER_CONFIRMATION: 'false', SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' } })).resend.sent.length === 2 && (await crun(cbody(), { env: { ...env, SEND_CUSTOMER_CONFIRMATION: undefined, SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' } })).resend.sent.length === 2);
const hostile = [['Eve <script>alert(1)</script> Smith', 'Eve'], ['<b>http://evil.example/pay', 'bhttpevilexamplepay'], ['12345 6789', 'there'], ['', 'there'], ['José-María Núñez', 'José-María'], ['A'.repeat(80), 'A'.repeat(50)]];
for (const [typed, expected] of hostile) check(`contact confirmation: the first name from ${JSON.stringify(typed).slice(0, 40)} is "${expected.length > 20 ? expected.slice(0, 8) + '…' : expected}" (letters only, at most 50)`, firstName(typed) === expected && firstName(typed).length <= 50, firstName(typed).slice(0, 60));
c = await crun(cbody({ name: 'Eve <script>alert(1)</script> Smith' })); const hc = c.resend.sent[1];
check('contact confirmation: markup in the name cannot get into the email', !/<script|alert|Smith/.test(hc.html + hc.text) && hc.text === WORDING('Eve'));
c = await crun(cbody({ name: 'M'.repeat(60) + ' Rest' })); check('contact confirmation: a very long name is cut to 50 characters', c.resend.sent[1].text.startsWith(`Hi ${'M'.repeat(50)}, thanks`));
c = await crun(cbody(), { resend: (() => { const sent = []; return { sent, emails: { send: async (m) => { sent.push(m); return sent.length === 1 ? { error: { message: 'boom' } } : { data: { id: 'x' } }; } } }; })() });
check('contact confirmation: if our own copy failed, no confirmation goes to the customer', c.resend.sent.length === 1 && !c.res.body.ok && !c.res.body.confirmation, `${c.resend.sent.length} email attempts`);
c = await crun(cbody(), { resend: (() => { const sent = []; return { sent, emails: { send: async (m) => { sent.push(m); return sent.length === 2 ? { error: { message: 'boom' } } : { data: { id: 'x' } }; } } }; })() });
check('contact confirmation: if only the confirmation fails, the message still counts as received', c.res.code === 200 && c.res.body.ok && c.res.body.emailed && c.res.body.confirmation === false);
c = await crun(cbody(), { rateLimit: async () => ({ limited: true }) }); check('contact confirmation: the rate limits (IP and email) stand in front of it: nothing at all is sent when limited', c.res.code === 429 && c.resend.sent.length === 0);
c = await crun({ ...cbody(), zx_kv_q7: 'x' }); check('contact confirmation: the spam trap stops it too', c.resend.sent.length === 0);
c = await crun(cbody({ email: 'victim@example.com' })); check('contact confirmation: it goes only to the address in the form, once', c.resend.sent.filter((m) => m.to === 'victim@example.com').length === 1);

// ---------- no em dashes in any email (subjects or bodies) ----------
{
  const dash = (m) => /—|&mdash;|&#8212;|&#x2014;/i.test(`${m.subject}\n${m.html || ''}\n${m.text || ''}`);
  const o = await run(body()); const cc = await crun(cbody({ topic: 'Question about an order or estimate', subject: 'Order status' }));
  const all = [...o.resend.sent, ...cc.resend.sent];
  check('emails: the order emails (internal and customer) and contact emails (internal and customer) were all produced', o.resend.sent.length === 2 && cc.resend.sent.length === 2 && all.length === 4);
  check('emails: no em dash in any subject or body (order internal and customer, contact internal and customer)', !all.some(dash), all.filter(dash).map((m) => m.subject).join(' / '));
  check('emails: the contact confirmation subject is "Thanks for your message | Love’s Blinds"', cc.resend.sent[1].subject === 'Thanks for your message | Love’s Blinds' && CONFIRMATION_SUBJECT === cc.resend.sent[1].subject);
  check('emails: the order subjects are "New order | [name]" (internal) and "Your order estimate | Love’s Blinds" (customer)', /^New order \| \S/.test(o.resend.sent[0].subject) && o.resend.sent[1].subject === 'Your order estimate | Love’s Blinds', `${o.resend.sent[0].subject} / ${o.resend.sent[1].subject}`);
  check('emails: no leftover "quote request" wording in the order emails (subjects, bodies, attachment name)', !o.resend.sent.some((m) => /quote[ -]?request/i.test(`${m.subject}\n${m.html}\n${(m.attachments || []).map((a) => a.filename).join()}`)) && /^order-.*\.xlsx$/.test(o.resend.sent[0].attachments[0].filename));
  check('emails: the customer email says we received the order and will email the final price within 48 hours', /received your order and will email your final price to/.test(o.resend.sent[1].html) && /<h2[^>]*>New order<\/h2>/.test(o.resend.sent[0].html));
  check('emails: the internal subjects use a pipe', o.resend.sent[0].subject === 'New order | Ada' || /^New order \| /.test(o.resend.sent[0].subject) && /^Website message: Question about an order or estimate \| Order status$/.test(cc.resend.sent[0].subject), `${o.resend.sent[0].subject} / ${cc.resend.sent[0].subject}`);
  check('emails: no em dash anywhere in the email code in api/', !/—|&mdash;/.test(readFileSync('api/quote.js', 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n') + readFileSync('api/contact.js', 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')));
}

const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
