import { useEffect, useState } from 'react';
import { get, put } from '../../api.js';

export default function Settings({ onSaved }) {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { get('/admin/settings').then(setS); }, []);
  if (!s) return null;

  const set = (k, v) => { setSaved(false); setS((x) => ({ ...x, [k]: v })); };
  const setWindow = (i, k, v) => set('deliveryWindows', s.deliveryWindows.map((w, j) => (j === i ? { ...w, [k]: v } : w)));
  const save = async () => {
    const out = await put('/admin/settings', s);
    setS(out);
    setSaved(true);
    onSaved?.(out);
  };
  const Toggle = ({ k, label, help }) => (
    <label className="check" style={{ marginBottom: 12 }}>
      <input type="checkbox" checked={!!s[k]} onChange={(e) => set(k, e.target.checked)} />
      <span>{label}{help && <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>{help}</span>}</span>
    </label>
  );

  return (
    <div className="stack">
      <div className="spread">
        <div><h1>Settings</h1><p className="muted">These rules apply to every buyer on this brand's portal.</p></div>
        <div className="row">{saved && <span className="pill good">Saved</span>}<button className="btn primary" onClick={save}>Save Settings</button></div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Brand</h2>
          <div className="field"><label htmlFor="s-bn">Brand name</label><input id="s-bn" value={s.brandName} onChange={(e) => set('brandName', e.target.value)} /></div>
          <div className="field">
            <label htmlFor="s-ac">Accent colour</label>
            <div className="row"><input id="s-ac" type="color" style={{ width: 56, padding: 2, height: 40 }} value={s.accentColor} onChange={(e) => set('accentColor', e.target.value)} /><span className="muted small">{s.accentColor}</span></div>
          </div>
        </div>

        <div className="card">
          <h2>Guest Browsing</h2>
          <Toggle k="guestBrowsing" label="Let anyone with the link browse the catalog" help="Guests never see stock and cannot order. They can request access." />
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="s-gp">Prices Guests See</label>
            <select id="s-gp" value={s.guestPrices} onChange={(e) => set('guestPrices', e.target.value)}>
              <option value="none">No prices</option>
              <option value="msrp">MSRP only</option>
              <option value="wholesale">Default wholesale and MSRP</option>
            </select>
          </div>
        </div>

        <div className="card">
          <h2>Inventory Display</h2>
          <Toggle k="showExactStock" label="Show exact stock counts to buyers" help="Off shows “In stock” or “Low” instead of a number." />
          <Toggle k="hideSoldOut" label="Hide sold-out styles" />
          <Toggle k="allowOversellImmediate" label="Allow Immediate orders above stock on hand" help="Off blocks the order; on shows a warning only." />
          <div className="field" style={{ maxWidth: 220 }}><label htmlFor="s-low">Low stock at or below</label><input id="s-low" type="number" min="0" value={s.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} /></div>
        </div>

        <div className="card">
          <h2>Order Minimums</h2>
          <div className="grid cols-2">
            <div className="field"><label htmlFor="s-mu">Minimum units per order</label><input id="s-mu" type="number" min="0" value={s.minOrderUnits} onChange={(e) => set('minOrderUnits', e.target.value)} /></div>
            <div className="field"><label htmlFor="s-ma">Minimum order amount ($)</label><input id="s-ma" type="number" min="0" value={s.minOrderAmount} onChange={(e) => set('minOrderAmount', e.target.value)} /></div>
          </div>
          <p className="muted small">Set to 0 for no minimum.</p>
        </div>

        <div className="card">
          <h2>Terms and Conditions</h2>
          <Toggle k="requireTerms" label="Buyers must accept terms at checkout" />
          <textarea rows={4} value={s.termsText} onChange={(e) => set('termsText', e.target.value)} aria-label="Terms text" />
        </div>
      </div>

      <div className="card">
        <div className="spread"><h2>Delivery Windows (Prebook)</h2>
          <button className="btn sm" onClick={() => set('deliveryWindows', [...s.deliveryWindows, { name: '', start: '', complete: '' }])}>Add Window</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Ship start</th><th>Complete by</th><th /></tr></thead>
            <tbody>
              {s.deliveryWindows.map((w, i) => (
                <tr key={w.id || i}>
                  <td><input value={w.name} onChange={(e) => setWindow(i, 'name', e.target.value)} aria-label="Window name" /></td>
                  <td><input type="date" value={w.start} onChange={(e) => setWindow(i, 'start', e.target.value)} aria-label="Ship start" /></td>
                  <td><input type="date" value={w.complete} onChange={(e) => setWindow(i, 'complete', e.target.value)} aria-label="Complete by" /></td>
                  <td className="right"><button className="btn ghost sm danger" onClick={() => set('deliveryWindows', s.deliveryWindows.filter((_, j) => j !== i))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card flat">
        <h2>Fixed Rules in This Build</h2>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Orders are created Open. An order goes on Hold when A/R plus open orders plus the new order is over the customer's credit limit.
          Order type is required and is saved to the AIMS360 Order Type field (I, PB, B); Bulk also sets the AIMS360 bulk order flag.
          A cart with styles from more than one season is split into one order per season.
        </p>
      </div>
    </div>
  );
}
