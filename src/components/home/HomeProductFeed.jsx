// components/home/HomeProductFeed.jsx
//
// PRICE BREAKDOWN + GST TOGGLE (this revision):
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Package, Info, Store, ShieldCheck } from "lucide-react";
import { fetchBrandItemsFeed, fetchBrandItemSellers } from "../../utils/api";
import useInfiniteScrollSentinel from "../../hooks/useInfiniteScrollSentinel";
import ImageLightbox from "../ImageLightbox.jsx";
import BrandItemDetailModal from "../catalog/BrandItemDetailModal";
import SellThisItemModal from "../catalog/SellThisItemModal";
import BuyNowModal from "../BuyNowModal";

const C = {
    ink: "#0B1116", muted: "#667077", primary: "#D2462B", secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)", imgBg: "#F4F5F6",
};
const EASE = [0.16, 1, 0.3, 1];
const PAGE_SIZE = 24;
const SELLER_PAGE_SIZE = 30;
const DEBOUNCE_MS = 250;

function inr(n) {
    const val = Number(n) || 0;
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
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

// ---------------------------------------------------------------------
// Price breakdown — derives unit / pack / master-pack prices from the
// single source-of-truth price, and applies the GST toggle.
//
// `price` is whatever the seller actually stores: per Pack if
// masterPackSize < 1, per Master Pack if masterPackSize >= 1 (same
// convention as priceUnitLabel above). `price` is assumed GST-inclusive
// at rest — includeGst=false reverses that seller's own gst_percent to
// get the exclusive figure; includeGst=true returns it unchanged.
// ---------------------------------------------------------------------
function computePriceBreakdown({ price, packSize, masterPackSize, gstPercent, includeGst }) {
    const sourcePrice = Number(price);
    if (!(sourcePrice > 0)) return null;

    const pack = Number(packSize) || 0;
    const master = Number(masterPackSize) || 0;
    const hasMasterPack = master >= 1;
    const gst = Number(gstPercent) || 0;

    // Stored price is GST-inclusive; reverse it out for the "excl. GST" view.
    const adjusted = includeGst ? sourcePrice : sourcePrice / (1 + gst / 100);

    let masterPackPrice = null;
    let packPrice = null;
    let unitPrice = null;

    if (hasMasterPack) {
        masterPackPrice = adjusted;
        packPrice = master > 0 ? adjusted / master : null;
        unitPrice = packPrice != null && pack > 0 ? packPrice / pack : null;
    } else {
        packPrice = adjusted;
        unitPrice = pack > 0 ? packPrice / pack : null;
    }

    return {
        unitPrice,
        packPrice,
        masterPackPrice,
        hasMasterPack,
        basis: hasMasterPack ? "master_pack" : "pack",
    };
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
                    <span className={`${valueClass} text-right whitespace-nowrap`} style={{ color: C.ink }}>
                        ₹{inr(r.value)}
                    </span>
                    <span className={`${labelClass} text-left whitespace-nowrap`} style={{ color: C.muted }}>
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
            src={image}
            alt=""
            className="h-6 w-auto shrink-0 rounded-full object-cover"
        />
    ) : (
        <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8.5px] font-extrabold leading-none"
            style={{ background: `${C.secondary}18`, color: C.secondary }}
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
        display_name: s.display_name,
        unit: s.unit,
        moq: s.moq,
        price: s.price,
        gstPercent: s.gst_percent,
        availableStock: s.stock_quantity ?? null,
        stockType: s.stock_type,
        leadTime: effectiveLeadTime(s),
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

function ProductImage({ src, alt, onOpen }) {
    const [failed, setFailed] = useState(false);
    if (!src || failed) return <Package className="h-4.5 w-4.5" style={{ color: C.muted }} />;
    return (
        <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            loading="lazy"
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
            onClick={() => onChange(!includeGst)}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold tracking-wide transition-colors duration-150"
            style={{
                borderColor: includeGst ? `${C.secondary}40` : C.hair,
                background: includeGst ? `${C.secondary}0f` : "transparent",
                color: includeGst ? C.secondary : C.muted,
            }}
        >
            <ShieldCheck className="h-3 w-3" />
            {includeGst ? "Incl. GST" : "Excl. GST"}
        </button>
    );
}

function ProductRow({ item, idx, isOpen, onToggle, onInfo, onImageOpen, includeGst }) {
    const subLabel = [item.brand_name, item.model_no].filter(Boolean).join(" · ");

    const packaging = packagingLabel(
        item.lowest_price_pack_size,
        item.lowest_price_master_pack_size,
        item.lowest_price_unit
    );

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
        });
    }, [
        item.lowest_price,
        item.lowest_price_pack_size,
        item.lowest_price_master_pack_size,
        item.lowest_price_gst_percent,
        includeGst,
    ]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.2,
                delay: Math.min(idx * 0.012, 0.18),
                ease: EASE,
            }}
            className="grid w-full grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-3 sm:px-4"
            style={{
                borderColor: C.hairSoft,
                background: isOpen ? C.hairSoft : "transparent",
            }}
        >
            {/* COL 1 — IMAGE */}
            <div className="flex h-full items-center justify-center">
                <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
                    style={{
                        borderColor: C.hair,
                        background: C.imgBg,
                    }}
                >
                    <ProductImage
                        src={item.image}
                        alt=""
                        onOpen={onImageOpen}
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
                className="min-w-0 cursor-pointer text-left"
            >
                <div className="flex min-w-0 items-center gap-1">
                    <p
                        className="min-w-0 text-[14px] font-bold leading-tight tracking-wide"
                        style={{ color: C.ink }}
                    >
                        {item.name}
                    </p>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onInfo();
                        }}
                        aria-label="Product details"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.05]"
                    >
                        <Info
                            className="h-3.5 w-3.5"
                            style={{ color: C.muted }}
                        />
                    </button>
                </div>

                <p
                    className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11.5px] font-bold tracking-wider"
                    style={{ color: C.primary }}
                >
                    <BrandBadge name={item.brand_name} image={item.brand_image} />
                    <span className="truncate">{subLabel}</span>
                </p>

                <p
                    className="mt-0.5 truncate text-[10.5px] font-medium tracking-wide"
                    style={{ color: C.muted }}
                >
                    {item.category_name
                        ? `${item.category_name} · `
                        : ""}
                    {item.subcategory_name}
                </p>

                {/* PACKAGING — OWN LINE */}
                {packaging && (
                    <p
                        className="mt-1 text-[10px] sm:text-[11px] md:text-[11.5px] font-semibold leading-tight tracking-wide"
                        style={{ color: C.secondary }}
                    >
                        {packaging}
                    </p>
                )}
            </div>

            {/* COL 3 — PRICE BREAKDOWN (unit / pack / master pack) */}
            <button
                onClick={onToggle}
                aria-label={isOpen ? "Collapse sellers" : "Expand sellers"}
                className="flex h-full shrink-0 flex-col items-end justify-center gap-1 text-right"
            >
                {breakdown && (
                    <span
                        className="text-[10px] font-semibold uppercase leading-tight tracking-wider"
                        style={{ color: C.muted }}
                    >
                        from
                    </span>
                )}
                <PriceBreakdown breakdown={breakdown} unit={item.lowest_price_unit} size="row" />
            </button>
        </motion.div>
    );
}

