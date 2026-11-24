import { useEffect, useState } from 'react';
import { get, money } from '../../api.js';
import { saveFile } from '../../components/ExportMenu.jsx';
import DataReport from './DataReport.jsx';

const num = (n) => Number(n || 0).toLocaleString('en-US');
const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

function Export({ name, head, rows }) {
  const [msg, setMsg] = useState('');
  const run = async () => {
    setMsg('');
    try {
      await saveFile(new Blob([csv([head, ...rows])], { type: 'text/csv' }), `${name}.csv`);
    } catch (e) {
      if (e?.code !== 'declined') setMsg('Downloads are not available in this view.');
    }
  };
  return (
    <span className="row">
      {msg && <span className="small muted">{msg}</span>}
      <button className="btn sm" disabled={!rows.length} onClick={run}>Export CSV</button>
    </span>
  );
}

// Horizontal bars: one row per item, longest bar is the biggest amount.
function Bars({ items, sub }) {
  const max = Math.max(1, ...items.map((i) => i.amount));
  if (!items.length) return <p className="muted">No orders in this period.</p>;
  return (
    <div className="hbars">
      {items.map((i) => (
        <div key={i.key} className="hbar">
          <div className="hbar-top">
            <span className="hbar-name"><b>{i.label}</b>{sub && <span className="muted small"> {sub(i)}</span>}</span>
            <span className="hbar-val">{money(i.amount)}</span>
          </div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${Math.max(2, (i.amount / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function Sales() {
  const [months, setMonths] = useState(6);
  const [r, setR] = useState(null);
  useEffect(() => { get(`/admin/reports?months=${months}`).then(setR); }, [months]);
  if (!r) return null;
  const t = r.totals;
  const peak = Math.max(1, ...r.byMonth.map((m) => m.amount));
  const stamp = new Date().toLocaleDateString('en-CA');

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted small" style={{ margin: 0 }}>Orders placed through the portal. Cancelled orders and bulk releases are left out so nothing is counted twice.</p>
        <div className="seg" role="group" aria-label="Period">
          {[3, 6, 12].map((m) => <button key={m} className={months === m ? 'on' : ''} onClick={() => setMonths(m)}>{m} Months</button>)}
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card stat hero"><div className="n">{money(t.amount)}</div><div className="l">Booked</div></div>
        <div className="card stat"><div className="n">{num(t.orders)}</div><div className="l">Orders</div></div>
        <div className="card stat"><div className="n">{money(t.average)}</div><div className="l">Average Order</div></div>
        <div className="card stat"><div className="n">{num(t.units)}</div><div className="l">Units · {t.customers} Customers</div></div>
      </div>

      <div className="card">
        <div className="spread">
          <h2>Bookings by Month</h2>
          <Export name={`bookings-by-month-${stamp}`} head={['Month', 'Orders', 'Units', 'Booked']} rows={r.byMonth.map((m) => [m.label, m.orders, m.units, m.amount.toFixed(2)])} />
        </div>
        <div className="vbars" style={{ gridTemplateColumns: `repeat(${r.byMonth.length}, 1fr)` }}>
          {r.byMonth.map((m) => (
            <div key={m.key} className="vbar" title={`${m.label}: ${money(m.amount)} · ${m.orders} orders`}>
              <div className="vbar-val">{m.amount ? money(m.amount).replace(/\.\d\d$/, '') : '—'}</div>
              <div className="vbar-col"><div className="vbar-fill" style={{ height: `${(m.amount / peak) * 100}%` }} /></div>
              <div className="vbar-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid pair">
        <div className="card">
          <div className="spread">
            <h2>Sales by Customer</h2>
            <Export name={`sales-by-customer-${stamp}`} head={['Account', 'Customer', 'Orders', 'Units', 'Booked']} rows={r.byCustomer.map((c) => [c.key, c.label, c.orders, c.units, c.amount.toFixed(2)])} />
          </div>
          <Bars items={r.byCustomer} sub={(c) => `${c.orders} orders · ${num(c.units)} units`} />
        </div>
        <div className="card">
          <div className="spread">
            <h2>Top Styles</h2>
            <Export name={`sales-by-style-${stamp}`} head={['Style', 'Description', 'Orders', 'Units', 'Booked']} rows={r.byStyle.map((s) => [s.key, s.label, s.orders, s.units, s.amount.toFixed(2)])} />
          </div>
          <Bars items={r.byStyle} sub={(s) => `${s.key} · ${num(s.units)} units`} />
        </div>
        <div className="card">
          <div className="spread">
            <h2>Sales by Order Type</h2>
            <Export name={`sales-by-order-type-${stamp}`} head={['Order Type', 'Orders', 'Units', 'Booked']} rows={r.byType.map((x) => [x.label, x.orders, x.units, x.amount.toFixed(2)])} />
          </div>
          <Bars items={r.byType} sub={(x) => `${x.orders} orders`} />
        </div>
        <div className="card">
          <div className="spread">
            <h2>Sales by Collection</h2>
            <Export name={`sales-by-collection-${stamp}`} head={['Collection', 'Units', 'Booked']} rows={r.byCategory.map((x) => [x.label, x.units, x.amount.toFixed(2)])} />
          </div>
          <Bars items={r.byCategory} sub={(x) => `${num(x.units)} units`} />
        </div>
      </div>

      <div className="grid pair">
        <div className="card">
          <div className="spread">
            <h2>Open Orders by Ship Month</h2>
            <Export name={`open-orders-by-ship-month-${stamp}`} head={['Ship Month', 'Orders', 'Units', 'Open Value']} rows={r.openByShip.map((x) => [x.label, x.orders, x.units, x.amount.toFixed(2)])} />
          </div>
          <p className="muted small">All open and on-hold orders, whatever period is picked above.</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ship Month</th><th className="right">Orders</th><th className="right">Units</th><th className="right">Open Value</th></tr></thead>
              <tbody>
                {r.openByShip.length === 0 && <tr><td colSpan={4} className="muted">No open orders.</td></tr>}
                {r.openByShip.map((x) => (
                  <tr key={x.key}><td><b>{x.label}</b></td><td className="right">{x.orders}</td><td className="right">{num(x.units)}</td><td className="right">{money(x.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="spread">
            <h2>Credit Exposure</h2>
            <Export name={`credit-exposure-${stamp}`} head={['Account', 'Customer', 'Limit', 'A/R', 'Open Orders', 'Available']} rows={r.exposure.map((c) => [c.key, c.label, c.limit, c.ar, c.openOrders, c.available])} />
          </div>
          <p className="muted small">A/R plus open orders against each credit limit. Tightest accounts first.</p>
          <div className="hbars">
            {r.exposure.map((c) => {
              const used = Math.min(100, Math.round((c.exposure / c.limit) * 100));
              return (
                <div key={c.key} className="hbar">
                  <div className="hbar-top">
                    <span className="hbar-name"><b>{c.label}</b></span>
                    <span className="hbar-val">{used}% used · {money(c.available)} left</span>
                  </div>
                  <div className="hbar-track"><div className={`hbar-fill ${used >= 90 ? 'hot' : ''}`} style={{ width: `${Math.max(2, used)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS = [['sales', 'Sales'], ['customers', 'Customers'], ['products', 'Products'], ['inventory', 'Inventory']];

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [filters, setFilters] = useState(null);
  useEffect(() => { get('/admin/reports/filters').then(setFilters); }, []);
  return (
    <div className="stack">
      <div className="spread">
        <div>
          <div className="eyebrow">Pull, Filter, Export</div>
          <h1>Reports</h1>
        </div>
        <div className="seg big" role="tablist" aria-label="Report">
          {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
        </div>
      </div>
      {tab === 'sales' ? <Sales /> : filters && <DataReport key={tab} type={tab} filters={filters} />}
    </div>
  );
}
