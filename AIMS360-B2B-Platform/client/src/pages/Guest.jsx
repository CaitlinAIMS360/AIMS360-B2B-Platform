import { useEffect, useState } from 'react';
import { Link, NavLink, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { get, post, money } from '../api.js';
import { ThemeToggle, Wordmark } from '../theme.jsx';
import { DataBanner } from './admin/Connect.jsx';
import LinesheetBody, { LinesheetHeading } from '../components/LinesheetBody.jsx';
import ProductCard from '../components/ProductCard.jsx';

function GuestCatalog() {
  const [q, setQ] = useState('');
  const [season, setSeason] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('style');
  const [data, setData] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => get(`/public/catalog?${new URLSearchParams({ q, season, category, sort })}`).then(setData), 150);
    return () => clearTimeout(t);
  }, [q, season, category, sort]);
  return (
    <div>
      <div className="eyebrow">Browse the Collection</div>
      <h1>Catalog</h1>
      <p className="muted">You're browsing as a guest. Request access to see your pricing and availability, and to place orders.</p>
      <div className="shopbar" style={{ marginTop: 20 }}>
        <input type="search" className="grow" placeholder="Search style, name or color" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Collection" style={{ width: 200 }}>
          <option value="">All Collections</option>
          {data?.facets.categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
        </select>
        <select value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Season" style={{ width: 180 }}>
          <option value="">All Seasons</option>
          {data?.facets.seasons.map((s) => <option key={s.code} value={s.code}>{s.description}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" style={{ width: 170 }}>
          <option value="style">Style: A–Z</option>
          <option value="name">Name: A–Z</option>
        </select>
      </div>
      {data && <p className="small muted">Showing {data.items.length} of {data.total} styles</p>}
      <div className="products">{data?.items.map((s) => <ProductCard key={s.style} s={s} base="/browse/style" guest />)}</div>
    </div>
  );
}

function GuestStyle() {
  const { style } = useParams();
  const [s, setS] = useState(null);
  const [active, setActive] = useState(0);
  useEffect(() => { get(`/public/catalog/${style}`).then(setS); }, [style]);
  if (!s) return null;
  return (
    <div>
      <p className="small"><Link to="/browse" className="muted">← Catalog</Link></p>
      <div className="style-layout">
        <div>
          <img className="hero-img" src={s.colors[active].image} alt={`${s.description} in ${s.colors[active].colorDescription}`} />
          <div className="thumbs">
            {s.colors.map((c, i) => <button key={c.color} className={i === active ? 'on' : ''} onClick={() => setActive(i)} aria-label={c.colorDescription}><img src={c.image} alt="" /></button>)}
          </div>
        </div>
        <div className="stack">
          <div>
            <div className="eyebrow">{s.style} · {s.category} · {s.season}</div>
            <h1>{s.description}</h1>
            <p className="muted">{s.gender} · {s.fabric}</p>
            {(s.price != null || s.retail != null) && (
              <div style={{ fontSize: 22 }}>{s.price != null && <b>{money(s.price)} </b>}{s.retail != null && <span className="small muted">MSRP {money(s.retail)}</span>}</div>
            )}
          </div>
          <div className="card flat">
            <h3>Colors</h3>
            <div className="row">{s.colors.map((c, i) => <button key={c.color} className={`btn sm ${i === active ? 'primary' : ''}`} onClick={() => setActive(i)}><span className="swatch" style={{ background: c.hex }} />{c.colorDescription}</button>)}</div>
            <h3 style={{ marginTop: 18 }}>Sizes</h3>
            <div className="row">{s.colors[active].sizes.map((z) => <span key={z.sizeName} className="pill">{z.sizeName}</span>)}</div>
          </div>
          <div className="card">
            <h2>Want to Order This?</h2>
            <p className="muted">Wholesale pricing, live availability and ordering are for approved accounts.</p>
            <div className="row"><Link to="/request-access" className="btn primary">Request Access</Link><Link to="/" className="btn">Sign In</Link></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuestLinesheets() {
  const [rows, setRows] = useState(null);
  useEffect(() => { get('/public/linesheets').then(setRows); }, []);
  if (!rows) return null;
  return (
    <div>
      <div className="eyebrow">Curated Collections</div>
      <h1>Linesheets</h1>
      <div className="sheets">
        {rows.map((l) => (
          <Link key={l.id} to={`/browse/linesheets/${l.id}`} className="sheet">
            {l.hero ? <div className="cover hero"><img src={l.hero} alt="" loading="lazy" /></div> : <div className="cover">{l.cover.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}</div>}
            <div className="body">
              {l.seasonName && <span className="pill dark" style={{ marginBottom: 6 }}>{l.seasonName}</span>}
              <div className="name">{l.name}</div>
              <div className="small muted">{l.styleCount} styles</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function GuestLinesheet() {
  const { id } = useParams();
  const [l, setL] = useState(null);
  useEffect(() => { get(`/public/linesheets/${id}`).then(setL).catch(() => setL(false)); }, [id]);
  if (l === false) return <Navigate to="/browse/linesheets" replace />;
  if (!l) return null;
  return (
    <div>
      <p className="small"><Link to="/browse/linesheets" className="muted">← Linesheets</Link></p>
      <LinesheetHeading l={l} />
      <LinesheetBody l={l} base="/browse/style" guest />
    </div>
  );
}

const blank = { businessName: '', contactName: '', email: '', phone: '', address1: '', city: '', state: '', zipCode: '', existingCustomer: false, accountHint: '', resaleNumber: '', message: '' };

function RequestAccess() {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await post('/public/access-requests', form); setSent(true); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  if (sent) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
        <h1>Request Sent</h1>
        <p className="muted">The brand will review your request and email your login once your account is connected.</p>
        <Link to="/browse" className="btn primary">Keep Browsing</Link>
      </div>
    );
  }
  return (
    <form className="card" style={{ maxWidth: 720, margin: '0 auto' }} onSubmit={submit}>
      <div className="eyebrow">Wholesale Accounts</div>
      <h1>Request Access</h1>
      <p className="muted">Tell us about your business. Once approved, you'll get a login with your pricing, live availability and ordering.</p>
      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <div className="field"><label htmlFor="ra-biz">Business Name</label><input id="ra-biz" {...f('businessName')} required /></div>
        <div className="field"><label htmlFor="ra-name">Your Name</label><input id="ra-name" {...f('contactName')} required /></div>
        <div className="field"><label htmlFor="ra-email">Email</label><input id="ra-email" type="email" {...f('email')} required /></div>
        <div className="field"><label htmlFor="ra-phone">Phone</label><input id="ra-phone" {...f('phone')} /></div>
        <div className="field"><label htmlFor="ra-addr">Address</label><input id="ra-addr" {...f('address1')} /></div>
        <div className="field"><label htmlFor="ra-city">City</label><input id="ra-city" {...f('city')} /></div>
        <div className="field"><label htmlFor="ra-state">State</label><input id="ra-state" {...f('state')} maxLength={2} style={{ textTransform: 'uppercase' }} /></div>
        <div className="field"><label htmlFor="ra-zip">Zip Code</label><input id="ra-zip" {...f('zipCode')} /></div>
        <div className="field"><label htmlFor="ra-resale">Resale Certificate Number (Optional)</label><input id="ra-resale" {...f('resaleNumber')} /></div>
      </div>
      <label className="check" style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={form.existingCustomer} onChange={(e) => setForm({ ...form, existingCustomer: e.target.checked })} />
        <span>We already buy from this brand<span className="muted small" style={{ display: 'block', fontWeight: 400 }}>We'll connect your login to your existing account.</span></span>
      </label>
      {form.existingCustomer && <div className="field"><label htmlFor="ra-hint">Account Name or Number, if You Know It</label><input id="ra-hint" {...f('accountHint')} /></div>}
      <div className="field"><label htmlFor="ra-msg">Anything Else? (Optional)</label><textarea id="ra-msg" rows={3} {...f('message')} /></div>
      {error && <div className="notice bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send Request'}</button>
    </form>
  );
}

export default function Guest({ config, theme }) {
  const link = ({ isActive }) => (isActive ? 'active' : '');
  return (
    <>
      <DataBanner config={config} />
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/browse" aria-label="Catalog"><Wordmark /></Link>
          <nav className="nav">
            <NavLink to="/browse" end className={link}>Catalog</NavLink>
            <NavLink to="/browse/linesheets" className={link}>Linesheets</NavLink>
          </nav>
          <div className="row">
            <span className="pill">Guest</span>
            <ThemeToggle {...theme} />
            <Link to="/" className="btn sm">Sign In</Link>
            <Link to="/request-access" className="btn primary sm">Request Access</Link>
          </div>
        </div>
      </header>
      <main className="page">
        <Routes>
          <Route path="/browse" element={<GuestCatalog />} />
          <Route path="/browse/style/:style" element={<GuestStyle />} />
          <Route path="/browse/linesheets" element={<GuestLinesheets />} />
          <Route path="/browse/linesheets/:id" element={<GuestLinesheet />} />
          <Route path="/request-access" element={<RequestAccess />} />
        </Routes>
      </main>
    </>
  );
}
