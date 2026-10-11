import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { LINE_SCOPE, catalogPath } from './src/data/catalogQuery.js'

// Line pages need their catalog from Supabase. This starts that request from index.html, before the app
// script has even been downloaded, and opens the connection that the catalog request and the swatch images (both CORS-anonymous) share. It only runs on
// /products/<line>, so the home page is unchanged. src/data/catalogApi.js picks the result up (window.__lbCatalog)
// and makes the same request itself if this one failed. The query comes from catalogQuery.js, shared with the app.
const earlyCatalog = (env) => ({
  name: 'early-catalog-fetch',
  transformIndexHtml() {
    const base = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY
    if (!base || !key) return []
    const paths = Object.fromEntries(Object.keys(LINE_SCOPE).map(k => [k, catalogPath(k)]))
    const script = `(function(){var m=location.pathname.match(/^\\/products\\/([^\\/]+)\\/?$/);var P=${JSON.stringify(paths)};if(!m||!P[m[1]])return;`
      + `var u=${JSON.stringify(base)};`
      + `var l=document.createElement('link');l.rel='preconnect';l.href=u;l.crossOrigin='anonymous';document.head.appendChild(l);`
      + `window.__lbCatalog={line:m[1],promise:fetch(u+P[m[1]]+'&apikey='+${JSON.stringify(key)}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})}})()`
    return [{ tag: 'script', children: script, injectTo: 'head-prepend' }]
  },
})

export default defineConfig(({ mode }) => ({
  plugins: [react(), earlyCatalog(loadEnv(mode, process.cwd(), 'VITE_'))],
}))
