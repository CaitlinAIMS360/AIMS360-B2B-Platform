// Reads live data from the viewer's own AIMS360 connector in Claude and hands
// it to the portal. Only works when the portal is open as a Claude artifact
// and the viewer has an AIMS360 connector; everywhere else it reports why not.
import { post } from './api.js';

// Connector names this page is allowed to call (must match the published manifest).
export const CONNECTORS = ['AIMS360 Fashion Consumer ERP', 'Aims360 Aplha'];
const today = () => new Date().toLocaleDateString('en-CA');

export async function getMcp() {
  try { return (await window.claude?.use?.('mcp')) || null; } catch { return null; }
}

// Which AIMS360 connectors this viewer can use here.
export async function listConnectors() {
  const mcp = await getMcp();
  if (!mcp) return { available: false, servers: [] };
  try {
    const { servers } = await mcp.listTools();
    return { available: true, servers: servers.filter((s) => CONNECTORS.includes(s.server) && s.tools.length > 0).map((s) => ({ name: s.server, status: s.authStatus })) };
  } catch {
    return { available: true, servers: [] };
  }
}

// A plain sentence for each way a connector call can fail.
export function explain(e, server) {
  const name = e?.server || server || 'the AIMS360 connector';
  switch (e?.code) {
    case 'needs_reauth': return `Your sign-in to ${name} has expired. Reconnect it in Claude under Settings, Connectors, then try again.`;
    case 'server_not_connected': return `${name} is not set up for your Claude account. Add it in Claude under Settings, Connectors.`;
    case 'selection_required': return `You have more than one connector named ${name}. Claude will ask which one to use; choose one, then try again.`;
    case 'not_in_manifest': return `This page is not allowed to use ${name} for you. Allow it in the artifact's Permissions menu, then try again.`;
    case 'approval_required': return `Claude needs your approval before this page can read from ${name}. Click Connect again and choose Allow.`;
    case 'blocked_by_policy': return `Your organization does not allow this page to use ${name}.`;
    case 'server_unavailable': return 'AIMS360 did not answer in time. Wait a moment and try again.';
    case 'tool_error': return `AIMS360 answered with an error: ${String(e.message || '').slice(0, 240)}`;
    default: return e?.message || 'Something went wrong reading from AIMS360.';
  }
}

function rowsOf(payload) {
  if (!payload) throw new Error('AIMS360 sent back an empty answer.');
  if (payload.questions) throw new Error((payload.notes && payload.notes[0]) || 'AIMS360 asked a question instead of answering.');
  return payload.answer?.rows || [];
}

// One read, with a single retry when the connector says a retry may help.
async function read(mcp, server, tool, input) {
  try {
    return (await mcp.callTool(server, tool, input)).payload;
  } catch (e) {
    if (!e?.retryable) throw e;
    await new Promise((r) => setTimeout(r, Math.min(e.retryAfterMs || 1500, 8000) + Math.random() * 500));
    return (await mcp.callTool(server, tool, input)).payload;
  }
}

// AIMS360 answers hold a limited amount per call, so long lists are read a page at a time, in key order.
async function readAll(mcp, server, tool, base, key, uid, onPage) {
  const seen = new Map();
  let last = null;
  let op = 'ge';
  for (let page = 0; page < 200; page++) {
    const input = { ...base, sortSpec: { fieldKey: key, direction: 'asc' }, fieldFilters: [...(base.fieldFilters || []), ...(last == null ? [] : [{ fieldKey: key, operator: op, value: last }])] };
    const payload = await read(mcp, server, tool, input);
    const rows = rowsOf(payload);
    const before = seen.size;
    for (const r of rows) seen.set(uid(r), r);
    const total = payload.resultSummary?.populationCount;
    onPage?.(seen.size, page === 0 ? total : undefined);
    if (!rows.length || rows.length < (base.limit || 1)) break;
    const next = rows[rows.length - 1][key];
    // A page that brought nothing new means one key has more rows than a page holds: step past it.
    if (seen.size === before) { if (op === 'gt') break; op = 'gt'; } else op = 'ge';
    last = next;
  }
  return [...seen.values()];
}

// Reads company, styles with sizes, customers and open-order dollars, then switches the portal to live data.
export async function connectLive(server, progress = () => {}) {
  const mcp = await getMcp();
  if (!mcp) throw new Error('Live AIMS360 data only works when the portal is opened in Claude.');
  const clientDate = today();
  progress('Checking which company this connector is signed in to…');
  const connection = await read(mcp, server, 'get_connection_details', {});
  let total = 0;
  const styles = await readAll(mcp, server, 'get_style_details', {
    queryKind: 'raw_list', outputMode: 'table', limit: 30, clientDate, filters: { statuses: ['Active'] },
    selectFields: ['sizes/sizeName'], userQuery: 'active style-colours with sizes, stock, WIP and open to sell'
  }, 'style', (r) => r.style + '|' + r.color, (n, t) => { total = t || total; progress(`Reading styles and inventory: ${n}${total ? ` of ${total}` : ''} style-colors…`); });
  const customers = await readAll(mcp, server, 'get_customer_details', {
    queryKind: 'raw_list', outputMode: 'table', limit: 60, clientDate, filters: { statuses: ['Active'] }, userQuery: 'active customers with terms, credit limit and A/R'
  }, 'customerAccount', (r) => r.customerAccount, (n) => progress(`Reading customers: ${n}…`));
  progress('Reading open orders for credit checks…');
  let openOrders = [];
  let openOrdersNote = '';
  try {
    openOrders = rowsOf(await read(mcp, server, 'order_analysis', {
      queryKind: 'grouped_summary', dimensionKey: 'customer', metricKey: 'open_amount', outputMode: 'table', limit: 5000, clientDate,
      filters: { statuses: ['Open', 'Hold'] }, userQuery: 'open amount on open and hold orders by customer'
    }));
  } catch (e) {
    openOrdersNote = 'Open orders in AIMS360 could not be read, so credit checks count A/R and portal orders only.';
  }
  progress('Switching the portal to live data…');
  const state = await post('/admin/live', { connector: server, connection, styles, customers, openOrders, at: new Date().toISOString() });
  return { state, openOrdersNote, styleColors: styles.map((r) => ({ style: r.style, color: r.color })) };
}

// Pictures arrive in the background, a batch at a time, so the catalog is usable straight away.
export async function loadPictures(server, items, onBatch, shouldStop = () => false) {
  const mcp = await getMcp();
  if (!mcp) return;
  let rest = items;
  for (let round = 0; rest.length && round < 80 && !shouldStop(); round++) {
    let payload;
    try {
      payload = await read(mcp, server, 'get_style_images', { items: rest.slice(0, 500), which: 'default', size: 'medium', delivery: 'data_url' });
    } catch {
      return;
    }
    const images = (payload?.images || []).map((p) => ({ style: p.style, color: p.color, dataUrl: p.dataUrl }));
    const missing = payload?.missing || [];
    if (!images.length && !missing.length) return;
    if (images.length) { const out = await post('/admin/live/pictures', { images }); onBatch?.(out.pictures); }
    const tail = rest.slice(500);
    rest = [...(payload?.remaining || []).map((r) => ({ style: r.style, color: r.color })), ...tail];
  }
}
