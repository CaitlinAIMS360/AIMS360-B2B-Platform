import { useEffect, useState } from 'react';
import { get } from '../api.js';
import { useCart } from '../cart.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CustomerPicker from '../components/CustomerPicker.jsx';

const none = { category: [], color: [], gender: [], fabric: [], division: [], group: [] };

function Facet({ title, name, options, picked, onToggle, startOpen }) {
  const [open, setOpen] = useState(!!startOpen || picked.length > 0);
  return (
    <div className="facet">
      <button type="button" className="facet-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}{picked.length > 0 && <span className="pill dark" style={{ marginLeft: 8 }}>{picked.length}</span>}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="facet-body">
          {options.map((o) => (
            <label key={o.name} className="facet-opt">
              <input type="checkbox" checked={picked.includes(o.name)} onChange={() => onToggle(name, o.name)} />
              <span className="grow">{o.name}</span>
              <span className="muted small">{o.count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Catalog({ role }) {
  const { cart, setField } = useCart();
  const customer = role === 'admin' ? cart.customerAccount : '';
  const [q, setQ] = useState('');
  const [season, setSeason] = useState('');
  const [avail, setAvail] = useState('');
  const [sort, setSort] = useState('style');
  const [status, setStatus] = useState('active');
  const [f, setF] = useState(none);
  const [data, setData] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams({ q, season, avail, sort, customer, category: f.category.join(','), color: f.color.join(','), gender: f.gender.join(','), fabric: f.fabric.join(','), division: f.division.join(','), group: f.group.join(','), status });
      get(`/shop/catalog?${p}`).then(setData);
    }, 150);
    return () => clearTimeout(t);
  }, [q, season, avail, sort, f, customer, status]);

  const toggle = (k, v) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const active = f.category.length + f.color.length + f.gender.length + f.fabric.length + f.division.length + f.group.length + (status !== 'active' ? 1 : 0) + (season ? 1 : 0) + (avail ? 1 : 0) + (q ? 1 : 0);
  const clear = () => { setF(none); setSeason(''); setAvail(''); setQ(''); setStatus('active'); };

  return (
    <div>
      <div className="eyebrow">Shop the Line</div>
      <h1>Catalog</h1>
      <p className="muted">{role === 'admin' ? 'Choose a customer to see their prices. Availability is live.' : 'Prices shown are your prices. Availability is live.'}</p>
      {role === 'admin' && (
        <div style={{ marginTop: 16 }}>
          <h3>Ordering For</h3>
          <CustomerPicker value={cart.customerAccount} onChange={(v) => setField('customerAccount', v)} compact />
        </div>
      )}
      <div className="shop">
        <aside className="card filterbar">
          <div className="spread" style={{ marginBottom: 6 }}>
            <h2 style={{ margin: 0 }}>Filters</h2>
            {active > 0 && <button className="btn ghost sm" onClick={clear}>Clear All</button>}
          </div>
          {data && (
            <>
              <Facet title="Collection" name="category" options={data.facets.categories} picked={f.category} onToggle={toggle} startOpen />
              <div className="facet">
                <div className="facet-head static">Season</div>
                <select value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Season">
                  <option value="">All seasons</option>
                  {data.facets.seasons.map((s) => <option key={s.code} value={s.code}>{s.description}</option>)}
                </select>
              </div>
              <div className="facet">
                <div className="facet-head static">Availability</div>
                <select value={avail} onChange={(e) => setAvail(e.target.value)} aria-label="Availability">
                  <option value="">Any availability</option>
                  <option value="now">In stock now</option>
                  <option value="future">Arriving later</option>
                </select>
              </div>
              {role === 'admin' && (
                <div className="facet">
                  <div className="facet-head static">Style Status</div>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Style status">
                    <option value="active">Active styles</option>
                    <option value="inactive">Inactive styles</option>
                    <option value="all">Active and inactive</option>
                  </select>
                </div>
              )}
              <Facet title="Division" name="division" options={data.facets.divisions} picked={f.division} onToggle={toggle} />
              <Facet title="Style Group" name="group" options={data.facets.groups} picked={f.group} onToggle={toggle} />
              <Facet title="Color" name="color" options={data.facets.colors} picked={f.color} onToggle={toggle} />
              <Facet title="Gender" name="gender" options={data.facets.genders} picked={f.gender} onToggle={toggle} />
              <Facet title="Fabric" name="fabric" options={data.facets.fabrics} picked={f.fabric} onToggle={toggle} />
            </>
          )}
        </aside>
        <div>
          <div className="shopbar">
            <input type="search" className="grow" placeholder="Search style, name or color" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" style={{ width: 210 }}>
              <option value="style">Style: A–Z</option>
              <option value="name">Name: A–Z</option>
              <option value="priceLow">Price: Low to High</option>
              <option value="priceHigh">Price: High to Low</option>
            </select>
          </div>
          {data && <p className="small muted">Showing {data.items.length} of {data.total} styles</p>}
          {data && data.items.length === 0 && <p className="muted">No styles match those filters.</p>}
          <div className="products">
            {data?.items.map((s) => <ProductCard key={s.style} s={s} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
