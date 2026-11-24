import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'b2b-'));
const { createApp } = await import('../server/index.js');

let base;
before(async () => {
  const server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  server.unref();
});

async function client(email, password, portal) {
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    return { status: res.status, body: await res.json() };
  };
  const r = await call('POST', '/api/auth/login', { email, password, portal });
  assert.equal(r.status, 200, 'login');
  return call;
}

const cart = (over = {}) => ({
  orderType: 'I',
  shipToStore: 'MAIN',
  acceptTerms: true,
  lines: [{ style: 'TP3001', color: 'WHT', sizes: { S: 10, M: 10, L: 10 } }],
  ...over
});

test('buyer cannot sign in to the admin side, and admin routes are closed to buyers', async () => {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@aimscaitlin.test', password: 'buyer1234', portal: 'admin' })
  });
  assert.equal(res.status, 401);
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  assert.equal((await buyer('GET', '/api/admin/orders')).status, 403);
});

test('catalog shows the customer price from the price sheet', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const { body } = await buyer('GET', '/api/shop/catalog/TP3001');
  assert.equal(body.price, 10.8); // 12.00 less 10%
});

test('order type is required', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const { status, body } = await buyer('POST', '/api/shop/orders', cart({ orderType: undefined }));
  assert.equal(status, 400);
  assert.match(body.errors.join(' '), /order type/i);
});

test('immediate order books Open with Order Type I and no bulk flag', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const { status, body } = await buyer('POST', '/api/shop/orders', cart({ customerPurchaseOrder: 'PO-1' }));
  assert.equal(status, 200);
  const o = body.orders[0];
  assert.equal(o.status, 'Open');
  assert.equal(o.bulkOrder, false);
  assert.deepEqual(o.orderType, { code: 'I', label: 'Immediate' });
  assert.equal(o.customFields[0].customField, 'Order Category2');
});

test('immediate order cannot exceed stock on hand', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const { status, body } = await buyer('POST', '/api/shop/orders', cart({ lines: [{ style: 'AW1004', color: 'BLK', sizes: { M: 20 } }] }));
  assert.equal(status, 400);
  assert.match(body.errors.join(' '), /available now/);
});

test('prebook needs a delivery window, uses WIP, and carries the window dates', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const lines = [{ style: 'AW1004', color: 'BLK', sizes: { M: 20 } }];
  const bad = await buyer('POST', '/api/shop/orders', cart({ orderType: 'PB', lines }));
  assert.equal(bad.status, 400);
  const ok = await buyer('POST', '/api/shop/orders', cart({ orderType: 'PB', deliveryWindowId: 'dw-su27-1', lines }));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.orders[0].start, '2027-04-01');
  assert.equal(ok.body.orders[0].orderType.code, 'PB');
});

test('a cart with two seasons splits into two orders', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const { body } = await buyer('POST', '/api/shop/orders', cart({
    customerPurchaseOrder: 'PO-SPLIT',
    lines: [
      { style: 'TP3001', color: 'BLK', sizes: { M: 12 } },
      { style: 'DR2002', color: 'BLK', sizes: { 4: 6 } }
    ]
  }));
  assert.equal(body.orders.length, 2);
  assert.deepEqual(body.orders.map((o) => o.customerPurchaseOrder).sort(), ['PO-SPLIT-FA26', 'PO-SPLIT-SP27']);
});

