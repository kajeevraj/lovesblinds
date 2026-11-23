// A tiny local server for the swatch photos (and option pictures): the site built for tests reads them from here instead of from the LIVE Supabase project.
//   node scripts/image-server.mjs [port]      default 4177; serves  /storage/v1/object/public/<bucket>/<path>
// Lookup: the local copy (.image-cache, see scripts/image-cache.mjs), else the STAGING project's storage (pictures a staging test uploaded itself), else 404.
// It NEVER asks the live project. scripts/run-tests.mjs starts it and builds the test sites with VITE_IMAGE_BASE_URL pointing at it.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
const { parseStoragePath, readCached, stagingFile, mimeOf, CACHE_DIR } = await import('../supabase/tests/lib/imageCache.mjs');

export function startImageServer(port = Number(process.env.LB_IMAGE_PORT) || 4177) {
  const stats = { served: 0, staging: 0, missing: 0 };
  const server = createServer(async (req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'cross-origin-resource-policy': 'cross-origin' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const p = parseStoragePath(new URL(req.url, 'http://x').pathname);
    if (!p || !/^(GET|HEAD)$/.test(req.method)) { res.writeHead(404, cors); res.end(); return; }
    let buf = readCached(p.bucket, p.path), from = 'cache';
    if (!buf) { buf = await stagingFile(p.bucket, p.path); from = 'staging'; }
    if (!buf) { stats.missing++; res.writeHead(404, cors); res.end('not in the local image copy'); return; }
    stats[from === 'cache' ? 'served' : 'staging']++;
    res.writeHead(200, { ...cors, 'content-type': mimeOf(p.path), 'content-length': buf.length, 'cache-control': 'public, max-age=3600' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
  return new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', () => ok({ server, port, stats, url: `http://localhost:${port}` })); });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await startImageServer(Number(process.argv[2]) || undefined);
  console.log(`image server on ${s.url} (local copy ${CACHE_DIR}; the live project is never asked)`);
}
