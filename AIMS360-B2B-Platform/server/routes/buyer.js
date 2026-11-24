import { Router } from 'express';
import { requireRole } from '../auth.js';
import { getProvider } from '../aims360/index.js';
import { load, save, id, logActivity } from '../store.js';
import { creditCheck, releaseFromBulk } from '../ordering.js';
import { orderView } from '../views.js';

const r = Router();
r.use(requireRole('buyer'));
const p = () => getProvider();

r.get('/account', (req, res) => {
  const c = p().getCustomer(req.user.customerAccount);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  res.json({
    customerAccount: c.customerAccount,
    customerName: c.customerName,
    terms: c.terms,
    currency: c.currency,
    priceSheet: c.priceSheet?.name || null,
    stores: c.stores,
    credit: creditCheck(c, 0)
  });
});

r.get('/orders', (req, res) => {
  res.json(p().listOrders({ customerAccount: req.user.customerAccount }).map(orderView));
});

r.get('/orders/:id', (req, res) => {
  const o = p().getOrder(req.params.id);
  if (!o || o.customerAccount !== req.user.customerAccount) return res.status(404).json({ error: 'Order not found' });
  res.json(orderView(o));
});

r.post('/orders/:id/cancel-request', (req, res) => {
  const o = p().getOrder(req.params.id);
  if (!o || o.customerAccount !== req.user.customerAccount) return res.status(404).json({ error: 'Order not found' });
  if (!['Open', 'Hold'].includes(o.status)) return res.status(400).json({ error: `A ${o.status} order cannot be cancelled.` });
  const st = load();
  if (st.cancelRequests.some((c) => c.orderID === o.orderID && c.state === 'pending'))
    return res.status(400).json({ error: 'A cancel request is already waiting for the brand.' });
  st.cancelRequests.push({
    id: id('cr'),
    orderID: o.orderID,
    order: o.order,
    customerAccount: o.customerAccount,
    reason: String(req.body?.reason || '').slice(0, 500),
    requestedBy: req.user.email,
    requestedAt: new Date().toISOString(),
    state: 'pending'
  });
  save();
  logActivity(req.user.email, 'cancel.requested', `Order ${o.order}`);
  res.json(orderView(o));
});

r.post('/orders/:id/releases', (req, res, next) => {
  try {
    const rel = releaseFromBulk(req.user, req.params.id, req.body || {});
    logActivity(req.user.email, 'bulk.released', `Release ${rel.order} from bulk ${p().getOrder(req.params.id).order}`);
    res.json(orderView(rel));
  } catch (e) {
    next(e);
  }
});

r.get('/credits', (req, res) => res.json(p().listCredits(req.user.customerAccount)));

r.get('/invoices', (req, res) => res.json(p().listInvoices(req.user.customerAccount)));

export default r;
