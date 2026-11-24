// Guest browsing: anyone with the link can look at the catalog and the
// linesheets shared with all customers. No stock, no ordering, and prices
// only as the brand's settings allow. Guests can request an account.
import { Router } from 'express';
import { getProvider } from '../aims360/index.js';
import { load, save, id, logActivity } from '../store.js';
import { list, count, sorters } from './shop.js';

const r = Router();
const p = () => getProvider();

r.use((req, res, next) => {
  if (!load().settings.guestBrowsing) return res.status(403).json({ error: 'Guest browsing is turned off. Please sign in.' });
  next();
});

function guestStyle(s, settings) {
  const price = settings.guestPrices === 'wholesale' ? s.wholesale : null;
  const retail = settings.guestPrices === 'none' ? null : s.retail;
  return {
    style: s.style, description: s.description, category: s.category, season: s.season, gender: s.gender, fabric: s.fabric,
    price, retail,
    colors: s.colors.map((c) => ({ color: c.color, colorDescription: c.colorDescription, hex: c.hex, image: `/api/images/${s.style}/${c.color}.svg`, sizes: c.sizes.map((z) => ({ sizeName: z.sizeName })) }))
  };
}

r.get('/catalog', (req, res) => {
  const { settings } = load();
  const { q = '', season = '', sort = 'style' } = req.query;
  const cats = list(req.query.category), colors = list(req.query.color), genders = list(req.query.gender), fabrics = list(req.query.fabric);
  const term = String(q).toLowerCase().trim();
  const all = p().listStyles().map((s) => guestStyle(s, settings));
  const bySort = sort.startsWith('price') && settings.guestPrices === 'none' ? sorters.style : sorters[sort] || sorters.style;
  const items = all
    .filter((s) => !season || s.season === season)
    .filter((s) => !cats.length || cats.includes(s.category))
    .filter((s) => !genders.length || genders.includes(s.gender))
    .filter((s) => !fabrics.length || fabrics.includes(s.fabric))
    .filter((s) => !colors.length || s.colors.some((c) => colors.includes(c.colorDescription)))
    .filter((s) => !term || `${s.style} ${s.description} ${s.colors.map((c) => c.colorDescription).join(' ')}`.toLowerCase().includes(term))
    .sort((x, y) => bySort({ ...x, price: x.price ?? x.retail ?? 0 }, { ...y, price: y.price ?? y.retail ?? 0 }));
  res.json({
    items,
    total: all.length,
    guestPrices: settings.guestPrices,
    facets: {
      seasons: p().listSeasons().filter((x) => all.some((s) => s.season === x.code)),
      categories: count(all, (s) => s.category),
      colors: count(all, (s) => s.colors.map((c) => c.colorDescription)),
      genders: count(all, (s) => s.gender),
      fabrics: count(all, (s) => s.fabric)
    }
  });
});

r.get('/catalog/:style', (req, res) => {
  const s = p().listStyles().find((x) => x.style === req.params.style);
  if (!s) return res.status(404).json({ error: 'Style not found' });
  res.json({ ...guestStyle(s, load().settings), guestPrices: load().settings.guestPrices });
});

const publicSheets = () => load().linesheets.filter((l) => l.active && !l.customerAccounts.length);

r.get('/linesheets', (req, res) => {
  res.json(
    publicSheets().map((l) => {
      const styles = l.styles.map((c) => p().getStyle(c)).filter((x) => x && x.status !== 'Inactive');
      return {
        id: l.id, name: l.name, description: l.description, styleCount: styles.length,
        seasonName: p().listSeasons().find((s) => s.code === l.season)?.description || '',
        cover: styles.slice(0, 4).map((s) => `/api/images/${s.style}/${s.colors[0].color}.svg`)
      };
    })
  );
});

r.get('/linesheets/:id', (req, res) => {
  const l = publicSheets().find((x) => x.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Linesheet not found' });
  const { settings } = load();
  res.json({
    id: l.id, name: l.name, description: l.description,
    seasonName: p().listSeasons().find((s) => s.code === l.season)?.description || '',
    items: l.styles.map((c) => p().getStyle(c)).filter((x) => x && x.status !== 'Inactive').map((s) => guestStyle(s, settings))
  });
});

// A guest asks to be connected to a customer account. A brand admin decides.
r.post('/access-requests', (req, res) => {
  const b = req.body || {};
  const clean = (v, n = 120) => String(v || '').trim().slice(0, n);
  const reqst = {
    id: id('ar'),
    businessName: clean(b.businessName),
    contactName: clean(b.contactName),
    email: clean(b.email).toLowerCase(),
    phone: clean(b.phone, 40),
    address1: clean(b.address1), city: clean(b.city, 60), state: clean(b.state, 2).toUpperCase(), zipCode: clean(b.zipCode, 12),
    existingCustomer: !!b.existingCustomer,
    accountHint: clean(b.accountHint, 60),
    resaleNumber: clean(b.resaleNumber, 40),
    message: clean(b.message, 600),
    requestedAt: new Date().toISOString(),
    state: 'pending'
  };
  if (!reqst.businessName || !reqst.contactName) return res.status(400).json({ error: 'Enter your business name and your name.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reqst.email)) return res.status(400).json({ error: 'Enter a valid email.' });
  const st = load();
  if (st.users.some((u) => u.email.toLowerCase() === reqst.email)) return res.status(400).json({ error: 'That email already has a login. Please sign in.' });
  if (st.accessRequests.some((a) => a.email === reqst.email && a.state === 'pending'))
    return res.status(400).json({ error: 'We already have a request from that email. The brand will be in touch.' });
  st.accessRequests.unshift(reqst);
  save();
  logActivity(reqst.email, 'access.requested', reqst.businessName);
  res.json({ ok: true });
});

export default r;
