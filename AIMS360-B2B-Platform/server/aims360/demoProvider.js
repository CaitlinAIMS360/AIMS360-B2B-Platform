// Demo AIMS360 provider. Mirrors the parts of the AIMS360 REST API the
// portal uses, so the real provider (next phase) can replace it 1:1.
//
//   createOrder(payload)   ~ POST /orders/v1.4/order
//   cancelOrder(id, body)  ~ POST /orders/v1.0/order/{OrderID}/cancel
//   updateOrder(id, body)  ~ PUT  /orders/v1.1/order/{OrderID}   (status Open/Hold)
import * as data from './demoData.js';
import { load, save, id } from '../store.js';

class AimsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.status = 400;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

function findStyleColor(style, color) {
  const s = data.styles.find((x) => x.style === style);
  if (!s) throw new AimsError('ERR-STYLE', `Style ${style} not found`);
  const c = s.colors.find((x) => x.color === color);
  if (!c) throw new AimsError('ERR-COLOR', `Colour ${color} not found on style ${style}`);
  return { s, c };
}

function resolveOrderType(customFields = []) {
  const f = data.orderTypeField;
  const entry = customFields.find(
    (cf) => cf.customField === f.customField || cf.displayName === f.displayName
  );
  if (!entry) return null;
  const opt = f.options.find(
    (o) => o.code === entry.value || o.description.toLowerCase() === String(entry.value).toLowerCase()
  );
  if (!opt) throw new AimsError('ERR-CUSTOMFIELD', `"${entry.value}" is not an option of ${f.displayName}`);
  return { customField: f.customField, displayName: f.displayName, value: opt.code, valueDescription: opt.description };
}

function lineUnits(line) {
  return line.sizes.reduce((t, z) => t + z.orderQuantity, 0);
}

export function orderOpenValue(o) {
  if (!['Open', 'Hold'].includes(o.status)) return 0;
  const net = 1 - (o.netDiscountPercentage || 0) / 100;
  return round2(
    net *
    o.lineItems.reduce(
      (t, l) =>
        t + l.sizes.reduce((u, z) => u + (z.orderQuantity - (z.releasedQuantity || 0) - (z.shippedQuantity || 0)) * l.price, 0),
      0
    )
  );
}

