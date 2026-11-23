// src/pages/SaveCartPage.jsx — buyer cart (Tailwind).
//
// Served at BOTH /cart (inside the Home layout) and /buy/cart.
// Prices: the stored price is GST-inclusive; the bill derives taxable value / GST for display
// (see utils/pricing.js). Total payable is always the inclusive total = what checkout charges.
//
// Selective checkout: every line has a checkbox (all selected by default). Only selected lines are
// priced, validated (stock / delivery) and sent to checkout. Selection is tracked as a "deselected"
// set so newly loaded items are selected automatically.
//
// DESIGN: pure white, compact, inherits the app's font (no font-family set here).
// Type scale: title 20/bold · seller + product name 14/semibold · line total 16/bold ·
// meta 12/regular muted. A cart line = [checkbox | image | name + facts] then [stepper … total].
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Loader2, ShoppingCart, MapPin, Clock, AlertCircle, X, ArrowRight, ArrowLeft, Compass, Package, Store, Minus, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchCart, updateCartItem, removeFromCart, checkoutCart } from "../utils/cartApi.js";
import { startGroupPayment, redirectToGateway } from "../utils/paymentsApi.js";
import { fetchOrderConstraints } from "../utils/api.js";
import { track, safeCode } from "../lib/analytics.js";
import AddressBook from "../components/shipping/AddressBook.jsx";
import TransportAgreementModal from "../components/orders/TransportAgreementStep.jsx";
import PriceBill from "../components/PriceBill.jsx";
import { BuyerAddressProvider, useBuyerAddress } from "../context/BuyerAddressContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { cartLinePricing, purchaseLimits, sumBills, basisUnitLabel, inr, saleUnitLabel } from "../utils/pricing.js";
import { checkOrderWindow, checkLocationServiceable } from "../shared/orderConstraints.js";
import { resizedImageUrl } from "../utils/imageUrl";

const EXPLORE_ROUTE = "/home";
const T = {
    ink: "#0B2533", muted: "#5B6B75", soft: "#8795A0", teal: "#0E7C86", tealDk: "#0A6670", tealBg: "#E8F5F6",
    hair: "#E4EAEC", link: "#1A5FD0", cta: "#E8490F",
    amberBg: "#FFF8DB", amberBd: "#F3E0A0", amberTx: "#5C4300",
    red: "#D43806", redBg: "#FDF0EF", redBd: "#F5CFCC", redTx: "#B3261E",
};

const getLenis = () => (typeof window !== "undefined" ? window.lenis || window.__lenis || null : null);
const stopEvent = (e) => e.stopPropagation();
const plural = (n, word) => `${word}${Number(n) === 1 ? "" : "s"}`;

/* ---------------- small UI pieces ---------------- */
function Notice({ tone = "warn", icon: Icon = AlertCircle, title, children }) {
    const c = tone === "danger" ? { bg: T.redBg, bd: T.redBd, tx: T.redTx } : { bg: T.amberBg, bd: T.amberBd, tx: T.amberTx };
    return (
        <div role={tone === "danger" ? "alert" : undefined} className="flex items-start gap-2 rounded-lg border px-3 py-2" style={{ background: c.bg, borderColor: c.bd }}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: c.tx }} />
            <p className="text-[12.5px] leading-snug" style={{ color: c.tx }}>
                {title && <b className="block font-semibold">{title}</b>}{children}
            </p>
        </div>
    );
}

// 44px tap area, 20px visual box. Supports the "some selected" state.
function Check({ checked, indeterminate = false, onChange, disabled, label }) {
    const ref = useRef(null);
    useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked; }, [indeterminate, checked]);
    return (
        <label className="-ml-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
            <input ref={ref} type="checkbox" checked={checked} disabled={disabled} aria-label={label}
                onChange={(e) => onChange(e.target.checked)} className="h-[18px] w-[18px] cursor-pointer disabled:cursor-not-allowed" style={{ accentColor: T.teal }} />
        </label>
    );
}

