// components/home/HomeProductFeed.jsx
//
// PRICE BREAKDOWN + GST TOGGLE:
// - The seller's stored `price` is the source of truth, always keyed to
//   whatever basis that seller sells in (per Pack, or per Master Pack when
//   masterPackSize >= 1 — same convention as priceUnitLabel/packagingLabel
//   already used). From that single number we derive the other two prices:
//   unit price, pack price, and master-pack price (when applicable).
// - That stored price is GST-inclusive by convention (confirmed by seller
//   at listing time, using that same listing's gst_percent). A single
//   toggle — replacing the old static "X products" label — switches the
//   whole feed (rows + open seller dropdown) between showing GST-inclusive
//   and GST-exclusive prices. Exclusive is derived by reversing the GST
//   percent on the stored (inclusive) price: excl = incl / (1 + gst/100).
// - All of this is pure client-side arithmetic on numbers already present
//   in the row/seller payload (or, for the feed rows, one added field
//   `lowest_price_gst_percent` — see catalog_browse SQL), so toggling is
//   instant with no refetch.
//
// DUPLICATE-FETCH GUARD:
// - React 18 StrictMode (dev only) intentionally mounts every component
//   twice — mount, cleanup, mount — to help surface effect bugs. Without a
//   guard, that means this feed's main fetch effect fires twice back to
//   back on first load: fetch A starts, then almost immediately fetch B
//   starts too, setting loading=true again and hiding the rows fetch A
//   just rendered — visible as a "flicker" a moment after the page loads.
//   `lastRunRef` remembers the (category, q) key + timestamp of the last
//   run; if the exact same key shows up again within DUPLICATE_GUARD_MS,
//   it's treated as a spurious re-invocation and skipped, so only one
//   request actually goes out. A genuine category/search change always
//   produces a different key, so this never blocks real navigation.
//
// "SELL THIS PRODUCT" SELF-LISTING GUARD:
// - The CTA at the bottom of the seller dropdown used to show up
//   unconditionally once the sellers fetch settled — including for a
//   seller who already has their own listing for that exact product,
//   where "Sell this product" makes no sense (they're already selling
//   it). Fixed by reading `item.has_own_listing` straight off the feed
//   row instead of scanning the (wallet-filtered) sellers list — see
//   catalog_browse in fix_wallet_hidden_sellers.sql.
//
// FASTEST DELIVERY / MIN MOQ SORTING (this revision):
// - The three seller-sort tabs — "Min MOQ", "Best price", "Fastest
//   delivery" — used to all be sorted CLIENT-SIDE, only over whichever
//   ~30 sellers happened to already be loaded. That meant the seller
//   shown as "fastest" (or lowest-MOQ) could silently change once more
//   sellers loaded in — wrong, and confusing for buyers.
// - FIXED: "Min MOQ" and "Fastest delivery" are now sorted SERVER-SIDE,
//   across the FULL set of matching sellers for that product, by
//   catalog_brand_item_sellers (see that SQL function's own comments).
//   The page we fetch here is therefore already correctly ordered, and
//   stays correctly ordered no matter how many more sellers get paged in
//   later — nothing needs to be, or should be, re-sorted in the browser
//   for these two tabs anymore.
// - "Best price" is UNCHANGED (still sorted client-side, over the loaded
//   page only) — it depends on quantity-discount/price-slab math that's
//   meaningfully more work to move into SQL safely, and was out of scope
//   for this fix. This is a known, currently-accepted limitation, not an
//   oversight — flagged here on purpose so it doesn't get "fixed" twice.
// - The "Fastest delivery" tab only appears once we know the buyer's
//   destination city/state (their saved default address) — otherwise the
//   backend has nothing to compute a delivery estimate against.
// - Refetching sellers ONLY happens when the buyer switches tabs, or when
//   their address becomes known after a dropdown was already open — never
//   silently in the background — so nothing reshuffles under someone
//   while they're reading the list.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Package, Info, Store, ShieldCheck, Loader2, Truck, Lock, Zap } from "lucide-react";
import { fetchBrandItemsFeed, fetchBrandItemSellers, fetchProductSearchMerged, fetchBuyerAddresses } from "../../utils/api";
import useInfiniteScrollSentinel from "../../hooks/useInfiniteScrollSentinel";
import ImageLightbox from "../ImageLightbox.jsx";
import BrandItemDetailModal from "../catalog/BrandItemDetailModal";
import SellThisItemModal from "../catalog/SellThisItemModal";
import BuyNowModal from "../BuyNowModal";
import { resizedImageUrl } from "../../utils/imageUrl";
import TransportPreferenceModal from "../transport/TransportPreferenceModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchBuyerTransportPreference } from "../../utils/api.transport.js";

const C = {
    ink: "#0B1116", muted: "#667077", primary: "#000000", secondary: "#000000",
    hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)", imgBg: "#F4F5F6",
};
const EASE = [0.16, 1, 0.3, 1];
// Fewer rows per page means fewer images requested on first paint (each
// row can carry a product image + a brand badge). Infinite scroll still
// tops the list up as the user scrolls.
const PAGE_SIZE = 12;
const SELLER_PAGE_SIZE = 30;
const DEBOUNCE_MS = 250;
// See "DUPLICATE-FETCH GUARD" note above.
const DUPLICATE_GUARD_MS = 300;

// Deterministic-but-fake price per item, so it doesn't jump around on
// re-render — never derived from the real price, purely cosmetic.
function dummyPriceFor(seed) {
    const str = String(seed || "x");
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return 199 + (h % 4300);
}

