// POST /api/contact: a message from the Contact page. It is emailed to us through Resend (the way orders are) and stored in the
// `messages` table (migration 13; readable by admins only). It counts as received ONLY when our email went out (a save that fails
// is logged and tried once more, but the customer is not told it failed, since it reached us); if our email did not go out the
// customer gets an error with our email and phone, even if a copy was saved. Success is never faked. Same protection as the order form: a hidden spam-trap field, size
// limits and a rate limit per IP address and per email address.
import { Resend } from 'resend';
import { LIMITS, SPAM_TRAP, BUSINESS_EMAIL, BUSINESS_NAME, clientIp, digest, tooLarge, friendly, rateLimit, validEmail, oneLine } from './_guard.js';

const INTERNAL_TO = BUSINESS_EMAIL;
export const TOPICS = ['General question', 'Question about an order or estimate', 'Trade / wholesale'];
const OLD_TOPICS = { 'Question about a quote': 'Question about an order or estimate' };     // a page opened before the rename
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function validateMessage(body) {
  const b = body && typeof body === 'object' ? body : {};
  const name = text(b.name, LIMITS.name), email = text(b.email, LIMITS.email), message = text(b.message, 5000);
  const fields = {};
  if (!name) fields.name = 'Please enter your name so we know who to reply to.';
  if (!email) fields.email = 'Please enter your email so we can reply.';
  else if (!validEmail(email)) fields.email = 'Please enter a valid email address, like name@example.com.';
  if (!message) fields.message = 'Please write your message.';
  else if (typeof b.message === 'string' && b.message.trim().length > 5000) fields.message = 'Please keep your message under 5,000 characters.';
  if (Object.keys(fields).length) return { error: Object.values(fields)[0], fields };
  return {
    clean: {
      name, email, message,
      phone: text(b.phone, LIMITS.phone) || null,
      topic: TOPICS.includes(OLD_TOPICS[b.topic] || b.topic) ? (OLD_TOPICS[b.topic] || b.topic) : null,
      subject: oneLine(text(b.subject, 150), 150) || null,
    },
  };
}

export async function storeMessage(m, emailed, env = process.env, fetchFn = fetch) {
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('storage not configured');
  const res = await fetchFn(`${url}/rest/v1/messages`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ...m, emailed }),
  });
  if (!res.ok) throw new Error(`storing the message failed (${res.status})`);
}

export function messageHtml(m) {
  return `
    <h2 style="font-family:Georgia,serif;color:#2c2c2a">New message from the website</h2>
    <p><strong>Name:</strong> ${esc(m.name)}<br>
    <strong>Email:</strong> ${esc(m.email)}<br>
    ${m.phone ? `<strong>Phone:</strong> ${esc(m.phone)}<br>` : ''}
    ${m.topic ? `<strong>About:</strong> ${esc(m.topic)}<br>` : ''}
    ${m.subject ? `<strong>Subject:</strong> ${esc(m.subject)}` : ''}</p>
    <p style="white-space:pre-wrap">${esc(m.message)}</p>
    <p style="color:#666;font-size:13px">Reply to this email to answer ${esc(m.name)} directly.</p>`;
}

