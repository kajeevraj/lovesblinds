import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { LINE_SCOPE, edgePath } from './src/data/catalogQuery.js'

// Line pages need their catalog. This asks for it from index.html, before the app script has even been downloaded:
// from our edge-cached function (api/catalog.js), which is same origin. It also opens the one connection to Supabase
// that the swatch pictures use (they are CORS-anonymous, so the preconnect is too). It runs only on /products/<line>, so
// the other pages are unchanged. src/data/catalogApi.js picks up the answer (window.__lbCatalog); if the function failed,
// it asks Supabase directly. The path comes from catalogQuery.js, shared with the app.
const earlyCatalog = (env) => ({
  name: 'early-catalog-fetch',
  transformIndexHtml() {
    const base = env.VITE_SUPABASE_URL
    const paths = Object.fromEntries(Object.keys(LINE_SCOPE).map(k => [k, edgePath(k)]))
    const script = `(function(){var m=location.pathname.match(/^\\/products\\/([^\\/]+)\\/?$/);var P=${JSON.stringify(paths)};if(!m||!P[m[1]])return;`
      + (base ? `var l=document.createElement('link');l.rel='preconnect';l.href=${JSON.stringify(base)};l.crossOrigin='anonymous';document.head.appendChild(l);` : '')
      + `window.__lbCatalog={line:m[1],promise:fetch(P[m[1]]).then(function(r){return r.ok?r.json():null}).catch(function(){return null})}})()`
    return [{ tag: 'script', children: script, injectTo: 'head-prepend' }]
  },
})

export default defineConfig(({ mode }) => ({
  plugins: [react(), earlyCatalog(loadEnv(mode, process.cwd(), 'VITE_'))],
}))
