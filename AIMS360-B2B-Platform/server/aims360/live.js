// Live AIMS360 data. The page (not this file) calls the viewer's AIMS360
// connector and hands the rows here; this file turns them into the same
// shapes the sample data uses, so every screen and report works unchanged.
// Nothing is invented: no hex colors, no warehouse split, no made-up pictures.
import * as data from './demoData.js';

const sample = {
  styles: [...data.styles], customers: [...data.customers], seasons: [...data.seasons],
  invoices: [...data.invoices], credits: [...data.credits], company: { ...data.company }
};
const replace = (target, items) => target.splice(0, target.length, ...items);
const pictures = new Map();
const today = () => new Date().toISOString().slice(0, 10);

export const liveState = () => ({ ...data.live, pictures: pictures.size });
export const livePicture = (style, color) => pictures.get(style + '|' + color) || null;

// rows: style-colours from get_style_details (raw_list with sizes).
function toStyles(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r?.style || !r.color) continue;
    const sizes = (r.sizes || []).filter((z) => z.sizeStatus !== 'InActive').map((z) => ({
      sizeName: z.sizeName, stock: Number(z.stockQuantity) || 0, wip: Number(z.wipQuantity) || 0,
      ots_i: Number(z.ots_i) || 0, ots: Number(z.ots) || 0, upc: z.upc || ''
    }));
    if (!sizes.length) continue;
    if (!map.has(r.style))
      map.set(r.style, {
        style: r.style, description: r.description || r.style,
        category: r.styleGroupDescription || r.styleGroupCode || 'No Style Group',
        styleGroup: r.styleGroupDescription || r.styleGroupCode || '',
        division: r.divisionCode || '', season: r.seasonCode || '', status: 'Active', gender: '', fabric: '',
        wholesale: Number(r.wholesalePrice) || 0, retail: Number(r.suggestedRetailPrice) || 0,
        available: r.available ? String(r.available).slice(0, 10) : today(), colors: []
      });
    map.get(r.style).colors.push({ color: r.color, colorDescription: r.colorDescription || r.color, hex: null, sizes });
  }
  return [...map.values()].sort((a, b) => a.style.localeCompare(b.style));
}

// rows: customers from get_customer_details; open: open-order dollars by customer from order_analysis.
function toCustomers(rows, open) {
  const openBy = new Map((open || []).map((o) => [o.customerAccount, Number(o.totalAmount) || 0]));
  return rows.filter((r) => r?.customerAccount).map((r) => ({
    customerAccount: r.customerAccount, customerName: r.customerName || r.customerAccount,
    terms: r.termDescription || '', currency: r.currencyCode || 'USD',
    creditLimit: Number(r.creditLimit) || 0, totalAR: Number(r.totalAR) || 0, priceSheet: null,
    email: r.email || null, phone: r.phone || null, buyerName: r.buyer || null, salesRep: r.salesRep1Name || '',
    address: { city: r.city || '', state: r.state || '' },
    stores: [{ code: 'MAIN', name: r.customerName || r.customerAccount, city: r.city || '', state: r.state || '' }],
    liveOpenOrders: openBy.get(r.customerAccount) || 0
  }));
}

// snapshot: { connector, connection, styles, customers, openOrders, at } — raw rows, or already converted.
export function applyLive(snapshot) {
  const styles = snapshot.converted ? snapshot.styles : toStyles(snapshot.styles || []);
  const customers = snapshot.converted ? snapshot.customers : toCustomers(snapshot.customers || [], snapshot.openOrders);
  if (!styles.length) throw Object.assign(new Error('AIMS360 returned no active styles with sizes, so there is nothing to show.'), { status: 400 });
  replace(data.styles, styles);
  replace(data.customers, customers);
  replace(data.seasons, [...new Set(styles.map((s) => s.season).filter(Boolean))].sort().map((code) => ({ code, description: code })));
  replace(data.invoices, []);
  replace(data.credits, []);
  const c = snapshot.connection || {};
  Object.assign(data.company, { account: c.account || '', companyName: c.companyName || '' });
  Object.assign(data.live, {
    on: true, account: c.account || '', companyName: c.companyName || '', database: c.databaseName || '', user: c.userName || '',
    connector: snapshot.connector || '', at: snapshot.at || new Date().toISOString(), styles: styles.length,
    styleColors: styles.reduce((t, s) => t + s.colors.length, 0), customers: customers.length
  });
  pictures.clear();
  return { converted: true, connector: data.live.connector, connection: c, at: data.live.at, styles, customers };
}

export function clearLive() {
  replace(data.styles, sample.styles);
  replace(data.customers, sample.customers);
  replace(data.seasons, sample.seasons);
  replace(data.invoices, sample.invoices);
  replace(data.credits, sample.credits);
  Object.assign(data.company, sample.company);
  Object.assign(data.live, { on: false, account: '', companyName: '', database: '', user: '', connector: '', at: '', styles: 0, styleColors: 0, customers: 0 });
  pictures.clear();
}

// images: [{ style, color, dataUrl }] from get_style_images (delivery "data_url").
export function addPictures(images) {
  for (const p of images || []) {
    if (!p?.style || !/^data:image\/(jpeg|png|webp);base64,/.test(p.dataUrl || '')) continue;
    const style = data.styles.find((s) => s.style === p.style);
    const color = style?.colors.find((c) => c.color === p.color || c.colorDescription === p.color);
    if (color) pictures.set(style.style + '|' + color.color, p.dataUrl);
  }
  return pictures.size;
}
