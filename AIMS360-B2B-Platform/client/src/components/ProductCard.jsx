import { Link } from 'react-router-dom';
import { money, shortDate } from '../api.js';

// base: where a card links to. guest: no stock badge, and prices only if the brand allows.
export default function ProductCard({ s, base = '/catalog', guest }) {
  return (
    <Link to={`${base}/${s.style}`} className="product">
      <div className="ph">
        <img src={s.colors[0].image} alt={`${s.description} in ${s.colors[0].colorDescription}`} loading="lazy" />
        {s.status === 'Inactive' && <span className="pill bad" style={{ top: 'auto', bottom: 12 }}>Inactive</span>}
        {!guest && (s.soldOut ? <span className="pill">Sold Out</span> : s.availableNow ? <span className="pill good">In Stock</span> : <span className="pill warn">Arrives {shortDate(s.available).replace(/, \d{4}$/, '')}</span>)}
      </div>
      <div className="body">
        <div className="code">{s.style}</div>
        <div className="name">{s.description}</div>
        <div className="spread">
          <span>
            {s.price != null && <span className="price">{money(s.price)} </span>}
            {s.retail != null && <span className="small muted">MSRP {money(s.retail)}</span>}
            {s.price == null && s.retail == null && <span className="small muted">Sign in for pricing</span>}
          </span>
          <span className="swatches">
            {s.colors.map((c) => <span key={c.color} className="swatch" style={{ background: c.hex }} title={c.colorDescription} />)}
          </span>
        </div>
      </div>
    </Link>
  );
}
