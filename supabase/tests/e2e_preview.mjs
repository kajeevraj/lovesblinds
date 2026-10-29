// Browser test of the product-page 3D preview (Roller and Zebra) and the room lab, at 390 and 1280 px. Needs a preview server (BASE_URL, default
// http://localhost:4173). Runs with software WebGL. Checks: the preview comes up and is the first picture of the gallery; it follows the size, color, mount,
// control, cover and double-stack choices; the one quiet size label reads the typed size and is always on; the Zero gravity handle is always visible and
// the shade moves by dragging the handle or the bottom bar or with the arrow keys (there is no slider bar and no "See it in a room", "Hide sizes" or
// "Style photo" button); the gallery (dots, arrows, a style photo and back keeps the configurator state); the phone dock and its collapse button;
// no sideways scroll; no console errors; and the room lab's names, hidden handles and curtains (the room view code is unused on the product page).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(vw, vh, path) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: vw < 500, isMobile: vw < 500 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  return { ctx, page, errors };
}
const fill = async (page, id, v) => { await page.locator(`#s2-${id}`).fill(v); await page.locator(`#s2-${id}`).blur(); };
// the shade's position is read from the handle (or the bottom bar) and set with the keyboard: there is no slider bar any more
const mover = (page) => page.locator('.pv-grip, .pv-bar').first();
const readAmount = async (page) => Number(await mover(page).getAttribute('aria-valuenow'));
const setAmount = async (page, target) => {
  const m = mover(page); await m.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 40 && (await readAmount(page)) < target - 1; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(15); }
  await page.waitForTimeout(150);
};

