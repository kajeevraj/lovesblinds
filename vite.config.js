import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { LINE_SCOPE, edgePath } from './src/data/catalogQuery.js'
import { activeLines } from './src/data/lines.js'
import { metaFor, headTags, sitemapPaths, PAGES, SITE_URL } from './src/lib/pageMeta.js'

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

// Page titles, descriptions, share picture and product data in the HTML itself, for every page (src/lib/pageMeta.js). The home page's
// tags go into index.html; after the build, a copy of index.html with that page's own tags is written to dist/<page>/index.html
// (Vercel serves a real file before it applies the "send everything to index.html" rule), and dist/sitemap.xml is written.
const photos = () => JSON.parse(readFileSync('src/data/sitePhotos.json', 'utf8'))
const START = '<!--seo-start-->', END = '<!--seo-end-->'
const seoPages = () => {
  let outDir = 'dist'
  const block = (m) => `${START}\n${headTags(m)}\n    ${END}`
  return {
    name: 'seo-pages',
    configResolved(c) { outDir = c.build.outDir },
    transformIndexHtml: { order: 'pre', handler: (html) => html.replace(`${START}\n    ${END}`, block(metaFor('home', null, photos()))) },
    closeBundle() {
      const slugs = activeLines().map((l) => l.slug)
      const home = readFileSync(join(outDir, 'index.html'), 'utf8')
      const homeBlock = home.slice(home.indexOf(START), home.indexOf(END) + END.length)
      const pages = [['products'], ['measure'], ['contact'], ['quote'], ['orders'], ['profile'], ...slugs.map((s) => ['line', s])]
      for (const [route, slug] of pages) {
        const m = metaFor(route, slug, photos())
        const file = join(outDir, m.path.slice(1), 'index.html')
        mkdirSync(join(outDir, m.path.slice(1)), { recursive: true })
        writeFileSync(file, home.replace(homeBlock, block(m)))
      }
      const urls = sitemapPaths(slugs).map((p) => `  <url><loc>${SITE_URL}${p === '/' ? '/' : p}</loc></url>`).join('\n')
      writeFileSync(join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), earlyCatalog(loadEnv(mode, process.cwd(), 'VITE_')), seoPages()],
}))
