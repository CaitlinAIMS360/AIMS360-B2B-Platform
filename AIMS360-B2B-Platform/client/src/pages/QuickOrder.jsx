import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post, money } from '../api.js';
import { useCart } from '../cart.jsx';
import { Sizes } from '../components/bits.jsx';

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
let rowId = 1;
const newRow = () => ({ id: rowId++, style: '', color: '', qty: {} });

// One line of the quick-order grid: pick a style, tap a color, type quantities by size.
function EntryRow({ row, styles, onChange, onRemove, canRemove }) {
  const s = styles.find((x) => x.style === row.style.trim().toUpperCase().split(/\s/)[0]);
  const c = s?.colors.find((x) => x.color === row.color) || s?.colors[0];
  const units = Object.values(row.qty).reduce((t, q) => t + (Number(q) || 0), 0);
  return (
    <div className={`qo-row ${s ? 'ready' : ''}`}>
      <div className="qo-thumb">{c ? <img src={c.image} alt="" /> : <span aria-hidden="true">+</span>}</div>
      <div className="qo-main">
        <div className="qo-style">
          <input list="qo-styles" value={row.style} placeholder="Style number or name" aria-label="Style"
            onChange={(e) => onChange({ ...row, style: e.target.value, color: '', qty: {} })} />
          {s && <span className="qo-name"><b>{s.description}</b><span className="muted small"> · {money(s.price)}</span></span>}
        </div>
        {s && (
          <>
            <div className="qo-colors" role="group" aria-label="Color">
              {s.colors.map((x) => (
                <button key={x.color} type="button" className={`chip ${x.color === c.color ? 'on' : ''}`} aria-pressed={x.color === c.color} onClick={() => onChange({ ...row, color: x.color, qty: {} })}>
                  <span className="swatch" data-none={x.hex ? undefined : ''} style={{ background: x.hex }} />{x.colorDescription}
                </button>
              ))}
            </div>
            <div className="qo-sizes">
              {c.sizes.map((z) => (
                <label key={z.sizeName} className="qo-size">
                  <span>{z.sizeName}</span>
                  <input inputMode="numeric" placeholder="0" value={row.qty[z.sizeName] ?? ''} aria-label={`${s.description} ${c.colorDescription} size ${z.sizeName}`}
                    onChange={(e) => onChange({ ...row, color: c.color, qty: { ...row.qty, [z.sizeName]: e.target.value.replace(/\D/g, '') } })} />
                </label>
              ))}
              <span className="qo-units">{units > 0 ? `${units} units` : ''}</span>
            </div>
          </>
        )}
      </div>
      {canRemove && <button type="button" className="btn ghost sm" onClick={onRemove} aria-label="Remove this line" title="Remove">✕</button>}
    </div>
  );
}

export default function QuickOrder({ role }) {
  const { cart } = useCart();
  const fill = useFillCart();
  const nav = useNavigate();
  const [styles, setStyles] = useState([]);
  const [rows, setRows] = useState(() => [newRow()]);
  const [text, setText] = useState('');
  const [paste, setPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    get(`/shop/catalog?customer=${encodeURIComponent(cart.customerAccount || '')}`).then((d) => setStyles(d.items));
  }, [cart.customerAccount]);

  const run = async (body, after) => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const out = await post('/shop/cart/fill', { ...body, customerAccount: cart.customerAccount });
      if (out.lines.length) { fill(out); after?.(); }
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

  // A new blank line appears as soon as the last one has a style, so there is always somewhere to type.
  const change = (next) => setRows((a) => {
    const b = a.map((r) => (r.id === next.id ? next : r));
    return b[b.length - 1].style.trim() ? [...b, newRow()] : b;
  });
  const typed = rows.flatMap((r) => {
    const code = r.style.trim().toUpperCase().split(/\s/)[0];
    const s = styles.find((x) => x.style === code);
    const color = r.color || s?.colors[0]?.color;
    return Object.entries(r.qty).filter(([, q]) => Number(q) > 0).map(([size, q]) => `${code}\t${color}\t${size}\t${q}`);
  });
  const typedUnits = rows.reduce((t, r) => t + Object.values(r.qty).reduce((u, q) => u + (Number(q) || 0), 0), 0);

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Skip the Browsing</div>
        <h1>Quick Order</h1>
        <p className="muted">Know what you want? Pick styles and type quantities, or import a filled-in order form. Everything lands in your cart for review before anything is placed.</p>
      </div>
      {role === 'admin' && !cart.customerAccount && (
        <div className="notice warn">No customer is chosen yet, so prices shown are wholesale. Choose the customer on the <Link to="/cart"><b>New Order</b></Link> screen and the customer's prices apply.</div>
      )}
      <datalist id="qo-styles">{styles.map((s) => <option key={s.style} value={s.style}>{s.description}</option>)}</datalist>
      <div className="grid qo-layout">
        <div className="card">
          <div className="spread">
            <h2>Add Items</h2>
            <div className="seg" role="group" aria-label="How to add items">
              <button type="button" className={!paste ? 'on' : ''} onClick={() => setPaste(false)}>Pick Styles</button>
              <button type="button" className={paste ? 'on' : ''} onClick={() => setPaste(true)}>Paste a List</button>
            </div>
          </div>
          {!paste ? (
            <>
              <div className="qo-rows">
                {rows.map((r) => (
                  <EntryRow key={r.id} row={r} styles={styles} onChange={change} canRemove={rows.length > 1}
                    onRemove={() => setRows((a) => (a.length > 1 ? a.filter((x) => x.id !== r.id) : a))} />
                ))}
              </div>
              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn primary" disabled={busy || !typed.length} onClick={() => run({ text: typed.join('\n') }, () => setRows([newRow()]))}>
                  {typedUnits ? `Add ${typedUnits} Units to Cart` : 'Add to Cart'}
                </button>
                <button type="button" className="btn ghost sm" onClick={() => setRows((a) => [...a, newRow()])}>Add Another Line</button>
              </div>
            </>
          ) : (
            <>
              <p className="muted small" style={{ marginTop: 12 }}>One item per line: style, color, size, quantity. Color can be the code or the name. Copying rows from a spreadsheet works too.</p>
              <textarea className="qo-paste" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={sample} aria-label="Items to add" />
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn primary" disabled={busy || !text.trim()} onClick={() => run({ text }, () => setText(''))}>Add to Cart</button>
                <button className="btn ghost sm" onClick={() => setText(sample)}>Use an Example</button>
              </div>
            </>
          )}
        </div>
        <div className="card qo-import">
          <div className="qo-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 18v-6M9.5 14.5 12 12l2.5 2.5" /></svg>
          </div>
          <h2>Import an Order Form</h2>
          <p className="muted small">Export the Excel order form from any linesheet, fill in the quantities, then import it here. The PO number and order type come across too.</p>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {busy ? 'Reading…' : 'Choose Excel File'}
            <input type="file" accept=".xlsx" onChange={onFile} disabled={busy} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
          </label>
          <p className="small" style={{ marginTop: 14, marginBottom: 0 }}><Link to="/linesheets" style={{ color: 'var(--accent-text)' }}><b>Get a Form From Linesheets →</b></Link></p>
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
                      <td><Sizes items={Object.entries(l.sizes)} /></td>
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