test('bulk order sets bulkOrder and Order Type B; releases draw it down; cancel puts units back', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  const made = await buyer('POST', '/api/shop/orders', cart({ orderType: 'B', lines: [{ style: 'TP3001', color: 'WHT', sizes: { M: 200, L: 100 } }] }));
  const bulk = made.body.orders[0];
  assert.equal(bulk.bulkOrder, true);
  assert.equal(bulk.orderType.code, 'B');
  assert.equal(bulk.toRelease, 300);

  const rel = await buyer('POST', `/api/buyer/orders/${bulk.orderID}/releases`, { shipToStore: 'SM', lines: [{ style: 'TP3001', color: 'WHT', sizes: { M: 50 } }] });
  assert.equal(rel.status, 200);
  assert.equal(rel.body.distributionOrder, true);
  assert.equal(rel.body.bulkOrderID, bulk.orderID);
  assert.equal((await buyer('GET', `/api/buyer/orders/${bulk.orderID}`)).body.toRelease, 250);

  const tooMany = await admin('POST', `/api/admin/orders/${bulk.orderID}/releases`, { shipToStore: 'PDX', lines: [{ style: 'TP3001', color: 'WHT', sizes: { M: 151 } }] });
  assert.equal(tooMany.status, 400);

  await admin('POST', `/api/admin/orders/${rel.body.orderID}/cancel`);
  assert.equal((await buyer('GET', `/api/buyer/orders/${bulk.orderID}`)).body.toRelease, 300);
});

test('credit check counts A/R plus open orders and puts the order on Hold when over the limit', async () => {
  // CAITM: limit 5,000, A/R 3,900. First order 600 stays Open; next 600 goes over.
  const buyer = await client('buyer@activewear.test', 'buyer1234', 'buyer');
  const lines = [{ style: 'TP3001', color: 'WHT', sizes: { M: 50 } }]; // 50 x 12.00
  const first = await buyer('POST', '/api/shop/orders', cart({ lines }));
  assert.equal(first.body.orders[0].status, 'Open');
  const second = await buyer('POST', '/api/shop/orders', cart({ lines }));
  assert.equal(second.body.orders[0].status, 'Hold');
  assert.equal(second.body.orders[0].orderStatusReason, 'CR');
  assert.equal(second.body.preview.credit.openOrders, 600);
  assert.equal(second.body.preview.credit.exposure, 5100);
});

test('buyer requests a cancel; admin approves it', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  const o = (await buyer('POST', '/api/shop/orders', cart())).body.orders[0];
  const req = await buyer('POST', `/api/buyer/orders/${o.orderID}/cancel-request`, { reason: 'Ordered twice' });
  assert.equal(req.body.cancelRequest.state, 'pending');
  assert.equal(req.body.status, 'Open');
  const done = await admin('POST', `/api/admin/orders/${o.orderID}/cancel`);
  assert.equal(done.body.status, 'Cancelled');
});

test('minimum order rule blocks a small cart', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const { status, body } = await buyer('POST', '/api/shop/orders', cart({ lines: [{ style: 'TP3001', color: 'WHT', sizes: { M: 2 } }] }));
  assert.equal(status, 400);
  assert.match(body.errors.join(' '), /minimum order/i);
});

test('admin invites a buyer who can then sign in; buyers only see their own orders', async () => {
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  const inv = await admin('POST', '/api/admin/buyers', { email: 'new@adasa.test', name: 'New Buyer', customerAccount: 'ADASA' });
  assert.equal(inv.status, 200);
  const nb = await client('new@adasa.test', inv.body.tempPassword, 'buyer');
  assert.equal((await nb('GET', '/api/buyer/orders')).body.length, 0);
});

test('admin must choose a customer, then orders on their behalf at that customer\'s price', async () => {
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  const none = await admin('POST', '/api/shop/orders', cart());
  assert.equal(none.status, 400);
  assert.match(none.body.errors.join(' '), /choose the customer/i);
  const ok = await admin('POST', '/api/shop/orders', cart({ customerAccount: 'CMAIM' }));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.orders[0].customerAccount, 'CMAIM');
  assert.equal(ok.body.orders[0].lineItems[0].price, 10.8);
});

test('a buyer cannot order for, or see, another customer', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const o = await buyer('POST', '/api/shop/orders', cart({ customerAccount: 'CAITM' }));
  assert.equal(o.body.orders[0].customerAccount, 'CMAIM');
  assert.equal((await buyer('GET', '/api/shop/customers')).body.customers.length, 1);
  assert.equal((await buyer('POST', '/api/shop/customers', { customerName: 'X', terms: 'NET 30' })).status, 403);
});

