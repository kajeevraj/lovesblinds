// Reads a supplier cost workbook into normalized price grids and adders. Pure: it takes sheets as arrays of rows
// (what SheetJS gives with header:1), so the one-time import script (Node) and the admin re-import (browser) run the same code.
//
// Layout facts it relies on (checked against the six line workbooks, see docs/pricing-stage1-plan.md):
//  * a grid is a block: an axis row of numbers, an axis column of numbers, and the cost cells between them
//  * Roller, Zebra, Roman, Shangri-La, Woven wood: the ROW axis (first column, 23..118) is the WIDTH, the column axis is the drop
//  * Cellular, Dream Curtains: the row axis is the HEIGHT, the column axis is the width
//    (the axis choice is stored per grid in `rows_are` and can be flipped in the admin)

export const num = (x) => typeof x === 'number' && Number.isFinite(x);
const at = (rows, r, c) => (rows[r - 1] ? rows[r - 1][c - 1] ?? null : null);   // 1-based, like the sheet
const colLetter = (c) => { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
export const cellName = (r, c) => `${colLetter(c)}${r}`;
const uniq = (a) => [...new Set(a)];

// ---- block reading ---------------------------------------------------------------------------------------------
// Reads the block whose column axis sits at `axisRow` starting at column `c0` and whose row axis is column `rowAxisCol`.
function readBlock(rows, { axisRow, c0, rowAxisCol, r0, maxCols = 400 }) {
  const colAxis = [at(rows, axisRow, c0)];
  let c = c0 + 1;
  while (c <= maxCols && num(at(rows, axisRow, c)) && at(rows, axisRow, c) > colAxis[colAxis.length - 1]) { colAxis.push(at(rows, axisRow, c)); c++; }
  const rowAxis = [];
  let r = r0;
  while (num(at(rows, r, rowAxisCol)) && (rowAxis.length === 0 || at(rows, r, rowAxisCol) > rowAxis[rowAxis.length - 1])) { rowAxis.push(at(rows, r, rowAxisCol)); r++; }
  const cost = [];
  for (let i = 0; i < rowAxis.length; i++) for (let j = 0; j < colAxis.length; j++) { const v = at(rows, r0 + i, c0 + j); cost.push(num(v) ? v : null); }
  return { rowAxis, colAxis, cost, originRow: r0, originCol: c0 };
}

// Odd things worth showing in the admin: price decreases along an axis, odd axis labels, blank cells.
export function findAnomalies({ rowAxis, colAxis, cost }) {
  const out = []; let decreases = 0; const nc = colAxis.length;
  const get = (i, j) => cost[i * nc + j];
  for (let i = 0; i < rowAxis.length; i++) for (let j = 0; j < nc; j++) {
    const v = get(i, j); if (v == null) continue;
    if (j > 0 && get(i, j - 1) != null && v < get(i, j - 1) - 0.005) { decreases++; if (out.length < 12) out.push({ type: 'decrease', along: 'columns', row: rowAxis[i], col: colAxis[j], from: +get(i, j - 1).toFixed(2), to: +v.toFixed(2) }); }
    if (i > 0 && get(i - 1, j) != null && v < get(i - 1, j) - 0.005) { decreases++; if (out.length < 12) out.push({ type: 'decrease', along: 'rows', row: rowAxis[i], col: colAxis[j], from: +get(i - 1, j).toFixed(2), to: +v.toFixed(2) }); }
  }
  const blank = cost.filter((v) => v == null).length;
  const res = [];
  if (decreases) res.push({ type: 'decreases', count: decreases, examples: out });
  if (blank) res.push({ type: 'blank_cells', count: blank, of: cost.length });
  for (const [name, axis] of [['row', rowAxis], ['column', colAxis]]) {
    const odd = axis.filter((v) => !Number.isInteger(v));
    if (odd.length) res.push({ type: 'odd_axis_value', axis: name, values: odd });
  }
  return res;
}

// ---- titles with collection names and roll widths --------------------------------------------------------------
const TYPE_RE = /\((SOLAR|BLACKOUT|Screenview|Screen view|Screen View)\)/i;
const FAMILY = { solar: 'solar', blackout: 'blackout', screenview: 'screen-view', 'screen view': 'screen-view' };
// "Moon/Neptune 幅宽：112IN" / "Taurus(SOLAR)幅宽：110IN  Pansy(new)/Violet(new)" / "Nestility(Screenview)幅宽：98IN/118IN"
export function parseRollTitle(title) {
  const out = [];
  for (const raw of String(title).split('\n')) {
    const line = raw.trim(); if (!line) continue;
    const m = line.match(/幅宽[:：]?\s*(\d+(?:\.\d+)?)\s*(?:IN)?(?:\s*\/\s*(\d+(?:\.\d+)?)\s*IN)?(.*)$/i);
    if (!m) continue;
    const rolls = [Number(m[1]), ...(m[2] ? [Number(m[2])] : [])];
    let head = line.slice(0, m.index); const tail = m[3].trim();
    let family = null;
    const tm = head.match(TYPE_RE);
    if (tm) { family = FAMILY[tm[1].toLowerCase()]; head = head.replace(tm[0], ' '); }
    const clean = (s) => s.split('/').map((n) => n.replace(/\(new\)/gi, '').trim()).filter(Boolean);
    out.push({ names: clean(head), family, rolls });
    if (tail) out.push({ names: clean(tail), family: null, rolls });      // listed after the width without a type, e.g. Pansy and Violet
  }
  return out;
}

const gridKey = (parts) => parts.join('|');
const ordered = (s) => [...s].sort((a, b) => a.localeCompare(b));

// ---- per-line parsers ------------------------------------------------------------------------------------------
function titleBlocks(rows, titleRe) {
  const found = [];
  const maxCols = Math.min(400, Math.max(...rows.map((r) => (r ? r.length : 0)), 0));
  for (let r = 1; r <= rows.length; r++) for (let c = 2; c <= maxCols; c++) {
    const v = at(rows, r, c);
    if (typeof v !== 'string' || !titleRe.test(v)) continue;
    let axisRow = null;
    for (let rr = r + 1; rr <= r + 5; rr++) if (num(at(rows, rr, c)) && num(at(rows, rr, c + 1)) && at(rows, rr, c + 1) > at(rows, rr, c)) { axisRow = rr; break; }
    if (!axisRow) continue;
    let r0 = null;
    for (let rr = axisRow + 1; rr <= axisRow + 3; rr++) if (num(at(rows, rr, 1))) { r0 = rr; break; }
    if (!r0) continue;
    found.push({ title: v, titleRow: r, titleCol: c, ...readBlock(rows, { axisRow, c0: c, rowAxisCol: 1, r0 }) });
  }
  return found;
}

const SYSTEM_BY_SHEET = [[/cordless/i, 'cordless'], [/motor/i, 'motor'], [/cord/i, 'cord']];
const systemOf = (sheet) => (SYSTEM_BY_SHEET.find(([re]) => re.test(sheet)) || [null, null])[1];

function rollerOrZebra(line, sheets, file) {
  const grids = []; const adders = []; const notes = [];
  for (const [sheet, rows] of Object.entries(sheets)) {
    const special = /特殊尺寸/.test(sheet);
    const sys = special ? 'motor' : systemOf(sheet);
    if (!sys) { notes.push(`sheet "${sheet}" skipped: no known system in its name`); continue; }
    for (const b of titleBlocks(rows, /幅宽/)) {
      const entries = parseRollTitle(b.title);
      const tokens = entries.flatMap((e) => e.names.map((n) => ({ name: n, family: e.family, rolls: e.rolls })));
      grids.push({
        _sheet: sheet, systems: [sys], variant: 'all', lining: null, scope: 'fabric', special, multiplier: special ? 1.1 : 1,
        rows_are: 'width', row_axis: b.rowAxis, col_axis: b.colAxis, cost: b.cost,
        roll_widths: uniq(tokens.flatMap((t) => t.rolls)).sort((a, b) => a - b),
        collections: tokens, source_file: file, source_sheet: sheet, source_title: b.title.replace(/\s+/g, ' ').trim(),
        origin_row: b.originRow, origin_col: b.originCol, anomalies: findAnomalies(b),
        _key: gridKey([line, sys, 'all', '-', special ? 'S' : 'N', ordered(tokens.map((t) => `${t.name.toLowerCase()}:${t.family || '*'}`)).join(',')]),
        label: `${line} · ${special ? 'special sizes · ' : ''}${sys} · ${tokens.map((t) => t.name).join(', ')}`,
      });
    }
    // remarks, all as text cells
    for (let r = 1; r <= rows.length; r++) for (let c = 1; c <= Math.min(60, (rows[r - 1] || []).length); c++) {
      const v = at(rows, r, c); if (typeof v !== 'string') continue;
      let m;
      if ((m = v.match(/No fabric w[ar]+p for cassette\s*-\$\s*(\d+(?:\.\d+)?)/i)))
        adders.push({ adder_key: 'no-wrap-cassette', label: 'No fabric wrap on the cassette', kind: 'subtract', amount: Number(m[1]), applies_when: { wrap_cassette: ['none'] }, source: `${sheet}!${cellName(r, c)}: ${v}` });
      if ((m = v.match(/No fabric w[ar]+p for bottom rail\s*-\$\s*(\d+(?:\.\d+)?)/i)))
        adders.push({ adder_key: 'no-wrap-bottom-rail', label: 'No fabric wrap on the bottom rail', kind: 'subtract', amount: Number(m[1]), applies_when: { wrap_bottom_rail: ['none'] }, source: `${sheet}!${cellName(r, c)}: ${v}` });
      if ((m = v.match(/Bluetooth motor extra\s*\+\$\s*(\d+(?:\.\d+)?)/i)))
        adders.push({ adder_key: 'bluetooth-motor', label: 'Bluetooth (Matter) motor', kind: 'add', amount: Number(m[1]), applies_when: { control: ['matter'] }, source: `${sheet}!${cellName(r, c)}: ${v}` });
      if (/未\s*[×x]\s*1\.1/.test(v)) notes.push(`${sheet}!${cellName(r, c)}: "${v}" read as: special-size costs are multiplied by 1.1`);
    }
  }
  // the same remark appears on several sheets: keep one adder per key
  const byKey = new Map(); for (const a of adders) if (!byKey.has(a.adder_key)) byKey.set(a.adder_key, a);
  return { grids, adders: [...byKey.values()], notes };
}

function roman(sheets, file) {
  const grids = []; const notes = [];
  for (const [sheet, rows] of Object.entries(sheets)) {
    const sys = systemOf(sheet); if (!sys) continue;
    for (const b of titleBlocks(rows, /(Light Filtering|Blackout) Fabric/i)) {
      const lining = /blackout/i.test(b.title) ? 'blackout' : 'light-filtering';
      grids.push({
        _sheet: sheet, systems: [sys], variant: 'all', lining, scope: 'line', special: false, multiplier: 1,
        rows_are: 'width', row_axis: b.rowAxis, col_axis: b.colAxis, cost: b.cost, roll_widths: [], collections: [],
        source_file: file, source_sheet: sheet, source_title: b.title.trim(), origin_row: b.originRow, origin_col: b.originCol, anomalies: findAnomalies(b),
        _key: gridKey(['roman', sys, 'all', lining, 'N', 'all']), label: `roman · ${sys} · ${lining}`,
      });
    }
  }
  const motor = sheets[Object.keys(sheets).find((n) => /motor/i.test(n))];
  if (motor && num(at(motor, 85, 2))) notes.push(`Roman motor sheet has a stray ${at(motor, 85, 2)} in B85; every motor cell equals the cord cell + $100, so the $100 is already in the grid`);
  return { grids, adders: [], notes };
}

function shangriLa(sheets, file) {
  const grids = []; const adders = []; const notes = [];
  const [sheet, rows] = Object.entries(sheets)[0];
  const maxCols = Math.min(400, Math.max(...rows.map((r) => (r ? r.length : 0))));
  for (let c = 2; c <= maxCols; c++) {
    const v = at(rows, 2, c);
    if (typeof v !== 'string' || !/Max Length/i.test(v)) continue;
    const b = readBlock(rows, { axisRow: 4, c0: c, rowAxisCol: 1, r0: 6 });
    const tokens = [];
    for (const m of v.replace(/[）)]/g, ')').split('\n')) {
      const mm = m.match(/^\s*([A-Za-z]+)\s*\(Max Length\s*([\d.]+)\s*inch\)/i); if (mm) tokens.push({ name: mm[1], maxDrop: Number(mm[2]) });
    }
    grids.push({
      _sheet: sheet, systems: ['cord'], variant: 'all', lining: null, scope: 'fabric', special: false, multiplier: 1,
      rows_are: 'width', row_axis: b.rowAxis, col_axis: b.colAxis, cost: b.cost, roll_widths: [],
      collections: tokens.map((t) => ({ name: t.name, family: null, rolls: [], maxDrop: t.maxDrop })),
      source_file: file, source_sheet: sheet, source_title: v.replace(/\s+/g, ' ').trim(), origin_row: b.originRow, origin_col: b.originCol, anomalies: findAnomalies(b),
      _key: gridKey(['shangri-la', 'cord', 'all', '-', 'N', ordered(tokens.map((t) => t.name.toLowerCase())).join(',')]),
      label: `shangri-la · ${tokens.map((t) => t.name).join(', ')}`,
    });
  }
  for (let r = 90; r <= rows.length; r++) for (let c = 1; c <= 20; c++) {
    const v = at(rows, r, c); if (typeof v !== 'string') continue;
    const rowVals = (rows[r - 1] || []).filter((x) => typeof x === 'string' && /\+\$\s*\d+/.test(x));
    const amt = rowVals.length ? Number(rowVals[0].match(/\+\$\s*(\d+(?:\.\d+)?)/)[1]) : null;
    if (/^Remote control/i.test(v.trim()) && amt != null)
      adders.push({ adder_key: 'remote-control', label: 'Remote control', kind: 'add', amount: amt, applies_when: { control: ['remote_wand'] }, source: `${sheet}!${cellName(r, c)}`,
        note: 'Supplier confirmed the Remote wand costs the same as motorized: the sheet\'s "Remote control +$100" applies to the Remote wand control.' });
    if (/Bluetooth\/Matter/i.test(v) && amt != null)
      adders.push({ adder_key: 'matter-motor', label: 'Bluetooth / Matter (smart) motor', kind: 'add', amount: amt, applies_when: { control: ['matter'] }, source: `${sheet}!${cellName(r, c)}` });
  }
  const byKey = new Map(); for (const a of adders) if (!byKey.has(a.adder_key)) byKey.set(a.adder_key, a);
  return { grids, adders: [...byKey.values()], notes };
}

