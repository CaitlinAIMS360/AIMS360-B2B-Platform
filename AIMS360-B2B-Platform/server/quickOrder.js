// Fast ways to fill a cart: typed or pasted lines, a past order, or a
// filled-in Excel order form. Each returns cart-ready lines plus a plain
// list of anything that could not be matched.
import ExcelJS from 'exceljs';
import { getProvider } from './aims360/index.js';
import { load } from './store.js';
import { catalogStyle } from './ordering.js';

const norm = (v) => String(v ?? '').trim().toLowerCase();

// raw: [{ style, color, size, qty, where }]
export function matchLines(account, raw) {
  const p = getProvider();
  const { settings } = load();
  const problems = [];
  const map = new Map();
  for (const r of raw) {
    const at = r.where ? `${r.where}: ` : '';
    const qty = Math.floor(Number(r.qty));
    if (!(qty > 0)) { problems.push(`${at}"${r.qty}" is not a quantity.`); continue; }
    const style = p.listStyles().find((s) => norm(s.style) === norm(r.style));
    if (!style) { problems.push(`${at}style ${r.style} was not found.`); continue; }
    const color = style.colors.find((c) => norm(c.color) === norm(r.color) || norm(c.colorDescription) === norm(r.color));
    if (!color) { problems.push(`${at}${style.style} has no color "${r.color}". It comes in ${style.colors.map((c) => c.colorDescription).join(', ')}.`); continue; }
    const size = color.sizes.find((z) => norm(z.sizeName) === norm(r.size));
    if (!size) { problems.push(`${at}${style.style} has no size "${r.size}". Sizes are ${color.sizes.map((z) => z.sizeName).join(', ')}.`); continue; }
    const key = style.style + '|' + color.color;
    if (!map.has(key)) {
      const view = catalogStyle(style, account, settings);
      const c = view.colors.find((x) => x.color === color.color);
      map.set(key, { style: style.style, color: color.color, sizes: {}, description: view.description, colorDescription: c.colorDescription, image: c.image, price: view.price, season: view.season });
    }
    const line = map.get(key);
    line.sizes[size.sizeName] = (line.sizes[size.sizeName] || 0) + qty;
  }
  const lines = [...map.values()];
  return { lines, units: lines.reduce((t, l) => t + Object.values(l.sizes).reduce((a, b) => a + b, 0), 0), problems };
}

// One item per line: style, color, size, quantity. Commas, tabs or spaces between them.
export function parseText(text) {
  const raw = [];
  const problems = [];
  String(text || '').split(/\r?\n/).forEach((row, i) => {
    if (!row.trim()) return;
    let parts = row.split(/[\t,;]+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 4) parts = row.trim().split(/\s+/);
    if (parts.length < 4) { problems.push(`Line ${i + 1}: needs style, color, size and quantity.`); return; }
    // A color name can be more than one word ("Heather Grey"), so the middle is the color.
    const [style, size, qty] = [parts[0], parts[parts.length - 2], parts[parts.length - 1]];
    raw.push({ style, color: parts.slice(1, -2).join(' '), size, qty, where: `Line ${i + 1}` });
  });
  return { raw, problems };
}

export function linesFromOrder(order) {
  return order.lineItems.flatMap((l) => l.sizes.map((z) => ({ style: l.style, color: l.color, size: z.sizeName, qty: z.orderQuantity, where: `${l.style} ${l.colorDescription}` })));
}

const cellText = (cell) => {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object') return String(v.result ?? v.text ?? (v.richText ? v.richText.map((t) => t.text).join('') : ''));
  return String(v);
};

// Reads the Excel order form this portal exports: a row of size names for each
// style and color, with the quantities typed in the row underneath.
export async function parseOrderForm(base64) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(String(base64 || '').replace(/^data:[^,]*,/, ''), 'base64'));
  } catch {
    throw Object.assign(new Error('That file could not be read. Import the Excel order form exported from a linesheet.'), { status: 400 });
  }
  const ws = wb.worksheets[0];
  if (!ws) throw Object.assign(new Error('That workbook has no sheets.'), { status: 400 });
  const p = getProvider();
  const raw = [];
  const info = {};
  let found = 0;
  ws.eachRow((row, n) => {
    const first = cellText(row.getCell(1)).trim();
    if (/^po number/i.test(first)) info.customerPurchaseOrder = cellText(row.getCell(3)).trim();
    if (/^order type/i.test(first)) {
      const t = norm(cellText(row.getCell(3)));
      info.orderType = t.startsWith('imm') ? 'I' : t.startsWith('pre') ? 'PB' : t.startsWith('bulk') ? 'B' : '';
    }
    if (!p.getStyle(first)) return;
    found++;
    const qtyRow = ws.getRow(n + 1);
    for (let col = 5; col < 40; col++) {
      const size = cellText(row.getCell(col)).trim();
      if (!size) break;
      const q = cellText(qtyRow.getCell(col)).trim();
      if (q && q !== '0') raw.push({ style: first, color: cellText(row.getCell(3)).trim(), size, qty: q, where: `Row ${n + 1}` });
    }
  });
  if (!found) throw Object.assign(new Error('No styles were found in that file. Import the Excel order form exported from a linesheet.'), { status: 400 });
  return { raw, info };
}
