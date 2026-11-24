import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post, money, shortDate } from '../api.js';
import { useCart } from '../cart.jsx';
import { Notices, CreditMeter, Sizes } from '../components/bits.jsx';
import CustomerPicker from '../components/CustomerPicker.jsx';

const TYPE_HELP = {
  I: 'Ships now from stock on hand.',
  PB: 'Future delivery. Uses stock plus incoming production.',
  B: 'Blanket order you release to stores later.'
};

export default function Cart({ config, role }) {
  const admin = role === 'admin';
  const n = admin ? 1 : 0; // admins get an extra first step: Customer
  const { cart, units, setField, setLine, clear } = useCart();
  const nav = useNavigate();
  const [account, setAccount] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [lists, setLists] = useState(null);
  const opt = cart.options || {};
  const setOpt = (k, v) => setField('options', { ...opt, [k]: v });

  useEffect(() => {
    if (admin) get('/shop/customers').then(setLists);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    get(`/shop/account?customer=${encodeURIComponent(admin ? cart.customerAccount || '' : '')}`).then((a) => {
      setAccount(a);
      if (!a) return;
      // Keep the ship-to valid for whichever customer is selected.
      if (!a.stores.some((s) => s.code === cart.shipToStore)) setField('shipToStore', a.stores.length === 1 ? a.stores[0].code : '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.customerAccount]);

  // Live preview: the server prices every line and runs the rules as the cart changes.
  useEffect(() => {
    if (placed) return;
    const t = setTimeout(() => post('/shop/cart/preview', cart).then(setPreview).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [cart, placed]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await post('/shop/orders', cart);
      setPlaced(res.orders);
      clear();
    } catch (e) {
      if (e.data?.errors) setPreview(e.data);
    } finally {
      setBusy(false);
    }
  };

  if (placed) {
    return (
      <div className="card" style={{ maxWidth: 640, margin: '40px auto' }}>
        <h1>Order Placed</h1>
        <p className="muted">
          {placed.length > 1 ? `Your cart was split into ${placed.length} orders, one per season.` : 'Your order is in.'}
        </p>
        {placed.map((o) => (
          <div key={o.orderID} className="spread" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div>
              <b>Order {o.order}</b> <span className="muted small">· {o.customerName} · {o.season} · {o.bookedTotal} units · {money(o.bookedAmount)}</span>
              {o.status === 'Hold' && <div className="small" style={{ color: 'var(--warn)' }}>On hold for credit review. The brand will be in touch.</div>}
            </div>
            <Link className="btn sm" to={`${admin ? '/admin/orders' : '/orders'}/${o.orderID}`}>View</Link>
          </div>
        ))}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={() => nav('/catalog')}>Keep Shopping</button>
          <Link className="btn" to={admin ? '/admin/orders' : '/orders'}>{admin ? 'Orders' : 'My Orders'}</Link>
        </div>
      </div>
    );
  }

  if (!cart.lines.length) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <h1>Your Cart Is Empty</h1>
        <p className="muted">Add styles from the catalog to start an order.</p>
        <Link className="btn primary" to="/catalog">Browse the Catalog</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Cart</h1>
      <p className="muted">Your cart saves automatically.</p>
      <div className="cart-layout" style={{ marginTop: 16 }}>
        <div className="stack">
          {admin && (
            <div className="card">
              <h2>1. Customer</h2>
              <CustomerPicker value={cart.customerAccount} onChange={(v) => setField('customerAccount', v)} />
            </div>
          )}
          <div className="card">
            <h2>{1 + n}. Order Type</h2>
            <div className="typepick">
              {config.orderTypes.map((t) => (
                <button key={t.code} className={cart.orderType === t.code ? 'on' : ''} onClick={() => setField('orderType', t.code)} aria-pressed={cart.orderType === t.code}>
                  <div className="t">{t.label}</div>
                  <div className="d">{TYPE_HELP[t.code]}</div>
                </button>
              ))}
            </div>
            {cart.orderType === 'PB' && (
              <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                <label htmlFor="dw">Delivery window</label>
                <select id="dw" value={cart.deliveryWindowId} onChange={(e) => setField('deliveryWindowId', e.target.value)}>
                  <option value="">Choose a delivery window</option>
                  {config.deliveryWindows.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} · {shortDate(w.start)} to {shortDate(w.complete)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="card">
            <h2>{2 + n}. Items</h2>
            {cart.lines.map((l) => {
              const u = Object.values(l.sizes).reduce((a, b) => a + b, 0);
              const priced = preview?.orders.flatMap((o) => o.lines).find((x) => x.style === l.style && x.color === l.color);
              const amount = priced ? priced.amount : u * l.price;
              return (
                <div key={l.style + l.color} className="linecard">
                  <img src={l.image} alt="" />
                  <div>
                    <Link to={`/catalog/${l.style}`}><b>{l.description}</b></Link>
                    <div className="small muted">{l.style} · {l.colorDescription} · {l.season}</div>
                    <Sizes items={Object.entries(l.sizes)} />
                    {admin && (
                      <label className="linedisc">
                        <span>Line Discount %</span>
                        <input type="number" min="0" max="100" placeholder="0" value={l.discountPercent ?? ''} aria-label={`Line discount percent for ${l.description} ${l.colorDescription}`}
                          onChange={(e) => { const { style, color, sizes, ...meta } = l; setLine(style, color, sizes, { ...meta, discountPercent: e.target.value }); }} />
                      </label>
                    )}
                  </div>
                  <div className="right">
                    <div><b>{money(amount)}</b></div>
                    {priced?.discountPercent > 0 && <div className="small" style={{ color: 'var(--accent-text)' }}>{priced.discountPercent}% off · was {money(priced.listPrice)} each</div>}
                    <div className="small muted">{u} units</div>
                    <button className="btn ghost sm danger" onClick={() => setLine(l.style, l.color, {})}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h2>{3 + n}. Details</h2>
            <div className="grid cols-2">
              <div className="field">
                <label htmlFor="store">Ship to</label>
                <select id="store" value={cart.shipToStore} onChange={(e) => setField('shipToStore', e.target.value)}>
                  {(!account || account.stores.length > 1) && <option value="">{account ? 'Choose a store' : 'Choose a customer first'}</option>}
                  {account?.stores.map((s) => <option key={s.code} value={s.code}>{s.name} · {s.city}, {s.state}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="po">Your PO number (optional)</label>
                <input id="po" value={cart.customerPurchaseOrder} onChange={(e) => setField('customerPurchaseOrder', e.target.value)} maxLength={40} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="notes">Notes for the brand (optional)</label>
              <textarea id="notes" rows={2} value={cart.notes} onChange={(e) => setField('notes', e.target.value)} maxLength={1000} />
            </div>
            {admin && lists && (
              <>
                <h3 style={{ marginTop: 6 }}>Order Options</h3>
                <p className="small muted">Leave blank to use the customer's own settings in AIMS360.</p>
                <div className="grid cols-2">
                  <div className="field">
                    <label htmlFor="o-ship">Ship Via</label>
                    <select id="o-ship" value={opt.shipvia || ''} onChange={(e) => setOpt('shipvia', e.target.value)}>
                      <option value="">Customer default</option>
                      {lists.shipVias.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="o-term">Terms</label>
                    <select id="o-term" value={opt.term || ''} onChange={(e) => setOpt('term', e.target.value)}>
                      <option value="">Customer default{account ? ` (${account.terms})` : ''}</option>
                      {lists.terms.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="o-rep">Sales Rep</label>
                    <select id="o-rep" value={opt.salesRep || ''} onChange={(e) => setOpt('salesRep', e.target.value)}>
                      <option value="">Customer default</option>
                      {lists.salesReps.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="o-com">Commission %</label>
                    <input id="o-com" type="number" min="0" max="100" value={opt.commissionPercent ?? ''} onChange={(e) => setOpt('commissionPercent', e.target.value)} placeholder="Rep default" disabled={!opt.salesRep} />
                  </div>
                  <div className="field">
                    <label htmlFor="o-rep2">Second Sales Rep</label>
                    <select id="o-rep2" value={opt.salesRep2 || ''} onChange={(e) => setOpt('salesRep2', e.target.value)} disabled={!opt.salesRep}>
                      <option value="">None</option>
                      {lists.salesReps.filter((v) => v.code !== opt.salesRep).map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="o-com2">Second Rep Commission %</label>
                    <input id="o-com2" type="number" min="0" max="100" value={opt.commissionPercent2 ?? ''} onChange={(e) => setOpt('commissionPercent2', e.target.value)} placeholder="Rep default" disabled={!opt.salesRep2} />
                  </div>
                  <div className="field">
                    <label htmlFor="o-status">Status</label>
                    <select id="o-status" value={opt.status || ''} onChange={(e) => setOpt('status', e.target.value)}>
                      <option value="">Open (Hold if over credit limit)</option>
                      <option value="Hold">Hold</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="o-disc">Discount %</label>
                    <input id="o-disc" type="number" min="0" max="100" value={opt.discountPercent ?? ''} onChange={(e) => setOpt('discountPercent', e.target.value)} placeholder="0" />
                  </div>
                  <div className="field">
                    <label htmlFor="o-reason">Discount Reason</label>
                    <select id="o-reason" value={opt.discountReason || ''} onChange={(e) => setOpt('discountReason', e.target.value)}>
                      <option value="">None</option>
                      {lists.discountReasons.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
            {config.requireTerms && (
              <label className="check">
                <input type="checkbox" checked={cart.acceptTerms} onChange={(e) => setField('acceptTerms', e.target.checked)} />
                <span>{admin ? 'The customer accepts the terms and conditions.' : 'I accept the terms and conditions.'} <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>{config.termsText}</span></span>
              </label>
            )}
          </div>
        </div>

        <aside className="card summary">
          <h2>Summary</h2>
          {admin && <div className="kv"><span className="muted">Customer</span><span>{preview?.customer?.customerName || 'Not chosen'}</span></div>}
          <div className="kv"><span className="muted">Order Type</span><span>{preview?.orderType?.label || 'Not chosen'}</span></div>
          {account && <div className="kv"><span className="muted">Terms</span><span>{(admin && opt.term) || account.terms}</span></div>}
          {account?.priceSheet && <div className="kv"><span className="muted">Pricing</span><span>{account.priceSheet}</span></div>}
          <div className="kv"><span className="muted">Units</span><span>{preview?.units ?? units}</span></div>
          {preview?.orders.length > 1 && (
            <div className="small muted" style={{ margin: '4px 0 8px' }}>
              Splits into {preview.orders.length} orders: {preview.orders.map((o) => `${o.season} ${money(o.amount)}`).join(', ')}
            </div>
          )}
          {preview?.discountAmount > 0 && (
            <>
              <div className="kv"><span className="muted">Merchandise</span><span>{money(preview.merchandise)}</span></div>
              <div className="kv"><span className="muted">Discount ({preview.discountPercent}%)</span><span>−{money(preview.discountAmount)}</span></div>
            </>
          )}
          <div className="kv total"><span>Total</span><span>{money(preview?.amount)}</span></div>
          {preview && (
            <div style={{ margin: '14px 0' }}>
              <div className="small muted" style={{ marginBottom: 6 }}>Credit after this order</div>
              <CreditMeter credit={preview.credit} />
            </div>
          )}
          <div className="stack" style={{ marginTop: 12 }}>
            {preview && <Notices errors={preview.errors} warnings={preview.warnings} />}
            <button className="btn primary" style={{ width: '100%' }} disabled={busy || !preview?.ok} onClick={submit}>
              {busy ? 'Placing Order…' : preview?.status === 'Hold' ? 'Place Order (On Hold)' : 'Place Order'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
