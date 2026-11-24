import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, get, post, put } from '../api.js';
import { ConfirmButton } from '../components/bits.jsx';

export default function LinesheetEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [l, setL] = useState(id ? null : { name: '', description: '', season: '', active: true, customerAccounts: [], styles: [] });
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    get('/shop/catalog').then(setCatalog);
    get('/shop/customers').then((d) => setCustomers(d.customers));
    if (id) get(`/shop/linesheets/${id}`).then(setL);
  }, [id]);

  const shown = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (catalog?.items || []).filter((s) => (!l?.season || s.season === l.season || l.styles.includes(s.style)) && (!t || s.style.toLowerCase().includes(t) || s.description.toLowerCase().includes(t)));
  }, [catalog, q, l]);

  if (!l || !catalog) return null;
  const set = (k, v) => setL((x) => ({ ...x, [k]: v }));
  const toggle = (k, v) => set(k, l[k].includes(v) ? l[k].filter((x) => x !== v) : [...l[k], v]);

  const save = async () => {
    setError('');
    try {
      const body = { name: l.name, description: l.description, season: l.season, active: l.active, customerAccounts: l.customerAccounts, styles: l.styles };
      const out = id ? await put(`/admin/linesheets/${id}`, body) : await post('/admin/linesheets', body);
      nav(`/linesheets/${out.id}`);
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async () => {
    await api('DELETE', `/admin/linesheets/${id}`);
    nav('/linesheets');
  };

  return (
    <div className="stack">
      <p className="small"><Link to="/linesheets" className="muted">← Linesheets</Link></p>
      <div className="spread">
        <h1>{id ? 'Edit Linesheet' : 'New Linesheet'}</h1>
        <div className="row">
          {id && <ConfirmButton label="Delete" confirmLabel="Yes, Delete Linesheet" onConfirm={remove} />}
          <button className="btn primary" onClick={save}>Save Linesheet</button>
        </div>
      </div>
      {error && <div className="notice bad" role="alert">{error}</div>}
      <div className="grid cols-2">
        <div className="card">
          <h2>Details</h2>
          <div className="field"><label htmlFor="ls-name">Name</label><input id="ls-name" value={l.name} onChange={(e) => set('name', e.target.value)} maxLength={80} /></div>
          <div className="field">
            <label htmlFor="ls-season">Season</label>
            <select id="ls-season" value={l.season} onChange={(e) => set('season', e.target.value)}>
              <option value="">Any season</option>
              {catalog.facets.seasons.map((s) => <option key={s.code} value={s.code}>{s.description}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="ls-desc">Description</label><textarea id="ls-desc" rows={3} value={l.description} onChange={(e) => set('description', e.target.value)} maxLength={600} /></div>
          <label className="check"><input type="checkbox" checked={l.active} onChange={(e) => set('active', e.target.checked)} /><span>Active<span className="muted small" style={{ display: 'block', fontWeight: 400 }}>Buyers only see active linesheets.</span></span></label>
        </div>
        <div className="card">
          <h2>Who Can See It</h2>
          <label className="check" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={l.customerAccounts.length === 0} onChange={() => set('customerAccounts', [])} />
            <span>All Customers</span>
          </label>
          <h3>Or Only These Customers</h3>
          {customers.map((c) => (
            <label key={c.customerAccount} className="check" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={l.customerAccounts.includes(c.customerAccount)} onChange={() => toggle('customerAccounts', c.customerAccount)} />
              <span>{c.customerName} <span className="muted small">{c.customerAccount}</span></span>
            </label>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="spread">
          <h2>Styles <span className="pill dark" style={{ marginLeft: 8 }}>{l.styles.length} Selected</span></h2>
          <input type="search" style={{ maxWidth: 300 }} placeholder="Search styles" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search styles" />
        </div>
        <div className="stylepick">
          {shown.map((s) => {
            const on = l.styles.includes(s.style);
            return (
              <button key={s.style} type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggle('styles', s.style)}>
                <img src={s.colors[0].image} alt="" loading="lazy" />
                <span className="code">{s.style}</span>
                <span className="name">{s.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
