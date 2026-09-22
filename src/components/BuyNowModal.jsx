// components/BuyNowModal.jsx — TWO-PHASE FLOW (UI/UX only, business logic untouched)
//
// ADDRESS HANDLING: the inline address list/"add new" form used to live
// entirely in this file. That's extracted into <AddressBook>
// (components/shipping/AddressBook.jsx) so BuyNowModal and
// TransportPreferenceModal share one implementation, one visual style,
// and one behavior: picking or saving an address in either place marks
// it as the buyer's default address on the server.
//
// `selectedAddressId` below is a DERIVED value (not state) — the
// non-draft id AddressBook last reported via onChange.
//
// PHASES (this revision):
//   "details"  — order mode, quantity, price breakdown (no delivery
//                 estimate), seller terms. Nothing here touches address.
//   "shipping" — shipping address, transport preference, delivery
//                 estimate. The actual placeOrder/addToCart/credit-order
//                 call only ever fires from this phase.
//
// Clicking the primary CTA in "details" just advances to "shipping" —
// it never places an order. The "shipping" phase has its own Back
// button (returns to "details" without discarding anything) and its
// own primary CTA, which is the one that actually submits.

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PaymentQRModal from "./PaymentQRModal.jsx";
import AddressBook from "./shipping/AddressBook.jsx";
import {
    Loader2, Lock, CheckCircle2, X, Plus, MapPin, ShieldCheck, IndianRupee,
    Minus, Layers, FileText, Calendar, Beaker, Package, Truck, ReceiptText,
    CreditCard, Boxes, ShoppingCart, Clock, ChevronDown, ChevronLeft, PackageCheck, AlertCircle
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
    fetchCheckoutStatus, fetchOrderQuote,
    placeOrder, cancelMyOrder, fetchCreditStatus, requestCredit as requestCreditApi,
    requestCreditIncrease as requestCreditIncreaseApi,
} from "../utils/api.js";
import { addToCart } from "../utils/cartApi.js";
import { TRANSPORT_OPTIONS } from "../../shared/transportOptions.js";
import { saveOrderFormSession, loadOrderFormSession, clearOrderFormSession } from "../utils/orderFormSession.js";
import { clearPaymentSession } from "../utils/paymentSession.js";
import { C, EASE, Label, TextField, ChipToggleGroup, SectionCard } from "./seller/listingForm/FormPrimitives.jsx";
import { purchaseQtyToSaleUnitQty, saleUnitQtyToBaseUnits, hasOuterPack, saleUnitLabel, round2 } from "../shared/packUnits.js";
import { checkOrderWindow, checkLocationServiceable } from "../shared/orderConstraints.js";
import { fetchOrderConstraints } from "../utils/api.js";
import TransportPreferenceModal from "./transport/TransportPreferenceModal.jsx";
import { Share2 } from "lucide-react";
import { shareProductLink } from "../utils/share.js";
import { routeTransportModeLabel, getRouteTransportFields } from "../../shared/routeTransportFields.js";
import { fetchBuyerTransportPreference } from "../utils/api.transport.js";

/* ============================================================
   All logic below (constants, pure functions, computeLocalQuote,
   normalizeQuote, etc.) is IDENTICAL to the original file —
   copy verbatim, no changes.
   ============================================================ */

const BASIS_OPTIONS = [
    { value: "per_pack", label: "Packs" },
    { value: "per_master_pack", label: "Master packs" },
];
const VISIBLE_BASIS_OPTIONS = BASIS_OPTIONS;

function getVisibleBasisOptions(seller) {
    const hasMasterPack = Number(seller?.masterPackSize) >= 1;
    return hasMasterPack
        ? BASIS_OPTIONS.filter((o) => o.value === "per_master_pack")
        : BASIS_OPTIONS.filter((o) => o.value === "per_pack");
}

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

