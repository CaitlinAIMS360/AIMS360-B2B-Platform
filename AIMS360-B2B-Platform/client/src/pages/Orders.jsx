import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, money, shortDate } from '../api.js';
import { StatusPill, TypePill } from '../components/bits.jsx';

export function OrdersTable({ orders, base, showCustomer }) {
  const nav = useNavigate();
  if (!orders.length) return <p className="muted">No orders to show.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th><th>Date</th>{showCustomer && <th>Customer</th>}<th>Type</th><th>Status</th><th>Ship start</th><th className="right">Units</th><th className="right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.orderID} className="click" onClick={() => nav(`${base}/${o.orderID}`)}>
              <td>
                <b>{o.order}</b>
                {o.cancelRequest && <div><span className="pill warn">Cancel Requested</span></div>}
                {o.bulkOrder && <div className="small muted">{o.toRelease} units left to release</div>}
                {o.bulkOrderNumber && <div className="small muted">From bulk {o.bulkOrderNumber}</div>}
              </td>
              <td>{shortDate(o.createdOn)}</td>
              {showCustomer && <td>{o.customerName}</td>}
              <td><TypePill order={o} /></td>
              <td><StatusPill order={o} /></td>
              <td>{o.start ? shortDate(o.start) : '—'}</td>
              <td className="right">{o.bookedTotal}</td>
              <td className="right">{money(o.bookedAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [show, setShow] = useState('active');
  const [q, setQ] = useState('');
  const load = () => get('/buyer/orders').then(setOrders);
  useEffect(() => { load(); }, []);
  if (!orders) return null;
  const t = q.toLowerCase().trim();
  const shown = orders
    .filter((o) => show === 'all' || ['Open', 'Hold'].includes(o.status))
    .filter((o) => !t || o.order.includes(t) || (o.customerPurchaseOrder || '').toLowerCase().includes(t));
  return (
    <div>
      <h1>My Orders</h1>
      <p className="muted">Select an order to see its lines, request a cancel, or release from a bulk order.</p>
      <div className="shopbar" style={{ marginTop: 18 }}>
        <select value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show" style={{ width: 190 }}>
          <option value="active">Open / Hold</option>
          <option value="all">All Orders</option>
        </select>
        <input type="search" className="grow" placeholder="Search order number or your PO" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
        <button className="btn" onClick={load}>Refresh</button>
      </div>
      <div className="card"><OrdersTable orders={shown} base="/orders" /></div>
    </div>
  );
}