// Inline seller accordion. Renders directly under the row it belongs
// to. `state` is { loading, items, error, total, hasMore } for this
// item's fetch. `data-lenis-prevent` on the scrollable list is what
// hands scroll control back to the native container the instant the
// cursor is over it, instead of the page's Lenis smooth-scroll eating
// the wheel event.
function SellerDropdown({ item, state, onBuySeller, onSell, includeGst }) {
    const { loading, items = [], error, total = 0, hasMore } = state || {};

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
                {/* Pricing moved up to the row itself — this header now
                    only carries the seller-count context. */}
                <div className="pb-2">
                    <p className="text-[11px] font-bold tracking-wide" style={{ color: C.muted }}>
                        {loading
                            ? "Loading sellers…"
                            : total > 0
                                ? `${total} seller${total === 1 ? "" : "s"} listing this`
                                : "No sellers yet"}
                    </p>
                </div>

                <div className="max-h-64 overflow-y-auto overscroll-contain">
                    {loading ? (
                        // Skeleton rows now mirror the real seller row shape:
                        // name + MOQ/lead-time on the left, price + unit on
                        // the right — instead of generic unaligned bars.
                        <div className="flex flex-col divide-y" style={{ borderColor: C.hairSoft }}>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        <div className="h-2.5 w-32 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                                        <div className="h-2 w-20 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                                    </div>
                                    <div className="shrink-0 space-y-1.5 text-right">
                                        <div className="ml-auto h-2.5 w-12 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                                        <div className="ml-auto h-2 w-8 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <p className="py-3 text-center text-[12px] font-semibold" style={{ color: C.muted }}>{error}</p>
                    ) : items.length === 0 ? (
                        <p className="py-3 text-center text-[12px] font-semibold" style={{ color: C.muted }}>No sellers listing this yet.</p>
                    ) : (
                        <div className="flex flex-col divide-y" style={{ borderColor: C.hairSoft }}>
                            {items.map((s) => {
                                // Same derivation as the row-level breakdown, just
                                // sourced from this seller's own fields.
                                const breakdown = computePriceBreakdown({
                                    price: s.price,
                                    packSize: s.pack_size,
                                    masterPackSize: s.units_per_master_pack,
                                    gstPercent: s.gst_percent,
                                    includeGst,
                                });
                                return (
                                    <button
                                        key={s.submission_id}
                                        onClick={() => onBuySeller(s)}
                                        className="flex items-center justify-between gap-3 py-2.5 text-left transition-colors duration-150 hover:bg-black/[0.03]"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-bold tracking-wide" style={{ color: C.ink }}>
                                                {s.display_name}
                                            </p>
                                            <p className="mt-0.5 truncate text-[10.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                                {s.moq ? `MOQ ${s.moq} ${priceUnitLabel(s.units_per_master_pack)}` : priceUnitLabel(s.units_per_master_pack)}
                                                {effectiveLeadTime(s) != null ? ` · ${effectiveLeadTime(s)}d lead` : ""}
                                            </p>
                                        </div>
                                        <PriceBreakdown breakdown={breakdown} unit={s.unit} size="seller" />
                                    </button>
                                );
                            })}
                            {hasMore && (
                                <p className="pt-2 text-center text-[11px] font-semibold" style={{ color: C.muted }}>
                                    +{Math.max(total - items.length, 0)} more sellers
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Hidden until the sellers fetch has settled — no more
                    "Sell this product" flashing on screen before we know
                    who else is already selling it. */}
                {!loading && (
                    <button
                        onClick={onSell}
                        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-2 text-[12.5px] font-bold tracking-wide transition-colors duration-150 hover:bg-black/[0.03]"
                        style={{ borderColor: `${C.primary}40`, color: C.primary }}
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
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [infoItemId, setInfoItemId] = useState(null);

    // GST view toggle — defaults to inclusive, since that's what the
    // stored price already represents. Purely client-side; no refetch
    // needed on flip, every price is re-derived instantly via useMemo.
    const [includeGst, setIncludeGst] = useState(true);

    // Inline seller accordion state — only ONE item id can be open at
    // once. sellerState is keyed by item id so a previous item's
    // fetched sellers stay cached if the user re-opens it later in the
    // same session (re-opening re-fetches fresh below, but this avoids
    // a flash of nothing while that request is in flight).
    const [openItemId, setOpenItemId] = useState(null);
    const [sellerState, setSellerState] = useState({});
    const sellerAbortRef = useRef(null);

    const [sellItem, setSellItem] = useState(null);
    const [buyState, setBuyState] = useState(null); // { item, seller }

    const abortRef = useRef(null);
    const debounceRef = useRef(null);
    // Bumped on every reset (category/query change). Each in-flight
    // request captures the value current at the time it was fired; if
    // that value no longer matches when the response lands, the
    // response is stale (a reset happened in between) and gets dropped
    // instead of merged — this is what stops a page-2 append from a
    // previous query landing after a page-0 reset from the new query.
    const queryTokenRef = useRef(0);

    const closeDropdown = useCallback(() => {
        sellerAbortRef.current?.abort();
        setOpenItemId(null);
    }, []);

    const toggleDropdown = useCallback((item) => {
        if (openItemId === item.id) {
            closeDropdown();
            return;
        }
        sellerAbortRef.current?.abort();
        const controller = new AbortController();
        sellerAbortRef.current = controller;
        setOpenItemId(item.id);
        setSellerState((prev) => ({ ...prev, [item.id]: { loading: true, items: [], error: null } }));

        fetchBrandItemSellers(item.id, { sort: "price_asc", limit: SELLER_PAGE_SIZE, offset: 0, signal: controller.signal })
            .then((res) => {
                if (!res?.success) {
                    setSellerState((prev) => ({ ...prev, [item.id]: { loading: false, items: [], error: "Couldn't load sellers." } }));
                    return;
                }
                setSellerState((prev) => ({
                    ...prev,
                    [item.id]: {
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
                setSellerState((prev) => ({ ...prev, [item.id]: { loading: false, items: [], error: "Couldn't load sellers." } }));
            });
    }, [openItemId, closeDropdown]);

    const runQuery = useCallback((offset, { append }) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const token = queryTokenRef.current;
        (append ? setLoadingMore : setLoading)(true);

        fetchBrandItemsFeed({
            categoryId: category?.id || null,
            q,
            limit: PAGE_SIZE,
            offset,
            signal: controller.signal,
        })
            .then((res) => {
                if (!res?.success) return;
                if (token !== queryTokenRef.current) return; // stale response, a reset happened after this was fired
                setItems((prev) =>
                    sortBySellerAvailability(
                        append ? mergeUnique(prev, res.items || []) : res.items || []
                    )
                );
                setTotal(res.total ?? null);
                setHasMore(!!res.hasMore);
            })
            .catch((err) => { if (err?.name !== "AbortError") setHasMore(false); })
            .finally(() => {
                if (token !== queryTokenRef.current) return;
                setLoading(false);
                setLoadingMore(false);
            });
    }, [category?.id, q]);

    const isFirstRun = useRef(true);
    useEffect(() => {
        clearTimeout(debounceRef.current);
        queryTokenRef.current += 1; // invalidate any in-flight request from before this change
        closeDropdown(); // the item list underneath is about to change — don't leave a stale accordion open

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
    }, [category?.id, q]);

    useEffect(() => () => sellerAbortRef.current?.abort(), []); // unmount cleanup

    const sentinelRef = useInfiniteScrollSentinel(
        () => !loadingMore && hasMore && runQuery(items.length, { append: true }),
        { lookahead: 800, disabled: loading || loadingMore || !hasMore }
    );

    const goToSellers = (item) => navigate(`/brand-item/${item.slug || item.id}/sellers`, { state: { brandItem: item, category } });

    const handleBuySeller = (item, seller) => {
        closeDropdown();
        setBuyState({ item, seller });
    };
    const handleSell = (item) => {
        closeDropdown();
        setSellItem(item);
    };

    const buyerSellerPayload = buyState ? toBuyerSellerPayload(buyState.seller) : null;

    return (
        <div>
            <div className="flex items-center justify-between px-1 pb-2">
                <h2 className="text-[14.5px] font-extrabold tracking-wider" style={{ color: C.ink }}>
                    {category ? category.name : "All products"}
                </h2>
                <GstToggle includeGst={includeGst} onChange={setIncludeGst} />
            </div>

            <div className="rounded-2xl border bg-white" style={{ borderColor: C.hair }}>
                {loading
                    ? Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
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
                        <>
                            {items.map((item, i) => {
                                const isOpen = openItemId === item.id;
                                return (
                                    <motion.div key={item.id} layout="position" transition={{ duration: 0.24, ease: EASE }}>
                                        <ProductRow
                                            item={item}
                                            idx={i}
                                            isOpen={isOpen}
                                            onToggle={() => toggleDropdown(item)}
                                            onInfo={() => setInfoItemId(item.id)}
                                            onImageOpen={setLightboxSrc}
                                            includeGst={includeGst}
                                        />
                                        <AnimatePresence initial={false}>
                                            {isOpen && (
                                                <SellerDropdown
                                                    item={item}
                                                    state={sellerState[item.id]}
                                                    onBuySeller={(seller) => handleBuySeller(item, seller)}
                                                    onSell={() => handleSell(item)}
                                                    includeGst={includeGst}
                                                />
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                            {loadingMore && <RowSkeleton />}
                        </>
                    )}
                {hasMore && !loading && <div ref={sentinelRef} className="h-1" />}
            </div>

            {infoItemId && (
                <BrandItemDetailModal
                    brandItemId={infoItemId}
                    onClose={() => setInfoItemId(null)}
                    onViewSellers={(item) => { setInfoItemId(null); goToSellers(item); }}
                />
            )}

            <AnimatePresence>
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
            </AnimatePresence>

            {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="" onClose={() => setLightboxSrc(null)} />}
        </div>
    );
}