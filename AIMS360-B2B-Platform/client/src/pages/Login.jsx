import { useState } from 'react';
import { Link } from 'react-router-dom';
import { post } from '../api.js';
import { ThemeToggle, Wordmark } from '../theme.jsx';

export default function Login({ config, onLogin, theme }) {
  const [portal, setPortal] = useState('buyer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await post('/auth/login', { email, password, portal }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const demo = (em, pw, p) => {
    setPortal(p);
    setEmail(em);
    setPassword(pw);
  };

  return (
    <div className="login">
      <div className="login-art">
        <Link to="/" aria-label="Home"><Wordmark onDark /></Link>
        <div>
          <div className="eyebrow">Wholesale Ordering</div>
          <h1>Your line, live. Order in minutes.</h1>
          <p>
            Browse the collection with your own prices and real-time availability, then place Immediate, Prebook or Bulk orders straight into AIMS360.
          </p>
        </div>
        <div className="login-points">
          <span>Live Inventory</span>
          <span>Your Pricing</span>
          <span>Size-Grid Ordering</span>
          <span>{config.brandName}</span>
        </div>
      </div>
      <div className="login-form">
        <div className="theme-corner"><ThemeToggle {...theme} /></div>
        <form className="card" onSubmit={submit}>
          <div style={{ marginBottom: 22 }}><Link to="/" aria-label="Home"><Wordmark /></Link></div>
          <h2>Sign In</h2>
          <div className="tabs" role="tablist">
            <button type="button" className={portal === 'buyer' ? 'on' : ''} onClick={() => setPortal('buyer')}>Retail Buyer</button>
            <button type="button" className={portal === 'admin' ? 'on' : ''} onClick={() => setPortal('admin')}>Brand Admin</button>
          </div>
          {portal === 'admin' && (
            <p className="small muted">Runway sign-in is not connected yet. For now, click Admin under Demo logins below, then Sign In.</p>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="notice bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Signing In…' : 'Sign In'}
          </button>
          {config.guestBrowsing && (
            <div className="guest-cta small muted">
              New here? <Link to="/browse"><b style={{ color: 'var(--accent-text)' }}>Browse the Collection</b></Link> or <Link to="/request-access"><b style={{ color: 'var(--accent-text)' }}>Request Access</b></Link>
            </div>
          )}
          {config.mode === 'demo' && (
            <div className="small muted" style={{ marginTop: 18 }}>
              <div style={{ marginBottom: 6 }}>Demo logins (click one, then Sign In):</div>
              <div className="row">
                <button type="button" className="btn sm" onClick={() => demo('buyer@aimscaitlin.test', 'buyer1234', 'buyer')}>Buyer (Key Account)</button>
                <button type="button" className="btn sm" onClick={() => demo('buyer@activewear.test', 'buyer1234', 'buyer')}>Buyer (Near Credit Limit)</button>
                <button type="button" className="btn sm" onClick={() => demo('admin@aims360.test', 'admin1234', 'admin')}>Admin</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
