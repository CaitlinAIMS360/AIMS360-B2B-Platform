// Shapes AIMS360 orders for the screens: order type label, bulk balance,
// releases, and any pending cancel request.
import { getProvider } from './aims360/index.js';
import { orderOpenValue } from './aims360/demoProvider.js';
import { load } from './store.js';

export function orderView(o) {
  const p = getProvider();
  const { cancelRequests } = load();
  const type = o.customFields.find((f) => f.displayName === 'Order Type');
  const releases = o.bulkOrder ? p.listOrders({ customerAccount: o.customerAccount }).filter((x) => x.bulkOrderID === o.orderID) : [];
  const toRelease = o.bulkOrder
    ? o.lineItems.reduce(
        (t, l) => t + l.sizes.reduce((u, z) => u + (z.orderQuantity - z.releasedQuantity - z.shippedQuantity), 0),
        0
      )
    : null;
  const cancelRequest = cancelRequests.find((c) => c.orderID === o.orderID && c.state === 'pending') || null;
  const bulk = o.bulkOrderID ? p.getOrder(o.bulkOrderID) : null;
  return {
    ...o,
    orderType: type ? { code: type.value, label: type.valueDescription } : null,
    openValue: orderOpenValue(o),
    toRelease,
    releases: releases.map((r) => ({ orderID: r.orderID, order: r.order, status: r.status, bookedTotal: r.bookedTotal, shipToStore: r.shipToStore, createdOn: r.createdOn })),
    bulkOrderNumber: bulk?.order || null,
    cancelRequest
  };
}
