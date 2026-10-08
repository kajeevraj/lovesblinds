import { LEGACY_REDIRECTS, getActiveLine } from '../data/lines.js';

const ROUTE_PATHS = {
  home: '/',
  products: '/products',
  measure: '/measure',
  quote: '/order',
  review: '/review',
  orders: '/orders',
  contact: '/contact',
  admin: '/admin',
};
const PATH_ROUTES = Object.fromEntries(Object.entries(ROUTE_PATHS).map(([r, p]) => [p, r]));

export const pathFor = (route) => ROUTE_PATHS[route] || '/';

// The admin area ships only when the build sets VITE_ENABLE_ADMIN=true.
export const ADMIN_ENABLED = import.meta.env.VITE_ENABLE_ADMIN === 'true';

const clean = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';

// Returns { redirect } when the path should be replaced, else {}.
export function resolvePath(rawPath) {
  const path = clean(rawPath);
  if (LEGACY_REDIRECTS[path]) return { redirect: LEGACY_REDIRECTS[path] };
  if (path === '/admin' && !ADMIN_ENABLED) return { redirect: '/' };
  const m = path.match(/^\/products\/([^/]+)$/);
  if (m && !getActiveLine(m[1])) return { redirect: '/products' };   // inactive or unknown line
  if (path !== rawPath && (PATH_ROUTES[path] || m)) return { redirect: path };
  if (!PATH_ROUTES[path] && !m) return { redirect: '/' };
  return {};
}

export function routeFor(rawPath) {
  const path = clean(rawPath);
  const m = path.match(/^\/products\/([^/]+)$/);
  if (m) return { route: 'line', slug: m[1] };
  return { route: PATH_ROUTES[path] || 'home', slug: null };
}
