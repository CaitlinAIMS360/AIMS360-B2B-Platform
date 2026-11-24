// Shopping routes used by both buyers and brand admins: catalog, linesheets,
// cart preview and order creation. Buyers act for their own customer account;
// admins name the customer they are ordering for.
import { Router } from 'express';
import { currentUser } from '../auth.js';
import { getProvider } from '../aims360/index.js';
import { load, logActivity } from '../store.js';
import { buildPreview, submitCart, catalogStyle, creditCheck, accountFor } from '../ordering.js';
import { orderView } from '../views.js';
import { sendExport } from '../exports.js';
import { matchLines, parseText, linesFromOrder, parseOrderForm } from '../quickOrder.js';

const r = Router();
r.use((req, res, next) => {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Please sign in.' });
  req.user = u;
  next();
});
const p = () => getProvider();

export function customerSummary(c) {
  return {
    customerAccount: c.customerAccount,
    customerName: c.customerName,
    terms: c.terms,
    currency: c.currency,
    priceSheet: c.priceSheet?.name || null,
    city: c.address?.city || c.stores[0]?.city || '',
    state: c.address?.state || c.stores[0]?.state || '',
    stores: c.stores,
    credit: creditCheck(c, 0)
  };
}

r.get('/account', (req, res) => {
  const account = accountFor(req.user, req.query.customer);
  const c = account ? p().getCustomer(account) : null;
  res.json(c ? customerSummary(c) : null);
});

// The customer list comes from AIMS360. Buyers only ever see their own.
r.get('/customers', (req, res) => {
  const all = p().listCustomers();
  const list = req.user.role === 'admin' ? all : all.filter((c) => c.customerAccount === req.user.customerAccount);
  res.json({
    customers: list.map(customerSummary),
    terms: p().listTerms(),
    shipVias: p().listShipVias(),
    salesReps: p().listSalesReps(),
    discountReasons: p().listDiscountReasons()
  });
});

r.post('/customers', (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only brand admins can add customers.' });
  try {
    const c = p().createCustomer(req.body || {});
    logActivity(req.user.email, 'customer.created', `${c.customerName} (${c.customerAccount})`);
    res.json(customerSummary(c));
  } catch (e) {
    next(e);
  }
});

function catalogFor(req, styles) {
  const { settings } = load();
  const account = accountFor(req.user, req.query.customer);
  return styles.map((s) => catalogStyle(s, account, settings, { warehouses: req.user.role === 'admin' }));
}

export const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
export const count = (items, pick) => {
  const m = new Map();
  for (const it of items) for (const k of [].concat(pick(it))) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].map(([name, n]) => ({ name, count: n })).sort((x, y) => x.name.localeCompare(y.name));
};
export const sorters = {
  style: (x, y) => x.style.localeCompare(y.style),
  name: (x, y) => x.description.localeCompare(y.description),
  priceLow: (x, y) => x.price - y.price,
  priceHigh: (x, y) => y.price - x.price
};

r.get('/catalog', (req, res) => {
  const { settings } = load();
  const { q = '', season = '', avail = '', sort = 'style' } = req.query;
  const admin = req.user.role === 'admin';
  // Buyers only ever see active styles. Admins see active by default and can ask for inactive or all.
  const status = admin && ['inactive', 'all'].includes(req.query.status) ? req.query.status : 'active';
  const divisions = list(req.query.division), groups = list(req.query.group);
  const cats = list(req.query.category), colors = list(req.query.color), genders = list(req.query.gender), fabrics = list(req.query.fabric);
  const term = String(q).toLowerCase().trim();
  const source = admin ? p().listAllStyles().filter((s) => status === 'all' || (s.status === 'Inactive') === (status === 'inactive')) : p().listStyles();
  const all = catalogFor(req, source).filter((s) => !settings.hideSoldOut || !s.soldOut);
  const items = all
    .filter((s) => !season || s.season === season)
    .filter((s) => !cats.length || cats.includes(s.category))
    .filter((s) => !genders.length || genders.includes(s.gender))
    .filter((s) => !divisions.length || divisions.includes(s.division))
    .filter((s) => !groups.length || groups.includes(s.styleGroup))
    .filter((s) => !fabrics.length || fabrics.includes(s.fabric))
    .filter((s) => !colors.length || s.colors.some((c) => colors.includes(c.colorDescription)))
    .filter((s) => avail !== 'now' || s.availableNow)
    .filter((s) => avail !== 'future' || (!s.availableNow && !s.soldOut))
    .filter(
      (s) =>
        !term ||
        s.style.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.colors.some((c) => c.colorDescription.toLowerCase().includes(term))
    )
    .sort(sorters[sort] || sorters.style);
  res.json({
    items,
    total: all.length,
    facets: {
      seasons: p().listSeasons().filter((x) => all.some((s) => s.season === x.code)),
      categories: count(all, (s) => s.category),
      colors: count(all, (s) => s.colors.map((c) => c.colorDescription)),
      genders: count(all, (s) => s.gender),
      divisions: count(all, (s) => s.division),
      groups: count(all, (s) => s.styleGroup),
      fabrics: count(all, (s) => s.fabric)
    }
  });
});

