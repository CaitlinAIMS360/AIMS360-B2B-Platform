import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { requireRole, publicUser } from '../auth.js';
import { getProvider } from '../aims360/index.js';
import { load, save, id, logActivity, defaultSettings } from '../store.js';
import { creditCheck, releaseFromBulk } from '../ordering.js';
import { orderView } from '../views.js';

const r = Router();
r.use(requireRole('admin'));
const p = () => getProvider();

r.get('/dashboard', (req, res) => {
  const orders = p().listOrders();
  const st = load();
  const active = orders.filter((o) => ['Open', 'Hold'].includes(o.status));
  res.json({
    company: p().getCompany(),
    totals: {
      orders: orders.length,
      open: orders.filter((o) => o.status === 'Open').length,
      hold: orders.filter((o) => o.status === 'Hold').length,
      creditHolds: orders.filter((o) => o.status === 'Hold' && o.orderStatusReason === 'CR').length,
      bookedAmount: Math.round(orders.filter((o) => o.status !== 'Cancelled').reduce((t, o) => t + o.bookedAmount, 0) * 100) / 100,
      openValue: Math.round(active.reduce((t, o) => t + orderView(o).openValue, 0) * 100) / 100,
      pendingCancels: st.cancelRequests.filter((c) => c.state === 'pending').length,
      accessRequests: st.accessRequests.filter((a) => a.state === 'pending').length,
      buyers: st.users.filter((u) => u.role === 'buyer' && u.active).length
    },
    byType: ['I', 'PB', 'B'].map((code) => ({
      code,
      count: orders.filter((o) => o.status !== 'Cancelled' && o.customFields.some((f) => f.value === code)).length
    })),
    activity: st.activity.slice(0, 12)
  });
});

