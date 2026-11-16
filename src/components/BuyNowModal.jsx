// components/BuyNowModal.jsx — SINGLE-PAGE FLOW (redesign)
//
// Visual redesign only: ALL business logic (quotes, MOQ, stock, credit, payment hand-off,
// resume intent, socket refresh, analytics) is unchanged from the previous revision.
//
// Layout
//   mobile  (<640px)  : full-width bottom sheet, single column, sticky thumb-zone footer
//   tablet / desktop  : centred compact dialog (max 512px), still single column
//
// Typography
//   - `tracking-wide` is set once on the dialog root so ALL text inherits wider letter-spacing
//   - headings that were `tracking-tight` are now `tracking-wide`
//   - uppercase labels keep their own (already wider) tracking
//   - inputs/textarea set `tracking-wide` explicitly (form controls may not inherit it)
//
// Performance
//   - presentational pieces are memoised (they re-render only when their props change)
//   - open/close uses transform + opacity only (GPU friendly), 160-200ms, honours reduced-motion
//   - backdrop blur only on >=sm screens (blur is expensive on low-end phones)
//   - heavy sections (terms / product details) are native <details>, closed by default
//
// Font: add this once to index.html <head> (Plus Jakarta Sans is the design font; the UI
// falls back gracefully to system-ui if it is not loaded):
//   <link rel="preconnect" href="https://fonts.googleapis.com">
//   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
//   <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
import { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import AddressBook from "./shipping/AddressBook.jsx";
import ImageLightbox from "./ImageLightbox.jsx";
import { shopNameOf } from "../utils/shopName.js";
import {
    Loader2, Lock, CheckCircle2, X, Plus, MapPin, Minus, Layers, FileText, Calendar, Beaker,
    Package, Truck, ReceiptText, CreditCard, Boxes, ShoppingCart, ChevronDown, AlertCircle,
    Share2, Info, Store, Maximize2, Clock, ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { BuyerAddressProvider, useBuyerAddress } from "../context/BuyerAddressContext.jsx";
import {
    fetchCheckoutStatus, fetchOrderQuote,
    placeOrder, cancelMyOrder, fetchCreditStatus,
    requestCredit as requestCreditApi,
    requestCreditIncrease as requestCreditIncreaseApi, fetchBrandItemDetail, fetchOrderConstraints,
    fetchOrderById,
} from "../utils/api.js";
import { addToCart } from "../utils/cartApi.js";
import { startOrderPayment, redirectToGateway } from "../utils/paymentsApi.js";
import { ChipToggleGroup } from "./seller/listingForm/FormPrimitives.jsx";
import { purchaseQtyToSaleUnitQty, saleUnitQtyToBaseUnits, saleUnitQtyToPacks, hasOuterPack, saleUnitLabel, round2 } from "../shared/packUnits.js";
import { checkOrderWindow, checkLocationServiceable } from "../shared/orderConstraints.js";
import { shareProductLink } from "../utils/share.js";
import { resizedImageUrl } from "../utils/imageUrl";
import { useSocket } from "../context/SocketContext.jsx";
import { track, safeCode } from "../lib/analytics.js";

/* ============================================================
   Design tokens (from the new design)
   ============================================================ */
const T = {
    ink: "#0B2533", muted: "#4F616C", soft: "#7A8A94",
    teal: "#0E7C86", tealDk: "#0A6670", tealBg: "#DDF2F3", tealTab: "#E4F1F2",
    panel: "#F3FAFA", hair: "#DCEBEC", hairSoft: "#E3EEEF", field: "#CFE3E5",
    amberBg: "#FFF6CC", amberBd: "#F3D86B", amberTx: "#5C4300", amberChip: "#FFF1B8", amberChipTx: "#7A5200",
    purple: "#6D28D9", purpleBg: "#EFE8FF", red: "#D43806", redBg: "#FFE9DF", yellow: "#FFD60A",
};
const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
const CTA_RED = "linear-gradient(135deg, #F2511B 0%, #D43806 100%)";
const CTA_PURPLE = "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)";
const CTA_TEAL = "linear-gradient(135deg, #0E7C86 0%, #0A5F70 100%)";
const EASE_OUT = [0.22, 1, 0.36, 1];
const CLOSE_MS = 160;
const CARD_SHADOW = "0 6px 22px rgba(11,37,51,0.05)";

/* ============================================================
   Pure logic — unchanged
   ============================================================ */

const BASIS_OPTIONS = [
    { value: "per_pack", label: "Packs" },
    { value: "per_master_pack", label: "Master packs" },
];

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

function computeLocalQuote(seller, quantity, basis, isSample) {
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
    const outOfStock = seller.stockType !== "made_to_order" && availableStock != null
        && (moq > 0 ? availableStock < moq : availableStock <= 0);

    const grossSubtotal = round2(slabPrice * saleQty);
    const subtotal = round2(unitPrice * saleQty);
    const discountAmount = round2(grossSubtotal - subtotal);

    return {
        orderType: "standard", quantity: qty, saleUnitQuantity: saleQty, basis, unit: seller.unit,
        unitPrice, basePriceApplied: slabPrice, appliedSlab, discountPercent, discountTier,
        grossSubtotal, discountAmount, subtotal, moq,
        meetsMoq: moq ? saleQty >= moq : true,
        availableStock, stockShortfall, outOfStock, estimatedDeliveryDate: null, isEstimate: true,
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

function pick(obj, ...keys) {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
}
const isHiddenLabel = (name) => typeof name === "string" && name.trim().toLowerCase() === "pending";
const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

/* ============================================================
   Presentational primitives (memoised)
   ============================================================ */

const NOTICE_TONES = {
    warn: { background: T.amberBg, color: T.amberTx, borderColor: T.amberBd },
    danger: { background: "#FDECEC", color: "#B3261E", borderColor: "#F5C6C3" },
    info: { background: T.tealBg, color: T.tealDk, borderColor: "#BFE3E6" },
};

const Notice = memo(function Notice({ tone = "warn", children }) {
    const t = NOTICE_TONES[tone] || NOTICE_TONES.warn;
    return (
        <div role={tone === "danger" ? "alert" : undefined} className="flex items-start gap-2 rounded-xl border px-2.5 py-2"
            style={{ background: t.background, borderColor: t.borderColor }}>
            <AlertCircle className="mt-[1px] h-4 w-4 shrink-0" style={{ color: t.color }} />
            <p className="text-[12px] font-bold leading-snug" style={{ color: t.color }}>{children}</p>
        </div>
    );
});

const SkeletonBar = memo(function SkeletonBar({ width = "70%" }) {
    return <span className="inline-block h-3.5 animate-pulse rounded" style={{ width, background: T.hairSoft }} />;
});

const Row = memo(function Row({ label, value, tone, strong }) {
    return (
        <div className="flex items-center justify-between gap-3 text-[12.5px] font-semibold" style={{ color: tone || T.muted }}>
            <span className="min-w-0">{label}</span>
            <span className="shrink-0 tabular-nums" style={{ color: tone || T.ink, fontWeight: strong ? 800 : 700 }}>{value}</span>
        </div>
    );
});

const Card = memo(function Card({ icon: Icon, tint, tintBg, title, right, children }) {
    return (
        <section className="rounded-2xl border bg-white p-3.5" style={{ borderColor: T.hair, boxShadow: CARD_SHADOW }}>
            <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    {Icon && (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: tintBg || T.tealBg }}>
                            <Icon className="h-[15px] w-[15px]" style={{ color: tint || T.teal }} />
                        </span>
                    )}
                    <h3 className="truncate text-[11px] font-extrabold uppercase tracking-[0.1em]" style={{ color: T.muted }}>{title}</h3>
                </div>
                {right}
            </div>
            <div className="flex flex-col gap-3">{children}</div>
        </section>
    );
});

const Collapse = memo(function Collapse({ icon: Icon, tint, tintBg, title, children }) {
    return (
        <details className="group rounded-2xl border bg-white" style={{ borderColor: T.hair, boxShadow: CARD_SHADOW }}>
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-3.5 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-2.5">
                    {Icon && (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: tintBg || T.purpleBg }}>
                            <Icon className="h-[15px] w-[15px]" style={{ color: tint || T.purple }} />
                        </span>
                    )}
                    <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.1em]" style={{ color: T.muted }}>{title}</span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-150 group-open:rotate-180" style={{ color: T.ink }} />
            </summary>
            <div className="border-t px-3.5 pb-3 pt-2.5" style={{ borderColor: T.hairSoft }}>{children}</div>
        </details>
    );
});

const Fact = memo(function Fact({ label, value }) {
    if (value === null || value === undefined || value === "") return null;
    return (
        <div className="flex items-baseline justify-between gap-3 border-b py-2 text-[12.5px] last:border-b-0" style={{ borderColor: T.hairSoft }}>
            <span className="shrink-0 font-semibold" style={{ color: T.muted }}>{label}</span>
            <span className="text-right font-bold" style={{ color: T.ink }}>{String(value)}</span>
        </div>
    );
});

