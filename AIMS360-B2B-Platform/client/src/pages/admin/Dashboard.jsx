import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, money, shortDate } from '../../api.js';

const TYPE = { I: 'Immediate', PB: 'Prebook', B: 'Bulk' };

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [customers, setCustomers] = useState([]);
  useEffect(() => {
    get('/admin/dashboard').then(setD);
    get('/admin/customers').then(setCustomers);
  }, []);
  if (!d) return null;
  const t = d.totals;
  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{d.company.account} · {d.company.companyName}</div>
        <h1>Dashboard</h1>
      </div>
      <div className="grid cols-4">
        <div className="card stat"><div className="n">{t.open}</div><div className="l">Open portal orders</div></div>
        <div className="card stat"><div className="n">{t.hold}</div><div className="l">On hold ({t.creditHolds} for credit)</div></div>
        <div className="card stat"><div className="n">{t.pendingCancels}</div><div className="l">Cancel requests waiting</div></div>
        <Link to="/admin/reports" className="card stat hero" style={{ textDecoration: 'none' }}><div className="n">{money(t.bookedAmount)}</div><div className="l">Booked through the portal · View Reports →</div></Link>
      </div>
      {t.accessRequests > 0 && (
        <div className="notice warn">{t.accessRequests} access request{t.accessRequests > 1 ? 's' : ''} waiting. <Link to="/admin/buyers"><b>Review Requests →</b></Link></div>
      )}
      {(t.hold > 0 || t.pendingCancels > 0) && (
        <div className="notice warn">
          {t.hold > 0 && <>{t.hold} order{t.hold > 1 ? 's' : ''} on hold. </>}
          {t.pendingCancels > 0 && <>{t.pendingCancels} cancel request{t.pendingCancels > 1 ? 's' : ''} to review. </>}
          <Link to="/admin/orders"><b>Go to Orders →</b></Link>
        </div>
      )}
      <div className="grid dash-split">
        <div className="card">
          <h2>Orders by Type</h2>
          <div className="hbars" style={{ marginTop: 4, marginBottom: 16 }}>
            {d.byType.map((x) => (
              <div key={x.code} className="hbar">
                <div className="hbar-top"><span className="hbar-name"><b>{TYPE[x.code]}</b></span><span className="hbar-val">{x.count}</span></div>
                <div className="hbar-track"><div className="hbar-fill" style={{ width: `${Math.max(2, (x.count / Math.max(1, ...d.byType.map((y) => y.count))) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="kv"><span className="muted">Active buyers</span><b>{t.buyers}</b></div>
        </div>
        <div className="card">
          <h2>Customer Credit</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Customer</th><th className="right">Limit</th><th className="right">A/R</th><th className="right">Open orders</th><th className="right">Available</th></tr></thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.customerAccount}>
                    <td><b>{c.customerName}</b></td>
                    <td className="right">{c.credit.limit ? money(c.credit.limit) : 'None'}</td>
                    <td className="right">{money(c.credit.ar)}</td>
                    <td className="right">{money(c.credit.openOrders)}</td>
                    <td className="right">{c.credit.available === null ? '—' : <span style={{ color: c.credit.available < 0 ? 'var(--bad)' : undefined }}>{money(c.credit.available)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Recent Activity</h2>
        {d.activity.length === 0 ? <p className="muted">Nothing yet.</p> : d.activity.map((a, i) => (
          <div key={i} className="spread small" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
            <span><b>{a.actor}</b> · {a.detail}</span>
            <span className="muted">{shortDate(a.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