test('admin adds a new customer and orders for them straight away', async () => {
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  const made = await admin('POST', '/api/shop/customers', { customerName: 'Luna Boutique', terms: 'NET 30', city: 'Denver', state: 'CO', creditLimit: 1000 });
  assert.equal(made.status, 200);
  assert.equal(made.body.customerAccount, 'LUNAB');
  assert.equal((await admin('POST', '/api/shop/customers', { customerName: 'luna boutique', terms: 'NET 30' })).status, 400);
  const o = await admin('POST', '/api/shop/orders', cart({ customerAccount: 'LUNAB' }));
  assert.equal(o.status, 200);
  assert.equal(o.body.orders[0].customerName, 'Luna Boutique');
  assert.equal(o.body.orders[0].lineItems[0].price, 12);
});

test('linesheets: buyers see only the ones shared with them; admin can create one', async () => {
  const key = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const other = await client('buyer@activewear.test', 'buyer1234', 'buyer');
  assert.equal((await key('GET', '/api/shop/linesheets')).body.length, 3);
  assert.equal((await other('GET', '/api/shop/linesheets')).body.length, 2);
  assert.equal((await other('GET', '/api/shop/linesheets/ls-key-immediates')).status, 404);
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  const made = await admin('POST', '/api/admin/linesheets', { name: 'Fall Tops', season: 'FA26', styles: ['TP3003', 'NOPE'], customerAccounts: ['CAITM'] });
  assert.deepEqual(made.body.styles, ['TP3003']);
  assert.equal((await other('GET', '/api/shop/linesheets')).body.length, 3);
  const view = await other('GET', `/api/shop/linesheets/${made.body.id}`);
  assert.equal(view.body.items[0].price, 38);
});

test('admin order options: net discount, ship via, rep and a manual Hold are booked; buyers cannot set them', async () => {
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  const options = { discountPercent: 10, discountReason: 'Trade Show', shipvia: 'FedEx Ground', salesRep: 'CMO', status: 'Hold' };
  const made = await admin('POST', '/api/shop/orders', cart({ customerAccount: 'ADASA', options }));
  const o = made.body.orders[0];
  assert.equal(o.merchandiseAmount, 360); // 30 x 12.00
  assert.equal(o.bookedAmount, 324);
  assert.equal(o.shipvia, 'FedEx Ground');
  assert.equal(o.salesRep, 'CMO');
  assert.equal(o.status, 'Hold');
  assert.equal(o.orderStatusReason, 'AD');
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const b = (await buyer('POST', '/api/shop/orders', cart({ options }))).body.orders[0];
  assert.equal(b.netDiscountPercentage, 0);
  assert.equal(b.status, 'Open');
  const style = await admin('GET', '/api/shop/catalog/TP3001');
  assert.equal(style.body.warehouses[0].stock.length, 2);
  assert.equal((await buyer('GET', '/api/shop/catalog/TP3001')).body.warehouses, undefined);
});

test('catalog filters, sort and facet counts; open credits are per customer', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  const all = (await buyer('GET', '/api/shop/catalog')).body;
  assert.equal(all.items.length, 14);
  assert.equal(all.facets.categories.find((c) => c.name === 'Dresses').count, 3);
  const f = (await buyer('GET', '/api/shop/catalog?category=Dresses,Tops&color=Black&sort=priceHigh')).body.items;
  assert.deepEqual(f.map((s) => s.style), ['DR2002', 'TP3001']);
  assert.equal((await buyer('GET', '/api/shop/catalog?gender=Unisex&fabric=Denim')).body.items[0].style, 'BT4002');
  assert.equal((await buyer('GET', '/api/buyer/credits')).body.length, 2);
});

const anon = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, res, body: res.headers.get('content-type')?.includes('json') ? await res.json() : null };
};

test('guests can browse without stock or wholesale prices, but cannot shop', async () => {
  const cat = await anon('GET', '/api/public/catalog');
  assert.equal(cat.body.items.length, 14);
  const s = cat.body.items[0];
  assert.equal(s.price, null);
  assert.equal(s.retail, null);
  assert.deepEqual(Object.keys(s.colors[0].sizes[0]), ['sizeName']);
  assert.equal((await anon('GET', '/api/public/linesheets')).body.length, 2); // not the key-account one
  assert.equal((await anon('GET', '/api/public/linesheets/ls-key-immediates')).status, 404);
  assert.equal((await anon('GET', '/api/shop/catalog')).status, 401);
  assert.equal((await anon('POST', '/api/shop/orders', cart())).status, 401);
});

