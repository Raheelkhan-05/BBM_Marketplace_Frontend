import { useEffect, useState, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, CheckCircle2, X, Plus, MapPin, ShieldCheck, IndianRupee, Minus, Layers, FileText, Calendar, Beaker } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchCheckoutStatus, fetchOrderQuote, fetchBuyerAddresses, createBuyerAddress, placeOrder } from "../utils/api.js";
import { C, EASE } from "./catalog/tokens";

function Field({ label, value, onChange }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
            <input
                value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border-2 px-3 py-2 text-[13.5px] font-semibold focus:outline-none focus:ring-4"
                style={{ borderColor: C.hairSoft, color: C.ink, "--tw-ring-color": `${C.secondary}20` }}
            />
        </div>
    );
}

const EMPTY_ADDRESS = { label: "Office", contact_name: "", contact_phone: "", address_line1: "", address_line2: "", city: "", state: "", pincode: "" };

const BASIS_OPTIONS = [
    { value: "per_unit", label: "Units" },
    { value: "per_pack", label: "Packs" },
    { value: "per_master_pack", label: "Master packs" },
];

// ---- Slab / quantity-discount pricing -------------------------------
// Mirrors the place_order RPC exactly. Discounts/slabs are always resolved
// against the BASE-UNIT quantity, regardless of which basis (unit/pack/
// master pack) the buyer is purchasing in — that's the whole point of
// converting first.
function resolveSlabUnitPrice(priceSlabs, quantity, fallbackPrice) {
    if (!Array.isArray(priceSlabs) || !priceSlabs.length) return { price: fallbackPrice, slab: null };
    const applicable = priceSlabs
        .filter((s) => Number(s.minQty) > 0 && quantity >= Number(s.minQty) && (!s.maxQty || quantity <= Number(s.maxQty)))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    if (!applicable.length) return { price: fallbackPrice, slab: null };
    return { price: Number(applicable[0].price), slab: applicable[0] };
}
function resolveDiscountPercent(quantityDiscounts, quantity) {
    if (!Array.isArray(quantityDiscounts) || !quantityDiscounts.length) return { percent: 0, tier: null };
    const applicable = quantityDiscounts
        .filter((d) => Number(d.minQty) > 0 && quantity >= Number(d.minQty))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    if (!applicable.length) return { percent: 0, tier: null };
    return { percent: Number(applicable[0].discountPercent) || 0, tier: applicable[0] };
}

