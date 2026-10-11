// Seeds the product-option tables from what the site does today (src/data/lines.js, optionInfo.js, selectionText.js), plus the
// pricing lines, the flags to confirm with the supplier, the Dream Curtains motor placeholder and the woven wood size standards.
// Inserts only what is missing: it never overwrites anything edited in the admin.
//
//   node scripts/seed-options.mjs            dry run (counts)
//   node scripts/seed-options.mjs --apply    write to the Supabase project (service role)
//   node scripts/seed-options.mjs --sql out.sql   write INSERT ... ON CONFLICT DO NOTHING statements (local tests)
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { LINES, MOUNTS } from '../src/data/lines.js';
import * as INFO from '../src/data/optionInfo.js';
import { FAMILY_LABELS, CELLULAR_TYPES, ROMAN_STYLES, LINING_LABELS, PLEATS, SECTION_LABELS, MODE_LABELS } from '../src/lib/selectionText.js';

const args = process.argv.slice(2); const APPLY = args.includes('--apply'); const SQL = args.includes('--sql') ? args[args.indexOf('--sql') + 1] : null;
for (const f of ['.env.seed.local', '.env.local']) if (existsSync(f)) for (const l of readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }

// ---- product lines, groups, values ------------------------------------------------------------------------------
const rows = { product_lines: [], option_groups: [], option_values: [], pricing_lines: [], price_adders: [], price_flags: [], size_rules: [] };
const LINE_ORDER = ['roller', 'zebra', 'shangri-la', 'roman', 'cellular', 'drapery', 'wood', 'shutters', 'zipscreen', 'outdoor'];
LINE_ORDER.forEach((id, i) => {
  const l = LINES.find((x) => x.id === id);
  rows.product_lines.push({ id, name: l.name, blurb: l.blurb || '', description: l.description || '', good_to_know: l.goodToKnow || [], location: l.location, active: l.active, price_on_request: id === 'drapery', sort_order: i });
});
rows.product_lines.push({ id: 'woven-wood', name: 'Woven Wood Shades', blurb: '', description: '', good_to_know: [], location: 'indoor', active: false, price_on_request: false, sort_order: 10 });

// control -> price grid system (decisions in docs/pricing-stage1-plan.md)
const GRID_SYSTEM = {
  roller: { chain: 'cord', cordless: 'cordless', remote: 'motor', matter: 'motor', motor: 'motor' },
  zebra: { chain: 'cord', cordless: 'cordless', remote: 'motor', matter: 'motor' },
  'shangri-la': { remote_wand: 'cord', matter: 'cord' },
  roman: { cordless: 'cordless', remote: 'motor', motor: 'motor' },
  cellular: { cordless: 'cordless', freestop: 'cord', remote: 'cord', matter: 'cord', motor: 'cord' },
  drapery: { manual: 'manual', remote: 'motor', matter: 'motor' },
  'woven-wood': { cord: 'cord', cordless: 'cordless', remote: 'motor' },
};
let gsort = {};
const group = (line, key, label, { bound = false, note = null } = {}) => {
  gsort[line] = (gsort[line] ?? -1) + 1;
  const id = `${line}:${key}`; rows.option_groups.push({ id, line_id: line, key, label, note, bound, sort_order: gsort[line] }); return id;
};
const value = (gid, code, label, { explanation = null, image_key = null, grid_system = null, is_default = false, sort }) =>
  rows.option_values.push({ id: `${gid}:${code}`, group_id: gid, code, label, explanation, image_key, grid_system, active: true, is_default, sort_order: sort });
