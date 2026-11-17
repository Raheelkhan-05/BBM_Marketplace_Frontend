// context/CartContext.jsx
//
// Single source of truth for the buyer's cart: the item count (Header / BottomNavStrip / Home cart
// button badge) AND a lookup of which listings are in the cart with their quantity + basis
// (so Home rows and steppers know what's already there, with no extra requests).
//
//   cartCount                     number of lines in the cart
//   lines                         Map<submissionId, { quantity, basis }>
//   getLine(submissionId)         -> { quantity, basis } | null
//   setLine(id, quantity, basis)  optimistic update (quantity <= 0 removes the line)
//   syncItems(items)              replace everything from a fetchCart() result (used by the cart page)
//   reload()                      re-fetch from the server
//   setCountOptimistic(n)         kept for older callers (only touches the count)
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { fetchCart } from "../utils/cartApi.js";

const CartContext = createContext(null);

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
    return ctx;
}

const toLines = (items) => {
    const map = new Map();
    for (const it of items || []) {
        if (!it?.submission_id) continue;
        map.set(String(it.submission_id), { quantity: Number(it.quantity) || 0, basis: it.purchase_basis || "per_pack" });
    }
    return map;
};

export function CartProvider({ children }) {
    const { token } = useAuth();
    const [lines, setLines] = useState(() => new Map());
    // Kept separate so the old setCountOptimistic(n) keeps working; reset whenever lines change.
    const [countOverride, setCountOverride] = useState(null);

    const syncItems = useCallback((items) => {
        setLines(toLines(items));
        setCountOverride(null);
    }, []);

    const reload = useCallback(async () => {
        if (!token) { setLines(new Map()); setCountOverride(null); return; }
        try {
            const res = await fetchCart(token);
            if (res?.success) syncItems(res.items);
        } catch { /* keep the last known cart */ }
    }, [token, syncItems]);

    useEffect(() => { reload(); }, [reload]);

    const setLine = useCallback((submissionId, quantity, basis) => {
        const key = String(submissionId);
        setCountOverride(null);
        setLines((prev) => {
            const next = new Map(prev);
            if (!(Number(quantity) > 0)) next.delete(key);
            else next.set(key, { quantity: Number(quantity), basis: basis || prev.get(key)?.basis || "per_pack" });
            return next;
        });
    }, []);

    const getLine = useCallback((submissionId) => lines.get(String(submissionId)) || null, [lines]);

    const setCountOptimistic = useCallback((count) => setCountOverride(Number(count) || 0), []);

    const value = useMemo(() => ({
        cartCount: countOverride != null ? countOverride : lines.size,
        lines, getLine, setLine, syncItems, reload, setCountOptimistic,
    }), [countOverride, lines, getLine, setLine, syncItems, reload, setCountOptimistic]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}