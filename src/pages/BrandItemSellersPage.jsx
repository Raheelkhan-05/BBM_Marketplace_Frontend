// pages/BrandItemSellersPage.jsx
//
// Step 3 of the drill-down: sellers listing THIS exact brand item
// (seller_product_submissions, via catalog_brand_item_sellers so it can
// never leak a different variant's sellers in).
//
// REWRITE NOTE (this revision): this page previously ran its own,
// older seller-listing logic (relevance/price_asc/price_desc sort,
// flat price/unit display, red/teal branding, no GST toggle, no
// pack/master-pack breakdown, no login gating, no transport-preference
// flow). It's now brought in line with HomeProductFeed's inline
// SellerDropdown, which is the actively-maintained implementation:
// same three sort tabs (Min MOQ / Best price / Fastest delivery, with
// "Fastest delivery" only shown once we know the buyer's destination),
// same server-side sort for two of the three tabs, same GST-inclusive/
// exclusive toggle, same slab/discount price resolution, same
// unit/pack/master-pack price breakdown, same login-gated pricing
// block, and the same transport-preference-before-buy flow. Landing
// here from BrandItemDetailModal's "View X sellers" now shows ONLY
// this product and its sellers — nothing else from the catalog.
//
// If HomeProductFeed's pricing/seller helpers below ever change, this
// file needs the matching update — they're intentionally identical
// implementations (not imported from a shared module yet) so the
// inline dropdown and this full page can never quietly disagree on
// "what does this seller actually charge". Worth extracting to a
// shared /utils or /shared module the next time either one changes,
// rather than editing two copies.
//
// IMPORTANT: this file assumes `fetchBrandItemSellers` returns the
// richer commercial fields added to seller_product_submissions
// (price_slabs, quantity_discounts, stock_quantity, stock_type,
// dispatch_time_days, production_lead_time_days, gst_percent, hsn_code,
// payment_terms, return_policy, warranty, delivery_timeline,
// freight_included, dispatch_district/state/pincode, pack_size,
// units_per_master_pack, sample_*, total_delivery_days when a
// destination was passed). If your backend controller only selects the
// old flat columns, this still renders but silently falls back to "no
// slabs / no extra terms / no delivery estimate".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Truck, Boxes, Store, Layers, Lock, Zap, Package } from "lucide-react";
import { fetchBrandItemSellers, fetchBuyerAddresses } from "../utils/api";
import { fetchBuyerTransportPreference } from "../utils/api.transport.js";
import useInfiniteScrollSentinel from "../hooks/useInfiniteScrollSentinel";
import BuyNowModal from "../components/BuyNowModal";
import SellThisItemModal from "../components/catalog/SellThisItemModal";
import TransportPreferenceModal from "../components/transport/TransportPreferenceModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { deriveDisplayPrices, hasOuterPack, getSaleUnit } from "../shared/packUnits.js";

const C = {
    ink: "#0B1116", muted: "#667077", primary: "#000000", secondary: "#000000",
    hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)",
};
const EASE = [0.16, 1, 0.3, 1];
const PAGE_SIZE = 24;

// --- Same superset/mapping HomeProductFeed uses for its inline dropdown,
// kept identical on purpose (see file header). ---
const SELLER_SORT_OPTIONS = [
    { value: "min_moq", label: "Min MOQ" },
    { value: "best_price", label: "Best price" },
    { value: "fastest_delivery", label: "Fastest delivery" },
];

function sortModeToApiSort(sortMode) {
    if (sortMode === "min_moq") return "moq_asc";
    if (sortMode === "fastest_delivery") return "fastest_delivery";
    return "price_asc";
}

