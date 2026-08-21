// components/home/HomeProductFeed.jsx
//
// The home page's product list — now one level flatter: shows brand
// items directly (fetchBrandItemsFeed), not generic products. Tapping a
// row opens BuySellChoiceSheet immediately, same as GenericProductBrandsPage
// — Buy goes to the sellers page, Sell opens SellThisItemModal. Tapping
// the (i) opens BrandItemDetailModal without leaving the feed.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Package, Info } from "lucide-react";
import { fetchBrandItemsFeed } from "../../utils/api";
import useInfiniteScrollSentinel from "../../hooks/useInfiniteScrollSentinel";
import ImageLightbox from "../ImageLightbox.jsx";
import BrandItemDetailModal from "../catalog/BrandItemDetailModal";
import BuySellChoiceSheet from "../catalog/BuySellChoiceSheet";
import SellThisItemModal from "../catalog/SellThisItemModal";

const C = {
    ink: "#0B1116", muted: "#667077", primary: "#D2462B", secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)", imgBg: "#F4F5F6",
};
const EASE = [0.16, 1, 0.3, 1];
const PAGE_SIZE = 24;

function inr(n) {
    const val = Number(n) || 0;
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
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

function ProductRow({ item, idx, onOpen, onInfo, onImageOpen }) {
    // model_no differentiates near-duplicate names from the same brand,
    // same treatment as GenericProductBrandsPage's BrandRow.
    const subLabel = [item.brand_name, item.model_no].filter(Boolean).join(" · ");

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(idx * 0.012, 0.18), ease: EASE }}
            className="flex w-full items-center gap-0 border-b px-3 py-3 sm:px-4"
            style={{ borderColor: C.hairSoft }}
        >
            <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors duration-150 hover:bg-black/[0.02]">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border" style={{ borderColor: C.hair, background: C.imgBg }}>
                    <ProductImage src={item.image} alt="" onOpen={onImageOpen} />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold leading-tight tracking-wide" style={{ color: C.ink }}>{item.name}</p>
                    <p className="mt-0.5 truncate text-[11.5px] font-bold tracking-wider" style={{ color: C.primary }}>{subLabel}</p>
                    <p className="mt-0.5 truncate text-[10.5px] font-medium tracking-wide" style={{ color: C.muted }}>
                        {item.category_name ? `${item.category_name} · ` : ""}{item.subcategory_name}
                    </p>
                </div>

                <div className="flex shrink-0 flex-col items-end text-right">
                    <p className="text-[13px] font-extrabold tabular-nums tracking-wide" style={{ color: item.lowest_price != null ? C.ink : C.muted }}>
                        {item.lowest_price != null ? <>from ₹{inr(item.lowest_price)}</> : "Ask price"}
                    </p>
                    {item.seller_count > 0 && (
                        <p className="mt-0.5 text-[11px] font-bold tracking-wide" style={{ color: C.secondary }}>{item.seller_count} sellers</p>
                    )}
                </div>
                {/* <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.hair }} /> */}
            </button>
            <button
                onClick={onInfo}
                aria-label="Product details"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.05]"
            >
                <Info className="h-4 w-4" style={{ color: C.muted }} />
            </button>
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

export default function HomeProductFeed({ category }) {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [infoItemId, setInfoItemId] = useState(null);

    const [choiceItem, setChoiceItem] = useState(null);
    const [sellItem, setSellItem] = useState(null);

    const abortRef = useRef(null);

    const runQuery = useCallback((offset, { append }) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        (append ? setLoadingMore : setLoading)(true);

        fetchBrandItemsFeed({
            categoryId: category?.id || null,
            limit: PAGE_SIZE,
            offset,
            signal: controller.signal,
        })
            .then((res) => {
                if (!res?.success) return;
                setItems((prev) => (append ? [...prev, ...(res.items || [])] : res.items || []));
                setTotal(res.total ?? null);
                setHasMore(!!res.hasMore);
            })
            .catch((err) => { if (err?.name !== "AbortError") setHasMore(false); })
            .finally(() => { setLoading(false); setLoadingMore(false); });
    }, [category?.id]);

    useEffect(() => {
        setItems([]);
        setHasMore(true);
        runQuery(0, { append: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category?.id]);

    const sentinelRef = useInfiniteScrollSentinel(
        () => !loadingMore && hasMore && runQuery(items.length, { append: true }),
        { lookahead: 800, disabled: loading || loadingMore || !hasMore }
    );

    // Same shape BrandRow's goToSellers used in GenericProductBrandsPage —
    // brand-item rows already carry genericProductId/genericProductName
    // where needed for the sellers page breadcrumb, so pass what we have.
    const goToSellers = (item) => navigate(`/brand-item/${item.slug || item.id}/sellers`, { state: { brandItem: item, category } });

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
                            <p className="text-[13px] font-bold" style={{ color: C.ink }}>No products here yet</p>
                            <p className="text-[11.5px] font-medium" style={{ color: C.muted }}>Try a different category.</p>
                        </div>
                    ) : (
                        <>
                            {items.map((item, i) => (
                                <ProductRow
                                    key={item.id}
                                    item={item}
                                    idx={i}
                                    onOpen={() => setChoiceItem(item)}
                                    onInfo={() => setInfoItemId(item.id)}
                                    onImageOpen={setLightboxSrc}
                                />
                            ))}
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
                {choiceItem && (
                    <BuySellChoiceSheet
                        item={choiceItem}
                        onClose={() => setChoiceItem(null)}
                        onBuy={() => {
                            const it = choiceItem;
                            setChoiceItem(null);
                            goToSellers(it);
                        }}
                        onSell={() => {
                            setSellItem(choiceItem);
                            setChoiceItem(null);
                        }}
                    />
                )}
                {sellItem && (
                    <SellThisItemModal brand={sellItem} onClose={() => setSellItem(null)} />
                )}
            </AnimatePresence>

            {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="" onClose={() => setLightboxSrc(null)} />}
        </div>
    );
}