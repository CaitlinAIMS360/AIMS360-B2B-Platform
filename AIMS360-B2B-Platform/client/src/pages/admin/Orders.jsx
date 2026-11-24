import { useEffect, useState } from 'react';
import { get } from '../../api.js';
import { OrdersTable } from '../Orders.jsx';

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('');
  useEffect(() => { get('/admin/orders').then(setOrders); }, []);
  if (!orders) return null;
  const shown = orders.filter((o) =>
    filter === 'cancel' ? o.cancelRequest : filter === 'bulk' ? o.bulkOrder : !filter || o.status === filter
  );
  const tabs = [
    ['', `All (${orders.length})`],
    ['Hold', `On Hold (${orders.filter((o) => o.status === 'Hold').length})`],
    ['cancel', `Cancel Requests (${orders.filter((o) => o.cancelRequest).length})`],
    ['Open', 'Open'],
    ['bulk', 'Bulk'],
    ['Cancelled', 'Cancelled']
  ];
  return (
    <div>
      <h1>Orders</h1>
      <p className="muted">Portal orders arrive Open. Orders over a customer's credit limit arrive on Hold.</p>
      <div className="row" style={{ margin: '16px 0' }}>
        {tabs.map(([k, label]) => (
          <button key={k} className={`btn sm ${filter === k ? 'primary' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      <div className="card"><OrdersTable orders={shown} base="/admin/orders" showCustomer /></div>
    </div>
  );
}