function ProductThumb({ src, name, size = 88 }) {
    const [failed, setFailed] = useState(false);
    return (
        <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white"
            style={{ width: Math.round(size * 0.75), height: size }}>
            {src && !failed
                ? <img src={resizedImageUrl(src, { width: 256 })} alt={name || ""} loading="lazy" decoding="async" referrerPolicy="no-referrer"
                    onError={() => setFailed(true)} className="h-full w-full object-contain mix-blend-multiply" />
                : <Package className="h-6 w-6" style={{ color: T.soft }} />}
        </span>
    );
}

// Compact stepper (36px). Same rules as the shared QuantityControl: whole numbers, clamped to min/max.
function Stepper({ value, min = 1, max = null, onChange, disabled = false, label }) {
    const [text, setText] = useState(String(value));
    const [note, setNote] = useState(null);
    const focused = useRef(false);
    useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);
    useEffect(() => {
        if (!note) return undefined;
        const t = setTimeout(() => setNote(null), 2600);
        return () => clearTimeout(t);
    }, [note]);

    const hasMax = max != null && Number.isFinite(Number(max));
    const v = Number(value);
    const commit = (raw) => {
        const n = parseInt(String(raw).replace(/\D/g, ""), 10);
        if (!Number.isFinite(n)) { setText(String(value)); return; }
        let next = n;
        if (n < min) { next = min; setNote(`Minimum order is ${min}`); }
        else if (hasMax && n > max) { next = max; setNote(`Only ${max} available`); }
        setText(String(next));
        if (next !== v) onChange(next);
    };
    const step = (d) => {
        const next = v + d;
        if (next < min) { setNote(`Minimum order is ${min}`); return; }
        if (hasMax && next > max) { setNote(`Only ${max} available`); return; }
        onChange(next);
    };
    const atMin = v <= min, atMax = hasMax && v >= max;
    const btn = "flex h-9 w-9 shrink-0 items-center justify-center transition-colors active:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35";

    return (
        <div className="flex flex-col items-start gap-1">
            <div className="flex h-9 items-center overflow-hidden rounded-lg border" style={{ borderColor: "#CBD8DC", opacity: disabled ? 0.6 : 1 }}>
                <button type="button" aria-label="Decrease quantity" disabled={disabled || atMin} onClick={() => step(-1)} className={btn} style={{ color: T.ink }}>
                    <Minus className="h-4 w-4" strokeWidth={2.4} />
                </button>
                <input type="text" inputMode="numeric" aria-label={label} disabled={disabled} value={text}
                    onFocus={(e) => { focused.current = true; e.target.select(); }}
                    onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 7))}
                    onBlur={() => { focused.current = false; commit(text); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                    className="h-9 w-11 min-w-0 border-x bg-transparent text-center text-[14px] font-semibold tabular-nums focus:outline-none"
                    style={{ color: T.ink, borderColor: "#E4EAEC" }} />
                <button type="button" aria-label="Increase quantity" disabled={disabled || atMax} onClick={() => step(1)} className={btn} style={{ color: T.teal }}>
                    <Plus className="h-4 w-4" strokeWidth={2.4} />
                </button>
            </div>
            {note && <p role="status" className="text-[11.5px] font-medium" style={{ color: T.redTx }}>{note}</p>}
        </div>
    );
}

