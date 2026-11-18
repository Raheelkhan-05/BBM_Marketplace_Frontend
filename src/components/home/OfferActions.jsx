// components/home/OfferActions.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ShoppingCart } from "lucide-react";
import QuantityControl from "../QuantityControl.jsx";
import TwoWaySlide from "../TwoWaySlide.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { addToCart, updateCartItem, removeFromCart } from "../../utils/cartApi.js";
import { cartLinePricing, purchaseLimits, basisUnitLabel, inr } from "../../utils/pricing.js";
import { track } from "../../lib/analytics.js";

const INK = "#0B2533", MUTED = "#4F616C", HAIR = "#DCEBEC", TEAL = "#0E7C86", TEAL_DK = "#0A6670";
const YELLOW = "#FFD60A"
const EASE = [0.16, 1, 0.3, 1];
const AUTOSAVE_MS = 500;

// Same default basis rule as BuyNowModal, so a cart line added here and one added there always agree.
export const defaultBasisFor = (s) => (Number(s.units_per_master_pack) >= 1 ? "per_master_pack" : "per_pack");

const reveal = {
    initial: { height: 0, opacity: 0 },
    animate: { height: "auto", opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.26, ease: EASE },
};

/**
 * Not in cart  -> only the Add to cart / Buy now buttons (slider on phones for variant="list").
 * In cart      -> buttons/slider are removed; the quantity panel is shown instead.
 *                 Quantity edits auto-save to the cart. "Remove" takes the item out and the buttons return.
 */