test('brand controls guest prices and can switch guest browsing off', async () => {
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  await admin('PUT', '/api/admin/settings', { guestPrices: 'msrp' });
  let s = (await anon('GET', '/api/public/catalog/TP3001')).body;
  assert.equal(s.price, null); assert.equal(s.retail, 36);
  await admin('PUT', '/api/admin/settings', { guestPrices: 'wholesale' });
  s = (await anon('GET', '/api/public/catalog/TP3001')).body;
  assert.equal(s.price, 12);
  await admin('PUT', '/api/admin/settings', { guestBrowsing: false });
  assert.equal((await anon('GET', '/api/public/catalog')).status, 403);
  await admin('PUT', '/api/admin/settings', { guestBrowsing: true, guestPrices: 'none' });
});

test('guest requests access; admin approves by creating a customer; the buyer can sign in and order', async () => {
  const form = { businessName: 'Harbor Goods', contactName: 'Ana Ruiz', email: 'ana@harborgoods.test', city: 'Seattle', state: 'wa' };
  assert.equal((await anon('POST', '/api/public/access-requests', { ...form, email: 'nope' })).status, 400);
  assert.equal((await anon('POST', '/api/public/access-requests', form)).status, 200);
  assert.equal((await anon('POST', '/api/public/access-requests', form)).status, 400); // duplicate
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  const pending = (await admin('GET', '/api/admin/access-requests')).body.find((a) => a.email === form.email);
  assert.equal(pending.state, 'pending');
  const ok = await admin('POST', `/api/admin/access-requests/${pending.id}/approve`, { createCustomer: true, terms: 'NET 30' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.customerName, 'Harbor Goods');
  const buyer = await client(form.email, ok.body.tempPassword, 'buyer');
  const o = await buyer('POST', '/api/shop/orders', cart());
  assert.equal(o.body.orders[0].customerName, 'Harbor Goods');
});

test('admin approves a request by linking to an existing customer, or declines it', async () => {
  await anon('POST', '/api/public/access-requests', { businessName: 'Caitlins Activewear', contactName: 'Lee Park', email: 'lee@activewear.test', existingCustomer: true });
  await anon('POST', '/api/public/access-requests', { businessName: 'Spam Co', contactName: 'X', email: 'x@spam.test' });
  const admin = await client('admin@aims360.test', 'admin1234', 'admin');
  const reqs = (await admin('GET', '/api/admin/access-requests')).body;
  const lee = reqs.find((a) => a.email === 'lee@activewear.test'), spam = reqs.find((a) => a.email === 'x@spam.test');
  assert.equal((await admin('POST', `/api/admin/access-requests/${lee.id}/approve`, {})).status, 400);
  const ok = await admin('POST', `/api/admin/access-requests/${lee.id}/approve`, { customerAccount: 'CAITM' });
  assert.equal(ok.body.buyer.customerAccount, 'CAITM');
  assert.equal((await admin('POST', `/api/admin/access-requests/${spam.id}/decline`)).body.state, 'declined');
});

test('exports: linesheet and OTS report as CSV, Excel, PDF and order form', async () => {
  const buyer = await client('buyer@aimscaitlin.test', 'buyer1234', 'buyer');
  let cookie = '';
  { const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'buyer@aimscaitlin.test', password: 'buyer1234', portal: 'buyer' }) }); cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; '); }
  const dl = async (url) => { const r = await fetch(base + url, { headers: { cookie } }); return { status: r.status, type: r.headers.get('content-type'), name: r.headers.get('content-disposition'), buf: Buffer.from(await r.arrayBuffer()) }; };
  const csv = await dl('/api/shop/linesheets/ls-sp27-active/export?format=csv');
  assert.equal(csv.status, 200);
  const lines = csv.buf.toString().split('\r\n');
  assert.equal(lines[0], '"Style","Description","Collection","Season","Color","Size","Price","MSRP"');
  assert.match(lines[1], /"AW1001".*"16.20","48.00"/); // key-account price
  const xlsx = await dl('/api/shop/linesheets/ls-sp27-active/export?format=xlsx');
  assert.equal(xlsx.buf.subarray(0, 2).toString(), 'PK');
  const form = await dl('/api/shop/linesheets/ls-sp27-active/export?format=orderform');
  assert.match(form.name, /order-form\.xlsx/);
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(form.buf);
  let formulas = 0; wb.worksheets[0].eachRow((row) => row.eachCell((c) => { if (c.formula) formulas++; }));
  assert.ok(formulas >= 20, 'order form has unit and amount formulas');
  const pdf = await dl('/api/shop/linesheets/ls-sp27-active/export?format=pdf');
  assert.equal(pdf.buf.subarray(0, 5).toString(), '%PDF-');
  const ots = await dl('/api/shop/ots-report/export?format=csv&keys=' + encodeURIComponent('TP3001|WHT,AW1004|BLK') + '&basis=future&detail=total');
  const o = ots.buf.toString().split('\r\n');
  assert.match(o[0], /"OTS With WIP"/);
  assert.match(o[2], /"AW1004".*"All","810"/); // WIP 150+180+150+180+150, no stock
  assert.equal((await dl('/api/shop/ots-report/export?format=pdf&keys=' + encodeURIComponent('TP3001|WHT'))).buf.subarray(0, 5).toString(), '%PDF-');
  assert.equal((await dl('/api/shop/linesheets/ls-sp27-active/export?format=doc')).status, 400);
  void buyer;
});

