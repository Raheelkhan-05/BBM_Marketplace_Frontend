// hooks/useCartSummary.js
// CartContext exposes `cartCount` (number of lines). It has no money total, so the bar shows
// "Ready to order" instead of a price rather than guessing one.
import { useCart } from "../context/CartContext.jsx";

export default function useCartSummary() {
    const { cartCount } = useCart();
    return { count: Number(cartCount) || 0, total: null };
}