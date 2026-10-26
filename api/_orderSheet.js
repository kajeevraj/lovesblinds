// The internal order spreadsheet, laid out like our IABAT order template: a blue title band, our address, "Customer" and
// "Ship to Address", then Description / Color / Quantity / Width / Length / Drive System / Location / Price per unit / Total
// (15 rows or more), the Subtotal, Shipping, Total before Tax, Tax and Total block, and a Notes box. Sizes are fractions
// ("43 1/2"), never decimals. (Files starting with an underscore are not served as endpoints.)
import ExcelJS from 'exceljs';
import { summarize, DREAM_STYLE_NAMES } from '../src/lib/selectionText.js';
import { formatInches } from '../src/lib/inches.js';
import { addressLine } from '../src/data/countries.js';

export const SHEET_NAME = 'Order';
const BUSINESS_NAME = 'Loves Blinds and Window Treatments';
const BUSINESS_ADDRESS = '512 Glenwyck Court Fuquay Varina, NC 27526';
const BUSINESS_EMAIL = 'loveblindswindows@gmail.com';
const BUSINESS_PHONE = 'Phone number: 262-434-0949';
const MIN_ROWS = 15;
const EMAIL_PRICE = 'Price by email';
const ACCOUNTING = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
const BLUE = 'FF4F95DC', GREEN = 'FFB6D7A8', PEACH = 'FCE5CD'.replace(/^/, 'FF');
const MOUNT = { inside: 'Inside mount', outside: 'Outside mount' };

const rolePrefix = (p, multi) => (multi && p.role ? `${p.role}: ` : '');

// "Zebra Shades - Venus (Inside mount, Fabric-wrapped cassette)": the line and its price group, then the options that have no column of their own.
export function descriptionCell(line) {
  const picks = line.internalPicks || [];
  const sum = line.selection ? summarize({ product: { name: line.productName || 'Item' }, selection: line.selection }) : null;
  const groups = [...new Set(picks.map((p) => p.collection).filter(Boolean))];
  const opts = sum ? sum.parts.slice(line.selection.picks.length) : [];
  const styles = picks.filter((p) => p.style).map((p) => `${DREAM_STYLE_NAMES[p.style] || 'Style'} (Style ${p.style})`);
  const mount = line.mountId && line.category !== 'drapery' ? MOUNT[line.mountId] : null;
  const extra = [mount, ...styles, ...opts].filter(Boolean);
  const head = sum ? sum.title : (line.productName || line.description || '');
  return `${head}${groups.length ? ` - ${groups.join(' + ')}` : ''}${extra.length ? ` (${extra.join(', ')})` : ''}`;
}

// "YZB3304 Gray": the supplier code and the supplier's color name
export function colorCell(line) {
  const picks = line.internalPicks || [];
  if (!picks.length) return line.colorName || line.code || '';
  return picks.map((p) => `${rolePrefix(p, picks.length > 1)}${[p.code, p.supplierColor].filter(Boolean).join(' ')}`).join(' / ');
}

// A whole number of inches stays a number; anything else is the fraction as text ("43 1/2").
const sizeCell = (v) => {
  const t = formatInches(v);
  return t === '' ? '' : /^\d+$/.test(t) ? Number(t) : t;
};
export const locationCell = (line) => [line.roomLabel, line.windowLabel].filter(Boolean).join(' - ');

