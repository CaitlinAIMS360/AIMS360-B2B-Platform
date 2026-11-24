import bcrypt from 'bcryptjs';
import { load } from './store.js';

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, customerAccount: u.customerAccount || null };
}

export function currentUser(req) {
  const uid = req.session?.uid;
  if (!uid) return null;
  const u = load().users.find((x) => x.id === uid && x.active);
  return u || null;
}

// portal: 'buyer' (retailer login) or 'admin' (brand admin; Runway login in the live version)
export function login(email, password, portal) {
  const u = load().users.find((x) => x.email.toLowerCase() === String(email || '').toLowerCase().trim());
  if (!u || !u.active || !bcrypt.compareSync(String(password || ''), u.passwordHash)) return null;
  if (portal === 'admin' && u.role !== 'admin') return null;
  if (portal === 'buyer' && u.role !== 'buyer') return null;
  return u;
}

export const requireRole = (role) => (req, res, next) => {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Please sign in.' });
  if (u.role !== role) return res.status(403).json({ error: 'You do not have access to this page.' });
  req.user = u;
  next();
};
