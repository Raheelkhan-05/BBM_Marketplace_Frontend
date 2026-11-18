// components/home/StoreCheckoutBar.jsx
// Floating checkout bar for the single-store view. Appears once the cart has items and hides the
// BottomNavStrip while visible. Render it only when a store is open: {shopSlug && <StoreCheckoutBar />}
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useCartSummary from "../../hooks/useCartSummary";
import { useHideDock } from "../../context/DockVisibilityContext.jsx";

const inr = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function StoreCheckoutBar() {
    const navigate = useNavigate();
    const { count, total } = useCartSummary();
    const active = count > 0;
    useHideDock(active);

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    key="store-checkout"
                    role="region"
                    aria-label="Cart summary"
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]"
                >
                    <div className="pointer-events-auto flex w-full max-w-[560px] items-center justify-between gap-3 rounded-2xl bg-[#0B2533] py-2 pl-4 pr-2 shadow-[0_16px_34px_-12px_rgba(11,37,51,0.6)]">
                        <div className="min-w-0 leading-tight">
                            <p className="text-[11px] font-bold tracking-wide text-[#A9C3CE]">{count} {count === 1 ? "item" : "items"} in cart</p>
                            <p className="truncate text-[17px] font-extrabold tracking-wide text-white">{total ? `₹${inr(total)}` : "Ready to order"}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/cart")}
                            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#F4511E] px-5 text-[14px] font-extrabold tracking-wide text-white shadow-[0_6px_14px_-8px_rgba(244,81,30,0.9)] transition active:scale-[0.97]"
                        >
                            Checkout <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}