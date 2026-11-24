// File exports for linesheets and OTS reports: CSV, Excel, PDF with images,
// and an Excel order form buyers can fill in offline.
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { styleShape } from './images.js';

const PINK = 'FFD43695';
const INK = 'FF1B212B';
const money = (n) => `$${Number(n).toFixed(2)}`;
const qtyOf = (z, basis) => Math.max(0, basis === 'future' ? z.ots : z.ots_i);

// rows: [{ s: catalogStyle, c: colour }]; opts: { title, subtitle, kind: 'ots' | 'linesheet', basis, detail }
export function toCsv(rows, opts) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const ots = opts.kind === 'ots';
  const head = ['Style', 'Description', 'Collection', 'Season', 'Color', 'Size'];
  if (ots) head.push(opts.basis === 'future' ? 'OTS With WIP' : 'OTS Now');
  head.push('Price', 'MSRP');
  const out = [head];
  for (const { s, c } of rows) {
    const base = [s.style, s.description, s.category, s.season, c.colorDescription];
    const tail = [s.price.toFixed(2), s.retail.toFixed(2)];
    if (ots && opts.detail === 'total') out.push([...base, 'All', c.sizes.reduce((t, z) => t + qtyOf(z, opts.basis), 0), ...tail]);
    else for (const z of c.sizes) out.push([...base, z.sizeName, ...(ots ? [qtyOf(z, opts.basis)] : []), ...tail]);
  }
  return out.map((r) => r.map(esc).join(',')).join('\r\n');
}

function sheetHeader(ws, opts, width) {
  ws.mergeCells(1, 1, 1, width);
  ws.getCell(1, 1).value = 'A I M S 3 6 0';
  ws.getCell(1, 1).font = { size: 16, color: { argb: INK } };
  ws.mergeCells(2, 1, 2, width);
  ws.getCell(2, 1).value = opts.title;
  ws.getCell(2, 1).font = { size: 13, bold: true, color: { argb: PINK } };
  ws.mergeCells(3, 1, 3, width);
  ws.getCell(3, 1).value = opts.subtitle;
  ws.getCell(3, 1).font = { size: 10, color: { argb: 'FF727B89' } };
}

// A divider from the linesheet: a full-width heading row.
function sectionRow(ws, n, title, note, width) {
  ws.mergeCells(n, 1, n, width);
  const cell = ws.getCell(n, 1);
  cell.value = note ? `${title}  ·  ${note}` : title;
  cell.font = { bold: true, size: 12, color: { argb: INK } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBE9F4' } };
  ws.getRow(n).height = 22;
  return n + 1;
}

function headRow(ws, rowNumber, labels) {
  const row = ws.getRow(rowNumber);
  labels.forEach((l, i) => {
    const cell = row.getCell(i + 1);
    cell.value = l;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PINK } };
    cell.alignment = { vertical: 'middle', horizontal: i > 3 ? 'center' : 'left' };
  });
  row.height = 20;
}

