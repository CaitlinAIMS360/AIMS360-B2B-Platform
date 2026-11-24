import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, get, post, put } from '../api.js';
import { ConfirmButton } from '../components/bits.jsx';
import ImagePicker from '../components/ImagePicker.jsx';

const blank = { name: '', description: '', season: '', active: true, customerAccounts: [], layout: [], hero: '' };
let nextDivider = 1;

export default function LinesheetEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [l, setL] = useState(id ? null : blank);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    get('/shop/catalog').then(setCatalog);
    get('/shop/customers').then((d) => setCustomers(d.customers));
    if (id) get(`/shop/linesheets/${id}`).then((x) => setL({ ...blank, ...x, hero: x.hero || '' }));
  }, [id]);

  const picked = useMemo(() => new Set((l?.layout || []).filter((x) => x.type === 'style').map((x) => x.style)), [l]);
  const shown = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (catalog?.items || []).filter((s) => (!l?.season || s.season === l.season || picked.has(s.style)) && (!t || s.style.toLowerCase().includes(t) || s.description.toLowerCase().includes(t)));
  }, [catalog, q, l, picked]);

  if (!l || !catalog) return null;
  const set = (k, v) => setL((x) => ({ ...x, [k]: v }));
  const toggle = (k, v) => set(k, l[k].includes(v) ? l[k].filter((x) => x !== v) : [...l[k], v]);
  const setLayout = (fn) => setL((x) => ({ ...x, layout: fn(x.layout) }));

  // Clicking a style adds it to the end of the linesheet, or takes it off.
  const toggleStyle = (style) => setLayout((a) => (a.some((x) => x.style === style) ? a.filter((x) => x.style !== style) : [...a, { type: 'style', style }]));
  const addDivider = () => setLayout((a) => [...a, { type: 'divider', id: `new-${nextDivider++}`, title: '', note: '' }]);
  const move = (i, by) => setLayout((a) => {
    const j = i + by;
    if (j < 0 || j >= a.length) return a;
    const b = a.slice();
    [b[i], b[j]] = [b[j], b[i]];
    return b;
  });
  const removeAt = (i) => setLayout((a) => a.filter((_, j) => j !== i));
  const edit = (i, k, v) => setLayout((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const styleOf = (code) => catalog.items.find((s) => s.style === code);

  const save = async () => {
    setError('');
    try {
      const layout = l.layout.map((x) => (x.type === 'divider' ? { type: 'divider', id: String(x.id).startsWith('new-') ? undefined : x.id, title: x.title, note: x.note } : x));
      const body = { name: l.name, description: l.description, season: l.season, active: l.active, customerAccounts: l.customerAccounts, layout, hero: l.hero };
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
  const dividers = l.layout.filter((x) => x.type === 'divider').length;

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
      <div className="grid pair">
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
        <div className="stack">
          <div className="card">
            <h2>Hero Image</h2>
            <ImagePicker label="Hero Image" value={l.hero} onChange={(v) => set('hero', v)} previewClass="hero" options={{ maxW: 1600, maxH: 900, type: 'image/jpeg', quality: 0.82 }}
              help="A wide photo works best. It shows across the top of the linesheet, on the linesheet's card, and on the PDF." />
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
      </div>

      <div className="card">
        <div className="spread">
          <h2>Linesheet Order <span className="pill dark" style={{ marginLeft: 8 }}>{picked.size} Styles</span>{dividers > 0 && <span className="pill" style={{ marginLeft: 6 }}>{dividers} Divider{dividers > 1 ? 's' : ''}</span>}</h2>
          <button type="button" className="btn" onClick={addDivider}>Add Divider</button>
        </div>
        <p className="small muted">Add a divider for each drop or delivery, then use the arrows to put it above the styles that belong to it. Everything under a divider belongs to that drop until the next divider.</p>
        {l.layout.length === 0 && <p className="muted">Nothing here yet. Choose styles below to start.</p>}
        <div className="layoutlist">
          {l.layout.map((x, i) => {
            const s = x.type === 'style' ? styleOf(x.style) : null;
            const moves = (
              <span className="moves">
                <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" title="Move up">↑</button>
                <button type="button" className="btn sm" disabled={i === l.layout.length - 1} onClick={() => move(i, 1)} aria-label="Move down" title="Move down">↓</button>
                <button type="button" className="btn ghost sm danger" onClick={() => removeAt(i)} aria-label="Remove" title="Remove">✕</button>
              </span>
            );
            return x.type === 'divider' ? (
              <div key={x.id} className="layoutrow divider">
                <span className="tag">Divider</span>
                <input value={x.title} onChange={(e) => edit(i, 'title', e.target.value)} placeholder="Title, for example Drop 1" maxLength={60} aria-label="Divider title" />
                <input value={x.note} onChange={(e) => edit(i, 'note', e.target.value)} placeholder="Note, for example Ships January 15" maxLength={120} aria-label="Divider note" />
                {moves}
              </div>
            ) : (
              <div key={x.style} className="layoutrow">
                {s && <img src={s.colors[0].image} alt="" />}
                <span className="grow"><b>{s?.description || x.style}</b><span className="muted small" style={{ display: 'block' }}>{x.style}{s ? ` · ${s.season}` : ''}</span></span>
                {moves}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <h2>Choose Styles</h2>
          <input type="search" style={{ maxWidth: 300 }} placeholder="Search styles" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search styles" />
        </div>
        <p className="small muted">Click a style to add it to the end of the linesheet. Click it again to take it off.</p>
        <div className="stylepick">
          {shown.map((s) => {
            const on = picked.has(s.style);
            return (
              <button key={s.style} type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggleStyle(s.style)}>
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
