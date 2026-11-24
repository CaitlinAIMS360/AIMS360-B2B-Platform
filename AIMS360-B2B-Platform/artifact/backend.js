// Runs the portal's server code inside the page: every /api call the screens
// make is answered here instead of going to a server.
import './globals.js';
import { Router } from './shims/express.js';
import { load } from '../server/store.js';
import { login, currentUser, publicUser } from '../server/auth.js';
import { getProvider } from '../server/aims360/index.js';
import { styleImageSvg } from '../server/images.js';
import { ORDER_TYPES } from '../server/ordering.js';
import buyerRoutes from '../server/routes/buyer.js';
import adminRoutes from '../server/routes/admin.js';
import shopRoutes from '../server/routes/shop.js';
import publicRoutes from '../server/routes/public.js';
import { seedDemoHistory } from '../server/demoSeed.js';

load();
seedDemoHistory();
const app = Router();
app.get('/api/config', (req, res) => {
  const { settings } = load();
  res.json({
    brandName: settings.brandName, tagline: settings.tagline, accentColor: settings.accentColor, mode: getProvider().mode,
    orderTypes: Object.values(ORDER_TYPES).map(({ code, label }) => ({ code, label })),
    deliveryWindows: settings.deliveryWindows, termsText: settings.termsText, requireTerms: settings.requireTerms,
    minOrderUnits: settings.minOrderUnits, minOrderAmount: settings.minOrderAmount, guestBrowsing: settings.guestBrowsing
  });
});
app.post('/api/auth/login', (req, res) => {
  const { email, password, portal } = req.body || {};
  const u = login(email, password, portal === 'admin' ? 'admin' : 'buyer');
  if (!u) return res.status(401).json({ error: 'That email and password do not match.' });
  req.session.uid = u.id;
  res.json(publicUser(u));
});
app.post('/api/auth/logout', (req, res) => { req.session = null; res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => res.json(publicUser(currentUser(req))));
app.use('/api/public', publicRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong.' : err.message, code: err.code });
});

const SESSION = 'aims360-b2b:session';
let session = {};
try { session = JSON.parse(localStorage.getItem(SESSION) || '{}'); } catch { /* signed out */ }

const images = new Map();
const imageUri = (style, color) => {
  const k = style + '|' + color;
  if (!images.has(k)) images.set(k, 'data:image/svg+xml,' + encodeURIComponent(styleImageSvg(style, color) || '<svg xmlns="http://www.w3.org/2000/svg"/>'));
  return images.get(k);
};

function handle(method, url, body) {
  return new Promise((resolve) => {
    const u = new URL(url, 'http://portal.local');
    const out = { status: 200, headers: {} };
    const finish = (payload) => {
      session = req.session || {};
      try { localStorage.setItem(SESSION, JSON.stringify(session)); } catch { /* this visit only */ }
      resolve(new Response([204, 304].includes(out.status) ? null : payload, { status: out.status, headers: out.headers }));
    };
    const res = {
      status(s) { out.status = s; return res; },
      set(k, v) { if (typeof k === 'object') Object.assign(out.headers, k); else out.headers[k] = v; return res; },
      type(t) { out.headers['Content-Type'] = t; return res; },
      json(data) {
        out.headers['Content-Type'] = 'application/json';
        // Pictures are drawn in the page, so swap picture links for the picture itself.
        finish(JSON.stringify(data ?? null).replace(/"\/api\/images\/([^/"]+)\/([^"]+)\.svg"/g, (_, s, c) => JSON.stringify(imageUri(s, c))));
      },
      send(data) { finish(data); },
      end() { finish(null); }
    };
    const req = { method, path: u.pathname, url: u.pathname + u.search, query: Object.fromEntries(u.searchParams), params: {}, body, session: { ...session } };
    app(req, res, (err) => res.status(err ? 500 : 404).json({ error: err ? 'Something went wrong.' : 'Not found' }));
  });
}

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('/api/')) return realFetch(input, init);
  let body;
  try { body = init.body ? JSON.parse(init.body) : undefined; } catch { body = undefined; }
  return handle((init.method || 'GET').toUpperCase(), url, body);
};
