// Data reports a brand admin can pull and export: customers, products and
// inventory. Each returns { title, note, columns, rows } so the screen and
// the CSV/Excel exports all read from the same place.
import { getProvider } from './aims360/index.js';
import { load } from './store.js';
import { creditCheck } from './ordering.js';

const round2 = (n) => Math.round(n * 100) / 100;
const has = (text, q) => !q || String(text).toLowerCase().includes(q);
// type: text | number | money | percent | date. Used for alignment and Excel formats.
const col = (key, label, type = 'text') => ({ key, label, type });

function bookings() {
  const orders = getProvider().listOrders().filter((o) => o.status !== 'Cancelled' && !o.distributionOrder);
  const byCustomer = new Map();
  const byStyle = new Map();
  for (const o of orders) {
    const c = byCustomer.get(o.customerAccount) || { orders: 0, units: 0, amount: 0, last: '' };
    c.orders++; c.units += o.bookedTotal; c.amount += o.bookedAmount;
    if (o.createdOn > c.last) c.last = o.createdOn;
    byCustomer.set(o.customerAccount, c);
    const net = 1 - (o.netDiscountPercentage || 0) / 100;
    for (const l of o.lineItems) {
      const u = l.sizes.reduce((t, z) => t + z.orderQuantity, 0);
      const s = byStyle.get(l.style) || { units: 0, amount: 0 };
      s.units += u; s.amount += u * l.price * net;
      byStyle.set(l.style, s);
    }
  }
  return { byCustomer, byStyle };
}

function customers(query) {
  const p = getProvider();
  const st = load();
  const q = String(query.q || '').toLowerCase().trim();
  const { byCustomer } = bookings();
  const rows = p.listCustomers()
    .map((c) => {
      const credit = creditCheck(c, 0);
      const b = byCustomer.get(c.customerAccount) || { orders: 0, units: 0, amount: 0, last: '' };
      return {
        account: c.customerAccount,
        name: c.customerName,
        city: c.address?.city || c.stores[0]?.city || '',
        state: c.address?.state || c.stores[0]?.state || '',
        terms: c.terms,
        priceSheet: c.priceSheet?.name || 'Wholesale',
        stores: c.stores.length,
        logins: st.users.filter((u) => u.role === 'buyer' && u.active && u.customerAccount === c.customerAccount).length,
        creditLimit: credit.limit || null,
        ar: credit.ar,
        openOrders: credit.openOrders,
        available: credit.available,
        orders: b.orders,
        units: b.units,
        booked: round2(b.amount),
        lastOrder: b.last ? b.last.slice(0, 10) : ''
      };
    })
    .filter((r) => has(r.account, q) || has(r.name, q) || has(r.city, q) || has(r.state, q))
    .filter((r) => query.only !== 'credit' || (r.creditLimit && r.available / r.creditLimit < 0.25))
    .filter((r) => query.only !== 'nologin' || r.logins === 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    title: 'Customer Report',
    note: 'Credit limit and A/R come from the customer record. Open orders, order counts and booked amounts are portal orders only.',
    columns: [
      col('account', 'Account'), col('name', 'Customer'), col('city', 'City'), col('state', 'State'), col('terms', 'Terms'), col('priceSheet', 'Price Sheet'),
      col('stores', 'Stores', 'number'), col('logins', 'Buyer Logins', 'number'), col('creditLimit', 'Credit Limit', 'money'), col('ar', 'A/R', 'money'),
      col('openOrders', 'Open Orders', 'money'), col('available', 'Credit Available', 'money'), col('orders', 'Orders', 'number'), col('units', 'Units', 'number'),
      col('booked', 'Booked', 'money'), col('lastOrder', 'Last Order', 'date')
    ],
    rows
  };
}

const styleFilter = (query) => {
  const q = String(query.q || '').toLowerCase().trim();
  return (s) =>
    (!query.collection || s.category === query.collection) &&
    (!query.season || s.season === query.season) &&
    (query.status === 'all' || (query.status === 'inactive' ? s.status === 'Inactive' : s.status !== 'Inactive')) &&
    (has(s.style, q) || has(s.description, q) || s.colors.some((c) => has(c.colorDescription, q)));
};

