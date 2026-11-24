import { useEffect, useMemo, useState } from 'react';
import { get, money } from '../../api.js';
import { saveFile } from '../../components/ExportMenu.jsx';
import { Empty } from '../../components/bits.jsx';

const num = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const LEVEL = { 'In Stock': 'good', Low: 'warn', Out: 'bad', Incoming: 'done', Active: 'good', Inactive: '' };

function cell(c, v) {
  if (v == null || v === '') return <span className="muted">—</span>;
  if (c.type === 'money') return money(v);
  if (c.type === 'number') return num(v);
  if (c.type === 'date') return new Date(v + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (c.key === 'level' || c.key === 'status') return <span className={`pill ${LEVEL[v] ?? ''}`}>{v}</span>;
  return v;
}

// One table-style report: filters on top, sortable columns, totals, and CSV or Excel export.
export default function DataReport({ type, filters }) {
  const [f, setF] = useState({ q: '', collection: '', season: '', status: '', level: '', detail: '', only: '' });
  const [r, setR] = useState(null);
  const [sort, setSort] = useState({ key: '', dir: 1 });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const query = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();

  useEffect(() => {
    const t = setTimeout(() => get(`/admin/reports/data/${type}?${query}`).then(setR), 150);
    return () => clearTimeout(t);
  }, [type, query]);

  const rows = useMemo(() => {
    if (!r) return [];
    if (!sort.key) return r.rows;
    const numeric = ['number', 'money'].includes(r.columns.find((c) => c.key === sort.key)?.type);
    return [...r.rows].sort((a, b) => (numeric ? (Number(a[sort.key]) || 0) - (Number(b[sort.key]) || 0) : String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''))) * sort.dir);
  }, [r, sort]);

  if (!r) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const right = (c) => ['number', 'money'].includes(c.type);
  const exportAs = async (format) => {
    setBusy(format);
    setError('');
    try {
      const res = await fetch(`/api/admin/reports/data/${type}/export?${query}${query ? '&' : ''}format=${format}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'That export did not work.');
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `${type}-report.${format}`;
      await saveFile(await res.blob(), name);
    } catch (e) {
      if (e?.code !== 'declined') setError(e?.code ? 'Downloads are not available in this view.' : e.message);
    } finally {
      setBusy('');
    }
  };
  const styled = type !== 'customers';

  return (
    <div className="card">
      <div className="spread">
        <div>
          <h2 style={{ marginBottom: 4 }}>{r.title} <span className="pill dark" style={{ marginLeft: 8 }}>{r.count} Rows</span></h2>
          <p className="small muted" style={{ maxWidth: '60em', margin: 0 }}>{r.note}</p>
        </div>
        <div className="row">
          <button className="btn sm primary" disabled={!r.count || !!busy} onClick={() => exportAs('xlsx')}>{busy === 'xlsx' ? 'Preparing…' : 'Export Excel'}</button>
          <button className="btn sm" disabled={!r.count || !!busy} onClick={() => exportAs('csv')}>{busy === 'csv' ? 'Preparing…' : 'Export CSV'}</button>
        </div>
      </div>
      {error && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      <div className="reportbar">
        <input type="search" className="grow" placeholder={type === 'customers' ? 'Search customer, account, city or state' : 'Search style, name or color'} value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search" />
        {styled && (
          <>
            <select value={f.collection} onChange={(e) => set('collection', e.target.value)} aria-label="Collection">
              <option value="">All collections</option>
              {filters.collections.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={f.season} onChange={(e) => set('season', e.target.value)} aria-label="Season">
              <option value="">All seasons</option>
              {filters.seasons.map((s) => <option key={s.code} value={s.code}>{s.description}</option>)}
            </select>
            <select value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Style status">
              <option value="">Active styles</option>
              <option value="inactive">Inactive styles</option>
              <option value="all">Active and inactive</option>
            </select>
          </>
        )}
        {type === 'inventory' && (
          <>
            <select value={f.level} onChange={(e) => set('level', e.target.value)} aria-label="Stock level">
              <option value="">Any stock level</option>
              <option value="in">In stock</option>
              <option value="low">Low or out</option>
              <option value="out">Out of stock</option>
            </select>
            <select value={f.detail} onChange={(e) => set('detail', e.target.value)} aria-label="Detail">
              <option value="">One row per color</option>
              <option value="size">One row per size</option>
            </select>
          </>
        )}
        {type === 'customers' && (
          <select value={f.only} onChange={(e) => set('only', e.target.value)} aria-label="Show">
            <option value="">All customers</option>
            <option value="credit">Under 25% credit left</option>
            <option value="nologin">No buyer login yet</option>
          </select>
        )}
      </div>
      {r.count === 0 ? <Empty title="Nothing Matches">Clear a filter or change the search.</Empty> : (
        <div className="table-wrap reporttable">
          <table>
            <thead>
              <tr>
                {r.columns.map((c) => (
                  <th key={c.key} className={right(c) ? 'right' : ''} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sortbtn" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : right(c) ? -1 : 1 }))}>
                      {c.label}<span aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>{r.columns.map((c, j) => <td key={c.key} className={right(c) ? 'right' : ''}>{j === 0 ? <b>{cell(c, row[c.key])}</b> : cell(c, row[c.key])}</td>)}</tr>
              ))}
            </tbody>
            <tfoot>
              <tr>{r.columns.map((c, j) => <td key={c.key} className={right(c) ? 'right' : ''}>{j === 0 ? 'Total' : r.totals[c.key] != null ? cell(c, r.totals[c.key]) : ''}</td>)}</tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