r.get('/catalog/:style', (req, res) => {
  const s = p().getStyle(req.params.style);
  if (!s || (s.status === 'Inactive' && req.user.role !== 'admin')) return res.status(404).json({ error: 'Style not found' });
  res.json(catalogFor(req, [s])[0]);
});

// Linesheets: buyers see active ones shared with everyone or with their account.
function visibleLinesheets(user) {
  const { linesheets } = load();
  if (user.role === 'admin') return linesheets;
  return linesheets.filter((l) => l.active && (!l.customerAccounts.length || l.customerAccounts.includes(user.customerAccount)));
}

r.get('/linesheets', (req, res) => {
  res.json(
    visibleLinesheets(req.user).map((l) => {
      const styles = l.styles.map((code) => p().getStyle(code)).filter(Boolean);
      return {
        ...l,
        styleCount: styles.length,
        seasonName: p().listSeasons().find((s) => s.code === l.season)?.description || '',
        cover: styles.slice(0, 4).map((s) => `/api/images/${s.style}/${s.colors[0].color}.svg`)
      };
    })
  );
});

r.get('/linesheets/:id', (req, res) => {
  const l = visibleLinesheets(req.user).find((x) => x.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Linesheet not found' });
  const styles = l.styles.map((code) => p().getStyle(code)).filter(Boolean);
  res.json({
    ...l,
    seasonName: p().listSeasons().find((s) => s.code === l.season)?.description || '',
    items: catalogFor(req, styles)
  });
});

const stamp = () => new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' }) + ' PT';
const priceNote = (req) => {
  const account = accountFor(req.user, req.query.customer);
  const c = account ? p().getCustomer(account) : null;
  return c ? `Prices for ${c.customerName}` : 'Wholesale prices';
};

// Linesheet export: csv, xlsx, pdf, or orderform (Excel order form).
r.get('/linesheets/:id/export', async (req, res, next) => {
  try {
    const l = visibleLinesheets(req.user).find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Linesheet not found' });
    const items = catalogFor(req, l.styles.map((code) => p().getStyle(code)).filter(Boolean));
    const rows = items.flatMap((s) => s.colors.map((c) => ({ s, c })));
    await sendExport(res, req.query.format, rows, { kind: 'linesheet', title: l.name, subtitle: `${priceNote(req)} · ${stamp()}`, images: req.query.images !== '0' }, l.name);
  } catch (e) {
    next(e);
  }
});

// OTS report export. keys = "STYLE|COLOR,STYLE|COLOR" (up to 100).
r.get('/ots-report/export', async (req, res, next) => {
  try {
    const keys = list(req.query.keys).slice(0, 100);
    const basis = req.query.basis === 'future' ? 'future' : 'now';
    const rows = [];
    for (const k of keys) {
      const [style, color] = k.split('|');
      const st = p().getStyle(style);
      const s = st && catalogFor(req, [st])[0];
      const c = s?.colors.find((x) => x.color === color);
      if (c) rows.push({ s, c });
    }
    const opts = {
      kind: 'ots', title: 'OTS Report', basis, detail: req.query.detail === 'total' ? 'total' : 'size', images: req.query.images !== '0',
      subtitle: `${basis === 'future' ? 'Stock plus incoming production' : 'Stock available now'} · ${priceNote(req)} · ${stamp()}`
    };
    await sendExport(res, req.query.format, rows, opts, `ots-report-${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })}`);
  } catch (e) {
    next(e);
  }
});

// Fill a cart quickly: typed lines, a past order, or a filled-in order form.
r.post('/cart/fill', async (req, res, next) => {
  try {
    const body = req.body || {};
    const account = accountFor(req.user, body.customerAccount);
    let raw = [];
    let problems = [];
    let info = {};
    if (body.orderID) {
      const o = p().getOrder(body.orderID);
      if (!o || (req.user.role === 'buyer' && o.customerAccount !== req.user.customerAccount)) return res.status(404).json({ error: 'Order not found' });
      raw = linesFromOrder(o);
      info = { fromOrder: o.order, customerAccount: o.customerAccount };
    } else if (body.file) {
      ({ raw, info } = await parseOrderForm(body.file));
    } else {
      ({ raw, problems } = parseText(body.text));
    }
    const out = matchLines(info.customerAccount || account, raw);
    res.json({ ...out, problems: [...problems, ...out.problems], info });
  } catch (e) {
    next(e);
  }
});

r.post('/cart/preview', (req, res) => res.json(buildPreview(req.user, req.body || {})));

r.post('/orders', (req, res) => {
  const result = submitCart(req.user, req.body || {});
  if (!result.ok) return res.status(400).json(result.preview);
  for (const o of result.orders)
    logActivity(req.user.email, 'order.created', `Order ${o.order} for ${o.customerName} (${o.status}, ${o.customFields[0]?.valueDescription || ''})`);
  res.json({ orders: result.orders.map(orderView), preview: result.preview });
});

export default r;
