import { useEffect, useState } from 'react';
import { get, post, patch } from '../../api.js';
import AccessRequests from './AccessRequests.jsx';

export default function Buyers() {
  const [buyers, setBuyers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', customerAccount: '' });
  const [error, setError] = useState('');
  const [invited, setInvited] = useState(null);

  const load = () => get('/admin/buyers').then(setBuyers);
  useEffect(() => {
    load();
    get('/admin/customers').then(setCustomers);
  }, []);

  const invite = async (e) => {
    e.preventDefault();
    setError('');
    setInvited(null);
    try {
      setInvited(await post('/admin/buyers', form));
      setForm({ name: '', email: '', customerAccount: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="stack">
      <div>
        <h1>Buyers</h1>
        <p className="muted">Each buyer login is tied to one AIMS360 customer account and only sees that customer's prices, orders and invoices.</p>
      </div>
      <AccessRequests customers={customers} onChange={() => { load(); get('/admin/customers').then(setCustomers); }} />
      <form className="card" onSubmit={invite}>
        <h2>Invite a Buyer</h2>
        <div className="grid cols-4" style={{ alignItems: 'end' }}>
          <div><label htmlFor="bn">Name</label><input id="bn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label htmlFor="be">Email</label><input id="be" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div>
            <label htmlFor="bc">Customer account</label>
            <select id="bc" value={form.customerAccount} onChange={(e) => setForm({ ...form, customerAccount: e.target.value })} required>
              <option value="">Choose a customer</option>
              {customers.map((c) => <option key={c.customerAccount} value={c.customerAccount}>{c.customerName} ({c.customerAccount})</option>)}
            </select>
          </div>
          <button className="btn primary">Create Login</button>
        </div>
        {error && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        {invited && (
          <div className="notice good" style={{ marginTop: 12 }}>
            Login created for {invited.buyer.email}. Temporary password: <b>{invited.tempPassword}</b>
            <div className="small">Shown once. The live version emails an invite link instead.</div>
          </div>
        )}
      </form>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Buyer</th><th>Email</th><th>Customer</th><th>Status</th><th /></tr></thead>
            <tbody>
              {buyers.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.name}</b></td>
                  <td>{b.email}</td>
                  <td>{b.customerName} <span className="muted small">({b.customerAccount})</span></td>
                  <td>{b.active ? <span className="pill good">Active</span> : <span className="pill">Disabled</span>}</td>
                  <td className="right">
                    <button className="btn sm" onClick={() => patch(`/admin/buyers/${b.id}`, { active: !b.active }).then(load)}>
                      {b.active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