test('sample history seeds once and reports add up', async () => {
  const { seedDemoHistory } = await import('../server/demoSeed.js');
  const { load } = await import('../server/store.js');
  seedDemoHistory();
  const count = load().aimsOrders.length;
  assert.ok(count > 25, 'history created');
  seedDemoHistory();
  assert.equal(load().aimsOrders.length, count, 'does not seed twice');
  const seeded = load().aimsOrders.filter((o) => o.createdBy === 'Sample history');
  assert.ok(!seeded.some((o) => o.customerAccount === 'CAITM'), 'credit demo account gets no sample orders');
  assert.ok(!seeded.some((o) => o.customerAccount === 'CMAIM' && o.status !== 'Shipped'), 'key account keeps its open-order room');
});

test('quick order: typed lines, order form import and reorder fill a cart', async () => {
  const { parseText, matchLines, parseOrderForm, linesFromOrder } = await import('../server/quickOrder.js');
  const typed = parseText('TP3001, White, M, 24\nTP3001 WHT L 6\nAW1003\tHeather Grey\tS\t5\nNOPE1, Red, M, 3\nTP3001, White, XXXL, 2\nbad line');
  const out = matchLines('CMAIM', typed.raw);
  assert.equal(out.units, 35);
  assert.deepEqual(out.lines.find((l) => l.style === 'TP3001').sizes, { M: 24, L: 6 });
  assert.equal(out.lines.find((l) => l.style === 'TP3001').price, 10.8, 'customer price applies');
  assert.equal(typed.problems.length + out.problems.length, 3);

  // Fill in an exported order form and import it back.
  const { toOrderForm } = await import('../server/exports.js');
  const { catalogStyle } = await import('../server/ordering.js');
  const { getProvider } = await import('../server/aims360/index.js');
  const { load } = await import('../server/store.js');
  const ExcelJS = (await import('exceljs')).default;
  const s = catalogStyle(getProvider().getStyle('AW1001'), 'CMAIM', load().settings);
  const buf = await toOrderForm(s.colors.map((c) => ({ s, c })), { title: 'Test', subtitle: '' });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  ws.eachRow((row, n) => {
    if (/^PO Number/.test(String(row.getCell(1).value))) row.getCell(3).value = 'PO-FORM-1';
    if (/^Order Type/.test(String(row.getCell(1).value))) row.getCell(3).value = 'Prebook';
    if (row.getCell(1).value === 'AW1001' && row.getCell(3).value === 'Black') { ws.getRow(n + 1).getCell(5).value = 4; ws.getRow(n + 1).getCell(6).value = 8; }
  });
  const form = await parseOrderForm(Buffer.from(await wb.xlsx.writeBuffer()).toString('base64'));
  assert.equal(form.info.customerPurchaseOrder, 'PO-FORM-1');
  assert.equal(form.info.orderType, 'PB');
  const filled = matchLines('CMAIM', form.raw);
  assert.equal(filled.units, 12);
  assert.equal(filled.lines[0].color, 'BLK');
  await assert.rejects(() => parseOrderForm('bm90IGEgZmlsZQ=='), /could not be read/);

  const order = load().aimsOrders.find((o) => o.status !== 'Cancelled');
  const again = matchLines(order.customerAccount, linesFromOrder(order));
  assert.equal(again.units, order.bookedTotal);
});

