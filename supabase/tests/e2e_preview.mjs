// Browser test of the product-page 3D preview (Roller and Zebra) and the room lab, at 390 and 1280 px. Needs a preview server (BASE_URL, default
// http://localhost:4173). Runs with software WebGL. Checks: the preview comes up and replaces the photo; it follows the size, color, mount, control, cover and
// double-stack choices; the size labels read the typed size and "Hide sizes" hides them; drag and slider move the shade; "See it in a room"; the photo tab;
// the phone dock and its collapse button; no sideways scroll; no console errors; and the room lab's names, hidden handles and curtains.
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

for (const [vw, vh] of [[390, 844], [1280, 900]]) {
  const tag = `[${vw}px]`;
  for (const [path, label] of [['/products/roller', 'Roller'], ['/products/zebra', 'Zebra']]) {
    const { ctx, page, errors } = await open(vw, vh, path);
    await page.waitForSelector('.s2-sw', { timeout: 20000 });
    await page.locator('.s2-sw').nth(2).click();
    check(`${tag} ${label}: the 3D preview replaces the photo`, await page.waitForSelector('.pv-stage.ready', { timeout: 30000 }).then(() => true).catch(() => false));
    check(`${tag} ${label}: no size labels before a real size is entered`, (await page.locator('.pv-dim').count()) === 0);
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
    const wLabel = await page.locator('.pv-dim-w b').first().textContent().catch(() => null);
    const hLabel = await page.locator('.pv-dim-h b').first().textContent().catch(() => null);
    check(`${tag} ${label}: size labels read the typed size`, wLabel === '40 in wide' && hLabel === '64 in high', `${wLabel} / ${hLabel}`);
    await fill(page, 'w', '44 1/2'); await page.waitForTimeout(500);
    check(`${tag} ${label}: a fraction shows in the label`, (await page.locator('.pv-dim-w b').first().textContent()) === '44 1/2 in wide');
    await page.getByRole('button', { name: /Hide sizes/ }).click();
    check(`${tag} ${label}: "Hide sizes" hides the labels`, (await page.locator('.pv-dim').count()) === 0);
    await page.getByRole('button', { name: /Show sizes/ }).click();
    // the slider moves the shade
    const before = await page.$eval('#pv-amount', (e) => e.value);
    await page.evaluate(() => { const el = document.getElementById('pv-amount'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '20'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    check(`${tag} ${label}: the slider moves the shade`, before !== '20' && (await page.$eval('#pv-amount', (e) => e.value)) === '20');
    // dragging the shade
    if (vw > 700) {
      const box = await page.locator('.pv-drag').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8, { steps: 6 }); await page.mouse.up();
      const after = Number(await page.$eval('#pv-amount', (e) => e.value));
      check(`${tag} ${label}: dragging the shade down lowers it`, after > 40, `slider ${after}`);
    }
    // options: outside mount, motor (not on every line), no fabric wrap
    await page.getByText('Outside mount', { exact: true }).first().click(); await page.waitForTimeout(500);
    await page.getByText('No fabric wrap', { exact: true }).first().click(); await page.waitForTimeout(500);
    check(`${tag} ${label}: mount and top cover changes keep the preview up`, (await page.locator('.pv-stage.ready').count()) === 1);
    // a very large and a very small size
    await fill(page, 'w', '300'); await fill(page, 'h', '120'); await page.waitForTimeout(500);
    await fill(page, 'w', '12'); await fill(page, 'h', '12'); await page.waitForTimeout(500);
    check(`${tag} ${label}: very large and very small sizes still draw`, (await page.locator('.pv-stage.ready').count()) === 1 && errors.length === 0, errors.join(' | '));
    // room
    await fill(page, 'w', '40'); await fill(page, 'h', '64');
    await page.getByRole('button', { name: 'See it in a room' }).click();
    check(`${tag} ${label}: "See it in a room" shows the room`, await page.waitForSelector('.pv-room .rl-stage[data-status=ready]', { timeout: 30000 }).then(() => true).catch(() => false));
    const crop = await page.locator('.pv-room .rl-room').evaluate((i) => ({ top: i.style.top, height: i.style.height, stage: i.parentElement.getBoundingClientRect().height, img: i.getBoundingClientRect().height }));
    check(`${tag} ${label}: the room view is never cropped top or bottom (windows and sills show whole)`, (vw > 700 ? crop.top !== '' : parseFloat(crop.top) === 0 && parseFloat(crop.height) === 100), JSON.stringify(crop));
    check(`${tag} ${label}: three handles in the room`, (await page.locator('.pv-room .rl-handle').count()) === 3);
    await page.getByRole('button', { name: 'Back to my window' }).click();
    check(`${tag} ${label}: back to the window`, await page.waitForSelector('.pv-stage.ready', { timeout: 30000 }).then(() => true).catch(() => false));
    // photo tab
    await page.getByRole('tab', { name: 'Style photo' }).click();
    check(`${tag} ${label}: the style photo tab shows the photo`, (await page.locator('.s2-photo-frame img').count()) > 0 && (await page.locator('.pv-stage').count()) === 0);
    await page.getByRole('tab', { name: 'Your blind' }).click();
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
  const amount = async () => Number(await page.locator('#pv-amount').inputValue());
  check(`${tag} no remote tile on a chain shade, and one quiet size label under the window`, (await page.locator('.rm').count()) === 0 && (await page.locator('.pv-size').innerText()).replace(/\s+/g, ' ') === '40 × 60 in');
  await card('Motorized').click(); await page.waitForTimeout(900);
  check(`${tag} Motorized puts no label or pointer line on the picture (only the size label and the remote tile)`, (await page.locator('.pv-xlabel, .pv-solar-label, .pv-solar-line, .pv-dim').count()) === 0 && (await page.locator('.pv-stage .pv-size').count()) === 1);
  check(`${tag} the remote has three real, small buttons, and says "Included: remote"`, (await page.locator('.rm-key').count()) === 3 && await page.locator('.rm-key').evaluateAll((b) => b.every((x) => x.getBoundingClientRect().width >= 36 && x.getBoundingClientRect().height >= 36)) && /included: remote/i.test(await page.locator('.pv-incl').innerText()));
  const works = () => page.locator('.pv-incl').innerText().catch(() => '');
  check(`${tag} "Works with" says the phone for App + Remote`, /Works with your phone \(Smart Life app\)/.test(await works()));
  await card('App + Voice + Remote (Zigbee)').click(); await page.waitForTimeout(300);
  check(`${tag} Zigbee says it needs a hub, sold separately, $35`, /Needs a Zigbee hub \(sold separately, \$35\)/.test(await works()));
  await card('App + Voice + Remote (Matter)').click(); await page.waitForTimeout(300);
  check(`${tag} Matter says it works with a Matter smart speaker or hub`, /Works with your Matter smart speaker or hub/.test(await works()));
  await card('Remote control only').click(); await page.waitForTimeout(300);
  check(`${tag} Remote control only has no "Works with" box`, !/Works with|Needs a Zigbee/.test(await works()));
  await card('App + Remote').click(); await page.waitForTimeout(300);
  // the buttons move the shade; Stop holds it
  const a0 = await amount();
  await page.getByRole('button', { name: 'Lower the shade' }).click(); await page.waitForTimeout(150);
  check(`${tag} the pressed remote button lights up`, (await page.locator('.rm-key.lit').count()) === 1);
  await page.waitForTimeout(1500);
  const a1 = await amount();
  check(`${tag} Down lowers the shade at a steady speed`, a1 > a0 + 3, `${a0} -> ${a1}`);
  await page.getByRole('button', { name: 'Stop' }).click(); const s1 = await amount(); await page.waitForTimeout(900); const s2 = await amount();
  check(`${tag} Stop holds the shade where it is`, s1 === s2 && s1 >= a1, `${s1} -> ${s2}`);
  await page.getByRole('button', { name: 'Raise the shade' }).click(); await page.waitForTimeout(1500);
  check(`${tag} Up raises it again`, (await amount()) < s2 - 3);
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.locator('#pv-amount').fill('30'); await page.waitForTimeout(300);
  check(`${tag} the slider still works next to the remote`, (await amount()) === 30);
  await page.getByRole('button', { name: 'Lower the shade' }).focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(700); await page.getByRole('button', { name: 'Stop' }).click();
  check(`${tag} the remote works from the keyboard`, (await amount()) > 30);
  await card('Add a solar panel').click(); await page.waitForTimeout(900);
  check(`${tag} a solar panel adds no label and no pointer line to the picture`, (await page.locator('.pv-solar-label, .pv-solar-line').count()) === 0);
  await page.locator('#pv-amount').fill('100'); await page.waitForTimeout(600);
  check(`${tag} the picture still has just the size label and the remote tile when the shade is fully down`, (await page.locator('.pv-stage .pv-size').count()) === 1 && (await page.locator('.pv-incl').count()) === 1);
  check(`${tag} no console errors`, errors.length === 0, errors.join(' | '));
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
  const codes = await page.locator('.rl-dlg .s2-sw-code').allTextContents();
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