function inr(n) {
    const val = Number(n) || 0;
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// Same slab/discount resolution logic as BuyNowModal.js — kept in sync
// on purpose so "how much you'll actually pay" never disagrees between
// the feed dropdown and the checkout modal.
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

// Superset of every selectable tab. The caller (SellerDropdown) decides
// which subset is actually shown, based on whether we know the buyer's
// destination yet.
const SELLER_SORT_OPTIONS = [
    { value: "min_moq", label: "Min MOQ" },
    { value: "best_price", label: "Best price" },
    { value: "fastest_delivery", label: "Fastest delivery" },
];

// Maps our UI sort tab to the `sort` value the backend RPC understands.
// 'best_price' has no direct backend equivalent (it needs slab/discount
// math) — it fetches sorted by raw price as a reasonable base ordering,
// then gets refined further client-side (see sortedItems below).
function sortModeToApiSort(sortMode) {
    if (sortMode === "min_moq") return "moq_asc";
    if (sortMode === "fastest_delivery") return "fastest_delivery";
    return "price_asc";
}

function SellerSortToggle({ value, onChange, options = SELLER_SORT_OPTIONS }) {
    return (
        <div className="flex gap-1 rounded-full p-0.5" style={{ background: C.hairSoft }}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className="rounded-full px-2 py-1 text-[10px] font-bold tracking-wide transition-colors duration-150"
                    style={value === opt.value ? { background: C.secondary, color: "#fff" } : { color: C.muted }}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// Add near the top of the file, with the other small hooks/helpers:

// Tracks how many columns are active at the current breakpoint, matching
// the sm/lg breakpoints used elsewhere (1 col mobile, 2 col tablet, 3 col
// desktop). Needed because manual column-bucketing (below) can't respond
// to Tailwind breakpoints on its own — it has to know the count in JS.
function useResponsiveColumnCount() {
    const getCount = () => {
        if (typeof window === "undefined") return 1;
        if (window.innerWidth >= 1024) return 3; // lg
        if (window.innerWidth >= 640) return 2;  // sm
        return 1;
    };
    const [count, setCount] = useState(getCount);
    useEffect(() => {
        const onResize = () => setCount(getCount());
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    return count;
}

// Distributes items round-robin (item 0 → col 1, item 1 → col 2, item 2 →
// col 3, item 3 → col 1, ...) so reading order goes left-to-right across
// a row before wrapping — matches how a normal grid reads — while each
// column still renders as its own independent stack, so opening a
// dropdown never reflows sibling columns.
function bucketItemsByColumn(items, numCols) {
    const cols = Array.from({ length: numCols }, () => []);
    items.forEach((item, i) => {
        cols[i % numCols].push(item);
    });
    return cols;
}

function FreightPill({ included }) {
    return (
        <span
            className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-bold tracking-wide whitespace-nowrap"
            style={
                included
                    ? { background: `#006F8314`, color: "#006F83" }
                    : { background: C.hairSoft, color: C.muted }
            }
        >
            <Truck className="h-2.5 w-2.5" strokeWidth={2.5} />
            {included ? "Freight included" : "Freight extra"}
        </span>
    );
}

// Small badge marking the fastest seller when the "Fastest delivery" tab
// is active — purely visual.
function FastestBadge() {
    return (
        <span
            className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-bold tracking-wide whitespace-nowrap"
            style={{ background: "#00000010", color: C.ink }}
        >
            <Zap className="h-2.5 w-2.5" strokeWidth={2.5} />
            Fastest
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
                        <span className="text-[9.5px] text-right font-semibold tabular-nums line-through" style={{ color: C.muted }}>
                            ₹{inr(r.original)}
                        </span>
                    )}
                    <span
                        className="text-right text-[12.5px] font-extrabold tabular-nums whitespace-nowrap"
                        style={{ color: hasDiscount ? C.secondary : C.ink, gridColumn: hasDiscount ? "auto" : "1 / span 2" }}
                    >
                        ₹{inr(r.final)}
                    </span>
                    <span className="text-left text-[9px] font-semibold tracking-wide whitespace-nowrap" style={{ color: C.muted }}>
                        /{r.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

// Merges a new page of results into the existing list, dropping any
// item whose id is already present. Needed because offset-based
// pagination can hand back an id that's already on screen — most
// commonly when a debounced search re-query (reset to page 0) races
// with an in-flight infinite-scroll append (page 2 of the PREVIOUS
// query), or when the underlying filtered set shifts between two
// fetches. React requires unique keys regardless of why a dup shows
// up, so this is the actual fix rather than a workaround.
function mergeUnique(prev, incoming) {
    const seen = new Set(prev.map((it) => it.id));
    const deduped = incoming.filter((it) => {
        if (seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
    });
    return [...prev, ...deduped];
}

// Whether this listing's price is priced per Pack or per Master Pack.
// masterPackSize >= 1 means a master pack applies; otherwise it's per Pack.
function priceUnitLabel(masterPackSize) {
    return Number(masterPackSize) >= 1 ? "master pack" : "pack";
}

function packagingLabel(packSize, masterPackSize, unit) {
    const pack = Number(packSize) || 0;
    const master = Number(masterPackSize) || 0;

    if (!pack || !unit) return null;

    if (master > 1) {
        return `1 Master Pack = ${master} Packs = ${master * pack} ${unit}`;
    }

    return `1 Pack = ${pack} ${unit}`;
}

// Premium locked pricing component
// Render as div so it is safe to nest inside cards / rows / clickable containers.
function LockedPriceBlock({ seed, unit, size = "row", onClick }) {
    const rows = [
        unit ? { label: unit, value: dummyPriceFor(seed + "u") } : null,
        { label: "Pack", value: dummyPriceFor(seed + "p") },
    ].filter(Boolean);

    const isCompact = size !== "row";

    const valueClass = isCompact
        ? "text-[11.5px]"
        : "text-[12px]";

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onClick?.();
                }
            }}
            aria-label="Login to view price"
            className="
                group
                flex
                min-w-[112px]
                flex-col
                items-end
                gap-1.5
                cursor-pointer
                select-none
            "
        >
            {/* Pricing area */}
            <div
                className="
                    rounded-md
                    px-2
                    py-1.5
                    transition-all
                    duration-150
                    group-hover:bg-black/[0.018]
                "
            >
                <div className="flex flex-col gap-[4px]">
                    {rows.map((r) => (
                        <div
                            key={r.label}
                            className="
                                grid
                                items-baseline
                                gap-x-1
                                leading-none
                            "
                            style={{
                                gridTemplateColumns:
                                    "10px minmax(42px, auto) 38px",
                            }}
                        >
                            {/* Currency */}
                            <span
                                className={`${valueClass} font-extrabold`}
                                style={{ color: C.ink }}
                            >
                                ₹
                            </span>

                            {/* Protected amount */}
                            <span
                                className={`
                                    ${valueClass}
                                    min-w-0
                                    text-right
                                    whitespace-nowrap
                                    font-extrabold
                                    tabular-nums
                                `}
                                style={{
                                    color: C.ink,
                                    filter: "blur(4.5px)",
                                    opacity: 0.55,
                                    userSelect: "none",
                                    pointerEvents: "none",
                                }}
                            >
                                {inr(r.value)}
                            </span>

                            {/* Unit */}
                            <span
                                className="
                                    text-[9px]
                                    font-semibold
                                    tracking-[0.01em]
                                    whitespace-nowrap
                                "
                                style={{ color: C.muted }}
                            >
                                /{r.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Login CTA */}
            <span
                className="
                    inline-flex
                    items-center
                    gap-1.5
                    rounded-md
                    px-2.5
                    py-[4px]
                    text-[9.5px]
                    font-extrabold
                    leading-none
                    tracking-wide
                    whitespace-nowrap
                    transition-all
                    duration-150
                    group-hover:-translate-y-[1px]
                "
                style={{
                    color: "#000000",
                    background: `#0000000D`,
                    border: `1px solid #00000028`,
                }}
            >
                <span
                    className="
                        flex
                        h-3.5
                        w-3.5
                        items-center
                        justify-center
                        rounded-full
                    "
                >
                    <Lock
                        className="h-2.5 w-2.5"
                        strokeWidth={2.6}
                    />
                </span>

                Login to view
            </span>
        </div>
    );
}

// Compact, reusable price-breakdown block — shows whichever of
// unit/pack/master-pack prices are available, smallest to largest.
// `align` controls whether it's left- or right-aligned (rows want
// right-aligned in the price column; seller dropdown rows want the
// same but slightly denser).
function PriceBreakdown({ breakdown, unit, size = "row" }) {
    if (!breakdown) return null;
    const { unitPrice, packPrice, masterPackPrice, hasMasterPack } = breakdown;

    const rows = [
        unitPrice != null && unit ? { label: unit, value: unitPrice } : null,
        packPrice != null ? { label: "Pack", value: packPrice } : null,
        hasMasterPack && masterPackPrice != null ? { label: "M Pack", value: masterPackPrice } : null,
    ].filter(Boolean);

    if (!rows.length) return null;

    const isRow = size === "row";
    const valueClass = isRow
        ? "text-[12px] font-extrabold tabular-nums"
        : "text-[11.5px] font-extrabold tabular-nums";
    const labelClass = "text-[9px] font-semibold tracking-wide";

    return (
        <div className="grid items-baseline gap-x-1 gap-y-0.5" style={{ gridTemplateColumns: "auto auto" }}>
            {rows.map((r) => (
                <div key={r.label} className="contents">
                    <span className={`${valueClass} text - right whitespace - nowrap`} style={{ color: C.ink }}>
                        ₹{inr(r.value)}
                    </span>
                    <span className={`${labelClass} text - left whitespace - nowrap`} style={{ color: C.muted }}>
                        /{r.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

// Same lead-time rule BuyNowModal/BrandItemSellersPage use.
function effectiveLeadTime(s) {
    return s.stock_type === "made_to_order" ? s.production_lead_time_days : s.dispatch_time_days;
}

function BrandBadge({ name, image }) {
    if (!name) return null;
    const initials = name.trim().slice(0, 2).toUpperCase();
    return image ? (
        <img
            src={resizedImageUrl(image, { width: 128 })}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-6 w-auto shrink-0 rounded-full object-cover"
        />
    ) : (
        <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8.5px] font-extrabold leading-none"
            style={{ background: `${C.secondary} 18`, color: C.secondary }}
        >
            {initials}
        </span>
    );
}

// Maps a raw seller row (from catalog_brand_item_sellers) onto exactly
// what BuyNowModal expects — identical mapping to BrandItemSellersPage's
// buyerSellerPayload, kept in sync so the inline flow and the full
// sellers-page flow never drift apart.
function toBuyerSellerPayload(s) {
    return {
        offerId: s.submission_id,
        sellerId: s.seller_id,
        display_name: s.display_name,
        unit: s.unit,
        moq: s.moq,
        price: s.price,
        gstPercent: s.gst_percent,
        availableStock: s.stock_quantity ?? null,
        stockType: s.stock_type,
        leadTime: effectiveLeadTime(s),
        transportPreference: s.transportPreference || null,
        transportPendingProposal: s.transportPendingProposal || null,
        dispatchTimeDays: s.dispatch_time_days,
        productionLeadTimeDays: s.production_lead_time_days,
        priceSlabs: s.price_slabs || [],
        quantityDiscounts: s.quantity_discounts || [],
        // hsnCode: s.hsn_code,
        paymentTerms: s.payment_terms,
        returnPolicy: s.return_policy,
        warranty: s.warranty,
        deliveryTimeline: s.delivery_timeline,
        freightIncluded: s.freight_included,
        transportOptions: s.seller_profiles?.transport_options || [],
        priceBasis: s.price_basis,
        dispatchOrigin: [s.dispatch_district, s.dispatch_state].filter(Boolean).join(", ") || null,
        dispatchPincode: s.dispatch_pincode,
        dispatchState: s.dispatch_state,
        packSize: s.pack_size,
        masterPackSize: s.units_per_master_pack,
        sampleAvailable: s.sample_available || false,
        sampleQuantity: s.sample_quantity ?? null,
        samplePrice: s.sample_price ?? null,
    };
}

// Whether a given seller row (from the sellers dropdown) belongs to the
// signed-in user — used only to label/disable a row "(You)" within the
// loaded sellers list. NOT used to decide whether the "Sell this product"
// CTA shows — see item.has_own_listing for that (SellerDropdown below),
// since this list is wallet-filtered and can omit the signed-in seller's
// own row entirely.
function isOwnSellerRow(sellerRow, currentUserId) {
    if (!currentUserId) return false;
    const ownerId = sellerRow?.shop_slug ?? null;
    return ownerId != null && String(ownerId) === String(currentUserId);
}

// Stable sort: items with an actual seller (lowest_price present) float
// to the top; order within each group (has-sellers / no-sellers) is
// left untouched, since Array.prototype.sort in modern JS engines is
// stable and we're only comparing a boolean, never index math.
function sortBySellerAvailability(list) {
    return [...list].sort((a, b) => {
        const aHas = a.lowest_price != null ? 0 : 1;
        const bHas = b.lowest_price != null ? 0 : 1;
        return aHas - bHas;
    });
}

function ProductImage({ src, alt, onOpen, priority = false }) {
    const [failed, setFailed] = useState(false);
    if (!src || failed) return <Package className="h-4.5 w-4.5" style={{ color: C.muted }} />;
    return (
        <img
            // Displayed at 64px (h-16 w-16) — 128px covers retina without
            // shipping a multi-megabyte original for a thumbnail.
            src={resizedImageUrl(src, { width: 256 })}
            alt={alt}
            referrerPolicy="no-referrer"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onError={() => setFailed(true)}
            onClick={(e) => { e.stopPropagation(); onOpen(src); }}
            className="h-full w-full object-cover cursor-zoom-in"
        />
    );
}

// GST toggle — replaces the old static "X products" label at the top of
// the feed. Purely a local UI switch; all price math it drives is
// recomputed client-side (useMemo), so flipping it is instant.
function GstToggle({ includeGst, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={includeGst}
            aria-label={`GST ${includeGst ? "included" : "excluded"} `}
            onClick={() => onChange(!includeGst)}
            className="group inline-flex items-center gap-2.5 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer"

        >
            {/* Switch */}
            <span
                className="relative flex h-5 w-10 shrink-0 items-center rounded-full p-0.5 transition-all duration-200"
                style={{
                    backgroundColor: includeGst ? C.secondary : "#D9DEE2",
                }}
            >
                <span
                    className="h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200"
                    style={{
                        transform: includeGst
                            ? "translateX(20px)"
                            : "translateX(0px)",
                    }}
                />
            </span>

            {/* Label */}
            <span className="flex min-w-[48px] flex-col items-start leading-none">
                <span
                    className="text-[11px] font-bold tracking-[0.02em]"
                    style={{ color: C.ink }}
                >
                    GST
                </span>

                <span
                    className="mt-0.5 text-[10px] font-medium tracking-wide"
                    style={{
                        color: includeGst ? C.secondary : "#7B858C",
                    }}
                >
                    {includeGst ? "Included" : "Excluded"}
                </span>
            </span>
        </button>
    );
}

// A category/subcategory literally named "Pending" is a placeholder bucket
// for not-yet-classified items — never meant to be shown to a shopper.
// Blank it out here rather than displaying it, same treatment as
// CategoryStrip's isHiddenCategory.
function isHiddenLabel(name) {
    return typeof name === "string" && name.trim().toLowerCase() === "pending";
}

function ProductRow({ item, idx, isOpen, onToggle, onInfo, onImageOpen, includeGst, animateEntrance, isLoggedIn, onRequireLogin }) {

    const subLabel = [item.brand_name, item.model_no].filter(Boolean).join(" · ");
    const categoryLabel = isHiddenLabel(item.category_name) ? null : item.category_name;
    const subcategoryLabel = isHiddenLabel(item.subcategory_name) ? null : item.subcategory_name;

    const packaging = packagingLabel(
        item.lowest_price_pack_size,
        item.lowest_price_master_pack_size,
        item.lowest_price_unit
    );

    const toTitleCase = (str = "") =>
        str
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());

    const isOutOfStock = item.lowest_price_stock_type === "ready_stock"
        && item.lowest_price_available_stock != null
        && Number(item.lowest_price_available_stock) <= 0;

    // Recomputed only when the underlying price fields or the GST toggle
    // change — cheap pure arithmetic, so this stays effectively instant.
    const breakdown = useMemo(() => {
        if (item.lowest_price == null) return null;
        return computePriceBreakdown({
            price: item.lowest_price,
            packSize: item.lowest_price_pack_size,
            masterPackSize: item.lowest_price_master_pack_size,
            gstPercent: item.lowest_price_gst_percent,
            includeGst,
            isCustomPriced: item.lowest_price_is_custom,
        });
    }, [item.lowest_price, item.lowest_price_pack_size, item.lowest_price_master_pack_size, item.lowest_price_gst_percent, item.lowest_price_is_custom, includeGst]);

    return (
        <motion.div
            initial={animateEntrance ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.2,
                delay: animateEntrance ? Math.min(idx * 0.012, 0.18) : 0,
                ease: EASE,
            }}
            className="grid w-full grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-4 min-h-[7.5rem]"

            style={{
                background: isOpen ? C.hairSoft : "transparent",
                opacity: isOutOfStock ? 0.5 : 1,
            }}
        >
            {/* COL 1 — IMAGE */}
            <div className="flex h-full items-center justify-center">
                <span
                    className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
                    style={{
                        borderColor: C.hair,
                        background: C.imgBg,
                    }}
                >
                    <ProductImage
                        src={item.image}
                        alt=""
                        onOpen={onImageOpen}
                        priority={idx < 3}
                    />
                </span>
            </div>

            {/* COL 2 — PRODUCT INFO + PACKAGING */}
            <div
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                role="button"
                tabIndex={0}
                className="min-w-0 cursor-pointer text-left min-h-[5rem] flex flex-col justify-center"
            >

                <p
                    className="min-w-0 text-[14px] font-bold leading-tight tracking-wide sm:line-clamp-3 md:line-clamp-2"
                    style={{ color: C.ink }}
                >
                    {toTitleCase(item.name)}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onInfo();
                        }}
                        aria-label="Product details"
                        className="ml-1 inline-flex h-3.5 w-3.5 shrink-0 -translate-y-px items-center justify-center rounded-full align-middle transition-colors hover:bg-black/[0.05]"
                    >
                        <Info className="h-3 w-3" style={{ color: C.muted }} />
                    </button>
                </p>
                <p
                    className="mt-0.5 flex min-w-0 items-center gap-1 truncate uppercase text-[11.5px] font-bold tracking-wider"
                    style={{ color: "#006F83" }}
                >
                    <BrandBadge name={item.brand_name} image={item.brand_image} />
                    <span className="truncate">{subLabel}</span>
                </p>

                <p
                    className="mt-0.5 truncate text-[10.5px] font-medium tracking-wide"
                    style={{ color: C.muted }}
                >
                    {categoryLabel
                        ? `${categoryLabel} · `
                        : ""}
                    {subcategoryLabel}
                </p>

                {/* Reserve the packaging line's height even when there's no
        packaging string, so rows with/without it match. */}
                <p
                    className="mt-1 text-[10px] sm:text-[11px] md:text-[11.5px] font-semibold leading-tight tracking-wide min-h-[1.2em]"
                    style={{ color: C.secondary }}
                >
                    {packaging || "\u00A0"}
                </p>
            </div>

            {/* COL 3 — PRICE BREAKDOWN (unit / pack / master pack) */}
            <div
                role="button"
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
                aria-label={isOpen ? "Collapse sellers" : "Expand sellers"}
                className="flex h-full shrink-0 flex-col items-end justify-center gap-1 text-right cursor-pointer"
            >
                {isOutOfStock ? (
                    <span className="rounded-full px-2 py-1 text-[10px] font-extrabold tracking-wide" style={{ background: "#f1f1f1", color: C.muted }}>
                        OUT OF STOCK
                    </span>
                ) : !isLoggedIn ? (
                    <LockedPriceBlock seed={item.id} unit={item.lowest_price_unit} size="row" onClick={onRequireLogin} />
                ) : (
                    <>
                        {breakdown && (
                            <span className="text-[10px] font-semibold uppercase leading-tight tracking-wider" style={{ color: C.muted }}>from</span>
                        )}
                        <PriceBreakdown breakdown={breakdown} unit={item.lowest_price_unit} size="row" />
                    </>
                )}
            </div>
        </motion.div>
    );
}

import { deriveDisplayPrices, hasOuterPack, getSaleUnit } from "../../shared/packUnits.js";


function computePriceBreakdown({ price, packSize, masterPackSize, gstPercent, includeGst, isCustomPriced }) {
    const sourcePrice = Number(price);
    if (!(sourcePrice > 0)) return null;
    const gst = Number(gstPercent) || 0;
    const priceExGst = includeGst ? sourcePrice : sourcePrice / (1 + gst / 100);
    const { perBaseUnit, perPack, perMasterPack } = deriveDisplayPrices(priceExGst, packSize, masterPackSize);
    return {
        unitPrice: perBaseUnit, packPrice: perPack, masterPackPrice: perMasterPack,
        hasMasterPack: hasOuterPack(masterPackSize), basis: getSaleUnit(masterPackSize),
        isCustomPriced: !!isCustomPriced,
    };
}

// Single source of truth for "what does this seller actually charge at qty X",
// used by BOTH tabs so there's never a second, diverging implementation.
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

function moqInSaleUnits(seller) {
    return Math.max(1, Number(seller.moq) || 1);
}

// "Best price" tab only: search every real breakpoint (MOQ + every
// slab/discount minQty at or above it) and surface whichever gives the
// lowest actual price. This is the piece deliberately NOT moved into SQL
// in this revision — see the file header note on why.
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
                <div
                    className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full"
                    style={{ background: `${C.primary} 14` }}
                >
                    <Lock className="h-5 w-5" style={{ color: C.primary }} strokeWidth={2.5} />
                </div>
                <p className="text-center text-[14.5px] font-extrabold" style={{ color: C.ink }}>
                    Login required
                </p>
                <p className="mt-1.5 text-center text-[12.5px] font-medium leading-snug" style={{ color: C.muted }}>
                    {message || "You need to login to view seller pricing and place an order."}
                </p>
                <div className="mt-5 flex gap-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 rounded-xl border py-2.5 text-[12.5px] font-bold"
                        style={{ borderColor: C.hair, color: C.ink }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 rounded-xl py-2.5 text-[12.5px] font-bold text-white"
                        style={{ background: C.primary }}
                    >
                        Login
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function sellerPricingForMode(seller, sortMode, includeGst) {
    if (sortMode === "min_moq") {
        return computeEffectivePricing(seller, moqInSaleUnits(seller), includeGst);
    }
    return bestAchievablePricing(seller, includeGst); // "best_price" and "fastest_delivery" both show effective-at-MOQ-style pricing here
}

// Inline seller accordion. `state` is { loading, items, error, total,
// hasMore } for this item's fetch — items already arrive from the
// backend correctly ordered for whichever `sortMode` was requested (see
// loadSellersFor in the parent). `buyerAddress` drives whether the
// "Fastest delivery" tab is even shown, and is what total_delivery_days
// on each seller row was computed against.
function SellerDropdown({ item, state, onBuySeller, onSell, includeGst, sortMode, onSortModeChange, currentUserId, onRequireLogin, isLoggedIn, buyerAddress }) {
    const { loading, items = [], error, total = 0, hasMore } = state || {};

    const hasKnownDestination = !!(buyerAddress?.city && buyerAddress?.state);
    const availableSortOptions = useMemo(
        () => (hasKnownDestination ? SELLER_SORT_OPTIONS : SELLER_SORT_OPTIONS.filter((o) => o.value !== "fastest_delivery")),
        [hasKnownDestination]
    );

    // "Min MOQ" and "Fastest delivery" arrive from the backend ALREADY
    // correctly ordered across the full seller pool (see
    // catalog_brand_item_sellers) — re-sorting them here would only ever
    // re-sort the current page, which is exactly the bug we're fixing.
    // Only "Best price" still needs a client-side pass, since it depends
    // on slab/discount math not yet moved into SQL.
    const sortedItems = useMemo(() => {
        if (!items.length) return items;
        if (sortMode !== "best_price") return items;

        const withMeta = items.map((s) => ({ s, pricing: bestAchievablePricing(s, includeGst) }));
        withMeta.sort((a, b) => {
            const av = a.pricing?.pack?.final ?? Infinity;
            const bv = b.pricing?.pack?.final ?? Infinity;
            return av - bv;
        });
        return withMeta.map((x) => x.s);
    }, [items, sortMode, includeGst]);

    // The first row IS the fastest, since the backend already sorted by
    // total_delivery_days across every seller before this page was cut.
    const fastestSubmissionId = useMemo(() => {
        if (sortMode !== "fastest_delivery" || !hasKnownDestination || !sortedItems.length) return null;
        return sortedItems[0]?.submission_id ?? null;
    }, [sortMode, hasKnownDestination, sortedItems]);

    // CHANGED: source of truth is now item.has_own_listing (computed
    // server-side in catalog_browse via p_seller_id, deliberately NOT
    // gated on wallet balance) instead of scanning `items` for the
    // signed-in seller's own row. That scan used to silently fail once a
    // wallet-blocked seller's own row got excluded from `items` by the
    // same wallet filter — making the CTA reappear for the one seller it
    // must never show for.
    const alreadySelling = item?.has_own_listing === true;

    return (
        <motion.div
            key="dropdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
        >
            <div
                data-lenis-prevent
                className="border-b px-3 py-2.5 sm:px-4"
                style={{ borderColor: C.hairSoft, background: "#FCFBF9" }}
            >
                <div className="flex flex-nowrap items-center justify-between gap-2 pb-2 overflow-x-auto">
                    <span className="whitespace-nowrap text-[11px] font-bold tracking-wider" style={{ color: C.muted }}>
                        {loading ? "Loading sellers…" : total > 0 ? `${total} seller${total === 1 ? "" : "s"} listing this` : "No sellers yet"}
                    </span>

                    {!loading && items.length > 1 && (
                        <SellerSortToggle value={sortMode} onChange={onSortModeChange} options={availableSortOptions} />
                    )}
                </div>

                <div
                    className="max-h-64 overflow-y-auto overscroll-contain seller-scroll"
                    style={{ scrollbarGutter: "stable" }}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {loading ? (
                            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                <div className="flex flex-col divide-y" style={{ borderColor: C.hairSoft }}>
                                    <div className="flex items-center justify-between gap-3 py-3">
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <div className="h-2.5 w-32 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                                            <div className="h-2 w-24 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                                        </div>
                                        <div className="shrink-0 space-y-1.5 text-right">
                                            <div className="ml-auto h-2.5 w-12 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                                            <div className="ml-auto h-2 w-8 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : error ? (
                            <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                                className="py-3 text-center text-[12px] font-semibold" style={{ color: C.muted }}>
                                {error}
                            </motion.p>
                        ) : sortedItems.length === 0 ? (
                            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                                className="py-3 text-center text-[12px] font-semibold" style={{ color: C.muted }}>
                                No sellers listing this yet.
                            </motion.p>
                        ) : (
                            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                <div className="flex flex-col divide-y" style={{ borderColor: C.hairSoft }}>
                                    {sortedItems.map((s) => {
                                        const pricing = sellerPricingForMode(s, sortMode, includeGst);
                                        const outOfStock = s.stock_type === "ready_stock" && Number(s.stock_quantity) <= 0;
                                        const isOwn = isOwnSellerRow(s, currentUserId);
                                        const totalDeliveryDays = s.total_delivery_days;
                                        console.log("totalDeliveryDays", totalDeliveryDays);

                                        const isFastest = fastestSubmissionId != null && s.submission_id === fastestSubmissionId;
                                        return (
                                            <div
                                                key={s.submission_id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => !outOfStock && !isOwn && onBuySeller(s)}
                                                onKeyDown={(e) => {
                                                    if ((e.key === "Enter" || e.key === " ") && !outOfStock && !isOwn) { e.preventDefault(); onBuySeller(s); }
                                                }}
                                                aria-disabled={outOfStock || isOwn}
                                                className="flex items-center justify-between gap-3 py-3 text-left transition-colors duration-150 hover:bg-black/[0.03] cursor-pointer"
                                                style={outOfStock || isOwn ? { opacity: 0.45, cursor: "not-allowed", pointerEvents: "none" } : undefined}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>
                                                        {s.display_name}{isOwn ? " (You)" : ""}
                                                    </p>
                                                    <p className="mt-0.5 truncate text-[10.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                                        {s.moq ? `MOQ ${s.moq} ${priceUnitLabel(s.units_per_master_pack)} ` : priceUnitLabel(s.units_per_master_pack)}
                                                        {/* {effectiveLeadTime(s) != null ? ` · ${effectiveLeadTime(s)}d lead` : ""} */}
                                                        {totalDeliveryDays != null ? ` · ~${totalDeliveryDays}d delivery` : ""}
                                                        {pricing?.discountPercent > 0
                                                            ? ` · ${pricing.saleQty}+ ${pricing.saleUnit}${pricing.saleQty === 1 ? "" : "s"}: ${pricing.discountPercent}% off`
                                                            : ""}
                                                    </p>
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                        <FreightPill included={s.freight_included} />
                                                        {isFastest && <FastestBadge />}
                                                    </div>
                                                </div>

                                                {outOfStock ? (
                                                    <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold tracking-wide" style={{ background: "#f1f1f1", color: C.muted }}>
                                                        OUT OF STOCK
                                                    </span>
                                                ) : !isLoggedIn ? (
                                                    <LockedPriceBlock seed={s.submission_id} unit={s.unit} size="pack" onClick={onRequireLogin} />
                                                ) : (
                                                    <SellerPriceBlock pricing={pricing} unit={s.unit} />
                                                )}
                                            </div>
                                        );
                                    })}
                                    {hasMore && (
                                        <p className="pt-2 text-center text-[11px] font-semibold" style={{ color: C.muted }}>
                                            +{Math.max(total - items.length, 0)} more sellers
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {!loading && !alreadySelling && (
                    <button
                        onClick={onSell}
                        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-black bg-black px-3 py-2 text-[12.5px] font-bold tracking-wide text-white transition-colors duration-150 hover:bg-black/90"
                    >
                        <Store className="h-3.5 w-3.5" /> Sell this product
                    </button>
                )}
            </div>
        </motion.div>
    );
}

function RowSkeleton() {
    return (
        <div className="flex items-center gap-3 border-b px-3 py-3 sm:px-4" style={{ borderColor: C.hairSoft }}>
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl" style={{ background: C.hairSoft }} />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-2/5 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                <div className="h-2.5 w-1/4 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
            </div>
            <div className="h-3.5 w-14 shrink-0 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
        </div>
    );
}

// `q` is optional — pages that don't pass it (or pass "") get the exact
// same unfiltered behavior as before. Passing it wires up live search.
export default function HomeProductFeed({ category, q = "" }) {
    const navigate = useNavigate();
    const { profile, token, effectiveLoggedIn, needsOnboarding } = useAuth();
    const currentUserId = profile?.shop_slug ?? null;
    const [items, setItems] = useState([]);
    const seenItemIdsRef = useRef(new Set());
    const [total, setTotal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [infoItemId, setInfoItemId] = useState(null);

    const [sellerSortMode, setSellerSortMode] = useState("best_price");

    const [includeGst, setIncludeGst] = useState(true);

    // The buyer's default saved address — used to power the "Fastest
    // delivery" sort tab, and to compute a delivery estimate to display
    // on every seller row regardless of active tab. Fetched once per
    // session/token change, not per product row.
    const [buyerAddress, setBuyerAddress] = useState(null);
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

    // If the buyer's address becomes unavailable (logged out, fetch
    // failed) while "Fastest delivery" was selected, fall back to a mode
    // that still makes sense.
    useEffect(() => {
        if (sellerSortMode === "fastest_delivery" && !(buyerAddress?.city && buyerAddress?.state)) {
            setSellerSortMode("best_price");
        }
    }, [buyerAddress, sellerSortMode]);

    const [openItemId, setOpenItemId] = useState(null);
    const [sellerState, setSellerState] = useState({});
    const sellerAbortRef = useRef(null);

    const [transportFlow, setTransportFlow] = useState(null); // { item, seller }

    const [sellItem, setSellItem] = useState(null);
    const [buyState, setBuyState] = useState(null); // { item, seller }

    const [loginPrompt, setLoginPrompt] = useState(null);
    const isLoggedIn = effectiveLoggedIn;

    const requireLogin = useCallback(
        () => setLoginPrompt({
            message: needsOnboarding
                ? "Finish setting up your account to view seller pricing and place orders."
                : "You need to login to view seller pricing and place an order.",
        }),
        [needsOnboarding]
    );
    const confirmLogin = useCallback(() => { setLoginPrompt(null); navigate("/login"); }, [navigate]);
    const cancelLogin = useCallback(() => setLoginPrompt(null), []);


    const abortRef = useRef(null);
    const debounceRef = useRef(null);
    const queryTokenRef = useRef(0);
    const isFirstRun = useRef(true);
    const lastRunRef = useRef({ key: null, time: 0 });

    const [highlightedItemId, setHighlightedItemId] = useState(null);
    const rowRefs = useRef({});
    const highlightTimeoutRef = useRef(null);

    // Fetches sellers for one product, sorted SERVER-SIDE (across the
    // full seller pool for that product) using whatever tab is currently
    // active — see the "FASTEST DELIVERY / MIN MOQ SORTING" note at the
    // top of this file for why this moved off the client.
    const loadSellersFor = useCallback((itemId) => {
        sellerAbortRef.current?.abort();
        const controller = new AbortController();
        sellerAbortRef.current = controller;
        setSellerState((prev) => ({ ...prev, [itemId]: { loading: true, items: [], error: null } }));

        const apiSort = sortModeToApiSort(sellerSortMode);

        // in loadSellersFor, right before fetchBrandItemSellers call:
        console.log("buyerAddress at fetch time:", buyerAddress);

        fetchBrandItemSellers(itemId, {
            sort: apiSort,
            limit: SELLER_PAGE_SIZE,
            offset: 0,
            destPincode: buyerAddress?.pincode || undefined,
            destState: buyerAddress?.state || undefined,
            signal: controller.signal,
            token,
        })
            .then((res) => {
                if (!res?.success) {
                    setSellerState((prev) => ({ ...prev, [itemId]: { loading: false, items: [], error: "Couldn't load sellers." } }));
                    return;
                }
                setSellerState((prev) => ({
                    ...prev,
                    [itemId]: {
                        loading: false,
                        items: res.items || [],
                        error: null,
                        total: res.total ?? (res.items || []).length,
                        hasMore: !!res.hasMore,
                    },
                }));
            })
            .catch((err) => {
                if (err?.name === "AbortError") return;
                setSellerState((prev) => ({ ...prev, [itemId]: { loading: false, items: [], error: "Couldn't load sellers." } }));
            });
    }, [token, sellerSortMode, buyerAddress]);

    const closeDropdown = useCallback(() => {
        sellerAbortRef.current?.abort();
        setOpenItemId(null);
    }, []);

    const toggleDropdown = useCallback((item) => {
        if (openItemId === item.id) {
            closeDropdown();
            return;
        }
        setOpenItemId(item.id);
        loadSellersFor(item.id);
    }, [openItemId, closeDropdown, loadSellersFor]);

    // Refetch — with the new sort applied server-side — whenever the
    // buyer switches tabs on an already-open dropdown, or when their
    // address becomes known partway through. This is the ONLY thing that
    // re-fetches sellers after the initial open; nothing shifts silently
    // in the background.
    useEffect(() => {
        if (!openItemId) return;
        loadSellersFor(openItemId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sellerSortMode, buyerAddress]);

    const openSellersInline = useCallback((item) => {
        if (openItemId !== item.id) {
            setOpenItemId(item.id);
            loadSellersFor(item.id);
        }

        // Wait a tick so the dropdown/row has room to lay out before we scroll.
        requestAnimationFrame(() => {
            rowRefs.current[item.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
        });

        clearTimeout(highlightTimeoutRef.current);
        setHighlightedItemId(item.id);
        highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedItemId((cur) => (cur === item.id ? null : cur));
        }, 1800);
    }, [openItemId, loadSellersFor]);

    useEffect(() => () => clearTimeout(highlightTimeoutRef.current), []);

    // Single runQuery — the primary feed fetch, with tiered fallback
    // (subcategory, then category) when a live search comes up empty.
    const runQuery = useCallback((offset, { append }) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const requestToken = queryTokenRef.current;
        (append ? setLoadingMore : setLoading)(true);

        const trimmed = q.trim();
        const request = trimmed
            ? fetchProductSearchMerged(trimmed, { limit: PAGE_SIZE, offset, categoryId: category?.id || null, signal: controller.signal, token })
            : fetchBrandItemsFeed({ categoryId: category?.id || null, q: "", limit: PAGE_SIZE, offset, signal: controller.signal, token });

        request
            .then((res) => {
                if (!res?.success) return;
                if (requestToken !== queryTokenRef.current) return

                const incoming = res.items || [];
                setItems((prev) => {
                    if (trimmed) {
                        return append ? mergeUnique(prev, incoming) : incoming;
                    }
                    return append ? mergeUnique(prev, incoming) : incoming;
                });
                setTotal(res.total ?? incoming.length ?? null);
                setHasMore(!!res.hasMore);
            })
            .catch((err) => { if (err?.name !== "AbortError") setHasMore(false); })
            .finally(() => {
                if (requestToken !== queryTokenRef.current) return;
                setLoading(false);
                setLoadingMore(false);
            });
    }, [category?.id, q, token]);

    useEffect(() => {
        const key = `${category?.id || ""}::${q}::${token || ""}`;
        const now = Date.now();
        const isDuplicateInvocation =
            lastRunRef.current.key === key &&
            (now - lastRunRef.current.time) < DUPLICATE_GUARD_MS;

        if (isDuplicateInvocation) return;

        lastRunRef.current = { key, time: now };

        clearTimeout(debounceRef.current);
        queryTokenRef.current += 1;
        closeDropdown();

        abortRef.current?.abort();
        setLoading(true);

        if (isFirstRun.current) {
            isFirstRun.current = false;
            setHasMore(true);
            runQuery(0, { append: false });
            return;
        }

        setHasMore(true);
        debounceRef.current = setTimeout(
            () => runQuery(0, { append: false }),
            q ? DEBOUNCE_MS : 0
        );
        return () => clearTimeout(debounceRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category?.id, q, token]);

    useEffect(() => () => sellerAbortRef.current?.abort(), []);

    const sentinelRef = useInfiniteScrollSentinel(
        () => !loadingMore && hasMore && runQuery(items.length, { append: true }),
        { lookahead: 800, disabled: loading || loadingMore || !hasMore }
    );

    const goToSellers = (item) => navigate(`/ brand - item / ${item.slug || item.id}/sellers`, { state: { brandItem: item, category } });

    // Only shows TransportPreferenceModal the first time this buyer deals
    // with this seller. The decision (or explicit "no preference") is
    // looked up from the DB, per buyer-seller pair — not per device.
    const handleBuySeller = async (item, seller) => {
        closeDropdown();

        if (!effectiveLoggedIn) {
            requireLogin();
            return;
        }

        if (!token) {
            requireLogin("You need to login to place an order with this seller.");
            return;
        }
        const addrRes = await fetchBuyerAddresses(token);
        const defaultAddr = addrRes?.addresses?.find((a) => a.is_default) || addrRes?.addresses?.[0];

        if (!defaultAddr?.city || !defaultAddr?.state) {
            setTransportFlow({ item, seller, destAddressId: defaultAddr?.id || null, destCity: null, destState: null, removedNotice: null });
            return;
        }

        const res = await fetchBuyerTransportPreference(seller.seller_id, defaultAddr.state, defaultAddr.city, token);

        if (res?.rejectedNotice) {
            setTransportFlow({
                item, seller, destAddressId: defaultAddr?.id || null,
                destCity: defaultAddr.city, destState: defaultAddr.state,
                removedNotice: `Your proposed transport option (${res.rejectedNotice.summary}) wasn't accepted by the seller.`,
            });
            return;
        }

        if (res?.success && !res.invalidated && (res.decided || res.pendingProposal)) {
            setBuyState({
                item,
                seller: {
                    ...seller,
                    transportPreference: res.preference ? { ...res.preference, destCity: defaultAddr.city, destState: defaultAddr.state } : null,
                    transportPendingProposal: res.pendingProposal ? { ...res.pendingProposal, destCity: defaultAddr.city, destState: defaultAddr.state } : null,
                },
            });
            return;
        }

        setTransportFlow({
            item, seller, destAddressId: defaultAddr?.id || null,
            destCity: defaultAddr.city, destState: defaultAddr.state,
            removedNotice: res?.invalidated ? "The seller no longer offers your previously selected transport option." : null,
        });
    };

    const handleTransportResolved = (result) => {
        const { item, seller } = transportFlow;
        setTransportFlow(null);
        if (result?.pending) {
            setBuyState({ item, seller: { ...seller, transportPreference: null, transportPendingProposal: result } });
        } else {
            setBuyState({ item, seller: { ...seller, transportPreference: result, transportPendingProposal: null } });
        }
    };

    const handleSell = (item) => {
        closeDropdown();
        setSellItem(item);
    };

    const buyerSellerPayload = buyState ? toBuyerSellerPayload(buyState.seller) : null;

    const showFullSkeleton = loading && items.length === 0;
    const newlyAppearedIds = useMemo(() => {
        const fresh = new Set();
        for (const it of items) {
            if (!seenItemIdsRef.current.has(it.id)) fresh.add(it.id);
        }
        fresh.forEach((id) => seenItemIdsRef.current.add(id));
        return fresh;
    }, [items]);

    const columnCount = useResponsiveColumnCount();
    const columns = useMemo(() => bucketItemsByColumn(items, columnCount), [items, columnCount]);

    return (
        <div>
            <div className="flex items-center justify-between px-1 pb-2">
                <h2 className="text-[14.5px] font-extrabold tracking-wider" style={{ color: C.ink }}>
                    {category ? category.name : "All products"}
                </h2>
                <GstToggle includeGst={includeGst} onChange={setIncludeGst} />
            </div>

            <div className="rounded-2xl border bg-white" style={{ borderColor: C.hair }}>

                {showFullSkeleton
                    ? (
                        <div className="flex divide-x" style={{ borderColor: C.hair }}>
                            {Array.from({ length: columnCount }).map((_, colIdx) => (
                                <div key={colIdx} className="min-w-0 flex-1 divide-y" style={{ borderColor: C.hairSoft }}>
                                    {Array.from({ length: Math.ceil(8 / columnCount) }).map((_, i) => (
                                        <RowSkeleton key={i} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    )
                    : items.length === 0 ? (
                        <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
                            <Package className="h-6 w-6" style={{ color: C.hair }} />
                            <p className="text-[13px] font-bold" style={{ color: C.ink }}>
                                {q ? "No products match that search" : "No products here yet"}
                            </p>
                            <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>
                                {q ? "Try a different search term." : "Try a different category."}
                            </p>
                        </div>
                    ) : (
                        <div
                            className="flex divide-x"
                            style={{ borderColor: C.hair, opacity: loading ? 0.55 : 1, transition: "opacity 0.15s ease" }}
                        >
                            {columns.map((colItems, colIdx) => (
                                <div key={colIdx} className="min-w-0 flex-1 divide-y" style={{ borderColor: C.hairSoft }}>
                                    {colItems.map((item) => {
                                        const isOpen = openItemId === item.id;
                                        const i = items.indexOf(item);
                                        return (
                                            <motion.div
                                                key={item.id}
                                                ref={(el) => { if (el) rowRefs.current[item.id] = el; }}
                                                layout="position"
                                                transition={{ duration: 0.24, ease: EASE }}
                                                className="relative"
                                            >
                                                <ProductRow
                                                    item={item}
                                                    idx={i}
                                                    isOpen={isOpen}
                                                    onToggle={() => toggleDropdown(item)}
                                                    onInfo={() => setInfoItemId(item.id)}
                                                    onImageOpen={setLightboxSrc}
                                                    includeGst={includeGst}
                                                    isLoggedIn={isLoggedIn}
                                                    onRequireLogin={() => requireLogin("Login to view real seller pricing.")}
                                                    animateEntrance={newlyAppearedIds.has(item.id)}
                                                />

                                                <AnimatePresence>
                                                    {highlightedItemId === item.id && (
                                                        <motion.div
                                                            key="highlight"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: [0, 1, 1, 0] }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 1.8, times: [0, 0.15, 0.8, 1], ease: "easeInOut" }}
                                                            className="pointer-events-none absolute inset-0 z-10 rounded-xl"
                                                            style={{ background: `${C.primary}07`, boxShadow: `0 0 0 2px ${C.primary}55 inset` }}
                                                        />
                                                    )}
                                                </AnimatePresence>

                                                <AnimatePresence initial={false}>
                                                    {isOpen && (
                                                        <SellerDropdown
                                                            item={item}
                                                            state={sellerState[item.id]}
                                                            onBuySeller={(seller) => handleBuySeller(item, seller)}
                                                            onSell={() => handleSell(item)}
                                                            includeGst={includeGst}
                                                            sortMode={sellerSortMode}
                                                            isLoggedIn={isLoggedIn}
                                                            onRequireLogin={() => requireLogin("Login to view real seller pricing.")}
                                                            onSortModeChange={setSellerSortMode}
                                                            currentUserId={currentUserId}
                                                            buyerAddress={buyerAddress}
                                                        />
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                {hasMore && !loading && (
                    <>
                        {loadingMore && (
                            <div className="flex divide-x border-t" style={{ borderColor: C.hair }}>
                                {Array.from({ length: columnCount }).map((_, colIdx) => (
                                    <div key={colIdx} className="min-w-0 flex-1 divide-y" style={{ borderColor: C.hairSoft }}>
                                        {Array.from({ length: Math.ceil(PAGE_SIZE / columnCount) }).map((_, i) => (
                                            <RowSkeleton key={i} />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div ref={sentinelRef} className="h-1" />
                    </>
                )}
            </div>

            {infoItemId && (
                <BrandItemDetailModal
                    brandItemId={infoItemId}
                    onClose={() => setInfoItemId(null)}
                    onViewSellers={(item) => { setInfoItemId(null); openSellersInline(item); }}
                />
            )}

            <AnimatePresence>
                {loginPrompt && (
                    <LoginPromptModal
                        open
                        message={loginPrompt.message}
                        onConfirm={confirmLogin}
                        onCancel={cancelLogin}
                    />
                )}
                {sellItem && (
                    <SellThisItemModal brand={sellItem} onClose={() => setSellItem(null)} />
                )}
                {buyState && buyerSellerPayload && (
                    <BuyNowModal
                        seller={buyerSellerPayload}
                        product={{ name: buyState.item.name, brand_name: buyState.item.brand_name }}
                        onClose={() => setBuyState(null)}
                    />
                )}
                {transportFlow && (
                    <TransportPreferenceModal
                        open
                        seller={toBuyerSellerPayload(transportFlow.seller)}
                        destCity={transportFlow.destCity}
                        destState={transportFlow.destState}
                        removedNotice={transportFlow.removedNotice}
                        onClose={() => setTransportFlow(null)}
                        onResolved={handleTransportResolved}
                    />
                )}
            </AnimatePresence>

            {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="" onClose={() => setLightboxSrc(null)} />}
        </div>
    );
}