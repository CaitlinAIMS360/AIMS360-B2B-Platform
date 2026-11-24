import { useEffect, useMemo, useState } from 'react';
import { get, post, money } from '../api.js';

const blank = { customerName: '', customerAccount: '', buyerName: '', email: '', phone: '', address1: '', city: '', state: '', zipCode: '', terms: 'NET 30', creditLimit: '' };

// Brand admins pick the AIMS360 customer an order is for, or add a new one.
export default function CustomerPicker({ value, onChange, compact }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => get('/shop/customers').then(setData);
  useEffect(() => { load(); }, []);

  const selected = data?.customers.find((c) => c.customerAccount === value) || null;
  const matches = useMemo(() => {
    const t = q.toLowerCase().trim();
    return (data?.customers || [])
      .filter((c) => !t || c.customerName.toLowerCase().includes(t) || c.customerAccount.toLowerCase().includes(t) || c.city.toLowerCase().includes(t))
      .slice(0, 8);
  }, [data, q]);

  const pick = (c) => { onChange(c.customerAccount); setOpen(false); setQ(''); };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const c = await post('/shop/customers', form);
      await load();
      onChange(c.customerAccount);
      setAdding(false);
      setOpen(false);
      setForm(blank);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  if (!data) return null;

  if (adding) {
    return (
      <form onSubmit={create} className="newcust">
        <div className="spread" style={{ marginBottom: 14 }}>
          <b>New Customer</b>
          <span className="small muted">Creates the customer in AIMS360</span>
        </div>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="nc-name">Customer Name</label><input id="nc-name" {...f('customerName')} required maxLength={60} autoFocus /></div>
          <div className="field"><label htmlFor="nc-acct">Account Code (Optional)</label><input id="nc-acct" {...f('customerAccount')} maxLength={5} placeholder="Auto" style={{ textTransform: 'uppercase' }} /></div>
          <div className="field"><label htmlFor="nc-buyer">Buyer Name</label><input id="nc-buyer" {...f('buyerName')} maxLength={40} /></div>
          <div className="field"><label htmlFor="nc-email">Email</label><input id="nc-email" type="email" {...f('email')} /></div>
          <div className="field"><label htmlFor="nc-phone">Phone</label><input id="nc-phone" {...f('phone')} maxLength={30} /></div>
          <div className="field"><label htmlFor="nc-addr">Address</label><input id="nc-addr" {...f('address1')} /></div>
          <div className="field"><label htmlFor="nc-city">City</label><input id="nc-city" {...f('city')} /></div>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <div className="field" style={{ width: 90 }}><label htmlFor="nc-state">State</label><input id="nc-state" {...f('state')} maxLength={2} style={{ textTransform: 'uppercase' }} /></div>
            <div className="field grow"><label htmlFor="nc-zip">Zip Code</label><input id="nc-zip" {...f('zipCode')} maxLength={10} /></div>
          </div>
          <div className="field">
            <label htmlFor="nc-terms">Payment Terms</label>
            <select id="nc-terms" {...f('terms')}>{data.terms.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="field"><label htmlFor="nc-limit">Credit Limit ($, Optional)</label><input id="nc-limit" type="number" min="0" {...f('creditLimit')} placeholder="No limit" /></div>
        </div>
        {error && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="row">
          <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create Customer'}</button>
          <button type="button" className="btn ghost" onClick={() => { setAdding(false); setError(''); }}>Cancel</button>
        </div>
      </form>
    );
  }

  if (selected && !open) {
    return (
      <div className={`custchip ${compact ? 'compact' : ''}`}>
        <span className="avatar" aria-hidden="true">{selected.customerName.slice(0, 2).toUpperCase()}</span>
        <div className="grow">
          <div><b>{selected.customerName}</b> <span className="small muted">{selected.customerAccount}</span></div>
          <div className="small muted">
            {[selected.city && `${selected.city}${selected.state ? ', ' + selected.state : ''}`, selected.terms, selected.priceSheet ? `${selected.priceSheet} Pricing` : 'Wholesale Pricing',
              selected.credit.available === null ? 'No Credit Limit' : `${money(selected.credit.available)} Credit Available`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button type="button" className="btn sm" onClick={() => setOpen(true)}>Change</button>
      </div>
    );
  }

  return (
    <div className="custpick">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="search" className="grow" placeholder="Search AIMS360 customers by name, account or city" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" autoFocus={open} />
        <button type="button" className="btn" onClick={() => setAdding(true)}>+ New Customer</button>
      </div>
      <div className="custlist" role="listbox" aria-label="Customers">
        {matches.map((c) => (
          <button type="button" key={c.customerAccount} role="option" aria-selected={c.customerAccount === value} onClick={() => pick(c)}>
            <span><b>{c.customerName}</b> <span className="small muted">{c.customerAccount}{c.city ? ` · ${c.city}, ${c.state}` : ''}</span></span>
            <span className="small muted">{c.terms}</span>
          </button>
        ))}
        {matches.length === 0 && <div className="small muted" style={{ padding: 12 }}>No customers match. Add a new one?</div>}
      </div>
    </div>
  );
}
