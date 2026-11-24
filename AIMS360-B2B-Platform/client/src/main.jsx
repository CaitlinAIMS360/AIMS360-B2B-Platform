import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import '@fontsource-variable/montserrat';
import './styles.css';
import { get, post } from './api.js';
import { CartProvider, useCart } from './cart.jsx';
import { setBrand, useTheme, ThemeToggle, Wordmark } from './theme.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import StylePage from './pages/StylePage.jsx';
import Cart from './pages/Cart.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Invoices from './pages/Invoices.jsx';
import Linesheets from './pages/Linesheets.jsx';
import LinesheetView from './pages/LinesheetView.jsx';
import LinesheetEdit from './pages/LinesheetEdit.jsx';
import OtsReport from './pages/OtsReport.jsx';
import Guest from './pages/Guest.jsx';
import QuickOrder from './pages/QuickOrder.jsx';
import Connect, { DataBanner } from './pages/admin/Connect.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminOrders from './pages/admin/Orders.jsx';
import AdminBuyers from './pages/admin/Buyers.jsx';
import AdminSettings from './pages/admin/Settings.jsx';
import AdminReports from './pages/admin/Reports.jsx';

function Shell({ config, user, onLogout, theme, children }) {
  const cart = useCart();
  const nav = useNavigate();
  const link = ({ isActive }) => (isActive ? 'active' : '');
  return (
    <>
      <DataBanner config={config} admin={user.role === 'admin'} />
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" aria-label="Home"><Wordmark sub={user.role === 'admin' ? 'Brand Admin' : 'B2B Wholesale'} /></Link>
          {user.role === 'buyer' ? (
            <nav className="nav">
              <NavLink to="/" end className={link}>Home</NavLink>
              <NavLink to="/catalog" className={link}>Catalog</NavLink>
              <NavLink to="/quick-order" className={link}>Quick Order</NavLink>
              <NavLink to="/linesheets" className={link}>Linesheets</NavLink>
              <NavLink to="/orders" className={link}>My Orders</NavLink>
              <NavLink to="/invoices" className={link}>Invoices & Credits</NavLink>
            </nav>
          ) : (
            <nav className="nav">
              <NavLink to="/" end className={link}>Dashboard</NavLink>
              <NavLink to="/catalog" className={link}>Catalog</NavLink>
              <NavLink to="/quick-order" className={link}>Quick Order</NavLink>
              <NavLink to="/linesheets" className={link}>Linesheets</NavLink>
              <NavLink to="/admin/orders" className={link}>Orders</NavLink>
              <NavLink to="/admin/reports" className={link}>Reports</NavLink>
              <NavLink to="/admin/buyers" className={link}>Buyers</NavLink>
              <NavLink to="/admin/settings" className={link}>Settings</NavLink>
            </nav>
          )}
          <div className="row">
            <button className="btn primary sm" onClick={() => nav('/cart')}>
              {user.role === 'admin' ? 'New Order' : 'Cart'}{cart.units ? ` · ${cart.units}` : ''}
            </button>
            <ThemeToggle {...theme} />
            <span className="user-chip" title={`${user.name} · ${config.brandName}`}>
              <span className="avatar" aria-hidden="true">{user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
              <span className="name">{user.name}</span>
            </span>
            <button className="btn ghost sm" onClick={onLogout}>Sign Out</button>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

function App() {
  const [config, setConfig] = useState(null);
  const [user, setUser] = useState(undefined);
  const nav = useNavigate();
  const theme = useTheme();
  const loc = useLocation();

  useEffect(() => {
    get('/config').then((c) => {
      setConfig(c);
      setBrand({ logo: c.logo, logoDark: c.logoDark, name: c.brandName });
      document.documentElement.style.setProperty('--accent', c.accentColor);
    });
    get('/auth/me').then(setUser).catch(() => setUser(null));
  }, []);

  if (!config || user === undefined) return null;
  if (!user) {
    const guestPath = loc.pathname.startsWith('/browse') || loc.pathname === '/request-access';
    if (guestPath && config.guestBrowsing) return <Guest config={config} theme={theme} />;
    return <Login config={config} onLogin={(u) => { nav('/', { replace: true }); setUser(u); }} theme={theme} />;
  }

  const logout = async () => {
    await post('/auth/logout');
    nav('/', { replace: true });
    setUser(null);
  };

  return (
    <CartProvider userId={user.id}>
      <Shell config={config} user={user} onLogout={logout} theme={theme}>
        {user.role === 'buyer' ? (
          <Routes>
            <Route path="/" element={<Home config={config} user={user} />} />
            <Route path="/catalog" element={<Catalog role="buyer" />} />
            <Route path="/catalog/:style" element={<StylePage role="buyer" />} />
            <Route path="/cart" element={<Cart config={config} role="buyer" />} />
            <Route path="/ots-report" element={<OtsReport role="buyer" />} />
            <Route path="/quick-order" element={<QuickOrder role="buyer" />} />
            <Route path="/linesheets" element={<Linesheets role="buyer" />} />
            <Route path="/linesheets/:id" element={<LinesheetView role="buyer" />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail role="buyer" />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/catalog" element={<Catalog role="admin" />} />
            <Route path="/catalog/:style" element={<StylePage role="admin" />} />
            <Route path="/cart" element={<Cart config={config} role="admin" />} />
            <Route path="/ots-report" element={<OtsReport role="admin" />} />
            <Route path="/quick-order" element={<QuickOrder role="admin" />} />
            <Route path="/linesheets" element={<Linesheets role="admin" />} />
            <Route path="/linesheets/new" element={<LinesheetEdit />} />
            <Route path="/linesheets/:id" element={<LinesheetView role="admin" />} />
            <Route path="/linesheets/:id/edit" element={<LinesheetEdit />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/orders/:id" element={<OrderDetail role="admin" />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/connect" element={<Connect onChange={() => get('/config').then(setConfig)} />} />
            <Route path="/admin/buyers" element={<AdminBuyers />} />
            <Route path="/admin/settings" element={<AdminSettings onSaved={(s) => {
              setConfig((c) => ({ ...c, brandName: s.brandName, accentColor: s.accentColor }));
              setBrand({ logo: s.logo, logoDark: s.logoDark, name: s.brandName });
              document.documentElement.style.setProperty('--accent', s.accentColor);
            }} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Shell>
    </CartProvider>
  );
}

// As a Claude artifact the portal has no web address of its own to route on.
const PageRouter = import.meta.env.MODE === 'artifact' ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <PageRouter>
    <App />
  </PageRouter>
);
