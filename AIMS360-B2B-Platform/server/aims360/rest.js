// Direct connection to the AIMS360 REST API, for the hosted portal.
// Endpoints come from the AIMS360-API-Endpoints Postman collection:
//   GET  {BaseURL}/StyleColors/v1.5/StyleColors?$expand=sizes
//   GET  {BaseURL}/Customers/v1.4/customers
//   GET  {BaseURL}/authentication/v1/authentication/tokendetails
//   POST {BaseURL}/orders/v1.4/order
// Settings (see .env.example): AIMS360_BASE_URL, AIMS360_TOKEN, and
// AIMS360_SEND_ORDERS=true to create orders in AIMS360.
import { applyLive, liveState } from './live.js';

const env = (k) => (process.env[k] || '').trim();
export const restConfigured = () => !!(env('AIMS360_BASE_URL') && env('AIMS360_TOKEN'));
export const sendsOrders = () => restConfigured() && env('AIMS360_SEND_ORDERS').toLowerCase() === 'true';
const base = () => env('AIMS360_BASE_URL').replace(/\/+$/, '');

async function call(path, { method = 'GET', body } = {}) {
  const url = /^https?:/.test(path) ? path : base() + path;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${env('AIMS360_TOKEN')}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000)
    });
  } catch (e) {
    throw Object.assign(new Error(`AIMS360 could not be reached (${e.name === 'TimeoutError' ? 'it took too long to answer' : e.message}).`), { status: 502 });
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const said = data?.message || data?.error?.message || data?.title || text.slice(0, 200);
    const why = res.status === 401 || res.status === 403 ? 'AIMS360 did not accept the access token. It may have expired; put a new one in AIMS360_TOKEN.' : `AIMS360 answered ${res.status}${said ? `: ${said}` : ''}`;
    throw Object.assign(new Error(why), { status: res.status === 401 || res.status === 403 ? 502 : 400, aimsStatus: res.status });
  }
  return data;
}

// Reads every row of an OData list: follows the next-page link when the API gives one, otherwise pages with $top and $skip.
async function readAll(path, pageSize = 200) {
  const rows = [];
  const join = path.includes('?') ? '&' : '?';
  let next = `${path}${join}$top=${pageSize}`;
  for (let page = 0; next && page < 500; page++) {
    const data = await call(next);
    const batch = Array.isArray(data) ? data : data?.value || [];
    rows.push(...batch);
    const link = !Array.isArray(data) && (data?.['@odata.nextLink'] || data?.nextLink);
    if (link) next = link;
    else if (batch.length === pageSize) next = `${path}${join}$top=${pageSize}&$skip=${rows.length}`;
    else next = null;
  }
  return rows;
}

async function connection() {
  try {
    const d = await call(`/authentication/v1/authentication/tokendetails?AccessToken=${encodeURIComponent(env('AIMS360_TOKEN'))}`);
    if (d?.account) return d;
  } catch { /* fall back to the names in settings */ }
  return { account: env('AIMS360_ACCOUNT') || 'AIMS360', companyName: env('AIMS360_COMPANY_NAME') || '' };
}

// Reads the company's active styles (with sizes) and customers, then switches the portal to live data.
export async function refreshFromRest() {
  if (!restConfigured()) throw Object.assign(new Error('The AIMS360 connection is not set up. Add AIMS360_BASE_URL and AIMS360_TOKEN to the settings.'), { status: 400 });
  const [conn, styles, customers] = await Promise.all([
    connection(),
    readAll("/StyleColors/v1.5/StyleColors?$expand=sizes&$filter=status eq 'Active'"),
    readAll("/Customers/v1.4/customers?$filter=status eq 'Active'")
  ]);
  applyLive({ connector: 'AIMS360 REST API', connection: conn, styles, customers, openOrders: [], at: new Date().toISOString() });
  return liveState();
}

// ~ POST /orders/v1.4/order. Returns what AIMS360 sent back (its order number is read by the caller).
export const createOrderInAims = (payload) => call('/orders/v1.4/order', { method: 'POST', body: payload });