function cellular(sheets, file) {
  const grids = []; const adders = []; const notes = [];
  for (const [sheet, rows] of Object.entries(sheets)) {
    const variant = /day\s*&?\s*night/i.test(sheet) ? 'day-night' : /top\s*down/i.test(sheet) ? 'top-down-bottom-up' : 'standard';
    for (const [c0, lining] of [[2, 'light-filtering'], [16, 'blackout']]) {
      const b = readBlock(rows, { axisRow: 4, c0, rowAxisCol: c0 - 1, r0: 6 });
      grids.push({
        _sheet: sheet, systems: ['cord', 'cordless'], variant, lining, scope: 'line', special: false, multiplier: 1,
        rows_are: 'height', row_axis: b.rowAxis, col_axis: b.colAxis, cost: b.cost, roll_widths: [], collections: [],
        source_file: file, source_sheet: sheet, source_title: `${at(rows, 2, c0 === 2 ? 1 : 15)}`, origin_row: b.originRow, origin_col: b.originCol, anomalies: findAnomalies(b),
        _key: gridKey(['cellular', 'cord+cordless', variant, lining, 'N', 'all']), label: `cellular · ${variant} · ${lining}`,
      });
    }
    for (let r = 90; r <= rows.length; r++) for (let c = 1; c <= 6; c++) {
      const v = at(rows, r, c); const m = typeof v === 'string' && v.match(/^Motor\s*\+\$\s*(\d+(?:\.\d+)?)/i);
      if (m) adders.push({ adder_key: `motor-${variant}`, label: `Motor (${variant})`, kind: 'add', amount: Number(m[1]), applies_when: { control: ['remote', 'matter', 'motor'], type: [variant] }, source: `${sheet}!${cellName(r, c)}: ${v}` });
    }
    const white = at(rows, 2, 13);
    if (typeof white === 'string' && /white sheer/i.test(white)) notes.push(`${sheet}!M2: "${white}" (next to the light-filtering block)`);
  }
  return { grids, adders, notes };
}

