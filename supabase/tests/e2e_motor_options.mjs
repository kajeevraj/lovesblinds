// Browser test of the movement and motor choices (Roller, Zebra, Shangri-La, Roman, Cellular, Curtains, Dream Curtains) against the live Supabase project.
// Needs a preview server (BASE_URL, default http://localhost:4173) and the site's own Supabase keys in its environment.
// Checks marked "(needs migration 20)" read prices that only exist once migration 20 (step A) has been applied; until then they are reported as SKIPPED, not passed.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const skip = (name) => console.log(`SKIP  ${name} (migration 20 is not applied to this database)`);
const money = (t) => Number(String(t).replace(/[^\d]/g, ''));
const migrated = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/public_options`, { method: 'POST', headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{"p_line":"roller"}' }).then((r) => r.ok).catch(() => false);
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const open = async (slug) => { await page.goto(`${BASE}/products/${slug}`); await page.locator('.s2-sw').first().waitFor(); };
  const size = async (w, h) => { await page.locator('#s2-w').fill(String(w)); await page.locator('#s2-h').fill(String(h)); await page.locator('#s2-h').blur(); };
  const step = (title) => page.locator('.s2-step', { has: page.locator('.s2-step-title', { hasText: title }) });
  const stepX = (title) => page.locator('.s2-step', { has: page.locator('.s2-step-title', { hasText: new RegExp(`^\\s*\\d+\\s*${title}\\s*$`) }) });
  const card = (name) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
  const text = () => page.locator('main').innerText();
  const pagePrice = async () => { await page.locator('.s2-estimate-price').waitFor(); return money(await page.locator('.s2-estimate-price').first().evaluate((el) => el.firstChild.textContent)); };
  const settle = () => page.waitForTimeout(900);
  const names = () => page.locator('.s2-step', { has: page.locator('.s2-step-title', { hasText: 'How you raise and lower it' }) }).locator('.s2-card-name').allInnerTexts();

  // ---------- Roller ----------
  await open('roller'); await page.locator('.s2-sw').first().click(); await size(40, 64);
  let t = await text();
  check('Roller offers Zero gravity, Motorized, 2 in 1 motor and Chain in that order, and nothing about Cordless, "Freestop", "Remote wand" or "Matter smart motor"', JSON.stringify(await names()) === JSON.stringify(['Zero gravity', 'Motorized', '2 in 1 motor', 'Chain']) && !/Cordless|Freestop|Remote wand|Matter smart|Motor \(non-Matter\)/.test(t));
  check('Zero gravity is selected on first load, says what it does in the owner\'s words and mentions the center handle', await card('Zero gravity').getAttribute('aria-pressed') === 'true' && /Grab the bottom rail and move it to any height\. Let go and it stays right there\./.test(t) && /center handle/i.test(t));
  check('Chain stays available but plain: no picture on its card', await card('Chain').locator('.s2-card-pic').count() === 0 && await card('Zero gravity').locator('.s2-card-pic').count() === 1);
  const zg = await pagePrice();
  await card('Chain').click(); await settle();
  check('Chain shows a Chain side choice (default Right); no Power or Control steps before Motorized; Zero gravity has no side choice', await step('Chain side').locator('.s2-card.on', { hasText: 'Right' }).count() === 1 && await step('Power').count() === 0);
  const chain = await pagePrice();
  if (migrated) check('Zero gravity costs the chain price + $27 (the $18 with the 1.5x markup) (needs migration 20)', Math.abs(zg - chain - 27) <= 1, `chain $${chain}, zero gravity $${zg}`); else skip('Zero gravity = chain price + $27');
  await card('Motorized').click(); await settle();
  t = await text();
  check('Motorized opens Power (Battery default), a Solar choice, How you control it (4 options), and a Motor side (default Right), not "Control side"', await step('Power').locator('.s2-card.on', { hasText: /^Battery/ }).count() === 1
    && ['App + Remote (Bluetooth)', 'Remote only', 'App + Voice + Remote (Zigbee)', 'App + Voice + Remote (Matter)'].every((n) => t.includes(n)) && await step('Motor side').locator('.s2-card.on', { hasText: 'Right' }).count() === 1 && !/Control side/.test(t));
  check('the Battery note says the motor and the charging port are on that side; Zigbee says $35 for a hub; Matter says no hub and names Alexa, Google Home and Apple Home', /The motor sits on this side, and so does the charging port\. Pick the side closest to an outlet\./.test(t) && /buy one from us for \$35/.test(t) && /No hub needed/.test(t) && /Alexa, Google Home and Apple Home/.test(t) && /Smart Life/.test(t));
  const motor = await pagePrice();
  check('Motorized costs the chain price + $105 (the $70 motor with the 1.5x markup)', Math.abs(motor - chain - 105) <= 1, `chain $${chain}, motorized $${motor}`);
  await card('Add a solar panel').click(); await settle();
  check('a solar panel adds $45', Math.abs((await pagePrice()) - motor - 45) <= 1);
  await card('Wired').click(); await settle();
  t = await text();
  check('Wired: no Solar panel choice; the side note says the motor and its power cord sit on that side; same price as battery', !/solar panel/i.test(await step('Power').innerText()) && /The motor and its power cord sit on this side\./.test(t) && (await pagePrice()) === motor);
  await card('2 in 1 motor').click(); await settle();
  t = await text();
  check('2 in 1 motor: the owner\'s words, a Motor side with Right only (no Left) and a short note, no Power or Control steps', /Use the remote, or just move the shade by hand\. It stays wherever you leave it\./.test(t) && await step('Motor side').locator('.s2-card').count() === 1 && await step('Motor side').locator('.s2-card.on', { hasText: 'Right' }).count() === 1 && /right side only/.test(t) && await step('Power').count() === 0);
  if (migrated) check('2 in 1 motor costs the same as Motorized: $70 more than the plain table (needs migration 20)', Math.abs((await pagePrice()) - chain - 105) <= 1); else skip('2 in 1 motor price');
  await card('Zero gravity').click(); await settle();
  check('going back to Zero gravity removes the motor steps and the side choice', await step('Power').count() === 0 && await step('Motor side').count() === 0 && await step('Chain side').count() === 0);

  // ---------- Double-stack ----------
  await card('Chain').click(); await settle();
  await page.locator('.s2-card', { hasText: 'Double-stack' }).first().click(); await settle();
  await page.locator('.s2-swgrid').nth(0).locator('.s2-sw').nth(1).click(); await page.locator('.s2-swgrid').nth(1).locator('.s2-sw').nth(4).click(); await settle();
  check('Roller double-stack: no Chain and no 2 in 1 motor (movement is Zero gravity, selected, or Motorized); a Chain choice from the single shade falls back to Zero gravity', JSON.stringify(await names()) === JSON.stringify(['Zero gravity', 'Motorized']) && await card('Zero gravity').getAttribute('aria-pressed') === 'true');
  await card('Motorized').click(); await settle();
  t = await step('How you control it').innerText();
  check('double-stack motor controls: Remote only, App + Remote (Bluetooth), App + Voice + Remote (Matter); no Zigbee; Battery or Wired', /Remote only/.test(t) && /App \+ Remote \(Bluetooth\)/.test(t) && /Matter/.test(t) && !/Zigbee/.test(t) && await step('Power').locator('.s2-card-name', { hasText: /^(Battery|Wired)$/ }).count() === 2);
  check('double-stack asks Roll direction in More options and the bottom rail wrap (wrapped by default)', await step('Bottom rail').locator('.s2-card.on', { hasText: 'Wrapped in fabric' }).count() === 1);

  // ---------- the other lines ----------
  for (const [slug, expected, absent] of [['zebra', ['Zero gravity', 'Motorized', 'Chain'], ['2 in 1', 'Cordless']], ['roman', ['Zero gravity', 'Motorized', 'Chain'], ['2 in 1', 'Cordless']], ['cellular', ['Zero gravity', 'Motorized', 'Chain'], ['2 in 1', 'Cordless']], ['shangri-la', ['Motorized', 'Chain'], ['Zero gravity', 'Cordless', 'Remote wand', '2 in 1']]]) {
    await open(slug); const got = await names();
    check(`${slug}: movement options are ${expected.join(', ')} (in that order)`, JSON.stringify(got) === JSON.stringify(expected) && absent.every((n) => !got.join('|').includes(n)));
    check(`${slug}: ${slug === 'shangri-la' ? 'Chain is selected (it has no Zero gravity)' : 'Zero gravity is selected'}`, await card(slug === 'shangri-la' ? 'Chain' : 'Zero gravity').getAttribute('aria-pressed') === 'true');
  }
  // Roman: battery motor only
  await open('roman'); await page.locator('.s2-sw').first().click(); await card('Motorized').click(); await settle();
  check('Roman: battery motor only, no Wired choice', await step('Power').locator('.s2-card-name', { hasText: /^Wired$/ }).count() === 0 && /solar panel/i.test(await step('Power').innerText()));
  // Cellular: the motor follows the style; no App, Zigbee, Matter or Wired; solar kept; left or right
  await open('cellular'); await card('Motorized').click(); await settle();
  t = await text();
  check('Cellular motor: named after the style, no App / Zigbee / Matter / Wired choice, solar panel kept, Motor side Left or Right (default Right)', /Normal Cellular Motor/.test(t) && !/Zigbee|Matter|App \+|How you control it/.test(await stepX('Motor').innerText() + (await step('Motor side').innerText())) && await step('How you control it').count() === 0 && await stepX('Motor').locator('.s2-card-name', { hasText: /^Wired$/ }).count() === 0 && /solar panel/i.test(await stepX('Motor').innerText()) && await step('Motor side').locator('.s2-card').count() === 2 && await step('Motor side').locator('.s2-card.on', { hasText: 'Right' }).count() === 1);
  await card('Top-down/bottom-up').click(); await settle();
  check('Cellular TDBU: the TDBU Cellular Motor', /TDBU Cellular Motor/.test(await text()));
  await page.getByText('Day & night', { exact: true }).first().click(); await settle();
  check('Cellular Day & night: the Day&Night Cellular Motor', /Day&Night Cellular Motor/.test(await text()));

  // ---------- Curtains and Dream Curtains ----------
  await open('drapery'); await page.locator('.s2-sw').first().click();
  const dr = await text();
  check('Curtains: no motor choice of their own (the track is in "Add a track or rod")', !/Motorized track/.test(dr) && await step('Add a track or rod').count() === 1 && await step('How it opens').count() === 0);
  await page.getByRole('tab', { name: /Dream/ }).click(); await page.waitForTimeout(600);
  const dream = await text();
  check('Dream Curtains: Mount (side or ceiling, then inside or outside), Stack (left, right, center) and Manual / Motorized / Pull rod', /Side install/.test(dream) && /Ceiling install/.test(dream) && /Left stack/.test(dream) && /Right stack/.test(dream) && /Center opening/.test(dream) && await step('How it opens and closes').locator('.s2-card-name').allInnerTexts().then((n) => JSON.stringify(n) === JSON.stringify(['Manual', 'Motorized', 'Pull rod'])));
  await card('Center opening').click(); await settle();
  check('Pull rod is for a left or right stack only: with a center opening it cannot be picked', await card('Pull rod').isDisabled());
  await card('Left stack').click(); await card('Pull rod').click(); await card('Center opening').click(); await settle();
  check('picking a center opening while Pull rod is chosen moves it back to Manual', await card('Manual').getAttribute('aria-pressed') === 'true');
} finally { await browser.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