const ctl = (line, lineObj, label) => {
  const gid = group(line, 'control', label);
  lineObj.mechanisms.forEach((m, i) => value(gid, m.id, m.name, {
    explanation: INFO.CONTROL_COPY[m.id] || null, image_key: INFO.CONTROL_IMG[line]?.[m.id] || null,
    grid_system: GRID_SYSTEM[line]?.[m.id] || null, is_default: i === 0, sort: i }));
};
const mount = (line, lineObj) => {
  const gid = group(line, 'mount', 'Mount type');
  lineObj.mounts.forEach((id, i) => value(gid, id, MOUNTS.find((m) => m.id === id).name, { explanation: INFO.MOUNT_INFO[id]?.desc || null, image_key: INFO.MOUNT_INFO[id]?.img || null, is_default: i === 0, sort: i }));
};
for (const id of LINE_ORDER) {
  const l = LINES.find((x) => x.id === id);
  if (id === 'roller') {
    const m = group(id, 'mode', 'Single or double-stack', { bound: true, note: 'At night with lights on, people outside can see through Screen View and see-through Solar fabrics, so choose Blackout or a double-stack for night privacy.' });
    l.modes.forEach((c, i) => value(m, c, MODE_LABELS[c], { explanation: INFO.ROLLER_MODE_INFO[c].desc, image_key: INFO.ROLLER_MODE_INFO[c].img, is_default: i === 0, sort: i }));
    const f = group(id, 'family', 'Fabric family', { bound: true });
    l.families.forEach((c, i) => value(f, c, FAMILY_LABELS[c], { is_default: i === 0, sort: i }));
  }
  if (id === 'cellular') {
    const g = group(id, 'type', 'Product type', { bound: true });
    CELLULAR_TYPES.forEach((c, i) => value(g, c.id, c.label, { explanation: INFO.CELLULAR_TYPE_INFO[c.id].desc, image_key: INFO.CELLULAR_TYPE_INFO[c.id].img, is_default: i === 0, sort: i }));
    const f = group(id, 'family', 'Light filtering or blackout', { bound: true });
    l.families.forEach((c, i) => value(f, c, FAMILY_LABELS[c], { is_default: i === 0, sort: i }));
  }
  if (id === 'roman') {
    const g = group(id, 'style', 'Style', { bound: true, note: 'Styles that are not available in a fabric are greyed out.' });
    ROMAN_STYLES.forEach((c, i) => value(g, c.id, c.label, { explanation: INFO.ROMAN_STYLE_INFO[c.id].desc, image_key: INFO.ROMAN_STYLE_INFO[c.id].img, sort: i }));
    const li = group(id, 'lining', 'Lining', { bound: true });
    ['blackout', 'light-filtering'].forEach((c, i) => value(li, c, LINING_LABELS[c], { explanation: INFO.LINING_INFO[c], sort: i }));
  }
  if (id === 'drapery') {
    const s = group(id, 'section', 'Drapery type', { bound: true });
    l.sections.forEach((c, i) => value(s, c.id, c.name, { is_default: i === 0, sort: i }));
    const p = group(id, 'pleat', 'Pleat style', { note: 'Availability confirmed with your quote' });
    PLEATS.forEach((c, i) => value(p, c, c, { explanation: INFO.PLEAT_INFO[c].desc, image_key: INFO.PLEAT_INFO[c].img, sort: i }));
    const li = group(id, 'lining', 'Lining', { bound: true });
    ['blackout', 'light-filtering', 'none'].forEach((c, i) => value(li, c, LINING_LABELS[c], { explanation: INFO.LINING_INFO[c], sort: i }));
    const d = group(id, 'dream-style', 'Dream Curtains style', { bound: true });
    ['A', 'B'].forEach((c, i) => value(d, c, `Style ${c}`, { explanation: INFO.DREAM_STYLE_INFO[c].desc, image_key: INFO.DREAM_STYLE_INFO[c].img, sort: i }));
  }
  ctl(id, l, id === 'drapery' ? 'Control (track)' : 'Control');
  mount(id, l);
}
// woven wood: hidden line, controls only (its price adders refer to these codes)
{
  const gid = group('woven-wood', 'control', 'Control');
  [['cord', 'Cord'], ['cordless', 'Cordless'], ['remote', 'Remote (motor)']].forEach(([c, n], i) => value(gid, c, n, { grid_system: GRID_SYSTEM['woven-wood'][c], is_default: i === 0, sort: i }));
}

// ---- pricing ----------------------------------------------------------------------------------------------------
const PL = [['roller', 'Roller Shades', 'roller', 'either'], ['zebra', 'Zebra / Dual Shades', 'zebra', 'width'], ['shangri-la', 'Shangri-La Shades', 'shangri-la', null],
  ['roman', 'Roman Shades', 'roman', null], ['cellular', 'Cellular Shades', 'cellular', null], ['dream-curtains', 'Dream Curtains', 'drapery', null],
  ['drapery', 'Drapery (curtains)', 'drapery', null], ['woven-wood', 'Woven Wood Shades', 'woven-wood', null]];
for (const [id, name, product_line_id, roll_rule] of PL) rows.pricing_lines.push({ id, name, product_line_id, markup: 0.5, roll_rule, notes: null });
rows.price_adders.push({ line_id: 'dream-curtains', adder_key: 'motor-cost', label: 'Motor (not in the supplier sheet)', kind: 'add', amount: 110, unit: 'flat',
  applies_when: { control: ['remote', 'matter'] }, origin: 'manual', status: 'placeholder', source: 'placeholder set by the owner',
  note: 'The Dream Curtains MOTOR sheet says: "The above quotation does not include the cost of the motor." $110 (added to cost, before markup) is a placeholder: confirm with the supplier.' });