// Reports: bookings from portal orders. Cancelled orders are left out, and so are
// releases from bulk orders, because the bulk order already counts those units.
r.get('/reports', (req, res) => {
  const months = [3, 6, 12].includes(Number(req.query.months)) ? Number(req.query.months) : 6;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const round = (n) => Math.round(n * 100) / 100;
  const all = p().listOrders().filter((o) => o.status !== 'Cancelled' && !o.distributionOrder);
  const orders = all.filter((o) => new Date(o.createdOn) >= from);
  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = (k) => new Date(k + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  const group = (list, keyOf, init) => {
    const m = new Map();
    for (const o of list) for (const [k, amount, units, extra] of keyOf(o)) {
      const g = m.get(k) || { key: k, amount: 0, units: 0, orders: new Set(), ...init?.(extra) };
      g.amount += amount; g.units += units; g.orders.add(o.orderID);
      m.set(k, g);
    }
    return [...m.values()].map((g) => ({ ...g, amount: round(g.amount), orders: g.orders.size }));
  };
  const whole = (o) => [o.bookedAmount, o.bookedTotal];
  const byMonth = [];
  for (let i = 0; i < months; i++) byMonth.push({ key: monthKey(new Date(from.getFullYear(), from.getMonth() + i, 1)), amount: 0, units: 0, orders: 0 });
  for (const g of group(orders, (o) => [[monthKey(new Date(o.createdOn)), ...whole(o)]])) Object.assign(byMonth.find((m) => m.key === g.key) || {}, g);
  const net = (o) => 1 - (o.netDiscountPercentage || 0) / 100;
  const lines = (o) => o.lineItems.map((l) => {
    const u = l.sizes.reduce((t, z) => t + z.orderQuantity, 0);
    return [l.style, u * l.price * net(o), u, l];
  });
  const total = round(orders.reduce((t, o) => t + o.bookedAmount, 0));
  const typeLabel = { I: 'Immediate', PB: 'Prebook', B: 'Bulk' };
  const open = all.filter((o) => ['Open', 'Hold'].includes(o.status));
  res.json({
    months,
    from: from.toISOString().slice(0, 10),
    totals: {
      amount: total,
      units: orders.reduce((t, o) => t + o.bookedTotal, 0),
      orders: orders.length,
      average: orders.length ? round(total / orders.length) : 0,
      customers: new Set(orders.map((o) => o.customerAccount)).size
    },
    byMonth: byMonth.map((m) => ({ ...m, label: monthLabel(m.key) })),
    byCustomer: group(orders, (o) => [[o.customerAccount, ...whole(o), o]], (o) => ({ label: o.customerName })).sort((a, b) => b.amount - a.amount),
    byStyle: group(orders, lines, (l) => ({ label: l.description })).sort((a, b) => b.amount - a.amount).slice(0, 10),
    byCategory: group(orders, (o) => lines(o).map(([style, a, u]) => [p().getStyle(style)?.category || 'Other', a, u])).map((g) => ({ ...g, label: g.key })).sort((a, b) => b.amount - a.amount),
    byType: group(orders, (o) => [[o.customFields.find((f) => f.displayName === 'Order Type')?.value || '-', ...whole(o)]]).map((g) => ({ ...g, label: typeLabel[g.key] || 'No Type' })).sort((a, b) => b.amount - a.amount),
    openByShip: group(open, (o) => [[(o.start || o.entered).slice(0, 7), orderView(o).openValue, o.bookedTotal]]).map((g) => ({ ...g, label: monthLabel(g.key) })).sort((a, b) => a.key.localeCompare(b.key)),
    exposure: p().listCustomers().map((c) => ({ key: c.customerAccount, label: c.customerName, ...creditCheck(c, 0) })).filter((c) => c.limit).sort((a, b) => (a.available ?? 0) - (b.available ?? 0))
  });
});

r.get('/orders', (req, res) => {
  const { status = '' } = req.query;
  res.json(
    p()
      .listOrders()
      .filter((o) => !status || o.status === status)
      .map(orderView)
  );
});

r.post('/orders/:id/status', (req, res, next) => {
  try {
    const { status } = req.body || {};
    const o = p().setOrderStatus(req.params.id, status, status === 'Hold' ? 'AD' : null);
    logActivity(req.user.email, 'order.status', `Order ${o.order} → ${status}`);
    res.json(orderView(o));
  } catch (e) {
    next(e);
  }
});

r.post('/orders/:id/cancel', (req, res, next) => {
  try {
    const o = p().cancelOrder(req.params.id, { reOpenBulkOrder: true });
    const st = load();
    for (const c of st.cancelRequests.filter((x) => x.orderID === o.orderID && x.state === 'pending')) {
      c.state = 'approved';
      c.decidedBy = req.user.email;
      c.decidedAt = new Date().toISOString();
    }
    save();
    logActivity(req.user.email, 'order.cancelled', `Order ${o.order}`);
    res.json(orderView(o));
  } catch (e) {
    next(e);
  }
});

r.post('/orders/:id/releases', (req, res, next) => {
  try {
    const rel = releaseFromBulk(req.user, req.params.id, req.body || {});
    logActivity(req.user.email, 'bulk.released', `Release ${rel.order}`);
    res.json(orderView(rel));
  } catch (e) {
    next(e);
  }
});

r.get('/cancel-requests', (req, res) => res.json(load().cancelRequests.slice().reverse()));

r.post('/cancel-requests/:id/decline', (req, res) => {
  const st = load();
  const c = st.cancelRequests.find((x) => x.id === req.params.id);
  if (!c || c.state !== 'pending') return res.status(404).json({ error: 'Request not found' });
  c.state = 'declined';
  c.decidedBy = req.user.email;
  c.decidedAt = new Date().toISOString();
  save();
  logActivity(req.user.email, 'cancel.declined', `Order ${c.order}`);
  res.json(c);
});

r.get('/customers', (req, res) => {
  res.json(
    p()
      .listCustomers()
      .map((c) => ({ customerAccount: c.customerAccount, customerName: c.customerName, terms: c.terms, credit: creditCheck(c, 0), stores: c.stores.length }))
  );
});

r.get('/buyers', (req, res) => {
  const st = load();
  res.json(
    st.users
      .filter((u) => u.role === 'buyer')
      .map((u) => ({ ...publicUser(u), active: u.active, customerName: p().getCustomer(u.customerAccount)?.customerName || '' }))
  );
});

// Live version: emails an invite link. Demo: returns a one-time password to hand over.
r.post('/buyers', (req, res) => {
  const { email, name, customerAccount } = req.body || {};
  const st = load();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (!p().getCustomer(customerAccount)) return res.status(400).json({ error: 'Choose a customer account.' });
  if (st.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ error: 'That email already has a login.' });
  const tempPassword = crypto.randomBytes(6).toString('base64url');
  const user = {
    id: id('u'),
    email: email.trim(),
    name: String(name || '').trim() || email,
    role: 'buyer',
    customerAccount,
    passwordHash: bcrypt.hashSync(tempPassword, 10),
    active: true,
    invitedAt: new Date().toISOString(),
    invitedBy: req.user.email
  };
  st.users.push(user);
  save();
  logActivity(req.user.email, 'buyer.invited', `${user.email} → ${customerAccount}`);
  res.json({ buyer: publicUser(user), tempPassword });
});

r.patch('/buyers/:id', (req, res) => {
  const st = load();
  const u = st.users.find((x) => x.id === req.params.id && x.role === 'buyer');
  if (!u) return res.status(404).json({ error: 'Buyer not found' });
  if (typeof req.body?.active === 'boolean') u.active = req.body.active;
  save();
  logActivity(req.user.email, u.active ? 'buyer.enabled' : 'buyer.disabled', u.email);
  res.json(publicUser(u));
});

// Access requests from guests: approve by linking to a customer (or creating one), or decline.
r.get('/access-requests', (req, res) => res.json(load().accessRequests));

