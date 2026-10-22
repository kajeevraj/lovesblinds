// The title, description, share picture and structured data of every page. One place, used twice: by the app (it updates the browser
// tab and the tags while you move between pages) and by the build (vite.config.js writes a copy of index.html for every page with
// these tags already in it, so Google and the apps that make link previews, which do not run the site's scripts, see them too).
// Nothing here is a price or anything from the supplier: only what a customer already sees on the site.
export const SITE_URL = 'https://lovesblinds.com';
export const SITE_NAME = "Love's Blinds";
export const OG_IMAGE = '/og-image.jpg';             // the homepage hero, cropped to 1200 x 630 (scripts/build_site_photos.js)
export const PHONE = '+1-262-434-0949';

const title = (t) => `${t} | ${SITE_NAME}`;

export const PAGES = {
  home: { path: '/', title: `${SITE_NAME} | Custom made-to-measure window treatments`, description: 'Custom roller, zebra, Shangri-La, Roman and cellular shades and drapery, made to your measurements. See your price as you build, then send us your order.' },
  products: { path: '/products', title: title('Choose your style'), description: 'Six ways to dress a window: roller, zebra, Shangri-La, Roman and cellular shades, and drapery. Pick a style, choose a color and see your estimate.' },
  measure: { path: '/measure', title: title('How to measure for blinds and shades'), description: 'A step-by-step guide to measuring your windows for inside or outside mount blinds, shades and drapery. All you need is a tape measure and ten minutes.' },
  contact: { path: '/contact', title: title('Contact us'), description: 'Questions about a fabric, a window or an order? Send us a message or call (262) 434-0949. We reply within 1 business day.' },
  // pages that belong to one customer or one order: not for search results
  quote: { path: '/order', title: title('Your order'), description: 'Check your blinds, add your details and send your order. No payment is taken now.', noindex: true },
  review: { path: '/review', title: title('Your order'), description: 'Check your blinds, add your details and send your order. No payment is taken now.', noindex: true },
  orders: { path: '/orders', title: title('My orders'), description: 'Your saved and sent orders.', noindex: true },
  profile: { path: '/profile', title: title('Your profile'), description: 'Your name, phone and shipping address.', noindex: true },
  admin: { path: '/admin', title: title('Admin'), description: 'Admin.', noindex: true },
};

// photo = the file name in public/images/site (see src/data/sitePhotos.json)
export const LINE_PAGES = {
  roller: { name: 'Roller Shades', photo: 'blackout', description: 'Custom roller shades made to your size in solar, screen view and full blackout fabrics, single or double stack. See your price as you choose.' },
  zebra: { name: 'Zebra Shades', photo: 'zebra-dining', description: 'Custom zebra shades with alternating sheer and solid stripes. Slide them to let light in or close them for privacy. Made to your size.' },
  'shangri-la': { name: 'Shangri-La Shades', photo: 'shangri-la', description: 'Custom Shangri-La shades: soft fabric vanes floating between two sheers. Tilt for gentle, even light. Made to your size.' },
  roman: { name: 'Roman Shades', photo: 'roman', description: 'Custom Roman shades in soft fabrics that stack into neat, tailored folds when raised. Made to your size.' },
  cellular: { name: 'Cellular Shades', photo: 'cellular', description: 'Custom cellular (honeycomb) shades that help keep rooms comfortable, with top-down options. Made to your size.' },
  drapery: { name: 'Drapery', photo: 'drapery', description: 'Custom curtains and Dream Curtains, the walk-through sheer for patio doors. Made to your measurements.' },
};

const abs = (p) => `${SITE_URL}${p}`;
const photoUrl = (name, photos) => { const p = photos?.[name]; return p ? abs(`/images/site/${name}-${p.widths[p.widths.length - 1]}.webp`) : abs(OG_IMAGE); };

// photos: the contents of src/data/sitePhotos.json (for the product picture)
export function metaFor(route, slug = null, photos = null) {
  if (route === 'line' && LINE_PAGES[slug]) {
    const l = LINE_PAGES[slug];
    const path = `/products/${slug}`;
    return {
      path, title: title(l.name), description: l.description, image: abs(OG_IMAGE), noindex: false,
      jsonLd: [{
        '@context': 'https://schema.org', '@type': 'Product', name: l.name, description: l.description, image: photoUrl(l.photo, photos),
        url: abs(path), category: 'Window treatments', brand: { '@type': 'Brand', name: SITE_NAME },
      }],
    };
  }
  const p = PAGES[route] || PAGES.home;
  const meta = { ...p, image: abs(OG_IMAGE), noindex: !!p.noindex, jsonLd: [] };
  if (route === 'home') {
    meta.jsonLd = [{ '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: abs('/favicon.svg'), telephone: PHONE, email: 'loveblindswindows@gmail.com' }];
  }
  return meta;
}

// the pages that go in the sitemap
export const sitemapPaths = (slugs = Object.keys(LINE_PAGES)) => ['/', '/products', ...slugs.map((s) => `/products/${s}`), '/measure', '/contact'];

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// the <head> tags for a page (used by the build)
export function headTags(meta) {
  const url = abs(meta.path);
  const lines = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex, nofollow" />' : '',
    `<link rel="canonical" href="${esc(url)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(meta.image)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(meta.image)}" />`,
    ...meta.jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
  ];
  return lines.filter(Boolean).map((l) => `    ${l}`).join('\n');
}

// the app: keep the tab title and the tags in step with the page being shown
export function applyMeta(meta, doc = document) {
  doc.title = meta.title;
  const set = (sel, make, attr, value) => {
    let el = doc.head.querySelector(sel);
    if (!el) { el = make(); doc.head.appendChild(el); }
    el.setAttribute(attr, value);
  };
  const metaTag = (key, val) => () => { const m = doc.createElement('meta'); m.setAttribute(key, val); return m; };
  const url = abs(meta.path);
  set('meta[name="description"]', metaTag('name', 'description'), 'content', meta.description);
  set('link[rel="canonical"]', () => { const l = doc.createElement('link'); l.rel = 'canonical'; return l; }, 'href', url);
  for (const [prop, val] of [['og:title', meta.title], ['og:description', meta.description], ['og:url', url], ['og:image', meta.image]]) set(`meta[property="${prop}"]`, metaTag('property', prop), 'content', val);
  for (const [name, val] of [['twitter:title', meta.title], ['twitter:description', meta.description], ['twitter:image', meta.image]]) set(`meta[name="${name}"]`, metaTag('name', name), 'content', val);
  const robots = doc.head.querySelector('meta[name="robots"]');
  if (meta.noindex) set('meta[name="robots"]', metaTag('name', 'robots'), 'content', 'noindex, nofollow'); else robots?.remove();
  doc.head.querySelectorAll('script[type="application/ld+json"]').forEach((n) => n.remove());
  for (const j of meta.jsonLd || []) { const s = doc.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(j); doc.head.appendChild(s); }
}
