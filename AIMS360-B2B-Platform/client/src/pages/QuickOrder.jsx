import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post, money } from '../api.js';
import { useCart } from '../cart.jsx';

// Adds matched lines to the cart, on top of whatever is already there.
export function useFillCart() {
  const { cart, setLine, setField } = useCart();
  return (out) => {
    for (const l of out.lines) {
      const have = cart.lines.find((x) => x.style === l.style && x.color === l.color)?.sizes || {};
      const sizes = { ...have };
      for (const [k, q] of Object.entries(l.sizes)) sizes[k] = (Number(sizes[k]) || 0) + q;
      const { style, color, sizes: _s, ...meta } = l;
      setLine(style, color, sizes, meta);
    }
    if (out.info?.customerPurchaseOrder && !cart.customerPurchaseOrder) setField('customerPurchaseOrder', out.info.customerPurchaseOrder);
    if (out.info?.orderType && !cart.orderType) setField('orderType', out.info.orderType);
    if (out.info?.customerAccount && !cart.customerAccount) setField('customerAccount', out.info.customerAccount);
  };
}

const sample = 'TP3001, White, M, 24\nTP3001, White, L, 24\nAW1002, BLK, S, 12';

export default function QuickOrder({ role }) {
  const { cart } = useCart();
  const fill = useFillCart();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const run = async (body) => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const out = await post('/shop/cart/fill', { ...body, customerAccount: cart.customerAccount });
      if (out.lines.length) fill(out);
      setResult(out);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => run({ file: reader.result });
    reader.onerror = () => setError('That file could not be read.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Skip the Browsing</div>
        <h1>Quick Order</h1>
        <p className="muted">Know what you want? Type it in or import a filled-in order form. Everything lands in your cart for review before anything is placed.</p>
      </div>
      {role === 'admin' && !cart.customerAccount && (
        <div className="notice warn">No customer is chosen yet, so prices shown are wholesale. Choose the customer on the <Link to="/cart"><b>New Order</b></Link> screen and the customer's prices apply.</div>
      )}
      <div className="grid pair">
        <div className="card">
          <h2>Type or Paste Items</h2>
          <p className="muted small">One item per line: style, color, size, quantity. Color can be the code or the name. Pasting from a spreadsheet works.</p>
          <textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={sample} aria-label="Items to add" style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13 }} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={busy || !text.trim()} onClick={() => run({ text })}>Add to Cart</button>
            <button className="btn ghost sm" onClick={() => setText(sample)}>Use an Example</button>
          </div>
        </div>
        <div className="card">
          <h2>Import an Order Form</h2>
          <p className="muted small">Export the Excel order form from any linesheet, fill in the quantities, then import it here. The PO number and order type come across too if they are filled in.</p>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {busy ? 'Reading…' : 'Choose Excel File'}
            <input type="file" accept=".xlsx" onChange={onFile} disabled={busy} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
          </label>
          <p className="small" style={{ marginTop: 14 }}><Link to="/linesheets" style={{ color: 'var(--accent-text)' }}><b>Go to Linesheets →</b></Link></p>
        </div>
      </div>
      {error && <div className="notice bad" role="alert">{error}</div>}
      {result && (
        <div className="card">
          <div className="spread">
            <h2>{result.lines.length ? `Added ${result.units} Units to Your Cart` : 'Nothing Was Added'}</h2>
            {result.lines.length > 0 && <button className="btn primary" onClick={() => nav('/cart')}>Review Cart</button>}
          </div>
          {result.problems.length > 0 && (
            <div className="notice warn" style={{ marginBottom: 12 }}>
              <b>{result.problems.length} line{result.problems.length > 1 ? 's' : ''} could not be added:</b>
              <ul>{result.problems.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          {result.lines.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Style</th><th>Color</th><th>Sizes</th><th className="right">Price</th></tr></thead>
                <tbody>
                  {result.lines.map((l) => (
                    <tr key={l.style + l.color}>
                      <td><b>{l.description}</b> <span className="muted small">{l.style}</span></td>
                      <td>{l.colorDescription}</td>
                      <td>{Object.entries(l.sizes).map(([k, q]) => `${k} × ${q}`).join('  ')}</td>
                      <td className="right">{money(l.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
