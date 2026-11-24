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
import buyerRoutes from './routes/buyer.js';
import adminRoutes from './routes/admin.js';
import shopRoutes from './routes/shop.js';
import publicRoutes from './routes/public.js';

const here = path.dirname(fileURLToPath(import.meta.url));

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
      accentColor: settings.accentColor,
      mode: getProvider().mode,
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
    if (!u) return res.status(401).json({ error: 'That email and password do not match.' });
    req.session.uid = u.id;
    res.json(publicUser(u));
  });
  app.post('/api/auth/logout', (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });
  app.get('/api/auth/me', (req, res) => res.json(publicUser(currentUser(req))));

  app.get('/api/images/:style/:file', (req, res) => {
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
  createApp().listen(port, () => console.log(`AIMS360 B2B portal on http://localhost:${port}`));
}
