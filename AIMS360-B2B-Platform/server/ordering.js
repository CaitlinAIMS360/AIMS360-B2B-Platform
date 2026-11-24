// Portal ordering rules: pricing a cart, availability, order type, splitting
// by season, minimums, credit check, and turning the cart into AIMS360
// Create Order payloads.
import { getProvider } from './aims360/index.js';
import { load } from './store.js';

export const ORDER_TYPES = {
  I: { code: 'I', label: 'Immediate', availability: 'ots_i' },
  PB: { code: 'PB', label: 'Prebook', availability: 'ots' },
  B: { code: 'B', label: 'Bulk', availability: 'ots' }
};

const round2 = (n) => Math.round(n * 100) / 100;
// A percent typed on screen: blank means not set.
const pct = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Math.min(100, Math.max(0, Number(v))));

// Buyers always order for their own account. Admins choose the customer.
export function accountFor(user, requested) {
  return user.role === 'admin' ? requested || null : user.customerAccount;
}

const today = () => new Date().toISOString().slice(0, 10);

// What a buyer sees for one size: a count, or a word, per admin settings.
export function availabilityLabel(qty, settings) {
  if (qty <= 0) return { level: 'out', text: 'Sold out' };
  const low = qty <= settings.lowStockThreshold;
  if (settings.showExactStock) return { level: low ? 'low' : 'in', text: String(qty) };
  return { level: low ? 'low' : 'in', text: low ? 'Low' : 'In stock' };
}

export function catalogStyle(style, customerAccount, settings, opts = {}) {
  const p = getProvider();
  const price = p.getCustomerPrice(customerAccount, style.style);
  const colors = style.colors.map((c) => ({
    color: c.color,
    colorDescription: c.colorDescription,
    hex: c.hex,
    image: `/api/images/${style.style}/${c.color}.svg`,
    sizes: c.sizes.map((z) => ({
      sizeName: z.sizeName,
      now: availabilityLabel(z.ots_i, settings),
      future: availabilityLabel(z.ots, settings),
      ots_i: z.ots_i,
      ots: z.ots
    })),
    nowUnits: c.sizes.reduce((t, z) => t + z.ots_i, 0),
    futureUnits: c.sizes.reduce((t, z) => t + z.ots, 0)
  }));
  return {
    style: style.style,
    description: style.description,
    category: style.category,
    gender: style.gender,
    division: style.division,
    styleGroup: style.styleGroup,
    status: style.status,
    fabric: style.fabric,
    season: style.season,
    available: style.available,
    price: price.price,
    retail: price.retail,
    priceSource: price.source,
    colors,
    warehouses: opts.warehouses
      ? style.colors.map((c) => ({ color: c.color, colorDescription: c.colorDescription, stock: p.stockByWarehouse(c) }))
      : undefined,
    availableNow: colors.some((c) => c.nowUnits > 0),
    soldOut: colors.every((c) => c.futureUnits <= 0)
  };
}

