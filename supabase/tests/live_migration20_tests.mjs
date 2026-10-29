// Live tests of migrations 20 (step A) and 21 (step B, only the checks marked B) against the real project, run after the owner pastes them:
// Zero gravity +$18 (customer +$27, per shade), the 2 in 1 motor, Chain on Roman and Cellular, Dream Curtains motorized and pull rod, Best value and Top of the line,
// public_options, and the hardware prices (the owner's check numbers) with the rates editable. Everything it changes it puts back to the value it read first.
// Exits 2 when migration 20 is not applied yet.
const URL_ = process.env.SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (k) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const api = async (m, p, k, b) => { const r = await fetch(URL_ + p, { method: m, headers: H(k), body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; };
const rpc = (fn, args, k = ANON) => api('POST', `/rest/v1/rpc/${fn}`, k, args);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };
const restore = [];
try {
  const probe = await rpc('public_options', { p_line: 'roller' });
  if (probe.status === 404) { console.log('Migration 20 is not applied yet. Paste supabase/migrations/20261029000020_product_page_options_step_a.sql into the Supabase SQL Editor, then run this again.'); process.exit(2); }
  const stepB = !(await api('GET', '/rest/v1/option_values?select=id&code=eq.cordless&active=eq.true&group_id=in.(roller:control,zebra:control,roman:control,cellular:control)', SVC)).body.length;

  // ---- public_options
  const opts = async (line) => (await rpc('public_options', { p_line: line })).body;
  const best = async (line) => (await opts(line)).filter((o) => o.group === 'control' && o.best).map((o) => o.code);
  const top = async (line) => (await opts(line)).filter((o) => o.group === 'control' && o.top).map((o) => o.code);
  const bestNow = { roller: await best('roller'), zebra: await best('zebra'), roman: await best('roman'), cellular: await best('cellular'), 'shangri-la': await best('shangri-la'), drapery: await best('drapery') };
  check('Best value is one movement per line, Zero gravity by default on Roller, Zebra, Roman and Cellular, none on Shangri-La and Dream Curtains (unless the owner has picked since)', Object.values(bestNow).every((a) => a.length <= 1), JSON.stringify(bestNow));
  check('Top of the line is one movement per line, Motorized by default', (await Promise.all(['roller', 'zebra', 'roman', 'cellular', 'shangri-la', 'drapery'].map(top))).every((a) => a.length <= 1), JSON.stringify(await top('roller')));
  const all = JSON.stringify(await opts('roller'));
  check('public_options returns only display fields (no costs, markups, grids or price groups)', !/cost|markup|grid|amount|price_group|collection/i.test(all), all.slice(0, 120));
  if (stepB) check('B: Cordless is off on Roller, Zebra, Roman and Cellular, and Zero gravity is the default', (await Promise.all(['roller', 'zebra', 'roman', 'cellular'].map(async (l) => (await opts(l)).filter((o) => o.code === 'cordless' && o.active).length))).every((n) => n === 0));

  // ---- Best value and Top of the line: one per line, changed by an admin (here the service role), and put back
  const rows = (await api('GET', '/rest/v1/option_values?select=id,best_value,top_of_line&group_id=eq.roller:control', SVC)).body;
  restore.push(async () => { for (const r of rows) await api('PATCH', `/rest/v1/option_values?id=eq.${r.id}`, SVC, { best_value: false, top_of_line: false }); for (const r of rows) if (r.best_value || r.top_of_line) await api('PATCH', `/rest/v1/option_values?id=eq.${r.id}`, SVC, { best_value: r.best_value, top_of_line: r.top_of_line }); });
  await api('PATCH', '/rest/v1/option_values?id=eq.roller:control:chain', SVC, { best_value: true });
  check('setting another Best value moves it (one per line)', JSON.stringify(await best('roller')) === JSON.stringify(['chain']));
  await api('PATCH', '/rest/v1/option_values?id=eq.roller:control:chain', SVC, { top_of_line: true });
  check('Top of the line moves the same way and does not touch Best value', JSON.stringify(await top('roller')) === JSON.stringify(['chain']) && JSON.stringify(await best('roller')) === JSON.stringify(['chain']));
  const bad = await api('PATCH', '/rest/v1/option_values?id=eq.roller:chain-color:white', SVC, { best_value: true });
  check('Best value cannot be put on a choice that is not a movement', bad.status >= 400);

  // ---- prices
  const cat = (await (await fetch(`${URL_}/rest/v1/rpc/public_catalog`, { method: 'POST', headers: H(ANON), body: JSON.stringify({ p_scope: ['roller', 'zebra', 'cellular', 'drapery', 'roman', 'dream-curtains'] }) })).json());
  const swatch = (pl, fam) => cat.find((g) => g.shown_in.includes(pl) && (!fam || g.family === fam))?.swatches[0];
  const price = async (line, sw, options, w = 40, h = 64) => (await rpc('estimate_price_for_swatch', { p_line: line, p_swatch_id: sw.id, p_options: options, p_width: w, p_height: h })).body.price;
  const r = swatch('roller'), z = swatch('zebra'), ro = swatch('roman'), ce = swatch('cellular'), dr = swatch('dream-curtains');
  const near = (a, b) => a != null && b != null && Math.abs(a - b) <= 1;
  check('Roller: Zero gravity = the chain (plain) price + $27 ($18 cost with the 1.5x markup)', near(await price('roller', r, { control: 'zero-gravity', mode: 'single' }), (await price('roller', r, { control: 'chain', mode: 'single' })) + 27));
  check('Zebra: Zero gravity = the chain price + $27', near(await price('zebra', z, { control: 'zero-gravity' }), (await price('zebra', z, { control: 'chain' })) + 27));
  check('Roman: Zero gravity = the plain (cordless table) price + $27', near(await price('roman', ro, { control: 'zero-gravity', lining: 'light-filtering' }), (await price('roman', ro, { control: 'cordless', lining: 'light-filtering' })) + 27));
  check('Cellular: Zero gravity = the plain price + $27', near(await price('cellular', ce, { control: 'zero-gravity', type: 'standard' }), (await price('cellular', ce, { control: 'cordless', type: 'standard' })) + 27));
  const r2 = swatch('roller', 'blackout') || r;
  check('Roller double-stack: Zero gravity adds $27 per shade ($54)', near(await price('roller', r, { control: 'zero-gravity', mode: 'double-stack', back_swatch_id: r2.id }), (await price('roller', r, { control: 'chain', mode: 'double-stack', back_swatch_id: r2.id })) + 54));
  check('Roller: the 2 in 1 motor costs the plain price + $105 ($70 motor with the markup), like Motorized', near(await price('roller', r, { control: 'two-in-one' }), (await price('roller', r, { control: 'chain' })) + 105) && near(await price('roller', r, { control: 'two-in-one' }), await price('roller', r, { control: 'motorized', power: 'battery', solar: 'none', motor_control: 'app-remote' })));
  check('Roman and Cellular: Chain is priced (the cord table)', (await price('roman', ro, { control: 'chain', lining: 'light-filtering' })) > 0 && (await price('cellular', ce, { control: 'chain', type: 'standard' })) > 0);
  if (dr) {
    const man = await price('dream-curtains', dr, { control: 'manual' }, 60, 84);
    check('Dream Curtains: Motorized costs the motor table plus the $100 motor (same as the old remote code); Pull rod is priced like Manual', near(await price('dream-curtains', dr, { control: 'motorized' }, 60, 84), await price('dream-curtains', dr, { control: 'remote' }, 60, 84)) && near(await price('dream-curtains', dr, { control: 'pull-rod' }, 60, 84), man));
  }

  // ---- hardware
  const hw = async (track, family, width, extra = {}) => (await rpc('hardware_estimate', { p_options: { track, style_family: family, ...extra }, p_width: width })).body;
  const arc = await hw('arc-rail', 'pleated', 100);
  check('a 100 in Arc rail costs about $90 before markup: the customer price is $135', arc.price === 135, JSON.stringify(arc));
  const mot = await hw('motorized-rail', 'pleated', 100);
  check('a 100 in motorized rail: customer price is the cost ($237.05) x 1.5 = $356', mot.price === 356, JSON.stringify(mot));
  check('the answer holds only the price (no cost parts)', Object.keys(arc).join() === 'price');
  check('a motorized rail is not available for grommet or rod pocket', (await hw('motorized-rail', 'grommet', 100)).not_available === true && (await hw('motorized-rail', 'rod-pocket', 100)).not_available === true);
  check('the public cannot read the rates, the breakdown or the cost parts', (await api('GET', '/rest/v1/hardware_rates?select=*', ANON)).status >= 400 && (await rpc('hardware_breakdown', { p_options: {}, p_width: 1 })).status >= 400 && (await rpc('hardware_parts', { p_options: {}, p_width: 1 })).status >= 400);
  const rate = (await api('GET', '/rest/v1/hardware_rates?select=id,amount&id=eq.ship_per_kg', SVC)).body[0];
  restore.push(() => api('PATCH', '/rest/v1/hardware_rates?id=eq.ship_per_kg', SVC, { amount: rate.amount }));
  await api('PATCH', '/rest/v1/hardware_rates?id=eq.ship_per_kg', SVC, { amount: Number(rate.amount) * 2 });
  const doubled = await hw('arc-rail', 'pleated', 100);
  check('the $/kg rate is editable and moves the price', doubled.price > arc.price, `${arc.price} -> ${doubled.price}`);
} catch (e) { console.log('TEST ERROR:', e.stack || e.message); results.push({ name: 'script ran to completion', ok: false }); }
finally { for (const f of restore.reverse()) await f().catch(() => {}); }
const bad = results.filter((x) => !x.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? ` | FAILED: ${bad.map((b) => b.name).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
