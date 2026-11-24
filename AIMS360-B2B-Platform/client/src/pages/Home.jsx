import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, money, shortDate } from '../api.js';
import { StatusPill, TypePill, CreditMeter } from '../components/bits.jsx';

export default function Home({ user }) {
  const [account, setAccount] = useState(null);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    get('/buyer/account').then(setAccount);
    get('/buyer/orders').then(setOrders);
    get('/buyer/invoices').then(setInvoices);
  }, []);

  if (!account) return null;
  const active = orders.filter((o) => ['Open', 'Hold'].includes(o.status));
  const due = invoices.filter((i) => i.balance > 0);

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <div className="eyebrow">{account.customerName}</div>
          <h1>Welcome Back, {user.name.split(' ')[0]}</h1>
          <p className="muted">{account.terms}{account.priceSheet ? ` · ${account.priceSheet} Pricing` : ''}</p>
        </div>
        <Link to="/catalog" className="btn primary">Start an Order</Link>
      </div>

      <div className="grid cols-4">
        <div className="card stat"><div className="n">{active.length}</div><div className="l">Open Orders</div></div>
        <div className="card stat"><div className="n">{money(account.credit.openOrders)}</div><div className="l">On Order, Not Yet Shipped</div></div>
        <div className="card stat"><div className="n">{money(due.reduce((t, i) => t + i.balance, 0))}</div><div className="l">Invoices Due</div></div>
        <div className="card stat hero">
          <div className="n">{account.credit.available === null ? '—' : money(Math.max(0, account.credit.available))}</div>
          <div className="l">Credit Available</div>
          <div style={{ marginTop: 10 }}><CreditMeter credit={account.credit} /></div>
        </div>
      </div>

      <div className="card">
        <div className="spread"><h2>Recent Orders</h2><Link to="/orders" className="small muted">View All</Link></div>
        {orders.length === 0 ? (
          <p className="muted">No orders yet. Your orders will appear here as soon as you place one.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Date</th><th>Type</th><th>Status</th><th className="right">Units</th><th className="right">Total</th></tr></thead>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.orderID}>
                    <td><Link to={`/orders/${o.orderID}`}><b>{o.order}</b></Link></td>
                    <td>{shortDate(o.createdOn)}</td>
                    <td><TypePill order={o} /></td>
                    <td><StatusPill order={o} /></td>
                    <td className="right">{o.bookedTotal}</td>
                    <td className="right">{money(o.bookedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