/* ---------------- item detail modal ---------------- */
function CartItemDetailModal({ item, onClose }) {
    const closeRef = useRef(); closeRef.current = onClose;

    useEffect(() => { // lock page scroll (native + Lenis)
        const root = document.documentElement;
        const sw = window.innerWidth - root.clientWidth;
        const { style } = document.body;
        const prevO = style.overflow, prevP = style.paddingRight, prevR = root.style.overflow;
        style.overflow = "hidden"; root.style.overflow = "hidden";
        if (sw > 0) style.paddingRight = `${sw}px`;
        try { getLenis()?.stop?.(); } catch { /* ignore */ }
        return () => {
            style.overflow = prevO; style.paddingRight = prevP; root.style.overflow = prevR;
            try { getLenis()?.start?.(); } catch { /* ignore */ }
        };
    }, []);
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") closeRef.current?.(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const p = cartLinePricing(item);
    const unit = basisUnitLabel(item.purchase_basis);
    const saleUnit = saleUnitLabel(item.units_per_master_pack);
    const terms = [
        ["Delivery", item.delivery_timeline], ["Payment", item.payment_terms], ["Returns", item.return_policy],
        ["Warranty", item.warranty], ["Ships from", item.dispatch_origin],
        ["Freight", item.freight_included != null ? (item.freight_included ? "Included in price" : "Extra, paid by buyer") : null],
    ].filter(([, v]) => v);

    return createPortal(
        <div className="sh-portal fixed inset-0 z-[999] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
            data-lenis-prevent onWheel={stopEvent} onTouchMove={stopEvent}
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current?.(); }}>
            <div role="dialog" aria-modal="true" aria-label={`Details of ${item.product_name}`}
                className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl" style={{ color: T.ink }}>
                <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: T.hair }}>
                    <ProductThumb src={item.product_image} name={item.product_name} size={48} />
                    <div className="min-w-0 flex-1">
                        <h2 className="line-clamp-2 text-[15px] font-bold leading-tight">{item.product_name}</h2>
                        <p className="mt-0.5 text-[12px]" style={{ color: T.muted }}>Sold by {item.seller_name}</p>
                    </div>
                    <button type="button" aria-label="Close" onClick={() => closeRef.current?.()} className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                        <X className="h-5 w-5" style={{ color: T.muted }} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-lenis-prevent>
                    <div className="mb-4 grid grid-cols-2 gap-2.5">
                        <div className="rounded-lg border px-3 py-2" style={{ borderColor: T.hair }}>
                            <p className="text-[11.5px]" style={{ color: T.muted }}>Quantity</p>
                            <p className="text-[14px] font-bold">{item.quantity} {plural(item.quantity, unit)}</p>
                        </div>
                        <div className="rounded-lg border px-3 py-2" style={{ borderColor: T.hair }}>
                            <p className="text-[11.5px]" style={{ color: T.muted }}>Total units</p>
                            <p className="text-[14px] font-bold">{p.baseUnits} {item.unit}</p>
                        </div>
                    </div>

                    <h3 className="mb-2 text-[13px] font-bold">Bill</h3>
                    <PriceBill bill={p.bill} qtyText={`${p.saleQty} ${plural(p.saleQty, saleUnit)}`} />
                    <p className="mt-2 text-[11.5px]" style={{ color: T.soft }}>Prices include GST. Taxable value and GST are shown for your records.</p>

                    {Array.isArray(item.price_slabs) && item.price_slabs.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                            {item.price_slabs.map((s, i) => (
                                <span key={i} className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium" style={{ borderColor: T.hair, color: T.muted }}>
                                    {s.minQty}{s.maxQty ? `–${s.maxQty}` : "+"} {plural(s.maxQty || s.minQty, saleUnit)}: ₹{inr(s.price)}
                                </span>
                            ))}
                        </div>
                    )}
                    {Array.isArray(item.quantity_discounts) && item.quantity_discounts.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {item.quantity_discounts.map((t, i) => (
                                <span key={i} className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: T.tealBg, color: T.tealDk }}>
                                    {t.minQty}+ {plural(t.minQty, saleUnit)}: {t.discountPercent}% off
                                </span>
                            ))}
                        </div>
                    )}

                    {terms.length > 0 && (
                        <>
                            <h3 className="mb-0.5 mt-5 text-[13px] font-bold">Seller terms</h3>
                            <div>
                                {terms.map(([k, v]) => (
                                    <div key={k} className="flex items-baseline justify-between gap-4 border-b py-2 text-[13px] last:border-b-0" style={{ borderColor: T.hair }}>
                                        <span className="shrink-0" style={{ color: T.muted }}>{k}</span>
                                        <span className="text-right font-semibold">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="border-t px-4 py-3" style={{ borderColor: T.hair, paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
                    <button type="button" onClick={() => closeRef.current?.()} className="h-11 w-full rounded-lg text-[14px] font-bold text-white" style={{ background: T.cta }}>Done</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ---------------- one cart line ---------------- */
function CartLine({ it, p, lim, isPicked, checking, blockedHere, onToggle, onQty, onRemove, onBill }) {
    const unitName = basisUnitLabel(it.purchase_basis);
    const overStock = lim.capped && Number(it.quantity) > lim.max;
    const notes = [];
    if (lim.outOfStock) notes.push("Out of stock with this seller. Remove or uncheck it to continue.");
    else if (overStock) notes.push(`Only ${lim.max} ${plural(lim.max, unitName)} available. Reduce the quantity to continue.`);
    if (blockedHere) notes.push("Not deliverable to your selected address.");

    return (
        <div className="flex items-start gap-1 px-3 py-3">
            <Check checked={isPicked} disabled={checking} label={`Select ${it.product_name}`} onChange={onToggle} />

            <div className="min-w-0 flex-1 transition-opacity duration-150" style={{ opacity: isPicked ? 1 : 0.55 }}>
                <div className="flex gap-3">
                    <button type="button" onClick={onBill} aria-label={`View details of ${it.product_name}`} className="shrink-0 self-start">
                        <ProductThumb src={it.product_image} name={it.product_name} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1">
                            <p className="line-clamp-2 min-w-0 flex-1 text-[14px] font-semibold leading-snug">{it.product_name}</p>
                            <button type="button" aria-label={`Remove ${it.product_name}`} onClick={onRemove}
                                className="-mr-2 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full active:bg-black/5">
                                <Trash2 className="h-4 w-4" style={{ color: T.soft }} />
                            </button>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-snug" style={{ color: T.muted }}>
                            ₹{inr(p.unitPrice)} / {saleUnitLabel(it.units_per_master_pack)}
                            {p.discountPercent > 0 && <b className="font-semibold" style={{ color: T.tealDk }}> · {p.discountPercent}% off</b>}
                        </p>
                        <p className="text-[12px] leading-snug" style={{ color: T.muted }}>
                            {it.quantity} {plural(it.quantity, unitName)} = {p.baseUnits} {it.unit}
                            <button type="button" onClick={onBill} className="ml-1.5 font-semibold" style={{ color: T.link }}>Bill</button>
                        </p>
                    </div>
                </div>

                <div className="mt-2.5 flex items-start justify-between gap-3">
                    <Stepper value={Number(it.quantity)} min={lim.min} max={lim.max} disabled={checking || lim.outOfStock}
                        onChange={onQty} label={`Quantity of ${it.product_name}`} />
                    <div className="pt-0.5 text-right">
                        <p className="text-[16px] font-bold leading-none tabular-nums">₹{inr(p.totalIncl)}</p>
                        <p className="mt-1 text-[11px]" style={{ color: T.soft }}>incl. GST</p>
                    </div>
                </div>

                {(notes.length > 0 || (lim.min > 1 && Number(it.quantity) <= lim.min && !lim.outOfStock)) && (
                    <div className="mt-2 flex flex-col gap-0.5">
                        {notes.map((t) => <p key={t} className="text-[12px] font-medium leading-snug" style={{ color: T.redTx }}>{t}</p>)}
                        {lim.min > 1 && Number(it.quantity) <= lim.min && !lim.outOfStock && (
                            <p className="text-[12px] leading-snug" style={{ color: T.muted }}>Minimum order: {lim.min} {plural(lim.min, unitName)}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ---------------- page ---------------- */
function CartPageInner() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { selectedAddress } = useBuyerAddress();
    const { syncItems, setLine } = useCart();
    const addressBookRef = useRef(null);
    const selectedAddressId = selectedAddress?.id || null;

    const [items, setItems] = useState([]);
    const itemsRef = useRef([]); itemsRef.current = items;
    const [loading, setLoading] = useState(true);
    const [viewingItem, setViewingItem] = useState(null);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState(null);
    const pendingWrites = useRef({});
    const [transportGroup, setTransportGroup] = useState(null); // { groupId }
    const checkoutPropsRef = useRef(null);

    const [deselected, setDeselected] = useState(() => new Set());

    // Back/forward-cache restore from the payment page can leave the button on its spinner.
    useEffect(() => {
        const onShow = (e) => { if (e.persisted) setChecking(false); };
        window.addEventListener("pageshow", onShow);
        return () => window.removeEventListener("pageshow", onShow);
    }, []);

    const load = useCallback(async () => {
        try {
            const res = await fetchCart(token);
            if (res?.success) { setItems(res.items); syncItems(res.items); }
        } catch { /* keep what we have */ }
        setLoading(false);
    }, [token, syncItems]);
    useEffect(() => { load(); }, [load]);

    const cartViewedRef = useRef(false);
    useEffect(() => {
        if (loading || cartViewedRef.current || !items.length) return;
        cartViewedRef.current = true;
        track("cart_viewed", { item_count: items.length, seller_count: new Set(items.map((i) => i.seller_id)).size });
    }, [loading, items]);

    // Forget deselections for items no longer in the cart.
    useEffect(() => {
        setDeselected((prev) => {
            if (!prev.size) return prev;
            const live = new Set(items.map((i) => i.submission_id));
            const next = new Set([...prev].filter((id) => live.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [items]);

    const grouped = useMemo(() => items.reduce((acc, it) => {
        (acc[it.seller_id] ||= { seller: it, items: [] }).items.push(it);
        return acc;
    }, {}), [items]);

    // ---- selection ----
    const selectedItems = useMemo(() => items.filter((it) => !deselected.has(it.submission_id)), [items, deselected]);
    const selectedCount = selectedItems.length;
    const itemCount = items.length;
    const allSelected = itemCount > 0 && selectedCount === itemCount;
    const noSelection = selectedCount === 0;

    const toggleItem = (id) => setDeselected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const setSelectionFor = (ids, on) => setDeselected((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.delete(id) : n.add(id))); return n; });

    // ---- pricing (selected lines only) ----
    const pricingById = useMemo(() => new Map(items.map((it) => [it.submission_id, cartLinePricing(it)])), [items]);
    const selectedBill = useMemo(
        () => sumBills(selectedItems.map((it) => pricingById.get(it.submission_id).bill)),
        [selectedItems, pricingById]
    );
    const grandTotal = selectedBill.total;

    // ---- order window + deliverability ----
    const submissionIds = useMemo(() => [...new Set(items.map((i) => i.submission_id).filter(Boolean))], [items]);
    const submissionIdsKey = submissionIds.join(",");
    const [constraintsBySubmission, setConstraintsBySubmission] = useState({});
    useEffect(() => {
        if (!submissionIds.length) { setConstraintsBySubmission({}); return undefined; }
        let cancelled = false;
        (async () => {
            const results = await Promise.all(submissionIds.map((id) => fetchOrderConstraints(id)));
            if (cancelled) return;
            const map = {};
            submissionIds.forEach((id, idx) => { if (results[idx]?.success) map[id] = results[idx]; });
            setConstraintsBySubmission(map);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submissionIdsKey]);

    const [clockTick, setClockTick] = useState(0);
    useEffect(() => { const id = setInterval(() => setClockTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);

    const groupStatus = useMemo(() => {
        const result = {};
        for (const [sellerId, group] of Object.entries(grouped)) {
            const c = constraintsBySubmission[group.items[0].submission_id];
            const windowStatus = checkOrderWindow(c ? {
                workingDays: c.workingDays, orderAcceptanceStart: c.orderAcceptanceStart,
                orderAcceptanceEnd: c.orderAcceptanceEnd, holidays: c.holidays,
            } : null);
            const blockedItems = group.items
                .map((it) => ({ item: it, status: checkLocationServiceable(constraintsBySubmission[it.submission_id]?.dispatchingLocations, selectedAddress) }))
                .filter((x) => !x.status.serviceable);
            result[sellerId] = { windowStatus, blockedItems, blocked: blockedItems.length > 0 };
        }
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grouped, constraintsBySubmission, selectedAddress?.state, selectedAddress?.city, clockTick]);

    // Only SELECTED lines that can't be delivered block checkout.
    const blockedSelected = !selectedAddress ? [] : selectedItems
        .map((it) => groupStatus[it.seller_id]?.blockedItems.find((b) => b.item.cart_item_id === it.cart_item_id))
        .filter(Boolean);
    const anyBlocked = blockedSelected.length > 0;

    const hasStockBlock = selectedItems.some((it) => {
        const lim = purchaseLimits(it);
        return lim.outOfStock || (lim.capped && Number(it.quantity) > lim.max) || Number(it.quantity) < lim.min;
    });

    // ---- quantity writes (debounced) ----
    useEffect(() => () => { Object.values(pendingWrites.current).forEach(clearTimeout); }, []);

    const handleQty = (it, quantity) => {
        const id = it.submission_id;
        setItems((prev) => prev.map((x) => (x.submission_id === id ? { ...x, quantity } : x)));
        setLine(id, quantity, it.purchase_basis);
        clearTimeout(pendingWrites.current[id]);
        pendingWrites.current[id] = setTimeout(async () => {
            delete pendingWrites.current[id];
            let res = null;
            try { res = await updateCartItem(token, id, { quantity }); } catch { res = null; }
            if (!res?.success) { setError(res?.message || "Couldn't update quantity."); load(); }
        }, 350);
    };

    // Sends any quantity still waiting on the debounce. Returns false if one failed (checkout must stop).
    const flushPendingWrites = async () => {
        const ids = Object.keys(pendingWrites.current);
        ids.forEach((id) => clearTimeout(pendingWrites.current[id]));
        pendingWrites.current = {};
        for (const id of ids) {
            const it = itemsRef.current.find((i) => i.submission_id === id);
            if (!it) continue;
            let res = null;
            try { res = await updateCartItem(token, id, { quantity: it.quantity }); } catch { res = null; }
            if (!res?.success) { setError(res?.message || "Couldn't update quantity."); load(); return false; }
        }
        return true;
    };

    const handleRemove = (id) => {
        clearTimeout(pendingWrites.current[id]); delete pendingWrites.current[id];
        setItems((prev) => prev.filter((it) => it.submission_id !== id));
        setLine(id, 0);
        removeFromCart(token, id).then((res) => {
            if (res && res.success === false) { setError(res.message || "Couldn't remove item."); load(); }
        }).catch(() => load());
    };

    // ---- checkout ----
    const handleCheckout = async () => {
        setError(null);
        if (noSelection) { setError("Select at least one item to check out."); return; }
        if (hasStockBlock) { setError("One or more selected items need a quantity change (stock or minimum order). Please adjust them."); return; }
        if (!selectedAddressId) { setError("Please add a delivery address first."); return; }
        if (anyBlocked) { setError(blockedSelected[0]?.status.message || "One or more selected items aren't deliverable to your address."); return; }

        const checkoutProps = {
            flow: "cart", item_count: selectedCount,
            seller_count: new Set(selectedItems.map((i) => i.seller_id)).size, cart_value: Math.round(grandTotal),
        };
        track("checkout_started", checkoutProps);

        setChecking(true);
        let navigating = false;
        try {
            if (!(await flushPendingWrites())) return;

            const res = await checkoutCart(token, {
                shippingAddressId: selectedAddressId,
                submissionIds: selectedItems.map((it) => it.submission_id),
            });
            if (!res?.success) {
                track("checkout_failed", { stage: "create_order", code: safeCode(res?.code) });
                setError(res?.message || "Couldn't place the order.");
                if (res?.code === "CART_CHANGED") load();
                return;
            }

            // Transport step first; payment starts from "Continue to payment".
            checkoutPropsRef.current = checkoutProps;
            setTransportGroup({ groupId: res.orderGroupId });
        } finally {
            if (!navigating) setChecking(false);
        }
    };

    const payForGroup = async (groupId) => {
        setError(null);
        setChecking(true);
        let navigating = false;
        try {
            const pay = await startGroupPayment(token, groupId);
            if (!pay?.success) {
                track("checkout_failed", { stage: "start_payment", code: safeCode(pay?.code) });
                setError(pay?.message || "Couldn't start the payment. Tap the button again to retry.");
                return;
            }
            track("payment_initiated", checkoutPropsRef.current || {});
            navigating = redirectToGateway(pay.redirectUrl);
            if (!navigating) setError("Couldn't open the payment page. Tap the button again to retry.");
        } finally {
            if (!navigating) setChecking(false);
        }
    };

    const ctaLabel = noSelection ? "Select items to continue" : !selectedAddressId ? "Add delivery address" : "Proceed to pay";
    const ctaDisabled = checking || noSelection || hasStockBlock || anyBlocked;
    const handlePrimary = () => {
        setError(null);
        if (noSelection) return;
        if (!selectedAddressId) { addressBookRef.current?.openChange(); return; }
        handleCheckout();
    };

    const PayButton = ({ className = "" }) => (
        <button type="button" onClick={handlePrimary} disabled={ctaDisabled}
            className={`flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold text-white transition-[opacity,transform] active:scale-[0.985] disabled:opacity-45 ${className}`}
            style={{ background: T.cta }}>
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{ctaLabel}<ArrowRight className="h-4 w-4" strokeWidth={2.6} /></>}
        </button>
    );

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-5xl bg-white px-4 pt-5" aria-busy="true">
                <div className="h-6 w-28 animate-pulse rounded-md" style={{ background: T.hair }} />
                <div className="mt-4 grid gap-3">{[0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-xl" style={{ background: T.hair }} />)}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white" style={{ color: T.ink }}>
            <div className="mx-auto w-full max-w-5xl px-3 pb-36 pt-3 sm:px-4 lg:pb-10">
                {/* Title */}
                <div className="mb-3 flex items-center gap-2">
                    <Link to={EXPLORE_ROUTE} aria-label="Back to shopping" className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-black/5">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-[20px] font-bold leading-tight">My cart</h1>
                    {itemCount > 0 && <span className="text-[13px]" style={{ color: T.muted }}>({itemCount} {plural(itemCount, "item")})</span>}
                </div>

                {itemCount === 0 ? (
                    <div className="flex flex-col items-center gap-2.5 px-6 py-16 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: T.tealBg }}>
                            <ShoppingCart className="h-7 w-7" style={{ color: T.teal }} />
                        </span>
                        <p className="mt-1 text-[17px] font-bold">Your cart is empty</p>
                        <p className="max-w-xs text-[13px]" style={{ color: T.muted }}>Add products from sellers and they will wait for you here.</p>
                        <button type="button" onClick={() => navigate(EXPLORE_ROUTE)} className="mt-2 flex h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-bold text-white" style={{ background: T.cta }}>
                            Explore products <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
                        {/* ---------- LEFT: address + items ---------- */}
                        <div className="flex min-w-0 flex-col gap-3">
                            <section className="rounded-xl border p-3" style={{ borderColor: T.hair }}>
                                <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold">
                                    <MapPin className="h-4 w-4" style={{ color: T.teal }} /> Deliver to
                                </h2>
                                <AddressBook ref={addressBookRef} disabled={checking} />
                            </section>

                            <div className="flex items-center justify-between rounded-xl border pl-3 pr-3" style={{ borderColor: T.hair }}>
                                <div className="flex items-center">
                                    <Check checked={allSelected} indeterminate={selectedCount > 0 && !allSelected} disabled={checking}
                                        label="Select all items" onChange={(on) => setSelectionFor(items.map((i) => i.submission_id), on)} />
                                    <span className="text-[14px] font-semibold">Select all</span>
                                </div>
                                <span className="text-[12.5px] tabular-nums" style={{ color: T.muted }} aria-live="polite">{selectedCount} of {itemCount} selected</span>
                            </div>

                            {Object.entries(grouped).map(([sellerId, g]) => {
                                const gs = groupStatus[sellerId];
                                const ids = g.items.map((it) => it.submission_id);
                                const picked = g.items.filter((it) => !deselected.has(it.submission_id));
                                const sellerAll = picked.length === g.items.length;
                                const sellerTotal = picked.reduce((s, it) => s + pricingById.get(it.submission_id).totalIncl, 0);

                                return (
                                    <section key={sellerId} className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: T.hair }}>
                                        <div className="flex items-center gap-1 border-b px-3" style={{ borderColor: T.hair }}>
                                            <Check checked={sellerAll} indeterminate={picked.length > 0 && !sellerAll} disabled={checking}
                                                label={`Select all items from ${g.seller.seller_name}`} onChange={(on) => setSelectionFor(ids, on)} />
                                            <Store className="h-4 w-4 shrink-0" style={{ color: T.teal }} />
                                            <h2 className="ml-1 min-w-0 flex-1 truncate text-[14px] font-bold">{g.seller.seller_name}</h2>
                                            {picked.length > 0
                                                ? <span className="shrink-0 text-[14px] font-bold tabular-nums">₹{inr(sellerTotal)}</span>
                                                : <span className="shrink-0 text-[12px]" style={{ color: T.soft }}>Not selected</span>}
                                        </div>

                                        <div className="divide-y" style={{ borderColor: T.hair }}>
                                            {g.items.map((it) => (
                                                <CartLine
                                                    key={it.cart_item_id}
                                                    it={it}
                                                    p={pricingById.get(it.submission_id)}
                                                    lim={purchaseLimits(it)}
                                                    isPicked={!deselected.has(it.submission_id)}
                                                    checking={checking}
                                                    blockedHere={!!gs?.blockedItems?.some((b) => b.item.cart_item_id === it.cart_item_id)}
                                                    onToggle={() => toggleItem(it.submission_id)}
                                                    onQty={(v) => handleQty(it, v)}
                                                    onRemove={() => handleRemove(it.submission_id)}
                                                    onBill={() => setViewingItem(it)}
                                                />
                                            ))}
                                        </div>

                                        {(gs?.windowStatus && !gs.windowStatus.open) || gs?.blocked ? (
                                            <div className="flex flex-col gap-2 border-t p-3" style={{ borderColor: T.hair }}>
                                                {gs.windowStatus && !gs.windowStatus.open && <Notice tone="warn" icon={Clock}>{gs.windowStatus.message}</Notice>}
                                                {gs.blocked && (
                                                    <Notice tone="danger" icon={MapPin} title="Can't include this seller's items right now">
                                                        {gs.blockedItems.length === 1 ? gs.blockedItems[0].status.message : `${gs.blockedItems.length} items from this seller aren't deliverable to your selected address.`}
                                                        {" "}Uncheck or remove them to continue.
                                                    </Notice>
                                                )}
                                            </div>
                                        ) : null}
                                    </section>
                                );
                            })}

                            <button type="button" disabled={checking} onClick={() => navigate(EXPLORE_ROUTE)}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border bg-white text-[13.5px] font-semibold disabled:opacity-60" style={{ borderColor: T.hair }}>
                                <Compass className="h-4 w-4" /> Explore more products
                            </button>
                        </div>

                        {/* ---------- RIGHT: bill (sticky on desktop) ---------- */}
                        <aside className="mt-3 lg:sticky lg:top-4 lg:mt-0">
                            <section className="rounded-xl border bg-white p-4" style={{ borderColor: T.hair }}>
                                <h2 className="mb-3 text-[14px] font-bold">Bill summary</h2>
                                {noSelection ? (
                                    <p className="text-[13px]" style={{ color: T.muted }}>Select items to see your bill.</p>
                                ) : (
                                    <>
                                        <PriceBill bill={selectedBill} qtyText={`${selectedCount} ${plural(selectedCount, "item")}`} />
                                        <p className="mt-2 text-[11.5px]" style={{ color: T.soft }}>
                                            Prices include GST. Freight, if extra, is arranged with each seller.
                                        </p>
                                    </>
                                )}
                                {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
                                <PayButton className="mt-4 hidden w-full lg:flex" />
                            </section>
                        </aside>
                    </div>
                )}
            </div>

            {/* Mobile sticky checkout bar */}
            {itemCount > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-3 pt-2.5 lg:hidden"
                    style={{ borderColor: T.hair, paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
                    {error && <div className="mb-2"><Notice tone="danger">{error}</Notice></div>}
                    <div className="flex items-center gap-3">
                        <div className="min-w-0">
                            <p className="text-[11.5px]" style={{ color: T.muted }}>Total · {selectedCount} of {itemCount}</p>
                            <p className="text-[20px] font-bold leading-tight tabular-nums">₹{inr(grandTotal)}</p>
                        </div>
                        <PayButton className="min-w-0 flex-1" />
                    </div>
                </div>
            )}

            {transportGroup && (
                <TransportAgreementModal
                    groupId={transportGroup.groupId}
                    busy={checking}
                    error={error}
                    onContinue={() => payForGroup(transportGroup.groupId)}
                    onBack={() => setTransportGroup(null)}
                    backLabel="Back to cart"
                />
            )}

            {viewingItem && <CartItemDetailModal item={viewingItem} onClose={() => setViewingItem(null)} />}
        </div>
    );
}

export default function SaveCartPage() {
    return (
        <BuyerAddressProvider>
            <CartPageInner />
        </BuyerAddressProvider>
    );
}