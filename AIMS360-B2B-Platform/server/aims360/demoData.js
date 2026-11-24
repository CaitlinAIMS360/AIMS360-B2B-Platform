// Sample data shaped like an AIMS360 company. Used when AIMS360_MODE=demo.
// Field names follow the AIMS360 REST API where possible so the real
// provider can be swapped in without touching the portal screens.

export const company = {
  account: 'AZCMT',
  companyName: 'CAITLIN TEST COMPANY 2 (demo data)'
};

// Set when the portal is showing live AIMS360 data instead of the samples (see live.js).
export const live = { on: false, account: '', companyName: '', database: '', user: '', connector: '', at: '', styles: 0, styleColors: 0, customers: 0 };

export const seasons = [
  { code: 'SP27', description: 'Spring 2027' },
  { code: 'SU27', description: 'Summer 2027' },
  { code: 'FA26', description: 'Fall 2026' }
];

// Order Type custom field, as set up in AIMS360 (Order Category2).
export const orderTypeField = {
  customField: 'Order Category2',
  displayName: 'Order Type',
  options: [
    { code: 'I', description: 'Immediate' },
    { code: 'PB', description: 'Pre-Book' },
    { code: 'B', description: 'Bulk' }
  ]
};

export const holdReasons = [
  { code: 'CR', description: 'Credit hold' },
  { code: 'AD', description: 'Held by brand admin' }
];

const SIZES_ALPHA = ['XS', 'S', 'M', 'L', 'XL'];
const SIZES_NUM = ['0', '2', '4', '6', '8', '10', '12'];
const SIZES_OS = ['O/S'];

function grid(sizes, stock, wip) {
  return sizes.map((sizeName, i) => {
    const s = stock[i % stock.length];
    const w = wip[i % wip.length];
    return { sizeName, stock: s, wip: w, ots_i: s, ots: s + w };
  });
}

