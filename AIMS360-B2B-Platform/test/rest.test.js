// The direct AIMS360 connection, tested against a stand-in API that pages like OData.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const sizes = () => ['S', 'M', 'L'].map((n, i) => ({ sizeName: n, sizeStatus: 'Active', stockQuantity: 10 * (i + 1), wipQuantity: 2, ots: 10 * (i + 1) + 1, ots_i: 10 * (i + 1) - 1, upc: '' }));
const styles = Array.from({ length: 450 }, (_, i) => ({ style: 'RS' + (1000 + Math.floor(i / 2)), color: i % 2 ? '002' : '001', colorDescription: i % 2 ? 'Green' : 'Black', description: 'Rest Style', status: 'Active', seasonCode: 'Y', divisionCode: 'A', wholesalePrice: 20, suggestedRetailPrice: 50, sizes: sizes() }));
const customers = Array.from({ length: 30 }, (_, i) => ({ customerAccount: 'R' + (100 + i), customerName: 'Rest Customer ' + i, termDescription: 'NET 30', creditLimit: 1000, totalAR: 100, city: 'Reno', state: 'NV' }));
const posted = [];
let token = 'good-token';

const api = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.headers.authorization !== `Bearer ${token}`) return send(401, { message: 'bad token' });
  const page = (all) => { const top = Number(u.searchParams.get('$top')) || 50; const skip = Number(u.searchParams.get('$skip')) || 0; return { value: all.slice(skip, skip + top) }; };
  if (u.pathname === '/authentication/v1/authentication/tokendetails') return send(200, { account: 'RESTX', companyName: 'REST TEST CO', databaseName: 'db' });
  if (u.pathname === '/StyleColors/v1.5/StyleColors') { assert.match(u.searchParams.get('$expand'), /sizes/); return send(200, page(styles)); }
  if (u.pathname === '/Customers/v1.4/customers') return send(200, page(customers));
  if (u.pathname === '/orders/v1.4/order' && req.method === 'POST') {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => { posted.push(JSON.parse(body)); send(200, { order: '1000200001' }); });
    return;
  }
  send(404, { message: 'no such route' });
});

test('direct AIMS360 connection reads live data and can create orders', async () => {
  await new Promise((r) => api.listen(0, r));
  process.env.AIMS360_BASE_URL = `http://127.0.0.1:${api.address().port}/`;
  process.env.AIMS360_TOKEN = token;
  process.env.DATA_DIR = (await import('node:fs')).mkdtempSync((await import('node:os')).tmpdir() + '/b2b-rest-');
  const { refreshFromRest, sendsOrders } = await import('../server/aims360/rest.js');
  const { getProvider } = await import('../server/aims360/index.js');
  const { clearLive } = await import('../server/aims360/live.js');
  const { createApp } = await import('../server/index.js');

  const state = await refreshFromRest();
  assert.equal(state.account, 'RESTX');
  assert.equal(state.styleColors, 450, 'every page was read');
  assert.equal(state.customers, 30);
  const p = getProvider();
  assert.equal(p.mode, 'live');
  assert.equal(p.getStyle('RS1000').colors[0].sizes[1].stock, 20);
  assert.equal(p.listOrders().length, 0, 'sample orders are not shown against a live company');

  // Place an order through the portal with sending switched on.
  process.env.AIMS360_SEND_ORDERS = 'true';
  assert.equal(sendsOrders(), true);
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@aims360.test', password: 'admin1234', portal: 'admin' }) });
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const cart = { customerAccount: 'R100', orderType: 'I', acceptTerms: true, lines: [{ style: 'RS1000', color: '001', sizes: { M: 15 } }] };
  const placed = await (await fetch(base + '/api/shop/orders', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(cart) })).json();
  assert.equal(placed.orders[0].aims.sent, true);
  assert.equal(placed.orders[0].aims.order, '1000200001');
  assert.equal(posted[0].customerAccount, 'R100');
  assert.deepEqual(posted[0].customFields, [{ displayName: 'Order Type', value: 'I' }]);
  assert.equal(posted[0].status, 'Open');
  assert.equal(posted[0].createdBy, undefined);
  const cfg = await (await fetch(base + '/api/config')).json();
  assert.equal(cfg.mode, 'live');
  assert.equal(cfg.sendsOrders, true);

  // A rejected token is explained, and the order is still kept in the portal.
  token = 'rotated';
  await assert.rejects(() => refreshFromRest(), /did not accept the access token/);
  const again = await (await fetch(base + '/api/shop/orders', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ ...cart, lines: [{ style: 'RS1001', color: '001', sizes: { M: 15 } }] }) })).json();
  assert.equal(again.orders[0].aims.sent, false);
  assert.match(again.orders[0].aims.error, /access token/);

  server.close(); api.close(); clearLive();
  delete process.env.AIMS360_BASE_URL; delete process.env.AIMS360_TOKEN; delete process.env.AIMS360_SEND_ORDERS;
});
