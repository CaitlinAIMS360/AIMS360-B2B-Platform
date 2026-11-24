import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { listConnectors, connectLive, loadPictures, explain } from '../../live.js';

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

// The strip across the top of every screen: says plainly whether the numbers are samples or live.
export function DataBanner({ config, admin }) {
  const live = config.mode === 'live' ? config.live : null;
  return (
    <div className={`demo-banner ${live ? 'live' : ''}`}>
      {live
        ? <>Live AIMS360 data: {live.account} · {live.companyName} · as of {when(live.at)}. {config.sendsOrders ? 'Orders placed here are created in AIMS360.' : 'Orders placed here stay in the portal and are not sent to AIMS360 yet.'}</>
        : <>Demo mode: sample data, nothing is sent to AIMS360.</>}
      {admin && config.canConnect && <Link to="/admin/connect" className="banner-link">{live ? 'Refresh or Change' : 'Connect AIMS360'}</Link>}
    </div>
  );
}

let pictureRun = 0;

export default function Connect({ onChange }) {
  const [info, setInfo] = useState(null);
  const [state, setState] = useState(null);
  const [server, setServer] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [pics, setPics] = useState(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    api('GET', '/admin/live').then((s) => { setState(s); if (s.connector) setServer(s.connector); });
    listConnectors().then((i) => { setInfo(i); setServer((cur) => cur || i.servers[0]?.name || ''); });
    return () => { alive.current = false; };
  }, []);

  const connect = async () => {
    setBusy(true);
    setError('');
    setNote('');
    const run = ++pictureRun;
    try {
      const out = await connectLive(server, (s) => alive.current && setStep(s));
      setState(out.state);
      setNote(out.openOrdersNote);
      onChange?.();
      setPics({ done: 0, of: out.styleColors.length });
      // Pictures keep arriving after this screen is left; a new connect or a switch back to samples stops them.
      loadPictures(server, out.styleColors, (n) => {
        if (alive.current) setPics({ done: n, of: out.styleColors.length });
        window.dispatchEvent(new Event('portal:pictures'));
      }, () => run !== pictureRun).then(() => alive.current && setPics((p) => (p ? { ...p, finished: true } : p)));
    } catch (e) {
      setError(explain(e, server));
    } finally {
      setBusy(false);
      setStep('');
    }
  };
  const useSamples = async () => {
    pictureRun++;
    setError('');
    setPics(null);
    setState(await api('DELETE', '/admin/live'));
    onChange?.();
  };

  if (!info || !state) return null;
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div>
        <div className="eyebrow">Data Source</div>
        <h1>Connect AIMS360</h1>
        <p className="muted">Show real styles, inventory and customers from an AIMS360 company instead of the samples. The portal reads through your own AIMS360 connector in Claude, with your AIMS360 sign-in.</p>
      </div>

      <div className="card">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Now Showing</h2>
          <span className={`pill ${state.on ? 'good' : ''}`}>{state.on ? 'Live Data' : 'Sample Data'}</span>
        </div>
        {state.on ? (
          <>
            <div className="grid cols-4" style={{ marginTop: 16 }}>
              <div className="card flat stat"><div className="l">Company</div><div><b>{state.account}</b></div><div className="small muted">{state.companyName}</div></div>
              <div className="card flat stat"><div className="l">Styles</div><div className="n">{state.styles}</div><div className="small muted">{state.styleColors} style-colors</div></div>
              <div className="card flat stat"><div className="l">Customers</div><div className="n">{state.customers}</div><div className="small muted">Active accounts</div></div>
              <div className="card flat stat"><div className="l">Read At</div><div><b>{when(state.at)}</b></div><div className="small muted">{state.user}</div></div>
            </div>
            <p className="small muted" style={{ marginTop: 14, marginBottom: 0 }}>
              Active styles and customers only. Stock, WIP and OTS are as of the time above; click Refresh to read them again.
              {pics && <> Pictures: {pics.finished ? `${pics.done} found for ${pics.of} style-colors.` : `${pics.done} loaded so far…`}</>}
            </p>
          </>
        ) : <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>Made-up styles, customers and orders for demos.</p>}
      </div>

      <div className="card">
        <h2>{state.on ? 'Refresh or Change Company' : 'Connect'}</h2>
        {!info.available ? (
          <div className="notice warn">Live AIMS360 data works when this portal is opened in Claude by someone with an AIMS360 connector. It is not available in this view.</div>
        ) : info.servers.length === 0 ? (
          <div className="notice warn">No AIMS360 connector was found for your Claude account. Add one in Claude under Settings, Connectors, then reopen this page.</div>
        ) : (
          <>
            <div className="field" style={{ maxWidth: 420 }}>
              <label htmlFor="cx">AIMS360 Connector</label>
              <select id="cx" value={server} onChange={(e) => setServer(e.target.value)} disabled={busy}>
                {info.servers.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <p className="small muted">Each connector is signed in to one AIMS360 company. To show a different company's database, choose the connector that is signed in to it. The company name appears above once it connects, so you can confirm it is the right one.</p>
            <div className="row">
              <button className="btn primary" disabled={busy || !server} onClick={connect}>{busy ? 'Reading From AIMS360…' : state.on ? 'Refresh Live Data' : 'Connect and Show Live Data'}</button>
              {state.on && !busy && <button className="btn" onClick={useSamples}>Switch Back to Sample Data</button>}
            </div>
            {busy && <p className="small" style={{ marginTop: 12, marginBottom: 0, color: 'var(--accent-text)' }} role="status">{step} This can take a minute for a large catalog.</p>}
          </>
        )}
        {error && <div className="notice bad" role="alert" style={{ marginTop: 14 }}>{error}</div>}
        {note && <div className="notice warn" style={{ marginTop: 14 }}>{note}</div>}
      </div>

      <div className="card flat">
        <h2>What Live Mode Does and Does Not Do</h2>
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Reads active styles with sizes, stock, WIP and OTS, plus active customers with terms, credit limit and A/R.</li>
          <li>Credit checks count A/R, open orders already in AIMS360, and orders placed here.</li>
          <li>Prices are wholesale. Customer price sheets are not read yet.</li>
          <li>Orders placed here are saved in the portal only. They are not created in AIMS360 yet.</li>
          <li>Nothing is estimated: no warehouse split, no color swatches, and no stand-in pictures.</li>
          <li>Each person sees live data through their own AIMS360 connector, so your team needs the same connector in their Claude account.</li>
        </ul>
      </div>
    </div>
  );
}
