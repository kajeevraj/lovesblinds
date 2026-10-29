// Browser test of the remotes: the right remote for each line and channel count, the buttons, and the room-count rule on the product pages.
// Needs a preview server (BASE_URL, default http://localhost:4173) and the live Supabase project (prices must load to add items to the cart).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const SHARE = /Shades in the same room share one remote that runs them one at a time or all together\./;
try {
  for (const [vw, vh] of [[390, 844], [1280, 900]]) {
    const T = (s) => `[${vw}px] ${s}`;
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, hasTouch: vw < 500, isMobile: vw < 500 });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const card = (n) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
    const open = async (slug) => { await page.goto(`${BASE}/products/${slug}`, { waitUntil: 'networkidle' }); await page.locator('.s2-sw').first().waitFor(); await page.locator('.s2-sw').nth(3).click(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('60'); await page.locator('#s2-h').blur(); };
    const remoteType = async () => { const r = page.locator('.rm').first(); return (await r.count()) ? r.getAttribute('data-remote') : null; };
    const room = async (choice, custom = '') => { await page.locator('#s2-room').selectOption(choice); if (choice === 'Other') await page.locator('#s2-room-custom').fill(custom); await page.waitForTimeout(300); };
    const qty = async (n) => { await page.locator('#s2-qty').fill(String(n)); await page.locator('#s2-qty').blur(); await page.waitForTimeout(300); };
    const settle = () => page.waitForTimeout(500);

    // ---- Roller: preview remote, channels follow the shades in the room
    await open('roller'); await page.waitForSelector('.pv-stage.ready', { timeout: 30000 });
    check(T('no remote on a chain shade'), (await page.locator('.rm').count()) === 0);
    await card('Motorized').click(); await settle();
    check(T('Roller, one shade, no room: the 1 Channel remote, no sharing line'), (await remoteType()) === 'ch1' && !SHARE.test(await page.locator('.pv-incl').innerText().catch(() => '')));
    check(T('the remote is three simple buttons: up, stop, down'), (await page.locator('.rm-key').count()) === 3);
    await room('Living room'); await qty(3);
    check(T('3 shades in a room: the 6 Channels remote, with the channel buttons and the sharing line'), (await remoteType()) === 'ch6' && (await page.locator('.rm-key').count()) === 3 && SHARE.test(await page.locator('.pv-incl').innerText().catch(() => '')));
    await qty(8);
    check(T('8 shades in a room: the 16 Channels remote'), (await remoteType()) === 'ch16');
    await qty(17);
    check(T('17 shades in a room: still the 16 Channels remote'), (await remoteType()) === 'ch16');
    await room('', ''); await qty(5);
    check(T('a blank room: every shade counts alone (1 Channel, no sharing line)'), (await remoteType()) === 'ch1' && !SHARE.test(await page.locator('.pv-incl').innerText().catch(() => '')));
    // the channel buttons light up and change nothing; the shade buttons still move it
    await room('Living room'); await qty(3);
    const amount = async () => Number(await page.locator('#pv-amount').inputValue());
    const a0 = await amount();
    await page.locator('[data-btn="stop"]').click(); await page.waitForTimeout(100);
    check(T('a pressed button lights up'), (await page.locator('.rm-key.lit[data-btn="stop"]').count()) === 1 && (await amount()) === a0);
    await page.locator('[data-btn="down"]').click(); await page.waitForTimeout(1500);
    check(T('Down on the 6 Channels remote lowers the shade'), (await amount()) > a0 + 3);
    await page.locator('[data-btn="stop"]').click(); const s1 = await amount(); await page.waitForTimeout(700);
    check(T('Stop holds it'), (await amount()) === s1);
    check(T(vw < 500 ? 'the buttons have a 44 px tap area on a phone' : 'the buttons are small but at least 32 px to tap'), await page.locator('[data-btn="up"], [data-btn="stop"], [data-btn="down"]').evaluateAll((b, min) => b.every((x) => x.getBoundingClientRect().width >= min && x.getBoundingClientRect().height >= min), vw < 500 ? 43.5 : 32));
    // ---- the cart: a second window in the same room, whatever the case of the name
    await qty(1); await room('Living room');
    await page.waitForFunction(() => !document.querySelector('.s2-add-btn')?.disabled, null, { timeout: 30000 });
    await page.locator('.s2-add-btn').click(); await page.waitForTimeout(800);
    await open('roller'); await card('Motorized').click(); await settle();
    await room('Other', '  LIVING ROOM '); await settle();
    check(T('a second window in the same room (different case): the 6 Channels remote and the sharing line'), (await remoteType()) === 'ch6' && SHARE.test(await page.locator('.pv-incl').innerText().catch(() => '')));
    await room('Bedroom');
    check(T('another room starts again at 1 Channel'), (await remoteType()) === 'ch1');

    // ---- Zebra, Roman, Shangri-La, Dream: the same 1/6/16 channel remote (cards where there is no 3D preview)
    for (const slug of ['zebra', 'roman', 'shangri-la']) {
      await open(slug); await card('Motorized').click(); await settle();
      check(T(`${slug}: the 1 Channel remote with "Included: remote"`), (await remoteType()) === 'ch1' && /included: remote/i.test(await page.locator('.pv-incl, .rm-card').first().innerText()));
    }
    await open('drapery'); await page.getByRole('tab', { name: /Dream/ }).click(); await page.locator('.s2-sw').first().waitFor();
    await card('Motorized track (remote)').click(); await settle();
    check(T('Dream Curtains motor: the roller 1 Channel remote'), (await remoteType()) === 'ch1');
    await page.getByRole('tab', { name: /Curtains/ }).first().click(); await settle();
    check(T('regular Curtains: no remote'), (await page.locator('.rm').count()) === 0);

    // ---- Cellular: wand remotes
    await open('cellular'); await card('Motorized').click(); await settle();
    check(T('Cellular normal: the Single Motor, Single Channel remote (up, pause, down)'), (await remoteType()) === 'single-single' && (await page.locator('.rm-key').count()) === 3);
    await card('Top-down/bottom-up').click(); await settle();
    check(T('Cellular top-down/bottom-up: the Dual Motor, Single Channel remote'), (await remoteType()) === 'dual-single');
    await page.locator('[data-btn="topUp"]').click(); await page.waitForTimeout(80);
    check(T('a dual remote button lights up'), (await page.locator('.rm-key.lit[data-btn="topUp"]').count()) === 1);
    check(T('a dual remote has a top rail pair and a bottom rail pair'), (await Promise.all(['topUp', 'topDown', 'botUp', 'botDown'].map((b) => page.locator(`[data-btn="${b}"]`).count()))).every((n) => n === 1));
    await card('Day & night').click(); await settle();
    check(T('Cellular day & night: the Dual Motor remote'), (await remoteType()) === 'dual-single');
    await room('Office'); await qty(2); await settle();
    check(T('two day & night shades in a room: the Dual Motor, Multi Channel remote, and the sharing line'), (await remoteType()) === 'dual-multi' && SHARE.test(await page.locator('.rm-card').innerText()));
    await card('Standard').click(); await settle();
    check(T('two standard cellular shades in a room: the Single Motor, Multi Channel remote'), (await remoteType()) === 'single-multi');
    check(T('no console errors'), errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
