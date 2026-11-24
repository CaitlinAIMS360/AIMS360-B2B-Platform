import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api.js';

export default function Linesheets({ role }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { get('/shop/linesheets').then(setRows); }, []);
  if (!rows) return null;
  return (
    <div>
      <div className="spread">
        <div>
          <div className="eyebrow">Curated Collections</div>
          <h1>Linesheets</h1>
          <p className="muted">{role === 'admin' ? 'Build linesheets and choose which customers can see them.' : 'Collections your brand has put together for you.'}</p>
        </div>
        <div className="row">
          <Link to="/ots-report" className="btn">Build OTS Report</Link>
          {role === 'admin' && <Link to="/linesheets/new" className="btn primary">New Linesheet</Link>}
        </div>
      </div>
      {rows.length === 0 && <p className="muted" style={{ marginTop: 20 }}>No linesheets yet.</p>}
      <div className="sheets">
        {rows.map((l) => (
          <Link key={l.id} to={`/linesheets/${l.id}`} className="sheet">
            {l.hero ? <div className="cover hero"><img src={l.hero} alt="" loading="lazy" /></div> : <div className="cover">{l.cover.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}</div>}
            <div className="body">
              <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                {l.seasonName && <span className="pill dark">{l.seasonName}</span>}
                {role === 'admin' && (l.active ? <span className="pill good">Active</span> : <span className="pill">Hidden</span>)}
                {role === 'admin' && <span className="pill">{l.customerAccounts.length ? `${l.customerAccounts.length} Customer${l.customerAccounts.length > 1 ? 's' : ''}` : 'All Customers'}</span>}
              </div>
              <div className="name">{l.name}</div>
              <div className="small muted">{l.styleCount} styles{l.dropCount > 0 && ` · ${l.dropCount} drop${l.dropCount > 1 ? 's' : ''}`}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