const F = (line_id, flag_key, kind, title, detail) => rows.price_flags.push({ line_id, flag_key, kind, title, detail, resolved: false });
F('dream-curtains', 'dream-motor-placeholder', 'placeholder', 'Motor cost is a placeholder: +$110', 'The motor sheet excludes the motor. +$110 is added to cost before markup. Edit it under Adders, then confirm with the supplier.');
F('dream-curtains', 'dream-115-dip', 'anomaly', 'Price drops at 115 in', 'In both sheets every cell at 115 in is about $27.60 cheaper than at 114 in. Kept as printed. A taller curtain can price lower than a shorter one.');
F('dream-curtains', 'dream-two-tracks', 'info', '"Divided to 2 tracks for following width"', 'The note sits beside the 100-101 in rows and names no width. The grid already steps up (about +$74, then about +$40) at a width that shrinks as height grows. Shown as a note, not an extra price.');
F('cellular', 'cellular-day-night', 'confirm', 'Day & Night: which block prices the shade', 'Priced from the block (light-filtering or blackout) that matches the SECOND fabric the customer picks. The sheer layer is always white; the light-filtering block is labelled "White sheer only". The blocks are not added. Confirm with the supplier.');
F('roller', 'roller-double-stack', 'confirm', 'Double-stack price = front shade + back shade', 'Each shade is priced from its own fabric and the same size and control, and the two prices are added. Confirm with the supplier.');
F(null, 'axis-orientation', 'confirm', 'Which sheet axis is the width', 'Roller, Zebra, Roman, Shangri-La and Woven wood: the sheet\'s ROW axis is the width and its columns are the drop. Cellular and Dream Curtains: columns are the width, rows the height. Evidence: Zebra blanks cap the row axis at the fabric roll width (zebra bands cannot be rotated), Roman cordless rows end at 94 (the owner\'s "94 in wide"), Shangri-La Cronus columns end at its own "Max Length 118", woven wood rows start at the sheet\'s "Min. width 16". Check with one real quote; each grid has a one-click swap in the grid viewer.');
F('zebra', 'zebra-special-sizes', 'confirm', 'Special sizes x1.1 (Uranus and Venus only)', 'The special-size sheet is based on the motor grid and extends the drop to 154 in. It is used only when the standard grid has no price, for motorized Uranus and Venus. Costs are multiplied by 1.1 ("未x1.1").');
F('roller', 'roll-width-differences', 'info', 'Roll widths differ between the sheet and our catalog', 'Sundance screen-view (sheet 98, ours 118), Pansy (sheet 110, ours 118), Stone screen-view (sheet 118, ours 98 / 118), Nestility (98 / 118). Zebra Moon, Neptune, Mercury, Nebula, Meteor (sheet 112, ours 118). The SMALLER value is used for size limits. Both are shown on the grid.');
F('roller', 'roller-pansy-violet', 'info', 'Pansy and Violet are priced from the Taurus block', 'The sheet lists them untyped ("new") on the Taurus (solar, 110) grid. We carry them as blackout.');
F('roller', 'roller-gaea-rename', 'info', '"Gare" renamed "Gaea"', 'The blackout collection Gare was a typo of Gaea. Swatch ids are unchanged. It uses the "Gaea/sundance (BLACKOUT)" grid. Magic (screen-view) has a grid but no fabric on the site, so it is ignored.');
F('roller', 'roller-zebra-anomalies', 'anomaly', 'Cent-level decreases and 118.2 axis labels kept as printed', 'Roller and Zebra grids have a few places where a bigger size is a few cents cheaper, and some width labels read 118.2. Virgo (118) is capped at 114 in at 120 in; Stone blackout (110) at 109. Shown on each grid.');
F('shangri-la', 'shangri-remote-wand', 'confirm', 'Remote wand priced at the base grid', 'The site offers "Remote wand" and "Matter". Remote wand = base grid; Matter = base + $140. The sheet\'s "Remote control +$100" matches no control today.');
F('shangri-la', 'shangri-max-length', 'info', '"Max Length" is stricter than the grid', 'The grids list drops up to 112 in, but Hermes and Apollo stop at 98.4, Hera and Erebus 110.2, Hestia 98.4, Alastor 78.7, Aphrodite 66.9. Cronus (118) is limited by its grid (112). The lower number wins.');
F('roman', 'roman-no-grade', 'info', 'Roman has no collection or grade pricing', 'One grid per system and lining for all 12 drapery collections. The motor grid already includes the $100 motor (every cell = cord cell + $100). Grid widths stop at 94 (rows); some of our Roman fabrics are 102 in wide.');
F('woven-wood', 'woven-hidden', 'info', 'Woven wood is imported but not on the site', 'The line stays hidden. The grid is the sheet\'s final quote (shipping included). The sheet\'s columns run to 118 in although its size standards say 94.5 in maximum.');
F(null, 'markup-order', 'info', 'Price = round((grid cost x multiplier + adders - deductions) x (1 + markup))', 'Deductions come off before the markup, so a -$3 deduction lowers a 50% price by $4.50. Whole dollars.');