export async function toXlsx(rows, opts) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AIMS360 B2B Portal';
  const ots = opts.kind === 'ots';
  const ws = wb.addWorksheet(ots ? 'OTS Report' : 'Linesheet', { views: [{ state: 'frozen', ySplit: 5 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const maxSizes = Math.max(1, ...rows.map((r) => r.c.sizes.length));
  const perSize = !(ots && opts.detail === 'total');
  const sizeCols = perSize ? maxSizes : 0;
  const labels = ['Style', 'Description', 'Collection', 'Color', ...Array.from({ length: sizeCols }, (_, i) => `Size ${i + 1}`)];
  if (ots) labels.push('Total OTS');
  labels.push('Price', 'MSRP');
  sheetHeader(ws, opts, labels.length);
  headRow(ws, 5, labels);
  let n = 6;
  for (const { s, c, section, sectionNote } of rows) {
    if (section) n = sectionRow(ws, n, section, sectionNote, labels.length);
    const row = ws.getRow(n++);
    [s.style, s.description, s.category, c.colorDescription].forEach((v, i) => (row.getCell(i + 1).value = v));
    row.getCell(1).font = { bold: true };
    if (perSize)
      c.sizes.forEach((z, i) => {
        const cell = row.getCell(5 + i);
        cell.value = ots ? `${z.sizeName}: ${qtyOf(z, opts.basis)}` : z.sizeName;
        cell.alignment = { horizontal: 'center' };
      });
    let col = 5 + sizeCols;
    if (ots) row.getCell(col++).value = c.sizes.reduce((t, z) => t + qtyOf(z, opts.basis), 0);
    row.getCell(col).value = s.price;
    row.getCell(col).numFmt = '$#,##0.00';
    row.getCell(col + 1).value = s.retail;
    row.getCell(col + 1).numFmt = '$#,##0.00';
  }
  ws.columns.forEach((col, i) => (col.width = [12, 34, 16, 18][i] || 12));
  return wb.xlsx.writeBuffer();
}

// Order form: a size-label row and a blank quantity row per style-colour,
// with unit and amount formulas so the buyer sees totals as they type.
export async function toOrderForm(rows, opts) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AIMS360 B2B Portal';
  const ws = wb.addWorksheet('Order Form', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const maxSizes = Math.max(1, ...rows.map((r) => r.c.sizes.length));
  const first = 5; // first size column
  const unitsCol = first + maxSizes;
  const width = unitsCol + 1;
  sheetHeader(ws, { ...opts, title: `${opts.title} · Order Form` }, width);
  const info = [['Customer', ''], ['Buyer Name', ''], ['Email', ''], ['PO Number', ''], ['Order Type (Immediate / Prebook / Bulk)', ''], ['Ship Start', '']];
  info.forEach(([k], i) => {
    const r = 5 + i;
    ws.mergeCells(r, 1, r, 2);
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { bold: true };
    ws.mergeCells(r, 3, r, 6);
    ws.getCell(r, 3).border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
  });
  let n = 5 + info.length + 1;
  headRow(ws, n, ['Style', 'Description', 'Color', 'Price', ...Array.from({ length: maxSizes }, () => ''), 'Units', 'Amount']);
  ws.mergeCells(n, first, n, first + maxSizes - 1);
  ws.getCell(n, first).value = 'Quantity by Size';
  n++;
  const unitCells = [];
  const amountCells = [];
  const L = (c) => ws.getColumn(c).letter;
  for (const { s, c, section, sectionNote } of rows) {
    if (section) n = sectionRow(ws, n, section, sectionNote, width) + 1;
    const sizeRow = ws.getRow(n);
    const qtyRow = ws.getRow(n + 1);
    sizeRow.getCell(1).value = s.style;
    sizeRow.getCell(1).font = { bold: true };
    sizeRow.getCell(2).value = s.description;
    sizeRow.getCell(3).value = c.colorDescription;
    sizeRow.getCell(4).value = s.price;
    sizeRow.getCell(4).numFmt = '$#,##0.00';
    c.sizes.forEach((z, i) => {
      const label = sizeRow.getCell(first + i);
      label.value = z.sizeName;
      label.alignment = { horizontal: 'center' };
      label.font = { bold: true, size: 9, color: { argb: 'FF727B89' } };
      label.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1EFF5' } };
      const q = qtyRow.getCell(first + i);
      q.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      q.alignment = { horizontal: 'center' };
      q.dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, error: 'Enter a whole number.' };
    });
    const u = qtyRow.getCell(unitsCol);
    u.value = { formula: `SUM(${L(first)}${n + 1}:${L(first + c.sizes.length - 1)}${n + 1})` };
    u.font = { bold: true };
    const a = qtyRow.getCell(unitsCol + 1);
    a.value = { formula: `${L(unitsCol)}${n + 1}*${L(4)}${n}` };
    a.numFmt = '$#,##0.00';
    unitCells.push(`${L(unitsCol)}${n + 1}`);
    amountCells.push(`${L(unitsCol + 1)}${n + 1}`);
    n += 3;
  }
  ws.getCell(n, unitsCol - 1).value = 'Total';
  ws.getCell(n, unitsCol - 1).font = { bold: true };
  ws.getCell(n, unitsCol).value = { formula: unitCells.join('+') || '0' };
  ws.getCell(n, unitsCol).font = { bold: true };
  ws.getCell(n, unitsCol + 1).value = { formula: amountCells.join('+') || '0' };
  ws.getCell(n, unitsCol + 1).numFmt = '$#,##0.00';
  ws.getCell(n, unitsCol + 1).font = { bold: true };
  ws.columns.forEach((col, i) => (col.width = [12, 32, 16, 10][i] || (i + 1 >= unitsCol ? 12 : 8)));
  return wb.xlsx.writeBuffer();
}

export function toPdf(rows, opts) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40, info: { Title: opts.title, Author: 'AIMS360 B2B Portal' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const W = doc.page.width - 80;
    const ots = opts.kind === 'ots';
    const img = opts.images !== false;
    const rowH = img ? 58 : 36;

    let logoOk = !!opts.logo;
    const header = () => {
      // The brand's uploaded logo replaces the wordmark when there is one.
      if (logoOk) {
        try { doc.image(opts.logo, 40, 28, { fit: [150, 28] }); } catch { logoOk = false; }
      }
      if (!logoOk) doc.font('Helvetica').fontSize(18).fillColor('#1b212b').text('A I M S 3 6 0', 40, 36, { characterSpacing: 1 });
      doc.fontSize(7).fillColor('#b41f7a').text((ots ? 'OTS REPORT' : 'LINESHEET'), 40, 58, { characterSpacing: 2 });
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#1b212b').text(opts.title, 40, 78);
      doc.font('Helvetica').fontSize(9).fillColor('#727b89').text(opts.subtitle, 40, 98);
      doc.moveTo(40, 116).lineTo(40 + W, 116).lineWidth(0.5).strokeColor('#d9d6e0').stroke();
      return 126;
    };
    let y = header();
    const x0 = 40 + (img ? 56 : 0);
    if (opts.hero && img) {
      try {
        doc.save().roundedRect(40, y, W, 150, 8).clip().image(opts.hero, 40, y, { cover: [W, 150], align: 'center', valign: 'center' }).restore();
        y += 164;
      } catch { /* skip a picture the PDF writer cannot read */ }
    }

    for (const { s, c, section, sectionNote } of rows) {
      if (y + rowH + (section ? 34 : 0) > doc.page.height - 50) {
        doc.addPage();
        y = header();
      }
      if (section) {
        doc.save().roundedRect(40, y, W, 24, 5).fill('#fbe9f4').restore();
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1b212b').text(section, 50, y + 7, { width: W / 2, lineBreak: false });
        if (sectionNote) doc.font('Helvetica').fontSize(9).fillColor('#8c226a').text(sectionNote, 40 + W / 2, y + 8, { width: W / 2 - 10, align: 'right', lineBreak: false });
        y += 34;
      }
      if (img) {
        const shape = styleShape(s.style, c.color);
        doc.save().roundedRect(40, y, 46, 48, 6).fill('#f1eff5').restore();
        if (shape) doc.save().translate(40, y).scale(0.115).path(shape.d).lineWidth(4).fillAndStroke(shape.hex, shape.light ? '#b9b3c4' : shape.hex, 'even-odd').restore();
      }
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1b212b').text(`${s.style}  ·  ${c.colorDescription}`, x0, y + 2, { width: 260 });
      doc.font('Helvetica').fontSize(9).fillColor('#727b89').text(`${s.description}  ·  ${s.category}  ·  ${s.season}`, x0, y + 15, { width: 300 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1b212b').text(money(s.price), 40 + W - 130, y + 2, { width: 60, align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#727b89').text(`MSRP ${money(s.retail)}`, 40 + W - 70, y + 3, { width: 70, align: 'right' });
      const total = c.sizes.reduce((t, z) => t + qtyOf(z, opts.basis), 0);
      if (ots) doc.font('Helvetica-Bold').fontSize(9).fillColor('#1b212b').text(`Total OTS ${total}`, 40 + W - 130, y + 16, { width: 130, align: 'right' });
      if (!(ots && opts.detail === 'total')) {
        let x = x0;
        for (const z of c.sizes) {
          doc.roundedRect(x, y + 29, 30, ots ? 20 : 13, 3).lineWidth(0.5).strokeColor('#d9d6e0').stroke();
          doc.font('Helvetica').fontSize(6.5).fillColor('#727b89').text(z.sizeName, x, y + 32, { width: 30, align: 'center' });
          if (ots) doc.font('Helvetica-Bold').fontSize(8).fillColor('#1b212b').text(String(qtyOf(z, opts.basis)), x, y + 40, { width: 30, align: 'center' });
          x += 33;
        }
      }
      y += rowH;
      doc.moveTo(40, y - 4).lineTo(40 + W, y - 4).lineWidth(0.3).strokeColor('#e7e4ee').stroke();
    }
    if (ots) doc.font('Helvetica').fontSize(8).fillColor('#727b89').text('Availability can change; quantities are not reserved.', 40, Math.min(y + 6, doc.page.height - 60));
    doc.end();
  });
}

// A plain table (customer, product and inventory reports) as CSV or Excel.
export function tableCsv(report) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = report.rows.map((r) => report.columns.map((c) => (c.type === 'money' && r[c.key] != null ? Number(r[c.key]).toFixed(2) : r[c.key])));
  return [report.columns.map((c) => c.label), ...body].map((r) => r.map(esc).join(',')).join('\r\n');
}