test('inactive styles, line discounts and a second sales rep', async () => {
  const { getProvider } = await import('../server/aims360/index.js');
  const { buildPreview } = await import('../server/ordering.js');
  const p = getProvider();
  assert.ok(!p.listStyles().some((s) => s.style === 'TP2998'), 'inactive style hidden by default');
  assert.ok(p.listAllStyles().some((s) => s.style === 'TP2998'));
  const admin = { role: 'admin', email: 'a@x.test' };
  const buyer = { role: 'buyer', customerAccount: 'ADASA' };
  const cart = (extra = {}) => ({ customerAccount: 'ADASA', orderType: 'I', acceptTerms: true, lines: [{ style: 'TP3001', color: 'WHT', sizes: { M: 100 }, discountPercent: 10 }], ...extra });
  const a = buildPreview(admin, cart({ options: { salesRep: 'CMO', commissionPercent: '8', salesRep2: 'WST', commissionPercent2: '4' } }));
  assert.equal(a.ok, true, a.errors.join());
  assert.equal(a.orders[0].lines[0].price, 10.8);
  assert.equal(a.orders[0].lines[0].listPrice, 12);
  assert.equal(a.amount, 1080);
  assert.deepEqual([a.orders[0].payload.salesRep2, a.orders[0].payload.commissionPercent, a.orders[0].payload.commissionPercent2], ['WST', 8, 4]);
  const o = p.createOrder(a.orders[0].payload);
  assert.equal(o.lineItems[0].discountPercent, 10);
  assert.equal(o.salesRep2, 'WST');
  p.cancelOrder(o.orderID, {});
  assert.equal(buildPreview(buyer, cart()).amount, 1200, 'buyers cannot give themselves a line discount');
  assert.match(buildPreview(admin, cart({ options: { salesRep: 'CMO', salesRep2: 'CMO' } })).errors.join(), /must be different/);
  assert.match(buildPreview(admin, cart({ options: { salesRep: 'CMO', commissionPercent: 70, salesRep2: 'WST', commissionPercent2: 40 } })).errors.join(), /more than 100%/);
  assert.match(buildPreview(buyer, cart({ lines: [{ style: 'TP2998', color: 'NVY', sizes: { M: 20 } }] })).errors.join(), /no longer available/);
});