function toBaseUnits(seller, quantity, basis) {
    const packSize = Number(seller.packSize) > 0 ? Number(seller.packSize) : 1;
    const masterPackSize = Number(seller.masterPackSize) > 0 ? Number(seller.masterPackSize) : 1;
    if (basis === "per_pack") return quantity * packSize;
    if (basis === "per_master_pack") return quantity * packSize * masterPackSize;
    return quantity;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDDMon(date) {
    return `${String(date.getDate()).padStart(2, "0")} ${MONTH_SHORT[date.getMonth()]}`;
}

// Client-side instant estimate — same zone heuristic as the backend
// (same pincode prefix / same state / else), off lead time + a rough
// transit band. Purely for the instant render; the debounced quote call
// and the RPC both recompute this authoritatively.
function estimateDeliveryLocal(seller, buyerPincode, buyerState) {
    const leadDays = seller.stockType === "made_to_order"
        ? Number(seller.productionLeadTimeDays || 0)
        : Number(seller.dispatchTimeDays ?? seller.leadTime ?? 0);
    let transitDays = 6;
    if (seller.dispatchPincode && buyerPincode && seller.dispatchPincode.slice(0, 3) === buyerPincode.slice(0, 3)) transitDays = 1;
    else if (seller.dispatchState && buyerState && seller.dispatchState.toLowerCase() === buyerState.toLowerCase()) transitDays = 3;
    const date = new Date();
    date.setDate(date.getDate() + leadDays + transitDays);
    return formatDDMon(date);
}

// Instant, client-side price computation. Quantity is in `basis` units and
// gets converted to base units before slab/discount resolution — same
// contract as the server. Sample mode short-circuits to sample pricing
// (free unless the seller set a sample_price) and skips MOQ/discounts.
function computeLocalQuote(seller, quantity, basis, isSample, buyerPincode, buyerState) {
    const qty = Number(quantity);
    if (!seller || !(qty > 0)) return null;

    const baseQty = toBaseUnits(seller, qty, basis);
    const deliveryLabel = estimateDeliveryLocal(seller, buyerPincode, buyerState);

    if (isSample) {
        const unitPrice = Number(seller.samplePrice) || 0;
        return {
            orderType: "sample",
            quantity: qty, baseQuantity: baseQty, basis,
            unit: seller.unit, unitPrice,
            subtotal: Math.round(unitPrice * baseQty * 100) / 100,
            exceedsSampleQuantity: seller.sampleQuantity != null && baseQty > Number(seller.sampleQuantity),
            sampleQuantity: seller.sampleQuantity,
            estimatedDeliveryDate: deliveryLabel,
            isEstimate: true,
        };
    }

    if (!(Number(seller.price) > 0)) return null;

    const { price: slabPrice, slab: appliedSlab } = resolveSlabUnitPrice(seller.priceSlabs, baseQty, Number(seller.price));
    const { percent: discountPercent, tier: discountTier } = resolveDiscountPercent(seller.quantityDiscounts, baseQty);
    const unitPrice = Math.round(slabPrice * (1 - discountPercent / 100) * 100) / 100;

    const moq = Number(seller.moq) || 0;
    const availableStock = seller.availableStock != null ? Number(seller.availableStock) : null;
    const stockShortfall = seller.stockType !== "made_to_order" && availableStock != null && baseQty > availableStock;

    return {
        orderType: "standard",
        quantity: qty, baseQuantity: baseQty, basis,
        unit: seller.unit,
        unitPrice,
        basePriceApplied: slabPrice,
        appliedSlab,
        discountPercent,
        discountTier,
        subtotal: Math.round(unitPrice * baseQty * 100) / 100,
        moq,
        meetsMoq: moq ? baseQty >= moq : true,
        availableStock,
        stockShortfall,
        estimatedDeliveryDate: deliveryLabel,
        isEstimate: true,
    };
}

export default function BuyNowModal({ seller, product, onClose }) {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [access, setAccess] = useState(undefined);
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [showNewAddress, setShowNewAddress] = useState(false);
    const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);

    // Purchase basis + quantity. Defaults to packs when the listing has a
    // meaningful pack size, otherwise falls back to plain units.
    const defaultBasis = Number(seller?.packSize) > 1 ? "per_pack" : "per_unit";
    const [basis, setBasis] = useState(defaultBasis);
    const [quantity, setQuantity] = useState(1);

    // Sample vs standard — ALWAYS starts as standard. Never preselected.
    const [isSample, setIsSample] = useState(false);

    const [notes, setNotes] = useState("");

    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
    const [quote, setQuote] = useState(() => computeLocalQuote(seller, 1, defaultBasis, false, null, null));

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);
    const quoteTimer = useRef(null);
    const requestIdRef = useRef(0);
    const pendingQuoteRef = useRef(Promise.resolve());

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await fetchCheckoutStatus(token);
            if (!cancelled) setAccess(res?.success ? res : { canCheckout: false, reason: "NOT_AUTHENTICATED" });
        })();
        return () => { cancelled = true; };
    }, [token]);

    useEffect(() => {
        if (!access?.canCheckout) return;
        let cancelled = false;
        (async () => {
            const res = await fetchBuyerAddresses(token);
            if (cancelled || !res?.success) return;
            setAddresses(res.addresses || []);
            const def = res.addresses?.find((a) => a.is_default) || res.addresses?.[0];
            if (def) setSelectedAddressId(def.id); else setShowNewAddress(true);
        })();
        return () => { cancelled = true; };
    }, [access, token]);

    // Switching into sample mode resets quantity to a sensible default
    // (min of MOQ-in-basis or 1) since the sample quantity ceiling is
    // usually much smaller than a standard order.
    useEffect(() => {
        if (isSample) setQuantity(1);
    }, [isSample]);

    // 1) INSTANT local estimate — recomputed on every keystroke / toggle.
    useEffect(() => {
        if (!(Number(quantity) > 0)) { setQuote(null); return; }
        setQuote((prev) => {
            const local = computeLocalQuote(seller, quantity, basis, isSample, selectedAddress?.pincode, selectedAddress?.state);
            return local || prev;
        });
    }, [seller, quantity, basis, isSample, selectedAddress?.pincode, selectedAddress?.state]);

    // 2) CONFIRM — debounced authoritative quote from the server.
    useEffect(() => {
        if (!seller?.offerId || !(Number(quantity) > 0)) return;
        clearTimeout(quoteTimer.current);
        const myRequestId = ++requestIdRef.current;
        const qtyAtSchedule = quantity;
        const basisAtSchedule = basis;
        const sampleAtSchedule = isSample;
        const addressAtSchedule = selectedAddressId;

        pendingQuoteRef.current = new Promise((resolve) => {
            quoteTimer.current = setTimeout(async () => {
                const res = await fetchOrderQuote(seller.offerId, qtyAtSchedule, {
                    purchaseBasis: basisAtSchedule,
                    orderType: sampleAtSchedule ? "sample" : "standard",
                    addressId: addressAtSchedule || undefined,
                });
                if (myRequestId === requestIdRef.current && res?.success) {
                    const confirmed = { ...res, isEstimate: false };
                    setQuote(confirmed);
                    resolve(confirmed);
                } else {
                    resolve(null);
                }
            }, 300);
        });

        return () => clearTimeout(quoteTimer.current);
    }, [seller?.offerId, quantity, basis, isSample, selectedAddressId]);

    const setAddrField = (key, value) => setNewAddress((a) => ({ ...a, [key]: value }));

    const handleSaveNewAddress = async () => {
        const missing = ["contact_name", "contact_phone", "address_line1", "city", "state", "pincode"].filter((k) => !newAddress[k].trim());
        if (missing.length) { setError("Please fill in the shipping address completely."); return null; }
        setError(null);
        const res = await createBuyerAddress(token, { ...newAddress, is_default: addresses.length === 0 });
        if (!res?.success) { setError(res?.message || "Couldn't save address."); return null; }
        setAddresses((prev) => [res.address, ...prev]);
        setSelectedAddressId(res.address.id);
        setShowNewAddress(false);
        return res.address.id;
    };

    const handleSubmit = async () => {
        setError(null);
        let addressId = selectedAddressId;
        if (showNewAddress || !addressId) {
            addressId = await handleSaveNewAddress();
            if (!addressId) return;
        }
        if (!(Number(quantity) > 0)) return setError("Please enter a valid quantity.");

        setSubmitting(true);

        const confirmed = await pendingQuoteRef.current;
        const finalQuote = confirmed || quote;

        // Only real, hard-blocking validations remain: MOQ (standard only)
        // and sample-quantity ceiling (sample only). Stock is never a
        // blocker — a shortfall just gets surfaced as a message below and
        // the order still goes through.
        if (finalQuote) {
            if (isSample && finalQuote.exceedsSampleQuantity) {
                setSubmitting(false);
                return setError(`Sample quantity is capped at ${finalQuote.sampleQuantity} ${finalQuote.unit}.`);
            }
            if (!isSample && finalQuote.meetsMoq === false) {
                setSubmitting(false);
                return setError(`Minimum order quantity is ${finalQuote.moq} ${finalQuote.unit}.`);
            }
        }

        const res = await placeOrder(token, {
            submissionId: seller.offerId,
            quantity: Number(quantity),
            purchaseBasis: basis,
            orderType: isSample ? "sample" : "standard",
            shippingAddressId: addressId,
            notes: notes.trim() || undefined,
        });
        setSubmitting(false);
        if (!res?.success) return setError(res?.message || "Couldn't place the order.");
        setDone(res);
    };

    const gateContent = {
        NOT_AUTHENTICATED: { title: "Sign in to place an order", body: "You'll need to sign in to your BBM Marketplace account first.", cta: "Sign in", action: () => navigate("/login") },
        NOT_VERIFIED: { title: "Verify your contact details", body: "We need a verified email or phone so sellers know you're a genuine buyer.", cta: "Verify now", action: () => navigate("/account") },
    }[access?.reason] || { title: "Can't place an order right now", body: "Please try again in a moment.", cta: "Close", action: onClose };

    const hasTerms = seller && (seller.deliveryTimeline || seller.paymentTerms || seller.returnPolicy || seller.warranty || seller.hsnCode || seller.freightIncluded != null || seller.dispatchOrigin);
    const canSample = seller?.sampleAvailable;
    const basisLabel = basis === "per_pack" ? "pack(s)" : basis === "per_master_pack" ? "master pack(s)" : (seller?.unit || "units");

    return (
        <motion.div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 sm:rounded-[24px] sm:p-6"
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}
                onClick={(e) => e.stopPropagation()}>
                {done ? (
                    <div className="flex flex-col items-center py-6 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                            <CheckCircle2 className="h-7 w-7" />
                        </span>
                        <h2 className="mt-4 text-[18px] font-extrabold" style={{ color: C.ink }}>{done.orderType === "sample" ? "Sample requested" : "Order placed"}</h2>
                        <p className="mt-1 font-mono text-[11px] font-bold" style={{ color: C.secondary }}>{done.orderNumber}</p>
                        <p className="mt-2 text-[13px] font-medium" style={{ color: C.muted }}>{done.message}</p>
                        {done.estimatedDeliveryDate && (
                            <p className="mt-1.5 flex items-center gap-1 text-[12px] font-bold" style={{ color: C.secondary }}>
                                <Calendar className="h-3.5 w-3.5" /> Estimated delivery: {typeof done.estimatedDeliveryDate === "string" && done.estimatedDeliveryDate.includes("-")
                                    ? formatDDMon(new Date(done.estimatedDeliveryDate)) : done.estimatedDeliveryDate}
                            </p>
                        )}
                        {done.stockShortfall && (
                            <p className="mt-2 rounded-lg px-3 py-2 text-[11.5px] font-semibold" style={{ background: "#fef3c7", color: "#a16207" }}>
                                This item is short on stock right now — fulfilment may take a little longer than usual.
                            </p>
                        )}
                        <div className="mt-6 flex w-full gap-2">
                            <button onClick={onClose} className="flex-1 rounded-xl border px-5 py-2.5 text-[13px] font-bold" style={{ borderColor: C.hair, color: C.ink }}>Keep browsing</button>
                            <button onClick={() => navigate("/orders")} className="flex-1 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}>View orders</button>
                        </div>
                    </div>
                ) : access === undefined ? (
                    <div className="flex items-center justify-center py-14"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>
                ) : !access.canCheckout ? (
                    <div className="flex flex-col items-center py-4 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}><Lock className="h-6 w-6" /></span>
                        <h2 className="mt-4 text-[18px] font-extrabold" style={{ color: C.ink }}>{gateContent.title}</h2>
                        <p className="mt-2 text-[13px] font-medium" style={{ color: C.muted }}>{gateContent.body}</p>
                        <button onClick={gateContent.action} className="mt-6 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}>{gateContent.cta}</button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.secondary }}>Place order</p>
                                <h2 className="mt-0.5 truncate text-[16px] font-extrabold" style={{ color: C.ink }}>{product?.name}</h2>
                                <p className="truncate text-[11.5px] font-semibold" style={{ color: C.muted }}>from {seller?.display_name}</p>
                            </div>
                            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.04]"><X className="h-4 w-4" style={{ color: C.muted }} /></button>
                        </div>

                        {canSample && (
                            <div className="mt-4 flex gap-1 rounded-xl p-1" style={{ background: C.hairSoft }}>
                                {[{ v: false, t: "Standard order" }, { v: true, t: "Order a sample" }].map(({ v, t }) => (
                                    <button key={t} type="button" onClick={() => setIsSample(v)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold transition-colors duration-150"
                                        style={isSample === v ? { background: v ? C.primary : C.secondary, color: "#fff" } : { color: C.muted }}>
                                        {v && <Beaker className="h-3.5 w-3.5" />} {t}
                                    </button>
                                ))}
                            </div>
                        )}
                        {isSample && (
                            <p className="mt-1.5 text-[11px] font-medium" style={{ color: C.muted }}>
                                {seller.samplePrice ? `Sample price: ₹${seller.samplePrice}/${seller.unit}` : "This sample is free."}
                                {seller.sampleQuantity ? ` · Up to ${seller.sampleQuantity} ${seller.unit}` : ""}
                            </p>
                        )}

                        <div className="mt-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                                    Quantity {!isSample && `· MOQ ${seller?.moq} ${seller?.unit}`}
                                </label>
                                {!isSample && (
                                    <div className="flex gap-1 rounded-lg p-0.5" style={{ background: C.hairSoft }}>
                                        {BASIS_OPTIONS.map((o) => (
                                            <button key={o.value} type="button" onClick={() => setBasis(o.value)}
                                                className="rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors duration-150"
                                                style={basis === o.value ? { background: C.secondary, color: "#fff" } : { color: C.muted }}>
                                                {o.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                                <button onClick={() => setQuantity((q) => Math.max(1, Number(q) - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: C.hairSoft }}><Minus className="h-3.5 w-3.5" /></button>
                                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ""))}
                                    className="w-full rounded-lg border-2 px-3 py-2 text-center text-[14px] font-bold focus:outline-none" style={{ borderColor: C.hairSoft, color: C.ink }} />
                                <button onClick={() => setQuantity((q) => Number(q) + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: C.hairSoft }}><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                            <p className="mt-1 text-[10.5px] font-semibold" style={{ color: C.muted }}>
                                {quantity} {basisLabel}{basis !== "per_unit" && quote?.baseQuantity ? ` = ${quote.baseQuantity} ${seller?.unit}` : ""}
                            </p>

                            {!isSample && quote && quote.meetsMoq === false && <p className="mt-1 text-[11px] font-semibold" style={{ color: C.primary }}>Below the seller's MOQ of {quote.moq} {quote.unit}.</p>}
                            {isSample && quote?.exceedsSampleQuantity && <p className="mt-1 text-[11px] font-semibold" style={{ color: C.primary }}>Sample is capped at {quote.sampleQuantity} {quote.unit}.</p>}
                            {!isSample && quote?.stockShortfall && (
                                <p className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold" style={{ background: "#fef3c7", color: "#a16207" }}>
                                    Only {quote.availableStock} {quote.unit} currently in stock — this order will still be placed, but fulfilment may take a little longer.
                                </p>
                            )}

                            {!isSample && Array.isArray(seller?.priceSlabs) && seller.priceSlabs.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <Layers className="h-3 w-3 shrink-0" style={{ color: C.secondary }} />
                                    {seller.priceSlabs.map((slab, i) => {
                                        const active = quote?.appliedSlab && Number(quote.appliedSlab.minQty) === Number(slab.minQty);
                                        return (
                                            <span key={i} className="rounded-full border px-2 py-0.5 text-[10.5px] font-bold"
                                                style={active
                                                    ? { borderColor: C.secondary, background: `${C.secondary}12`, color: C.secondary }
                                                    : { borderColor: C.hairSoft, color: C.muted }}>
                                                {slab.minQty}{slab.maxQty ? `–${slab.maxQty}` : "+"} {seller.unit}: ₹{slab.price}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {!isSample && Array.isArray(seller?.quantityDiscounts) && seller.quantityDiscounts.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <Layers className="h-3 w-3 shrink-0" style={{ color: C.primary }} />
                                    {seller.quantityDiscounts.map((tier, i) => {
                                        const active = quote?.discountTier && Number(quote.discountTier.minQty) === Number(tier.minQty);
                                        return (
                                            <span key={i} className="rounded-full border px-2 py-0.5 text-[10.5px] font-bold"
                                                style={active
                                                    ? { borderColor: C.primary, background: `${C.primary}12`, color: C.primary }
                                                    : { borderColor: C.hairSoft, color: C.muted }}>
                                                {tier.minQty}+ {seller.unit}: {tier.discountPercent}% off
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                            {!isSample && quote?.discountPercent > 0 && (
                                <p className="mt-1.5 text-[11px] font-bold" style={{ color: C.secondary }}>
                                    {quote.discountPercent}% quantity discount applied (based on {quote.baseQuantity} {seller?.unit})
                                </p>
                            )}
                        </div>

                        <div className="mt-5">
                            <label className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Shipping address</label>
                            {!showNewAddress && addresses.length > 0 && (
                                <div className="mt-1.5 flex flex-col gap-2">
                                    {addresses.map((a) => (
                                        <button key={a.id} onClick={() => setSelectedAddressId(a.id)} className="flex items-start gap-2 rounded-xl border-2 p-2.5 text-left"
                                            style={{ borderColor: selectedAddressId === a.id ? C.secondary : C.hairSoft, background: selectedAddressId === a.id ? `${C.secondary}08` : "#fff" }}>
                                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-bold" style={{ color: C.ink }}>{a.label} — {a.contact_name}</p>
                                                <p className="text-[11px] font-medium" style={{ color: C.muted }}>{a.address_line1}, {a.city}, {a.state} - {a.pincode}</p>
                                            </div>
                                        </button>
                                    ))}
                                    <button onClick={() => setShowNewAddress(true)} className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color: C.secondary }}><Plus className="h-3 w-3" /> Add a new address</button>
                                </div>
                            )}
                            {showNewAddress && (
                                <div className="mt-1.5 flex flex-col gap-2.5 rounded-xl border p-3" style={{ borderColor: C.hairSoft }}>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <Field label="Contact name" value={newAddress.contact_name} onChange={(v) => setAddrField("contact_name", v)} />
                                        <Field label="Phone" value={newAddress.contact_phone} onChange={(v) => setAddrField("contact_phone", v)} />
                                    </div>
                                    <Field label="Address line 1" value={newAddress.address_line1} onChange={(v) => setAddrField("address_line1", v)} />
                                    <Field label="Address line 2 (optional)" value={newAddress.address_line2} onChange={(v) => setAddrField("address_line2", v)} />
                                    <div className="grid grid-cols-3 gap-2.5">
                                        <Field label="City" value={newAddress.city} onChange={(v) => setAddrField("city", v)} />
                                        <Field label="State" value={newAddress.state} onChange={(v) => setAddrField("state", v)} />
                                        <Field label="Pincode" value={newAddress.pincode} onChange={(v) => setAddrField("pincode", v)} />
                                    </div>
                                    {addresses.length > 0 && <button onClick={() => setShowNewAddress(false)} className="text-left text-[11.5px] font-bold" style={{ color: C.muted }}>Use a saved address instead</button>}
                                </div>
                            )}
                        </div>

                        <div className="mt-4">
                            <label className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Note to seller (optional)</label>
                            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any special instructions…"
                                className="mt-1.5 w-full rounded-lg border-2 px-3 py-2 text-[13px] font-medium focus:outline-none" style={{ borderColor: C.hairSoft, color: C.ink }} />
                        </div>

                        <div className="mt-4 rounded-xl p-3" style={{ background: `${C.secondary}08` }}>
                            {quote ? (
                                <>
                                    <div className="flex items-center justify-between text-[12px] font-semibold" style={{ color: C.muted }}>
                                        <span>{quote.baseQuantity ?? quote.quantity} {quote.unit} × ₹{quote.unitPrice}</span><span>₹{quote.subtotal}</span>
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between text-[14px] font-extrabold" style={{ color: C.ink }}>
                                        <span>{isSample ? "You pay (sample)" : "You pay"}</span>
                                        <span className="flex items-center">
                                            <IndianRupee className="h-3.5 w-3.5" />{quote.subtotal}
                                        </span>
                                    </div>
                                    {quote.estimatedDeliveryDate && (
                                        <p className="mt-1.5 flex items-center gap-1 text-[10.5px] font-bold" style={{ color: C.secondary }}>
                                            <Calendar className="h-3 w-3" /> Estimated delivery by {quote.estimatedDeliveryDate}
                                        </p>
                                    )}
                                </>
                            ) : <p className="text-[12px] font-semibold" style={{ color: C.muted }}>Enter a quantity to see the total.</p>}
                        </div>

                        {hasTerms && (
                            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.hairSoft }}>
                                <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                                    <FileText className="h-3 w-3" /> Seller terms
                                </p>
                                <div className="mt-1.5 flex flex-col gap-1 text-[11.5px] font-medium">
                                    {seller.deliveryTimeline && <p><span style={{ color: C.muted }}>Delivery: </span><span style={{ color: C.ink, fontWeight: 700 }}>{seller.deliveryTimeline}</span></p>}
                                    {seller.paymentTerms && <p><span style={{ color: C.muted }}>Payment: </span><span style={{ color: C.ink, fontWeight: 700 }}>{seller.paymentTerms}</span></p>}
                                    {seller.returnPolicy && <p><span style={{ color: C.muted }}>Returns: </span><span style={{ color: C.ink, fontWeight: 700 }}>{seller.returnPolicy}</span></p>}
                                    {seller.warranty && <p><span style={{ color: C.muted }}>Warranty: </span><span style={{ color: C.ink, fontWeight: 700 }}>{seller.warranty}</span></p>}
                                    {seller.hsnCode && <p><span style={{ color: C.muted }}>HSN: </span><span style={{ color: C.ink, fontWeight: 700 }}>{seller.hsnCode}</span></p>}
                                    {seller.dispatchOrigin && <p><span style={{ color: C.muted }}>Ships from: </span><span style={{ color: C.ink, fontWeight: 700 }}>{seller.dispatchOrigin}</span></p>}
                                    {seller.freightIncluded != null && (
                                        <p>
                                            <span style={{ color: C.muted }}>Freight: </span>
                                            <span style={{ color: seller.freightIncluded ? "#059669" : C.ink, fontWeight: 700 }}>
                                                {seller.freightIncluded ? "Included in price" : "Extra, paid by buyer"}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="mt-3 flex items-center gap-2 rounded-xl border p-2.5" style={{ borderColor: C.hairSoft }}>
                            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: C.secondary }} />
                            <p className="text-[10.5px] font-medium leading-snug" style={{ color: C.muted }}>Test mode — payment is simulated for now. No real charge will occur.</p>
                        </div>

                        {error && <p className="mt-3 text-[12px] font-semibold" style={{ color: "#c71f11" }}>{error}</p>}

                        <button onClick={handleSubmit} disabled={submitting}
                            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-[13.5px] font-bold text-white disabled:opacity-50"
                            style={{ background: isSample ? `linear-gradient(135deg, ${C.secondary} 0%, #047084 100%)` : `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}>
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isSample ? "Request sample" : "Place order")}
                        </button>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}