// Makes the still pictures for /hero-lab (the instant first picture, and the reduced-motion / no-WebGL page).
//   npm run build && npx vite preview --port 4173      (in another terminal)
//   node scripts/render-hero-stills.mjs                (BASE_URL overrides the address)
// It opens /hero-lab?shot=<name> in a browser, which draws one frame of the real 3D scene, and saves it as WebP:
//   public/hero-lab/stills/<name>-wide.webp (1600x900) and <name>-tall.webp (720x1560). Commit the results.
// Playwright comes from PLAYWRIGHT_MODULE (default /opt/node22/lib/node_modules/playwright).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const NAMES = ['intro', 'roller', 'zebra', 'shangri-la', 'cellular', 'roman', 'curtains', 'dream-curtains', 'wall'];
const SIZES = { wide: [1600, 900], tall: [720, 1560] };
mkdirSync('public/hero-lab/stills', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [kind, [w, h]] of Object.entries(SIZES)) {
  for (const name of NAMES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/hero-lab?shot=${name}`);
    await page.waitForFunction(() => window.__heroShotReady, null, { timeout: 90000 });
    const png = await page.screenshot();
    await sharp(png).webp({ quality: 74 }).toFile(`public/hero-lab/stills/${name}-${kind}.webp`);
    await page.close();
    console.log(kind, name);
  }
}
await browser.close();
