// The one place that says what a line page asks Supabase for. Pure (no bundler APIs): the Vite plugin in
// vite.config.js also imports it to build the early-fetch script in index.html, so the page and that script
// can never ask for different things.
//
// One request per line page: the database function public_catalog() returns the line's colors grouped for the picker. It
// is the ONLY public way to read the catalog: it carries no price group names or ids, no supplier color names, no grade and
// no extra cost, and it only lists active colors. It goes to /api/catalog first (cached at the edge) and to Supabase
// directly if that fails.

// Site line -> the `shown_in` values it lists. Roman and Drapery share records; the Drapery page also
// carries the Dream Curtains section.
export const LINE_SCOPE = {
  roller: ['roller'],
  zebra: ['zebra'],
  'shangri-la': ['shangri-la'],
  cellular: ['cellular'],
  roman: ['roman'],
  drapery: ['drapery', 'dream-curtains'],
};

// Path and query, no host and no key. A GET: the function is read-only, so no CORS preflight is needed.
export const catalogPath = (lineKey) => {
  const scope = LINE_SCOPE[lineKey];
  if (!scope) throw new Error(`unknown catalog line: ${lineKey}`);
  return `/rest/v1/rpc/public_catalog?p_scope=${encodeURIComponent(`{${scope.join(',')}}`)}`;
};

// Catalog line keys (the `line` of /api/catalog) that show a collection, from its shown_in values. The Drapery page carries Dream Curtains.
export const catalogLinesOf = (shownIn) => [...new Set((shownIn || []).map(v => (v === 'dream-curtains' ? 'drapery' : v)).filter(v => Object.hasOwn(LINE_SCOPE, v)))];

// The same data from our own edge-cached function (api/catalog.js): same origin, so no extra connection to wait for.
export const edgePath = (lineKey) => `/api/catalog?line=${encodeURIComponent(lineKey)}`;

// Where a stored image path is served from (the public "swatches" bucket).
export const storageUrl = (base, path) => `${base}/storage/v1/object/public/swatches/${path.split('/').map(encodeURIComponent).join('/')}`;

// Small tile picture, by naming rule: thumb/<line>/<name>.webp has a 200 px sibling at thumb200/<line>/<name>.webp
// (made when a color is uploaded in the admin, and for older colors by scripts/backfill-thumbs.mjs). No database column.
export const thumb200Path = (thumbPath) => (thumbPath ? thumbPath.replace(/^thumb\//, 'thumb200/').replace(/\.[^./]+$/, '.webp') : null);

// 256 px 3D fabric texture (room visualizer, product-page preview), by naming rule: thumb/<line>/<name>.webp has tex256/<line>/<name>.webp
// (made when a color is uploaded in the admin, and for older colors by scripts/backfill-textures.mjs). No database column.
export const tex256Path = (thumbPath) => (thumbPath ? thumbPath.replace(/^thumb\//, 'tex256/').replace(/\.[^./]+$/, '.webp') : null);
