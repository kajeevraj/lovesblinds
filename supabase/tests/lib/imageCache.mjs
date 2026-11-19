// A local copy of the swatch photos, so tests and screenshot scripts never load them from the LIVE Supabase project (its storage egress is limited).
//
//   cache:   .image-cache/<bucket>/<path>   (LB_IMAGE_CACHE=<dir> to move it). Filled by:  node scripts/image-cache.mjs fill
//   lookup:  cache, then the STAGING project's storage (STAGING_SUPABASE_URL; the files a staging test uploaded itself), never the live project.
//   served:  scripts/image-server.mjs (the site built for tests reads its pictures from it), routeLiveImages() (a Playwright context), imageBytes() (Node).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const CACHE_DIR = resolve(process.env.LB_IMAGE_CACHE || join(ROOT, '.image-cache'));
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif' };
export const mimeOf = (path) => MIME[String(path).split('.').pop().toLowerCase()] || 'application/octet-stream';

// /storage/v1/object/public/<bucket>/<path> (or the image-transform form) -> { bucket, path }
export function parseStoragePath(pathname) {
  const m = /^\/storage\/v1\/(?:object|render\/image)\/(?:public|authenticated)\/([^/]+)\/(.+)$/.exec(pathname || '');
  if (!m) return null;
  let path = m[2]; try { path = decodeURIComponent(path); } catch { /* keep as is */ }
  return { bucket: m[1], path };
}
export const parseStorageUrl = (urlStr) => { try { const u = new URL(urlStr); const p = parseStoragePath(u.pathname); return p && { ...p, host: u.host }; } catch { return null; } };

export function cacheFile(bucket, path) {
  const f = resolve(CACHE_DIR, bucket, path);
  return f.startsWith(CACHE_DIR + sep) ? f : null;                 // never outside the cache (no ../)
}
export const readCached = (bucket, path) => { const f = cacheFile(bucket, path); return f && existsSync(f) ? readFileSync(f) : null; };
export function writeCached(bucket, path, buf) { const f = cacheFile(bucket, path); if (!f) return false; mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, buf); return true; }

// The host of the LIVE project, whichever project this process talks to.
export function liveHost() {
  const t = String(process.env.LB_TARGET || '').toLowerCase();
  const url = process.env.LB_LIVE_URL || (t === 'staging' ? '' : process.env.SUPABASE_URL) || '';
  try { return new URL(url).host; } catch { return ''; }
}
const stagingBase = () => process.env.LB_IMAGE_FALLBACK_URL || process.env.STAGING_SUPABASE_URL || (String(process.env.LB_TARGET || '').toLowerCase() === 'staging' ? process.env.SUPABASE_URL : '') || '';

// A file from the STAGING project's public storage (never live). null when staging has no such file or is not configured.
const realFetch = globalThis.fetch;
export async function stagingFile(bucket, path) {
  const base = stagingBase(); if (!base) return null;
  try { if (new URL(base).host === liveHost()) return null; } catch { return null; }          // never the live project, whatever the variables say
  try {
    const r = await realFetch(`${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`);
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch { return null; }
}
// The bytes of a stored picture: from the cache, else from staging. Throws when neither has it (run: node scripts/image-cache.mjs fill).
export async function imageBytes(bucket, path) {
  const hit = readCached(bucket, path); if (hit) return hit;
  const st = await stagingFile(bucket, path); if (st) return st;
  throw new Error(`no local copy of ${bucket}/${path}: run  node scripts/image-cache.mjs fill`);
}
export const swatchBytes = (path) => imageBytes('swatches', path);

// A Playwright browser (scripts): every context and page it opens afterwards answers live storage pictures from the local copy.   withLocalImages(browser)
export function withLocalImages(b) {
  const nc = b.newContext.bind(b), np = b.newPage.bind(b);
  b.newContext = async (...a) => { const c = await nc(...a); await routeLiveImages(c); return c; };
  b.newPage = async (...a) => { const p = await np(...a); await routeLiveImages(p.context()); return p; };
  b.__lbGuarded = true;
  return b;
}

// A Playwright context or page: every request for a LIVE storage picture is answered from the local copy (the request never leaves this machine).
// `onHit(info)` is told about each one (the test guard counts them and fails the test in strict mode).
export async function routeLiveImages(target, onHit = null) {
  const lh = liveHost(); if (!lh) return;
  await target.route((u) => u.host === lh && !!parseStoragePath(u.pathname), async (route) => {
    const r = route.request(), p = parseStorageUrl(r.url());
    const verdict = onHit ? await onHit({ method: r.method(), url: r.url(), ...p }) : 'serve';
    if (verdict === 'live') { await route.fallback(); return; }
    const buf = r.method() === 'GET' || r.method() === 'HEAD' ? (readCached(p.bucket, p.path) || await stagingFile(p.bucket, p.path)) : null;
    if (!buf) { await route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: 'not in the local image copy' }); return; }
    await route.fulfill({ status: 200, body: r.method() === 'HEAD' ? '' : buf, headers: { 'content-type': mimeOf(p.path), 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=3600' } });
  });
}
