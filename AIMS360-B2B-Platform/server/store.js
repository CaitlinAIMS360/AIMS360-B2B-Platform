// Tiny JSON-file store for portal-owned data: buyer accounts, settings,
// cancel requests, activity log, and (in demo mode) the AIMS360 orders.
// Swap for a real database before going live with many brands.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(here, '..', 'data');
const FILE = path.join(DATA_DIR, 'portal.json');

export const defaultSettings = {
  brandName: 'AIMS TRAINING',
  tagline: 'B2B Wholesale',
  accentColor: '#D43695',
  guestBrowsing: true,
  guestPrices: 'none', // none | msrp | wholesale
  hideSoldOut: false,
  showExactStock: true,
  lowStockThreshold: 12,
  allowOversellImmediate: false,
  minOrderUnits: 12,
  minOrderAmount: 250,
  requireTerms: true,
  termsText:
    'Orders are subject to availability and credit approval. Prebook orders ship within the selected delivery window. ' +
    'Cancellations after an order is picked are not accepted.',
  deliveryWindows: [
    { id: 'dw-sp27-1', name: 'Spring Delivery 1', start: '2027-01-15', complete: '2027-02-15' },
    { id: 'dw-sp27-2', name: 'Spring Delivery 2', start: '2027-02-15', complete: '2027-03-15' },
    { id: 'dw-su27-1', name: 'Summer Delivery 1', start: '2027-04-01', complete: '2027-05-01' }
  ]
};

function seedLinesheets() {
  const now = new Date().toISOString();
  return [
    {
      id: 'ls-sp27-active', name: 'Spring 2027 Activewear', season: 'SP27', active: true, customerAccounts: [],
      description: 'Core activewear for Spring delivery. Prebook now for January and February windows.',
      styles: ['AW1001', 'AW1002', 'AW1003', 'TP3001'], createdAt: now, updatedAt: now
    },
    {
      id: 'ls-su27-dresses', name: 'Summer 2027 Dresses', season: 'SU27', active: true, customerAccounts: [],
      description: 'Linen and poplin dresses, delivering from late March.',
      styles: ['DR2001', 'DR2003', 'AW1004'], createdAt: now, updatedAt: now
    },
    {
      id: 'ls-key-immediates', name: 'Key Account Immediates', season: '', active: true, customerAccounts: ['CMAIM'],
      description: 'In-stock styles ready to ship now. Shared with key accounts only.',
      styles: ['DR2002', 'BT4002', 'TP3003', 'AC5001', 'AC5002'], createdAt: now, updatedAt: now
    }
  ];
}

function seed() {
  const hash = (p) => bcrypt.hashSync(p, 10);
  return {
    version: 1,
    settings: structuredClone(defaultSettings),
    users: [
      { id: 'u-admin', email: 'admin@aims360.test', name: 'Brand Admin', role: 'admin', passwordHash: hash('admin1234'), active: true },
      { id: 'u-b1', email: 'buyer@aimscaitlin.test', name: 'Jordan Lee', role: 'buyer', customerAccount: 'CMAIM', passwordHash: hash('buyer1234'), active: true },
      { id: 'u-b2', email: 'buyer@activewear.test', name: 'Sam Rivera', role: 'buyer', customerAccount: 'CAITM', passwordHash: hash('buyer1234'), active: true }
    ],
    // Demo-mode stand-in for AIMS360's order table.
    aimsOrders: [],
    // Demo-mode stand-in for customers created in AIMS360 from the portal.
    aimsCustomers: [],
    linesheets: seedLinesheets(),
    nextOrderNumber: 1000101000,
    cancelRequests: [],
    accessRequests: [],
    activity: []
  };
}

let state = null;

export function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    state.settings = { ...structuredClone(defaultSettings), ...state.settings };
    state.aimsCustomers ??= [];
    state.accessRequests ??= [];
    state.linesheets ??= seedLinesheets();
  } catch {
    state = seed();
    save();
  }
  return state;
}

export function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

export function reset() {
  state = seed();
  save();
  return state;
}

export const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;

export function logActivity(actor, action, detail) {
  const s = load();
  s.activity.unshift({ at: new Date().toISOString(), actor, action, detail });
  s.activity = s.activity.slice(0, 500);
  save();
}