const SegTabs = memo(function SegTabs({ items, value, onPick, size = "lg" }) {
    const h = size === "lg" ? "min-h-[38px] text-[13px]" : "min-h-[34px] text-[12px]";
    return (
        <div className="grid gap-1.5 rounded-full p-1" style={{ background: T.tealTab, gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map(({ v, t, icon: Icon, activeBg, activeColor }) => {
                const on = value === v;
                return (
                    <button key={v} type="button" onClick={() => onPick(v)} aria-pressed={on}
                        className={`flex items-center justify-center gap-1.5 rounded-full px-2 font-extrabold transition-colors duration-150 ${h}`}
                        style={on
                            ? { background: activeBg || T.ink, color: activeColor || "#fff", boxShadow: "0 5px 12px rgba(11,37,51,0.22)" }
                            : { background: "transparent", color: T.muted }}>
                        {Icon && <Icon className="h-4 w-4" />} <span className="truncate">{t}</span>
                    </button>
                );
            })}
        </div>
    );
});

/** Pill stepper used in the sticky footer. */
const FooterStepper = memo(function FooterStepper({ value, onChange, min = 1, max }) {
    const atMax = max != null && Number(value) >= Number(max);
    const atMin = Number(value) <= Number(min);
    const btn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-100 active:scale-95";
    return (
        <div className="flex h-[42px] items-center rounded-full border-[1.5px] p-[2px]" style={{ borderColor: T.field, background: T.panel }}>
            <button type="button" aria-label="Decrease quantity" disabled={atMin}
                onClick={() => onChange(Math.max(min, Number(value) - 1))} className={btn}
                style={atMin ? { color: "#9DB0B8", cursor: "not-allowed" } : { background: "#fff", color: T.ink, boxShadow: "0 2px 8px rgba(11,37,51,0.15)" }}>
                <Minus className="h-4 w-4" strokeWidth={2.6} />
            </button>
            <input type="text" inputMode="numeric" value={value} aria-label="Quantity"
                onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
                className="h-9 w-11 min-w-0 bg-transparent text-center text-[16px] font-extrabold tabular-nums tracking-wide focus:outline-none"
                style={{ color: T.ink }} />
            <button type="button" aria-label="Increase quantity" disabled={atMax}
                onClick={() => onChange(Number(value) + 1)} className={btn}
                style={atMax
                    ? { background: "#9DB0B8", color: "#fff", cursor: "not-allowed" }
                    : { background: T.teal, color: "#fff", boxShadow: "0 4px 10px rgba(14,124,134,0.35)" }}>
                <Plus className="h-4 w-4" strokeWidth={2.6} />
            </button>
        </div>
    );
});

/** 4-step delivery timeline built from the confirmed server quote. */
const DeliveryTimeline = memo(function DeliveryTimeline({ quote, seller, deliveryDateLabel }) {
    const prodLabel = seller?.stockType === "made_to_order" ? "Production" : "Dispatch";
    const transit = quote.transitDaysMin != null
        ? (quote.transitDaysMin === quote.transitDaysMax ? plural(quote.transitDaysMin, "day") : `${quote.transitDaysMin}–${quote.transitDaysMax} days`)
        : null;
    const steps = [
        { name: "Ordered", sub: quote.acceptanceDelayDays > 0 ? `+${plural(quote.acceptanceDelayDays, "day")}` : "Today", color: T.teal },
        { name: prodLabel, sub: quote.leadDays > 0 ? plural(quote.leadDays, "day") : "—", color: T.tealDk },
        { name: "Transit", sub: transit || "—", color: "#D97706" },
        { name: "Deliver By", sub: deliveryDateLabel(quote.estimatedDeliveryDate), color: "#F2511B" },
    ];
    return (
        <ol className="relative grid grid-cols-4 text-center">
            <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-[9px] h-[3px] rounded"
                style={{ background: "linear-gradient(90deg, #0E7C86, #F2511B)" }} />
            {steps.map((s) => (
                <li key={s.name} className="relative flex min-w-0 flex-col items-center gap-1.5 px-0.5">
                    <span className="h-5 w-5 rounded-full border-[3px] border-[#FFFBE6]" style={{ background: s.color }} />
                    <span className="text-[11px] font-extrabold leading-tight" style={{ color: T.ink }}>{s.name}</span>
                    <span className="text-[10px] font-semibold leading-tight" style={{ color: "#5C5226" }}>{s.sub}</span>
                </li>
            ))}
        </ol>
    );
});

/* ============================================================
   Main component
   ============================================================ */

function BuyNowModalInner({ seller, product, onClose, resumeIntent: resumeIntentProp, deferPriceUntilConfirmed = false }) {
    const { token, profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { socket } = useSocket();
    const { addresses, selectedAddress, loading: addressLoading, selectAddress } = useBuyerAddress();
    const reduceMotion = useReducedMotion();

    const [access, setAccess] = useState(() =>
        profile && (profile.email_verified || profile.phone_verified)
            ? { canCheckout: true, profile }
            : undefined
    );

    // ---- Smooth close: play the exit animation, then tell the parent ----
    const [closing, setClosing] = useState(false);
    const closeTimerRef = useRef(null);
    const handleClose = useCallback(() => {
        if (closeTimerRef.current) return;
        setClosing(true);
        closeTimerRef.current = setTimeout(() => onClose?.(), reduceMotion ? 0 : CLOSE_MS);
    }, [onClose, reduceMotion]);
    useEffect(() => () => clearTimeout(closeTimerRef.current), []);

    // ---- Delivery address (shared context; already loaded on Home) ----
    const addressBookRef = useRef(null);
    const selectedAddressId = selectedAddress?.id || null;
    const effectivePincode = selectedAddress?.pincode || "";
    const effectiveState = selectedAddress?.state || "";
    const effectiveCity = selectedAddress?.city || "";

    const restoreAddressIdRef = useRef(null);
    useEffect(() => {
        if (!restoreAddressIdRef.current || !addresses.length) return;
        const target = addresses.find((a) => a.id === restoreAddressIdRef.current);
        restoreAddressIdRef.current = null;
        if (target) selectAddress(target);
    }, [addresses, selectAddress]);

    // ---- Payment hand-off state ----
    const [pendingPay, setPendingPay] = useState(null); // { orderId, orderNumber }
    const [redirecting, setRedirecting] = useState(false);
    const [orderMode, setOrderMode] = useState("standard"); // standard | sample | credit
    const isSample = orderMode === "sample";
    const isCredit = orderMode === "credit";

    // null = never chosen (follow default) | "standard" | "credit"
    const payModeChoiceRef = useRef(null);

    const defaultBasis = useMemo(
        () => (Number(seller?.masterPackSize) >= 1 ? "per_master_pack" : "per_pack"),
        [seller?.masterPackSize]
    );

    const [basis, setBasis] = useState(defaultBasis);
    const minQuantity = useMemo(() => computeMinQuantity(seller, basis), [seller, basis]);
    const visibleBasisOptions = useMemo(() => getVisibleBasisOptions(seller), [seller?.masterPackSize]); // eslint-disable-line react-hooks/exhaustive-deps
    const [quantity, setQuantity] = useState(() => computeMinQuantity(seller, defaultBasis));
    const userPickedBasis = useRef(false);
    const belowMoq = !isSample && Number(quantity) < minQuantity;

    useEffect(() => { if (!userPickedBasis.current) setBasis(defaultBasis); }, [defaultBasis]);
    useEffect(() => {
        if (basis === "per_master_pack" && !(Number(seller?.masterPackSize) >= 1)) setBasis("per_pack");
    }, [basis, seller?.masterPackSize]);
    useEffect(() => {
        if (basis === "per_pack" && Number(seller?.masterPackSize) >= 1) setBasis("per_master_pack");
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
    const outOfStock = !isSample && (
        quote?.outOfStock || (maxQuantity != null && maxQuantity < minQuantity)
    );

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);
    const [toast, setToast] = useState(null);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const quoteTimer = useRef(null);
    const isFirstQuoteRef = useRef(true);
    const requestIdRef = useRef(0);
    const pendingQuoteRef = useRef(Promise.resolve());
    const [quoteFailed, setQuoteFailed] = useState(false);
    const standardBasisRef = useRef(defaultBasis);

    useEffect(() => {
        if (!isSample && basis !== "per_unit") standardBasisRef.current = basis;
    }, [isSample, basis]);

    useEffect(() => {
        if (!isSample && basis === "per_unit") {
            const restoredBasis = standardBasisRef.current || defaultBasis;
            setBasis(restoredBasis);
            setQuantity(computeMinQuantity(seller, restoredBasis));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSample]);

    // Back/forward-cache restore: unfreeze the "redirecting" state.
    useEffect(() => {
        const onShow = (e) => {
            if (e.persisted) { setRedirecting(false); setSubmitting(false); }
        };
        window.addEventListener("pageshow", onShow);
        return () => window.removeEventListener("pageshow", onShow);
    }, []);

    // Escape closes the dialog (unless a payment is in flight or the lightbox is open).
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== "Escape" || lightboxSrc || redirecting || submitting) return;
            handleClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [handleClose, lightboxSrc, redirecting, submitting]);

    // ---- Product details (image, specs, description…) — non-blocking ----
    const [detail, setDetail] = useState(null);
    useEffect(() => {
        if (!product?.id) return;
        let cancelled = false;
        fetchBrandItemDetail(product.id)
            .then((res) => { if (!cancelled && res?.success) setDetail(res.item); })
            .catch(() => { /* header still renders from `product` */ });
        return () => { cancelled = true; };
    }, [product?.id]);

    // ---- Credit ----
    const [creditStatus, setCreditStatus] = useState(null);
    const [creditState, setCreditState] = useState("loading");
    const [requestingCredit, setRequestingCredit] = useState(false);
    const [creditAskError, setCreditAskError] = useState(null);

    const loadCreditStatus = useCallback(async ({ keepIfEmpty = false } = {}) => {
        if (!seller?.offerId || !token) { setCreditState("error"); return; }
        try {
            const res = await fetchCreditStatus(token, { submissionId: seller.offerId });
            if (!res || res.success === false) {
                setCreditState((s) => (s === "ready" ? s : "error"));
                return;
            }
            if (res.credit || !keepIfEmpty) setCreditStatus(res.credit || null);
            setCreditState("ready");
        } catch {
            setCreditState((s) => (s === "ready" ? s : "error"));
        }
    }, [seller?.offerId, token]);

    useEffect(() => { loadCreditStatus(); }, [loadCreditStatus]);

    useEffect(() => {
        if (!socket) return undefined;
        const onCredit = () => loadCreditStatus({ keepIfEmpty: true });
        socket.on("credit:changed", onCredit);
        return () => socket.off("credit:changed", onCredit);
    }, [socket, loadCreditStatus]);

    const canBuyOnCredit = creditStatus?.status === "approved";
    const [requestingIncrease, setRequestingIncrease] = useState(false);
    const creditRemaining = creditStatus
        ? Math.max(Number(creditStatus.credit_limit || 0) - Number(creditStatus.credit_used || 0), 0)
        : 0;
    // ---- GST: taxable value = quote.subtotal (after discounts, before GST) ----
    // Reads the GST % from the quote first, then the seller listing, then the product record.
    const gstPercent = useMemo(() => {
        const v = pick(quote, "gstPercent", "gstRate", "gst_percent", "taxPercent", "taxRate")
            ?? pick(seller, "gstPercent", "gstRate", "gst_percent", "taxPercent", "taxRate")
            ?? pick(detail, "gst_percent", "gstPercent", "gst_rate", "gstRate", "gst");
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }, [quote, seller, detail]);
    const taxableAmount = Number(quote?.subtotal) || 0;
    const serverGst = quote ? pick(quote, "gstAmount", "taxAmount", "gst_amount") : null;
    const gstAmount = !quote ? 0 : serverGst != null ? Number(serverGst) : round2(taxableAmount * gstPercent / 100);
    const payableTotal = !quote ? 0 : quote.totalPayable != null ? Number(quote.totalPayable) : round2(taxableAmount + gstAmount);
    const crossesCreditLimit = isCredit && canBuyOnCredit && !!quote && payableTotal > creditRemaining;
    const limitIncreasePending = !!creditStatus?.limit_increase_request_message_id;
    const limitIncreaseCooldownActive = !!creditStatus?.limit_increase_cooldown_until
        && new Date(creditStatus.limit_increase_cooldown_until) > new Date();
    const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    const pickPayMode = (mode) => {
        payModeChoiceRef.current = mode;
        setOrderMode(mode);
        track("payment_method_selected", { method: mode });
    };

    const standardPayMode = () => {
        const chosen = payModeChoiceRef.current;
        if (chosen === "standard") return "standard";
        return canBuyOnCredit ? "credit" : "standard";
    };

    // Default payment method: approved buyers start on credit unless they already chose.
    useEffect(() => {
        if (creditState !== "ready" || payModeChoiceRef.current) return;
        setOrderMode((m) => (m === "sample" ? m : canBuyOnCredit ? "credit" : "standard"));
    }, [creditState, canBuyOnCredit]);

    // Credit no longer available: fall back to Pay now.
    useEffect(() => {
        if (creditState !== "loading" && isCredit && !canBuyOnCredit) {
            payModeChoiceRef.current = null;
            setOrderMode("standard");
        }
    }, [isCredit, canBuyOnCredit, creditState]);

    useEffect(() => { setCreditAskError(null); }, [creditStatus?.status, orderMode]);

    const handleRequestCreditIncrease = async () => {
        if (!creditStatus?.id) return;
        setCreditAskError(null);
        setRequestingIncrease(true);
        let res;
        try { res = await requestCreditIncreaseApi(token, creditStatus.id); } catch { res = null; }
        setRequestingIncrease(false);
        if (!res?.success) { setCreditAskError(res?.message || "Couldn't send the request for a higher limit."); return; }
        setCreditStatus((prev) => (prev ? { ...prev, limit_increase_request_message_id: "pending" } : prev));
        track("credit_limit_increase_requested", { source: "buy_modal" });
    };

    const handleAskCredit = async () => {
        if (requestingCredit) return;
        const sellerUserId = seller?.sellerUserId ?? seller?.sellerId;
        if (!sellerUserId && !seller?.offerId) {
            setCreditAskError("Couldn't identify the seller for a credit request.");
            return;
        }
        setCreditAskError(null);
        setRequestingCredit(true);
        let res;
        try {
            res = await requestCreditApi(token, { sellerUserId, submissionId: seller.offerId });
        } catch (e) {
            res = { success: false, message: e?.message };
        }
        if (!res?.success) {
            setRequestingCredit(false);
            setCreditAskError(res?.message || "Couldn't send the credit request. Please try again.");
            return;
        }
        setCreditStatus((prev) => ({ ...(prev || {}), status: "pending" }));
        setCreditState("ready");
        setToast("Credit request sent to the seller");
        track("credit_requested", { source: "buy_modal" });
        await loadCreditStatus({ keepIfEmpty: true });
        setRequestingCredit(false);
    };

    // Instant local quote, then the confirmed server quote below.
    useEffect(() => {
        if (deferPriceUntilConfirmed) return;
        if (!(Number(quantity) > 0)) { setQuote(null); return; }
        setQuote((prev) => {
            const local = computeLocalQuote(seller, quantity, basis, isSample);
            return local ? normalizeQuote(local) : prev;
        });
    }, [seller, quantity, basis, isSample, effectivePincode, effectiveState, deferPriceUntilConfirmed]);

    useEffect(() => {
        track("buy_modal_opened", {
            product_id: product?.id ? String(product.id) : null,
            has_sample: !!seller?.sampleAvailable,
            stock_type: seller?.stockType || null,
            resumed: !!(resumeIntentProp || location.state?.resumeIntent),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // Informational ONLY — a closed seller never blocks placing an order.
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

    const locationStatus = useMemo(() => {
        if (!/^\d{6}$/.test(effectivePincode || "")) return { serviceable: true };
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

    // Server quote (debounced; first one immediate)
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
                    setQuoteFailed(false);
                    resolve(confirmed);
                } else {
                    if (myRequestId === requestIdRef.current) setQuoteFailed(true);
                    resolve(null);
                }
            }, delay);
        });

        return () => clearTimeout(quoteTimer.current);
    }, [seller?.offerId, quantity, basis, isSample, selectedAddressId, effectivePincode, effectiveState]); // eslint-disable-line react-hooks/exhaustive-deps

    const awaitQuote = () => Promise.race([
        pendingQuoteRef.current,
        new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    // ---- Start the JioPay payment for an order that is awaiting payment ----
    const beginPayment = async (orderId, orderNumber) => {
        setError(null);
        setSubmitting(true);
        setPendingPay({ orderId, orderNumber: orderNumber || null });
        const pay = await startOrderPayment(token, orderId);
        if (!pay?.success || !pay.redirectUrl) {
            track("checkout_failed", { flow: "buy_now", stage: "start_payment", code: safeCode(pay?.code) });
            setSubmitting(false);
            setError(pay?.message || "Couldn't start the payment. Please try again.");
            return;
        }
        track("payment_initiated", {
            flow: "buy_now", item_count: 1, seller_count: 1,
            cart_value: Math.round(Number(quote?.subtotal) || 0),
        });
        setRedirecting(true);
        if (!redirectToGateway(pay.redirectUrl)) {
            setRedirecting(false);
            setSubmitting(false);
            setError("Couldn't open the payment page. Please try again.");
        }
    };

    // ---- Place order ----
    const handleSubmit = async () => {
        setError(null);
        if (!selectedAddressId) return setError("Please add a delivery address first.");
        if (!locationStatus.serviceable) return setError(locationStatus.message);

        if (!isSample && Number(quantity) < minQuantity) {
            return setError(`Minimum order quantity is ${minQuantity} ${moqUnitLabel}${minQuantity === 1 ? "" : "s"}.`);
        }
        if (!isSample && maxQuantity != null && Number(quantity) > Number(maxQuantity)) {
            return setError(Number(maxQuantity) <= 0
                ? "This item is currently out of stock with this seller."
                : `You can order at most ${maxQuantity} ${saleUnitLabel(seller?.masterPackSize)}${Number(maxQuantity) === 1 ? "" : "s"} from this seller.`);
        }
        if (!(Number(quantity) > 0)) return setError("Please enter a valid quantity.");

        track("checkout_started", {
            flow: "buy_now", order_type: orderMode, item_count: 1, seller_count: 1,
            cart_value: Math.round(Number(quote?.subtotal) || 0),
        });

        setSubmitting(true);
        const confirmed = await awaitQuote();
        const finalQuote = confirmed || quote;
        const effectiveOrderType = isSample ? "sample" : isCredit ? "credit" : "standard";

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
            shippingAddressId: selectedAddressId,
            notes: notes.trim() || undefined,
        });
        if (!res?.success) {
            track("checkout_failed", { flow: "buy_now", stage: "create_order", code: safeCode(res?.code) });
            setSubmitting(false);
            return setError(res?.message || "Couldn't place the order.");
        }

        if (res.orderStatus === "awaiting_payment") {
            await beginPayment(res.orderId, res.orderNumber);
        } else {
            setSubmitting(false);
            setDone(res);
        }
    };

    // Kept for the (currently hidden) "Edit order" button on the pending-payment panel.
    // eslint-disable-next-line no-unused-vars
    const handleEditOrder = async () => {
        if (!pendingPay || submitting) return;
        setError(null);
        setSubmitting(true);
        const current = await fetchOrderById(token, pendingPay.orderId);
        const status = current?.order?.status;
        if (current?.success && status && status !== "awaiting_payment") {
            setSubmitting(false);
            setPendingPay(null);
            onClose();
            navigate(`/orders/${pendingPay.orderId}`);
            return;
        }
        const res = await cancelMyOrder(token, pendingPay.orderId, "Buyer went back to edit the order before paying");
        setSubmitting(false);
        if (!res?.success) {
            setError(res?.message || "Couldn't reopen the order for editing. Please try again.");
            return;
        }
        setPendingPay(null);
    };

    const handleAddToCart = async () => {
        setError(null);
        if (quote && quote.meetsMoq === false) return setError(`Minimum order quantity is ${formatMoqForBasis(quote.moq, seller)}.`);
        if (maxQuantity != null && Number(quantity) > Number(maxQuantity)) {
            return setError(`You can order at most ${maxQuantity} ${saleUnitLabel(seller?.masterPackSize)}${Number(maxQuantity) === 1 ? "" : "s"} from this seller.`);
        }
        const confirmed = await awaitQuote();
        const finalQuote = confirmed || quote;
        if (finalQuote && finalQuote.meetsMoq === false) return setError(`Minimum order quantity is ${formatMoqForBasis(finalQuote.moq, seller)}.`);
        setSubmitting(true);
        const res = await addToCart(token, { submissionId: seller.offerId, quantity: Number(quantity), purchaseBasis: basis });
        setSubmitting(false);
        if (!res?.success) {
            track("add_to_cart_failed", { code: safeCode(res?.code) });
            return setError(res?.message || "Couldn't add to cart.");
        }
        track("add_to_cart", {
            purchase_basis: basis,
            quantity: Number(quantity),
            cart_value: Math.round(Number(finalQuote?.subtotal) || 0),
        });
        onClose();
        navigate("/buy/cart");
    };

    const resumeAppliedRef = useRef(false);
    useEffect(() => {
        const ri = resumeIntentProp || location.state?.resumeIntent;
        if (!ri || resumeAppliedRef.current) return;
        if (ri.source !== "buynow" || ri.offerId !== seller?.offerId) return;
        resumeAppliedRef.current = true;

        setQuantity(ri.quantity);
        userPickedBasis.current = true;
        setBasis(ri.basis);
        setOrderMode(ri.orderMode || "standard");
        payModeChoiceRef.current = ri.orderMode === "credit" || ri.orderMode === "standard" ? ri.orderMode : null;
        setNotes(ri.notes || "");
        restoreAddressIdRef.current = ri.addressId || null;

        navigate(location.pathname + location.search, { replace: true, state: {} });
    }, [location.state, seller?.offerId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    }[access?.reason] || { title: "Can't place an order right now", body: "Please try again in a moment.", cta: "Close", action: handleClose };

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 2200);
        return () => clearTimeout(t);
    }, [toast]);

    /* ---------------- derived display values ---------------- */
    const moqUnitLabel = basis === "per_master_pack" ? "Master Pack" : "Pack";
    const basisLabel = basis === "per_pack" ? "pack(s)" : basis === "per_master_pack" ? "master pack(s)" : (seller?.unit || "units");
    const deliveryDateLabel = useCallback(
        (val) => (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val) ? formatDDMon(new Date(val)) : val),
        []
    );
    const canSample = seller?.sampleAvailable;

    const priceLoading = deferPriceUntilConfirmed && !quoteFailed && (!quote || quote.isEstimate);

    const productName = product?.name || pick(detail, "name");
    const brandName = product?.brand_name || product?.brandName || pick(detail, "brand_name", "brandName");
    const brandNotApplicable = pick(detail, "brand_not_applicable", "brandNotApplicable");
    const modelNo = product?.model_no || pick(detail, "model_no", "modelNo");
    const gradeVariant = pick(detail, "grade_variant", "gradeVariant");
    const manufacturer = pick(detail, "manufacturer");
    const description = pick(detail, "description");
    const manufacturingDetails = pick(detail, "manufacturing_details", "manufacturingDetails");
    const specifications = detail?.specifications || [];
    const categoryLabel = [product?.category_name || pick(detail, "category_name"), product?.subcategory_name || pick(detail, "subcategory_name")]
        .filter((x) => x && !isHiddenLabel(x)).join(" · ");
    const galleryImages = detail?.images?.length ? detail.images : (detail?.image ? [detail.image] : []);
    const heroImage = product?.image || galleryImages[0] || null;
    const brandImage = product?.brand_image || pick(detail, "brand_image", "brandImage");
    const subLabel = [brandNotApplicable ? null : brandName, modelNo].filter(Boolean).join(" · ");
    const hasPack = Number(seller?.packSize) > 0;
    const hasMaster = Number(seller?.masterPackSize) >= 1;
    const sellerLabel = shopNameOf(seller);

    const hasTerms = seller && (seller.deliveryTimeline || seller.paymentTerms || seller.returnPolicy || seller.warranty || seller.freightIncluded != null || seller.dispatchOrigin);
    const hasProductDetails = !!(manufacturer || modelNo || gradeVariant || description || manufacturingDetails || specifications.length || galleryImages.length > 1);

    const qtyNotice = isSample ? null
        : outOfStock ? "This item is currently out of stock with this seller."
            : exceedsStock ? `You can order at most ${maxQuantity} ${saleUnitLabel(seller?.masterPackSize)}${Number(maxQuantity) === 1 ? "" : "s"} from this seller. Please reduce the quantity.`
                : quote && quote.meetsMoq === false ? `Below the seller's MOQ of ${formatMoqForBasis(quote.moq, seller)}.`
                    : null;

    /* ---------------- footer: MOQ note ---------------- */
    const hasMoqNote = !isSample && Number(seller?.moq) > 0 && minQuantity > 0;
    const moqQtyText = `${minQuantity} ${moqUnitLabel}${minQuantity === 1 ? "" : "s"}`;
    const moqBaseText = hasPack && seller?.unit ? ` (${toBaseUnits(seller, minQuantity, basis)} ${seller.unit})` : "";
    const moqNoteText = `MOQ is ${moqQtyText}${moqBaseText} · can't order below this from this seller.`;

    /* ---------------- footer: credit strip ---------------- */
    const creditKind = creditState !== "ready" ? "unknown"
        : !creditStatus ? "none"
            : creditStatus.status === "approved" ? "approved"
                : creditStatus.status === "pending" ? "pending"
                    : creditStatus.status === "rejected"
                        ? (creditStatus.cooldown_until && new Date(creditStatus.cooldown_until) > new Date() ? "cooldown" : "retry")
                        : creditStatus.status === "revoked" ? "revoked"
                            : "none";
    const canAskCredit = creditKind === "none" || creditKind === "retry" || creditKind === "revoked";

    /* ---------------- primary CTA ---------------- */
    const verb = isSample ? "Request sample" : isCredit ? "Buy on credit" : "Buy now";
    const ctaLabel = !selectedAddressId ? "Add delivery address" : verb;
    const ctaDisabled = submitting || addressLoading || blockedByConstraints || priceLoading
        || (!isSample && (belowMoq || outOfStock || exceedsStock)) || crossesCreditLimit;
    const ctaBackground = isSample ? CTA_TEAL : isCredit ? CTA_PURPLE : CTA_RED;
    const ctaShadow = isSample ? "0 6px 14px rgba(14,124,134,0.30)"
        : isCredit ? "0 6px 14px rgba(109,40,217,0.30)"
            : "0 6px 16px rgba(242,81,27,0.32), inset 0 1px 0 rgba(255,255,255,0.35)";

    const handlePrimary = () => {
        setError(null);
        if (!selectedAddressId) { addressBookRef.current?.openChange(); return; }
        handleSubmit();
    };

    const stopScrollPropagation = useCallback((e) => { e.stopPropagation(); }, []);
    const onPickOrderType = useCallback((v) => setOrderMode(v === "sample" ? "sample" : standardPayMode()), []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleShare = async () => {
        const result = await shareProductLink({
            submissionId: seller.offerId, productName: product?.name, sellerName: sellerLabel,
        });
        if (result === "copied") setToast("Link copied!");
    };

    /* ---------------- motion ---------------- */
    const dur = reduceMotion ? 0 : 0.2;
    const overlayAnim = { opacity: closing ? 0 : 1 };
    const sheetAnim = closing
        ? { opacity: 0, y: 24, scale: 0.985 }
        : { opacity: 1, y: 0, scale: 1 };

    const primaryBtnBase = "flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-extrabold tracking-wide text-white transition-[opacity,transform] duration-100 active:scale-[0.985] disabled:opacity-50";

    return (
        <motion.div
            className="fixed inset-0 z-[999] flex items-end justify-center bg-black/55 tracking-wide sm:items-center sm:bg-black/50 sm:p-4 sm:backdrop-blur-sm"
            style={{ fontFamily: FONT }}
            initial={{ opacity: 0 }} animate={overlayAnim}
            transition={{ duration: reduceMotion ? 0 : closing ? 0.16 : 0.18, ease: "easeOut" }}
            onClick={handleClose}>
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Place order"
                className="bbm-buynow relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] tracking-wide shadow-2xl sm:max-h-[90dvh] sm:rounded-[24px]"
                style={{ background: "linear-gradient(180deg, #E6F6F6 0px, #F5FBFB 220px, #FFFFFF 520px)", color: T.ink, willChange: "transform, opacity" }}
                initial={{ y: 28, opacity: 0, scale: 0.985 }} animate={sheetAnim}
                transition={{ duration: closing ? CLOSE_MS / 1000 : dur, ease: closing ? "easeIn" : EASE_OUT }}
                onClick={(e) => e.stopPropagation()}>

                {redirecting ? (
                    <div className="flex flex-col items-center bg-white px-6 py-16 text-center">
                        <Loader2 className="h-9 w-9 animate-spin" style={{ color: T.teal }} />
                        <h2 className="mt-4 text-[16px] font-extrabold tracking-wide">Taking you to JioPay…</h2>
                        <p className="mt-1.5 max-w-xs text-[13px] font-medium leading-relaxed" style={{ color: T.muted }}>
                            Please don't close or refresh this page. You'll be brought back here once the payment is done.
                        </p>
                    </div>
                ) : pendingPay ? (
                    <div className="flex flex-col items-center bg-white px-6 py-10 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg" style={{ background: CTA_RED }}>
                            <CreditCard className="h-7 w-7" />
                        </span>
                        <h2 className="mt-4 text-[17px] font-extrabold tracking-wide">Payment pending</h2>
                        {pendingPay.orderNumber && (
                            <p className="mt-1.5 rounded-full px-3 py-1 font-mono text-[12px] font-semibold" style={{ background: T.panel, color: T.teal }}>{pendingPay.orderNumber}</p>
                        )}
                        <p className="mt-3 max-w-sm text-[13px] font-medium leading-relaxed" style={{ color: T.muted }}>
                            Your order is created but not paid yet. Pay now to confirm it.
                            If you already paid, give it a minute — you'll find it in your orders.
                        </p>
                        {error && <div className="mt-4 w-full max-w-sm"><Notice tone="danger">{error}</Notice></div>}
                        <div className="mt-6 flex w-full max-w-sm flex-col gap-2.5">
                            <button onClick={() => beginPayment(pendingPay.orderId, pendingPay.orderNumber)} disabled={submitting}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white shadow-md disabled:opacity-60"
                                style={{ background: CTA_RED }}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay now"}
                            </button>
                            {/* <button onClick={handleEditOrder} disabled={submitting}
                                className="w-full rounded-xl border py-3 text-[13.5px] font-bold disabled:opacity-60" style={{ borderColor: T.hair, color: T.ink }}>
                                Edit order
                            </button> */}
                            <button onClick={handleClose} disabled={submitting}
                                className="min-h-[44px] w-full text-[13px] font-bold disabled:opacity-60" style={{ color: T.muted }}>
                                Pay later from My orders
                            </button>
                        </div>
                    </div>
                ) : done ? (
                    <div className="flex flex-col items-center bg-white px-6 py-10 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg" style={{ background: "linear-gradient(135deg,#047084,#0B9FB8)" }}>
                            <CheckCircle2 className="h-8 w-8" />
                        </span>
                        <h2 className="mt-4 text-[17px] font-extrabold tracking-wide">
                            {done.orderType === "sample" ? "Sample requested" : done.paymentMethod === "credit" ? "Order placed on credit" : "Order placed"}
                        </h2>
                        <p className="mt-1.5 rounded-full px-3 py-1 font-mono text-[12px] font-semibold" style={{ background: T.panel, color: T.teal }}>{done.orderNumber}</p>
                        <p className="mt-3 max-w-sm text-[13px] font-medium leading-relaxed" style={{ color: T.muted }}>{done.message}</p>

                        {done.estimatedDeliveryDate && (
                            <p className="mt-3 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold" style={{ background: T.tealBg, color: T.tealDk }}>
                                <Calendar className="h-3.5 w-3.5" /> Estimated delivery {deliveryDateLabel(done.estimatedDeliveryDate)}
                            </p>
                        )}
                        {done.stockShortfall && (
                            <div className="mt-4 w-full max-w-sm">
                                <Notice tone="warn">This item is short on stock right now — fulfilment may take a little longer than usual.</Notice>
                            </div>
                        )}
                        <div className="mt-7 flex w-full max-w-sm gap-2.5">
                            <button onClick={handleClose} className="h-12 flex-1 rounded-2xl border text-[14px] font-extrabold" style={{ borderColor: T.hair, color: T.ink }}>Keep browsing</button>
                            <button onClick={() => navigate("/orders")} className="h-12 flex-1 rounded-2xl text-[14px] font-extrabold text-white shadow-md" style={{ background: CTA_RED }}>View orders</button>
                        </div>
                    </div>
                ) : access === undefined ? (
                    <div className="flex items-center justify-center bg-white py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: T.muted }} /></div>
                ) : !access.canCheckout ? (
                    <div className="flex flex-col items-center bg-white px-6 py-10 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg" style={{ background: "linear-gradient(135deg,#047084,#0B9FB8)" }}>
                            <Lock className="h-6 w-6" />
                        </span>
                        <h2 className="mt-4 text-[16px] font-extrabold tracking-wide">{gateContent.title}</h2>
                        <p className="mt-2 max-w-xs text-[13px] font-medium leading-relaxed" style={{ color: T.muted }}>{gateContent.body}</p>
                        <button onClick={gateContent.action} className="mt-6 h-12 rounded-2xl px-8 text-[14px] font-extrabold text-white shadow-md" style={{ background: CTA_RED }}>{gateContent.cta}</button>
                    </div>
                ) : (
                    <>
                        {/* ============ HEADER — what am I buying ============ */}
                        <header className="shrink-0 rounded-b-[22px] bg-white px-3.5 pb-3 pt-3.5 sm:px-5"
                            style={{ boxShadow: "0 10px 30px rgba(14,124,134,0.10)" }}>
                            <div className="flex items-center gap-3">
                                <button type="button" disabled={!heroImage} onClick={() => heroImage && setLightboxSrc(heroImage)}
                                    aria-label="View product image"
                                    className="relative flex h-[68px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border"
                                    style={{ background: "linear-gradient(160deg, #F1EAFF 0%, #E4F4F5 100%)", borderColor: T.hairSoft, cursor: heroImage ? "zoom-in" : "default" }}>
                                    {heroImage
                                        ? <img src={resizedImageUrl(heroImage, { width: 256 })} alt="" referrerPolicy="no-referrer" decoding="async" className="h-full w-full object-contain p-1.5 mix-blend-multiply" />
                                        : <Package className="h-6 w-6" style={{ color: T.muted }} />}
                                    {heroImage && (
                                        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                                            <Maximize2 className="h-2.5 w-2.5" />
                                        </span>
                                    )}
                                </button>
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: T.teal }}>Place order</p>
                                    <h2 className="line-clamp-2 text-[15px] font-extrabold leading-tight">{productName}</h2>
                                    {subLabel && (
                                        <p className="flex items-center gap-1.5 truncate text-[11px] font-extrabold uppercase tracking-wider" style={{ color: T.purple }}>
                                            {brandImage && !brandNotApplicable && (
                                                <img src={resizedImageUrl(brandImage, { width: 64 })} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />
                                            )}
                                            <span className="truncate">{subLabel}</span>
                                        </p>
                                    )}
                                    {categoryLabel && <p className="truncate text-[10.5px] font-semibold" style={{ color: T.soft }}>{categoryLabel}</p>}
                                    <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold" style={{ color: T.muted }}>
                                        <Store className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">Sold by {sellerLabel}{seller?.dispatchOrigin ? ` · ${seller.dispatchOrigin}` : ""}</span>
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-col gap-1.5 self-start">
                                    <button onClick={handleClose} aria-label="Close"
                                        className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-100 hover:bg-[#E9F4F4] active:scale-95"
                                        style={{ borderColor: T.hair, background: "#F4FAFA" }}>
                                        <X className="h-[18px] w-[18px]" strokeWidth={2.4} style={{ color: T.ink }} />
                                    </button>
                                    <button onClick={handleShare} aria-label="Share this seller's listing"
                                        className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-100 hover:bg-[#E9F4F4] active:scale-95"
                                        style={{ borderColor: T.hair, background: "#F4FAFA" }}>
                                        <Share2 className="h-[17px] w-[17px]" style={{ color: T.muted }} />
                                    </button>
                                </div>
                            </div>
                        </header>

                        {/* ============ BODY ============ */}
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent
                            onWheel={stopScrollPropagation} onTouchStart={stopScrollPropagation} onTouchMove={stopScrollPropagation}>
                            <div className="flex flex-col gap-3 px-3 py-3 sm:px-4">

                                {canSample && (
                                    <SegTabs value={isSample ? "sample" : "standard"} onPick={onPickOrderType}
                                        items={[
                                            { v: "standard", t: "Standard order" },
                                            { v: "sample", t: "Order a sample", icon: Beaker },
                                        ]} />
                                )}
                                {isSample && (
                                    <p className="-mt-1 px-1 text-[12.5px] font-semibold" style={{ color: T.muted }}>
                                        {seller.samplePrice ? `Sample price: ₹${inr(seller.samplePrice)}/${seller.unit}` : "This sample is free."}
                                    </p>
                                )}

                                {(qtyNotice || error || (deferPriceUntilConfirmed && quoteFailed && !quote) || (!windowStatus.open && windowStatus.message)) && (
                                    <div className="flex flex-col gap-2">
                                        {deferPriceUntilConfirmed && quoteFailed && !quote && (
                                            <Notice tone="danger">Couldn't load the latest price. Change the quantity or reopen this link to retry.</Notice>
                                        )}
                                        {qtyNotice && <Notice tone="danger">{qtyNotice}</Notice>}
                                        {error && <Notice tone="danger">{error}</Notice>}
                                        {!windowStatus.open && windowStatus.message && <Notice tone="warn">{windowStatus.message}</Notice>}
                                    </div>
                                )}

                                {/* Two columns on desktop: [Quantity + Price] | [Delivery] */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex min-w-0 flex-col gap-3.5">
                                        {/* ============ QUANTITY ============ */}
                                        <Card icon={Package} title="Quantity" right={!isSample ? (
                                            <span className="shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold"
                                                style={{ background: T.amberChip, borderColor: T.amberBd, color: T.amberChipTx }}>
                                                MOQ {minQuantity} {moqUnitLabel}{minQuantity === 1 ? "" : "s"}
                                            </span>
                                        ) : null}>
                                            {!isSample && hasPack && (
                                                <div className={`grid gap-2.5 ${hasMaster ? "grid-cols-2" : "grid-cols-1"}`}>
                                                    <div className="flex min-w-0 flex-col gap-0 rounded-xl border px-3 py-2" style={{ background: T.panel, borderColor: T.hair }}>
                                                        <span className="text-[10px] font-bold uppercase" style={{ color: T.muted }}>1 pack</span>
                                                        <span className="truncate text-[14px] font-extrabold">{seller.packSize} {seller.unit}</span>
                                                    </div>
                                                    {hasMaster && (
                                                        <div className="flex min-w-0 flex-col gap-0 rounded-xl border px-3 py-2" style={{ background: T.panel, borderColor: T.hair }}>
                                                            <span className="text-[10px] font-bold uppercase" style={{ color: T.muted }}>1 master pack</span>
                                                            <span className="truncate text-[14px] font-extrabold">{seller.masterPackSize} packs</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {!isSample && visibleBasisOptions.length > 1 && (
                                                <ChipToggleGroup dense value={basis} onChange={(v) => { userPickedBasis.current = true; setBasis(v); }} options={visibleBasisOptions} />
                                            )}

                                            <div className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-white" style={{ background: CTA_TEAL }}>
                                                {isSample ? (
                                                    <>
                                                        <div className="flex min-w-0 flex-col gap-0.5">
                                                            <span className="text-[15px] font-extrabold tabular-nums">{quantity} {seller?.unit}</span>
                                                            {hasPack && (
                                                                <span className="text-[12px] font-semibold" style={{ color: "#D5F0F2" }}>
                                                                    ~{round2(Number(quantity) / Number(seller.packSize))} pack{round2(Number(quantity) / Number(seller.packSize)) === 1 ? "" : "s"}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="shrink-0 whitespace-nowrap rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">Fixed by seller</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex min-w-0 flex-col gap-0.5">
                                                            <span className="text-[15px] font-extrabold capitalize tabular-nums">{quantity || 0} {basisLabel}</span>
                                                            {hasPack && (
                                                                <span className="text-[12px] font-semibold" style={{ color: "#D5F0F2" }}>
                                                                    = {toBaseUnits(seller, Number(quantity) || 0, basis)} {seller?.unit}
                                                                    {hasMaster && basis === "per_master_pack" ? ` · ${(Number(quantity) || 0) * Number(seller.masterPackSize)} packs` : ""}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="shrink-0 whitespace-nowrap rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">Adjust below ↓</span>
                                                    </>
                                                )}
                                            </div>

                                            {!isSample && !priceLoading && Array.isArray(seller?.priceSlabs) && seller.priceSlabs.length > 0 && (
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold">
                                                        <Layers className="h-3.5 w-3.5" style={{ color: T.teal }} /> Price slabs
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {seller.priceSlabs.map((slab, i) => {
                                                            const active = quote?.appliedSlab && Number(quote.appliedSlab.minQty) === Number(slab.minQty);
                                                            return (
                                                                <span key={i} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                                                                    style={active ? { borderColor: T.teal, background: T.tealBg, color: T.tealDk } : { borderColor: T.hair, color: T.muted }}>
                                                                    {slab.minQty}{slab.maxQty ? `–${slab.maxQty}` : "+"} {moqUnitLabel.toLowerCase()}{Number(slab.maxQty || slab.minQty) === 1 ? "" : "s"}: ₹{inr(slab.price)}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {!isSample && !priceLoading && Array.isArray(seller?.quantityDiscounts) && seller.quantityDiscounts.length > 0 && (
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold">
                                                        <Layers className="h-3.5 w-3.5" style={{ color: T.red }} /> Quantity discounts
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {seller.quantityDiscounts.map((tier, i) => {
                                                            const active = quote?.discountTier && Number(quote.discountTier.minQty) === Number(tier.minQty);
                                                            const tierUnitLabel = hasMaster ? "master pack" : "pack";
                                                            return (
                                                                <span key={i} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                                                                    style={active ? { borderColor: T.red, background: "rgba(212,56,6,0.08)", color: T.red } : { borderColor: T.hair, color: T.muted }}>
                                                                    {tier.minQty}+ {tierUnitLabel}{Number(tier.minQty) === 1 ? "" : "s"}: {tier.discountPercent}% off
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </Card>

                                        {/* ============ PRICE SUMMARY ============ */}
                                        <Card icon={ReceiptText} tint={T.red} tintBg={T.redBg} title="Price summary">
                                            {priceLoading ? (
                                                <div className="flex flex-col gap-2.5 rounded-2xl p-3.5" style={{ background: T.panel }}>
                                                    <SkeletonBar width="45%" />
                                                    <SkeletonBar width="30%" />
                                                    <div className="h-px" style={{ background: T.hair }} />
                                                    <SkeletonBar width="80%" />
                                                    <SkeletonBar width="60%" />
                                                </div>
                                            ) : quote ? (
                                                <>
                                                    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                                                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                                                            <span className="text-[20px] font-extrabold tabular-nums leading-none">₹{inr(quote.basePriceApplied ?? quote.unitPrice)}</span>
                                                            <span className="text-[12.5px] font-semibold" style={{ color: T.muted }}>/ {isSample ? seller?.unit : saleUnitLabel(seller?.masterPackSize)}</span>
                                                        </div>
                                                        {!isSample && hasPack && (
                                                            <span className="whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-extrabold tabular-nums" style={{ background: T.tealBg, color: T.tealDk }}>
                                                                ≈ ₹{inr((quote.basePriceApplied ?? quote.unitPrice) / saleUnitQtyToBaseUnits(1, seller.packSize, seller.masterPackSize))} / {seller?.unit}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="h-px" style={{ background: T.hairSoft }} />
                                                    {/* What is being bought (all before GST) */}
                                                    <div className="flex flex-col gap-2 rounded-xl border px-3 py-2.5" style={{ background: T.panel, borderColor: T.hair }}>
                                                        {isSample ? (
                                                            <Row label="Sample quantity" value={`${quote.baseUnitQuantity} ${seller?.unit}`} tone={T.ink} strong />
                                                        ) : (
                                                            <>
                                                                {hasPack && <Row label="1 pack" value={`${seller.packSize} ${seller.unit}`} tone={T.ink} />}
                                                                {hasMaster && hasOuterPack(seller.masterPackSize) && (
                                                                    <Row label="1 master pack" value={`${seller.masterPackSize} packs${hasPack ? ` = ${saleUnitQtyToBaseUnits(1, seller.packSize, seller.masterPackSize)} ${seller.unit}` : ""}`} tone={T.ink} />
                                                                )}
                                                                <Row label="Ordered"
                                                                    value={`${plural(quote.saleUnitQuantity, saleUnitLabel(seller?.masterPackSize))}${hasOuterPack(seller?.masterPackSize) ? ` (${saleUnitQtyToPacks(quote.saleUnitQuantity, seller.masterPackSize)} packs)` : ""}`}
                                                                    tone={T.ink} strong />
                                                                <Row label="Total quantity"
                                                                    value={`${saleUnitQtyToBaseUnits(quote.saleUnitQuantity, seller?.packSize, seller?.masterPackSize)} ${seller?.unit || ""}`}
                                                                    tone={T.tealDk} strong />
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Row label={isSample ? "Sample amount" : `Amount (${quote.saleUnitQuantity} × ₹${inr(quote.basePriceApplied ?? quote.unitPrice)})`}
                                                            value={`₹${inr(quote.grossSubtotal)}`} strong />
                                                        {!isSample && quote.discountAmount > 0 && (
                                                            <Row label={`Discount (${quote.discountPercent}% off)`} value={`− ₹${inr(quote.discountAmount)}`} tone={T.tealDk} strong />
                                                        )}
                                                        <div className="h-px" style={{ background: T.hairSoft }} />
                                                        <Row label="Subtotal (before GST)" value={`₹${inr(taxableAmount)}`} tone={T.ink} strong />
                                                        {(gstPercent > 0 || gstAmount > 0) && (
                                                            <Row label={gstPercent > 0 ? `GST (${gstPercent}%)` : "GST"} value={`+ ₹${inr(gstAmount)}`} strong />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5" style={{ background: T.amberBg, borderColor: T.amberBd }}>
                                                        <span className="text-[13px] font-extrabold">{isSample ? "Total payable (sample)" : "Total payable"}</span>
                                                        <span className="text-[20px] font-extrabold tabular-nums leading-none">₹{inr(payableTotal)}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-[13px] font-medium" style={{ color: T.muted }}>Enter a quantity to see the total.</p>
                                            )}

                                            {/* Pay now / Pay on credit — only for buyers already approved for credit */}
                                            {!isSample && canBuyOnCredit && (
                                                <div className="flex flex-col gap-2.5">
                                                    <SegTabs size="sm" value={orderMode === "credit" ? "credit" : "standard"} onPick={pickPayMode}
                                                        items={[
                                                            { v: "standard", t: "Pay now", activeBg: "#fff", activeColor: T.tealDk },
                                                            { v: "credit", t: "Pay on credit", icon: CreditCard, activeBg: "#fff", activeColor: T.purple },
                                                        ]} />
                                                    {isCredit && (
                                                        <p className="px-1 text-[12px] font-bold" style={{ color: T.muted }}>Credit available: ₹{inr(creditRemaining)}</p>
                                                    )}
                                                    {crossesCreditLimit && (
                                                        limitIncreasePending ? (
                                                            <Notice tone="info">You've asked {sellerLabel} for a higher credit limit — waiting for their response.</Notice>
                                                        ) : limitIncreaseCooldownActive ? (
                                                            <Notice tone="warn">This order is above your remaining credit. Your last request was declined — you can ask again after {fmtDate(creditStatus.limit_increase_cooldown_until)}.</Notice>
                                                        ) : (
                                                            <>
                                                                <Notice tone="warn">This order is above your remaining credit limit.</Notice>
                                                                <button type="button" onClick={handleRequestCreditIncrease} disabled={requestingIncrease}
                                                                    className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border px-4 text-[13px] font-extrabold disabled:opacity-50"
                                                                    style={{ borderColor: "#6d28d940", color: T.purple, background: "#6d28d908" }}>
                                                                    <CreditCard className="h-3.5 w-3.5" /> {requestingIncrease ? "Requesting…" : "Ask for a higher credit limit"}
                                                                </button>
                                                            </>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </Card>
                                    </div>

                                    <div className="flex min-w-0 flex-col gap-3.5">
                                        {/* ============ DELIVERY ============ */}
                                        <Card icon={MapPin} title="Delivery">
                                            <AddressBook ref={addressBookRef} disabled={submitting} />

                                            {blockedByConstraints && <Notice tone="danger">{locationStatus.message}</Notice>}

                                            {!blockedByConstraints && quote && (
                                                <div className="flex flex-col gap-3 rounded-2xl border p-3"
                                                    style={{ background: "linear-gradient(135deg, #FFF6CC 0%, #FFFBE6 100%)", borderColor: T.amberBd }}>
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: T.yellow }}>
                                                            <Truck className="h-5 w-5" style={{ color: T.ink }} />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="text-[11px] font-bold" style={{ color: "#6A5A1A" }}>Estimated delivery</p>
                                                            <p className="text-[16px] font-extrabold leading-tight">
                                                                {quote.isEstimate || !quote.estimatedDeliveryDate ? <SkeletonBar width="90px" /> : deliveryDateLabel(quote.estimatedDeliveryDate)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {!quote.isEstimate && quote.estimatedDeliveryDate && (
                                                        <DeliveryTimeline quote={quote} seller={seller} deliveryDateLabel={deliveryDateLabel} />
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-2">
                                                <label htmlFor="bbm-note" className="text-[11px] font-extrabold uppercase tracking-[0.1em]" style={{ color: T.muted }}>Note to seller (optional)</label>
                                                <textarea id="bbm-note" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any special instructions…"
                                                    className="w-full resize-none rounded-xl border-[1.5px] px-3 py-2 text-[13px] font-medium tracking-wide placeholder:text-[#7A8A94] focus:outline-none focus:ring-2"
                                                    style={{ borderColor: T.field, background: "#FBFEFE", color: T.ink, ["--tw-ring-color"]: `${T.teal}33` }} />
                                            </div>
                                        </Card>
                                    </div>
                                </div>

                                {/* ============ DETAILS (closed by default) ============ */}
                                {hasTerms && (
                                    <Collapse icon={FileText} title="Seller terms">
                                        <div className="flex flex-col">
                                            <Fact label="Delivery" value={seller.deliveryTimeline} />
                                            <Fact label="Payment" value={seller.paymentTerms} />
                                            <Fact label="Returns" value={seller.returnPolicy} />
                                            <Fact label="Warranty" value={seller.warranty} />
                                            <Fact label="Ships from" value={seller.dispatchOrigin} />
                                            {seller.freightIncluded != null && <Fact label="Freight" value={seller.freightIncluded ? "Included in price" : "Extra, paid by buyer"} />}
                                        </div>
                                    </Collapse>
                                )}

                                {(hasProductDetails || (product?.id && !detail)) && (
                                    <Collapse icon={Info} tint={T.teal} tintBg={T.tealBg} title="Product details">
                                        {!detail && product?.id ? (
                                            <div className="flex flex-col gap-2">
                                                <SkeletonBar width="60%" /><SkeletonBar width="90%" /><SkeletonBar width="75%" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-3.5">
                                                {galleryImages.length > 1 && (
                                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                                        {galleryImages.slice(0, 8).map((src, i) => (
                                                            <button key={i} type="button" onClick={() => setLightboxSrc(src)} aria-label={`View image ${i + 1}`}
                                                                className="h-14 w-14 shrink-0 overflow-hidden rounded-xl" style={{ background: "#F4F5F6", cursor: "zoom-in" }}>
                                                                <img src={resizedImageUrl(src, { width: 128 })} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {(manufacturer || modelNo || gradeVariant) && (
                                                    <div className="rounded-2xl border px-3.5" style={{ borderColor: T.hair }}>
                                                        <Fact label="Manufacturer" value={manufacturer} />
                                                        <Fact label="Model / Part No." value={modelNo} />
                                                        <Fact label="Grade / Variant" value={gradeVariant} />
                                                    </div>
                                                )}
                                                {description && (
                                                    <div>
                                                        <p className="mb-1 text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color: T.muted }}>Description</p>
                                                        <p className="text-[13px] font-medium leading-relaxed" style={{ color: T.ink }}>{description}</p>
                                                    </div>
                                                )}
                                                {manufacturingDetails && (
                                                    <div>
                                                        <p className="mb-1 text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color: T.muted }}>Manufacturing</p>
                                                        <p className="text-[13px] font-medium leading-relaxed" style={{ color: T.ink }}>{manufacturingDetails}</p>
                                                    </div>
                                                )}
                                                {specifications.length > 0 && (
                                                    <div>
                                                        <p className="mb-1 text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color: T.muted }}>Specifications</p>
                                                        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: T.hair }}>
                                                            {specifications.map((s, i) => (
                                                                <div key={i} className="flex justify-between gap-3 px-3.5 py-2 text-[12.5px] font-semibold"
                                                                    style={{ background: i % 2 === 0 ? "#fff" : T.panel, color: T.ink }}>
                                                                    <span style={{ color: T.muted }}>{s.key}</span>
                                                                    <span className="text-right">{s.value}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Collapse>
                                )}
                            </div>
                        </div>

                        {/* ============ STICKY FOOTER (thumb zone) ============ */}
                        <footer className="shrink-0 rounded-t-[22px] bg-white px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4"
                            style={{ boxShadow: "0 -12px 34px rgba(11,37,51,0.12)" }}>
                            <div className="mx-auto flex w-full flex-col gap-2.5">
                                {/* MOQ warning: only shown when the typed quantity is below the seller's MOQ */}
                                {hasMoqNote && belowMoq && (
                                    <div role="alert" className="flex items-start gap-2 rounded-xl border px-2.5 py-2"
                                        style={{ background: "#FDECEC", borderColor: "#F5C6C3", color: "#B3261E" }}>
                                        <AlertCircle className="mt-[1px] h-4 w-4 shrink-0" />
                                        <p className="text-[11.5px] font-bold leading-snug">{moqNoteText}</p>
                                    </div>
                                )}

                                {/* Row 1: quantity + total */}
                                <div className="flex items-center justify-between gap-3">
                                    {isSample ? (
                                        <p className="text-[14px] font-extrabold tabular-nums">
                                            {quantity} {seller?.unit} <span className="text-[11px] font-semibold" style={{ color: T.muted }}>sample</span>
                                        </p>
                                    ) : (
                                        <FooterStepper value={quantity} onChange={setQuantity} min={minQuantity} max={maxQuantity} />
                                    )}
                                    <div className="min-w-0 text-right">
                                        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: T.muted }}>Total</p>
                                        <p className="text-[20px] font-extrabold leading-tight tabular-nums">
                                            {priceLoading ? <SkeletonBar width="90px" /> : quote ? `₹${inr(payableTotal)}` : "—"}
                                        </p>
                                    </div>
                                </div>

                                {/* Row 3: credit (not for samples) */}
                                {!isSample && (
                                    <>
                                        {crossesCreditLimit && (
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-[14px] border px-3 py-2.5" style={{ background: T.amberBg, borderColor: T.amberBd }}>
                                                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-bold leading-snug" style={{ color: T.amberTx }}>
                                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                                    Above your remaining credit (₹{inr(creditRemaining)})
                                                </span>
                                                <button type="button" onClick={() => pickPayMode("standard")}
                                                    className="h-9 rounded-full border bg-white px-3.5 text-[12px] font-extrabold" style={{ borderColor: T.hair, color: T.ink }}>
                                                    Pay now
                                                </button>
                                                {limitIncreasePending ? (
                                                    <span className="text-[11.5px] font-bold" style={{ color: T.amberTx }}>Higher limit requested</span>
                                                ) : limitIncreaseCooldownActive ? (
                                                    <span className="text-[11.5px] font-bold" style={{ color: T.amberTx }}>Ask again after {fmtDate(creditStatus.limit_increase_cooldown_until)}</span>
                                                ) : (
                                                    <button type="button" onClick={handleRequestCreditIncrease} disabled={requestingIncrease}
                                                        className="inline-flex h-9 items-center gap-1 rounded-full border px-3.5 text-[12px] font-extrabold disabled:opacity-50"
                                                        style={{ borderColor: "#6d28d940", color: T.purple, background: "#6d28d908" }}>
                                                        {requestingIncrease ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                                                        Higher limit
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {canAskCredit && (
                                            <div className="flex items-center justify-between gap-2.5">
                                                <span className="min-w-0 truncate text-[12.5px] font-bold" style={{ color: T.muted }}>Want to pay later?</span>
                                                <button type="button" onClick={handleAskCredit} disabled={requestingCredit || submitting}
                                                    aria-label={`Ask ${sellerLabel} for credit`}
                                                    className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[12.5px] font-extrabold transition-transform duration-100 active:scale-95 disabled:opacity-50"
                                                    style={{ borderColor: T.teal, color: T.tealDk, background: "#E4F6F7" }}>
                                                    {requestingCredit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                                    {requestingCredit ? "Sending…" : "Ask for credit"}
                                                </button>
                                            </div>
                                        )}
                                        {creditKind === "pending" && (
                                            <p className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: T.amberTx }}>
                                                <Clock className="h-3.5 w-3.5 shrink-0" /> Credit request sent · waiting for {sellerLabel}
                                            </p>
                                        )}
                                        {creditKind === "cooldown" && (
                                            <p className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: T.muted }}>
                                                <Info className="h-3.5 w-3.5 shrink-0" /> Credit declined · ask again after {fmtDate(creditStatus.cooldown_until)}
                                            </p>
                                        )}
                                        {creditAskError && (
                                            <p role="alert" className="flex items-start gap-1.5 text-[12.5px] font-bold leading-snug" style={{ color: "#B3261E" }}>
                                                <AlertCircle className="mt-[1px] h-3.5 w-3.5 shrink-0" /> <span>{creditAskError}</span>
                                            </p>
                                        )}
                                    </>
                                )}

                                {/* Row 4: actions */}
                                <div className="flex items-center gap-2.5">
                                    {!isSample && (
                                        <button type="button" onClick={handleAddToCart} aria-label="Add to cart" title="Add to cart"
                                            disabled={submitting || belowMoq || outOfStock || exceedsStock || priceLoading}
                                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-[opacity,transform] duration-100 active:scale-95 disabled:opacity-50"
                                            style={{ background: T.yellow, color: T.ink, boxShadow: "0 5px 12px rgba(255,214,10,0.45)" }}>
                                            <ShoppingCart className="h-5 w-5" strokeWidth={2.2} />
                                        </button>
                                    )}
                                    <button type="button" onClick={handlePrimary} disabled={ctaDisabled}
                                        className={primaryBtnBase} style={{ background: ctaBackground, boxShadow: ctaShadow }}>
                                        {submitting
                                            ? <Loader2 className="h-5 w-5 animate-spin" />
                                            : <>{ctaLabel}{selectedAddressId && <ArrowRight className="h-4 w-4" strokeWidth={2.6} />}</>}
                                    </button>
                                </div>
                            </div>
                        </footer>

                        {toast && (
                            <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4" role="status">
                                <span className="rounded-full bg-black px-4 py-2 text-[12.5px] font-bold text-white shadow-lg">{toast}</span>
                            </div>
                        )}
                    </>
                )}
            </motion.div>

            {/* Image lightbox: portalled above everything; clicks never bubble to the overlay. */}
            {lightboxSrc && createPortal(
                <div className="fixed inset-0 z-[1200]" onClick={(e) => e.stopPropagation()}>
                    <ImageLightbox src={lightboxSrc} alt="" onClose={() => setLightboxSrc(null)} />
                </div>,
                document.body
            )}
        </motion.div>
    );
}

// Self-contained: works whether or not a BuyerAddressProvider already wraps the app.
export default function BuyNowModal(props) {
    return (
        <BuyerAddressProvider>
            <BuyNowModalInner {...props} />
        </BuyerAddressProvider>
    );
}