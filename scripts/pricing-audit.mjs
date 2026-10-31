// Lists every price table and every adder in the database with where it comes from, and flags what is neither from a supplier sheet nor owner-confirmed.
// Read-only. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Usage: node scripts/pricing-audit.mjs > docs/pricing-audit.md
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json();
const grids = await get('price_grids?select=line_id,systems,variant,lining,scope,special,multiplier,label,source_file,source_sheet,active&order=line_id,label');
const adders = await get('price_adders?select=line_id,adder_key,label,kind,amount,unit,applies_when,origin,status,source,note,active&order=line_id,adder_key');
const flags = await get('price_flags?select=flag_key,line_id,kind,title,resolved&resolved=eq.false&order=line_id');
const markups = await get('pricing_lines?select=id,markup&order=id');
const hw = await get('hardware_rates?select=id,label,amount,unit&order=sort_order').catch(() => []);
const out = [];
const w = (s = '') => out.push(s);
w('# Pricing audit'); w(); w(`Generated ${new Date().toISOString().slice(0, 10)} by scripts/pricing-audit.mjs. Costs are before the markup. Source: **sheet** = a supplier workbook, **owner** = a cost the owner confirmed, **NEITHER** = flagged.`); w();
w('## Markups'); w(); for (const m of markups) w(`- ${m.id}: ${Math.round(m.markup * 100)}%`); w();
w('## Price tables (grids)'); w();
const byLine = {};
for (const g of grids) (byLine[g.line_id] ||= []).push(g);
for (const [line, gs] of Object.entries(byLine)) {
  w(`### ${line} (${gs.length} grid${gs.length === 1 ? '' : 's'})`); w();
  w('| Table | Systems | Variant | Lining | Scope | x | Source | Active |'); w('|---|---|---|---|---|---|---|---|');
  const seen = new Set();
  for (const g of gs) {
    const src = g.source_file ? `sheet: ${g.source_file} / ${g.source_sheet}` : '**NEITHER** (no source file)';
    const key = [g.systems.join('+'), g.variant, g.lining, g.scope, g.special, g.multiplier, src].join('|');
    if (seen.has(key)) continue; seen.add(key);
    w(`| ${g.label.split(' · ').slice(0, 3).join(' · ')}${g.special ? ' (special sizes)' : ''} | ${g.systems.join('+')} | ${g.variant} | ${g.lining || '-'} | ${g.scope} | ${g.multiplier} | ${src} | ${g.active ? 'yes' : 'no'} |`);
  }
  w();
}
w('## Adders (add-ons and deductions)'); w();
w('| Line | Adder | Amount (cost) | When | Source | Active |'); w('|---|---|---|---|---|---|');
const OWNER = /owner|confirmed/i;
const neither = [];
for (const a of adders) {
  let src;
  if (a.origin === 'sheet' || a.status === 'from_sheet') src = `sheet${a.source ? `: ${a.source}` : ''}`;
  else if (OWNER.test(a.source || '')) src = `owner: ${a.source}`;
  else if (a.status === 'from_supplier') src = `supplier answer: ${a.source || 'unrecorded'}`;
  else { src = '**NEITHER**'; if (a.active) neither.push(a); }
  w(`| ${a.line_id} | ${a.label} (${a.adder_key}) | ${a.kind === 'add' ? '+' : '-'}$${a.amount ?? '?'}${a.unit === 'per_sqft' ? '/sq ft' : ''} | ${JSON.stringify(a.applies_when)} | ${src} | ${a.active ? 'yes' : 'no'} |`);
}
w();
if (hw.length) { w('## Curtain hardware rates (admin-editable)'); w(); for (const r of hw) w(`- ${r.label}: ${r.amount} ${r.unit}`); w(); }
w('## Prices that are not in a supplier workbook'); w();
w('- Motor $70 (every motor type, including the 2 in 1 and the cellular motors), Solar panel $30, Dream Curtains motor $100: owner-confirmed costs. Not changed.');
w('- Zigbee hub $35: owner-confirmed flat SELLING price (no markup), stored in hardware_rates (id zigbee_hub, migration 20) and editable in admin; offered once per order in the cart, its own order line, quantity 1.');
w('- Zero gravity: no price of its own. It uses the supplier sheet Cordless / Free-stop table on each line (migration 20).');
w('- Curtain fabric (drapery_tiers, drapery_fabrics, the liner, shipping and ripple numbers): measured from the supplier drapery order form by the owner; reproduces six supplier quotes within $1 (supabase/tests/20_options_hardware_tests.sql). Source type: owner-supplied measurement, not a workbook.');
w('- Curtain hardware (hardware_rates: $/m, $/kg, weights, motor $100, finial $18): from the owner\'s order form notes. The finial amount per pair vs per finial is an open question (flag hardware-finial-price).');
w();
w('## Flags: active adders that are neither from a sheet nor owner-confirmed'); w();
w(neither.length ? neither.map((a) => `- ${a.line_id} / ${a.label}: $${a.amount}`).join('\n') : 'None.'); w();
w('## Open price flags'); w(); for (const f of flags) w(`- [${f.kind}] ${f.line_id || 'general'}: ${f.title}`); w();
console.log(out.join('\n'));
