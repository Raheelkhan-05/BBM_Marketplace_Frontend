// components/home/HomeProductFeed.jsx
//
// The home page's product list — brand items (fetchBrandItemsFeed),
// filterable live by `q` (wired from the home search bar's typed value)
// in addition to the category filter.
//
// NAVIGATION CHANGE: tapping a row no longer opens BuySellChoiceSheet.
// It now expands an inline accordion directly beneath that row listing
// sellers (name + price only) for that exact brand item, fetched from
// the same catalog_brand_item_sellers endpoint BrandItemSellersPage
// uses. Tapping a seller row opens BuyNowModal immediately — same
// payload shape/mapping as BrandItemSellersPage. A "Sell this product"
// row sits at the bottom of the dropdown (visible only once sellers
// have finished loading) and opens SellThisItemModal, unchanged from
// before. Only one dropdown is open at a time across the whole feed
// (single `openItemId` state). The seller list inside the dropdown
// carries `data-lenis-prevent` so hovering it hands scroll control
// back to native/the list instead of the page's Lenis smooth-scroll —
// the same opt-out pattern BuyNowModal/SellThisItemModal already use
// for their own scroll containers.
//
// ROW LAYOUT: the Info icon sits inline with the product name (top
// line) rather than in a separate right-side icon cluster. The
// right-side slot instead shows "from ₹X" pricing (when available)
// stacked above the expand/collapse chevron — that whole slot is the
// toggle target, same as tapping the row itself.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Package, Info, Store } from "lucide-react";
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

// Same lead-time rule BuyNowModal/BrandItemSellersPage use.
function effectiveLeadTime(s) {
    return s.stock_type === "made_to_order" ? s.production_lead_time_days : s.dispatch_time_days;
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

function ProductRow({ item, idx, isOpen, onToggle, onInfo, onImageOpen }) {
    const subLabel = [item.brand_name, item.model_no].filter(Boolean).join(" · ");

    const packaging = packagingLabel(
        item.lowest_price_pack_size,
        item.lowest_price_master_pack_size,
        item.lowest_price_unit
    );

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
                        className="min-w-0 truncate text-[14px] font-bold leading-tight tracking-wide"
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
                    className="mt-0.5 truncate text-[11.5px] font-bold tracking-wider"
                    style={{ color: C.primary }}
                >
                    {subLabel}
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
                        className="mt-1 truncate text-[11.5px] font-semibold leading-tight tracking-wider"
                        style={{ color: C.secondary }}
                    >
                        {packaging}
                    </p>
                )}
            </div>

            {/* COL 3 — PRICE */}
            <button
                onClick={onToggle}
                aria-label={isOpen ? "Collapse sellers" : "Expand sellers"}
                className="flex h-full shrink-0 items-center justify-end text-right"
            >
                {item.lowest_price != null && (
                    <span className="flex flex-col items-end">
                        <span
                            className="text-[10px] font-semibold uppercase leading-tight tracking-wider"
                            style={{ color: C.muted }}
                        >
                            from
                        </span>

                        <span
                            className="text-[15px] font-extrabold leading-tight tabular-nums tracking-wide"
                            style={{ color: C.ink }}
                        >
                            ₹{inr(item.lowest_price)}
                        </span>

                        <span
                            className="text-[9.5px] font-semibold tracking-wide"
                            style={{ color: C.muted }}
                        >
                            /{priceUnitLabel(
                                item.lowest_price_master_pack_size
                            )}
                        </span>
                    </span>
                )}
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
function SellerDropdown({ item, state, onBuySeller, onSell }) {
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
                            {items.map((s) => (
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
                                    <div className="shrink-0 text-right">
                                        <p className="text-[13.5px] font-extrabold tabular-nums" style={{ color: C.primary }}>
                                            ₹{inr(s.price)}
                                        </p>
                                        <p className="text-[10px] font-semibold tracking-wide" style={{ color: C.muted }}>
                                            /{priceUnitLabel(s.units_per_master_pack)}
                                        </p>
                                    </div>
                                </button>
                            ))}
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
                <span className="text-[12px] font-semibold tracking-wide" style={{ color: C.muted }}>
                    {total != null ? `${total} products` : "Loading…"}
                </span>
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
                                        />
                                        <AnimatePresence initial={false}>
                                            {isOpen && (
                                                <SellerDropdown
                                                    item={item}
                                                    state={sellerState[item.id]}
                                                    onBuySeller={(seller) => handleBuySeller(item, seller)}
                                                    onSell={() => handleSell(item)}
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