// ---- the confirmation to the customer -------------------------------------------------------------------------------------
// Fixed wording. The ONLY thing taken from the form is the first name, cut down to letters (so it cannot carry a link, markup or
// a sentence) and at most 50 characters. Nothing else they typed goes into it, so the form cannot be used to send our branded
// email with someone else's words.
export const FIRST_NAME_MAX = 50;
export function firstName(name) {
  const first = String(name ?? '').trim().split(/\s+/)[0] || '';
  const letters = first.replace(/[^\p{L}\p{M}'’-]/gu, '').slice(0, FIRST_NAME_MAX);
  return /\p{L}/u.test(letters) ? letters : 'there';
}
export const confirmationText = (name) =>
  `Hi ${firstName(name)}, thanks for reaching out to Love’s Blinds. We got your message and will reply within 1 business day. If it’s urgent, call us at (262) 434-0949. If you didn’t send us a message, you can ignore this email.`;

// Same look as the order confirmation email (a Georgia heading, plain text, a small grey signature).
export function confirmationHtml(name) {
  return `
    <h2 style="font-family:Georgia,serif;color:#2c2c2a">Love’s Blinds</h2>
    <p>${esc(confirmationText(name))}</p>
    <p style="color:#888;font-size:12px">${BUSINESS_NAME}</p>
  `;
}
export const CONFIRMATION_SUBJECT = 'Thanks for your message | Love’s Blinds';

const FAILED = `We could not send your message just now. Please email us at ${BUSINESS_EMAIL} or call 262-434-0949.`;

export async function handleContact(req, res, deps = {}) {
  const env = deps.env || process.env;
  const fetchFn = deps.fetch || fetch;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (tooLarge(req, LIMITS.contactBytes)) return res.status(413).json({ error: friendly('That message is too large to send.') });
  // spam trap: send nothing, and never say "received" (a browser that auto-fills the hidden field gets our contact details)
  if (req.body && typeof req.body === 'object' && req.body[SPAM_TRAP]) return res.status(400).json({ error: FAILED });

  const checked = validateMessage(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error, fields: checked.fields });
  const m = checked.clean;

  const limited = await (deps.rateLimit || rateLimit)([
    { key: `contact:ip:${digest(clientIp(req))}`, limit: LIMITS.contactPerIpHour, windowSeconds: 3600 },
    { key: `contact:email:${digest(m.email)}`, limit: LIMITS.contactPerEmailHour, windowSeconds: 3600 },
  ], env, fetchFn);
  if (limited.limited) return res.status(429).json({ error: friendly('Too many messages were sent from this connection or email address in the last hour.') });

  let emailed = false, stored = false;
  try {
    if (env.RESEND_API_KEY) {
      const resend = deps.resend || new Resend(env.RESEND_API_KEY);
      const r = await resend.emails.send({
        from: "Love's Blinds <quotes@lovesblinds.com>", to: INTERNAL_TO, replyTo: m.email,
        subject: oneLine(`Website message${m.topic ? `: ${m.topic}` : ''} | ${m.subject || m.name}`),
        html: messageHtml(m),
      });
      if (r?.error) throw new Error(r.error.message || 'email failed');
      emailed = true;
    }
  } catch (err) { console.error('[api/contact] email failed:', err?.message || err); }
  // the customer's confirmation: only after our own copy went out, whatever the order-email setting says
  let confirmation = false;
  if (emailed) {
    try {
      const resend = deps.resend || new Resend(env.RESEND_API_KEY);
      const r = await resend.emails.send({
        from: "Love's Blinds <quotes@lovesblinds.com>", to: m.email, replyTo: BUSINESS_EMAIL,
        subject: CONFIRMATION_SUBJECT, html: confirmationHtml(m.name), text: confirmationText(m.name),
      });
      if (r?.error) throw new Error(r.error.message || 'email failed');
      confirmation = true;
    } catch (err) { console.error('[api/contact] confirmation not sent:', err?.message || err); }       // we have the message; only the reply is missing
  }
  // saving (also when the email failed, so we still have the message): one more try if the first fails. If it still fails but our
  // email went out, the message has reached us, so it counts as received
  for (let attempt = 1; attempt <= 2 && !stored; attempt++) {
    try { await storeMessage(m, emailed, env, fetchFn); stored = true; } catch (err) { console.error(`[api/contact] not stored (try ${attempt}; ${emailed ? 'it was emailed to us' : 'and the email failed too'}):`, err?.message || err); }
  }

  if (!emailed) return res.status(502).json({ error: FAILED });
  return res.status(200).json({ ok: true, emailed, stored, confirmation });
}

export default function handler(req, res) { return handleContact(req, res); }