// Colours use real hex values so the demo can draw swatches and pictures.
export const styles = [
  {
    style: 'AW1001', description: 'Seamless Rib Bra Top', category: 'Activewear', season: 'SP27',
    wholesale: 18, retail: 48, available: '2027-01-15',
    colors: [
      { color: 'BLK', colorDescription: 'Black', hex: '#1f2328', sizes: grid(SIZES_ALPHA, [40, 62, 80, 55, 20], [100, 120]) },
      { color: 'SGE', colorDescription: 'Sage', hex: '#9caf88', sizes: grid(SIZES_ALPHA, [12, 30, 22, 8, 0], [60, 60]) }
    ]
  },
  {
    style: 'AW1002', description: 'High-Rise 7/8 Legging', category: 'Activewear', season: 'SP27',
    wholesale: 26, retail: 78, available: '2027-01-15',
    colors: [
      { color: 'BLK', colorDescription: 'Black', hex: '#1f2328', sizes: grid(SIZES_ALPHA, [70, 120, 140, 90, 35], [200, 150]) },
      { color: 'NVY', colorDescription: 'Navy', hex: '#1e2a4a', sizes: grid(SIZES_ALPHA, [25, 44, 51, 30, 9], [80, 80]) },
      { color: 'CLY', colorDescription: 'Clay', hex: '#b5654a', sizes: grid(SIZES_ALPHA, [0, 0, 6, 4, 0], [120, 140]) }
    ]
  },
  {
    style: 'AW1003', description: 'Run Club Half Zip', category: 'Activewear', season: 'SP27',
    wholesale: 34, retail: 98, available: '2027-02-01',
    colors: [
      { color: 'HGR', colorDescription: 'Heather Grey', hex: '#a7a9ac', sizes: grid(SIZES_ALPHA, [15, 28, 33, 21, 6], [40, 40]) },
      { color: 'CRM', colorDescription: 'Cream', hex: '#efe6d2', sizes: grid(SIZES_ALPHA, [0, 0, 0, 0, 0], [90, 110]) }
    ]
  },
  {
    style: 'AW1004', description: 'Everyday Bike Short', category: 'Activewear', season: 'SU27',
    wholesale: 17, retail: 52, available: '2027-04-01',
    colors: [
      { color: 'BLK', colorDescription: 'Black', hex: '#1f2328', sizes: grid(SIZES_ALPHA, [0, 0, 0, 0, 0], [150, 180]) },
      { color: 'COB', colorDescription: 'Cobalt', hex: '#2f55d4', sizes: grid(SIZES_ALPHA, [0, 0, 0, 0, 0], [80, 90]) }
    ]
  },
  {
    style: 'DR2001', description: 'Linen Wrap Midi Dress', category: 'Dresses', season: 'SU27',
    wholesale: 52, retail: 148, available: '2027-03-20',
    colors: [
      { color: 'NAT', colorDescription: 'Natural', hex: '#d9cbb0', sizes: grid(SIZES_NUM, [8, 14, 20, 18, 10, 6, 2], [30, 30]) },
      { color: 'TER', colorDescription: 'Terracotta', hex: '#c2603d', sizes: grid(SIZES_NUM, [4, 9, 12, 10, 6, 3, 0], [24, 24]) }
    ]
  },
  {
    style: 'DR2002', description: 'Satin Slip Dress', category: 'Dresses', season: 'FA26',
    wholesale: 44, retail: 128, available: '2026-08-15',
    colors: [
      { color: 'BLK', colorDescription: 'Black', hex: '#1f2328', sizes: grid(SIZES_NUM, [22, 30, 41, 38, 25, 12, 6], [0, 0]) },
      { color: 'EMR', colorDescription: 'Emerald', hex: '#1f6f50', sizes: grid(SIZES_NUM, [6, 10, 14, 11, 7, 3, 1], [0, 0]) }
    ]
  },
  {
    style: 'DR2003', description: 'Tiered Poplin Maxi', category: 'Dresses', season: 'SU27',
    wholesale: 48, retail: 138, available: '2027-04-10',
    colors: [
      { color: 'WHT', colorDescription: 'White', hex: '#f6f5f1', sizes: grid(SIZES_NUM, [0, 0, 0, 0, 0, 0, 0], [40, 50]) },
      { color: 'SKY', colorDescription: 'Sky', hex: '#9cc3e6', sizes: grid(SIZES_NUM, [0, 0, 0, 0, 0, 0, 0], [30, 30]) }
    ]
  },
  {
    style: 'TP3001', description: 'Boxy Cotton Tee', category: 'Tops', season: 'SP27',
    wholesale: 12, retail: 36, available: '2027-01-05',
    colors: [
      { color: 'WHT', colorDescription: 'White', hex: '#f6f5f1', sizes: grid(SIZES_ALPHA, [120, 210, 260, 180, 75], [300, 300]) },
      { color: 'BLK', colorDescription: 'Black', hex: '#1f2328', sizes: grid(SIZES_ALPHA, [90, 160, 190, 150, 60], [300, 300]) },
      { color: 'OLV', colorDescription: 'Olive', hex: '#6b6b3a', sizes: grid(SIZES_ALPHA, [30, 45, 50, 40, 12], [100, 100]) }
    ]
  },
  {
    style: 'TP3002', description: 'Poplin Button-Down', category: 'Tops', season: 'SP27',
    wholesale: 29, retail: 88, available: '2027-01-20',
    colors: [
      { color: 'BLU', colorDescription: 'Blue Stripe', hex: '#6f8fc2', sizes: grid(SIZES_ALPHA, [18, 30, 34, 26, 10], [50, 50]) },
      { color: 'WHT', colorDescription: 'White', hex: '#f6f5f1', sizes: grid(SIZES_ALPHA, [24, 40, 46, 30, 12], [50, 50]) }
    ]
  },
  {
    style: 'TP3003', description: 'Cropped Cardigan', category: 'Tops', season: 'FA26',
    wholesale: 38, retail: 110, available: '2026-09-01',
    colors: [
      { color: 'OAT', colorDescription: 'Oatmeal', hex: '#cdbfa6', sizes: grid(SIZES_ALPHA, [10, 22, 25, 14, 3], [0, 0]) },
      { color: 'BRG', colorDescription: 'Burgundy', hex: '#6d1f2c', sizes: grid(SIZES_ALPHA, [4, 8, 12, 9, 2], [0, 0]) }
    ]
  },
  {
    style: 'BT4001', description: 'Wide-Leg Trouser', category: 'Bottoms', season: 'SP27',
    wholesale: 39, retail: 118, available: '2027-02-10',
    colors: [
      { color: 'BLK', colorDescription: 'Black', hex: '#1f2328', sizes: grid(SIZES_NUM, [12, 20, 28, 24, 16, 8, 4], [40, 40]) },
      { color: 'TAN', colorDescription: 'Tan', hex: '#b9976b', sizes: grid(SIZES_NUM, [6, 10, 14, 12, 8, 4, 2], [30, 30]) }
    ]
  },
  {
    style: 'BT4002', description: 'Relaxed Denim Jean', category: 'Bottoms', season: 'FA26',
    wholesale: 42, retail: 128, available: '2026-08-01',
    colors: [
      { color: 'IND', colorDescription: 'Indigo', hex: '#2c3e66', sizes: grid(SIZES_NUM, [30, 44, 52, 47, 30, 18, 8], [60, 60]) },
      { color: 'LTW', colorDescription: 'Light Wash', hex: '#8fa9c9', sizes: grid(SIZES_NUM, [14, 20, 26, 22, 14, 8, 4], [40, 40]) }
    ]
  },
  {
    style: 'AC5001', description: 'Canvas Tote', category: 'Accessories', season: 'SP27',
    wholesale: 14, retail: 42, available: '2027-01-05',
    colors: [
      { color: 'NAT', colorDescription: 'Natural', hex: '#d9cbb0', sizes: grid(SIZES_OS, [240], [200]) },
      { color: 'BLK', colorDescription: 'Black', hex: '#1f2328', sizes: grid(SIZES_OS, [180], [200]) }
    ]
  },
  {
    style: 'AC5002', description: 'Ribbed Beanie', category: 'Accessories', season: 'FA26',
    wholesale: 9, retail: 28, available: '2026-09-15',
    colors: [
      { color: 'OAT', colorDescription: 'Oatmeal', hex: '#cdbfa6', sizes: grid(SIZES_OS, [90], [0]) },
      { color: 'FOR', colorDescription: 'Forest', hex: '#2e4a3a', sizes: grid(SIZES_OS, [64], [0]) }
    ]
  },
  {
    // Inactive in AIMS360: brand admins can still find it, buyers and guests cannot.
    style: 'TP2998', description: 'Archive Stripe Tee', category: 'Tops', season: 'FA26', status: 'Inactive',
    wholesale: 11, retail: 34, available: '2026-03-01',
    colors: [
      { color: 'NVY', colorDescription: 'Navy', hex: '#1e2a4a', sizes: grid(SIZES_ALPHA, [3, 5, 4, 2, 0], [0, 0]) }
    ]
  }
];

