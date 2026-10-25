# /hero-lab: scrolling 3D hero (test page)

Not linked from the site, `noindex`; the live homepage is untouched. Code in `src/hero/`.

- Add a window: model in `src/hero/models/`, register in `models/index.js`, swatch row in `scripts/build_hero_fabrics.mjs`, row in `src/hero/products.js`.
- Models share one API: `new RollerShade({ width, height, drop, color, texture, tile })`, `.setDrop(0..1)`, `.setSize()`, `.setFabric()`, `.dispose()` (metres).
- Fabrics: `node scripts/build_hero_fabrics.mjs` (real catalog swatches -> `public/hero-lab/fabrics`, `src/hero/fabrics.json`).
- Stills: `node scripts/render-hero-stills.mjs` against a preview (`public/hero-lab/stills`).
- Preview helpers: `?mode=still` (reduced-motion page), `?u=3.5` (freeze at a scroll position), `?shot=roller` (one frame).
- Screenshots of every step: `docs/hero-lab/screenshots/`.