export const demoProvider = {
  get mode() { return data.live.on ? 'live' : 'demo'; },
  // Orders and linesheets made against one company never show under another.
  company: () => (data.live.on ? data.live.account : ''),

  getCompany: () => data.company,
  listSeasons: () => data.seasons,
  getOrderTypeField: () => data.orderTypeField,
  listHoldReasons: () => data.holdReasons,

  // Active styles only; listAllStyles includes inactive ones for brand admins.
  listStyles: () => data.styles.filter((s) => s.status !== 'Inactive'),
  listAllStyles: () => data.styles,
  getStyle: (style) => data.styles.find((s) => s.style === style) || null,

  listShipVias: () => data.shipVias,
  listSalesReps: () => data.salesReps,
  listDiscountReasons: () => data.discountReasons,
  // ~ stock by warehouse from the style lookup
  stockByWarehouse(color) {
    if (data.live.on) return []; // live stock by warehouse is not read yet, and is never estimated
    const total = color.sizes.reduce((t, z) => t + z.stock, 0);
    const first = Math.round(total * data.warehouses[0].share);
    return [
      { ...data.warehouses[0], units: first },
      { ...data.warehouses[1], units: total - first }
    ].map(({ code, name, units }) => ({ code, name, units }));
  },
  listTerms: () => ['NET 30', 'NET 60', 'NET 15', 'COD', 'CREDIT CARD'],
  listCustomers: () => [...data.customers, ...load().aimsCustomers],
  getCustomer(account) {
    return this.listCustomers().find((c) => c.customerAccount === account) || null;
  },

  // ~ POST /customers/v1.1/customer
  createCustomer(payload) {
    const st = load();
    const name = String(payload.customerName || '').trim();
    if (!name) throw new AimsError('ERR-CUSTOMER', 'Customer name is required');
    if (!this.listTerms().includes(payload.terms)) throw new AimsError('ERR-TERMS', 'Choose valid payment terms');
    const taken = new Set(this.listCustomers().map((c) => c.customerAccount));
    let account = String(payload.customerAccount || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (account && taken.has(account)) throw new AimsError('ERR-ACCOUNT', `Account code ${account} is already in use`);
    if (!account) {
      const base = (name.toUpperCase().replace(/[^A-Z0-9]/g, '') + 'XXXXX').slice(0, 5);
      account = base;
      for (let i = 1; taken.has(account); i++) account = base.slice(0, 5 - String(i).length) + i;
    }
    if (this.listCustomers().some((c) => c.customerName.toLowerCase() === name.toLowerCase()))
      throw new AimsError('ERR-DUPLICATE', `A customer named "${name}" already exists`);
    const customer = {
      customerAccount: account,
      customerName: name,
      terms: payload.terms,
      currency: 'USD',
      creditLimit: Math.max(0, Number(payload.creditLimit) || 0),
      totalAR: 0,
      priceSheet: null,
      email: payload.email || null,
      phone: payload.phone || null,
      buyerName: payload.buyerName || null,
      address: { address1: payload.address1 || '', city: payload.city || '', state: payload.state || '', zipCode: payload.zipCode || '', country: payload.country || 'US' },
      stores: [{ code: 'MAIN', name, city: payload.city || '', state: payload.state || '' }],
      createdOn: new Date().toISOString(),
      createdVia: 'B2B Portal'
    };
    st.aimsCustomers.push(customer);
    save();
    return customer;
  },

  // ~ style lookup with filters.customerAccount: what this customer pays per size.
  getCustomerPrice(account, style) {
    const c = this.getCustomer(account);
    const s = this.getStyle(style);
    if (!s) return null;
    const pct = c?.priceSheet?.percentOff || 0;
    return {
      price: round2(s.wholesale * (1 - pct / 100)),
      wholesale: s.wholesale,
      retail: s.retail,
      source: c?.priceSheet ? `Price sheet: ${c.priceSheet.name}` : 'Wholesale price'
    };
  },

  listOrders({ customerAccount } = {}) {
    const st = load();
    return st.aimsOrders
      .filter((o) => (o.company || '') === this.company())
      .filter((o) => !customerAccount || o.customerAccount === customerAccount)
      .sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  },

  getOrder(orderID) {
    return load().aimsOrders.find((o) => o.orderID === orderID || o.order === orderID) || null;
  },

  openOrdersValue(account) {
    // Live: open orders already in AIMS360, plus orders placed here that have not been sent.
    const inAims = data.live.on ? this.getCustomer(account)?.liveOpenOrders || 0 : 0;
    return round2(inAims + this.listOrders({ customerAccount: account }).reduce((t, o) => t + orderOpenValue(o), 0));
  },

  listCredits(account) {
    return data.credits.filter((c) => !account || c.customerAccount === account);
  },

  listInvoices(account) {
    return data.invoices.filter((i) => !account || i.customerAccount === account);
  },

  // ~ POST /orders/v1.4/order
  createOrder(payload) {
    const st = load();
    const customer = this.getCustomer(payload.customerAccount);
    if (!customer) throw new AimsError('ERR-CUSTOMER', 'Customer not found');
    if (!payload.season || !data.seasons.some((s) => s.code === payload.season))
      throw new AimsError('ERR-SEASON', 'A valid season is required');
    if (!['Open', 'Hold'].includes(payload.status)) throw new AimsError('ERR-STATUS', 'Status must be Open or Hold');
    if (!payload.lineItems?.length) throw new AimsError('ERR-LINES', 'At least one line is required');
    if (payload.bulkOrder && payload.distributionOrder)
      throw new AimsError('ERR-BULK', 'An order cannot be both a bulk order and a distribution order');

    let bulk = null;
    if (payload.distributionOrder) {
      bulk = st.aimsOrders.find((o) => o.orderID === payload.bulkOrderID);
      if (!bulk || !bulk.bulkOrder) throw new AimsError('ERR-BULKID', 'bulkOrderID must point to a bulk order');
      if (!['Open', 'Hold'].includes(bulk.status)) throw new AimsError('ERR-BULKID', 'The bulk order is not open');
    }

    if (
      payload.customerPurchaseOrder &&
      st.aimsOrders.some(
        (o) => o.customerAccount === customer.customerAccount && o.customerPurchaseOrder === payload.customerPurchaseOrder && o.status !== 'Cancelled'
      )
    )
      throw new AimsError('ERR-PO', `PO ${payload.customerPurchaseOrder} was already used on another order for this customer`);

    const orderType = resolveOrderType(payload.customFields);

    const lineItems = payload.lineItems.map((l) => {
      const { s, c } = findStyleColor(l.style, l.color);
      const scale = c.sizes.map((z) => z.sizeName);
      const sizes = l.sizes
        .filter((z) => z.orderQuantity > 0)
        .map((z) => {
          if (!scale.includes(z.sizeName)) throw new AimsError('ERR-SIZE', `Size ${z.sizeName} is not on ${l.style}`);
          return { sizeName: z.sizeName, orderQuantity: z.orderQuantity, releasedQuantity: 0, shippedQuantity: 0 };
        });
      const price = l.price ?? this.getCustomerPrice(customer.customerAccount, s.style).price;
      return { style: s.style, description: s.description, color: c.color, colorDescription: c.colorDescription, price, listPrice: l.listPrice ?? price, discountPercent: l.discountPercent || 0, sizes };
    });

    // Releasing from a bulk order: check and record released units.
    if (bulk) {
      for (const l of lineItems) {
        const bl = bulk.lineItems.find((x) => x.style === l.style && x.color === l.color);
        if (!bl) throw new AimsError('ERR-RELEASE', `${l.style} ${l.color} is not on the bulk order`);
        for (const z of l.sizes) {
          const bz = bl.sizes.find((x) => x.sizeName === z.sizeName);
          const left = bz ? bz.orderQuantity - bz.releasedQuantity - bz.shippedQuantity : 0;
          if (z.orderQuantity > left)
            throw new AimsError('ERR-RELEASE', `Only ${left} left to release for ${l.style} ${l.color} ${z.sizeName}`);
        }
      }
      for (const l of lineItems) {
        const bl = bulk.lineItems.find((x) => x.style === l.style && x.color === l.color);
        for (const z of l.sizes) bl.sizes.find((x) => x.sizeName === z.sizeName).releasedQuantity += z.orderQuantity;
      }
    }

    // NET discount: one percent off every line, as AIMS360 books it.
    const net = Math.min(100, Math.max(0, Number(payload.netDiscountPercentage) || 0));
    const units = lineItems.reduce((t, l) => t + lineUnits(l), 0);
    const gross = round2(lineItems.reduce((t, l) => t + lineUnits(l) * l.price, 0));
    const amount = round2(gross * (1 - net / 100));
    const order = {
      orderID: id('ord'),
      order: String(st.nextOrderNumber++),
      orderSource: 'B2B Portal',
      company: this.company() || undefined,
      customerAccount: customer.customerAccount,
      customerName: customer.customerName,
      status: payload.status,
      orderStatusReason: payload.orderStatusReason || null,
      season: payload.season,
      entered: new Date().toISOString().slice(0, 10),
      start: payload.start || null,
      complete: payload.complete || null,
      customerPurchaseOrder: payload.customerPurchaseOrder || null,
      shipToStore: payload.store?.code || payload.shipToStore || null,
      notes: payload.customerNotes || null,
      shipvia: payload.shipvia || null,
      term: payload.term || customer.terms,
      salesRep: payload.salesRep || null,
      commissionPercent: payload.commissionPercent ?? null,
      salesRep2: payload.salesRep2 || null,
      commissionPercent2: payload.commissionPercent2 ?? null,
      netDiscountPercentage: net,
      discountReason: net ? payload.discountReason || null : null,
      merchandiseAmount: gross,
      bulkOrder: !!payload.bulkOrder,
      distributionOrder: !!payload.distributionOrder,
      bulkOrderID: payload.bulkOrderID || null,
      customFields: orderType ? [orderType] : [],
      lineItems,
      bookedTotal: units,
      bookedAmount: amount,
      createdOn: new Date().toISOString(),
      createdBy: payload.createdBy || null
    };
    st.aimsOrders.push(order);
    save();
    return order;
  },

  // ~ PUT /orders/v1.1/order/{OrderID} with status
  setOrderStatus(orderID, status, orderStatusReason = null) {
    const st = load();
    const o = st.aimsOrders.find((x) => x.orderID === orderID);
    if (!o) throw new AimsError('ERR-ORDER', 'Order not found');
    if (!['Open', 'Hold'].includes(o.status)) throw new AimsError('ERR-STATUS', `A ${o.status} order cannot be changed`);
    if (!['Open', 'Hold'].includes(status)) throw new AimsError('ERR-STATUS', 'Status must be Open or Hold');
    o.status = status;
    o.orderStatusReason = status === 'Hold' ? orderStatusReason : null;
    save();
    return o;
  },

  // ~ POST /orders/v1.0/order/{OrderID}/cancel  { reOpenBulkOrder, zapLineItems }
  cancelOrder(orderID, { reOpenBulkOrder = true } = {}) {
    const st = load();
    const o = st.aimsOrders.find((x) => x.orderID === orderID);
    if (!o) throw new AimsError('ERR-ORDER', 'Order not found');
    if (o.status === 'Cancelled') throw new AimsError('ERR-CANCEL', 'You cannot cancel an order if it is already canceled');
    if (o.distributionOrder && reOpenBulkOrder) {
      const bulk = st.aimsOrders.find((x) => x.orderID === o.bulkOrderID);
      if (bulk) {
        for (const l of o.lineItems) {
          const bl = bulk.lineItems.find((x) => x.style === l.style && x.color === l.color);
          for (const z of l.sizes) {
            const bz = bl?.sizes.find((x) => x.sizeName === z.sizeName);
            if (bz) bz.releasedQuantity = Math.max(0, bz.releasedQuantity - z.orderQuantity);
          }
        }
      }
    }
    o.status = 'Cancelled';
    o.cancelledDate = new Date().toISOString().slice(0, 10);
    save();
    return o;
  }
};
