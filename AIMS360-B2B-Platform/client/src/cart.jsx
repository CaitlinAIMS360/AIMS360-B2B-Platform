import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// The cart autosaves in the browser so a dropped session never loses an order.
const CartContext = createContext(null);
const empty = { customerAccount: '', lines: [], orderType: '', deliveryWindowId: '', customerPurchaseOrder: '', shipToStore: '', notes: '', acceptTerms: false, options: { shipvia: '', term: '', salesRep: '', commissionPercent: '', salesRep2: '', commissionPercent2: '', discountPercent: '', discountReason: '', status: '' } };

function read(key) {
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(key) || '{}') };
  } catch {
    return { ...empty };
  }
}

export function CartProvider({ userId, children }) {
  const key = `b2b-cart-${userId}`;
  const [cart, setCart] = useState(() => read(key));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(cart));
    } catch {
      /* storage unavailable: cart still works for this visit */
    }
  }, [cart, key]);

  const value = useMemo(() => {
    const setLine = (style, color, sizes, meta) =>
      setCart((c) => {
        const clean = Object.fromEntries(Object.entries(sizes).filter(([, q]) => Number(q) > 0).map(([k, q]) => [k, Math.floor(Number(q))]));
        const rest = c.lines.filter((l) => !(l.style === style && l.color === color));
        return { ...c, lines: Object.keys(clean).length ? [...rest, { style, color, sizes: clean, ...meta }] : rest };
      });
    const units = cart.lines.reduce((t, l) => t + Object.values(l.sizes).reduce((a, b) => a + b, 0), 0);
    return {
      cart,
      units,
      setLine,
      setField: (k, v) => setCart((c) => ({ ...c, [k]: v })),
      clear: () => setCart({ ...empty })
    };
  }, [cart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
