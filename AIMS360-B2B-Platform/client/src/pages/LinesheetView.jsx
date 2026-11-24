import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../api.js';
import { useCart } from '../cart.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { Wordmark } from '../theme.jsx';
import { canPrint } from '../components/bits.jsx';
import ExportMenu from '../components/ExportMenu.jsx';

export default function LinesheetView({ role }) {
  const { id } = useParams();
  const { cart } = useCart();
  const [l, setL] = useState(null);
  const [missing, setMissing] = useState(false);
  const customer = role === 'admin' ? cart.customerAccount : '';

  useEffect(() => {
    get(`/shop/linesheets/${id}?customer=${encodeURIComponent(customer || '')}`).then(setL).catch(() => setMissing(true));
  }, [id, customer]);

  if (missing) return <p className="muted">This linesheet is not available. <Link to="/linesheets"><b>Back to Linesheets</b></Link></p>;
  if (!l) return null;
  return (
    <div>
      <p className="small no-print"><Link to="/linesheets" className="muted">← Linesheets</Link></p>
      <div className="print-only"><Wordmark sub="Linesheet" /></div>
      <div className="spread">
        <div>
          <div className="eyebrow">{l.seasonName || 'Linesheet'}</div>
          <h1>{l.name}</h1>
          {l.description && <p className="muted" style={{ maxWidth: '46em' }}>{l.description}</p>}
        </div>
        <div className="row no-print">
          {canPrint && <button className="btn" onClick={() => window.print()}>Print</button>}
          {role === 'admin' && <Link to={`/linesheets/${l.id}/edit`} className="btn primary">Edit Linesheet</Link>}
        </div>
      </div>
      <ExportMenu orderForm url={(f) => `/api/shop/linesheets/${l.id}/export?format=${f}&customer=${encodeURIComponent(customer || '')}`} />
      <p className="small muted" style={{ marginTop: 10 }}>{l.items.length} styles · Prices shown are {role === 'admin' && !customer ? 'wholesale; choose a customer in the cart to see their prices' : role === 'admin' ? 'for the customer chosen in the cart' : 'your prices'}.</p>
      <div className="products" style={{ marginTop: 18 }}>
        {l.items.map((s) => <ProductCard key={s.style} s={s} />)}
      </div>
    </div>
  );
}