export default function OfferActions({
    seller: s, includeGst, token, isLoggedIn, onRequireLogin, onBuyNow, onToast, variant = "list",
}) {
    const { getLine, setLine } = useCart();
    const id = s.submission_id;
    const line = getLine(id);
    const inCart = !!line;
    const basis = line?.basis || defaultBasisFor(s);

    const lim = useMemo(() => purchaseLimits({
        purchase_basis: basis, pack_size: s.pack_size, units_per_master_pack: s.units_per_master_pack,
        moq: s.moq, stock_type: s.stock_type, available_stock: s.stock_quantity,
    }), [basis, s.pack_size, s.units_per_master_pack, s.moq, s.stock_type, s.stock_quantity]);

    const [qty, setQty] = useState(() => (line ? Number(line.quantity) : lim.min));
    const [busy, setBusy] = useState(null); // "cart" | "buy" | "save" | null
    const editedRef = useRef(null);          // latest quantity the buyer typed/stepped, until it is saved
    const saveTimerRef = useRef(null);

    // Follow the cart line, unless the buyer has an unsaved edit in progress.
    useEffect(() => {
        if (!line) return;
        if (editedRef.current == null || editedRef.current === Number(line.quantity)) {
            editedRef.current = null;
            setQty(Number(line.quantity));
        }
    }, [line?.quantity]); // eslint-disable-line react-hooks/exhaustive-deps
    // Not in cart: quantity is always the minimum order.
    useEffect(() => { if (!inCart) { editedRef.current = null; setQty(lim.min); } }, [inCart, lim.min]);
    // Keep qty inside limits.
    useEffect(() => {
        setQty((q) => {
            let n = Number(q) || lim.min;
            if (n < lim.min) n = lim.min;
            if (!lim.outOfStock && lim.max != null && n > lim.max) n = lim.max;
            return n;
        });
    }, [lim.min, lim.max, lim.outOfStock]);

    useEffect(() => () => clearTimeout(saveTimerRef.current), []);

    const p = useMemo(() => cartLinePricing({ ...s, quantity: qty, purchase_basis: basis }), [s, qty, basis]);
    const shownTotal = includeGst ? p.bill.total : p.bill.taxable;
    const unitWord = basisUnitLabel(basis, Number(qty) !== 1);
    const moqWord = basisUnitLabel(basis, lim.min !== 1);
    const blocked = lim.outOfStock || !(Number(qty) >= lim.min);

    const needLogin = () => {
        if (!isLoggedIn || !token) { onRequireLogin?.(); return true; }
        return false;
    };

    // Add (first time) — at the minimum order quantity.
    const addLine = async () => {
        if (busy || blocked || needLogin()) return;
        setBusy("cart");
        let res = null;
        try { res = await addToCart(token, { submissionId: id, quantity: Number(qty), purchaseBasis: basis }); } catch { res = null; }
        setBusy(null);
        if (!res?.success) { onToast?.(res?.message || "Couldn't add to cart."); return; }
        setLine(id, Number(qty), basis);
        track("add_to_cart", { source: "home_feed", purchase_basis: basis, quantity: Number(qty), cart_value: Math.round(p.totalIncl) });
        onToast?.("Added to cart");
    };

    // Auto-save quantity edits while in cart.
    const saveQty = async (next) => {
        setBusy("save");
        let res = null;
        try { res = await updateCartItem(token, id, { quantity: next, purchaseBasis: basis }); } catch { res = null; }
        setBusy(null);
        if (!res?.success) {
            editedRef.current = null;
            setQty(Number(line?.quantity) || lim.min); // revert to what the cart really has
            onToast?.(res?.message || "Couldn't update your cart.");
            return;
        }
        setLine(id, next, basis);
        track("cart_quantity_updated", { source: "home_feed", purchase_basis: basis, quantity: next });
    };

    const handleQtyChange = (next) => {
        setQty(next);
        if (!inCart) return;
        editedRef.current = next;
        clearTimeout(saveTimerRef.current);
        if (next === Number(line.quantity)) { editedRef.current = null; return; }
        saveTimerRef.current = setTimeout(() => {
            if (needLogin()) return;
            saveQty(next);
        }, AUTOSAVE_MS);
    };

    const removeLine = async () => {
        if (busy === "cart" || !inCart || needLogin()) return;
        clearTimeout(saveTimerRef.current);
        editedRef.current = null;
        setBusy("cart");
        let res = null;
        try { res = await removeFromCart(token, id); } catch { res = null; }
        setBusy(null);
        if (res && res.success === false) { onToast?.(res.message || "Couldn't remove the item."); return; }
        setLine(id, 0);
        setQty(lim.min);
        onToast?.("Removed from cart");
    };

    const buyNow = () => {
        if (busy || blocked || needLogin()) return;
        onBuyNow?.(Number(qty), basis);
    };

    return (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <AnimatePresence initial={false} mode="wait">
                {inCart ? (
                    <motion.div key="in-cart" {...reveal} className="overflow-hidden">
                        <div className="rounded-2xl border bg-white p-3" style={{ borderColor: HAIR }}>
                            <div className="flex items-start justify-between gap-3">
                                <QuantityControl value={Number(qty)} min={lim.min} max={lim.max} disabled={lim.outOfStock}
                                    onChange={handleQtyChange} ariaLabel="Quantity" />
                                <div className="min-w-0 text-right">
                                    <p className="text-[10.5px] font-extrabold uppercase tracking-wider" style={{ color: MUTED }}>
                                        Total · {includeGst ? "incl. GST" : "excl. GST"}
                                    </p>
                                    <p className="text-[21px] font-extrabold leading-tight tabular-nums" style={{ color: INK }}>₹{inr(shownTotal)}</p>
                                    {!includeGst && p.bill.gst > 0 && (
                                        <p className="text-[11px] font-semibold" style={{ color: MUTED }}>You pay ₹{inr(p.bill.total)} incl. GST</p>
                                    )}
                                </div>
                            </div>

                            <p className="mt-2.5 text-[13px] font-extrabold" style={{ color: TEAL_DK }}>
                                {qty} {unitWord} = {inr(p.baseUnits)} {s.unit || "units"}
                                {Number(s.units_per_master_pack) >= 2 && basis === "per_master_pack" ? ` · ${inr(p.packs)} packs` : ""}
                            </p>
                            <p className="mt-0.5 text-[11.5px] font-semibold" style={{ color: MUTED }}>
                                Minimum order {lim.min} {moqWord}
                                {lim.capped && !lim.outOfStock ? ` · ${lim.max} available` : ""}
                                {p.discountPercent > 0 ? ` · ${p.discountPercent}% quantity discount applied` : ""}
                            </p>

                            <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: TEAL_DK }}>
                                {busy === "save" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <>✓ In your cart</>}
                            </p>
                            <div className="mt-2.5 flex items-stretch gap-2 border-t pt-3" style={{ borderColor: HAIR }}>
                                <button type="button" onClick={removeLine} disabled={busy === "cart"}
                                    className="flex h-11 shrink-0 items-center justify-center rounded-xl border px-4 text-[12.5px] font-bold disabled:opacity-50"
                                    style={{ borderColor: HAIR, color: MUTED }}>
                                    {busy === "cart" ? "Removing…" : "Remove"}
                                </button>
                                <button type="button" onClick={buyNow} disabled={busy === "cart" || busy === "save" || blocked}
                                    className="flex h-11 flex-1 items-center justify-center rounded-xl text-[15px] font-extrabold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
                                    style={{ background: "#F4511E", boxShadow: "0 6px 14px -8px rgba(244,81,30,0.8)" }}>
                                    Buy now
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="actions" {...reveal} className="overflow-hidden">
                        <div className="hidden">
                            <TwoWaySlide
                                leftLabel="Add to cart" rightLabel="Buy now"
                                onLeft={addLine} onRight={buyNow}
                                disabled={blocked} busy={!!busy}
                            />
                        </div>
                        <div className=" items-stretch gap-2 flex">
                            <button type="button" onClick={addLine} disabled={!!busy || blocked}
                                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] text-[20px] font-extrabold transition-transform active:scale-[0.98] disabled:opacity-60"
                                style={{ color: INK, background: YELLOW }}>
                                {busy === "cart" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                                Add to cart
                            </button>
                            <button type="button" onClick={buyNow} disabled={!!busy || blocked}
                                className="flex h-11 flex-1 items-center justify-center rounded-xl text-[20px] font-extrabold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
                                style={{ background: "#F4511E", boxShadow: "0 6px 14px -8px rgba(244,81,30,0.8)" }}>
                                Buy now
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}