export async function tableXlsx(report, subtitle) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AIMS360 B2B Portal';
  const ws = wb.addWorksheet(report.title.replace(' Report', ''), { views: [{ state: 'frozen', ySplit: 5 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const cols = report.columns;
  sheetHeader(ws, { title: report.title, subtitle }, cols.length);
  headRow(ws, 5, cols.map((c) => c.label));
  const numeric = (c) => ['number', 'money'].includes(c.type);
  cols.forEach((c, i) => { if (numeric(c)) ws.getRow(5).getCell(i + 1).alignment = { vertical: 'middle', horizontal: 'right' }; else ws.getRow(5).getCell(i + 1).alignment = { vertical: 'middle', horizontal: 'left' }; });
  let n = 6;
  for (const r of report.rows) {
    const row = ws.getRow(n++);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = r[c.key] ?? (numeric(c) ? null : '');
      if (c.type === 'money') cell.numFmt = '$#,##0.00';
      if (c.type === 'number') cell.numFmt = '#,##0.##';
    });
    row.getCell(1).font = { bold: true };
  }
  const total = ws.getRow(n);
  total.getCell(1).value = `Total (${report.rows.length})`;
  cols.forEach((c, i) => {
    if (report.totals[c.key] == null) return;
    total.getCell(i + 1).value = report.totals[c.key];
    total.getCell(i + 1).numFmt = c.type === 'money' ? '$#,##0.00' : '#,##0.##';
  });
  total.font = { bold: true };
  total.eachCell((cell) => (cell.border = { top: { style: 'thin', color: { argb: 'FF999999' } } }));
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, n - 1), column: cols.length } };
  ws.columns.forEach((column, i) => {
    const c = cols[i];
    const longest = Math.max(c.label.length, ...report.rows.slice(0, 200).map((r) => String(r[c.key] ?? '').length));
    column.width = Math.min(38, Math.max(10, longest + 3));
  });
  return wb.xlsx.writeBuffer();
}

const TYPES = {
  csv: ['text/csv; charset=utf-8', 'csv'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  orderform: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  pdf: ['application/pdf', 'pdf']
};

export async function sendExport(res, format, rows, opts, filename) {
  const type = TYPES[format];
  if (!type) return res.status(400).json({ error: 'Choose csv, xlsx, orderform or pdf.' });
  if (!rows.length) return res.status(400).json({ error: 'Nothing to export.' });
  const body =
    format === 'csv' ? toCsv(rows, opts) : format === 'xlsx' ? await toXlsx(rows, opts) : format === 'orderform' ? await toOrderForm(rows, opts) : await toPdf(rows, opts);
  const name = `${filename}${format === 'orderform' ? '-order-form' : ''}.${type[1]}`.replace(/[^\w.\-]+/g, '-');
  res.set({ 'Content-Type': type[0], 'Content-Disposition': `attachment; filename="${name}"` }).send(Buffer.isBuffer(body) ? body : Buffer.from(body));
}