// Customers carry credit limit and A/R like the AIMS360 customer master.
// priceSheet: percent off wholesale, to imitate a per-customer price sheet.
export const customers = [
  {
    customerAccount: 'CMAIM', customerName: 'AIMS CAITLIN', terms: 'NET 30', currency: 'USD',
    creditLimit: 25000, totalAR: 6200, priceSheet: { name: 'Key Accounts', percentOff: 10 },
    stores: [
      { code: 'MAIN', name: 'Main Street Flagship', city: 'Los Angeles', state: 'CA' },
      { code: 'SM', name: 'Santa Monica', city: 'Santa Monica', state: 'CA' },
      { code: 'PDX', name: 'Pearl District', city: 'Portland', state: 'OR' }
    ]
  },
  {
    customerAccount: 'CAITM', customerName: 'Caitlins Activewear', terms: 'NET 30', currency: 'USD',
    creditLimit: 5000, totalAR: 3900, priceSheet: null,
    stores: [{ code: 'MAIN', name: 'Caitlins Activewear', city: 'Austin', state: 'TX' }]
  },
  {
    customerAccount: 'ADASA', customerName: 'Adam Sandler Boutique', terms: 'NET 60', currency: 'USD',
    creditLimit: 0, totalAR: 0, priceSheet: null,
    stores: [{ code: 'MAIN', name: 'Adam Sandler Boutique', city: 'New York', state: 'NY' }]
  }
];