// size rules for lines with no grid (unverified), and the woven wood size standards
rows.size_rules.push({ line_id: 'drapery', subject: 'Curtains', when_values: {}, source: 'manual', verified: false, verified_note: 'No supplier size table for curtains yet. Price on request.' });
rows.size_rules.push({ line_id: 'woven-wood', subject: 'Woven wood (cord and cordless)', when_values: { control: ['cord', 'cordless'] }, min_width: 16, min_height: 10, max_width: 94.5, max_height: 94.5, source: 'manual', verified: false,
  verified_note: 'From the "Size Standards" in the woven wood workbook. Minimum quote $86.85. The sheet\'s grid columns run to 118 in, which disagrees with the 94.5 in maximum height.' });
rows.size_rules.push({ line_id: 'woven-wood', subject: 'Woven wood (motorized)', when_values: { control: ['remote'] }, min_width: 23.6, min_height: 10, max_width: 94.5, max_height: 94.5, source: 'manual', verified: false, verified_note: 'From the "Size Standards" in the woven wood workbook.' });

const counts = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length]));
console.log('rows to seed:', JSON.stringify(counts));

// ---- output -----------------------------------------------------------------------------------------------------
const CONFLICT = { product_lines: 'id', option_groups: 'id', option_values: 'id', pricing_lines: 'id', price_adders: 'line_id,adder_key', price_flags: 'flag_key', size_rules: null };
const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : Array.isArray(v) && v.every((x) => typeof x === 'string') ? `array[${v.map((x) => `'${x.replace(/'/g, "''")}'`).join(',')}]::text[]` : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`);
if (SQL) {
  const out = [];
  for (const [t, rs] of Object.entries(rows)) for (const r of rs) {
    const cols = Object.keys(r);
    out.push(`insert into public.${t} (${cols.join(', ')}) values (${cols.map((c) => q(r[c])).join(', ')})${CONFLICT[t] ? ` on conflict (${CONFLICT[t]}) do nothing` : ''};`);
  }
  writeFileSync(SQL, "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false);\n" + out.join('\n') + '\n'); console.log('wrote', SQL);
}
if (APPLY) {
  const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !K) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed'); process.exit(1); }
  const h = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
  // Shangri-La has no format step (horizontal shade only): make sure an earlier seed did not leave one behind
  const gone = await fetch(`${U}/rest/v1/option_groups?id=eq.shangri-la:format`, { method: 'DELETE', headers: { ...h, Prefer: 'return=representation' } });
  if (gone.ok) console.log(`removed the Shangri-La format group if it existed: ${(await gone.json()).length} row(s)`);
  for (const [t, rs] of Object.entries(rows)) {
    if (t === 'size_rules') {   // no natural key: only seed lines that have no rules yet
      const have = await (await fetch(`${U}/rest/v1/size_rules?select=line_id`, { headers: h })).json();
      const lines = new Set(have.map((x) => x.line_id)); const todo = rs.filter((r) => !lines.has(r.line_id));
      if (todo.length) { const r = await fetch(`${U}/rest/v1/size_rules`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(todo) }); if (!r.ok) throw new Error(`size_rules: HTTP ${r.status} ${await r.text()}`); }
      console.log(`size_rules: ${todo.length} inserted`); continue;
    }
    const r = await fetch(`${U}/rest/v1/${t}?on_conflict=${CONFLICT[t]}`, { method: 'POST', headers: { ...h, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rs) });
    if (!r.ok) throw new Error(`${t}: HTTP ${r.status} ${await r.text()}`);
    console.log(`${t}: ${rs.length} rows sent (existing ones kept)`);
  }
}
