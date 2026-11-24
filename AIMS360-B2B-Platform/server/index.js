import express from 'express';
import cookieSession from 'cookie-session';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from './store.js';
import { login, currentUser, publicUser } from './auth.js';
import { getProvider } from './aims360/index.js';
import { styleImageSvg } from './images.js';
import { ORDER_TYPES } from './ordering.js';
import { seedDemoHistory } from './demoSeed.js';
import { liveState } from './aims360/live.js';
import { restConfigured, refreshFromRest, sendsOrders } from './aims360/rest.js';
import buyerRoutes from './routes/buyer.js';
import adminRoutes from './routes/admin.js';
import shopRoutes from './routes/shop.js';
import publicRoutes from './routes/public.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Settings can live in a .env file next to the portal (one NAME=value per line).
try {
  for (const line of fs.readFileSync(path.join(here, '..', '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch { /* no .env file: use the host's own settings */ }

export function createApp() {
  load();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4mb' }));
  app.use(
    cookieSession({
      name: 'b2b',
      keys: [process.env.SESSION_SECRET || 'dev-only-change-me'],
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12
    })
  );

  app.get('/api/config', (req, res) => {
    const { settings } = load();
    res.json({
      brandName: settings.brandName,
      tagline: settings.tagline,
      accentColor: settings.accentColor, logo: settings.logo || '', logoDark: settings.logoDark || '',
      mode: getProvider().mode, live: liveState(), sendsOrders: sendsOrders(),
      orderTypes: Object.values(ORDER_TYPES).map(({ code, label }) => ({ code, label })),
      deliveryWindows: settings.deliveryWindows,
      termsText: settings.termsText,
      requireTerms: settings.requireTerms,
      minOrderUnits: settings.minOrderUnits,
      minOrderAmount: settings.minOrderAmount,
      guestBrowsing: settings.guestBrowsing
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password, portal } = req.body || {};
    const u = login(email, password, portal === 'admin' ? 'admin' : 'buyer');
    if (!u) return res.status(401).json({ error: 'That email and password do not match. Runway and AIMS360 passwords do not work here yet; use one of the demo logins below.' });
    req.session.uid = u.id;
    res.json(publicUser(u));
  });
  app.post('/api/auth/logout', (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });
  app.get('/api/auth/me', (req, res) => res.json(publicUser(currentUser(req))));

  app.get('/api/images/:style/:file', (req, res) => {
    // Live data never gets a drawn stand-in picture.
    if (liveState().on) return res.type('image/svg+xml').send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 420"><text x="200" y="214" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="20" fill="#8b8799">No picture</text></svg>');
    const svg = styleImageSvg(req.params.style, req.params.file.replace(/\.svg$/, ''));
    if (!svg) return res.status(404).end();
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(svg);
  });

  app.use('/api/public', publicRoutes);
  app.use('/api/shop', shopRoutes);
  app.use('/api/buyer', buyerRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Errors from the AIMS360 provider come back as readable messages.
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong.' : err.message, code: err.code });
  });

  const dist = path.join(here, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedDemoHistory();
  const port = Number(process.env.PORT) || 3000;
  // With AIMS360 settings present, read live data at start and again every 10 minutes.
  if (restConfigured()) {
    const refresh = () => refreshFromRest()
      .then((s) => console.log(`AIMS360 live data: ${s.account} ${s.companyName} · ${s.styleColors} style-colors · ${s.customers} customers`))
      .catch((e) => console.error(`AIMS360 live data could not be read: ${e.message}`));
    refresh();
    setInterval(refresh, 10 * 60 * 1000).unref();
  }
  createApp().listen(port, () => console.log(`AIMS360 B2B portal on http://localhost:${port}`));
}
