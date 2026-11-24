import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { get, money, shortDate } from '../api.js';
import { useCart } from '../cart.jsx';

// Size-grid ordering: one row per colour, one box per size. Tab moves across.
export default function StylePage({ role }) {
  const { style } = useParams();
  const nav = useNavigate();
  const { cart, setLine } = useCart();
  const [s, setS] = useState(null);
  const [active, setActive] = useState(0);
  const [grid, setGrid] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    get(`/shop/catalog/${style}?customer=${encodeURIComponent(role === 'admin' ? cart.customerAccount || '' : '')}`).then((d) => {
      setS(d);
      const g = {};
      for (const c of d.colors) g[c.color] = { ...(cart.lines.find((l) => l.style === d.style && l.color === c.color)?.sizes || {}) };
      setGrid(g);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  // Prebook and Bulk draw on WIP as well as stock; Immediate (or no type yet) shows stock only.
  const future = cart.orderType === 'PB' || cart.orderType === 'B';

  const totals = useMemo(() => {
    let units = 0;
    for (const sizes of Object.values(grid)) for (const q of Object.values(sizes)) units += Number(q) || 0;
    return { units, amount: units * (s?.price || 0) };
  }, [grid, s]);

  if (!s) return null;
  const sizeNames = s.colors[0].sizes.map((z) => z.sizeName);

  const set = (color, size, v) => {
    setSaved(false);
    setGrid((g) => ({ ...g, [color]: { ...g[color], [size]: v.replace(/[^\d]/g, '') } }));
  };

  const add = () => {
    for (const c of s.colors) setLine(s.style, c.color, grid[c.color] || {}, { description: s.description, colorDescription: c.colorDescription, image: c.image, price: s.price, season: s.season });
    setSaved(true);
  };

  return (
    <div>
      <p className="small"><Link to="/catalog" className="muted">← Catalog</Link></p>
      <div className="style-layout">
        <div>
          <img className="hero-img" src={s.colors[active].image} alt={`${s.description} in ${s.colors[active].colorDescription}`} />
          <div className="thumbs">
            {s.colors.map((c, i) => (
              <button key={c.color} className={i === active ? 'on' : ''} onClick={() => setActive(i)} aria-label={c.colorDescription}>
                <img src={c.image} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="stack">
          <div>
            <div className="eyebrow">{s.style} · {s.category} · {s.season}</div>
            <h1>{s.description}</h1>
            <div style={{ fontSize: 22 }}><b>{money(s.price)}</b> <span className="small muted">{role === 'admin' ? (cart.customerAccount ? 'customer price' : 'wholesale') : 'your price'} · MSRP {money(s.retail)} · {s.priceSource}</span></div>
          </div>

          <div className="card">
            <div className="spread">
              <h2>Order by Size</h2>
              <span className="small muted">
                Showing {future ? 'stock plus incoming production' : 'stock available now'}
                {!s.availableNow && ` · arrives ${shortDate(s.available)}`}
              </span>
            </div>
            <div className="table-wrap">
              <table className="sizegrid">
                <thead>
                  <tr><th>Colour</th>{sizeNames.map((n) => <th key={n}>{n}</th>)}<th>Units</th></tr>
                </thead>
                <tbody>
                  {s.colors.map((c, ci) => {
                    const rowUnits = Object.values(grid[c.color] || {}).reduce((t, q) => t + (Number(q) || 0), 0);
                    return (
                      <tr key={c.color} onFocus={() => setActive(ci)}>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <span className="swatch" style={{ background: c.hex }} />
                            <b>{c.colorDescription}</b>
                          </div>
                        </td>
                        {c.sizes.map((z) => {
                          const a = future ? z.future : z.now;
                          const max = future ? z.ots : z.ots_i;
                          const q = Number(grid[c.color]?.[z.sizeName]) || 0;
                          return (
                            <td key={z.sizeName}>
                              <input
                                inputMode="numeric"
                                aria-label={`${c.colorDescription} size ${z.sizeName}`}
                                value={grid[c.color]?.[z.sizeName] ?? ''}
                                onChange={(e) => set(c.color, z.sizeName, e.target.value)}
                                placeholder="0"
                                style={q > max ? { borderColor: 'var(--bad)' } : undefined}
                              />
                              <div className={`avail ${a.level}`}>{a.text}</div>
                            </td>
                          );
                        })}
                        <td><b>{rowUnits || ''}</b></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="spread" style={{ marginTop: 16 }}>
              <div><b>{totals.units}</b> units · <b>{money(totals.amount)}</b></div>
              <div className="row">
                {saved && <span className="pill good">Saved to Cart</span>}
                <button className="btn" onClick={add}>{saved ? 'Update Cart' : 'Add to Cart'}</button>
                <button className="btn primary" onClick={() => { add(); nav('/cart'); }}>Go to Cart</button>
              </div>
            </div>
          </div>

          {s.warehouses && (
            <div className="card flat">
              <h2>Stock by Warehouse</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Colour</th>{s.warehouses[0].stock.map((w) => <th key={w.code} className="right">{w.name} ({w.code})</th>)}</tr></thead>
                  <tbody>
                    {s.warehouses.map((c) => (
                      <tr key={c.color}><td><b>{c.colorDescription}</b></td>{c.stock.map((w) => <td key={w.code} className="right">{w.units}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
