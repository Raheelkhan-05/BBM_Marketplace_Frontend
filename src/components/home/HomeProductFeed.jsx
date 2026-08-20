// components/home/HomeProductFeed.jsx
//
// The home page's product list — fetchGenericProductsFeed for every state
// (no category = everything, category chip = scoped), infinite-scroll
// paginated the same way CategoryProductsPage was, just embedded in the
// page instead of owning its own route. Re-queries from offset 0 the
// instant `category` changes, and clears items immediately so switching
// categories never shows stale rows while the new page loads.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Package } from "lucide-react";
import { fetchGenericProductsFeed } from "../../utils/api";
import useInfiniteScrollSentinel from "../../hooks/useInfiniteScrollSentinel";

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

function ProductRow({ item, idx, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(idx * 0.012, 0.18), ease: EASE }}
            className="flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors duration-150 hover:bg-black/[0.02] sm:px-4"
            style={{ borderColor: C.hairSoft }}
        >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border" style={{ borderColor: C.hair, background: C.imgBg }}>
                {item.image ? (
                    <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                    <Package className="h-4.5 w-4.5" style={{ color: C.muted }} />
                )}
            </span>

            <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold leading-tight tracking-wide" style={{ color: C.ink }}>{item.name}</p>
                <p className="mt-0.5 truncate text-[11.5px] font-medium tracking-wider" style={{ color: C.muted }}>
                    {item.category_name ? `${item.category_name} · ` : ""}{item.subcategory_name}
                </p>
            </div>

            <div className="flex shrink-0 flex-col items-end text-right">
                <p className="text-[14px] font-extrabold tabular-nums tracking-wide" style={{ color: item.lowest_price != null ? C.ink : C.muted }}>
                    {item.lowest_price != null ? <>from <span style={{ color: C.primary }}>₹</span>{inr(item.lowest_price)}</> : "View price"}
                </p>
                {item.seller_count > 0 && (
                    <p className="mt-0.5 text-[11px] font-bold tracking-wide" style={{ color: C.secondary }}>{item.seller_count} sellers</p>
                )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.hair }} />
        </motion.button>
    );
}

function RowSkeleton() {
    return (
        <div className="flex items-center gap-3 border-b px-3 py-3 sm:px-4" style={{ borderColor: C.hairSoft }}>
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl" style={{ background: C.hairSoft }} />
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

    const abortRef = useRef(null);

    const runQuery = useCallback((offset, { append }) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        (append ? setLoadingMore : setLoading)(true);

        fetchGenericProductsFeed({
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

    // fresh query the instant the category filter changes — no debounce
    // needed here, there's no free-text input driving it, just chip taps
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

    const openProduct = (item) => navigate(`/product/${item.slug || item.id}/brands`, { state: { genericProduct: item, category } });

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
                                <ProductRow key={item.id} item={item} idx={i} onClick={() => openProduct(item)} />
                            ))}
                            {loadingMore && <RowSkeleton />}
                        </>
                    )}
                {hasMore && !loading && <div ref={sentinelRef} className="h-1" />}
            </div>
        </div>
    );
}