function inr(n) {
    const val = Number(n) || 0;
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function priceUnitLabel(masterPackSize) {
    return Number(masterPackSize) >= 1 ? "master pack" : "pack";
}

function resolveSlabUnitPrice(priceSlabs, quantity, fallbackPrice) {
    if (!Array.isArray(priceSlabs) || !priceSlabs.length) return fallbackPrice;
    const applicable = priceSlabs
        .filter((s) => Number(s.minQty) > 0 && quantity >= Number(s.minQty) && (!s.maxQty || quantity <= Number(s.maxQty)))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    return applicable.length ? Number(applicable[0].price) : fallbackPrice;
}
function resolveDiscountPercent(quantityDiscounts, quantity) {
    if (!Array.isArray(quantityDiscounts) || !quantityDiscounts.length) return 0;
    const applicable = quantityDiscounts
        .filter((d) => Number(d.minQty) > 0 && quantity >= Number(d.minQty))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty));
    return applicable.length ? Number(applicable[0].discountPercent) || 0 : 0;
}
function moqInSaleUnits(seller) {
    return Math.max(1, Number(seller.moq) || 1);
}

// Single source of truth for "what does this seller actually charge at
// qty X" — identical to HomeProductFeed's computeEffectivePricing.
function computeEffectivePricing(seller, saleQty, includeGst) {
    const gst = Number(seller.gst_percent) || 0;
    const pricePerSaleUnit = includeGst ? Number(seller.price) : Number(seller.price) / (1 + gst / 100);
    if (!(pricePerSaleUnit > 0)) return null;

    const slabPricePerSaleUnit = resolveSlabUnitPrice(seller.price_slabs, saleQty, pricePerSaleUnit);
    const discountPercent = resolveDiscountPercent(seller.quantity_discounts, saleQty);
    const finalPricePerSaleUnit = slabPricePerSaleUnit * (1 - discountPercent / 100);

    const orig = deriveDisplayPrices(slabPricePerSaleUnit, seller.pack_size, seller.units_per_master_pack);
    const fin = deriveDisplayPrices(finalPricePerSaleUnit, seller.pack_size, seller.units_per_master_pack);
    const outer = hasOuterPack(seller.units_per_master_pack);

    return {
        saleUnit: getSaleUnit(seller.units_per_master_pack), saleQty, discountPercent, hasMasterPack: outer,
        unit: { original: orig.perBaseUnit, final: fin.perBaseUnit },
        pack: { original: orig.perPack, final: fin.perPack },
        masterPack: outer ? { original: orig.perMasterPack, final: fin.perMasterPack } : null,
    };
}

// "Best price" only: search every real breakpoint (MOQ + every
// slab/discount minQty at or above it) for the lowest achievable price.
function candidateSaleQuantities(seller) {
    const moq = moqInSaleUnits(seller);
    const quantities = new Set([moq]);
    (seller.price_slabs || []).forEach((s) => { const q = Number(s.minQty); if (q >= moq) quantities.add(q); });
    (seller.quantity_discounts || []).forEach((d) => { const q = Number(d.minQty); if (q >= moq) quantities.add(q); });
    return Array.from(quantities).sort((a, b) => a - b);
}
function bestAchievablePricing(seller, includeGst) {
    const quantities = candidateSaleQuantities(seller);
    let best = null;
    for (const qty of quantities) {
        const pricing = computeEffectivePricing(seller, qty, includeGst);
        if (!pricing) continue;
        if (!best || pricing.pack.final < best.pack.final) best = pricing;
    }
    return best || computeEffectivePricing(seller, moqInSaleUnits(seller), includeGst);
}
function sellerPricingForMode(seller, sortMode, includeGst) {
    if (sortMode === "min_moq") return computeEffectivePricing(seller, moqInSaleUnits(seller), includeGst);
    return bestAchievablePricing(seller, includeGst); // best_price + fastest_delivery both show best-achievable pricing
}
function effectiveLeadTime(s) {
    return s.stock_type === "made_to_order" ? s.production_lead_time_days : s.dispatch_time_days;
}
function isOwnSellerRow(sellerRow, currentUserId) {
    if (!currentUserId) return false;
    const ownerId = sellerRow?.shop_slug ?? null;
    return ownerId != null && String(ownerId) === String(currentUserId);
}