function toBaseUnits(seller, quantity, basis) {
    const packSize = Number(seller.packSize) > 0 ? Number(seller.packSize) : 1;
    const masterPackSize = Number(seller.masterPackSize) > 0 ? Number(seller.masterPackSize) : 1;
    if (basis === "per_master_pack") return quantity * packSize * masterPackSize;
    return quantity * packSize;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDDMon(date) {
    return `${String(date.getDate()).padStart(2, "0")} ${MONTH_SHORT[date.getMonth()]}`;
}

function computeMinQuantity(seller, basis) {
    const moqSaleUnits = Number(seller?.moq) || 0;
    if (!moqSaleUnits) return 1;
    const pack = Number(seller?.packSize) > 0 ? Number(seller.packSize) : 1;
    const master = Number(seller?.masterPackSize) > 0 ? Number(seller.masterPackSize) : 1;
    const moqBaseUnits = moqSaleUnits * (hasOuterPack(master) ? pack * master : pack);
    if (basis === "per_master_pack") return Math.max(1, Math.ceil(moqBaseUnits / (pack * master)));
    if (basis === "per_unit") return Math.max(1, Math.ceil(moqBaseUnits));
    return Math.max(1, Math.ceil(moqBaseUnits / pack));
}

function formatMoqForBasis(moqSaleUnits, seller) {
    const label = saleUnitLabel(seller?.masterPackSize);
    const n = Number(moqSaleUnits) || 0;
    return `${n} ${label}${n === 1 ? "" : "s"}`;
}

function computeLocalQuote(seller, quantity, basis, isSample, buyerPincode, buyerState) {
    const qty = Number(quantity);
    if (!seller || !(qty > 0)) return null;

    const saleQty = purchaseQtyToSaleUnitQty(qty, basis, seller.packSize, seller.masterPackSize);
    const pack = Number(seller.packSize) > 0 ? Number(seller.packSize) : 1;
    const master = Number(seller.masterPackSize) > 0 ? Number(seller.masterPackSize) : 1;
    const baseQty = saleQty * (hasOuterPack(master) ? pack * master : pack);

    if (isSample) {
        const unitPrice = Number(seller.samplePrice) || 0;
        return {
            orderType: "sample", quantity: qty, saleUnitQuantity: saleQty, basis,
            unit: seller.unit, unitPrice,
            grossSubtotal: round2(unitPrice * baseQty), discountAmount: 0, subtotal: round2(unitPrice * baseQty),
            exceedsSampleQuantity: seller.sampleQuantity != null && baseQty > Number(seller.sampleQuantity),
            sampleQuantity: seller.sampleQuantity, estimatedDeliveryDate: null, isEstimate: true,
        };
    }
    if (!(Number(seller.price) > 0)) return null;

    const pricePerSaleUnit = Number(seller.price);
    const { price: slabPrice, slab: appliedSlab } = resolveSlabUnitPrice(seller.priceSlabs, saleQty, pricePerSaleUnit);
    const { percent: discountPercent, tier: discountTier } = resolveDiscountPercent(seller.quantityDiscounts, saleQty);
    const unitPrice = round2(slabPrice * (1 - discountPercent / 100));

    const moq = Number(seller.moq) || 0;
    const availableStock = seller.availableStock != null ? Number(seller.availableStock) : null;
    const stockShortfall = seller.stockType !== "made_to_order" && availableStock != null && saleQty > availableStock;
    const outOfStock = seller.stockType !== "made_to_order" && availableStock != null && availableStock <= 0;

    const grossSubtotal = round2(slabPrice * saleQty);
    const subtotal = round2(unitPrice * saleQty);
    const discountAmount = round2(grossSubtotal - subtotal);

    return {
        orderType: "standard", quantity: qty, saleUnitQuantity: saleQty, basis, unit: seller.unit,
        unitPrice, basePriceApplied: slabPrice, appliedSlab, discountPercent, discountTier,
        grossSubtotal, discountAmount, subtotal, moq,
        meetsMoq: moq ? saleQty >= moq : true,
        availableStock, stockShortfall, estimatedDeliveryDate: null, isEstimate: true,
    };
}

function normalizeQuote(raw) {
    if (!raw) return raw;
    const isSample = raw.orderType === "sample";
    const acceptanceFields = {
        acceptingNow: raw.acceptingNow,
        acceptanceMessage: raw.acceptanceMessage,
        acceptanceDelayDays: raw.acceptanceDelayDays || 0,
        acceptanceWindowLabel: raw.acceptanceWindowLabel,
    };

    if (isSample) {
        const subtotal = Number(raw.subtotal) || 0;
        return {
            ...raw, ...acceptanceFields,
            baseUnitQuantity: Number(raw.quantity) || 0,
            grossSubtotal: raw.grossSubtotal != null ? Number(raw.grossSubtotal) : subtotal,
            discountAmount: 0,
            discountPercent: 0,
        };
    }

    const saleUnitQuantity = Number(raw.saleUnitQuantity ?? raw.quantity) || 0;
    const subtotal = Number(raw.subtotal) || 0;
    const discountPercent = Number(raw.discountPercent) || 0;

    let basePriceApplied = raw.basePriceApplied != null ? Number(raw.basePriceApplied) : null;
    if (basePriceApplied == null) {
        const unitPrice = Number(raw.unitPrice) || 0;
        basePriceApplied = discountPercent > 0 ? round2(unitPrice / (1 - discountPercent / 100)) : unitPrice;
    }

    let grossSubtotal = raw.grossSubtotal != null ? Number(raw.grossSubtotal) : round2(basePriceApplied * saleUnitQuantity);
    if (grossSubtotal < subtotal) grossSubtotal = subtotal;

    const discountAmount = raw.discountAmount != null ? Number(raw.discountAmount) : round2(grossSubtotal - subtotal);

    return { ...raw, ...acceptanceFields, saleUnitQuantity, grossSubtotal, discountAmount, discountPercent };
}

/* ============================================================
   REDESIGNED presentational primitives
   ============================================================ */

function Stepper({ value, onChange, min = 1, max }) {
    const atMax = max != null && Number(value) >= Number(max);
    const atMin = Number(value) <= Number(min);
    return (
        <div className="flex items-center overflow-hidden rounded-xl border" style={{ borderColor: C.hair }}>
            <button type="button" disabled={atMin} onClick={() => onChange(Math.max(min, Number(value) - 1))}
                className="flex h-11 w-11 shrink-0 items-center justify-center transition-colors duration-150 hover:bg-black/[0.03] disabled:opacity-30 disabled:hover:bg-transparent">
                <Minus className="h-4 w-4" style={{ color: C.ink }} />
            </button>
            <div className="h-11 w-px" style={{ background: C.hair }} />
            <input
                type="text"
                inputMode="numeric"
                value={value}
                onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
                className="h-11 w-full min-w-0 flex-1 bg-transparent text-center text-[16px] font-extrabold tabular-nums tracking-wide focus:outline-none"
                style={{ color: C.ink }}
            />
            <div className="h-11 w-px" style={{ background: C.hair }} />
            <button type="button" disabled={atMax} onClick={() => onChange(Number(value) + 1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center transition-colors duration-150 hover:bg-black/[0.03] disabled:opacity-30 disabled:hover:bg-transparent">
                <Plus className="h-4 w-4" style={{ color: C.ink }} />
            </button>
        </div>
    );
}

function Notice({ tone = "warn", children }) {
    const tones = {
        warn: { background: "#FEF6E7", color: "#92600A", icon: AlertCircle },
        danger: { background: "#FDECEC", color: "#B3261E", icon: AlertCircle },
        info: { background: `${C.secondary}0f`, color: C.secondary, icon: AlertCircle },
    };
    const t = tones[tone] || tones.warn;
    const Icon = t.icon;
    return (
        <div className="flex items-start gap-2 rounded-xl px-2.5 py-2" style={{ background: t.background }}>
            <Icon className="mt-[1px] h-4 w-4 shrink-0" style={{ color: t.color }} />
            <p className="text-[12.5px] font-semibold leading-snug tracking-wide" style={{ color: t.color }}>{children}</p>
        </div>
    );
}

function ConstraintNotice({ reasons }) {
    const active = reasons.filter(Boolean);
    if (!active.length) return null;
    return (
        <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3" style={{ background: "#FDECEC" }}>
            <AlertCircle className="mt-[1px] h-4 w-4 shrink-0" style={{ color: "#B3261E" }} />
            <div className="min-w-0">
                <p className="text-[12.5px] font-bold" style={{ color: "#B3261E" }}>Can't place an order right now</p>
                <div className="mt-1 flex flex-col gap-0.5">
                    {active.map((r, i) => (
                        <span key={i} className="text-[12px] font-medium leading-snug" style={{ color: "#B3261E" }}>{r.message}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SkeletonBar({ width = "70%" }) {
    return <span className="inline-block h-3.5 animate-pulse rounded" style={{ width, background: C.hairSoft }} />;
}

function QuoteRow({ label, value, tone, strong, small }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className={`font-medium tracking-wide ${small ? "text-[12.5px]" : "text-[13.5px]"}`} style={{ color: tone || C.muted }}>{label}</span>
            <span className={`shrink-0 tabular-nums font-bold tracking-wide ${strong ? "text-[17px]" : "text-[13.5px]"}`} style={{ color: tone || C.ink }}>{value}</span>
        </div>
    );
}

function Panel({ icon: Icon, title, subtitle, children }) {
    return (
        <div className="rounded-2xl border bg-white p-4 sm:p-4.5" style={{ borderColor: C.hairSoft }}>
            <div className="mb-3 flex items-center gap-2">
                {Icon && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${C.secondary}12` }}>
                        <Icon className="h-3.5 w-3.5" style={{ color: C.secondary }} />
                    </span>
                )}
                <div className="min-w-0">
                    <h3 className="text-[14px] font-bold tracking-wide" style={{ color: C.ink }}>{title}</h3>
                    {subtitle && <p className="text-[11.5px] font-medium tracking-wide" style={{ color: C.muted }}>{subtitle}</p>}
                </div>
            </div>
            <div className="flex flex-col gap-3">{children}</div>
        </div>
    );
}

/* ============================================================
   Main component
   ============================================================ */

export default function BuyNowModal({ seller, product, onClose }) {
    const { token } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [access, setAccess] = useState(undefined);

    // ---- Two-phase flow ----
    // "details": quantity + price, no address. "shipping": address +
    // transport + delivery estimate, and the only phase from which an
    // order can actually be placed / added to cart / bought on credit.
    const [phase, setPhase] = useState("details");
    // What the "shipping" phase's primary CTA should actually submit as
    // when pressed — set right before we advance out of "details".
    const [pendingOrderType, setPendingOrderType] = useState(null);

    const goToShipping = (orderType = null) => {
        setError(null);
        setPendingOrderType(orderType);
        setPhase("shipping");
    };
    const goBackToDetails = () => {
        setError(null);
        setPhase("details");
    };

    // ---- Address (see file header note) ----
    // `desiredAddressId` is a HINT passed down to <AddressBook> (e.g. from
    // a restored session, or from a preference just set inside the
    // transport modal). `effectiveAddress` is what AddressBook actually
    // reports back — the source of truth for pincode/city/state used
    // everywhere below.
    const [desiredAddressId, setDesiredAddressId] = useState(null);
    const [effectiveAddress, setEffectiveAddress] = useState(null);
    const addressBookRef = useRef(null);

    const handleAddressChange = (addr) => {
        setEffectiveAddress(addr);
        if (addr && !addr.isDraft) setDesiredAddressId(addr.id);
    };

    // Derived, not state — kept under this name so every existing
    // reference below (quote effect, handleSubmit, session save) works
    // unchanged.
    const selectedAddressId = effectiveAddress && !effectiveAddress.isDraft ? effectiveAddress.id : null;
    const effectivePincode = effectiveAddress?.pincode || "";
    const effectiveState = effectiveAddress?.state || "";
    const effectiveCity = effectiveAddress?.city || "";

    const [awaitingPaymentOrderId, setAwaitingPaymentOrderId] = useState(null);
    const [orderMode, setOrderMode] = useState("standard");
    const isSample = orderMode === "sample";
    const isCredit = orderMode === "credit";

    const defaultBasis = useMemo(
        () => (Number(seller?.masterPackSize) >= 1 ? "per_master_pack" : "per_pack"),
        [seller?.masterPackSize]
    );

    const [basis, setBasis] = useState(defaultBasis);
    const minQuantity = useMemo(() => computeMinQuantity(seller, basis), [seller, basis]);
    const visibleBasisOptions = useMemo(() => getVisibleBasisOptions(seller), [seller?.masterPackSize]);
    const [quantity, setQuantity] = useState(() => computeMinQuantity(seller, defaultBasis));
    const userPickedBasis = useRef(false);
    const belowMoq = !isSample && Number(quantity) < minQuantity;

    const [transportPreference, setTransportPreference] = useState(seller?.transportPreference ?? null);
    const [pendingTransportProposal, setPendingTransportProposal] = useState(seller?.transportPendingProposal ?? null);

    useEffect(() => {
        setTransportPreference(seller?.transportPreference ?? null);
        setPendingTransportProposal(seller?.transportPendingProposal ?? null);
    }, [seller?.transportPreference, seller?.transportPendingProposal]);

    useEffect(() => {
        if (!userPickedBasis.current) setBasis(defaultBasis);
    }, [defaultBasis]);

    useEffect(() => {
        if (basis === "per_master_pack" && !(Number(seller?.masterPackSize) >= 1)) {
            setBasis("per_pack");
        }
    }, [basis, seller?.masterPackSize]);

    useEffect(() => {
        if (basis === "per_pack" && Number(seller?.masterPackSize) >= 1) {
            setBasis("per_master_pack");
        }
    }, [basis, seller?.masterPackSize]);

    useEffect(() => {
        if (isSample) return;
        setQuantity((q) => (Number(q) < minQuantity ? minQuantity : q));
    }, [minQuantity, isSample]);

    const [notes, setNotes] = useState("");
    const [quote, setQuote] = useState(null);

    const maxQuantity = !isSample && seller?.stockType === "ready_stock"
        ? (quote?.availableStock ?? seller?.availableStock ?? null)
        : null;

    const exceedsStock = !isSample && maxQuantity != null && Number(quantity) > Number(maxQuantity);
    const outOfStock = !isSample && (quote?.outOfStock || (maxQuantity != null && Number(maxQuantity) <= 0));

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);
    const quoteTimer = useRef(null);
    const [showTransportModal, setShowTransportModal] = useState(false);
    const [transportRemovedNotice, setTransportRemovedNotice] = useState(null);
    const isFirstQuoteRef = useRef(true);
    const requestIdRef = useRef(0);
    const pendingQuoteRef = useRef(Promise.resolve());
    const standardBasisRef = useRef(defaultBasis);

    useEffect(() => {
        if (!isSample && basis !== "per_unit") {
            standardBasisRef.current = basis;
        }
    }, [isSample, basis]);

    useEffect(() => {
        if (!isSample && basis === "per_unit") {
            const restoredBasis = standardBasisRef.current || defaultBasis;
            setBasis(restoredBasis);
            setQuantity(computeMinQuantity(seller, restoredBasis));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSample]);

    const [creditStatus, setCreditStatus] = useState(null);

    useEffect(() => {
        if (!seller?.offerId || !token) return;
        fetchCreditStatus(token, { submissionId: seller.offerId }).then((res) => setCreditStatus(res?.credit || null));
    }, [seller?.offerId, token]);

    const canBuyOnCredit = creditStatus?.status === "approved";
    const [requestingIncrease, setRequestingIncrease] = useState(false);

    const creditRemaining = creditStatus
        ? Math.max(Number(creditStatus.credit_limit || 0) - Number(creditStatus.credit_used || 0), 0)
        : 0;
    const crossesCreditLimit = canBuyOnCredit && !!quote && Number(quote.subtotal || 0) > creditRemaining;
    const limitIncreasePending = !!creditStatus?.limit_increase_request_message_id;
    const limitIncreaseCooldownActive = !!creditStatus?.limit_increase_cooldown_until
        && new Date(creditStatus.limit_increase_cooldown_until) > new Date();

    const handleRequestCreditIncrease = async () => {
        if (!creditStatus?.id) return;
        setRequestingIncrease(true);
        const res = await requestCreditIncreaseApi(token, creditStatus.id);
        setRequestingIncrease(false);
        if (!res?.success) { setError(res?.message || "Couldn't send the request for a higher limit."); return; }
        setCreditStatus((prev) => (prev ? { ...prev, limit_increase_request_message_id: "pending" } : prev));
    };

    useEffect(() => {
        if (isCredit && !canBuyOnCredit) setOrderMode("standard");
    }, [isCredit, canBuyOnCredit]);

    useEffect(() => {
        if (!(Number(quantity) > 0)) { setQuote(null); return; }
        setQuote((prev) => {
            const local = computeLocalQuote(seller, quantity, basis, isSample, effectivePincode, effectiveState);
            return local ? normalizeQuote(local) : prev;
        });
    }, [seller, quantity, basis, isSample, effectivePincode, effectiveState]);

    useEffect(() => {
        const lenis = window.lenis;
        lenis?.stop?.();
        return () => { lenis?.start?.(); };
    }, []);

    useEffect(() => {
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = original; };
    }, []);

    // Preference was resolved for a specific destination route. If the
    // effective address's city/state changes, that preference no longer
    // applies to the (new) route — clear it so "Set preference" reappears
    // instead of silently keeping a stale pick.
    useEffect(() => {
        if (!transportPreference?.destCity || !transportPreference?.destState) return;
        if (!effectiveCity || !effectiveState) return;
        const sameRoute =
            transportPreference.destCity.trim().toLowerCase() === effectiveCity.trim().toLowerCase() &&
            transportPreference.destState.trim().toLowerCase() === effectiveState.trim().toLowerCase();
        if (!sameRoute) setTransportPreference(null);
    }, [effectiveCity, effectiveState]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await fetchCheckoutStatus(token);
            if (!cancelled) setAccess(res?.success ? res : { canCheckout: false, reason: "NOT_AUTHENTICATED" });
        })();
        return () => { cancelled = true; };
    }, [token]);

    const [constraints, setConstraints] = useState(null);
    useEffect(() => {
        if (!seller?.offerId) return;
        fetchOrderConstraints(seller.offerId).then((res) => { if (res?.success) setConstraints(res); });
    }, [seller?.offerId]);

    const [clockTick, setClockTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setClockTick((t) => t + 1), 30000);
        return () => clearInterval(id);
    }, []);

    const windowStatus = useMemo(
        () => checkOrderWindow(constraints ? {
            workingDays: constraints.workingDays,
            orderAcceptanceStart: constraints.orderAcceptanceStart,
            orderAcceptanceEnd: constraints.orderAcceptanceEnd,
            holidays: constraints.holidays,
        } : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [constraints, clockTick]
    );

    const PINCODE_RE = /^\d{6}$/;

    const locationStatus = useMemo(() => {
        if (!PINCODE_RE.test(effectivePincode || "")) {
            return { serviceable: true };
        }
        return checkLocationServiceable(constraints?.dispatchingLocations, { state: effectiveState, city: effectiveCity });
    }, [constraints, effectivePincode, effectiveState, effectiveCity]);

    const blockedByConstraints = !locationStatus.serviceable;

    useEffect(() => {
        if (isSample) {
            const sampleQty = Number(seller?.sampleQuantity) > 0 ? Number(seller.sampleQuantity) : 1;
            setQuantity(sampleQty);
            userPickedBasis.current = false;
            setBasis("per_unit");
        }
    }, [isSample, seller?.sampleQuantity]);

    // Quote fetch effect
    useEffect(() => {
        if (!seller?.offerId || !(Number(quantity) > 0)) return;
        clearTimeout(quoteTimer.current);
        const myRequestId = ++requestIdRef.current;
        const qtyAtSchedule = quantity;
        const basisAtSchedule = basis;
        const sampleAtSchedule = isSample;
        const addressAtSchedule = selectedAddressId;
        const destPincodeAtSchedule = effectivePincode;
        const destStateAtSchedule = effectiveState;

        const delay = isFirstQuoteRef.current ? 0 : 300;
        isFirstQuoteRef.current = false;

        pendingQuoteRef.current = new Promise((resolve) => {
            quoteTimer.current = setTimeout(async () => {
                const res = await fetchOrderQuote(seller.offerId, qtyAtSchedule, {
                    purchaseBasis: basisAtSchedule,
                    orderType: sampleAtSchedule ? "sample" : "standard",
                    addressId: addressAtSchedule || undefined,
                    destPincode: addressAtSchedule ? undefined : destPincodeAtSchedule,
                    destState: addressAtSchedule ? undefined : destStateAtSchedule,
                    token,
                });
                if (myRequestId === requestIdRef.current && res?.success) {
                    const confirmed = normalizeQuote({ ...res, isEstimate: false });
                    setQuote(confirmed);
                    resolve(confirmed);
                } else {
                    resolve(null);
                }
            }, delay);
        });

        return () => clearTimeout(quoteTimer.current);
    }, [seller?.offerId, quantity, basis, isSample, selectedAddressId, effectivePincode, effectiveState]);

    const lastCheckedRouteRef = useRef(null);

    useEffect(() => {
        if (!effectiveCity || !effectiveState || !seller?.sellerId) return;

        const routeKey = `${effectiveState.trim().toLowerCase()}::${effectiveCity.trim().toLowerCase()}`;
        if (lastCheckedRouteRef.current === routeKey) return;
        lastCheckedRouteRef.current = routeKey;

        const sameAsCurrent =
            transportPreference?.destCity?.trim().toLowerCase() === effectiveCity.trim().toLowerCase() &&
            transportPreference?.destState?.trim().toLowerCase() === effectiveState.trim().toLowerCase();
        if (sameAsCurrent) return;

        let cancelled = false;
        (async () => {
            const res = await fetchBuyerTransportPreference(seller.sellerId, effectiveState, effectiveCity, token);
            if (cancelled) return;

            const pendingProposal = res?.pendingProposal
                ? { ...res.pendingProposal, destCity: effectiveCity, destState: effectiveState }
                : null;
            setPendingTransportProposal(pendingProposal);

            if (res?.rejectedNotice) {
                setTransportPreference(null);
                setTransportRemovedNotice(`Your proposed transport option (${res.rejectedNotice.summary}) wasn't accepted by the seller.`);
                setShowTransportModal(true);
                return;
            }

            if (res?.success && res.decided) {
                setTransportPreference(res.preference ? { ...res.preference, destCity: effectiveCity, destState: effectiveState } : null);
                setTransportRemovedNotice(null);
            } else {
                setTransportPreference(null);
                setTransportRemovedNotice(res?.invalidated ? "The seller no longer offers your previously selected transport option." : null);
                if (!pendingProposal) setShowTransportModal(true);
            }
        })();

        return () => { cancelled = true; };
    }, [effectiveCity, effectiveState, seller?.sellerId, token]); // eslint-disable-line react-hooks/exhaustive-deps

    const initialPreferenceCheckedRef = useRef(false);
    useEffect(() => {
        if (initialPreferenceCheckedRef.current) return;
        if (!seller?.sellerId || !effectiveCity || !effectiveState) return;
        initialPreferenceCheckedRef.current = true;

        (async () => {
            const res = await fetchBuyerTransportPreference(seller.sellerId, effectiveState, effectiveCity, token);
            if (res?.rejectedNotice) {
                setTransportPreference(null);
                setTransportRemovedNotice(`Your proposed transport option (${res.rejectedNotice.summary}) wasn't accepted by the seller.`);
                setShowTransportModal(true);
                return;
            }
            if (res?.invalidated) {
                setTransportPreference(null);
                setTransportRemovedNotice("The seller no longer offers your previously selected transport option.");
                setShowTransportModal(true);
            }
        })();
    }, [seller?.sellerId, effectiveCity, effectiveState, token]);

    const handleSubmit = async (explicitOrderType) => {
        setError(null);
        if (!windowStatus.open) return setError(windowStatus.message);
        if (!locationStatus.serviceable) return setError(locationStatus.message);

        if (!isSample && Number(quantity) < minQuantity) {
            setError(`Minimum order quantity is ${minQuantity} ${moqUnitLabel}${minQuantity === 1 ? "" : "s"}.`);
            return;
        }
        if (!isSample && maxQuantity != null && Number(quantity) > Number(maxQuantity)) {
            setError(Number(maxQuantity) <= 0
                ? "This item is currently out of stock with this seller."
                : `You can order at most ${maxQuantity} ${saleUnitLabel(seller?.masterPackSize)}${Number(maxQuantity) === 1 ? "" : "s"} from this seller.`);
            return;
        }

        let addressId = selectedAddressId;
        if (!addressId) {
            addressId = await addressBookRef.current?.ensureSavedAddress();
            if (!addressId) return;
        }
        if (!(Number(quantity) > 0)) return setError("Please enter a valid quantity.");

        setSubmitting(true);

        const confirmed = await pendingQuoteRef.current;
        const finalQuote = confirmed || quote;
        const effectiveOrderType = explicitOrderType || (isSample ? "sample" : "standard");


        if (finalQuote) {
            if (effectiveOrderType === "sample" && finalQuote.exceedsSampleQuantity) {
                setSubmitting(false);
                return setError(`Sample quantity is capped at ${finalQuote.sampleQuantity} ${finalQuote.unit}.`);
            }
            if (effectiveOrderType !== "sample" && finalQuote.meetsMoq === false) {
                setSubmitting(false);
                return setError(`Minimum order quantity is ${formatMoqForBasis(finalQuote.moq, seller)}.`);
            }
        }

        const res = await placeOrder(token, {
            submissionId: seller.offerId,
            quantity: Number(quantity),
            purchaseBasis: basis,
            orderType: effectiveOrderType,
            shippingAddressId: addressId,
            notes: notes.trim() || undefined,
            transportRouteOptionId: transportPreference?.routeOptionId || undefined,
        });
        setSubmitting(false);
        if (!res?.success) return setError(res?.message || "Couldn't place the order.");

        if (res.orderStatus === "awaiting_payment") {
            saveOrderFormSession({
                orderId: res.orderId,
                seller,
                product,
                quantity,
                basis,
                selectedAddressId: addressId,
                notes,
                orderMode: effectiveOrderType,
            });
            setAwaitingPaymentOrderId(res.orderId);
        } else {
            setDone(res);
        }
    };

    const restoreFromSession = (session) => {
        if (!session) return;
        setQuantity(session.quantity);
        userPickedBasis.current = true;
        setBasis(session.basis);
        setDesiredAddressId(session.selectedAddressId || null);
        setNotes(session.notes || "");
        setOrderMode(session.orderMode || "standard");
        // A restored session implies the buyer had already worked through
        // order details previously — land them back on the shipping step
        // rather than making them redo phase 1.
        setPendingOrderType(session.orderMode === "credit" ? "credit" : null);
        setPhase("shipping");
    };

    useEffect(() => {
        const session = loadOrderFormSession();
        if (session && session.seller?.offerId === seller?.offerId && session.orderId) {
            restoreFromSession(session);
        }
    }, []);

    const handleCloseToEdit = () => {
        const session = loadOrderFormSession(awaitingPaymentOrderId);
        restoreFromSession(session);
        clearPaymentSession();
        clearOrderFormSession();
        setAwaitingPaymentOrderId(null);
    };

    const gateContent = {
        NOT_AUTHENTICATED: {
            title: "Sign in to place an order",
            body: "You'll need to sign in to your BBM Marketplace account first.",
            cta: "Sign in",
            action: () => navigate("/login", { state: { from: location.pathname + location.search } }),
        },
        NOT_VERIFIED: {
            title: "Verify your contact details",
            body: "We need a verified email or phone so sellers know you're a genuine buyer.",
            cta: "Verify now",
            action: () => navigate("/account", { state: { from: location.pathname + location.search } }),
        },
    }[access?.reason] || { title: "Can't place an order right now", body: "Please try again in a moment.", cta: "Close", action: onClose };

    const [requestingCredit, setRequestingCredit] = useState(false);
    const handleRequestCredit = async () => {
        if (!seller?.offerId) { setError("Couldn't reach this seller right now."); return; }
        setRequestingCredit(true);
        const reqRes = await requestCreditApi(token, { submissionId: seller.offerId });
        setRequestingCredit(false);
        if (!reqRes?.success) { setError(reqRes?.message || "Couldn't send the credit request."); return; }
        onClose();
        navigate(`/chat/${reqRes.conversationId}`);
    };

    useEffect(() => {
        if (!pendingTransportProposal?.routeOptionId || !seller?.sellerId || !effectiveCity || !effectiveState) return;

        let cancelled = false;
        (async () => {
            const res = await fetchBuyerTransportPreference(
                seller.sellerId, effectiveState, effectiveCity, token, pendingTransportProposal.routeOptionId
            );
            if (cancelled || !res?.success) return;

            if (res.checkedProposalStatus === "approved") {
                const resolved = {
                    routeOptionId: pendingTransportProposal.routeOptionId,
                    mode: pendingTransportProposal.mode,
                    fields: pendingTransportProposal.fields,
                    summary: pendingTransportProposal.summary,
                    destCity: effectiveCity, destState: effectiveState,
                };
                setTransportPreference(resolved);
                setPendingTransportProposal(null);
                setTransportRemovedNotice(null);
            } else if (res.checkedProposalStatus === "rejected") {
                setPendingTransportProposal(null);
                setTransportPreference(null);
                setTransportRemovedNotice(`Your proposed transport option (${pendingTransportProposal.summary}) wasn't accepted by the seller.`);
                setShowTransportModal(true);
            }
        })();

        return () => { cancelled = true; };
    }, [clockTick, pendingTransportProposal?.routeOptionId, seller?.sellerId, effectiveCity, effectiveState, token]);

    const handleBackToEdit = async () => {
        if (awaitingPaymentOrderId) {
            const res = await cancelMyOrder(token, awaitingPaymentOrderId, "Buyer went back to edit the order before paying");
            if (!res?.success) {
                console.warn("Couldn't cancel the pending order before going back:", res?.message);
            }
        }
        clearPaymentSession();
        setAwaitingPaymentOrderId(null);
    };

    const hasTerms = seller && (seller.deliveryTimeline || seller.paymentTerms || seller.returnPolicy || seller.warranty || seller.hsnCode || seller.freightIncluded != null || seller.dispatchOrigin);
    const canSample = seller?.sampleAvailable;
    const basisLabel = basis === "per_pack" ? "pack(s)" : basis === "per_master_pack" ? "master pack(s)" : (seller?.unit || "units");
    const deliveryDateLabel = (val) => (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val) ? formatDDMon(new Date(val)) : val);
    const moqUnitLabel = basis === "per_master_pack" ? "Master Pack" : "Pack";
    const creditCooldownActive = creditStatus?.status === "rejected" && creditStatus.cooldown_until && new Date(creditStatus.cooldown_until) > new Date();

    // Primary CTA presentation for the "shipping" phase — depends on
    // whether we arrived here intending a sample / credit / standard order.
    const finalCtaLabel = isSample ? "Request sample" : pendingOrderType === "credit" ? "Buy on credit" : "Place order";
    const finalCtaBackground = isSample
        ? "linear-gradient(135deg, #006F83 0%, #047084 100%)"
        : pendingOrderType === "credit"
            ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
            : "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)";
    const finalCtaDisabled = submitting || (!isSample && (belowMoq || outOfStock || exceedsStock));

    const stopScrollPropagation = useCallback((e) => { e.stopPropagation(); }, []);

    return (
        <motion.div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div
                className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[20px]"
                initial={{ y: 24, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 24, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
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
                    <div className="flex flex-col items-center px-6 py-10 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg" style={{ background: "linear-gradient(135deg,#047084,#0B9FB8)" }}>
                            <CheckCircle2 className="h-8 w-8" />
                        </span>
                        <h2 className="mt-5 text-[19px] font-bold tracking-tight" style={{ color: C.ink }}>
                            {done.orderType === "sample" ? "Sample requested" : done.paymentMethod === "credit" ? "Order placed on credit" : "Order placed"}
                        </h2>
                        <p className="mt-1.5 rounded-full bg-slate-50 px-3 py-1 font-mono text-[12px] font-semibold" style={{ color: C.secondary }}>{done.orderNumber}</p>
                        <p className="mt-3 max-w-sm text-[13px] font-medium leading-relaxed" style={{ color: C.muted }}>{done.message}</p>

                        {done.estimatedDeliveryDate && (
                            <p className="mt-3 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold" style={{ background: `${C.secondary}0f`, color: C.secondary }}>
                                <Calendar className="h-3.5 w-3.5" /> Estimated delivery {deliveryDateLabel(done.estimatedDeliveryDate)}
                            </p>
                        )}

                        {done.stockShortfall && (
                            <div className="mt-4 w-full">
                                <Notice tone="warn">This item is short on stock right now — fulfilment may take a little longer than usual.</Notice>
                            </div>
                        )}

                        <div className="mt-7 flex w-full gap-2.5">
                            <button onClick={onClose} className="flex-1 rounded-xl border py-3 text-[13.5px] font-bold" style={{ borderColor: C.hair, color: C.ink }}>Keep browsing</button>
                            <button onClick={() => navigate("/orders")} className="flex-1 rounded-xl py-3 text-[13.5px] font-bold text-white shadow-sm" style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>View orders</button>
                        </div>
                    </div>
                ) : access === undefined ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.muted }} /></div>
                ) : !access.canCheckout ? (
                    <div className="flex flex-col items-center px-6 py-10 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg" style={{ background: "linear-gradient(135deg,#047084,#0B9FB8)" }}>
                            <Lock className="h-6 w-6" />
                        </span>
                        <h2 className="mt-5 text-[18px] font-bold tracking-tight" style={{ color: C.ink }}>{gateContent.title}</h2>
                        <p className="mt-2 max-w-xs text-[13px] font-medium leading-relaxed" style={{ color: C.muted }}>{gateContent.body}</p>
                        <button onClick={gateContent.action} className="mt-6 rounded-xl px-6 py-3 text-[13.5px] font-bold text-white shadow-sm" style={{ background: "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>{gateContent.cta}</button>
                    </div>
                ) : (
                    <>
                        {/* ---------------- Header ---------------- */}
                        <div className="flex shrink-0 flex-col gap-2.5 border-b px-5 py-4 sm:px-6" style={{ borderColor: C.hairSoft }}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold tracking-wider" style={{ color: C.secondary }}>Place order</p>
                                    <h2 className="mt-0.5 truncate text-[18px] font-bold tracking-wide" style={{ color: C.ink }}>{product?.name}</h2>
                                    <p className="truncate text-[12px] font-medium tracking-wide" style={{ color: C.muted }}>from {seller?.display_name}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        onClick={async () => {
                                            const result = await shareProductLink({
                                                submissionId: seller.offerId,
                                                productName: product?.name,
                                                sellerName: seller?.display_name,
                                            });
                                            if (result === "copied") setToastMsg?.("Link copied!");
                                        }}
                                        aria-label="Share this seller's listing"
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-black/[0.05]"
                                    >
                                        <Share2 className="h-4 w-4" style={{ color: C.muted }} />
                                    </button>
                                    <button onClick={onClose} aria-label="Close"
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-black/[0.05]">
                                        <X className="h-4.5 w-4.5" style={{ color: C.muted }} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ---------------- Scrollable body ---------------- */}
                        <div
                            className="flex-1 overflow-y-auto"
                            data-lenis-prevent
                            onWheel={stopScrollPropagation}
                            onTouchStart={stopScrollPropagation}
                            onTouchMove={stopScrollPropagation}
                        >
                            <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">

                                {phase === "details" && (
                                    <>
                                        {canSample && (
                                            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                                                {[
                                                    { v: "standard", t: "Standard order" },
                                                    { v: "sample", t: "Order a sample", icon: Beaker },
                                                ].map(({ v, t, icon: Icon }) => (
                                                    <button key={v} type="button" onClick={() => setOrderMode(v)}
                                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-bold transition-all tracking-wide duration-150"
                                                        style={orderMode === v
                                                            ? { background: "#fff", color: v === "sample" ? "#D2462B" : C.secondary, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                                                            : { color: C.muted }}>
                                                        {Icon && <Icon className="h-3.5 w-3.5" />} {t}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {isSample && (
                                            <p className="-mt-1 px-1 text-[12px] font-medium" style={{ color: C.muted }}>
                                                {seller.samplePrice ? `Sample price: ₹${inr(seller.samplePrice)}/${seller.unit}` : "This sample is free."}
                                            </p>
                                        )}

                                        {/* ---------------- Quantity ---------------- */}
                                        <Panel icon={Package} title="Quantity" subtitle={!isSample ? `MOQ ${minQuantity} ${moqUnitLabel}${minQuantity === 1 ? "" : "s"}` : undefined}>
                                            {!isSample && Number(seller?.packSize) > 0 && (
                                                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                                    <Boxes className="h-3.5 w-3.5 shrink-0" style={{ color: C.secondary }} />
                                                    <p className="text-[12px] font-semibold tracking-wide" style={{ color: C.ink }}>
                                                        1 pack = {seller.packSize} {seller.unit}
                                                        {Number(seller?.masterPackSize) >= 1 && ` · 1 master pack = ${seller.masterPackSize} packs`}
                                                    </p>
                                                </div>
                                            )}

                                            {!isSample && visibleBasisOptions.length > 1 && (
                                                <ChipToggleGroup dense value={basis} onChange={(v) => { userPickedBasis.current = true; setBasis(v); }} options={visibleBasisOptions} />
                                            )}

                                            {isSample ? (
                                                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
                                                    <span className="text-[16px] font-extrabold tabular-nums" style={{ color: C.ink }}>
                                                        {quantity} {seller?.unit}
                                                        {Number(seller?.packSize) > 0 && (
                                                            <span className="ml-1.5 text-[11.5px] font-semibold" style={{ color: C.muted }}>
                                                                (~{round2(Number(quantity) / Number(seller.packSize))} pack{round2(Number(quantity) / Number(seller.packSize)) === 1 ? "" : "s"})
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold" style={{ color: C.muted }}>Fixed by seller</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <Stepper value={quantity} onChange={setQuantity} min={minQuantity} max={maxQuantity} />

                                                    <p className="text-[12.5px] capitalize font-medium leading-snug tracking-wide" style={{ color: C.muted }}>
                                                        {basisLabel}
                                                        {Number(seller?.packSize) > 0 && (
                                                            <span className="block text-[11.5px] tracking-wide" style={{ color: C.muted }}>
                                                                = {toBaseUnits(seller, Number(quantity) || 0, basis)} {seller?.unit}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            )}

                                            {!isSample && quote && quote.meetsMoq === false && (
                                                <Notice tone="danger">Below the seller's MOQ of {formatMoqForBasis(quote.moq, seller)}.</Notice>
                                            )}
                                            {!isSample && outOfStock && (
                                                <Notice tone="danger">This item is currently out of stock with this seller.</Notice>
                                            )}
                                            {!isSample && !outOfStock && exceedsStock && (
                                                <Notice tone="danger">
                                                    You can order at most {maxQuantity} {saleUnitLabel(seller?.masterPackSize)}{Number(maxQuantity) === 1 ? "" : "s"} from this seller. Please reduce the quantity.
                                                </Notice>
                                            )}

                                            {!isSample && Array.isArray(seller?.priceSlabs) && seller.priceSlabs.length > 0 && (
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: C.ink }}>
                                                        <Layers className="h-3.5 w-3.5" style={{ color: C.secondary }} /> Price slabs
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {seller.priceSlabs.map((slab, i) => {
                                                            const active = quote?.appliedSlab && Number(quote.appliedSlab.minQty) === Number(slab.minQty);
                                                            return (
                                                                <span key={i} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                                                                    style={active ? { borderColor: C.secondary, background: `${C.secondary}14`, color: C.secondary } : { borderColor: C.hair, color: C.muted }}>
                                                                    {slab.minQty}{slab.maxQty ? `–${slab.maxQty}` : "+"} pack{Number(slab.maxQty || slab.minQty) === 1 ? "" : "s"}: ₹{inr(slab.price)}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {!isSample && Array.isArray(seller?.quantityDiscounts) && seller.quantityDiscounts.length > 0 && (
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: C.ink }}>
                                                        <Layers className="h-3.5 w-3.5" style={{ color: "#D2462B" }} /> Quantity discounts
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {seller.quantityDiscounts.map((tier, i) => {
                                                            const active = quote?.discountTier && Number(quote.discountTier.minQty) === Number(tier.minQty);
                                                            const tierUnitLabel = Number(seller?.masterPackSize) >= 1 ? "master pack" : "pack";
                                                            return (
                                                                <span key={i} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                                                                    style={active ? { borderColor: "#D2462B", background: "rgba(210,70,43,0.08)", color: "#D2462B" } : { borderColor: C.hair, color: C.muted }}>
                                                                    {tier.minQty}+ {tierUnitLabel}{Number(tier.minQty) === 1 ? "" : "s"}: {tier.discountPercent}% off
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </Panel>

                                        {/* ---------------- Price breakdown (no delivery estimate here) ---------------- */}
                                        <details className="group rounded-2xl border bg-white p-4 sm:p-4.5" style={{ borderColor: C.hairSoft }}>
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                                                <span className="flex items-center gap-2">
                                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${C.secondary}12` }}>
                                                        <ReceiptText className="h-3.5 w-3.5" style={{ color: C.secondary }} />
                                                    </span>
                                                    <span className="text-[14px] font-bold" style={{ color: C.ink }}>Price breakdown</span>
                                                </span>
                                                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" style={{ color: C.muted }} />
                                            </summary>

                                            <div className="mt-3 flex flex-col gap-3 border-t pt-3" style={{ borderColor: C.hairSoft }}>
                                                {quote ? (
                                                    <>
                                                        <div className="flex items-center gap-3 rounded-xl border px-3.5 py-3" style={{ borderColor: C.hair }}>
                                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${C.secondary}12` }}>
                                                                <Boxes className="h-4 w-4" style={{ color: C.secondary }} />
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                {isSample ? (
                                                                    <p className="text-[14px] font-extrabold tabular-nums" style={{ color: C.ink }}>
                                                                        {quote.baseUnitQuantity} {seller?.unit}
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-[14px] font-extrabold tabular-nums tracking-wide" style={{ color: C.ink }}>
                                                                        {quote.saleUnitQuantity} {saleUnitLabel(seller?.masterPackSize)}{quote.saleUnitQuantity === 1 ? "" : "s"}
                                                                        {Number(seller?.packSize) > 0 && (
                                                                            <span className="font-semibold" style={{ color: C.muted }}>
                                                                                {" "}· {saleUnitQtyToBaseUnits(quote.saleUnitQuantity, seller.packSize, seller.masterPackSize)} {seller?.unit}
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                )}
                                                                {!isSample && basis === "per_master_pack" && (
                                                                    <p className="text-[11px] font-medium tracking-wider" style={{ color: C.muted }}>
                                                                        {quantity} master pack{Number(quantity) === 1 ? "" : "s"} selected
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-2.5 rounded-xl bg-slate-50 p-3.5">
                                                            <span className="text-[11.5px] font-bold tracking-wider" style={{ color: C.muted }}>Rate applied</span>

                                                            <div className="flex items-baseline justify-between gap-2 tracking-wide">
                                                                <span className="text-[14px] font-bold" style={{ color: C.ink }}>
                                                                    ₹{inr(quote.basePriceApplied ?? quote.unitPrice)}{" "}
                                                                    <span className="font-medium" style={{ color: C.muted }}>/ {isSample ? seller?.unit : saleUnitLabel(seller?.masterPackSize)}</span>
                                                                </span>
                                                                {!isSample && Number(seller?.packSize) > 0 && (
                                                                    <span className="shrink-0 text-[11px] font-medium tabular-nums" style={{ color: C.muted }}>
                                                                        ≈ ₹{inr((quote.basePriceApplied ?? quote.unitPrice) / saleUnitQtyToBaseUnits(1, seller.packSize, seller.masterPackSize))} / {seller?.unit}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="h-px" style={{ background: C.hair }} />

                                                            <QuoteRow label="Subtotal" value={`₹${inr(quote.grossSubtotal)}`} tone={C.ink} small />
                                                            {!isSample && quote.discountAmount > 0 && (
                                                                <QuoteRow label={`Discount (${quote.discountPercent}% off)`} value={`− ₹${inr(quote.discountAmount)}`} tone={C.secondary} small />
                                                            )}

                                                            <div className="h-px" style={{ background: C.hair }} />

                                                            <div className="flex items-center justify-between tracking-wide">
                                                                <span className="text-[13.5px] font-bold" style={{ color: C.ink }}>
                                                                    {isSample ? "Total payable (sample)" : "Total payable"}
                                                                </span>
                                                                <span className="text-[20px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{inr(quote.subtotal)}</span>
                                                            </div>
                                                        </div>

                                                        {!isSample && quote.acceptanceDelayDays > 0 && (
                                                            <Notice tone="warn">
                                                                {quote.acceptanceMessage || "This seller is currently closed — your order will still be placed, but acceptance is delayed."}
                                                            </Notice>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="text-[12.5px] font-medium" style={{ color: C.muted }}>Enter a quantity to see the total.</p>
                                                )}
                                            </div>
                                        </details>

                                        {/* ---------------- Seller terms (collapsible, quieter) ---------------- */}
                                        {hasTerms && (
                                            <details className="group rounded-2xl border bg-white p-4 sm:p-4.5" style={{ borderColor: C.hairSoft }}>
                                                <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                                                    <span className="flex items-center gap-2">
                                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${C.secondary}12` }}>
                                                            <FileText className="h-3.5 w-3.5" style={{ color: C.secondary }} />
                                                        </span>
                                                        <span className="text-[14px] font-bold" style={{ color: C.ink }}>Seller terms</span>
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" style={{ color: C.muted }} />
                                                </summary>
                                                <div className="mt-3 flex flex-col gap-2 border-t pt-3 text-[13px] font-medium" style={{ borderColor: C.hairSoft }}>
                                                    {seller.deliveryTimeline && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Delivery</span><span style={{ color: C.ink, fontWeight: 700 }} className="text-right">{seller.deliveryTimeline}</span></div>}
                                                    {seller.paymentTerms && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Payment</span><span style={{ color: C.ink, fontWeight: 700 }} className="text-right">{seller.paymentTerms}</span></div>}
                                                    {seller.returnPolicy && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Returns</span><span style={{ color: C.ink, fontWeight: 700 }} className="text-right">{seller.returnPolicy}</span></div>}
                                                    {seller.warranty && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Warranty</span><span style={{ color: C.ink, fontWeight: 700 }} className="text-right">{seller.warranty}</span></div>}
                                                    {seller.dispatchOrigin && <div className="flex justify-between gap-3"><span style={{ color: C.muted }}>Ships from</span><span style={{ color: C.ink, fontWeight: 700 }} className="text-right">{seller.dispatchOrigin}</span></div>}
                                                    {seller.freightIncluded != null && (
                                                        <div className="flex justify-between gap-3">
                                                            <span style={{ color: C.muted }}>Freight</span>
                                                            <span style={{ color: seller.freightIncluded ? C.secondary : C.ink, fontWeight: 700 }} className="text-right">
                                                                {seller.freightIncluded ? "Included in price" : "Extra, paid by buyer"}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </details>
                                        )}
                                    </>
                                )}

                                {phase === "shipping" && (
                                    <>
                                        {/* Quick recap so the price/quantity chosen in phase 1 stays visible */}
                                        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-[13px] font-bold" style={{ color: C.ink }}>
                                                    {isSample
                                                        ? `${quantity} ${seller?.unit} (sample)`
                                                        : `${quote?.saleUnitQuantity ?? quantity} ${saleUnitLabel(seller?.masterPackSize)}${(quote?.saleUnitQuantity ?? quantity) === 1 ? "" : "s"}`}
                                                </p>
                                                <button type="button" onClick={goBackToDetails} className="mt-0.5 text-[11.5px] font-bold tracking-wide underline underline-offset-2" style={{ color: C.secondary }}>
                                                    Edit order details
                                                </button>
                                            </div>
                                            {quote && (
                                                <span className="shrink-0 text-[16px] font-extrabold tabular-nums" style={{ color: C.ink }}>₹{inr(quote.subtotal)}</span>
                                            )}
                                        </div>

                                        {/* ---------------- Shipping address ---------------- */}
                                        <Panel icon={MapPin} title="Shipping address">
                                            <AddressBook
                                                ref={addressBookRef}
                                                token={token}
                                                value={desiredAddressId}
                                                onChange={handleAddressChange}
                                                disabled={submitting}
                                            />

                                            <div className="flex flex-col gap-2 rounded-xl border px-3.5 py-3" style={{ borderColor: C.hairSoft }}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[11px] font-bold tracking-wider" style={{ color: C.muted }}>Preferred transport</p>
                                                    <button type="button" onClick={() => setShowTransportModal(true)} className="shrink-0 text-[12px] font-bold tracking-wide" style={{ color: C.secondary }}>
                                                        {transportPreference || pendingTransportProposal ? "Change" : "Set preference"}
                                                    </button>
                                                </div>

                                                {transportPreference ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        <p className="text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>
                                                            {routeTransportModeLabel(transportPreference.mode)}
                                                        </p>
                                                        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                                                            {getRouteTransportFields(transportPreference.mode).map((f) => {
                                                                const val = transportPreference.fields?.[f.key];
                                                                if (!val) return null;
                                                                const displayLabel = f.label.replace(/\s*\(if any\)\s*/i, "");
                                                                return (
                                                                    <div key={f.key} className="flex items-baseline gap-1.5">
                                                                        <span className="shrink-0 text-[11px] font-semibold tracking-wide" style={{ color: C.muted }}>{displayLabel}:</span>
                                                                        <span className="truncate text-[12.5px] font-bold tracking-wide" style={{ color: C.ink }}>{val}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : pendingTransportProposal ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        <p className="text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>
                                                            {routeTransportModeLabel(pendingTransportProposal.mode)}
                                                        </p>
                                                        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                                                            {getRouteTransportFields(pendingTransportProposal.mode).map((f) => {
                                                                const val = pendingTransportProposal.fields?.[f.key];
                                                                if (!val) return null;
                                                                const displayLabel = f.label.replace(/\s*\(if any\)\s*/i, "");
                                                                return (
                                                                    <div key={f.key} className="flex items-baseline gap-1.5">
                                                                        <span className="shrink-0 text-[11px] font-semibold tracking-wide" style={{ color: C.muted }}>{displayLabel}:</span>
                                                                        <span className="truncate text-[12.5px] font-bold tracking-wide" style={{ color: C.ink }}>{val}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <Notice tone="warn">
                                                            Your proposed transport option is still awaiting the seller's approval. If you place the order now, it'll go through the same as "No preference set" — the seller will choose the transport for now.
                                                        </Notice>
                                                    </div>
                                                ) : (
                                                    <p className="text-[12px] font-medium tracking-wide" style={{ color: C.muted }}>No preference set — the seller will choose for you.</p>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-1 border-t pt-3" style={{ borderColor: C.hairSoft }}>
                                                <Label>Note to seller (optional)</Label>
                                                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any special instructions…"
                                                    className="w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-[13.5px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2"
                                                    style={{ borderColor: C.hair, color: C.ink, ["--tw-ring-color"]: `${C.secondary}22` }} />
                                            </div>
                                        </Panel>

                                        {/* ---------------- Delivery estimate ---------------- */}
                                        {!blockedByConstraints && quote && (
                                            <Panel icon={Truck} title="Delivery estimate">
                                                <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3.5">
                                                    {quote.acceptanceDelayDays > 0 && (
                                                        <QuoteRow small label="Acceptance delay" value={`${quote.acceptanceDelayDays} day${quote.acceptanceDelayDays === 1 ? "" : "s"}`} />
                                                    )}
                                                    {quote.leadDays > 0 && (
                                                        <QuoteRow small label={seller?.stockType === "made_to_order" ? "Production time" : "Dispatch time"} value={`${quote.leadDays} day${quote.leadDays === 1 ? "" : "s"}`} />
                                                    )}
                                                    <QuoteRow
                                                        small
                                                        label="Transit"
                                                        value={quote.transitDaysMin === quote.transitDaysMax
                                                            ? `${quote.transitDaysMin} day${quote.transitDaysMin === 1 ? "" : "s"}`
                                                            : `${quote.transitDaysMin}–${quote.transitDaysMax} days`}
                                                    />

                                                    <div className="h-px" style={{ background: C.hair }} />

                                                    <div className="flex items-center gap-2.5">
                                                        <Truck className="h-4 w-4 shrink-0" style={{ color: C.secondary }} />
                                                        <div className="min-w-0 flex-1">
                                                            <span className="text-[11px] font-bold tracking-wider" style={{ color: C.muted }}>Estimated delivery</span>
                                                            <p className="text-[13.5px] font-bold tracking-wide" style={{ color: C.ink }}>
                                                                {quote.isEstimate || !quote.estimatedDeliveryDate ? <SkeletonBar width="100px" /> : deliveryDateLabel(quote.estimatedDeliveryDate)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Panel>
                                        )}
                                    </>
                                )}

                                {error && <Notice tone="danger">{error}</Notice>}
                            </div>
                        </div>

                        {/* ---------------- Sticky footer ---------------- */}
                        <div className="shrink-0 border-t bg-white px-5 py-4 sm:px-6" style={{ borderColor: C.hairSoft }}>
                            {phase === "shipping" && !locationStatus.serviceable ? (
                                <ConstraintNotice reasons={[{ icon: MapPin, message: locationStatus.message }]} />
                            ) : (
                                <>
                                    {phase === "shipping" && !windowStatus.open && (
                                        <div className="mb-3"><Notice tone="warn">{windowStatus.message}</Notice></div>
                                    )}

                                    {phase === "details" && quote && (
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-[11.5px] font-bold tracking-wider" style={{ color: C.muted }}>Total payable</span>
                                            <span className="flex items-center text-[19px] font-extrabold tabular-nums tracking-wider" style={{ color: C.ink }}>
                                                <IndianRupee className="h-4 w-4" />{inr(quote.subtotal)}
                                            </span>
                                        </div>
                                    )}

                                    {phase === "details" && !isSample && (
                                        canBuyOnCredit ? (
                                            crossesCreditLimit ? (
                                                limitIncreasePending ? (
                                                    <div className="mb-2.5">
                                                        <Notice tone="info">
                                                            You've asked {seller.display_name} for a higher credit limit — waiting for their response.
                                                        </Notice>
                                                    </div>
                                                ) : limitIncreaseCooldownActive ? (
                                                    <div className="mb-2.5">
                                                        <Notice tone="warn">
                                                            This order is above your remaining credit. Your last request was declined — you can ask again
                                                            after {new Date(creditStatus.limit_increase_cooldown_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
                                                        </Notice>
                                                    </div>
                                                ) : (
                                                    <button type="button" onClick={handleRequestCreditIncrease} disabled={requestingIncrease}
                                                        className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border px-5 py-3 text-[13.5px] font-bold disabled:opacity-50"
                                                        style={{ borderColor: "#7c3aed40", color: "#7c3aed", background: "#7c3aed08" }}>
                                                        <CreditCard className="h-3.5 w-3.5" /> {requestingIncrease ? "Requesting…" : "Ask for a higher credit limit"}
                                                    </button>
                                                )
                                            ) : (
                                                <button type="button" onClick={() => goToShipping("credit")} disabled={submitting || belowMoq || outOfStock || exceedsStock}
                                                    className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border px-5 py-3 text-[13.5px] font-bold disabled:opacity-50"
                                                    style={{ borderColor: "#7c3aed40", color: "#7c3aed", background: "#7c3aed08" }}>
                                                    <CreditCard className="h-3.5 w-3.5" /> Buy on credit
                                                </button>
                                            )
                                        ) : creditStatus?.status === "pending" ? (
                                            <div className="mb-2.5"><Notice tone="info">Your credit request to {seller.display_name} is awaiting their response — check your chat with them.</Notice></div>
                                        ) : creditCooldownActive ? (
                                            <div className="mb-2.5">
                                                <Notice tone="warn">Your last credit request was declined. You can request again after {new Date(creditStatus.cooldown_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.</Notice>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={handleRequestCredit} disabled={requestingCredit || belowMoq || outOfStock || exceedsStock}
                                                className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-[12.5px] font-bold disabled:opacity-60"
                                                style={{ borderColor: "#7c3aed40", color: "#7c3aed", background: "#7c3aed08" }}>
                                                <CreditCard className="h-3.5 w-3.5" /> {requestingCredit ? "Requesting…" : "Request credit from this seller"}
                                            </button>
                                        )
                                    )}

                                    {phase === "details" ? (
                                        <div className="flex gap-2.5">
                                            {!isSample && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (quote && quote.meetsMoq === false) {
                                                            setError(`Minimum order quantity is ${formatMoqForBasis(quote.moq, seller)}.`);
                                                            return;
                                                        }
                                                        if (maxQuantity != null && Number(quantity) > Number(maxQuantity)) {
                                                            setError(`You can order at most ${maxQuantity} ${saleUnitLabel(seller?.masterPackSize)}${Number(maxQuantity) === 1 ? "" : "s"} from this seller.`);
                                                            return;
                                                        }
                                                        const confirmed = await pendingQuoteRef.current;
                                                        const finalQuote = confirmed || quote;
                                                        if (finalQuote && finalQuote.meetsMoq === false) {
                                                            setError(`Minimum order quantity is ${formatMoqForBasis(finalQuote.moq, seller)}.`);
                                                            return;
                                                        }
                                                        setSubmitting(true);
                                                        const res = await addToCart(token, { submissionId: seller.offerId, quantity: Number(quantity), purchaseBasis: basis });
                                                        setSubmitting(false);
                                                        if (!res?.success) return setError(res?.message || "Couldn't add to cart.");
                                                        onClose();
                                                        navigate("/cart");
                                                    }}
                                                    disabled={submitting || belowMoq || outOfStock || exceedsStock}
                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-4 py-3.5 text-[13.5px] font-bold disabled:opacity-50"
                                                    style={{ borderColor: C.hair, color: C.ink }}
                                                >
                                                    <ShoppingCart className="h-4 w-4" /> Add to cart
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => goToShipping(null)}
                                                disabled={submitting || (!isSample && (belowMoq || outOfStock || exceedsStock))}
                                                className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-xl px-5 py-3.5 text-[14px] font-bold text-white shadow-sm transition-opacity duration-150 disabled:opacity-50"
                                                style={{ background: isSample ? "linear-gradient(135deg, #006F83 0%, #047084 100%)" : "linear-gradient(135deg, #d2462b 0%, #c71f11 100%)" }}>
                                                Continue
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2.5">
                                            <button
                                                type="button"
                                                onClick={goBackToDetails}
                                                disabled={submitting}
                                                className="flex items-center justify-center gap-1 rounded-xl border px-4 py-3.5 text-[13.5px] font-bold disabled:opacity-50"
                                                style={{ borderColor: C.hair, color: C.ink }}
                                            >
                                                <ChevronLeft className="h-4 w-4" /> Back
                                            </button>

                                            <button
                                                onClick={() => handleSubmit(pendingOrderType || undefined)}
                                                disabled={finalCtaDisabled}
                                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-5 py-3.5 text-[14px] font-bold text-white shadow-sm transition-opacity duration-150 disabled:opacity-50"
                                                style={{ background: finalCtaBackground }}>
                                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : finalCtaLabel}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </motion.div>
            {showTransportModal && (
                <TransportPreferenceModal
                    open
                    seller={seller}
                    destCity={effectiveCity}
                    destState={effectiveState}
                    destAddressId={selectedAddressId}
                    removedNotice={transportRemovedNotice}
                    onClose={() => { setShowTransportModal(false); setTransportRemovedNotice(null); }}
                    onAddressChange={setDesiredAddressId}
                    onResolved={(result) => {
                        if (result?.pending) {
                            setTransportPreference(null);
                            setPendingTransportProposal(result);
                        } else {
                            setTransportPreference(result);
                            setPendingTransportProposal(null);
                        }
                        setTransportRemovedNotice(null);
                        setShowTransportModal(false);
                    }}
                />
            )}
        </motion.div>
    );
}