// cart = { lines:[{style,color,sizes:{M:3}}], orderType, deliveryWindowId,
//          customerPurchaseOrder, shipToStore, notes, acceptTerms }
export function buildPreview(user, cart) {
  const p = getProvider();
  const { settings } = load();
  const account = accountFor(user, cart.customerAccount);
  const customer = account ? p.getCustomer(account) : null;
  const errors = [];
  const warnings = [];
  const type = ORDER_TYPES[cart.orderType];

  if (!customer)
    errors.push(user.role === 'admin' ? 'Choose the customer this order is for.' : 'Your account is not linked to an AIMS360 customer.');
  if (!type) errors.push('Choose an order type: Immediate, Prebook or Bulk.');

  let window = null;
  if (cart.orderType === 'PB') {
    window = settings.deliveryWindows.find((w) => w.id === cart.deliveryWindowId);
    if (!window) errors.push('Choose a delivery window for a Prebook order.');
  }

  const stores = customer?.stores || [];
  if (stores.length > 1 && !stores.some((s) => s.code === cart.shipToStore))
    errors.push('Choose which store this order ships to.');

  // Price and check every line.
  const bySeason = new Map();
  for (const line of cart.lines || []) {
    const style = p.getStyle(line.style);
    const color = style?.colors.find((c) => c.color === line.color);
    if (!style || !color || (style.status === 'Inactive' && user.role !== 'admin')) {
      errors.push(`${line.style} ${line.color} is no longer available.`);
      continue;
    }
    const listPrice = p.getCustomerPrice(customer?.customerAccount, style.style)?.price ?? style.wholesale;
    // Line discount: brand admins only, taken off this one style and color.
    const lineDiscount = user.role === 'admin' ? Math.min(100, Math.max(0, Number(line.discountPercent) || 0)) : 0;
    const price = round2(listPrice * (1 - lineDiscount / 100));
    const sizes = [];
    for (const [sizeName, qtyRaw] of Object.entries(line.sizes || {})) {
      const qty = Math.floor(Number(qtyRaw) || 0);
      if (qty <= 0) continue;
      const z = color.sizes.find((x) => x.sizeName === sizeName);
      if (!z) {
        errors.push(`${style.style} has no size ${sizeName}.`);
        continue;
      }
      if (type) {
        const avail = z[type.availability];
        if (qty > avail) {
          const msg = `${style.style} ${color.colorDescription} ${sizeName}: ${qty} ordered, ${Math.max(avail, 0)} available ${
            type.code === 'I' ? 'now' : 'including WIP'
          }.`;
          if (type.code === 'I' && !settings.allowOversellImmediate) errors.push(msg);
          else warnings.push(msg);
        }
      }
      sizes.push({ sizeName, orderQuantity: qty });
    }
    if (!sizes.length) continue;
    const units = sizes.reduce((t, z) => t + z.orderQuantity, 0);
    const entry = bySeason.get(style.season) || { season: style.season, lines: [] };
    entry.lines.push({
      style: style.style,
      description: style.description,
      color: color.color,
      colorDescription: color.colorDescription,
      price,
      listPrice,
      discountPercent: lineDiscount,
      sizes,
      units,
      amount: round2(units * price)
    });
    bySeason.set(style.season, entry);
  }

  if (bySeason.size === 0) errors.push('Your cart is empty.');

  // Order options only brand admins can set. Blank ones fall back to the customer's own in AIMS360.
  const o = user.role === 'admin' ? cart.options || {} : {};
  const opt = {
    shipvia: p.listShipVias().includes(o.shipvia) ? o.shipvia : undefined,
    term: p.listTerms().includes(o.term) ? o.term : undefined,
    salesRep: p.listSalesReps().some((r) => r.code === o.salesRep) ? o.salesRep : undefined,
    salesRep2: p.listSalesReps().some((r) => r.code === o.salesRep2) && o.salesRep2 !== o.salesRep ? o.salesRep2 : undefined,
    commission: pct(o.commissionPercent),
    commission2: pct(o.commissionPercent2),
    discount: Math.min(100, Math.max(0, Number(o.discountPercent) || 0)),
    discountReason: p.listDiscountReasons().includes(o.discountReason) ? o.discountReason : undefined,
    hold: o.status === 'Hold'
  };

  if (o.salesRep2 && o.salesRep2 === o.salesRep) errors.push('The second sales rep must be different from the first.');
  if (opt.salesRep2 && !opt.salesRep) errors.push('Choose the first sales rep before adding a second.');
  if ((opt.commission || 0) + (opt.salesRep2 ? opt.commission2 || 0 : 0) > 100) errors.push('Commission for the two sales reps cannot add up to more than 100%.');

  const units = [...bySeason.values()].reduce((t, g) => t + g.lines.reduce((u, l) => u + l.units, 0), 0);
  const merchandise = round2([...bySeason.values()].reduce((t, g) => t + g.lines.reduce((u, l) => u + l.amount, 0), 0));
  const discountAmount = round2((merchandise * opt.discount) / 100);
  const amount = round2(merchandise - discountAmount);

  if (bySeason.size && settings.minOrderUnits && units < settings.minOrderUnits)
    errors.push(`The minimum order is ${settings.minOrderUnits} units; this cart has ${units}.`);
  if (bySeason.size && settings.minOrderAmount && amount < settings.minOrderAmount)
    errors.push(`The minimum order is $${settings.minOrderAmount.toFixed(2)}; this cart is $${amount.toFixed(2)}.`);
  if (settings.requireTerms && !cart.acceptTerms) errors.push('Please accept the terms and conditions.');

  // Credit check: A/R + open unshipped orders + this cart, against the limit.
  const credit = customer
    ? creditCheck(customer, amount)
    : { limit: 0, ar: 0, openOrders: 0, thisOrder: amount, exposure: amount, over: false };
  const status = credit.over || opt.hold ? 'Hold' : 'Open';
  if (credit.over)
    warnings.push(
      `This order takes ${user.role === 'admin' ? "the customer's" : 'your'} account over its credit limit, so it will be placed on Hold for credit review.`
    );

  const start = type?.code === 'PB' ? window?.start : type?.code === 'I' ? today() : null;
  const complete = type?.code === 'PB' ? window?.complete : null;

  // One AIMS360 order per season, each in Create Order v1.4 shape.
  const orders = [...bySeason.values()].map((g) => ({
    season: g.season,
    lines: g.lines,
    units: g.lines.reduce((t, l) => t + l.units, 0),
    amount: round2(g.lines.reduce((t, l) => t + l.amount, 0) * (1 - opt.discount / 100)),
    payload: {
      shipvia: opt.shipvia,
      term: opt.term,
      salesRep: opt.salesRep,
      commissionPercent: opt.salesRep ? opt.commission : undefined,
      salesRep2: opt.salesRep2,
      commissionPercent2: opt.salesRep2 ? opt.commission2 : undefined,
      netDiscountPercentage: opt.discount || undefined,
      discountReason: opt.discount ? opt.discountReason : undefined,
      customerAccount: customer?.customerAccount,
      season: g.season,
      status,
      orderStatusReason: credit.over ? 'CR' : opt.hold ? 'AD' : undefined,
      bulkOrder: type?.code === 'B',
      start: start || undefined,
      complete: complete || undefined,
      // AIMS360 refuses a repeated PO per customer, so split orders get the season added.
      customerPurchaseOrder: cart.customerPurchaseOrder
        ? bySeason.size > 1
          ? `${cart.customerPurchaseOrder}-${g.season}`
          : cart.customerPurchaseOrder
        : undefined,
      store: cart.shipToStore ? { code: cart.shipToStore } : undefined,
      customerNotes: cart.notes || undefined,
      customFields: type ? [{ displayName: 'Order Type', value: type.code }] : [],
      lineItems: g.lines.map((l) => ({
        style: l.style,
        color: l.color,
        price: l.price,
        listPrice: l.listPrice,
        discountPercent: l.discountPercent || undefined,
        sizes: l.sizes
      }))
    }
  }));

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    customer: customer ? { customerAccount: customer.customerAccount, customerName: customer.customerName } : null,
    orderType: type ? { code: type.code, label: type.label } : null,
    deliveryWindow: window,
    status,
    credit,
    units,
    merchandise,
    discountPercent: opt.discount,
    discountAmount,
    amount,
    orders
  };
}

