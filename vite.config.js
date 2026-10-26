import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { LINE_SCOPE, edgePath } from './src/data/catalogQuery.js'
import { activeLines } from './src/data/lines.js'
import { ROOM_WIDTHS, PHONE_QUERY_PX } from './src/room/photoSize.js'
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

// The room photo on /room-lab (and its hero test page) is the first thing people see. Ask for the right-sized file from index.html, before the app
// script and the page's own chunk have loaded; the page then asks for the very same file (src/room/photoSize.js).
const earlyRoomPhoto = () => ({
  name: 'early-room-photo',
  transformIndexHtml() {
    // the same arithmetic as pickWidth() in src/room/photoSize.js (supabase/tests/room_photo_size_tests.mjs checks they agree)
    const script = `(function(){if(!/^\\/room-lab(\\/|$)/.test(location.pathname))return;var W=${JSON.stringify(ROOM_WIDTHS)},v=document.documentElement.clientWidth,d=window.devicePixelRatio||1;`
      + `var s=Math.min(Math.max(v-32,280),1180),vp=v<=${PHONE_QUERY_PX}?1300:1890,n=s*d*2000/vp,w=W[W.length-1];for(var i=0;i<W.length;i++)if(W[i]>=n*0.92){w=W[i];break}`
      + `var l=document.createElement('link');l.rel='preload';l.as='image';l.href='/room-lab/room-'+w+'.webp';l.setAttribute('fetchpriority','high');document.head.appendChild(l)})()`
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
      const pages = [['products'], ['measure'], ['contact'], ['quote'], ['orders'], ['profile'], ['privacy'], ['terms'], ['roomlab'], ['roomhero'], ...slugs.map((s) => ['line', s])]
      for (const [route, slug] of pages) {
        const m = metaFor(route, slug, photos())
        const file = join(outDir, m.path.slice(1), 'index.html')
        mkdirSync(join(outDir, m.path.slice(1)), { recursive: true })
        writeFileSync(file, home.replace(homeBlock, block(m)))
      }
      // Vercel serves this file, with a 404 status, for any address that is not a real page (vercel.json only rewrites /admin and /review)
      const nf = metaFor('notfound', null, photos())
      writeFileSync(join(outDir, '404.html'), home.replace(homeBlock, block(nf)))
      const urls = sitemapPaths(slugs).map((p) => `  <url><loc>${SITE_URL}${p === '/' ? '/' : p}</loc></url>`).join('\n')
      writeFileSync(join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), earlyCatalog(loadEnv(mode, process.cwd(), 'VITE_')), earlyRoomPhoto(), seoPages()],
}))