// --- Small shared visual pieces, same as HomeProductFeed's ---

function GstToggle({ includeGst, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={includeGst}
            aria-label={`GST ${includeGst ? "included" : "excluded"}`}
            onClick={() => onChange(!includeGst)}
            className="group inline-flex items-center gap-2 rounded-full transition-all duration-200 focus:outline-none cursor-pointer"
        >
            <span
                className="relative flex h-5 w-10 shrink-0 items-center rounded-full p-0.5 transition-all duration-200"
                style={{ backgroundColor: includeGst ? C.secondary : "#D9DEE2" }}
            >
                <span
                    className="h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200"
                    style={{ transform: includeGst ? "translateX(20px)" : "translateX(0px)" }}
                />
            </span>
            <span className="flex flex-col items-start leading-none">
                <span className="text-[11px] font-bold tracking-[0.02em]" style={{ color: C.ink }}>GST</span>
                <span className="mt-0.5 text-[10px] font-medium tracking-wide" style={{ color: includeGst ? C.secondary : "#7B858C" }}>
                    {includeGst ? "Included" : "Excluded"}
                </span>
            </span>
        </button>
    );
}

function SellerSortToggle({ value, onChange, options }) {
    return (
        <div
            className="inline-flex w-fit gap-1 rounded-full p-0.5"
            style={{ background: C.hairSoft }}
        >
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className="rounded-full px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition-colors duration-150"
                    style={
                        value === opt.value
                            ? { background: C.secondary, color: "#fff" }
                            : { color: C.muted }
                    }
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function FreightPill({ included }) {
    return (
        <span
            className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-bold tracking-wide whitespace-nowrap"
            style={included ? { background: "#006F8314", color: "#006F83" } : { background: C.hairSoft, color: C.muted }}
        >
            <Truck className="h-2.5 w-2.5" strokeWidth={2.5} />
            {included ? "Freight included" : "Freight extra"}
        </span>
    );
}
function FastestBadge() {
    return (
        <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-bold tracking-wide whitespace-nowrap" style={{ background: "#00000010", color: C.ink }}>
            <Zap className="h-2.5 w-2.5" strokeWidth={2.5} /> Fastest
        </span>
    );
}

function SellerPriceBlock({ pricing, unit }) {
    if (!pricing) return null;
    const { discountPercent, hasMasterPack, unit: u, pack, masterPack } = pricing;
    const hasDiscount = discountPercent > 0;
    const rows = [
        unit ? { label: unit, ...u } : null,
        { label: "Pack", ...pack },
        hasMasterPack && masterPack ? { label: "M Pack", ...masterPack } : null,
    ].filter(Boolean);

    return (
        <div className="grid shrink-0 items-baseline gap-x-1.5 gap-y-0.5" style={{ gridTemplateColumns: "auto auto auto" }}>
            {rows.map((r) => (
                <div key={r.label} className="contents">
                    {hasDiscount && (
                        <span className="text-right text-[9.5px] font-semibold tabular-nums line-through" style={{ color: C.muted }}>
                            ₹{inr(r.original)}
                        </span>
                    )}
                    <span
                        className="whitespace-nowrap text-right text-[13.5px] font-extrabold tabular-nums"
                        style={{ color: hasDiscount ? C.secondary : C.ink, gridColumn: hasDiscount ? "auto" : "1 / span 2" }}
                    >
                        ₹{inr(r.final)}
                    </span>
                    <span className="whitespace-nowrap text-left text-[9.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                        /{r.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

// Same blurred/locked pricing block shown to logged-out visitors in the
// feed, so a shared link to this page behaves consistently with the feed.
function dummyPriceFor(seed) {
    const str = String(seed || "x");
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return 199 + (h % 4300);
}
function LockedPriceBlock({ seed, unit, onClick }) {
    const rows = [unit ? { label: unit, value: dummyPriceFor(seed + "u") } : null, { label: "Pack", value: dummyPriceFor(seed + "p") }].filter(Boolean);
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClick?.(); } }}
            aria-label="Login to view price"
            className="group flex min-w-[112px] cursor-pointer select-none flex-col items-end gap-1.5"
        >
            <div className="rounded-md px-2 py-1.5 transition-all duration-150 group-hover:bg-black/[0.018]">
                <div className="flex flex-col gap-1">
                    {rows.map((r) => (
                        <div key={r.label} className="grid items-baseline gap-x-1 leading-none" style={{ gridTemplateColumns: "10px minmax(42px, auto) 38px" }}>
                            <span className="text-[12px] font-extrabold" style={{ color: C.ink }}>₹</span>
                            <span className="min-w-0 whitespace-nowrap text-right text-[12px] font-extrabold tabular-nums" style={{ color: C.ink, filter: "blur(4.5px)", opacity: 0.55, userSelect: "none", pointerEvents: "none" }}>
                                {inr(r.value)}
                            </span>
                            <span className="whitespace-nowrap text-[9px] font-semibold tracking-[0.01em]" style={{ color: C.muted }}>/{r.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-[4px] text-[9.5px] font-extrabold leading-none tracking-wide whitespace-nowrap transition-all duration-150 group-hover:-translate-y-[1px]" style={{ color: "#000000", background: "#0000000D", border: "1px solid #00000028" }}>
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full">
                    <Lock className="h-2.5 w-2.5" strokeWidth={2.6} />
                </span>
                Login to view
            </span>
        </div>
    );
}

function LoginPromptModal({ open, message, onConfirm, onCancel }) {
    if (!open) return null;
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
            onClick={onCancel}
        >
            <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.18, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[320px] rounded-2xl bg-white p-5 shadow-xl"
            >
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#00000014" }}>
                    <Lock className="h-5 w-5" style={{ color: C.primary }} strokeWidth={2.5} />
                </div>
                <p className="text-center text-[14.5px] font-extrabold" style={{ color: C.ink }}>Login required</p>
                <p className="mt-1.5 text-center text-[12.5px] font-medium leading-snug" style={{ color: C.muted }}>
                    {message || "You need to login to view seller pricing and place an order."}
                </p>
                <div className="mt-5 flex gap-2">
                    <button onClick={onCancel} className="flex-1 rounded-xl border py-2.5 text-[12.5px] font-bold" style={{ borderColor: C.hair, color: C.ink }}>Cancel</button>
                    <button onClick={onConfirm} className="flex-1 rounded-xl py-2.5 text-[12.5px] font-bold text-white" style={{ background: C.primary }}>Login</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// --- Row ---

function SellerRow({ s, idx, sortMode, includeGst, isFastest, isOwn, isLoggedIn, onBuy, onRequireLogin, onViewShop }) {
    const pricing = sellerPricingForMode(s, sortMode, includeGst);
    const outOfStock = s.stock_type === "ready_stock" && Number(s.stock_quantity) <= 0;
    const totalDeliveryDays = s.total_delivery_days;
    const disabled = outOfStock || isOwn;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: Math.min(idx * 0.02, 0.2), ease: EASE }}
            layout
            role="button"
            tabIndex={0}
            onClick={() => !disabled && onBuy()}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !disabled) { e.preventDefault(); onBuy(); } }}
            aria-disabled={disabled}
            className="flex w-full items-start gap-3 border-b px-3 py-3.5 transition-colors duration-150 hover:bg-black/[0.02] sm:px-4"
            style={{ borderColor: C.hairSoft, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
        >

            <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold leading-tight tracking-wide" style={{ color: C.ink }}>
                    {s.display_name}{isOwn ? " (You)" : ""}
                </p>
                {(s.city || s.state) && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] font-medium tracking-wide" style={{ color: C.muted }}>
                        <MapPin className="h-3 w-3 shrink-0" /> {[s.city, s.state].filter(Boolean).join(", ")}
                    </p>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold tracking-wide" style={{ color: C.muted }}>
                    <span className="flex items-center gap-1" style={{ color: C.secondary }}>
                        <Boxes className="h-3 w-3" /> MOQ {s.moq} {priceUnitLabel(s.units_per_master_pack)}
                    </span>
                    {s.stock_quantity != null}
                    {totalDeliveryDays != null && <span>· ~{totalDeliveryDays}d delivery</span>}
                    {pricing?.discountPercent > 0 && (
                        <span>· {pricing.saleQty}+ {pricing.saleUnit}{pricing.saleQty === 1 ? "" : "s"}: {pricing.discountPercent}% off</span>
                    )}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <FreightPill included={s.freight_included} />
                    {isFastest && <FastestBadge />}
                </div>
                {s.delivery_timeline && (
                    <p className="mt-1.5 truncate text-[10.5px] font-medium" style={{ color: C.muted }}>Delivery: {s.delivery_timeline}</p>
                )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5 text-right">
                {outOfStock ? (
                    <span className="rounded-full px-2 py-1 text-[10px] font-extrabold tracking-wide" style={{ background: "#f1f1f1", color: C.muted }}>OUT OF STOCK</span>
                ) : !isLoggedIn ? (
                    <LockedPriceBlock seed={s.submission_id} unit={s.unit} onClick={onRequireLogin} />
                ) : (
                    <>
                        <SellerPriceBlock pricing={pricing} unit={s.unit} />
                        <span
                            role="button"
                            tabIndex={-1}
                            className="rounded-lg px-3 py-1.5 text-[11.5px] font-bold tracking-wide text-white"
                            style={{ background: C.primary }}
                        >
                            {isOwn ? "Your listing" : "Buy now"}
                        </span>
                    </>
                )}
            </div>
        </motion.div>
    );
}

function RowSkeleton() {
    return (
        <div className="flex items-center gap-3 border-b px-3 py-3.5 sm:px-4" style={{ borderColor: C.hairSoft }}>
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-2/5 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                <div className="h-2.5 w-1/3 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
            </div>
            <div className="h-4 w-14 shrink-0 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
        </div>
    );
}

// --- Page ---

export default function BrandItemSellersPage() {
    const { idOrSlug } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const brandItemHint = location.state?.brandItem;
    const category = location.state?.category;
    const brandItemId = brandItemHint?.id || idOrSlug;

    const { profile, token, effectiveLoggedIn, needsOnboarding } = useAuth();
    const currentUserId = profile?.shop_slug ?? null;
    const isLoggedIn = effectiveLoggedIn;

    const [sortMode, setSortMode] = useState("best_price");
    const [includeGst, setIncludeGst] = useState(true);
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState(null);

    const [buyerAddress, setBuyerAddress] = useState(null);
    const [transportFlow, setTransportFlow] = useState(null); // { seller, destAddressId, destCity, destState, removedNotice }
    const [buySeller, setBuySeller] = useState(null);
    const [sellOpen, setSellOpen] = useState(false);
    const [loginPrompt, setLoginPrompt] = useState(null);

    const abortRef = useRef(null);

    // Buyer's default address — drives the "Fastest delivery" tab and
    // the per-row delivery estimate, same as HomeProductFeed.
    useEffect(() => {
        if (!token) { setBuyerAddress(null); return; }
        let cancelled = false;
        fetchBuyerAddresses(token)
            .then((res) => {
                if (cancelled) return;
                const list = res?.addresses || [];
                setBuyerAddress(list.find((a) => a.is_default) || list[0] || null);
            })
            .catch(() => { if (!cancelled) setBuyerAddress(null); });
        return () => { cancelled = true; };
    }, [token]);

    useEffect(() => {
        if (sortMode === "fastest_delivery" && !(buyerAddress?.city && buyerAddress?.state)) {
            setSortMode("best_price");
        }
    }, [buyerAddress, sortMode]);

    const runQuery = useCallback((offset, { append, silent }) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        if (!append) (silent ? setIsRefreshing : setLoading)(true);
        else setLoadingMore(true);

        fetchBrandItemSellers(brandItemId, {
            sort: sortModeToApiSort(sortMode),
            limit: PAGE_SIZE,
            offset,
            destPincode: buyerAddress?.pincode || undefined,
            destState: buyerAddress?.state || undefined,
            signal: controller.signal,
            token,
        })
            .then((res) => {
                if (!res?.success) { setError("Couldn't load sellers."); return; }
                setError(null);
                setItems((prev) => (append ? [...prev, ...(res.items || [])] : res.items || []));
                setTotal(res.total ?? (res.items || []).length);
                setHasMore(!!res.hasMore);
            })
            .catch((err) => { if (err?.name !== "AbortError") { setError("Couldn't load sellers."); setHasMore(false); } })
            .finally(() => {
                setLoading(false);
                setIsRefreshing(false);
                setLoadingMore(false);
            });
    }, [brandItemId, sortMode, buyerAddress, token]);

    // Fresh load on brand item change.
    useEffect(() => { runQuery(0, { append: false, silent: false }); }, [brandItemId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Silent re-sort/re-fetch (rows stay visible) on tab switch or once
    // the buyer's address resolves — mirrors HomeProductFeed exactly.
    const isFirstSortRun = useRef(true);
    useEffect(() => {
        if (isFirstSortRun.current) { isFirstSortRun.current = false; return; }
        runQuery(0, { append: false, silent: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortMode, buyerAddress]);

    const sentinelRef = useInfiniteScrollSentinel(
        () => !loadingMore && hasMore && runQuery(items.length, { append: true }),
        { lookahead: 600, disabled: loading || loadingMore || !hasMore }
    );

    const hasKnownDestination = !!(buyerAddress?.city && buyerAddress?.state);
    const availableSortOptions = useMemo(
        () => (hasKnownDestination ? SELLER_SORT_OPTIONS : SELLER_SORT_OPTIONS.filter((o) => o.value !== "fastest_delivery")),
        [hasKnownDestination]
    );

    // "Best price" is sorted client-side over the loaded page, same
    // caveat as the inline dropdown (see HomeProductFeed file header).
    const sortedItems = useMemo(() => {
        if (!items.length || sortMode !== "best_price") return items;
        const withMeta = items.map((s) => ({ s, pricing: bestAchievablePricing(s, includeGst) }));
        withMeta.sort((a, b) => (a.pricing?.pack?.final ?? Infinity) - (b.pricing?.pack?.final ?? Infinity));
        return withMeta.map((x) => x.s);
    }, [items, sortMode, includeGst]);

    const fastestSubmissionId = useMemo(() => {
        if (sortMode !== "fastest_delivery" || !hasKnownDestination || !sortedItems.length) return null;
        return sortedItems[0]?.submission_id ?? null;
    }, [sortMode, hasKnownDestination, sortedItems]);

    const requireLogin = useCallback(
        (message) => setLoginPrompt({
            message: message || (needsOnboarding
                ? "Finish setting up your account to view seller pricing and place orders."
                : "You need to login to view seller pricing and place an order."),
        }),
        [needsOnboarding]
    );
    const confirmLogin = useCallback(() => { setLoginPrompt(null); navigate("/login"); }, [navigate]);
    const cancelLogin = useCallback(() => setLoginPrompt(null), []);

    // Same transport-preference-before-buy flow as HomeProductFeed.handleBuySeller.
    const handleBuySeller = async (seller) => {
        if (!effectiveLoggedIn) { requireLogin(); return; }
        if (!token) { requireLogin("You need to login to place an order with this seller."); return; }

        const addrRes = await fetchBuyerAddresses(token);
        const defaultAddr = addrRes?.addresses?.find((a) => a.is_default) || addrRes?.addresses?.[0];

        if (!defaultAddr?.city || !defaultAddr?.state) {
            setTransportFlow({ seller, destAddressId: defaultAddr?.id || null, destCity: null, destState: null, removedNotice: null });
            return;
        }

        const res = await fetchBuyerTransportPreference(seller.seller_id, defaultAddr.state, defaultAddr.city, token);

        if (res?.rejectedNotice) {
            setTransportFlow({
                seller, destAddressId: defaultAddr?.id || null,
                destCity: defaultAddr.city, destState: defaultAddr.state,
                removedNotice: `Your proposed transport option (${res.rejectedNotice.summary}) wasn't accepted by the seller.`,
            });
            return;
        }

        if (res?.success && !res.invalidated && (res.decided || res.pendingProposal)) {
            setBuySeller({
                ...seller,
                transportPreference: res.preference ? { ...res.preference, destCity: defaultAddr.city, destState: defaultAddr.state } : null,
                transportPendingProposal: res.pendingProposal ? { ...res.pendingProposal, destCity: defaultAddr.city, destState: defaultAddr.state } : null,
            });
            return;
        }

        setTransportFlow({
            seller, destAddressId: defaultAddr?.id || null,
            destCity: defaultAddr.city, destState: defaultAddr.state,
            removedNotice: res?.invalidated ? "The seller no longer offers your previously selected transport option." : null,
        });
    };

    const handleTransportResolved = (result) => {
        const { seller } = transportFlow;
        setTransportFlow(null);
        if (result?.pending) setBuySeller({ ...seller, transportPreference: null, transportPendingProposal: result });
        else setBuySeller({ ...seller, transportPreference: result, transportPendingProposal: null });
    };

    // Same row -> BuyNowModal payload mapping as HomeProductFeed.toBuyerSellerPayload.
    const buyerSellerPayload = buySeller && {
        offerId: buySeller.submission_id,
        sellerId: buySeller.seller_id,
        display_name: buySeller.display_name,
        unit: buySeller.unit,
        moq: buySeller.moq,
        price: buySeller.price,
        gstPercent: buySeller.gst_percent,
        availableStock: buySeller.stock_quantity ?? null,
        stockType: buySeller.stock_type,
        leadTime: effectiveLeadTime(buySeller),
        transportPreference: buySeller.transportPreference || null,
        transportPendingProposal: buySeller.transportPendingProposal || null,
        dispatchTimeDays: buySeller.dispatch_time_days,
        productionLeadTimeDays: buySeller.production_lead_time_days,
        priceSlabs: buySeller.price_slabs || [],
        quantityDiscounts: buySeller.quantity_discounts || [],
        paymentTerms: buySeller.payment_terms,
        returnPolicy: buySeller.return_policy,
        warranty: buySeller.warranty,
        deliveryTimeline: buySeller.delivery_timeline,
        freightIncluded: buySeller.freight_included,
        priceBasis: buySeller.price_basis,
        dispatchOrigin: [buySeller.dispatch_district, buySeller.dispatch_state].filter(Boolean).join(", ") || null,
        dispatchPincode: buySeller.dispatch_pincode,
        dispatchState: buySeller.dispatch_state,
        packSize: buySeller.pack_size,
        masterPackSize: buySeller.units_per_master_pack,
        sampleAvailable: buySeller.sample_available || false,
        sampleQuantity: buySeller.sample_quantity ?? null,
        samplePrice: buySeller.sample_price ?? null,
    };

    const alreadySelling = brandItemHint?.has_own_listing === true;
    const showFullSkeleton = loading && items.length === 0;

    return (
        <div className="min-h-screen bg-white">
            {/* Sticky header: back, product identity (only this product), GST toggle */}
            <div className="sticky top-0 z-20 border-b bg-white" style={{ borderColor: C.hair }}>
                <div className="mx-auto max-w-3xl px-3 pt-3 sm:px-4">
                    <div className="flex items-start gap-2.5 pb-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.05]"
                            aria-label="Back"
                        >
                            <ArrowLeft className="h-4 w-4" style={{ color: C.ink }} />
                        </button>

                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-[15.5px] font-extrabold leading-tight tracking-wide" style={{ color: C.ink }}>
                                {brandItemHint?.name || "Sellers"}
                            </h1>
                            <p className="truncate text-[11px] font-bold uppercase tracking-wider" style={{ color: "#006F83" }}>
                                {brandItemHint?.brand_name}{brandItemHint?.brand_name ? " · " : ""}
                                {showFullSkeleton ? "Loading…" : total != null ? `${total} seller${total === 1 ? "" : "s"} listing this` : ""}
                            </p>
                        </div>
                    </div>

                    {items.length > 1 && (
                        <div className="pb-3 flex gap-2 justify-between">
                            <SellerSortToggle value={sortMode} onChange={setSortMode} options={availableSortOptions} />
                            <GstToggle includeGst={includeGst} onChange={setIncludeGst} />
                        </div>
                    )}
                </div>
            </div>

            <div className="mx-auto max-w-3xl bg-white sm:my-3 sm:rounded-2xl sm:border" style={{ borderColor: C.hair, opacity: isRefreshing ? 0.7 : 1, transition: "opacity 0.15s ease" }}>
                {showFullSkeleton ? (
                    Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
                ) : error ? (
                    <p className="px-6 py-14 text-center text-[13px] font-semibold" style={{ color: C.muted }}>{error}</p>
                ) : sortedItems.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
                        <Store className="h-6 w-6" style={{ color: C.hair }} />
                        <p className="text-[13px] font-bold" style={{ color: C.ink }}>No sellers listing this right now</p>
                    </div>
                ) : (
                    <>
                        {sortedItems.map((s, i) => (
                            <SellerRow
                                key={s.submission_id}
                                s={s}
                                idx={i}
                                sortMode={sortMode}
                                includeGst={includeGst}
                                isFastest={fastestSubmissionId != null && s.submission_id === fastestSubmissionId}
                                isOwn={isOwnSellerRow(s, currentUserId)}
                                isLoggedIn={isLoggedIn}
                                onBuy={() => handleBuySeller(s)}
                                onRequireLogin={() => requireLogin("Login to view real seller pricing.")}
                                onViewShop={() => navigate(`/shop/${s.shop_slug}`)}
                            />
                        ))}
                        {loadingMore && <RowSkeleton />}
                    </>
                )}
                {hasMore && !loading && <div ref={sentinelRef} className="h-1" />}

                {!showFullSkeleton && !alreadySelling && (
                    <div className="p-3.5">
                        <button
                            onClick={() => (effectiveLoggedIn ? setSellOpen(true) : requireLogin("Login to list your own offer for this product."))}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-black bg-black px-3 py-2.5 text-[12.5px] font-bold tracking-wide text-white transition-colors duration-150 hover:bg-black/90"
                        >
                            <Store className="h-3.5 w-3.5" /> Sell this product
                        </button>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {loginPrompt && (
                    <LoginPromptModal open message={loginPrompt.message} onConfirm={confirmLogin} onCancel={cancelLogin} />
                )}
                {sellOpen && (
                    <SellThisItemModal brand={brandItemHint} onClose={() => setSellOpen(false)} />
                )}
                {buySeller && buyerSellerPayload && (
                    <BuyNowModal
                        seller={buyerSellerPayload}
                        product={{ name: brandItemHint?.name, brand_name: brandItemHint?.brand_name }}
                        onClose={() => setBuySeller(null)}
                    />
                )}
                {transportFlow && (
                    <TransportPreferenceModal
                        open
                        seller={{
                            offerId: transportFlow.seller.submission_id,
                            sellerId: transportFlow.seller.seller_id,
                            display_name: transportFlow.seller.display_name,
                        }}
                        destCity={transportFlow.destCity}
                        destState={transportFlow.destState}
                        removedNotice={transportFlow.removedNotice}
                        onClose={() => setTransportFlow(null)}
                        onResolved={handleTransportResolved}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}