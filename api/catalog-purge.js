// POST /api/catalog-purge   { "lines": ["roller", "roman"] }   Authorization: Bearer <the admin's session token>
// Clears the edge-cached catalog (api/catalog.js) for those lines so a change made in /admin shows to the next visitor
// instead of after the 60-second cache. Only a signed-in admin may call it: the token is checked by asking Supabase
// is_admin() with it (the same function every table policy uses). A failed clear is harmless; the cache expires on its own.
import { dangerouslyDeleteByTag } from '@vercel/functions';
import { LINE_SCOPE } from '../src/data/catalogQuery.js';

const json = (res, status, body) => { res.setHeader('Cache-Control', 'no-store'); return res.status(status).json(body); };

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) return json(res, 500, { error: 'Not configured' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(res, 401, { error: 'Sign in first' });

  try {
    const who = await fetch(`${base}/rest/v1/rpc/is_admin`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!who.ok || (await who.json()) !== true) return json(res, 403, { error: 'Admins only' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    const asked = Array.isArray(body?.lines) ? body.lines : [];
    const lines = [...new Set(asked.filter((l) => typeof l === 'string' && Object.hasOwn(LINE_SCOPE, l)))];
    if (!lines.length) return json(res, 400, { error: 'No known lines' });

    // Only on Vercel does this reach the edge; anywhere else (local dev) there is no edge cache to clear.
    await dangerouslyDeleteByTag(lines.map((l) => `catalog-${l}`));
    return json(res, 200, { purged: lines, edge: !!process.env.VERCEL });
  } catch (err) {
    console.error('[api/catalog-purge]', err?.message || err);
    return json(res, 502, { error: 'Could not clear the cache' });
  }
}
