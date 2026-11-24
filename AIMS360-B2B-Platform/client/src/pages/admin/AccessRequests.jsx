import { useEffect, useState } from 'react';
import { get, post, shortDate } from '../../api.js';

// Guests who asked for an account. Approve by connecting them to an existing
// AIMS360 customer or creating a new one; either way they get a buyer login.
export default function AccessRequests({ customers, onChange }) {
  const [rows, setRows] = useState([]);
  const [choice, setChoice] = useState({});
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');
  const load = () => get('/admin/access-requests').then(setRows);
  useEffect(() => { load(); }, []);
  const pending = rows.filter((r) => r.state === 'pending');

  const act = async (r, kind) => {
    setError('');
    try {
      if (kind === 'decline') await post(`/admin/access-requests/${r.id}/decline`);
      else {
        const pick = choice[r.id] || '';
        const out = await post(`/admin/access-requests/${r.id}/approve`, pick === '__new' ? { createCustomer: true } : { customerAccount: pick });
        setDone(out);
      }
      await load();
      onChange?.();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="card">
      <div className="spread"><h2>Access Requests</h2><span className={`pill ${pending.length ? 'warn' : ''}`}>{pending.length} Waiting</span></div>
      {done && (
        <div className="notice good" style={{ marginBottom: 12 }}>
          {done.buyer.email} is connected to {done.customerName}. Temporary password: <b>{done.tempPassword}</b>
          <div className="small">Shown once. The live version emails an invite link instead.</div>
        </div>
      )}
      {error && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      {pending.length === 0 ? <p className="muted" style={{ marginBottom: 0 }}>No requests waiting.</p> : pending.map((r) => (
        <div key={r.id} className="reqrow">
          <div className="grow">
            <div><b>{r.businessName}</b> {r.existingCustomer && <span className="pill dark">Existing Customer</span>}</div>
            <div className="small muted">{r.contactName} · {r.email}{r.phone ? ` · ${r.phone}` : ''}{r.city ? ` · ${r.city}${r.state ? ', ' + r.state : ''}` : ''} · {shortDate(r.requestedAt)}</div>
            {(r.accountHint || r.resaleNumber || r.message) && (
              <div className="small" style={{ marginTop: 4 }}>
                {r.accountHint && <>Account: {r.accountHint}. </>}{r.resaleNumber && <>Resale #: {r.resaleNumber}. </>}{r.message && <>“{r.message}”</>}
              </div>
            )}
          </div>
          <select value={choice[r.id] || ''} onChange={(e) => setChoice({ ...choice, [r.id]: e.target.value })} aria-label={`Connect ${r.businessName} to`} style={{ width: 250 }}>
            <option value="">Connect to…</option>
            <option value="__new">+ Create New Customer</option>
            {customers.map((c) => <option key={c.customerAccount} value={c.customerAccount}>{c.customerName} ({c.customerAccount})</option>)}
          </select>
          <button className="btn primary sm" disabled={!choice[r.id]} onClick={() => act(r, 'approve')}>Approve</button>
          <button className="btn ghost sm danger" onClick={() => act(r, 'decline')}>Decline</button>
        </div>
      ))}
    </div>
  );
}
