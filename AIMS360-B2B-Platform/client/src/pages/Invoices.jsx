import { useEffect, useState } from 'react';
import { get, money, shortDate } from '../api.js';

export default function Invoices() {
  const [rows, setRows] = useState(null);
  const [credits, setCredits] = useState([]);
  useEffect(() => { get('/buyer/invoices').then(setRows); get('/buyer/credits').then(setCredits); }, []);
  if (!rows) return null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <h1>Invoices & Credits</h1>
      <p className="muted">Balance due: <b>{money(rows.reduce((t, i) => t + i.balance, 0))}</b> · Open credits: <b>{money(credits.reduce((t, c) => t + c.balance, 0))}</b></p>
      <div className="card" style={{ marginTop: 16 }}>
        {rows.length === 0 ? <p className="muted">No invoices yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Order</th><th>Invoice date</th><th>Due</th><th>Status</th><th className="right">Total</th><th className="right">Balance</th></tr></thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.invoice}>
                    <td><b>{i.invoice}</b></td>
                    <td>{i.order}</td>
                    <td>{shortDate(i.invoiceDate)}</td>
                    <td>{shortDate(i.dueDate)}</td>
                    <td>{i.balance <= 0 ? <span className="pill good">Paid</span> : i.dueDate < today ? <span className="pill bad">Past due</span> : <span className="pill">Open</span>}</td>
                    <td className="right">{money(i.total)}</td>
                    <td className="right">{money(i.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card" style={{ marginTop: 20 }}>
        <h2>Open Credits</h2>
        {credits.length === 0 ? <p className="muted">No open credits.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Credit</th><th>Date</th><th>Reason</th><th className="right">Amount</th><th className="right">Open Balance</th></tr></thead>
              <tbody>
                {credits.map((c) => (
                  <tr key={c.credit}><td><b>{c.credit}</b></td><td>{shortDate(c.date)}</td><td>{c.reason}</td><td className="right">{money(c.amount)}</td><td className="right">{money(c.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
