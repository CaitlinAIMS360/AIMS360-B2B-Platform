import ProductCard from './ProductCard.jsx';

// The top of a linesheet: a hero photo with the name over it, or a plain heading.
export function LinesheetHeading({ l }) {
  const text = (
    <>
      <div className="eyebrow">{l.seasonName || 'Linesheet'}</div>
      <h1>{l.name}</h1>
      {l.description && <p className={l.hero ? '' : 'muted'} style={{ maxWidth: '46em' }}>{l.description}</p>}
    </>
  );
  if (!l.hero) return <div>{text}</div>;
  return (
    <div className="hero-banner">
      <img src={l.hero} alt="" />
      <div className="hero-text">{text}</div>
    </div>
  );
}

// The styles, grouped under their dividers, with quick links to each drop.
export default function LinesheetBody({ l, base, guest }) {
  const titled = l.sections.filter((s) => s.title);
  const jump = (id) => document.getElementById(`drop-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <>
      {titled.length > 1 && (
        <div className="dropnav no-print" role="navigation" aria-label="Jump to a drop">
          {titled.map((s) => <button key={s.id} type="button" className="btn sm" onClick={() => jump(s.id)}>{s.title}</button>)}
        </div>
      )}
      {l.sections.map((s) => (
        <section key={s.id}>
          {s.title && (
            <div className="drop-head" id={`drop-${s.id}`}>
              <h2>{s.title}</h2>
              {s.note && <span className="note">{s.note}</span>}
              <span className="count">{s.items.length} style{s.items.length === 1 ? '' : 's'}</span>
            </div>
          )}
          <div className="products" style={{ marginTop: 18 }}>
            {s.items.map((x) => <ProductCard key={x.style} s={x} base={base} guest={guest} />)}
          </div>
          {s.title && s.items.length === 0 && <p className="muted small">No styles in this drop yet.</p>}
        </section>
      ))}
    </>
  );
}