function dream(sheets, file) {
  const grids = []; const notes = [];
  for (const [sheet, rows] of Object.entries(sheets)) {
    const sys = /MOTOR/i.test(sheet) ? 'motor' : 'manual';
    const b = readBlock(rows, { axisRow: 2, c0: 3, rowAxisCol: 2, r0: 3 });
    grids.push({
      _sheet: sheet, systems: [sys], variant: 'all', lining: null, scope: 'line', special: false, multiplier: 1,
      rows_are: 'height', row_axis: b.rowAxis, col_axis: b.colAxis, cost: b.cost, roll_widths: [], collections: [],
      source_file: file, source_sheet: sheet, source_title: sheet, origin_row: b.originRow, origin_col: b.originCol, anomalies: findAnomalies(b),
      _key: gridKey(['dream-curtains', sys, 'all', '-', 'N', 'all']), label: `dream-curtains · ${sys}`,
    });
    for (let r = 1; r <= rows.length; r++) for (let c = 1; c <= 60; c++) {
      const v = at(rows, r, c); if (typeof v !== 'string') continue;
      if (/Divided to 2 tracks/i.test(v)) notes.push(`${sheet}!${cellName(r, c)}: "${v}" with "${at(rows, r + 1, c) || ''}"`);
      if (/does not include the cost of the motor/i.test(v)) notes.push(`${sheet}!${cellName(r, c)}: "${v.trim()}"`);
    }
  }
  return { grids, adders: [], notes };
}

