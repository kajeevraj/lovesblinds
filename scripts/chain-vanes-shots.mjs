// Step screenshots of the chain drag (Roller, Shangri-La) and of the motorized Shangri-La going down (vanes open) and up (vanes close), cropped to the picture.
//   node scripts/chain-vanes-shots.mjs <out-dir>      (needs a preview server at BASE_URL, default http://localhost:4173; reads only)
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173', OUT = process.argv[2] || 'chain-shots'; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function session(line, vw, vh, code, hgt, card) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 }), page = await ctx.newPage(); page.setDefaultTimeout(30000);
  await page.goto(`${BASE}/products/${line}`, { waitUntil: 'networkidle' });
  await page.locator('.s2-color input[type=search]').fill(code); await page.waitForTimeout(500); await page.locator('.s2-swgrid .s2-sw').first().click();
  await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill(String(hgt)); await page.locator('#s2-h').blur();
  if (card) { await page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${card}$`) }) }).first().click(); }
  await page.waitForSelector('.pv-stage.ready'); await page.waitForTimeout(1500); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
  return { ctx, page };
}
const shot = async (page, name) => { await page.waitForTimeout(250); await page.locator('.pv').screenshot({ path: `${OUT}/${name}.png` }); };
const dragStrand = async (page, name, strand, dy, steps, tag) => {
  const b = await page.locator(`.pv-chain-hit[data-strand="${strand}"]`).boundingBox(), x = b.x + b.width / 2, y = b.y + 24;
  await page.mouse.move(x, y); await page.mouse.down(); await shot(page, `${name}-${tag}-1-grab`);
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x, y + (dy * i) / steps, { steps: 4 }); await shot(page, `${name}-${tag}-${i + 1}-pull`); }
  await page.mouse.up(); await page.waitForTimeout(900); await shot(page, `${name}-${tag}-${steps + 2}-let-go`);
};
{ const { ctx, page } = await session('roller', 1280, 900, 'YS180006', 64, 'Chain'); await shot(page, 'roller-0-start');
  await dragStrand(page, 'roller', 'lower', 110, 3, 'lower'); await dragStrand(page, 'roller', 'raise', 90, 2, 'raise'); await ctx.close(); }
{ const { ctx, page } = await session('shangri-la', 1280, 900, 'YSLH204', 64, 'Chain'); await shot(page, 'shangri-chain-0-start');
  await dragStrand(page, 'shangri-chain', 'lower', 400, 4, 'down'); await page.waitForTimeout(1500); await shot(page, 'shangri-chain-vanes-open');
  await dragStrand(page, 'shangri-chain', 'raise', 80, 2, 'up'); await page.waitForTimeout(1500); await shot(page, 'shangri-chain-raised'); await ctx.close(); }
{ const { ctx, page } = await session('shangri-la', 1280, 900, 'YSLH204', 64, 'Motorized'); await shot(page, 'shangri-motor-0-start');
  await page.getByRole('button', { name: 'Lower the shade' }).click();
  for (let i = 1; i <= 5; i++) { await page.waitForTimeout(700); await shot(page, `shangri-motor-down-${i}`); }
  await page.waitForFunction(() => document.querySelector('.pv-ctl')?.dataset.vanes === 'open', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500); await shot(page, 'shangri-motor-down-6-open');
  await page.getByRole('button', { name: 'Raise the shade' }).click();
  for (let i = 1; i <= 6; i++) { await page.waitForTimeout(500); await shot(page, `shangri-motor-up-${i}`); }
  await page.getByRole('button', { name: 'Stop' }).click(); await page.waitForTimeout(400); await shot(page, 'shangri-motor-up-7-stop'); await ctx.close(); }
await browser.close(); console.log('shots in', OUT);
