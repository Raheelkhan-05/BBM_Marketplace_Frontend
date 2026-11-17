// components/home/HomeCartButton.jsx — always-reachable cart button for the Home sticky bar.
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useCart } from "../../context/CartContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function HomeCartButton() {
    const navigate = useNavigate();
    const { cartCount } = useCart();
    const { effectiveLoggedIn } = useAuth();
    if (!effectiveLoggedIn) return null;

    return (
        <button
            type="button"
            onClick={() => navigate("/cart")}
            aria-label={cartCount > 0 ? `Open cart, ${cartCount} item${cartCount === 1 ? "" : "s"}` : "Open cart"}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-100 active:scale-95"
            style={{ background: "#FFD60A", color: "#0B2533", boxShadow: "0 5px 12px rgba(255,214,10,0.45)" }}
        >
            <ShoppingCart className="h-6 w-6" strokeWidth={2.3} />
            <AnimatePresence initial={false}>
                {cartCount > 0 && (
                    <motion.span
                        key={cartCount}
                        initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 28 }}
                        className="absolute -right-1.5 -top-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-extrabold tabular-nums text-white"
                        style={{ background: "#D43806" }}
                    >
                        {cartCount > 99 ? "99+" : cartCount}
                    </motion.span>
                )}
            </AnimatePresence>
        </button>
    );
}