export function creditCheck(customer, thisOrder) {
  const p = getProvider();
  const ar = customer.totalAR || 0;
  const openOrders = p.openOrdersValue(customer.customerAccount);
  const exposure = round2(ar + openOrders + thisOrder);
  const limit = customer.creditLimit || 0;
  return {
    limit,
    ar,
    openOrders,
    thisOrder: round2(thisOrder),
    exposure,
    available: limit > 0 ? round2(limit - ar - openOrders) : null,
    over: limit > 0 && exposure > limit
  };
}

export function submitCart(user, cart) {
  const preview = buildPreview(user, cart);
  if (!preview.ok) return { ok: false, preview };
  const p = getProvider();
  const created = preview.orders.map((o) => p.createOrder({ ...o.payload, createdBy: user.email }));
  return { ok: true, preview, orders: created };
}

// Bulk release = an AIMS360 distribution order pointing at the bulk order.
export function releaseFromBulk(actor, bulkOrderID, { shipToStore, lines, start }) {
  const p = getProvider();
  const bulk = p.getOrder(bulkOrderID);
  if (!bulk || !bulk.bulkOrder) throw Object.assign(new Error('That is not a bulk order.'), { status: 400 });
  if (actor.role === 'buyer' && bulk.customerAccount !== actor.customerAccount)
    throw Object.assign(new Error('Not your order.'), { status: 403 });
  const lineItems = (lines || [])
    .map((l) => ({
      style: l.style,
      color: l.color,
      price: bulk.lineItems.find((b) => b.style === l.style && b.color === l.color)?.price,
      sizes: Object.entries(l.sizes || {})
        .map(([sizeName, q]) => ({ sizeName, orderQuantity: Math.floor(Number(q) || 0) }))
        .filter((z) => z.orderQuantity > 0)
    }))
    .filter((l) => l.sizes.length);
  if (!lineItems.length) throw Object.assign(new Error('Enter at least one quantity to release.'), { status: 400 });

  // A release moves value from the bulk order to a new order, so exposure does not grow.
  const customer = p.getCustomer(bulk.customerAccount);
  const credit = creditCheck(customer, 0);

  return p.createOrder({
    customerAccount: bulk.customerAccount,
    season: bulk.season,
    status: credit.over ? 'Hold' : 'Open',
    orderStatusReason: credit.over ? 'CR' : undefined,
    distributionOrder: true,
    bulkOrderID: bulk.orderID,
    store: shipToStore ? { code: shipToStore } : undefined,
    start: start || today(),
    customerPurchaseOrder: `${bulk.customerPurchaseOrder || bulk.order}-R${
      p.listOrders({ customerAccount: bulk.customerAccount }).filter((o) => o.bulkOrderID === bulk.orderID).length + 1
    }`,
    customFields: [{ displayName: 'Order Type', value: 'B' }],
    lineItems,
    createdBy: actor.email
  });
}
