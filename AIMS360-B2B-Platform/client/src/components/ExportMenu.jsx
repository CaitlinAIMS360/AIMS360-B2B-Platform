import { useState } from 'react';

// Download buttons for a linesheet or OTS report. `url(format)` builds the link.
// Inside a Claude artifact the file is handed to the viewer's save prompt;
// everywhere else it downloads like any other file.
export async function saveFile(blob, filename) {
  const cap = await window.claude?.use?.('downloads');
  if (cap) return cap.save({ filename, data: blob });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export default function ExportMenu({ url, disabled, orderForm }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const items = [
    ['pdf', 'PDF'],
    ['xlsx', 'Excel'],
    ['csv', 'CSV'],
    ...(orderForm ? [['orderform', 'Excel Order Form']] : [])
  ];
  const run = async (f) => {
    setBusy(f);
    setError('');
    try {
      const res = await fetch(url(f), { credentials: 'same-origin' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'That export did not work.');
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `export.${f === 'orderform' ? 'xlsx' : f}`;
      await saveFile(await res.blob(), name);
    } catch (e) {
      if (e?.code !== 'declined') setError(e?.code ? 'Downloads are not available in this view.' : e.message);
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="exportmenu no-print">
      <span className="small muted">Export</span>
      {items.map(([f, label]) => (
        <button key={f} className={`btn sm ${f === 'pdf' ? 'primary' : ''}`} disabled={disabled || !!busy} onClick={() => run(f)}>
          {busy === f ? 'Preparing…' : label}
        </button>
      ))}
      {error && <span className="small" style={{ color: 'var(--bad)' }} role="alert">{error}</span>}
    </div>
  );
}