function woven(sheets, file) {
  const [sheet, rows] = Object.entries(sheets)[0];
  let titleRow = null;
  for (let r = 1; r <= rows.length; r++) { const v = at(rows, r, 2); if (typeof v === 'string' && /WOVEN WOOD-.*CATALOG/i.test(v)) titleRow = r; }
  if (!titleRow) throw new Error('woven wood: could not find the "WOVEN WOOD ... CATALOG" final quote block');
  const b = readBlock(rows, { axisRow: titleRow + 2, c0: 3, rowAxisCol: 2, r0: titleRow + 4 });
  const grids = [{
    _sheet: sheet, systems: ['cord', 'cordless', 'motor'], variant: 'all', lining: null, scope: 'line', special: false, multiplier: 1,
    rows_are: 'width', row_axis: b.rowAxis, col_axis: b.colAxis, cost: b.cost, roll_widths: [], collections: [],
    source_file: file, source_sheet: sheet, source_title: 'WOVEN WOOD final quote (最终报价)', origin_row: b.originRow, origin_col: b.originCol, anomalies: findAnomalies(b),
    _key: gridKey(['woven-wood', 'cord+cordless+motor', 'all', '-', 'N', 'all']), label: 'woven-wood · final quote',
  }];
  const adders = []; const notes = [];
  for (let r = titleRow + 70; r <= rows.length; r++) for (let c = 1; c <= 8; c++) {
    const v = at(rows, r, c); if (typeof v !== 'string') continue;
    let m;
    if ((m = v.match(/^Cordless\s*:\s*\+\$\s*(\d+(?:\.\d+)?)/i))) adders.push({ adder_key: 'cordless', label: 'Cordless', kind: 'add', amount: Number(m[1]), applies_when: { control: ['cordless'] }, source: `${sheet}!${cellName(r, c)}: ${v}` });
    if ((m = v.match(/^Remote\s*:\s*\+\$\s*(\d+(?:\.\d+)?)/i))) adders.push({ adder_key: 'remote', label: 'Remote (motor)', kind: 'add', amount: Number(m[1]), applies_when: { control: ['remote'] }, source: `${sheet}!${cellName(r, c)}: ${v}` });
    if ((m = v.match(/^No Coating\s*:\s*-\$\s*(\d+(?:\.\d+)?)\s*\/\s*sq\s*ft/i))) adders.push({ adder_key: 'no-coating', label: 'No coating', kind: 'subtract', amount: Number(m[1]), unit: 'per_sqft', applies_when: { coating: ['none'] }, source: `${sheet}!${cellName(r, c)}: ${v}`, note: 'Counted per square foot of the priced size.' });
    if (/Minim quotes is/i.test(v)) notes.push(`${sheet}!${cellName(r, c)}: ${v.replace(/\s+/g, ' ').trim()}`);
    if (/Size Standards|Min\.Width|Min\.Height|Max\.Width|Max\.Height/i.test(v)) notes.push(`${sheet}!${cellName(r, c)}: ${v.replace(/\s+/g, ' ').trim()} ${String(at(rows, r, 3) ?? '').trim()}`);
  }
  return { grids, adders, notes };
}

