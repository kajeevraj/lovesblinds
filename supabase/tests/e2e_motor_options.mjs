// Browser test of the movement and motor choices (Roller, Zebra, Shangri-La, Roman, Cellular, Curtains) against the live Supabase project.
// Needs migrations 17 and 18 applied, a preview server (BASE_URL, default http://localhost:4173) and the site's own Supabase keys in its environment.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const money = (t) => Number(String(t).replace(/[^\d]/g, ''));
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const open = async (slug) => { await page.goto(`${BASE}/products/${slug}`); await page.locator('.s2-sw').first().waitFor(); };
  const size = async (w, h) => { await page.locator('#s2-w').fill(String(w)); await page.locator('#s2-h').fill(String(h)); };
  const step = (title) => page.locator('.s2-step', { has: page.locator('.s2-step-title', { hasText: title }) });
  const card = (name) => page.locator('.s2-card', { hasText: name }).first();
  const text = () => page.locator('main').innerText();
  const pagePrice = async () => { await page.locator('.s2-estimate-price').waitFor(); return money(await page.locator('.s2-estimate-price').first().evaluate((el) => el.firstChild.textContent)); };
  const settle = () => page.waitForTimeout(900);

  // ---------- Roller ----------
  await open('roller'); await page.locator('.s2-sw').first().click(); await size(40, 64);
  let t = await text();
  check('Roller offers Chain, Cordless, Zero gravity and Motorized, and nothing about "Freestop", "Remote wand" or "Matter smart motor"', ['Chain', 'Cordless', 'Zero gravity', 'Motorized'].every((n) => t.includes(n)) && !/Freestop|Remote wand|Matter smart|Motor \(non-Matter\)/.test(t));
  check('Zero gravity says what it does in the owner\'s words and mentions the optional center handle', /Grab the bottom rail and move it to any height\. Let go and it stays right there\./.test(t) && /center handle/i.test(t));
  check('Chain shows a side choice (default Right); no Power or Control steps before Motorized', await step('Chain side').locator('.s2-card.on', { hasText: 'Right' }).count() === 1 && await step('Power').count() === 0);
  const chain = await pagePrice();
  await card('Motorized').click(); await settle();
  t = await text();
  check('Motorized opens Power (Battery default), a Solar choice, How you control it (4 options), and a Control side (default Right)', await step('Power').locator('.s2-card.on', { hasText: /^Battery/ }).count() === 1
    && ['App + Remote', 'Remote control only', 'App + Voice + Remote (Zigbee)', 'App + Voice + Remote (Matter)'].every((n) => t.includes(n)) && await step('Control side').locator('.s2-card.on', { hasText: 'Right' }).count() === 1);
  check('the Battery note and the charging line show; Zigbee says $35 for a hub; Matter says no hub and names Alexa, Google Home and Apple Home', /about every 6 months/.test(t) && /Pick the side closest to an outlet for charging\./.test(t) && /buy one from us for \$35/.test(t) && /No hub needed/.test(t) && /Alexa, Google Home and Apple Home/.test(t) && /Smart Life/.test(t));
  const motor = await pagePrice();
  check('Motorized costs the chain price + $105 (the $70 motor with the 1.5x markup)', Math.abs(motor - chain - 105) <= 1, `chain $${chain}, motorized $${motor}`);
  await card('Add a solar panel').click(); await settle();
  check('a solar panel adds $45 and hides the "closest to an outlet" line', Math.abs((await pagePrice()) - motor - 45) <= 1 && !/Pick the side closest to an outlet/.test(await text()));
  await card('Wired').click(); await settle();
  t = await text();
  check('Wired: no Solar panel choice, no charging line, same price as battery', !/solar panel/i.test(await step('Power').innerText()) && !/closest to an outlet/.test(t) && (await pagePrice()) === motor);
  await card('Cordless').click(); await settle();
  check('going back to Cordless removes the motor steps and the side choice', await step('Power').count() === 0 && await step('Control side').count() === 0 && await step('Chain side').count() === 0);

  // ---------- the other lines ----------
  for (const [slug, expected, absent] of [['zebra', ['Chain', 'Cordless', 'Zero gravity', 'Motorized'], []], ['roman', ['Cordless', 'Zero gravity', 'Motorized'], ['Chain side']], ['cellular', ['Cordless', 'Zero gravity', 'Motorized'], ['Chain side']], ['shangri-la', ['Chain', 'Motorized'], ['Zero gravity', 'Cordless', 'Remote wand']]]) {
    await open(slug); const b = await text();
    check(`${slug}: movement options are ${expected.join(', ')}`, expected.every((n) => b.includes(n)) && absent.every((n) => !b.includes(n)) && !/Freestop/.test(b));
  }
  await open('drapery'); await page.locator('.s2-sw').first().click();
  const dr = await text();
  check('Curtains: manual track only, no motor option', /Manual track/.test(dr) && !/Motorized track/.test(dr));
  await page.getByRole('tab', { name: /Dream/ }).click(); await page.waitForTimeout(600);
  check('Dream Curtains keeps its motor options as they were', /Motorized track/.test(await text()));
} finally { await browser.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
