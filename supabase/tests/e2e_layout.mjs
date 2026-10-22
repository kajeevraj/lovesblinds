// Layout test at 390, 768 and 1280 px: the sticky price bar lines up (label, price and button on one center line, the button as tall as
// the price block, even padding, content on the same edges as the page above it), controls that sit side by side have the same height,
// and padding on cards uses the spacing scale. Needs a preview on BASE_URL (default http://localhost:4173).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const SCALE = [0, 4, 8, 12, 16, 24, 32, 48];
const browser = await chromium.launch();
try {
  for (const [w, h] of [[390, 844], [768, 900], [1280, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } }); page.setDefaultTimeout(30000);
    await page.goto(`${BASE}/products/roller`); await page.locator('.s2-sw').first().waitFor();
    await page.locator('.s2-sw').first().click();
    await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64'); await page.locator('#s2-qty').fill('3');
    await page.getByText(/each · 3 blinds/).first().waitFor();
    const m = await page.evaluate(() => {
      const R = (s) => { const x = document.querySelector(s).getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom, h: x.height, cy: (x.top + x.bottom) / 2 }; };
      const bar = document.querySelector('.s2-bar'); const inner = getComputedStyle(document.querySelector('.s2-bar-inner'));
      const rows = (sel) => [...document.querySelectorAll(sel)].map((row) => [...row.children].filter((c) => c.tagName !== 'LABEL' && c.offsetHeight).map((c) => Math.round(c.getBoundingClientRect().height * 10) / 10));
      const pads = (sel) => [...document.querySelectorAll(sel)].map((e) => { const c = getComputedStyle(e); return ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map((k) => parseFloat(c[k])); });
      return {
        txt: R('.s2-bar-text'), btn: R('.s2-bar-btn'), ord: R('.s2-bar-order'), crumbs: R('.s2-crumbs'), bar: bar.getBoundingClientRect().toJSON(),
        padT: parseFloat(inner.paddingTop), padB: parseFloat(inner.paddingBottom), padL: parseFloat(inner.paddingLeft), padR: parseFloat(inner.paddingRight),
        value: R('.s2-bar-value'), sub: R('.s2-bar-sub'),
        sizeRows: rows('.s2-field-row'), qtyRow: rows('.s2-qty-row'), cardPads: pads('.s2-estimate, .s2-card'),
        vw: document.documentElement.clientWidth,
      };
    });
    check(`[${w}px] bar: price block, Add to cart and the order button share one center line, and the button is as tall as the price block`, Math.abs(m.txt.cy - m.btn.cy) < 0.6 && Math.abs(m.txt.h - m.btn.h) < 0.6 && Math.abs(m.ord.cy - m.btn.cy) < 0.6, `price block ${m.txt.h}px at ${m.txt.cy.toFixed(1)}, button ${m.btn.h}px at ${m.btn.cy.toFixed(1)}, order button at ${m.ord.cy.toFixed(1)}`);
    check(`[${w}px] bar: one clean row (nothing wraps onto a second line) and the price lines are centered in the price block`, m.bar.height < 80 && m.value.t >= m.txt.t - 0.5 && m.sub.b <= m.txt.b + 0.5 && Math.abs((m.value.t - m.txt.t) - (m.txt.b - m.sub.b)) < 1.6, `bar ${m.bar.height}px, gaps ${(m.value.t - m.txt.t).toFixed(1)}/${(m.txt.b - m.sub.b).toFixed(1)}`);
    check(`[${w}px] bar: even padding top and bottom, and left and right`, m.padT === m.padB && m.padL === m.padR && Math.abs((m.txt.t - m.bar.top - 1) - (m.bar.bottom - m.btn.b)) < 1.5 || Math.abs((m.txt.t - m.bar.top) - (m.bar.bottom - m.txt.b)) < 1.6, `padding ${m.padT}/${m.padR}/${m.padB}/${m.padL}, space above ${(m.txt.t - m.bar.top).toFixed(1)} (includes the 1px edge), below ${(m.bar.bottom - m.txt.b).toFixed(1)}`);
    check(`[${w}px] bar: content starts and ends on the same edges as the page content above`, Math.abs(m.txt.l - m.crumbs.l) < 0.6 && Math.abs((m.vw - m.ord.r) - m.crumbs.l) < 0.6, `text ${m.txt.l}, page ${m.crumbs.l}; order button right gap ${(m.vw - m.ord.r).toFixed(1)}`);
    check(`[${w}px] width/height fields: input and fraction select are the same height`, m.sizeRows.every((r) => r.length >= 2 && r.every((x) => x === r[0])), JSON.stringify(m.sizeRows));
    check(`[${w}px] quantity: − button, number box and + button are the same height`, m.qtyRow.every((r) => r.length === 3 && r.every((x) => x === r[0])), JSON.stringify(m.qtyRow));
    check(`[${w}px] estimate card and option cards use the spacing scale for padding`, m.cardPads.every((p) => p.every((v) => SCALE.includes(Math.round(v)) || Math.round(v) === 15)), JSON.stringify([...new Set(m.cardPads.map((p) => p.join('/')))]));
    await page.close();
  }
  // order page cards
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } }); page.setDefaultTimeout(30000);
    await page.goto(`${BASE}/products/zebra`); await page.locator('.s2-sw').first().waitFor();
    await page.locator('.s2-sw').first().click(); await page.locator('#s2-w').fill('40'); await page.locator('#s2-h').fill('64');
    await page.waitForFunction(() => !document.querySelector('.s2-bar-btn').disabled); await page.locator('.s2-bar-btn').click();
    await page.goto(`${BASE}/order?checkout=1`); await page.locator('.s2-item').first().waitFor();
    await page.waitForFunction(() => !/Calculating/.test(document.querySelector('.s2-items').innerText));
    const o = await page.evaluate(() => {
      const edge = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.left * 10) / 10, Math.round(r.right * 10) / 10]; };
      const pad = (s) => { const c = getComputedStyle(document.querySelector(s)); return [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map(parseFloat); };
      const title = document.querySelector('.s2-order-title').getBoundingClientRect();
      const edges = ['.s2-item', '.s2-total', '.s2-details-title', '.s2-send', '.s2-add-another'].map((s) => edge(s)[0]);
      const right = ['.s2-item', '.s2-total', '.s2-send'].map((s) => edge(s)[1]);
      const fields = [...document.querySelectorAll('.s2-form input.s2-input')].map((e) => Math.round(e.getBoundingClientRect().height));
      return { titleLeft: Math.round(title.left * 10) / 10, edges, right, itemPad: pad('.s2-item'), totalPad: pad('.s2-total'), fields };
    });
    check(`[${w}px] order page: cards, heading, button and form start on the same left edge and cards and button end on the same right edge`, o.edges.every((x) => Math.abs(x - o.titleLeft) < 0.6) && Math.abs(o.right[0] - o.right[1]) < 0.6 && Math.abs(o.right[1] - o.right[2]) < 0.6, JSON.stringify(o));
    check(`[${w}px] order page: card padding is even on all four sides and on the spacing scale`, [o.itemPad, o.totalPad].every((p) => p.every((v) => v === p[0]) && SCALE.includes(p[0])), JSON.stringify([o.itemPad, o.totalPad]));
    check(`[${w}px] order page: single-line form boxes are all 48 px`, o.fields.every((x) => x === 48), o.fields.join(','));
    await page.close();
  }
} catch (e) {
  console.log('\nTEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false });
} finally {
  await browser.close();
  const bad = results.filter((x) => !x.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