// ---- entry point ------------------------------------------------------------------------------------------------
export const LINE_SHEETS = {
  roller: { file: 'roller', rx: /roller shades/i }, zebra: { file: 'zebra', rx: /zebra|特殊尺寸/i }, roman: { file: 'roman', rx: /roman shades/i },
  'shangri-la': { file: 'shangri-la', rx: /SHRL/i }, cellular: { file: 'cellular', rx: /cellular|top down|day&night/i },
  'dream-curtains': { file: 'dream-curtains', rx: /DREAM CURTAIN/i }, 'woven-wood': { file: 'woven-wood', rx: /.*/ },
};

// Which line a workbook is for, from its sheet names
export function detectLine(sheetNames) {
  const names = sheetNames.filter((n) => n.trim() !== '--');
  for (const [line, { rx }] of Object.entries(LINE_SHEETS)) if (line !== 'woven-wood' && names.length && names.every((n) => rx.test(n))) return line;
  return names.length === 1 && /sheet1/i.test(names[0]) ? 'woven-wood' : null;
}

export function parseSupplierWorkbook(line, sheets, fileName) {
  const usable = Object.fromEntries(Object.entries(sheets).filter(([n]) => n.trim() !== '--'));   // never read the customer-data tab
  let res;
  if (line === 'roller' || line === 'zebra') res = rollerOrZebra(line, usable, fileName);
  else if (line === 'roman') res = roman(usable, fileName);
  else if (line === 'shangri-la') res = shangriLa(usable, fileName);
  else if (line === 'cellular') res = cellular(usable, fileName);
  else if (line === 'dream-curtains') res = dream(usable, fileName);
  else if (line === 'woven-wood') res = woven(usable, fileName);
  else throw new Error(`no parser for line "${line}"`);
  for (const g of res.grids) {
    if (g.row_axis.length * g.col_axis.length !== g.cost.length) throw new Error(`${g.label}: cost cells do not match the axes`);
    if (!g.row_axis.length || !g.col_axis.length) throw new Error(`${g.label}: empty axis`);
  }
  const keys = res.grids.map((g) => g._key);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) throw new Error(`two grids share the identity ${dup}`);
  return { line, ...res };
}
