// components/BuyNowModal.jsx — RESTYLED
//
// Visual + information-architecture pass to match the seller listing
// form language (FormPrimitives: C tokens, uppercase caption Labels,
// rounded-2xl SectionCards, tabular-nums, compact chip toggles) instead
// of the previous ad-hoc styling. The quote block is rebuilt as a clear
// step-down breakdown — Subtotal → Discount → Payable → Delivery —
// instead of everything competing for attention in one dense strip.
//
// NEW: delivery estimate uses the same simplified distance/speed model as
// the backend (see orders.controller.js) — distance in km / 15 km/h ->
// day range, shown as a single date or a "23 Aug - 25 Aug" range. This
// client-side version is just an instant, rough preview (it can't call
// the server's road-distance lookup), and gets replaced a moment later
// by the authoritative server quote from fetchOrderQuote.
//
// UI REPOSITIONING PASS (this revision):
// - "Buy on credit" is no longer a top-tab alongside Standard/Sample.
//   Clicking it now places the credit order immediately (no separate
//   mode toggle step needed) — it lives as its own action button in the
//   sticky footer, directly above "Place order".
// - When credit isn't enabled for this buyer/seller pair yet, that same
//   footer slot instead shows "Request credit from this seller" (or the
//   pending/cooldown notice), replacing the old mid-form placement.
//   Functionally this is still the same once-only-until-cooldown request
//   flow as before — only where it's drawn has changed.
import { useEffect, useState, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import PaymentQRModal from "./PaymentQRModal.jsx";
import {
    Loader2, Lock, CheckCircle2, X, Plus, MapPin, ShieldCheck, IndianRupee,
    Minus, Layers, FileText, Calendar, Beaker, Package, Truck, ReceiptText,
    CreditCard, Boxes,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchCheckoutStatus, fetchOrderQuote, fetchBuyerAddresses, createBuyerAddress, placeOrder, fetchCreditStatus, requestCredit as requestCreditApi } from "../utils/api.js";
import { getOrCreateDirectConversation } from "../utils/chatApi.js";
import { saveOrderFormSession, loadOrderFormSession, clearOrderFormSession } from "../utils/orderFormSession.js";
import { clearPaymentSession } from "../utils/paymentSession.js";
import { C, EASE, Label, TextField, ChipToggleGroup, SectionCard } from "./seller/listingForm/FormPrimitives.jsx";

const EMPTY_ADDRESS = { label: "Office", contact_name: "", contact_phone: "", address_line1: "", address_line2: "", city: "", state: "", pincode: "" };

const BASIS_OPTIONS = [
    { value: "per_pack", label: "Packs" },
    { value: "per_master_pack", label: "Master packs" },
];
// B2B buyers essentially never transact in single units — the "Units"
// pill is dropped from what's shown, but per_unit stays fully wired up
// underneath (toBaseUnits, defaultBasis, computeLocalQuote all still
// handle it) since it's still used as the implicit basis whenever a
// listing has no meaningful packSize.
const VISIBLE_BASIS_OPTIONS = BASIS_OPTIONS;

// VISIBLE_BASIS_OPTIONS is now computed per-seller instead of a fixed
// constant — the Master Pack option only makes sense (and is only ever
// shown) when the listing actually has one (masterPackSize > 1).
function getVisibleBasisOptions(seller) {
    const hasMasterPack = Number(seller?.masterPackSize) > 1;
    return hasMasterPack ? BASIS_OPTIONS : BASIS_OPTIONS.filter((o) => o.value !== "per_master_pack");
}

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
function inr(n) {
    const val = Number(n) || 0;
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function resolveDiscountPercent(quantityDiscounts, quantity) {
    if (!Array.isArray(quantityDiscounts) || !quantityDiscounts.length) return { percent: 0, tier: null };
    const applicable = quantityDiscounts
        .filter((d) => Number(d.minQty) > 0 && quantity >= Number(d.minQty))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    if (!applicable.length) return { percent: 0, tier: null };
    return { percent: Number(applicable[0].discountPercent) || 0, tier: applicable[0] };
}

// toBaseUnits is still needed for stock/pricing (those stay in base
// units), but purchase basis is now only ever "per_pack" / "per_master_pack".
function toBaseUnits(seller, quantity, basis) {
    const packSize = Number(seller.packSize) > 0 ? Number(seller.packSize) : 1;
    const masterPackSize = Number(seller.masterPackSize) > 0 ? Number(seller.masterPackSize) : 1;
    if (basis === "per_master_pack") return quantity * packSize * masterPackSize;
    return quantity * packSize; // per_pack (default/only remaining option)
}

// Minimum quantity (in the currently selected basis) needed to meet MOQ.
// MOQ is now directly a pack count — no more base-unit conversion needed.
// (Master-pack quantities still get converted UP to packs to compare.)
function computeMinQuantity(seller, basis) {
    const moqPacks = Number(seller?.moq) || 0;
    if (!moqPacks) return 1;
    const masterPackSize = Number(seller?.masterPackSize) > 0 ? Number(seller.masterPackSize) : 1;
    if (basis === "per_master_pack") return Math.max(1, Math.ceil(moqPacks / masterPackSize));
    return Math.max(1, moqPacks); // per_pack
}

const visibleBasisOptions = useMemo(() => getVisibleBasisOptions(seller), [seller?.masterPackSize]);

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDDMon(date) {
    return `${String(date.getDate()).padStart(2, "0")} ${MONTH_SHORT[date.getMonth()]}`;
}
function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// NOTE: there used to be a client-side rough delivery-date guess here
// (estimateDeliveryLocal, using a pincode/state-matched km guess through
// the same distance -> days formula as the backend). It's been removed on
// purpose: the client can't reach the server's real road-distance data, so
// that guess could be meaningfully wrong (see the 400001->360003 case,
// where haversine-based guesses undershot actual road distance). Rather
// than show a number that might be off and then silently swap it for a
// different one a moment later, the UI now shows nothing but a loading
// skeleton for the delivery estimate until the authoritative server quote
// (fetchOrderQuote) lands — see the "Estimated delivery" block in the JSX
// below, gated on `quote.isEstimate`.

// Server-confirmed quotes (from fetchOrderQuote) and the local instant
// estimate (computeLocalQuote) don't necessarily share the exact same
// field shape — the server may not send back grossSubtotal/discountAmount
// at all. Relying on `quote.grossSubtotal ?? quote.subtotal` at render
// time silently collapses Subtotal down to the already-discounted total
// the moment a server quote lands, which makes the discount row read as
// ₹0 even when a discount genuinely applied. This normalizer guarantees
// grossSubtotal/discountAmount/discountPercent are always present and
// mutually consistent, deriving them from whatever the source did give us.
function normalizeQuote(raw) {
    if (!raw) return raw;

    const baseQuantity = Number(raw.baseQuantity ?? raw.quantity) || 0;
    const subtotal = Number(raw.subtotal) || 0;
    const discountPercent = Number(raw.discountPercent) || 0;

    // Prefer the pre-discount per-unit rate if the source gave us one
    // (basePriceApplied = slab price before the quantity-discount %).
    // Otherwise reconstruct it from unitPrice + discountPercent, and as a
    // last resort fall back to unitPrice itself (i.e. assume no discount).
    let basePriceApplied = raw.basePriceApplied != null ? Number(raw.basePriceApplied) : null;
    if (basePriceApplied == null) {
        const unitPrice = Number(raw.unitPrice) || 0;
        basePriceApplied = discountPercent > 0 ? round2(unitPrice / (1 - discountPercent / 100)) : unitPrice;
    }

    let grossSubtotal = raw.grossSubtotal != null ? Number(raw.grossSubtotal) : round2(basePriceApplied * baseQuantity);
    // Never let the reconstructed gross fall below the actual payable total
    // — guards against any rounding edge case making "discount" negative.
    if (grossSubtotal < subtotal) grossSubtotal = subtotal;

    const discountAmount = raw.discountAmount != null ? Number(raw.discountAmount) : round2(grossSubtotal - subtotal);

    return { ...raw, baseQuantity, grossSubtotal, discountAmount, discountPercent };
}

// Instant, client-side price computation. Quantity is in `basis` units and
// gets converted to base units before slab/discount resolution — same
// contract as the server. Sample mode short-circuits to sample pricing
// (free unless the seller set a sample_price) and skips MOQ/discounts.
function computeLocalQuote(seller, quantity, basis, isSample, buyerPincode, buyerState) {
    const qty = Number(quantity);
    if (!seller || !(qty > 0)) return null;

    const baseQty = toBaseUnits(seller, qty, basis);
    // Deliberately no local delivery-date guess — see note above. The
    // "Estimated delivery" UI block shows a loading skeleton for as long
    // as estimatedDeliveryDate is null and isEstimate is true.

    if (isSample) {
        const unitPrice = Number(seller.samplePrice) || 0;
        return {
            orderType: "sample",
            quantity: qty, baseQuantity: baseQty, basis,
            unit: seller.unit, unitPrice,
            grossSubtotal: Math.round(unitPrice * baseQty * 100) / 100,
            discountAmount: 0,
            subtotal: Math.round(unitPrice * baseQty * 100) / 100,
            exceedsSampleQuantity: seller.sampleQuantity != null && baseQty > Number(seller.sampleQuantity),
            sampleQuantity: seller.sampleQuantity,
            estimatedDeliveryDate: null,
            isEstimate: true,
        };
    }

    if (!(Number(seller.price) > 0)) return null;

    const masterPackSize = Number(seller.masterPackSize) > 0 ? Number(seller.masterPackSize) : 1;
    const packQtyEquivalent = basis === "per_master_pack" ? qty * masterPackSize : qty;

    const { price: slabPrice, slab: appliedSlab } = resolveSlabUnitPrice(seller.priceSlabs, packQtyEquivalent, Number(seller.price));
    const { percent: discountPercent, tier: discountTier } = resolveDiscountPercent(seller.quantityDiscounts, packQtyEquivalent);
    const unitPrice = Math.round(slabPrice * (1 - discountPercent / 100) * 100) / 100;

    const moq = Number(seller.moq) || 0;
    const availableStock = seller.availableStock != null ? Number(seller.availableStock) : null;
    const stockShortfall = seller.stockType !== "made_to_order" && availableStock != null && packQtyEquivalent > availableStock; // ← was baseQty

    const grossSubtotal = Math.round(slabPrice * packQtyEquivalent * 100) / 100;
    const subtotal = Math.round(unitPrice * packQtyEquivalent * 100) / 100;
    const discountAmount = Math.round((grossSubtotal - subtotal) * 100) / 100;

    return {
        orderType: "standard",
        quantity: qty, baseQuantity: packQtyEquivalent, basis, // baseQuantity now reports pack-equivalent qty
        unit: seller.unit,
        unitPrice,
        basePriceApplied: slabPrice,
        appliedSlab,
        discountPercent,
        discountTier,
        grossSubtotal,
        discountAmount,
        subtotal,
        moq,
        meetsMoq: moq ? packQtyEquivalent >= moq : true,
        availableStock,
        stockShortfall,
        estimatedDeliveryDate: null,
        isEstimate: true,
    };
}

// ---------------------------------------------------------------------
// Small presentational helpers, styled to match FormPrimitives idiom.
// ---------------------------------------------------------------------

function Stepper({ value, onChange, min = 1 }) {
    return (
        <div className="flex items-center gap-2">
            <button type="button" onClick={() => onChange(Math.max(min, Number(value) - 1))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150 hover:bg-black/[0.03]" style={{ borderColor: C.hair }}>
                <Minus className="h-3.5 w-3.5" style={{ color: C.ink }} />
            </button>
            <input type="text" inputMode="decimal" value={value}
                onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
                onBlur={(e) => { if (!(Number(e.target.value) >= min)) onChange(min); }}
                className="w-full rounded-lg border px-3 py-2 text-center text-[15px] font-extrabold tabular-nums tracking-wide focus:outline-none focus:ring-2"
                style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}22` }} />
            <button type="button" onClick={() => onChange(Number(value) + 1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150 hover:bg-black/[0.03]" style={{ borderColor: C.hair }}>
                <Plus className="h-3.5 w-3.5" style={{ color: C.ink }} />
            </button>
        </div>
    );
}

function Notice({ tone = "warn", children }) {
    const tones = {
        warn: { background: "#fef3c7", color: "#a16207" },
        danger: { background: "rgba(199,31,17,0.08)", color: C.danger },
        info: { background: `${C.secondary}0f`, color: C.secondary },
    };
    return (
        <p className="rounded-lg px-2.5 py-2 text-[12px] font-semibold leading-snug tracking-wide" style={tones[tone] || tones.warn}>
            {children}
        </p>
    );
}

// Loading placeholder shown in place of the delivery date while we're
// waiting on the authoritative server quote (see the "no local guess"
// note near computeLocalQuote above).
function SkeletonBar({ width = "70%" }) {
    return <span className="inline-block h-3 animate-pulse rounded" style={{ width, background: C.hairSoft }} />;
}

// One line of the quote breakdown: label on the left, value on the right.
function QuoteRow({ label, value, tone, strong, small }) {
    return (
        <div className="flex items-center justify-between">
            <span className={`font-semibold tracking-wide ${small ? "text-[11.5px]" : "text-[12.5px]"}`} style={{ color: tone || C.muted }}>{label}</span>
            <span className={`tabular-nums font-extrabold tracking-wide ${strong ? "text-[16px]" : "text-[13px]"}`} style={{ color: tone || C.ink }}>{value}</span>
        </div>
    );
}

export default function BuyNowModal({ seller, product, onClose }) {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [access, setAccess] = useState(undefined);
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [showNewAddress, setShowNewAddress] = useState(false);
    const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
    const [awaitingPaymentOrderId, setAwaitingPaymentOrderId] = useState(null);
    // "standard" | "sample" | "credit" — ALWAYS starts as standard, never preselected.
    // NOTE: "credit" is no longer reachable via the top tabs — it's only ever
    // set momentarily via the dedicated "Buy on credit" footer button (see
    // handleSubmit's explicitOrderType param) or when restoring a saved
    // in-progress session.
    const [orderMode, setOrderMode] = useState("standard");
    const isSample = orderMode === "sample";
    const isCredit = orderMode === "credit";

    // Purchase basis + quantity. Reactively defaults to packs when the
    // listing has a meaningful pack size, otherwise falls back to plain
    // units — recomputed via useMemo (not frozen at mount) so a
    // late-arriving `seller.packSize` is still picked up correctly.
    // Always defaults to packs — never units, regardless of packSize.
    const defaultBasis = useMemo(() => "per_pack", [seller?.packSize]);
    const [basis, setBasis] = useState(defaultBasis);
    const minQuantity = useMemo(() => computeMinQuantity(seller, basis), [seller, basis]);
    const [quantity, setQuantity] = useState(() => computeMinQuantity(seller, defaultBasis));
    const userPickedBasis = useRef(false);
    useEffect(() => {
        if (!userPickedBasis.current) setBasis(defaultBasis);
    }, [defaultBasis]);

    // NEW — if a restored/stale basis is "per_master_pack" but this listing
    // has no real master pack, fall back to per_pack so the (now-hidden)
    // option never gets silently stuck as the active basis.
    useEffect(() => {
        if (basis === "per_master_pack" && !(Number(seller?.masterPackSize) > 1)) {
            setBasis("per_pack");
        }
    }, [basis, seller?.masterPackSize]);

    // Whenever the effective minimum changes (basis switched, or seller/MOQ
    // data arrives late), bring quantity up to it if it's currently short.
    // Never applies in sample mode — that has its own fixed-quantity effect.
    useEffect(() => {
        if (isSample) return;
        setQuantity((q) => (Number(q) < minQuantity ? minQuantity : q));
    }, [minQuantity, isSample]);

    const [notes, setNotes] = useState("");

    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
    // Don't pre-seed with a possibly-stale seller/basis — let the instant
    // local-estimate effect below fill this in once seller & basis have
    // settled, so we never briefly show a unit-based quote for a pack item.
    const [quote, setQuote] = useState(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);
    const quoteTimer = useRef(null);
    const requestIdRef = useRef(0);
    const pendingQuoteRef = useRef(Promise.resolve());

    const [creditStatus, setCreditStatus] = useState(null);
    useEffect(() => {
        if (!seller?.offerId || !access?.canCheckout) return;
        fetchCreditStatus(token, { submissionId: seller.offerId }).then((res) => setCreditStatus(res?.credit || null));
    }, [seller?.offerId, access, token]);

    const canBuyOnCredit = creditStatus?.status === "approved";

    // If credit gets revoked mid-session while "credit" is selected, fall back to standard
    useEffect(() => {
        if (isCredit && !canBuyOnCredit) setOrderMode("standard");
    }, [isCredit, canBuyOnCredit]);

    // Effective pincode/state used for delivery estimation — prefers the
    // in-progress new-address form (so estimates update live as the buyer
    // types), falls back to the selected saved address otherwise.
    const effectivePincode = showNewAddress ? newAddress.pincode : selectedAddress?.pincode;
    const effectiveState = showNewAddress ? newAddress.state : selectedAddress?.state;

    // 1) INSTANT local estimate — recomputed on every keystroke / toggle.
    useEffect(() => {
        if (!(Number(quantity) > 0)) { setQuote(null); return; }
        setQuote((prev) => {
            const local = computeLocalQuote(seller, quantity, basis, isSample, effectivePincode, effectiveState);
            return local ? normalizeQuote(local) : prev;
        });
    }, [seller, quantity, basis, isSample, effectivePincode, effectiveState]);

    // Lenis attaches its own wheel/touch listeners at the document level
    // and calls preventDefault on them — so merely calling lenis.stop()
    // (or locking body scroll ourselves) can end up swallowing scroll
    // events everywhere, including inside this modal's own scrollable
    // container, which is what caused foreground scrolling to freeze too.
    // The correct fix is Lenis's own opt-out: stop the background smooth
    // scroll, but let the modal's scroll container be marked with
    // data-lenis-prevent (set directly on the JSX below) so Lenis leaves
    // events inside it alone. We don't touch document.body's own overflow/
    // position here — that was the second thing double-locking scroll.
    useEffect(() => {
        const lenis = window.lenis;
        lenis?.stop?.();
        return () => { lenis?.start?.(); };
    }, []);

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

    // Sample mode is fixed-quantity by design: no field for the buyer to
    // mistype. Quantity locks to exactly what the seller allows
    // (seller.sampleQuantity), and basis resets to per_unit since the
    // sample cap is expressed in base units and the pack/master-pack
    // toggle is hidden in sample mode anyway.
    useEffect(() => {
        if (isSample) {
            const sampleQty = Number(seller?.sampleQuantity) > 0 ? Number(seller.sampleQuantity) : 1;
            setQuantity(sampleQty);
            userPickedBasis.current = false;
            setBasis("per_unit");
        }
    }, [isSample, seller?.sampleQuantity]);

    // 1) INSTANT local estimate — recomputed on every keystroke / toggle.
    useEffect(() => {
        if (!(Number(quantity) > 0)) { setQuote(null); return; }
        setQuote((prev) => {
            const local = computeLocalQuote(seller, quantity, basis, isSample, effectivePincode, effectiveState);
            return local ? normalizeQuote(local) : prev;
        });
    }, [seller, quantity, basis, isSample, effectivePincode, effectiveState]);

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
                    const confirmed = normalizeQuote({ ...res, isEstimate: false });
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

    // Accepts an optional explicit order type ("credit") so the dedicated
    // "Buy on credit" footer button can place the order immediately without
    // first routing through the (now-removed) credit tab / orderMode state.
    // Falls back to the current sample/standard mode when called from the
    // regular "Place order" button, exactly as before.
    const handleSubmit = async (explicitOrderType) => {
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
        const effectiveOrderType = explicitOrderType || (isSample ? "sample" : "standard");

        // Only real, hard-blocking validations remain: MOQ (standard/credit)
        // and sample-quantity ceiling (sample only, kept as a defensive
        // backstop even though the UI no longer lets buyers edit sample
        // quantity). Stock is never a blocker — a shortfall just gets
        // surfaced as a message below and the order still goes through.
        if (finalQuote) {
            if (effectiveOrderType === "sample" && finalQuote.exceedsSampleQuantity) {
                setSubmitting(false);
                return setError(`Sample quantity is capped at ${finalQuote.sampleQuantity} ${finalQuote.unit}.`);
            }
            if (effectiveOrderType !== "sample" && finalQuote.meetsMoq === false) {
                setSubmitting(false);
                return setError(`Minimum order quantity is ${finalQuote.moq} ${finalQuote.unit}.`);
            }
        }

        const res = await placeOrder(token, {
            submissionId: seller.offerId,
            quantity: Number(quantity),
            purchaseBasis: basis,
            orderType: effectiveOrderType,
            shippingAddressId: addressId,
            notes: notes.trim() || undefined,
        });
        setSubmitting(false);
        if (!res?.success) return setError(res?.message || "Couldn't place the order.");

        if (res.orderStatus === "awaiting_payment") {
            // Snapshot everything needed to reconstruct this exact form, keyed to
            // this order. This is what lets the QR modal's close button (and
            // PendingPaymentGate after a reload) bring the buyer back to a fully
            // populated BuyNowModal instead of an empty one.
            saveOrderFormSession({
                orderId: res.orderId,
                seller,
                product,
                quantity,
                basis,
                selectedAddressId,
                showNewAddress,
                newAddress,
                notes,
                orderMode: effectiveOrderType,
            });
            setAwaitingPaymentOrderId(res.orderId);
        } else {
            setDone(res);
        }
    };

    // Restores form fields from a saved snapshot — used both when the buyer
    // hits "close" on the QR screen (this component stays mounted, so this
    // mostly just needs to flip awaitingPaymentOrderId off) and, if this
    // BuyNowModal instance was itself just (re)constructed from a saved
    // session, to hydrate on mount.
    const restoreFromSession = (session) => {
        if (!session) return;
        setQuantity(session.quantity);
        userPickedBasis.current = true;
        setBasis(session.basis);
        setSelectedAddressId(session.selectedAddressId);
        setShowNewAddress(session.showNewAddress);
        setNewAddress(session.newAddress || EMPTY_ADDRESS);
        setNotes(session.notes || "");
        setOrderMode(session.orderMode || "standard");
    };

    // If this BuyNowModal was mounted fresh (no live state yet, e.g. by
    // PendingPaymentGate after a reload) but there's a matching saved
    // session on disk, hydrate from it once on mount.
    useEffect(() => {
        const session = loadOrderFormSession();
        if (session && session.seller?.offerId === seller?.offerId) {
            restoreFromSession(session);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fired when the buyer hits "close" (X) on the QR screen. Unlike
    // handleBackToEdit, this does NOT cancel the order — it's still sitting
    // in awaiting_payment, and the buyer can resume paying later (e.g. from
    // their Orders page, which is what PendingPaymentGate is for). We just
    // bring back the edit form, restored from the snapshot so it's correct
    // even if something in local state had already drifted.
    const handleCloseToEdit = () => {
        const session = loadOrderFormSession(awaitingPaymentOrderId);
        restoreFromSession(session);
        clearPaymentSession();
        clearOrderFormSession();
        setAwaitingPaymentOrderId(null);
    };

    const gateContent = {
        NOT_AUTHENTICATED: { title: "Sign in to place an order", body: "You'll need to sign in to your BBM Marketplace account first.", cta: "Sign in", action: () => navigate("/login") },
        NOT_VERIFIED: { title: "Verify your contact details", body: "We need a verified email or phone so sellers know you're a genuine buyer.", cta: "Verify now", action: () => navigate("/account") },
    }[access?.reason] || { title: "Can't place an order right now", body: "Please try again in a moment.", cta: "Close", action: onClose };

    const [requestingCredit, setRequestingCredit] = useState(false);
    console.log("seller : ", seller);
    const handleRequestCredit = async () => {
        if (!seller?.offerId) { setError("Couldn't reach this seller right now."); return; }
        setRequestingCredit(true);
        const reqRes = await requestCreditApi(token, { submissionId: seller.offerId });
        setRequestingCredit(false);
        if (!reqRes?.success) { setError(reqRes?.message || "Couldn't send the credit request."); return; }
        onClose();
        navigate(`/chat/${reqRes.conversationId}`);
    };

    const handleBackToEdit = async () => {
        if (awaitingPaymentOrderId) {
            // Cancel the order we just created — otherwise resubmitting from
            // the form would leave two orders sitting in awaiting_payment.
            const res = await cancelOrder(token, awaitingPaymentOrderId, "Buyer went back to edit the order before paying");
            if (!res?.success) {
                console.warn("Couldn't cancel the pending order before going back:", res?.message);
            }
        }
        clearPaymentSession();
        setAwaitingPaymentOrderId(null); // form reappears with quantity/address/notes untouched
    };

    const hasTerms = seller && (seller.deliveryTimeline || seller.paymentTerms || seller.returnPolicy || seller.warranty || seller.hsnCode || seller.freightIncluded != null || seller.dispatchOrigin);
    const canSample = seller?.sampleAvailable;
    const basisLabel = basis === "per_pack" ? "pack(s)" : basis === "per_master_pack" ? "master pack(s)" : (seller?.unit || "units");
    // estimatedDeliveryDate can be a single "23 Aug" label OR a range like
    // "23 Aug - 25 Aug" (see the server's estimateDeliveryDate). Only treat
    // it as a raw ISO date string (from the RPC's persisted
    // order.estimated_delivery_date, e.g. "2026-08-23") when it actually
    // looks like one — a naive `.includes("-")` check would misfire on
    // the "23 Aug - 25 Aug" range string.
    const deliveryDateLabel = (val) => (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val) ? formatDDMon(new Date(val)) : val);

    // Drives the credit slot in the sticky footer: which of the three
    // states (request / pending / cooldown) to show when credit isn't
    // enabled yet. Kept as a small helper so both the footer render and
    // any future callers stay in sync on the cooldown math.
    const creditCooldownActive = creditStatus?.status === "rejected" && creditStatus.cooldown_until && new Date(creditStatus.cooldown_until) > new Date();

    return (
        <motion.div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white sm:rounded-[24px]"
                data-lenis-prevent
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}
                onClick={(e) => e.stopPropagation()}>
                {awaitingPaymentOrderId ? (
                    <PaymentQRModal
                        token={token}
                        orderId={awaitingPaymentOrderId}
                        onClose={handleCloseToEdit}
                        onBack={handleBackToEdit}
                        onDoneViewOrders={() => navigate("/orders")}
                    />
                ) : done ? (
                    <div className="flex flex-col items-center px-5 py-8 text-center sm:px-6">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}>
                            <CheckCircle2 className="h-7 w-7" />
                        </span>
                        <h2 className="mt-4 text-[17px] font-extrabold tracking-wide" style={{ color: C.ink }}>{done.orderType === "sample" ? "Sample requested" : done.paymentMethod === "credit" ? "Order placed on credit" : "Order placed"}</h2>
                        <p className="mt-1 font-mono text-[11.5px] font-bold tracking-wide" style={{ color: C.secondary }}>{done.orderNumber}</p>
                        <p className="mt-2 text-[12.5px] font-semibold tracking-wide" style={{ color: C.muted }}>{done.message}</p>
                        {done.estimatedDeliveryDate && (
                            <p className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold tracking-wide" style={{ background: `${C.secondary}0f`, color: C.secondary }}>
                                <Calendar className="h-3.5 w-3.5" /> Est. delivery {deliveryDateLabel(done.estimatedDeliveryDate)}
                            </p>
                        )}
                        {done.stockShortfall && (
                            <div className="mt-3 w-full">
                                <Notice tone="warn">This item is short on stock right now — fulfilment may take a little longer than usual.</Notice>
                            </div>
                        )}
                        <div className="mt-6 flex w-full gap-2">
                            <button onClick={onClose} className="flex-1 rounded-xl border px-5 py-2.5 text-[13px] font-bold tracking-wide" style={{ borderColor: C.hair, color: C.ink }}>Keep browsing</button>
                            <button onClick={() => navigate("/orders")} className="flex-1 rounded-xl px-5 py-2.5 text-[13px] font-bold tracking-wide text-white" style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>View orders</button>
                        </div>
                    </div>
                ) : access === undefined ? (
                    <div className="flex items-center justify-center py-14"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>
                ) : !access.canCheckout ? (
                    <div className="flex flex-col items-center px-5 py-8 text-center sm:px-6">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#047084,#7fb3bd)" }}><Lock className="h-6 w-6" /></span>
                        <h2 className="mt-4 text-[17px] font-extrabold tracking-wide" style={{ color: C.ink }}>{gateContent.title}</h2>
                        <p className="mt-2 text-[12.5px] font-semibold tracking-wide" style={{ color: C.muted }}>{gateContent.body}</p>
                        <button onClick={gateContent.action} className="mt-6 rounded-xl px-5 py-2.5 text-[13px] font-bold tracking-wide text-white" style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>{gateContent.cta}</button>
                    </div>
                ) : (
                    <>
                        {/* ---------------- Header ---------------- */}
                        <div className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6" style={{ borderColor: C.hairSoft }}>
                            <div className="min-w-0">
                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: C.secondary }}>Place order</p>
                                <h2 className="mt-0.5 truncate text-[19px] font-extrabold tracking-wide" style={{ color: C.ink }}>{product?.name}</h2>
                                <p className="truncate text-[12px] font-semibold tracking-wider" style={{ color: C.muted }}>from {seller?.display_name}</p>
                            </div>
                            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-black/[0.04]"><X className="h-4 w-4" style={{ color: C.muted }} /></button>
                        </div>

                        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6 sm:py-4.5">
                            {/* Top tabs: Standard vs Sample only. "Buy on credit" now lives
                                as its own action in the sticky footer below, since picking it
                                places the order immediately rather than just switching mode. */}
                            {canSample && (
                                <div className="flex gap-1 rounded-xl p-1" style={{ background: C.hairSoft }}>
                                    {[
                                        { v: "standard", t: "Standard order" },
                                        { v: "sample", t: "Order a sample", icon: Beaker },
                                    ].map(({ v, t, icon: Icon }) => (
                                        <button key={v} type="button" onClick={() => setOrderMode(v)}
                                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold tracking-wider transition-colors duration-150"
                                            style={orderMode === v
                                                ? { background: v === "sample" ? "#D2462B" : C.secondary, color: "#fff" }
                                                : { color: C.muted }}>
                                            {Icon && <Icon className="h-3.5 w-3.5" />} {t}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {isSample && (
                                <p className="-mt-1 text-[12px] font-semibold tracking-wider" style={{ color: C.muted }}>
                                    {seller.samplePrice ? `Sample price: ₹${inr(seller.samplePrice)}/${seller.unit}` : "This sample is free."}
                                </p>
                            )}

                            {/* ---------------- Quantity ---------------- */}
                            <SectionCard icon={Package} title="Quantity" alwaysOpen>
                                {Number(seller?.packSize) > 0 && (
                                    <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: C.hairSoft }}>
                                        <Boxes className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                                        <p className="text-[11.5px] font-bold tracking-wide" style={{ color: C.ink }}>
                                            1 Pack = {seller.packSize} {seller.unit}
                                            {Number(seller?.masterPackSize) > 1 && ` · 1 Master Pack = ${seller.masterPackSize} Packs`}
                                        </p>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <Label>{isSample ? "Sample quantity" : `Quantity · MOQ ${seller?.moq} Pack${seller?.moq == 1 ? "" : "s"}`}</Label>
                                    {!isSample && (
                                        <ChipToggleGroup dense value={basis} onChange={(v) => { userPickedBasis.current = true; setBasis(v); }} options={visibleBasisOptions} />
                                    )}
                                </div>

                                {isSample ? (
                                    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5" style={{ borderColor: C.hair, background: C.hairSoft }}>
                                        <span className="text-[15px] font-extrabold tabular-nums tracking-wide" style={{ color: C.ink }}>{quantity} {seller?.unit}</span>
                                        <span className="text-[11px] font-bold tracking-wide" style={{ color: C.muted }}>Fixed by seller</span>
                                    </div>
                                ) : (
                                    <>
                                        <Stepper value={quantity} onChange={setQuantity} min={minQuantity} />
                                        <p className="text-[12px] font-semibold tracking-wider" style={{ color: C.muted }}>
                                            {quantity} {basisLabel}{basis !== "per_unit" && quote?.baseQuantity ? ` = ${quote.baseQuantity} ${seller?.unit}` : ""}
                                        </p>
                                        {minQuantity > 1 && (
                                            <p className="text-[11px] font-semibold tracking-wider" style={{ color: C.muted }}>
                                                Minimum {minQuantity} {basisLabel} required to meet the seller's MOQ.
                                            </p>
                                        )}
                                    </>
                                )}

                                {!isSample && quote && quote.meetsMoq === false && <Notice tone="danger">Below the seller's MOQ of {quote.moq} {quote.unit}.</Notice>}
                                {!isSample && quote?.stockShortfall && (
                                    <Notice tone="warn">Only {quote.availableStock} {quote.unit} currently in stock — this order will still be placed, but fulfilment may take a little longer.</Notice>
                                )}

                                {!isSample && Array.isArray(seller?.priceSlabs) && seller.priceSlabs.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        <span className="flex items-center gap-1 text-[12px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.muted }}><Layers className="h-3 w-3" /> Price slabs</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {seller.priceSlabs.map((slab, i) => {
                                                const active = quote?.appliedSlab && Number(quote.appliedSlab.minQty) === Number(slab.minQty);
                                                return (
                                                    <span key={i} className="rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide"
                                                        style={active ? { borderColor: C.secondary, background: `${C.secondary}14`, color: C.secondary } : { borderColor: C.hair, color: C.muted }}>
                                                        {slab.minQty}{slab.maxQty ? `–${slab.maxQty}` : "+"} Pack{Number(slab.maxQty || slab.minQty) === 1 ? "" : "s"}: ₹{inr(slab.price)}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {!isSample && Array.isArray(seller?.quantityDiscounts) && seller.quantityDiscounts.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        <span className="flex items-center gap-1 text-[12px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.muted }}><Layers className="h-3 w-3" /> Quantity discounts</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {seller.quantityDiscounts.map((tier, i) => {
                                                const active = quote?.discountTier && Number(quote.discountTier.minQty) === Number(tier.minQty);
                                                return (
                                                    <span key={i} className="rounded-full border px-2.5 py-1 text-[12px] font-bold tracking-wide"
                                                        style={active ? { borderColor: "#D2462B", background: "rgba(210,70,43,0.1)", color: "#D2462B" } : { borderColor: C.hair, color: C.muted }}>
                                                        {tier.minQty}+ Packs: {tier.discountPercent}% off
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </SectionCard>

                            {/* ---------------- Shipping address ---------------- */}
                            <SectionCard icon={MapPin} title="Shipping address" alwaysOpen>
                                {!showNewAddress && addresses.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        {addresses.map((a) => (
                                            <button key={a.id} type="button" onClick={() => setSelectedAddressId(a.id)}
                                                className="flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors duration-150"
                                                style={{ borderColor: selectedAddressId === a.id ? C.secondary : C.hair, background: selectedAddressId === a.id ? `${C.secondary}08` : "#fff" }}>
                                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-extrabold tracking-wide" style={{ color: C.ink }}>{a.label} — {a.contact_name}</p>
                                                    <p className="text-[12px] font-semibold tracking-wide" style={{ color: C.muted }}>{a.address_line1}, {a.city}, {a.state} - {a.pincode}</p>
                                                </div>
                                            </button>
                                        ))}
                                        <button type="button" onClick={() => setShowNewAddress(true)} className="flex w-fit items-center gap-1.5 text-[12px] font-bold tracking-wide" style={{ color: C.secondary }}>
                                            <Plus className="h-3.5 w-3.5" /> Add a new address
                                        </button>
                                    </div>
                                )}
                                {showNewAddress && (
                                    <div className="flex flex-col gap-2.5">
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <TextField dense label="Contact name" value={newAddress.contact_name} onChange={(v) => setAddrField("contact_name", v)} />
                                            <TextField dense label="Phone" value={newAddress.contact_phone} onChange={(v) => setAddrField("contact_phone", v)} />
                                        </div>
                                        <TextField dense label="Address line 1" value={newAddress.address_line1} onChange={(v) => setAddrField("address_line1", v)} />
                                        <TextField dense label="Address line 2 (optional)" value={newAddress.address_line2} onChange={(v) => setAddrField("address_line2", v)} />
                                        <div className="grid grid-cols-3 gap-2.5">
                                            <TextField dense label="City" value={newAddress.city} onChange={(v) => setAddrField("city", v)} />
                                            <TextField dense label="State" value={newAddress.state} onChange={(v) => setAddrField("state", v)} />
                                            <TextField dense label="Pincode" value={newAddress.pincode} onChange={(v) => setAddrField("pincode", v)} />
                                        </div>
                                        {addresses.length > 0 && (
                                            <button type="button" onClick={() => setShowNewAddress(false)} className="w-fit text-[12px] font-bold tracking-wide" style={{ color: C.muted }}>
                                                Use a saved address instead
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col gap-1">
                                    <Label>Note to seller (optional)</Label>
                                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any special instructions…"
                                        className="w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-[13.5px] font-medium tracking-wide placeholder:text-slate-300 focus:outline-none focus:ring-2"
                                        style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}22` }} />
                                </div>
                            </SectionCard>

                            {/* ---------------- Quote breakdown ---------------- */}
                            <SectionCard icon={ReceiptText} title="Price breakdown" alwaysOpen>
                                {quote ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col gap-2.5 rounded-xl p-3" style={{ background: C.hairSoft }}>
                                            {/* Rate line — just the math reference, kept small/muted so it
                                                doesn't compete with the actual amount rows below it. */}
                                            <p className="text-[11px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                                {quote.baseQuantity ?? quote.quantity} {quote.unit} × ₹{inr(quote.unitPrice)} / {quote.unit}
                                            </p>

                                            <QuoteRow label="Subtotal" value={`₹${inr(quote.grossSubtotal)}`} tone={C.ink} />

                                            {!isSample && quote.discountAmount > 0 ? (
                                                <QuoteRow
                                                    label={`Discount${quote.discountPercent ? ` (${quote.discountPercent}% off)` : ""}`}
                                                    value={`− ₹${inr(quote.discountAmount)}`}
                                                    tone={C.secondary}
                                                />
                                            ) : (
                                                <QuoteRow label="Discount" value="₹0" />
                                            )}

                                            <div className="my-0.5 h-px" style={{ background: C.hair }} />

                                            <QuoteRow strong label={isSample ? "Total payable (sample)" : "Total payable"} value={`₹${inr(quote.subtotal)}`} tone={C.ink} />
                                        </div>

                                        {/* Only ever shows a date once it's come back from the server
                                            (fetchOrderQuote) — no locally-guessed date is ever rendered
                                            here. While waiting, shows a loading skeleton instead. */}
                                        <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: C.hair }}>
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${C.secondary}14`, color: C.secondary }}>
                                                <Truck className="h-3.5 w-3.5" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: C.muted }}>Estimated delivery</p>
                                                {quote.estimatedDeliveryDate ? (
                                                    <p className="flex items-center gap-1 text-[13px] font-extrabold tracking-wide" style={{ color: C.ink }}>
                                                        <Calendar className="h-3 w-3" style={{ color: C.secondary }} /> {deliveryDateLabel(quote.estimatedDeliveryDate)}
                                                    </p>
                                                ) : (
                                                    <p className="mt-1"><SkeletonBar width="120px" /></p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[12.5px] font-semibold tracking-wide" style={{ color: C.muted }}>Enter a quantity to see the total.</p>
                                )}
                            </SectionCard>

                            {/* ---------------- Seller terms ---------------- */}
                            {hasTerms && (
                                <SectionCard icon={FileText} title="Seller terms" defaultOpen={false}>
                                    <div className="flex flex-col gap-2 text-[13px] font-semibold tracking-wide">
                                        {seller.deliveryTimeline && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Delivery</span><span style={{ color: C.ink, fontWeight: 800 }} className="text-right">{seller.deliveryTimeline}</span></div>}
                                        {seller.paymentTerms && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Payment</span><span style={{ color: C.ink, fontWeight: 800 }} className="text-right">{seller.paymentTerms}</span></div>}
                                        {seller.returnPolicy && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Returns</span><span style={{ color: C.ink, fontWeight: 800 }} className="text-right">{seller.returnPolicy}</span></div>}
                                        {seller.warranty && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Warranty</span><span style={{ color: C.ink, fontWeight: 800 }} className="text-right">{seller.warranty}</span></div>}
                                        {/* {seller.hsnCode && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>HSN</span><span style={{ color: C.ink, fontWeight: 800 }} className="text-right">{seller.hsnCode}</span></div>} */}
                                        {seller.dispatchOrigin && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Ships from</span><span style={{ color: C.ink, fontWeight: 800 }} className="text-right">{seller.dispatchOrigin}</span></div>}
                                        {seller.freightIncluded != null && (
                                            <div className="flex justify-between gap-3">
                                                <span style={{ color: C.muted }}>Freight</span>
                                                <span style={{ color: seller.freightIncluded ? C.secondary : C.ink, fontWeight: 800 }} className="text-right">
                                                    {seller.freightIncluded ? "Included in price" : "Extra, paid by buyer"}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </SectionCard>
                            )}

                            <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: C.hair }}>
                                <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: C.secondary }} />
                                <p className="text-[12.5px] font-semibold leading-snug tracking-wide" style={{ color: C.muted }}>Test mode — payment is simulated for now. No real charge will occur.</p>
                            </div>

                            {error && <Notice tone="danger">{error}</Notice>}
                        </div>

                        {/* ---------------- Sticky submit ---------------- */}
                        <div className="sticky bottom-0 z-10 border-t bg-white/95 px-5 py-3.5 backdrop-blur sm:px-6" style={{ borderColor: C.hairSoft }}>
                            {quote && (
                                <div className="mb-2.5 flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>Total payable</span>
                                    <span className="flex items-center text-[17px] font-extrabold tabular-nums" style={{ color: C.ink }}>
                                        <IndianRupee className="h-4 w-4" />{inr(quote.subtotal)}
                                    </span>
                                </div>
                            )}

                            {/* Credit slot — sits just above "Place order". Either a one-tap
                                "Buy on credit" (places the order immediately, no separate
                                payment step) when credit is already approved for this
                                buyer/seller pair, or the request flow when it isn't. Hidden
                                entirely for sample orders. */}
                            {!isSample && (
                                canBuyOnCredit ? (
                                    <button type="button" onClick={() => handleSubmit("credit")} disabled={submitting}
                                        className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border px-5 py-2.5 text-[13px] font-bold tracking-wide disabled:opacity-50"
                                        style={{ borderColor: "#7c3aed40", color: "#7c3aed", background: "#7c3aed08" }}>
                                        <CreditCard className="h-3.5 w-3.5" /> {submitting ? "Placing…" : "Buy on credit"}
                                    </button>
                                ) : creditStatus?.status === "pending" ? (
                                    <div className="mb-2"><Notice tone="info">Your credit request to {seller.display_name} is awaiting their response — check your chat with them.</Notice></div>
                                ) : creditCooldownActive ? (
                                    <div className="mb-2">
                                        <Notice tone="warn">Your last credit request was declined. You can request again after {new Date(creditStatus.cooldown_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.</Notice>
                                    </div>
                                ) : (
                                    <button type="button" onClick={handleRequestCredit} disabled={requestingCredit}
                                        className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[12.5px] font-bold tracking-wide disabled:opacity-60"
                                        style={{ borderColor: "#7c3aed40", color: "#7c3aed", background: "#7c3aed08" }}>
                                        <CreditCard className="h-3.5 w-3.5" /> {requestingCredit ? "Requesting…" : "Request credit from this seller"}
                                    </button>
                                )
                            )}

                            <button onClick={() => handleSubmit()} disabled={submitting}
                                className="flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-[14px] font-bold tracking-wider text-white transition-opacity duration-150 disabled:opacity-50"
                                style={{ background: isSample ? "linear-gradient(135deg, #006F83 0%, #047084 100%)" : "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isSample ? "Request sample" : "Place order")}
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}