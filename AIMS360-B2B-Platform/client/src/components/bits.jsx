import { useState } from 'react';

export function StatusPill({ order }) {
  const cls = { Open: 'good', Hold: 'warn', Cancelled: 'bad', Shipped: 'done' }[order.status] || '';
  const label =
    order.status === 'Hold' && order.orderStatusReason === 'CR' ? 'Hold · Credit Review' : order.status;
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function TypePill({ order }) {
  if (!order.orderType) return null;
  return (
    <span className="pill dark">
      {order.orderType.label}
      {order.distributionOrder ? ' Release' : ''}
    </span>
  );
}

export function Notices({ errors = [], warnings = [] }) {
  return (
    <>
      {errors.length > 0 && (
        <div className="notice bad" role="alert">
          <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="notice warn">
          <ul>{warnings.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
    </>
  );
}

export function CreditMeter({ credit }) {
  if (!credit || !credit.limit) return <p className="muted small">No credit limit set on this account.</p>;
  const used = credit.exposure;
  const pct = Math.min(100, Math.round((used / credit.limit) * 100));
  return (
    <div>
      <div className={`meter ${credit.over ? 'over' : ''}`}><i style={{ width: `${pct}%` }} /></div>
      <div className="small muted" style={{ marginTop: 6 }}>
        {pct}% of credit limit used
      </div>
    </div>
  );
}

// A button that asks "are you sure" in place, without a browser pop-up.
export function ConfirmButton({ label, confirmLabel = 'Yes, Continue', className = 'btn danger', onConfirm }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button className={className} onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span className="row" role="group" aria-label={label}>
      <button className="btn danger" onClick={() => { setAsking(false); onConfirm(); }}>{confirmLabel}</button>
      <button className="btn" onClick={() => setAsking(false)}>Keep It</button>
    </span>
  );
}

// Printing is not available when the portal runs as a Claude artifact.
export const canPrint = import.meta.env.MODE !== 'artifact';

// Quantities by size as small tags: the size on the left, the quantity on the right.
export function Sizes({ items }) {
  return (
    <span className="sizetags">
      {items.filter(([, q]) => Number(q) > 0).map(([name, q]) => <span key={name} className="sizetag"><i>{name}</i>{q}</span>)}
    </span>
  );
}

// A friendly "nothing here" panel.
export function Empty({ title, children }) {
  return (
    <div className="empty">
      <div className="empty-dot" aria-hidden="true" />
      <b>{title}</b>
      {children && <div className="muted small">{children}</div>}
    </div>
  );
}
