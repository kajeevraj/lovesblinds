// POST /api/contact: a message from the Contact page. It is emailed to us through Resend (the way orders are) and stored in the
// `messages` table (migration 13; readable by admins only). It counts as received when at least one of the two worked; if both
// fail the customer is told and given our email and phone. Same protection as the order form: a hidden spam-trap field, size
// limits and a rate limit per IP address and per email address.
import { Resend } from 'resend';
import { LIMITS, SPAM_TRAP, BUSINESS_EMAIL, clientIp, digest, tooLarge, friendly, rateLimit, validEmail, oneLine } from './_guard.js';

const INTERNAL_TO = BUSINESS_EMAIL;
export const TOPICS = ['General question', 'Question about a quote', 'Trade / wholesale'];
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function validateMessage(body) {
  const b = body && typeof body === 'object' ? body : {};
  const name = text(b.name, LIMITS.name), email = text(b.email, LIMITS.email), message = text(b.message, 5000);
  if (!name) return { error: 'Please enter your name.' };
  if (!validEmail(email)) return { error: 'Please enter a valid email address.' };
  if (!message) return { error: 'Please write your message.' };
  if (typeof b.message === 'string' && b.message.trim().length > 5000) return { error: 'Please keep your message under 5,000 characters.' };
  return {
    clean: {
      name, email, message,
      phone: text(b.phone, LIMITS.phone) || null,
      topic: TOPICS.includes(b.topic) ? b.topic : null,
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

export async function handleContact(req, res, deps = {}) {
  const env = deps.env || process.env;
  const fetchFn = deps.fetch || fetch;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (tooLarge(req, LIMITS.contactBytes)) return res.status(413).json({ error: friendly('That message is too large to send.') });
  if (req.body && typeof req.body === 'object' && req.body[SPAM_TRAP]) return res.status(200).json({ ok: true });     // spam trap: say "ok", send nothing

  const checked = validateMessage(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
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
        subject: oneLine(`Website message${m.topic ? `: ${m.topic}` : ''} — ${m.subject || m.name}`),
        html: messageHtml(m),
      });
      if (r?.error) throw new Error(r.error.message || 'email failed');
      emailed = true;
    }
  } catch (err) { console.error('[api/contact] email failed:', err?.message || err); }
  try { await storeMessage(m, emailed, env, fetchFn); stored = true; } catch (err) { console.error('[api/contact] not stored:', err?.message || err); }

  if (!emailed && !stored) return res.status(502).json({ error: `We could not send your message just now. Please email us at ${BUSINESS_EMAIL} or call 262-434-0949.` });
  return res.status(200).json({ ok: true, emailed, stored });
}

export default function handler(req, res) { return handleContact(req, res); }