for (const [vw, vh] of [[390, 844], [1280, 900]]) {
  const tag = `[${vw}px]`;
  for (const [path, label] of [['/products/roller', 'Roller'], ['/products/zebra', 'Zebra']]) {
    const { ctx, page, errors } = await open(vw, vh, path);
    await page.waitForSelector('.s2-sw', { timeout: 20000 });
    await page.locator('.s2-sw').nth(2).click();
    check(`${tag} ${label}: the 3D preview replaces the photo`, await page.waitForSelector('.pv-stage.ready', { timeout: 30000 }).then(() => true).catch(() => false));
    check(`${tag} ${label}: no size labels before a real size is entered`, (await page.locator('.pv-size').count()) === 0);
    if (vw < 700) {
      const sh = await page.locator('.pv-stage').evaluate((e) => e.getBoundingClientRect().height);
      check(`${tag} ${label}: the phone strip is about 4:3 and at most 40% of the screen`, sh >= 220 && sh <= vh * 0.41 && sh >= vw * 0.55, `${Math.round(sh)} px of ${vh}`);
    }
    // a note or toast (they are fixed to the bottom right) must not sit on the preview
    await page.evaluate(() => { const n = document.createElement('div'); n.className = 's2-incnote'; n.id = 'fake-note'; n.innerHTML = '<p>Your <strong>x</strong> is in your cart, marked incomplete.</p>'; document.body.appendChild(n); const t = document.createElement('div'); t.className = 'snackbar'; t.id = 'fake-toast'; t.textContent = 'Added'; document.body.appendChild(t); });
    const clash = await page.evaluate(() => { const p = document.querySelector('.pv-stage').getBoundingClientRect(); return ['fake-note', 'fake-toast'].filter((id) => { const r = document.getElementById(id).getBoundingClientRect(); return !(r.right <= p.left || r.left >= p.right || r.bottom <= p.top || r.top >= p.bottom); }); });
    check(`${tag} ${label}: notes and toasts stay off the preview`, clash.length === 0, clash.join(', '));
    await page.evaluate(() => { document.getElementById('fake-note')?.remove(); document.getElementById('fake-toast')?.remove(); });
    await fill(page, 'w', '40'); await fill(page, 'h', '64');
    await page.waitForTimeout(600);
    const sLabel = (await page.locator('.pv-size').first().textContent().catch(() => null))?.replace(/\s+/g, ' ');
    check(`${tag} ${label}: the one size label reads the typed size`, sLabel === '40 × 64 in', `${sLabel}`);
    await fill(page, 'w', '44 1/2'); await page.waitForTimeout(500);
    check(`${tag} ${label}: a fraction shows in the label`, (await page.locator('.pv-size').first().textContent()).replace(/\s+/g, ' ') === '44 1/2 × 64 in');
    check(`${tag} ${label}: there is no "Hide sizes", "See it in a room" or "Style photo" button, and no slider bar`, (await page.getByRole('button', { name: /Hide sizes|Show sizes|See it in a room/ }).count()) === 0 && (await page.getByRole('tab', { name: 'Style photo', exact: true }).count()) === 0 && (await page.locator('#pv-amount, .pv-slide, input[type=range]').count()) === 0);
    check(`${tag} ${label}: the size label stays on`, (await page.locator('.pv-size').count()) === 1);
    // the handle (Zero gravity, the default) is always visible; the shade moves by it, by dragging, and with the arrow keys
    const zg = (await page.locator('.pv-grip').count()) === 1;
    check(`${tag} ${label}: Zero gravity is the default and its center handle is visible`, zg && await page.locator('.pv-grip i').evaluate((e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width >= 30 && r.height >= 10 && c.visibility === 'visible' && c.opacity === '1'; }));
    const before = await readAmount(page);
    await setAmount(page, 20);
    check(`${tag} ${label}: the arrow keys move the shade from the handle`, before !== 20 && Math.abs((await readAmount(page)) - 20) <= 3, `${before} -> ${await readAmount(page)}`);
    if (vw > 700) {
      const g = await page.locator('.pv-grip').boundingBox(), sh = await page.locator('.pv-drag').boundingBox();
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down(); await page.mouse.move(g.x + g.width / 2, sh.y + sh.height * 0.8, { steps: 8 }); await page.mouse.up();
      const after = await readAmount(page);
      check(`${tag} ${label}: dragging the handle down lowers the shade`, after > 40, `amount ${after}`);
    }
    // options: outside mount, motor (not on every line), no fabric wrap
    await page.getByText('Outside mount', { exact: true }).first().click(); await page.waitForTimeout(500);
    await page.getByText('No fabric wrap', { exact: true }).first().click(); await page.waitForTimeout(500);
    check(`${tag} ${label}: mount and top cover changes keep the preview up`, (await page.locator('.pv-stage.ready').count()) === 1);
    // a very large and a very small size
    await fill(page, 'w', '300'); await fill(page, 'h', '120'); await page.waitForTimeout(500);
    await fill(page, 'w', '12'); await fill(page, 'h', '12'); await page.waitForTimeout(500);
    check(`${tag} ${label}: very large and very small sizes still draw`, (await page.locator('.pv-stage.ready').count()) === 1 && errors.length === 0, errors.join(' | '));
    // the gallery: picture 1 is the configurator; the next ones are style photos; going there and back keeps the choices
    await page.locator('#s2-w-frac').selectOption(''); await fill(page, 'w', '40'); await fill(page, 'h', '64'); await page.waitForTimeout(400);
    const dots = page.locator('.gal-dots [role=tab]');
    check(`${tag} ${label}: the gallery has small dots (the configurator first, then style photos)`, (await dots.count()) >= 2 && (await dots.first().getAttribute('aria-selected')) === 'true');
    if (vw > 900) check(`${tag} ${label}: arrows on desktop`, (await page.getByRole('button', { name: 'Next picture' }).isVisible()) && (await page.getByRole('button', { name: 'Previous picture' }).isVisible()));
    await setAmount(page, 60); const keep = await readAmount(page);
    await dots.nth(1).click(); await page.waitForTimeout(800);
    check(`${tag} ${label}: a style photo shows, and the configurator is only hidden`, (await page.locator('.gal-photo .s2-photo-frame > img').count()) === 1 && (await page.locator('.gal-config').isHidden()) && (await page.locator('.gal-config').count()) === 1);
    await dots.first().click(); await page.waitForTimeout(500);
    check(`${tag} ${label}: back on the configurator, the size, color and shade position are kept`, (await page.locator('.pv-size').first().textContent()).replace(/\s+/g, ' ') === '40 × 64 in' && Math.abs((await readAmount(page)) - keep) <= 1 && (await page.locator('.s2-swgrid .s2-sw.on').count()) === 1, `${keep} -> ${await readAmount(page)}; size ${await page.locator('.pv-size').first().textContent()}; on ${await page.locator('.s2-swgrid .s2-sw.on').count()}`);
    if (vw < 700) {                                   // swipe on a phone
      await page.locator('.gal-stage').evaluate((el) => { const t = (type, x) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: 200 })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: 200 })] })); t('touchstart', 300); t('touchend', 100); });
      await page.waitForTimeout(400);
      check(`${tag} ${label}: a swipe moves to the next picture`, (await dots.nth(1).getAttribute('aria-selected')) === 'true');
      await dots.first().click();
    }
    if (vw < 700) {
      await page.evaluate(() => window.scrollTo(0, 700)); await page.waitForTimeout(500);
      const top = await page.locator('.s2-line-photo').evaluate((e) => Math.round(e.getBoundingClientRect().top));
      check(`${tag} ${label}: the preview stays at the top of the screen while scrolling`, top === 0, `top ${top}`);
      await page.getByRole('button', { name: 'Hide preview' }).click();
      const h = await page.locator('.s2-line-photo').evaluate((e) => e.getBoundingClientRect().height);
      check(`${tag} ${label}: the collapse button leaves a thin bar`, h < 90, `${Math.round(h)} px`);
      await page.getByRole('button', { name: 'Show preview' }).click();
    }
    check(`${tag} ${label}: no sideways scrolling`, (await page.evaluate(() => document.documentElement.scrollWidth)) <= vw);
    check(`${tag} ${label}: no console errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

// Roller double-stack and the motor
{
  const { ctx, page, errors } = await open(1280, 900, '/products/roller');
  await page.getByText('Double-stack', { exact: true }).first().click();
  await page.waitForSelector('.s2-color');
  await page.locator('.s2-color').nth(0).locator('.s2-sw').nth(1).click();
  await page.locator('.s2-color').nth(1).locator('.s2-sw').nth(4).click();
  await fill(page, 'w', '60'); await fill(page, 'h', '84');
  check('[1280px] Roller double-stack: the preview takes two colors', await page.waitForSelector('.pv-stage.ready', { timeout: 30000 }).then(() => true).catch(() => false) && errors.length === 0, errors.join(' | '));
  await page.getByText('Motorized', { exact: true }).first().click(); await page.waitForTimeout(600);
  check('[1280px] Roller: choosing a motor keeps the preview and says so', /Motorized/.test(await page.locator('.pv-note').textContent()));
  await ctx.close();
}

// the calm preview: no floating labels or pointer lines, one quiet size label, the working remote tile and what its "Works with" note says
for (const [vw, vh] of [[390, 844], [1280, 900]]) {
  const tag = `[${vw}px]`;
  const { ctx, page, errors } = await open(vw, vh, '/products/roller');
  await page.locator('.s2-sw').nth(3).click(); await fill(page, 'w', '40'); await fill(page, 'h', '60');
  await page.waitForSelector('.pv-stage.ready', { timeout: 30000 });
  const card = (n) => page.locator('.s2-card').filter({ has: page.locator('.s2-card-name', { hasText: new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
  const amount = () => readAmount(page);
  check(`${tag} no remote tile on a Zero gravity shade, and one quiet size label under the window`, (await page.locator('.rm').count()) === 0 && (await page.locator('.pv-size').innerText()).replace(/\s+/g, ' ') === '40 × 60 in');
  check(`${tag} no drag pill when the shade has a handle`, (await page.locator('.pv-handle').count()) === 0 && (await page.locator('.pv-grip').count()) === 1);
  await card('Chain').click(); await page.waitForTimeout(500);
  check(`${tag} a Chain shade has no handle: the bottom bar moves it, and a small first-use hint shows`, (await page.locator('.pv-grip').count()) === 0 && (await page.locator('.pv-bar').count()) === 1 && (await page.locator('.pv-handle:not(.gone)').count()) === 1 && await page.locator('.pv-handle i').evaluate((e) => e.getBoundingClientRect().width <= 26));
  await card('Motorized').click(); await page.waitForTimeout(900);
  check(`${tag} the remote tile is not on the picture: it sits below the preview, and the window has only the size label on it`, (await page.locator('.pv-stage .pv-incl').count()) === 0 && await page.evaluate(() => { const t = document.querySelector('.pv-incl').getBoundingClientRect(), st = document.querySelector('.pv-stage').getBoundingClientRect(); return t.top >= st.bottom - 1; }));
  check(`${tag} Motorized puts no label or pointer line on the picture (only the size label and the remote tile)`, (await page.locator('.pv-xlabel, .pv-solar-label, .pv-solar-line, .pv-dim').count()) === 0 && (await page.locator('.pv-stage .pv-size').count()) === 1);
  check(`${tag} the remote has three real, small buttons, and says "Included: remote"`, (await page.locator('.rm-key').count()) === 3 && await page.locator('.rm-key').evaluateAll((b) => b.every((x) => x.getBoundingClientRect().width >= 32 && x.getBoundingClientRect().height >= 32)) && /included: remote/i.test(await page.locator('.pv-incl').innerText()));
  const works = () => page.locator('.pv-incl').innerText().catch(() => '');
  check(`${tag} "Works with" says the phone for App + Remote`, /Works with your phone \(Smart Life app\)/.test(await works()));
  await card('App + Voice + Remote (Zigbee)').click(); await page.waitForTimeout(300);
  check(`${tag} Zigbee says it needs a hub, sold separately, $35`, /Needs a Zigbee hub \(sold separately, \$35\)/.test(await works()));
  await card('App + Voice + Remote (Matter)').click(); await page.waitForTimeout(300);
  check(`${tag} Matter says it works with a Matter smart speaker or hub`, /Works with your Matter smart speaker or hub/.test(await works()));
  await card('Remote only').click(); await page.waitForTimeout(300);
  check(`${tag} Remote only has no "Works with" box`, !/Works with|Needs a Zigbee/.test(await works()));
  await card('App + Remote (Bluetooth)').click(); await page.waitForTimeout(300);
  // the buttons move the shade; Stop holds it
  const a0 = await amount();
  await page.getByRole('button', { name: 'Lower the shade' }).click(); await page.waitForTimeout(150);
  check(`${tag} the remote press counts as the first use (the hint is gone)`, (await page.locator('.pv-handle.gone').count()) === 1);
  check(`${tag} the pressed remote button lights up`, (await page.locator('.rm-key.lit').count()) === 1);
  await page.waitForTimeout(1500);
  const a1 = await amount();
  check(`${tag} Down lowers the shade at a steady speed`, a1 > a0 + 3, `${a0} -> ${a1}`);
  await page.getByRole('button', { name: 'Stop' }).click(); const s1 = await amount(); await page.waitForTimeout(900); const s2 = await amount();
  check(`${tag} Stop holds the shade where it is`, s1 === s2 && s1 >= a1, `${s1} -> ${s2}`);
  await page.getByRole('button', { name: 'Raise the shade' }).click(); await page.waitForTimeout(1500);
  check(`${tag} Up raises it again`, (await amount()) < s2 - 3);
  await page.getByRole('button', { name: 'Stop' }).click();
  await setAmount(page, 30);
  check(`${tag} the bottom bar's arrow keys still work next to the remote`, Math.abs((await amount()) - 30) <= 3);
  await page.getByRole('button', { name: 'Lower the shade' }).focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(700); await page.getByRole('button', { name: 'Stop' }).click();
  check(`${tag} the remote works from the keyboard`, (await amount()) > 30);
  await card('Add a solar panel').click(); await page.waitForTimeout(900);
  check(`${tag} a solar panel adds no label and no pointer line to the picture`, (await page.locator('.pv-solar-label, .pv-solar-line').count()) === 0);
  await setAmount(page, 99); await page.waitForTimeout(400);
  check(`${tag} the picture still has just the size label and the remote tile when the shade is fully down`, (await page.locator('.pv-stage .pv-size').count()) === 1 && (await page.locator('.pv-incl').count()) === 1);
  check(`${tag} no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// the first-use hint (only on shades with no handle): gone after the first move, and it stays gone for the rest of the visit
{
  const { ctx, page } = await open(1280, 900, '/products/roller');
  await page.locator('.s2-sw').nth(3).click(); await fill(page, 'w', '40'); await fill(page, 'h', '60');
  await page.waitForSelector('.pv-stage.ready', { timeout: 30000 });
  await page.getByText('Chain', { exact: true }).first().click(); await page.waitForTimeout(500);
  check('[1280px] the hint is shown before anything is touched', (await page.locator('.pv-handle:not(.gone)').count()) === 1);
  await setAmount(page, 30); await page.waitForTimeout(900);
  check('[1280px] the hint fades out after the first move', (await page.locator('.pv-handle.gone').count()) === 1 && (await page.locator('.pv-handle').evaluate((e) => getComputedStyle(e).visibility)) === 'hidden');
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('.s2-sw').nth(3).click(); await fill(page, 'w', '40'); await fill(page, 'h', '60');
  await page.getByText('Chain', { exact: true }).first().click();
  await page.waitForSelector('.pv-stage.ready', { timeout: 30000 });
  check('[1280px] and it stays gone for the rest of the visit (after a reload)', (await page.locator('.pv-handle.gone').count()) === 1);
  await ctx.close();
}

// the room lab
for (const [vw, vh] of [[390, 844], [1280, 800]]) {
  const tag = `[${vw}px]`;
  const { ctx, page, errors } = await open(vw, vh, '/room-lab');
  await page.waitForSelector('.rl-stage[data-status=ready]', { timeout: 30000 });
  const first = await page.locator('.rl-pill-name').nth(1).textContent();
  check(`${tag} room lab: the first roller is called Solar`, first === 'Solar', first);
  await page.locator('.rl-pill').nth(1).getByRole('button', { name: /^Next/ }).dispatchEvent('click'); await page.waitForTimeout(300);
  check(`${tag} room lab: the next one is Screen view`, (await page.locator('.rl-pill-name').nth(1).textContent()) === 'Screen view');
  // the Solar color panel lists XS (solar family) codes, Screen view lists XSS / YSS / WSS codes
  await page.locator('.rl-pill').nth(1).getByRole('button', { name: /^Previous/ }).dispatchEvent('click'); await page.waitForTimeout(300);
  await page.locator('.rl-more').first().click(); await page.waitForSelector('.rl-dlg .s2-sw', { timeout: 20000 });
  const codes = await page.locator('.rl-dlg .s2-sw').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || '').split(' ').pop()));
  check(`${tag} room lab: Solar colors are the solar family (no XSS codes)`, codes.length > 10 && !codes.some((c) => /^XSS|^YSS|^WSS/.test(c)), codes.slice(0, 4).join(', '));
  await page.locator('.rl-dlg-close').click();
  // handles hide when curtains cover the window
  await page.getByRole('switch', { name: 'Curtains' }).click(); await page.waitForTimeout(600);
  await page.evaluate(() => { const el = document.getElementById('rl-curt'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '95'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(1500);
  const closed = await page.locator('.rl-handle.v').count();
  await page.evaluate(() => { const el = document.getElementById('rl-curt'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '10'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(1500);
  const open_ = await page.locator('.rl-handle.v').count();
  check(`${tag} room lab: shade handles hide when the curtains cover the windows and return when they open`, closed < open_ && open_ === 3, `closed ${closed}, open ${open_}`);
  check(`${tag} room lab: no sideways scrolling`, (await page.evaluate(() => document.documentElement.scrollWidth)) <= vw);
  check(`${tag} room lab: no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