test('linesheet dividers, hero image and logo', async () => {
  const { cleanLayout, sectionsOf, cleanImage } = await import('../server/linesheets.js');
  const out = cleanLayout({ layout: [
    { type: 'style', style: 'TP3001' },
    { type: 'divider', title: ' Drop 1 ', note: 'Ships Jan 15' },
    { type: 'style', style: 'AW1001' }, { type: 'style', style: 'AW1001' }, { type: 'style', style: 'NOPE' },
    { type: 'divider', title: 'Drop 2' }
  ] });
  assert.deepEqual(out.styles, ['TP3001', 'AW1001']);
  const sections = sectionsOf(out, (code) => ({ style: code }));
  assert.deepEqual(sections.map((s) => [s.title, s.items.length]), [['', 1], ['Drop 1', 1], ['Drop 2', 0]]);
  assert.throws(() => cleanLayout({ layout: [{ type: 'divider', title: '' }, { type: 'style', style: 'TP3001' }] }), /divider a title/);
  assert.deepEqual(sectionsOf({ styles: ['TP3001'] }, (c) => ({ style: c })).map((s) => s.title), [''], 'older linesheets still work');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.equal(cleanImage(png, '', 1000, 'The logo'), png);
  assert.equal(cleanImage(undefined, png, 1000, 'The logo'), png, 'left alone when not sent');
  assert.equal(cleanImage('', png, 1000, 'The logo'), '', 'blank removes it');
  assert.throws(() => cleanImage('data:text/html;base64,AAAA', '', 1000, 'The logo'), /PNG or JPEG/);
  assert.throws(() => cleanImage(png, '', 10, 'The logo'), /too large/);

  // The PDF and Excel exports take the divider headings, the hero and the logo.
  const { toPdf, toXlsx, toOrderForm } = await import('../server/exports.js');
  const { catalogStyle } = await import('../server/ordering.js');
  const { getProvider } = await import('../server/aims360/index.js');
  const { load } = await import('../server/store.js');
  const s = catalogStyle(getProvider().getStyle('AW1001'), 'CMAIM', load().settings);
  const rows = s.colors.map((c, i) => ({ s, c, ...(i === 0 ? { section: 'Drop 1', sectionNote: 'Ships Jan 15' } : {}) }));
  const pdf = await toPdf(rows, { kind: 'linesheet', title: 'T', subtitle: '', hero: png, logo: png });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const ExcelJS = (await import('exceljs')).default;
  for (const buf of [await toXlsx(rows, { kind: 'linesheet', title: 'T', subtitle: '' }), await toOrderForm(rows, { title: 'T', subtitle: '' })]) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    let found = false; wb.worksheets[0].eachRow((row) => { if (String(row.getCell(1).value).startsWith('Drop 1')) found = true; });
    assert.ok(found, 'divider heading row present');
  }
  // The order form still imports with a divider row in it.
  const { parseOrderForm } = await import('../server/quickOrder.js');
  const form = await parseOrderForm(Buffer.from(await toOrderForm(rows, { title: 'T', subtitle: '' })).toString('base64'));
  assert.deepEqual(form.raw, []);
});

test('customer, product and inventory reports', async () => {
  const { dataReport } = await import('../server/reports.js');
  const { tableCsv, tableXlsx } = await import('../server/exports.js');
  const c = dataReport('customers', {});
  const key = c.rows.find((r) => r.account === 'CMAIM');
  assert.equal(key.creditLimit, 25000);
  assert.equal(key.priceSheet, 'Key Accounts');
  assert.equal(key.logins, 1);
  assert.equal(dataReport('customers', { q: 'austin' }).count, 1);
  const p = dataReport('products', { status: 'all' });
  assert.ok(p.rows.some((r) => r.style === 'TP2998' && r.status === 'Inactive'));
  assert.ok(!dataReport('products', {}).rows.some((r) => r.style === 'TP2998'), 'active only by default');
  assert.equal(p.rows.find((r) => r.style === 'TP3001').markup, 3);
  const inv = dataReport('inventory', { q: 'AW1001' });
  const blk = inv.rows.find((r) => r.color === 'Black');
  assert.equal(blk.onHand, 257);
  assert.equal(blk.wh0 + blk.wh1, 257, 'warehouses add up to on hand');
  assert.equal(blk.value, 257 * 18);
  assert.equal(inv.totals.onHand, inv.rows.reduce((t, r) => t + r.onHand, 0));
  const bySize = dataReport('inventory', { q: 'AW1001', detail: 'size' });
  assert.equal(bySize.count, 10);
  assert.ok(dataReport('inventory', { level: 'out' }).rows.every((r) => r.onHand === 0));
  assert.throws(() => dataReport('nope'), /customers, products or inventory/);
  assert.match(tableCsv(inv).split('\r\n')[0], /^"Style","Description","Collection","Season","Color","On Hand"/);
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await tableXlsx(inv, 'test'));
  assert.equal(wb.worksheets[0].getRow(5).getCell(1).value, 'Style');
});