export async function buildOrderWorkbook(customer, lines, notes, totals = null) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME, { views: [{ showGridLines: false }] });
  ws.columns = [5, 36, 20, 9, 9, 9, 19, 24, 14, 14].map((width) => ({ width }));     // A is a narrow margin column, B..J hold the table
  const font = (o = {}) => ({ name: 'Arial', size: 10, ...o });
  const black = { style: 'thin', color: { argb: 'FF000000' } };
  const dotted = { style: 'dotted', color: { argb: 'FF000000' } };

  // title band and our details
  ws.mergeCells('A1:J1');
  Object.assign(ws.getCell('A1'), { value: BUSINESS_NAME });
  ws.getCell('A1').font = font({ size: 20, bold: true, color: { argb: 'FFFFFFFF' } });
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 34;
  [[2, BUSINESS_ADDRESS], [3, { text: BUSINESS_EMAIL, hyperlink: `mailto:${BUSINESS_EMAIL}` }], [4, BUSINESS_PHONE]].forEach(([r, v]) => {
    ws.mergeCells(`D${r}:H${r}`);
    const c = ws.getCell(`D${r}`);
    c.value = v;
    c.font = font(r === 3 ? { color: { argb: 'FF1155CC' }, underline: true } : {});
    c.alignment = { horizontal: 'center' };
  });

  const ship = addressLine(customer.address) || customer.shipTo || '';
  ws.getCell('B6').value = `Customer: ${customer.name}`;
  ws.getCell('B6').font = font({ bold: true });
  ws.getCell('G6').value = `Ship to Address : ${ship}`;
  ws.getCell('G6').font = font({ bold: true });

  // column headings
  const HEAD = 8;
  ['Description', 'Color', 'Quantity', 'Width', 'Length', 'Drive System', 'Location', 'Price per unit', 'Total'].forEach((t, i) => {
    const c = ws.getCell(HEAD, i + 2);
    c.value = t;
    c.font = font({ bold: true });
    c.alignment = { horizontal: i < 2 || i === 6 ? 'left' : 'center' };
  });

  // item rows: at least 15, as in the template
  const n = Math.max(MIN_ROWS, lines.length);
  const first = HEAD + 1, last = HEAD + n;
  let subtotal = 0;
  for (let i = 0; i < n; i++) {
    const r = first + i;
    const l = lines[i];
    const unit = l && l.price?.kind === 'price' ? l.price.unit : null;
    const qty = l ? Math.max(1, Number(l.qty) || 1) : null;
    const total = unit != null ? unit * qty : 0;
    subtotal += total;
    const cells = l
      ? [descriptionCell(l), colorCell(l), qty, sizeCell(l.width), sizeCell(l.length), [l.mechName, l.remote ? `remote: ${l.remote.name}` : ''].filter(Boolean).join(', '), locationCell(l), unit != null ? unit : (l.price ? EMAIL_PRICE : 0)]
      : ['', '', null, '', '', '', '', 0];
    cells.forEach((v, k) => { ws.getCell(r, k + 2).value = v === '' || v === null ? null : v; });
    ws.getCell(r, 10).value = { formula: `D${r}*I${r}`, result: total };
    for (let col = 2; col <= 10; col++) {
      const c = ws.getCell(r, col);
      c.font = font();
      c.alignment = { vertical: 'middle', horizontal: col <= 3 || col === 8 ? 'left' : 'center', wrapText: col <= 3 };
      c.border = { top: i === 0 ? black : undefined, bottom: i === n - 1 ? black : dotted, left: col === 2 ? black : dotted, right: col === 10 ? black : dotted };
      if (col === 4) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      if (col >= 9) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PEACH } }; c.numFmt = ACCOUNTING; c.alignment = { vertical: 'middle', horizontal: typeof c.value === 'string' ? 'left' : 'right' }; }
    }
  }

  // totals block (labels under "Price per unit", amounts under "Total") and the Notes box
  const sub = last + 1, shipRow = sub + 1, before = sub + 2, tax = sub + 3, grand = sub + 4;
  const block = [
    [sub, 'Subtotal', { formula: `SUM(J${first}:J${last})`, result: subtotal }],
    [shipRow, 'Shipping', null],
    [before, 'Total before Tax', { formula: `J${sub}+J${shipRow}`, result: subtotal }],
    [tax, 'Tax', 0],
    [grand, 'Total', { formula: `J${before}+J${tax}`, result: subtotal }],
  ];
  for (const [r, label, value] of block) {
    const a = ws.getCell(r, 9), b = ws.getCell(r, 10);
    a.value = label; b.value = value;
    for (const c of [a, b]) {
      c.font = font();
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PEACH } };
      c.border = { top: r === sub ? black : dotted, bottom: r === grand ? black : dotted, left: c === a ? black : dotted, right: c === b ? black : undefined };
    }
    b.numFmt = ACCOUNTING;
  }
  const byEmail = totals && totals.byEmail > 0 ? `Plus ${totals.byEmail} item${totals.byEmail === 1 ? '' : 's'} priced by email` : '';
  ws.mergeCells(`B${shipRow}:H${grand}`);
  const nc = ws.getCell(`B${shipRow}`);
  nc.value = `Notes: ${[byEmail, notes].filter(Boolean).join('\n')}`;
  nc.font = font();
  nc.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  nc.border = { top: black, bottom: black, left: black, right: black };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return wb;
}

export async function orderWorkbookBuffer(customer, lines, notes, totals) {
  const wb = await buildOrderWorkbook(customer, lines, notes, totals);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
