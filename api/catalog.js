// GET /api/catalog?line=zebra
// A line page's fabrics and swatches, read from Supabase and cached at Vercel's edge, so the page does not wait on a
// cross-origin request. Same query and same JSON as src/data/catalogQuery.js asks Supabase directly; the page falls back to
// Supabase itself if this function fails.
//
// Reads with the ANON key through public_catalog(): inactive colors never appear, and the response has no price group names,
// supplier color names, grades or extra costs. Never use the service role key here.
//
// Freshness: the edge keeps a response for 60 s, then may serve it once more while it refreshes in the background
// (stale-while-revalidate). The admin page clears the entry at once after a save (api/catalog-purge.js, by cache tag), so
// the 60 s is only the fallback if that clear fails.
// Browsers are told something different: they always ask the edge again (max-age=0), so a repeat visitor never holds a
// copy of their own. Vercel-CDN-Cache-Control is for Vercel's CDN only and is not sent on to the browser; the
// s-maxage=60 in Cache-Control is the same minute for any CDN that ignores the Vercel header.
import { LINE_SCOPE, catalogPath } from '../src/data/catalogQuery.js';

const BROWSER_CACHE = 'public, max-age=0, s-maxage=60';
const VERCEL_EDGE_CACHE = 'max-age=60, stale-while-revalidate=300';
const UPSTREAM_TIMEOUT_MS = 6000;

const fail = (res, status, error) => {
  res.setHeader('Cache-Control', 'no-store');          // never cache a failure
  return res.status(status).json({ error });
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed');

  const line = String(req.query?.line ?? '');
  if (!Object.hasOwn(LINE_SCOPE, line)) return fail(res, 400, 'Unknown line');

  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) return fail(res, 500, 'Catalog is not configured');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${base}${catalogPath(line)}`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, signal: ctl.signal });
    if (!upstream.ok) return fail(res, 502, `Catalog request failed (${upstream.status})`);
    const text = await upstream.text();
    const rows = JSON.parse(text);
    // An empty answer means something is wrong (a policy, a bad key), not that the line has no colors: do not cache it.
    if (!Array.isArray(rows) || !rows.some(r => (r.swatches || []).length)) return fail(res, 502, 'Catalog is empty');
    res.setHeader('Cache-Control', BROWSER_CACHE);
    res.setHeader('Vercel-CDN-Cache-Control', VERCEL_EDGE_CACHE);
    res.setHeader('Vercel-Cache-Tag', `catalog,catalog-${line}`);   // api/catalog-purge.js clears these when an admin saves
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(text);
  } catch (err) {
    console.error('[api/catalog]', line, err?.message || err);
    return fail(res, 502, 'Catalog is unavailable');
  } finally { clearTimeout(timer); }
}
