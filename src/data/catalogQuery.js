// The one place that says what a line page asks Supabase for. Pure (no bundler APIs): the Vite plugin in
// vite.config.js also imports it to build the early-fetch script in index.html, so the page and that script
// can never ask for different things.
//
// One request per line page: the line's fabrics with their swatches embedded. Row Level Security returns
// active rows only, so hidden swatches never reach the browser.

const FABRIC_COLS = 'id,product_line,shown_in,family,collection_name,width,composition,weight,thickness,openness,opacity,use_area,extra_specs,sort_order';
const SWATCH_COLS = 'id,fabric_id,product_line,shown_in,family,display_name,supplier_code,supplier_color_name,color_family,image_path,thumb_path,image_kind,grade,width,composition,roman_styles,styles,sort_order';

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

// Path and query, no host and no key.
export const catalogPath = (lineKey) => {
  const scope = LINE_SCOPE[lineKey];
  if (!scope) throw new Error(`unknown catalog line: ${lineKey}`);
  const select = `${FABRIC_COLS},swatches(${SWATCH_COLS})`;
  return `/rest/v1/fabrics?select=${encodeURIComponent(select)}&shown_in=ov.${encodeURIComponent(`{${scope.join(',')}}`)}`
    + '&order=product_line,sort_order&swatches.order=sort_order';
};

// Where a stored image path is served from (the public "swatches" bucket).
export const storageUrl = (base, path) => `${base}/storage/v1/object/public/swatches/${path.split('/').map(encodeURIComponent).join('/')}`;
