// Sample order history so the demo opens with a lived-in dashboard and
// reports. Demo mode only; runs once per data file.
import { getProvider } from './aims360/index.js';
import { load, save, id } from './store.js';

const EXTRA = [
  { customerName: 'Coastline Supply Co', city: 'San Diego', state: 'CA', terms: 'NET 30', creditLimit: 20000 },
  { customerName: 'Fern & Field', city: 'Portland', state: 'OR', terms: 'NET 30', creditLimit: 15000 },
  { customerName: 'Northside Outfitters', city: 'Chicago', state: 'IL', terms: 'NET 60', creditLimit: 30000 }
];

// Shows what drop dividers look like on the first sample linesheet. Runs once.
function seedDrops(st) {
  if (st.demoDrops) return;
  const l = st.linesheets.find((x) => x.id === 'ls-sp27-active');
  const want = ['AW1001', 'AW1002', 'AW1003', 'TP3001'];
  if (l && !l.layout && want.every((s) => l.styles.includes(s)) && l.styles.length === want.length)
    l.layout = [
      { type: 'divider', id: id('div'), title: 'Drop 1', note: 'Ships January 15' },
      { type: 'style', style: 'AW1001' }, { type: 'style', style: 'AW1002' },
      { type: 'divider', id: id('div'), title: 'Drop 2', note: 'Ships February 1' },
      { type: 'style', style: 'AW1003' }, { type: 'style', style: 'TP3001' }
    ];
  st.demoDrops = true;
  save();
}

export function seedDemoHistory() {
  const st = load();
  const p = getProvider();
  seedDrops(st);
  if (st.demoSeeded || p.mode !== 'demo') return;
  let seedN = 7;
  const rnd = () => ((seedN = (seedN * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  for (const c of EXTRA) if (!p.listCustomers().some((x) => x.customerName === c.customerName)) p.createCustomer(c);
  // Weighted so a few accounts lead, the way a real customer list does.
  const names = { CMAIM: 5, ADASA: 3, 'Coastline Supply Co': 4, 'Fern & Field': 2, 'Northside Outfitters': 3 };
  const accounts = p.listCustomers().flatMap((c) => Array(names[c.customerAccount] || names[c.customerName] || 0).fill(c.customerAccount));
  const styles = p.listStyles();
  const now = Date.now();
  const day = 86400000;
  const iso = (t) => new Date(t).toISOString();

  const make = (daysAgo, type, state) => {
    const account = pick(accounts);
    const season = pick(['SP27', 'SP27', 'SU27', 'FA26']);
    const pool = styles.filter((s) => s.season === season);
    const lineItems = [];
    for (let i = 0, n = 1 + Math.floor(rnd() * 3); i < n; i++) {
      const s = pick(pool);
      const c = pick(s.colors);
      if (lineItems.some((l) => l.style === s.style && l.color === c.color)) continue;
      const base = type === 'B' ? 30 : type === 'PB' ? 12 : 6;
      lineItems.push({ style: s.style, color: c.color, sizes: c.sizes.map((z) => ({ sizeName: z.sizeName, orderQuantity: Math.round(base * (0.5 + rnd())) })) });
    }
    const created = now - daysAgo * day - Math.floor(rnd() * day * 0.4);
    const o = p.createOrder({
      customerAccount: account, season, status: 'Open', lineItems,
      customerPurchaseOrder: `PO-${4100 + Math.floor(rnd() * 5000)}-${st.nextOrderNumber % 1000}`,
      bulkOrder: type === 'B',
      start: iso(created + (type === 'I' ? 2 : 45) * day).slice(0, 10),
      complete: iso(created + (type === 'I' ? 16 : 75) * day).slice(0, 10),
      customFields: [{ displayName: 'Order Type', value: type }],
      createdBy: 'Sample history'
    });
    o.createdOn = iso(created);
    o.entered = o.createdOn.slice(0, 10);
    if (state === 'Shipped') {
      o.status = 'Shipped';
      for (const l of o.lineItems) for (const z of l.sizes) z.shippedQuantity = z.orderQuantity;
    } else if (state === 'Hold') {
      o.status = 'Hold';
      o.orderStatusReason = 'AD';
    }
    return o;
  };

  // Older orders have shipped; the last few weeks are still open.
  for (let d = 175; d > 24; d -= 3 + Math.floor(rnd() * 4)) make(d, pick(['I', 'I', 'PB', 'PB', 'B']), 'Shipped');
  // Open orders sit on accounts with room, so the credit-limit demo logins behave as described.
  const roomy = accounts.filter((a) => a !== 'CMAIM');
  accounts.length = 0;
  accounts.push(...roomy);
  for (const d of [21, 16, 12, 9, 6, 4, 2, 1]) make(d, pick(['I', 'PB', 'PB']), 'Open');
  make(3, 'I', 'Hold');

  st.activity.unshift({ at: iso(now), actor: 'Demo', action: 'demo.seeded', detail: 'Sample order history added' });
  st.demoSeeded = true;
  save();
}