function products(query) {
  const p = getProvider();
  const { byStyle } = bookings();
  const rows = p.listAllStyles().filter(styleFilter(query)).map((s) => {
    const b = byStyle.get(s.style) || { units: 0, amount: 0 };
    return {
      style: s.style, description: s.description, collection: s.category, division: s.division, styleGroup: s.styleGroup, season: s.season,
      status: s.status, gender: s.gender, fabric: s.fabric, colors: s.colors.map((c) => c.colorDescription).join(', '),
      sizes: `${s.colors[0].sizes[0].sizeName}–${s.colors[0].sizes.at(-1).sizeName}`.replace(/^(.+)–\1$/, '$1'),
      wholesale: s.wholesale, retail: s.retail, markup: round2(s.retail / s.wholesale),
      available: s.available, unitsBooked: b.units, booked: round2(b.amount)
    };
  });
  return {
    title: 'Product Report',
    note: 'Style details from the style master, with units and dollars booked through the portal.',
    columns: [
      col('style', 'Style'), col('description', 'Description'), col('collection', 'Collection'), col('division', 'Division'), col('styleGroup', 'Style Group'),
      col('season', 'Season'), col('status', 'Status'), col('gender', 'Gender'), col('fabric', 'Fabric'), col('colors', 'Colors'), col('sizes', 'Sizes'),
      col('wholesale', 'Wholesale', 'money'), col('retail', 'MSRP', 'money'), col('markup', 'Markup (x)', 'number'), col('available', 'Available From', 'date'),
      col('unitsBooked', 'Units Booked', 'number'), col('booked', 'Booked', 'money')
    ],
    rows
  };
}

function inventory(query) {
  const p = getProvider();
  const { settings } = load();
  const bySize = query.detail === 'size';
  const warehouses = p.stockByWarehouse({ sizes: [] }).map((w) => w.name);
  const rows = [];
  for (const s of p.listAllStyles().filter(styleFilter(query))) {
    for (const c of s.colors) {
      const base = { style: s.style, description: s.description, collection: s.category, season: s.season, color: c.colorDescription };
      const line = (sizes, size) => {
        const onHand = sizes.reduce((t, z) => t + z.stock, 0);
        const wip = sizes.reduce((t, z) => t + z.wip, 0);
        const split = p.stockByWarehouse({ sizes });
        const low = bySize ? settings.lowStockThreshold : settings.lowStockThreshold * sizes.length;
        const row = { ...base, ...(bySize ? { size } : {}), onHand, wip, otsNow: sizes.reduce((t, z) => t + Math.max(0, z.ots_i), 0), otsFuture: sizes.reduce((t, z) => t + Math.max(0, z.ots), 0) };
        split.forEach((w, i) => (row['wh' + i] = w.units));
        row.value = round2(onHand * s.wholesale);
        row.level = onHand <= 0 ? (wip > 0 ? 'Incoming' : 'Out') : onHand <= low ? 'Low' : 'In Stock';
        return row;
      };
      if (bySize) for (const z of c.sizes) rows.push(line([z], z.sizeName));
      else rows.push(line(c.sizes));
    }
  }
  const kept = rows.filter((r) => !query.level || (query.level === 'low' ? ['Low', 'Out', 'Incoming'].includes(r.level) : query.level === 'out' ? r.level === 'Out' || r.level === 'Incoming' : r.level === 'In Stock'));
  return {
    title: 'Inventory Report',
    note: `On hand, incoming production and OTS by ${bySize ? 'size' : 'color'}. "Low" is at or under the low-stock number in Settings (${settings.lowStockThreshold} per size). Value is on-hand units at wholesale.`,
    columns: [
      col('style', 'Style'), col('description', 'Description'), col('collection', 'Collection'), col('season', 'Season'), col('color', 'Color'),
      ...(bySize ? [col('size', 'Size')] : []),
      col('onHand', 'On Hand', 'number'), col('wip', 'Incoming (WIP)', 'number'), col('otsNow', 'OTS Now', 'number'), col('otsFuture', 'OTS With WIP', 'number'),
      ...warehouses.map((w, i) => col('wh' + i, w, 'number')),
      col('value', 'On-Hand Value', 'money'), col('level', 'Stock Level')
    ],
    rows: kept
  };
}

const builders = { customers, products, inventory };

export function dataReport(type, query = {}) {
  const build = builders[type];
  if (!build) throw Object.assign(new Error('Choose customers, products or inventory.'), { status: 400 });
  const r = build(query);
  // Totals for every number and money column, shown under the table and in the exports.
  const totals = {};
  for (const c of r.columns) if (['number', 'money'].includes(c.type) && !['markup', 'wholesale', 'retail'].includes(c.key)) totals[c.key] = round2(r.rows.reduce((t, row) => t + (Number(row[c.key]) || 0), 0));
  return { ...r, type, totals, count: r.rows.length };
}

export function reportFilters() {
  const p = getProvider();
  const styles = p.listAllStyles();
  return { collections: [...new Set(styles.map((s) => s.category))].sort(), seasons: p.listSeasons().filter((x) => styles.some((s) => s.season === x.code)) };
}