export const invoices = [
  { invoice: '210441', customerAccount: 'CMAIM', invoiceDate: '2026-10-02', dueDate: '2026-11-01', total: 4120.0, balance: 4120.0, order: '1000100890' },
  { invoice: '210398', customerAccount: 'CMAIM', invoiceDate: '2026-09-11', dueDate: '2026-10-11', total: 2080.0, balance: 2080.0, order: '1000100871' },
  { invoice: '210210', customerAccount: 'CMAIM', invoiceDate: '2026-07-20', dueDate: '2026-08-19', total: 3310.5, balance: 0, order: '1000100840' },
  { invoice: '210455', customerAccount: 'CAITM', invoiceDate: '2026-10-15', dueDate: '2026-11-14', total: 3900.0, balance: 3900.0, order: '1000100895' }
];

export const shipVias = ['UPS Ground', 'FedEx Ground', 'FedEx 2Day', 'Customer Pickup', 'Routing Guide'];
export const salesReps = [
  { code: 'HSE', name: 'House Account' },
  { code: 'CMO', name: 'Caitlin Molloy' },
  { code: 'WST', name: 'West Coast Showroom' }
];
export const discountReasons = ['Trade Show', 'Volume', 'New Account', 'Promotion'];
export const warehouses = [
  { code: '01', name: 'Los Angeles', share: 0.7 },
  { code: '02', name: 'New Jersey', share: 0.3 }
];

// Extra style attributes used by the catalog filters.
const attrs = {
  AW1001: ["Women's", 'Nylon Rib'], AW1002: ["Women's", 'Nylon Spandex'], AW1003: ['Unisex', 'Performance Knit'],
  AW1004: ["Women's", 'Nylon Spandex'], DR2001: ["Women's", 'Linen'], DR2002: ["Women's", 'Satin'], DR2003: ["Women's", 'Cotton Poplin'],
  TP3001: ['Unisex', 'Cotton Jersey'], TP3002: ["Women's", 'Cotton Poplin'], TP3003: ["Women's", 'Wool Blend'],
  BT4001: ["Women's", 'Twill'], BT4002: ['Unisex', 'Denim'], AC5001: ['Unisex', 'Canvas'], AC5002: ['Unisex', 'Wool Blend']
};
for (const s of styles) [s.gender, s.fabric] = attrs[s.style] || ['Unisex', 'Other'];

// Division, style group and active/inactive status, as on the AIMS360 style master.
const divisions = { Activewear: 'Active', Accessories: 'Accessories' };
const groups = { AW1001: 'Core', AW1002: 'Core', TP3001: 'Core', BT4002: 'Core', AC5001: 'Core', AW1003: 'Fashion', AW1004: 'Fashion', DR2001: 'Fashion', DR2003: 'Fashion', TP3002: 'Fashion', BT4001: 'Fashion' };
for (const s of styles) {
  s.division = divisions[s.category] || 'Contemporary';
  s.styleGroup = groups[s.style] || 'Seasonal';
  s.status ||= 'Active';
}

export const credits = [
  { credit: 'CM-10482', customerAccount: 'CMAIM', date: '2026-10-20', reason: 'Return: RMA 30117', amount: 412.5, balance: 412.5 },
  { credit: 'CM-10391', customerAccount: 'CMAIM', date: '2026-09-02', reason: 'Damaged goods allowance', amount: 96.0, balance: 96.0 },
  { credit: 'CM-10455', customerAccount: 'CAITM', date: '2026-10-08', reason: 'Pricing adjustment', amount: 58.0, balance: 58.0 }
];
