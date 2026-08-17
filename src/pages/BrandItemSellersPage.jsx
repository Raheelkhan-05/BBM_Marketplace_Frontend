// pages/BrandItemSellersPage.jsx
//
// Step 3 of the drill-down: sellers listing THIS exact brand item
// (seller_product_submissions, via catalog_brand_item_sellers so it can
// never leak a different variant's sellers in). Browsing/discovery is
// fully wired below; the "Order" button intentionally routes to the
// seller's shop rather than opening a checkout flow inline — you already
// have place_order + an address/quantity flow somewhere (most likely
// inside your existing GenericProductSellersPage). Point me at that
// component and I'll wire the same flow into this row instead of
// guessing at your checkout UI and duplicating it.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Truck, Boxes, ChevronRight, Store } from "lucide-react";
import { fetchBrandItemSellers } from "../utils/api";
import useInfiniteScrollSentinel from "../hooks/useInfiniteScrollSentinel";

const C = {
    ink: "#0B1116", muted: "#667077", primary: "#D2462B", secondary: "#006F83",
    hair: "rgba(11,17,22,0.09)", hairSoft: "rgba(11,17,22,0.05)",
};
const EASE = [0.16, 1, 0.3, 1];
const PAGE_SIZE = 24;

const SORTS = [
    { id: "relevance", label: "Relevance" },
    { id: "price_asc", label: "Lowest price" },
    { id: "price_desc", label: "Highest price" },
];

function SellerRow({ s, idx, onClick }) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: Math.min(idx * 0.02, 0.2), ease: EASE }}
            className="flex w-full items-start gap-3 border-b px-3 py-3.5 text-left transition-colors duration-150 hover:bg-black/[0.02] sm:px-4"
            style={{ borderColor: C.hairSoft }}
        >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border" style={{ borderColor: C.hair, background: "#F4F5F6" }}>
                {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="h-4.5 w-4.5" style={{ color: C.muted }} />}
            </span>

            <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold leading-tight" style={{ color: C.ink }}>{s.display_name}</p>
                {(s.city || s.state) && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium" style={{ color: C.muted }}>
                        <MapPin className="h-3 w-3 shrink-0" /> {[s.city, s.state].filter(Boolean).join(", ")}
                    </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: C.secondary }}>
                        <Boxes className="h-3 w-3" /> MOQ {s.moq} {s.unit}
                    </span>
                    <span className="flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: C.muted }}>
                        <Truck className="h-3 w-3" /> {s.stock_type === "made_to_order" ? "Made to order" : "Ready stock"}
                        {s.dispatch_time_days != null ? ` · ${s.dispatch_time_days}d dispatch` : ""}
                    </span>
                </div>
            </div>

            <div className="flex shrink-0 flex-col items-end text-right">
                <p className="text-[15px] font-extrabold tabular-nums" style={{ color: C.ink }}>
                    <span style={{ color: C.primary }}>₹</span>{s.price}
                    <span className="ml-0.5 text-[10px] font-semibold" style={{ color: C.muted }}>/{s.unit}</span>
                </p>
                <ChevronRight className="mt-1 h-4 w-4" style={{ color: C.hair }} />
            </div>
        </motion.button>
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
            <div className="h-4 w-12 shrink-0 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
        </div>
    );
}

export default function BrandItemSellersPage() {
    const { idOrSlug } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const brandItemHint = location.state?.brandItem;

    const [sort, setSort] = useState("relevance");
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

        fetchBrandItemSellers(brandItemHint?.id || idOrSlug, { sort, limit: PAGE_SIZE, offset, signal: controller.signal })
            .then((res) => {
                if (!res?.success) return;
                setItems((prev) => (append ? [...prev, ...(res.items || [])] : res.items || []));
                setTotal(res.total ?? null);
                setHasMore(!!res.hasMore);
            })
            .catch((err) => { if (err?.name !== "AbortError") setHasMore(false); })
            .finally(() => { setLoading(false); setLoadingMore(false); });
    }, [brandItemHint?.id, idOrSlug, sort]);

    useEffect(() => { runQuery(0, { append: false }); }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

    const sentinelRef = useInfiniteScrollSentinel(
        () => !loadingMore && hasMore && runQuery(items.length, { append: true }),
        { lookahead: 600, disabled: loading || loadingMore || !hasMore }
    );

    return (
        <div className="min-h-screen bg-[#FCFBF9]">
            <div className="sticky top-0 z-20 border-b bg-white" style={{ borderColor: C.hair }}>
                <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-4">
                    <div className="flex items-center gap-2.5 pb-3">
                        <button onClick={() => navigate(-1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.05]">
                            <ArrowLeft className="h-4 w-4" style={{ color: C.ink }} />
                        </button>
                        <div className="min-w-0">
                            <h1 className="truncate text-[16.5px] font-extrabold leading-tight" style={{ color: C.ink }}>
                                {brandItemHint?.name || "Sellers"}
                            </h1>
                            <p className="truncate text-[11px] font-bold" style={{ color: C.primary }}>
                                {brandItemHint?.brand_name} {total != null ? `· ${total} sellers` : ""}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-1.5 pb-3">
                        {SORTS.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setSort(s.id)}
                                className="rounded-full border px-3 py-1 text-[11px] font-bold"
                                style={{ borderColor: sort === s.id ? C.primary : C.hair, color: sort === s.id ? '#ffffff' : C.muted, background: sort === s.id ? `${C.primary}` : "white" }}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl bg-white sm:my-3 sm:rounded-2xl sm:border" style={{ borderColor: C.hair }}>
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
                    : items.length === 0 ? (
                        <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
                            <Store className="h-6 w-6" style={{ color: C.hair }} />
                            <p className="text-[13px] font-bold" style={{ color: C.ink }}>No sellers listing this right now</p>
                        </div>
                    ) : (
                        <>
                            {items.map((s, i) => (
                                <SellerRow key={s.submission_id} s={s} idx={i} onClick={() => navigate(`/shop/${s.shop_slug}`)} />
                            ))}
                            {loadingMore && <RowSkeleton />}
                        </>
                    )}
                {hasMore && !loading && <div ref={sentinelRef} className="h-1" />}
            </div>
        </div>
    );
}