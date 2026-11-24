import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, money } from '../api.js';
import { useCart } from '../cart.jsx';
import { Wordmark } from '../theme.jsx';
import { canPrint } from '../components/bits.jsx';
import ExportMenu from '../components/ExportMenu.jsx';

// Build an OTS (open-to-sell) report or linesheet from chosen style-colors,
// then print it, save it as a PDF, or export it to CSV.
export default function OtsReport({ role }) {
  const { cart } = useCart();
  const customer = role === 'admin' ? cart.customerAccount : '';
  const [data, setData] = useState(null);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const [images, setImages] = useState(true);
  const [detail, setDetail] = useState('size');
  const [basis, setBasis] = useState('now');

  useEffect(() => { get(`/shop/catalog?customer=${encodeURIComponent(customer || '')}`).then(setData); }, [customer]);

  const rows = useMemo(
    () => (data?.items || []).flatMap((s) => s.colors.map((c) => ({ key: `${s.style}|${c.color}`, s, c }))),
    [data]
  );
  const shown = rows.filter((r) => (!category || r.s.category === category) && (!q || `${r.s.style} ${r.s.description} ${r.c.colorDescription}`.toLowerCase().includes(q.toLowerCase())));
  const report = rows.filter((r) => picked.includes(r.key));
  const qty = (z) => (basis === 'now' ? z.ots_i : z.ots);
  const total = (c) => c.sizes.reduce((t, z) => t + Math.max(0, qty(z)), 0);

  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k].slice(0, 100)));
  const selectShown = () => setPicked((p) => [...new Set([...p, ...shown.map((r) => r.key)])].slice(0, 100));
  const useCartStyles = () => setPicked((p) => [...new Set([...p, ...cart.lines.map((l) => `${l.style}|${l.color}`)])]);

  const exportUrl = (format) =>
    `/api/shop/ots-report/export?${new URLSearchParams({ format, keys: report.map((r) => r.key).join(','), basis, detail, images: images ? '1' : '0', customer: customer || '' })}`;

  if (!data) return null;
  const stamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="stack">
      <p className="small no-print"><Link to="/linesheets" className="muted">← Linesheets</Link></p>
      <div className="no-print">
        <div className="eyebrow">Reports</div>
        <h1>OTS Report</h1>
        <p className="muted" style={{ maxWidth: '48em' }}>Pick style-colors to build an availability report with current prices. Export it as a PDF, Excel or CSV file, or print it.</p>
      </div>

      <div className="card no-print">
        <div className="shopbar">
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Collection" style={{ width: 220 }}>
            <option value="">All Collections</option>
            {data.facets.categories.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
          <input type="search" className="grow" placeholder="Find style or color" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find style or color" />
        </div>
        <div className="row" style={{ margin: '4px 0 14px' }}>
          <button className="btn sm" onClick={selectShown}>Select Filtered Styles</button>
          {cart.lines.length > 0 && <button className="btn sm" onClick={useCartStyles}>Use Styles in My Cart</button>}
          {picked.length > 0 && <button className="btn ghost sm" onClick={() => setPicked([])}>Clear Selection</button>}
          <span className="small muted">{picked.length} selected · {shown.length} match · up to 100 per report</span>
        </div>
        <div className="otspick">
          {shown.map((r) => (
            <label key={r.key} className={picked.includes(r.key) ? 'on' : ''}>
              <input type="checkbox" checked={picked.includes(r.key)} onChange={() => toggle(r.key)} />
              <span className="swatch" data-none={r.c.hex ? undefined : ''} style={{ background: r.c.hex }} />
              <span className="grow"><b>{r.s.style}</b> · {r.c.colorDescription}<span className="small muted" style={{ display: 'block' }}>{r.s.description}</span></span>
            </label>
          ))}
        </div>
      </div>

      <div className="card no-print">
        <div className="spread">
          <div className="row">
            <label className="check"><input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} /><span>Include Images</span></label>
            <select value={detail} onChange={(e) => setDetail(e.target.value)} aria-label="OTS detail" style={{ width: 210 }}>
              <option value="size">Quantity per Size</option>
              <option value="total">Style-Color Total Only</option>
            </select>
            <select value={basis} onChange={(e) => setBasis(e.target.value)} aria-label="Availability basis" style={{ width: 230 }}>
              <option value="now">Stock Available Now</option>
              <option value="future">Stock Plus Incoming (WIP)</option>
            </select>
          </div>
          <div className="row">
            <ExportMenu url={exportUrl} disabled={!report.length} />
            {canPrint && <button className="btn sm" disabled={!report.length} onClick={() => window.print()}>Print</button>}
          </div>
        </div>
      </div>

      {report.length > 0 && (
        <div className="card otsreport">
          <div className="print-only"><Wordmark sub="OTS Report" /></div>
          <div className="spread">
            <h2>{report.length} Style-Color{report.length > 1 ? 's' : ''}</h2>
            <span className="small muted">{basis === 'now' ? 'Stock available now' : 'Stock plus incoming production'} · As of {stamp}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>{images && <th />}<th>Style</th><th>Color</th><th>{detail === 'size' ? 'OTS by Size' : ''}</th><th className="right">Total OTS</th><th className="right">Price</th><th className="right">MSRP</th></tr></thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.key}>
                    {images && <td style={{ width: 64 }}><img className="otsimg" src={r.c.image} alt="" /></td>}
                    <td><b>{r.s.style}</b><div className="small muted">{r.s.description}</div></td>
                    <td>{r.c.colorDescription}</td>
                    <td>{detail === 'size' && <div className="otssizes">{r.c.sizes.map((z) => <span key={z.sizeName}><i>{z.sizeName}</i><b>{Math.max(0, qty(z))}</b></span>)}</div>}</td>
                    <td className="right"><b>{total(r.c)}</b></td>
                    <td className="right">{money(r.s.price)}</td>
                    <td className="right">{money(r.s.retail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Availability can change; quantities are not reserved.</p>
        </div>
      )}
    </div>
  );
}