r.post('/access-requests/:id/approve', (req, res, next) => {
  try {
    const st = load();
    const a = st.accessRequests.find((x) => x.id === req.params.id);
    if (!a || a.state !== 'pending') return res.status(404).json({ error: 'Request not found' });
    if (st.users.some((u) => u.email.toLowerCase() === a.email)) return res.status(400).json({ error: 'That email already has a login.' });
    let customer;
    if (req.body?.createCustomer) {
      customer = p().createCustomer({
        customerName: a.businessName, buyerName: a.contactName, email: a.email, phone: a.phone,
        address1: a.address1, city: a.city, state: a.state, zipCode: a.zipCode,
        terms: req.body.terms || 'NET 30', creditLimit: req.body.creditLimit
      });
      logActivity(req.user.email, 'customer.created', `${customer.customerName} (${customer.customerAccount})`);
    } else {
      customer = p().getCustomer(req.body?.customerAccount);
      if (!customer) return res.status(400).json({ error: 'Choose the customer account to connect, or create a new customer.' });
    }
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    const user = {
      id: id('u'), email: a.email, name: a.contactName, role: 'buyer', customerAccount: customer.customerAccount,
      passwordHash: bcrypt.hashSync(tempPassword, 10), active: true, invitedAt: new Date().toISOString(), invitedBy: req.user.email
    };
    st.users.push(user);
    Object.assign(a, { state: 'approved', customerAccount: customer.customerAccount, decidedBy: req.user.email, decidedAt: new Date().toISOString() });
    save();
    logActivity(req.user.email, 'access.approved', `${a.email} → ${customer.customerAccount}`);
    res.json({ request: a, buyer: publicUser(user), customerName: customer.customerName, tempPassword });
  } catch (e) {
    next(e);
  }
});

r.post('/access-requests/:id/decline', (req, res) => {
  const st = load();
  const a = st.accessRequests.find((x) => x.id === req.params.id);
  if (!a || a.state !== 'pending') return res.status(404).json({ error: 'Request not found' });
  Object.assign(a, { state: 'declined', decidedBy: req.user.email, decidedAt: new Date().toISOString() });
  save();
  logActivity(req.user.email, 'access.declined', a.email);
  res.json(a);
});

function cleanLinesheet(body, existing = {}) {
  const name = String(body.name ?? existing.name ?? '').trim();
  if (!name) throw Object.assign(new Error('Give the linesheet a name.'), { status: 400 });
  const styles = [...new Set((body.styles ?? existing.styles ?? []).filter((code) => p().getStyle(code)))];
  if (!styles.length) throw Object.assign(new Error('Add at least one style.'), { status: 400 });
  return {
    name,
    description: String(body.description ?? existing.description ?? '').slice(0, 600),
    season: p().listSeasons().some((x) => x.code === body.season) ? body.season : '',
    active: body.active ?? existing.active ?? true,
    customerAccounts: (body.customerAccounts ?? existing.customerAccounts ?? []).filter((a) => p().getCustomer(a)),
    styles
  };
}

r.post('/linesheets', (req, res, next) => {
  try {
    const st = load();
    const now = new Date().toISOString();
    const l = { id: id('ls'), ...cleanLinesheet(req.body || {}), createdAt: now, updatedAt: now };
    st.linesheets.unshift(l);
    save();
    logActivity(req.user.email, 'linesheet.created', l.name);
    res.json(l);
  } catch (e) {
    next(e);
  }
});

r.put('/linesheets/:id', (req, res, next) => {
  try {
    const st = load();
    const l = st.linesheets.find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Linesheet not found' });
    Object.assign(l, cleanLinesheet(req.body || {}, l), { updatedAt: new Date().toISOString() });
    save();
    logActivity(req.user.email, 'linesheet.updated', l.name);
    res.json(l);
  } catch (e) {
    next(e);
  }
});

r.delete('/linesheets/:id', (req, res) => {
  const st = load();
  const l = st.linesheets.find((x) => x.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Linesheet not found' });
  st.linesheets = st.linesheets.filter((x) => x !== l);
  save();
  logActivity(req.user.email, 'linesheet.deleted', l.name);
  res.json({ ok: true });
});

const editable = Object.keys(defaultSettings);
r.get('/settings', (req, res) => res.json(load().settings));
r.put('/settings', (req, res) => {
  const st = load();
  const body = req.body || {};
  for (const k of editable) if (k in body) st.settings[k] = body[k];
  if (!['none', 'msrp', 'wholesale'].includes(st.settings.guestPrices)) st.settings.guestPrices = 'none';
  st.settings.guestBrowsing = !!st.settings.guestBrowsing;
  st.settings.lowStockThreshold = Math.max(0, Number(st.settings.lowStockThreshold) || 0);
  st.settings.minOrderUnits = Math.max(0, Number(st.settings.minOrderUnits) || 0);
  st.settings.minOrderAmount = Math.max(0, Number(st.settings.minOrderAmount) || 0);
  st.settings.deliveryWindows = (st.settings.deliveryWindows || [])
    .filter((w) => w.name && w.start && w.complete)
    .map((w) => ({ id: w.id || id('dw'), name: w.name, start: w.start, complete: w.complete }));
  save();
  logActivity(req.user.email, 'settings.updated', 'Portal settings');
  res.json(st.settings);
});

export default r;
