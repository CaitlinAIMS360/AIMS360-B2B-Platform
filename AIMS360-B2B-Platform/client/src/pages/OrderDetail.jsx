import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useFillCart } from './QuickOrder.jsx';
import { get, post, money, shortDate } from '../api.js';
import { StatusPill, TypePill, ConfirmButton, canPrint } from '../components/bits.jsx';
import { Wordmark } from '../theme.jsx';

// One screen for buyers and admins; the actions differ by role.
export default function OrderDetail({ role }) {
  const { id } = useParams();
  const api = role === 'admin' ? '/admin' : '/buyer';
  const back = role === 'admin' ? '/admin/orders' : '/orders';
  const [o, setO] = useState(null);
  const [stores, setStores] = useState([]);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [rel, setRel] = useState({});
  const [relStore, setRelStore] = useState('');
  const [made, setMade] = useState(null);
  const fill = useFillCart();
  const nav = useNavigate();

  const load = async () => {
    const order = role === 'admin' ? (await get('/admin/orders')).find((x) => x.orderID === id) : await get(`/buyer/orders/${id}`);
    setO(order);
  };
  useEffect(() => {
    load();
    if (role === 'buyer') get('/buyer/account').then((a) => setStores(a.stores));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const act = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!o) return null;
  // Copies this order's items into the cart so it can be placed again.
  const reorder = async () => {
    setError('');
    try {
      const out = await post('/shop/cart/fill', { orderID: o.orderID });
      if (!out.lines.length) throw new Error('None of these items can be ordered any more.');
      fill(out);
      nav('/cart');
    } catch (e) {
      setError(e.message);
    }
  };
  const live = ['Open', 'Hold'].includes(o.status);

  const release = () =>
    act(async () => {
      const lines = o.lineItems.map((l) => ({ style: l.style, color: l.color, sizes: rel[l.style + l.color] || {} }));
      const r = await post(`${api}/orders/${o.orderID}/releases`, { shipToStore: relStore || undefined, lines });
      setMade(r);
      setRel({});
    });

  return (
    <div className="stack">
      <p className="small no-print"><Link to={back} className="muted">← Orders</Link></p>
      <div className="print-only"><Wordmark sub="Order Confirmation" /></div>
      <div className="spread">
        <div>
          <h1>Order {o.order}</h1>
          <div className="row"><TypePill order={o} /><StatusPill order={o} />{o.cancelRequest && <span className="pill warn">Cancel Requested</span>}</div>
        </div>
        <div className="row no-print">
          {!o.distributionOrder && <button className="btn" onClick={reorder}>Reorder</button>}
          {canPrint && <button className="btn" onClick={() => window.print()}>Print or Save PDF</button>}
        {role === 'admin' && live && (
          <>
            {o.status === 'Hold'
              ? <button className="btn primary" onClick={() => act(() => post(`/admin/orders/${o.orderID}/status`, { status: 'Open' }))}>Release to Open</button>
              : <button className="btn" onClick={() => act(() => post(`/admin/orders/${o.orderID}/status`, { status: 'Hold' }))}>Put on Hold</button>}
            <ConfirmButton label={o.cancelRequest ? 'Approve Cancel' : 'Cancel Order'} confirmLabel="Yes, Cancel Order" onConfirm={() => act(() => post(`/admin/orders/${o.orderID}/cancel`))} />
          </>
        )}
        </div>
      </div>
      {error && <div className="notice bad" role="alert">{error}</div>}
      {role === 'admin' && o.salesRep && (
        <div className="small muted">
          Sales rep {o.salesRep}{o.commissionPercent != null ? ` (${o.commissionPercent}% commission)` : ''}
          {o.salesRep2 && <> · Second rep {o.salesRep2}{o.commissionPercent2 != null ? ` (${o.commissionPercent2}% commission)` : ''}</>}
        </div>
      )}
      {o.cancelRequest && (
        <div className="notice warn">
          Cancel requested by {o.cancelRequest.requestedBy} on {shortDate(o.cancelRequest.requestedAt)}
          {o.cancelRequest.reason ? `: “${o.cancelRequest.reason}”` : '.'}
        </div>
      )}

      <div className="grid cols-4">
        <div className="card flat stat"><div className="l">Customer</div><div><b>{o.customerName}</b></div><div className="small muted">{o.customerAccount}</div></div>
        <div className="card flat stat"><div className="l">Season · Ship to</div><div><b>{o.season}</b> · {o.shipToStore || 'Default address'}</div><div className="small muted">PO {o.customerPurchaseOrder || '—'} · {o.term}{o.shipvia ? ` · ${o.shipvia}` : ''}</div></div>
        <div className="card flat stat"><div className="l">Ship start · Complete</div><div><b>{o.start ? shortDate(o.start) : '—'}</b></div><div className="small muted">{o.complete ? shortDate(o.complete) : 'No complete date'}</div></div>
        <div className="card flat stat"><div className="l">Total</div><div className="n">{money(o.bookedAmount)}</div><div className="small muted">{o.bookedTotal} units{o.netDiscountPercentage ? ` · ${o.netDiscountPercentage}% discount${o.discountReason ? ` (${o.discountReason})` : ''}` : ''}</div></div>
      </div>

      <div className="card">
        <h2>Lines</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Style</th><th>Colour</th><th>Sizes</th><th className="right">Price</th><th className="right">Units</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {o.lineItems.map((l) => {
                const u = l.sizes.reduce((t, z) => t + z.orderQuantity, 0);
                return (
                  <tr key={l.style + l.color}>
                    <td><b>{l.style}</b><div className="small muted">{l.description}</div></td>
                    <td>{l.colorDescription}</td>
                    <td className="small">{l.sizes.map((z) => `${z.sizeName} × ${z.orderQuantity}`).join('   ')}</td>
                    <td className="right">{money(l.price)}{l.discountPercent > 0 && <div className="small" style={{ color: 'var(--accent-text)' }}>{l.discountPercent}% off {money(l.listPrice)}</div>}</td>
                    <td className="right">{u}</td>
                    <td className="right">{money(u * l.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {o.bulkOrder && (
        <div className="card no-print">
          <div className="spread"><h2>Release From This Bulk Order</h2><span className="pill">{o.toRelease} units left to release</span></div>
          {made && <div className="notice good" style={{ marginBottom: 12 }}>Release created as order {made.order} ({made.status}).</div>}
          {live && o.toRelease > 0 ? (
            <>
              <div className="table-wrap">
                <table className="sizegrid">
                  <tbody>
                    {o.lineItems.map((l) => (
                      <tr key={l.style + l.color}>
                        <td><b>{l.style}</b> <span className="muted">{l.colorDescription}</span></td>
                        {l.sizes.map((z) => {
                          const left = z.orderQuantity - z.releasedQuantity - z.shippedQuantity;
                          const k = l.style + l.color;
                          return (
                            <td key={z.sizeName}>
                              <div className="small muted">{z.sizeName}</div>
                              <input
                                inputMode="numeric" placeholder="0" disabled={left <= 0}
                                aria-label={`Release ${l.style} ${l.colorDescription} size ${z.sizeName}`}
                                value={rel[k]?.[z.sizeName] ?? ''}
                                onChange={(e) => setRel((r) => ({ ...r, [k]: { ...r[k], [z.sizeName]: e.target.value.replace(/[^\d]/g, '') } }))}
                              />
                              <div className="avail">{left} left</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                {role === 'buyer' && stores.length > 1 && (
                  <select style={{ maxWidth: 280 }} value={relStore} onChange={(e) => setRelStore(e.target.value)} aria-label="Ship release to">
                    <option value="">Ship to default address</option>
                    {stores.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                )}
                <button className="btn primary" onClick={release}>Create Release</button>
              </div>
            </>
          ) : (
            <p className="muted">{live ? 'Everything on this bulk order has been released.' : 'This bulk order is closed.'}</p>
          )}
          {o.releases.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3>Releases</h3>
              {o.releases.map((r) => (
                <div key={r.orderID} className="spread" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                  <span><Link to={`${back}/${r.orderID}`}><b>{r.order}</b></Link> <span className="small muted">· {shortDate(r.createdOn)} · {r.bookedTotal} units{r.shipToStore ? ` · ${r.shipToStore}` : ''}</span></span>
                  <StatusPill order={r} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {role === 'buyer' && live && !o.cancelRequest && (
        <div className="card flat no-print">
          <h2>Need to Cancel?</h2>
          <p className="muted small">Cancel requests go to the brand for approval.</p>
          <div className="row">
            <input className="grow" style={{ maxWidth: 420 }} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Cancel reason" />
            <button className="btn danger" onClick={() => act(() => post(`/buyer/orders/${o.orderID}/cancel-request`, { reason }))}>Request Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
