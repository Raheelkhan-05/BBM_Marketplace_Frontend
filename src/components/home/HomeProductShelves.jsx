import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Package, CheckCircle2 } from "lucide-react";
import { searchCategories, fetchGenericProductBrowse } from "../../utils/api";
import { useAuth } from "../../context/AuthContext.jsx";
import useInViewOnce from "../../hooks/useInViewOnce";
import useInfiniteScrollSentinel from "../../hooks/useInfiniteScrollSentinel";

/* ------------------------------------------------------------------
   DESIGN NOTES — HomeProductShelves, v4
   ------------------------------------------------------------------
   v3 was diagnosed correctly as "muddy": two low-saturation accents
   (primary terracotta, secondary teal) alternating every shelf across
   icon chips, prices AND glows, laid on top of translucent full-bleed
   colour bands. That's colour noise stacked on colour noise — nothing
   reads as intentional because nothing is quiet enough to set anything
   else off. Premium reads as *contrast* and *restraint*, not more
   ornament, so this pass removes rather than adds:

     1. ONE ACCENT, NOT TWO ALTERNATING. Primary is now the only
        commercial accent — used exactly twice: the price figure, and
        the hairline that draws in under a card on hover. Secondary
        keeps its actual job elsewhere in this app (QuickActions'
        "Sales" group, the seller badge) — trust/seller signals only:
        seller count and "You sell this". Nothing alternates by index
        anymore, so the eye isn't re-parsing a new colour every row.

     2. NO MORE COLOUR-WASH BANDS. The translucent primary/secondary
        tint under every other shelf is gone. Editorial rhythm now
        comes from generous vertical spacing + a single hairline rule
        between shelves — the printed-catalog cue this was reaching
        for, without smearing colour across a white canvas.

     3. REAL ELEVATION. Card hover is a neutral ink-tinted shadow
        (rgba(11,17,22,…)) with a subtle lift, not a colour-tinted glow.
        Neutral shadow = "this card is physically raised." Colour glow
        = "this card is highlighted for no clear reason." The former
        reads premium, the latter reads like a demo.

     4. PRICE IS THE ONE LOUD THING. Bumped price to a larger, bolder
        figure — the actual hierarchy anchor of the card — with a tiny
        mono "Starting at" caption above it. MOQ / seller count / brand
        all drop to quiet, same-weight captions underneath so there's
        one clear read order instead of four things competing.

     5. Slightly warmer canvas (#FBFCFD, the same token Hero16by9Banner
        already defines) instead of flat white — consistent with the
        rest of the page, and a touch softer than pure #FFF.

   Tokens/easing otherwise unchanged: ink #0B1116, muted #667077,
   primary #D2462B, secondary #006F83, hairline rgba(11,17,22,0.08),
   [0.16,1,0.3,1] easing. Data contract, hooks, caching all identical
   to v2/v3 — this is a visual-only pass.
   ------------------------------------------------------------------ */

const C = {
    canvas: "#FBFCFD",
    ink: "#0B1116",
    muted: "#667077",
    primary: "#D2462B",
    secondary: "#006F83",
    hair: "rgba(11,17,22,0.08)",
    hairSoft: "rgba(11,17,22,0.045)",
    imgBg: "#F4F5F6",
};
const EASE = [0.16, 1, 0.3, 1];

// Matches HomePage's <main> padding exactly — negative-margin bleed only
// works if it cancels out the same value the page uses.
const PAGE_PAD = "px-2.5 sm:px-4 lg:px-6";
const PAGE_PAD_NEG = "-mx-2.5 sm:-mx-4 lg:-mx-6";

const SHELF_PRODUCT_LIMIT = 14;
const INITIAL_SHELF_COUNT = 3;
const SHELVES_PER_BATCH = 3;
const MAX_CATEGORIES = 40; // caps total feed length — "feels infinite", isn't

const SHELF_TITLES = [
    (n) => `Popular in ${n}`,
    (n) => `Top picks in ${n}`,
    (n) => `Trending in ${n}`,
    (n) => `Best sellers in ${n}`,
    (n) => `New listings in ${n}`,
];

// Session-lifetime cache, keyed by category id — same pattern as
// useCatalogBrowse's responseCache.
const shelfCache = new Map();
const SHELF_CACHE_CAP = 60;
function cacheShelf(id, items) {
    shelfCache.set(id, items);
    if (shelfCache.size > SHELF_CACHE_CAP) shelfCache.delete(shelfCache.keys().next().value);
}

/* ---------------- shared eyebrow (reused from Hero / QuickActions) ---------------- */
function PulseEyebrow({ label }) {
    return (
        <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
                <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                    style={{ background: C.primary }}
                />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: C.primary }} />
            </span>
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                {label}
            </span>
        </div>
    );
}

/* ---------------- product card ---------------- */
const ShelfProductCard = memo(function ShelfProductCard({ item, idx, onClick }) {
    const name = item.name || item.product_name || "Product";
    const brandName = item.brand_name;
    const price = item.lowest_price ?? item.price;
    const sellerCount = item.seller_count;
    const moq = item.moq;
    const unit = item.unit;
    const image = item.image || item.images?.[0];

    return (
        <motion.button
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.24), ease: EASE }}
            whileTap={{ y: 0, scale: 0.97 }}
            className="group/card flex w-[142px] shrink-0 snap-start flex-col items-start gap-2 text-left outline-none sm:w-[172px]"
        >
            <span
                className="relative flex aspect-[0.82] w-full items-center justify-center overflow-hidden rounded-2xl border transition-all duration-300 ease-out group-hover/card:-translate-y-1 group-hover/card:shadow-[0_18px_32px_-16px_rgba(11,17,22,0.22)] group-focus-visible/card:-translate-y-1 group-focus-visible/card:shadow-[0_18px_32px_-16px_rgba(11,17,22,0.22)]"
                style={{ borderColor: C.hair, background: C.imgBg, boxShadow: "0 1px 2px rgba(11,17,22,0.04)" }}
            >
                {image ? (
                    <img
                        src={image}
                        alt={name}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-[1.05]"
                    />
                ) : (
                    <Package className="h-6 w-6" style={{ color: C.muted }} />
                )}
                {item.has_own_listing && (
                    <span
                        className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white"
                        style={{ background: C.secondary }}
                    >
                        You sell this
                    </span>
                )}
                {/* the one accent moment — a hairline that draws in under the
                    image on hover, echoing QuickActionsJustBelowBanner's
                    desktop-tile underline device */}
                <span
                    className="pointer-events-none absolute inset-x-3 bottom-0 h-[2px] scale-x-0 rounded-full transition-transform duration-300 ease-out group-hover/card:scale-x-100"
                    style={{ background: C.primary, transformOrigin: "left" }}
                />
            </span>
            <div className="w-full">
                <p className="line-clamp-2 text-[12.5px] font-bold leading-tight tracking-[-0.005em] sm:text-[13.5px]" style={{ color: C.ink }}>
                    {name}
                </p>
                {brandName && (
                    <p className="mt-0.5 truncate text-[10.5px] font-medium" style={{ color: C.muted }}>
                        {brandName}
                    </p>
                )}
                <div className="mt-1.5">
                    {price != null && (
                        <p className="font-mono text-[8.5px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
                            Starting at
                        </p>
                    )}
                    <p className="text-[16px] font-extrabold leading-none tabular-nums" style={{ color: price != null ? C.ink : C.muted }}>
                        {price != null ? (
                            <>
                                <span style={{ color: C.primary }}>₹</span>
                                {price}
                            </>
                        ) : (
                            "View price"
                        )}
                    </p>
                </div>
                {(moq != null || sellerCount > 1) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5">
                        {moq != null && (
                            <span className="text-[10px] font-semibold tabular-nums" style={{ color: C.muted }}>
                                MOQ {moq}{unit ? ` ${unit}` : ""}
                            </span>
                        )}
                        {moq != null && sellerCount > 1 && (
                            <span className="text-[10px]" style={{ color: C.hair }}>·</span>
                        )}
                        {sellerCount > 1 && (
                            <span className="text-[10px] font-bold" style={{ color: C.secondary }}>
                                {sellerCount} sellers
                            </span>
                        )}
                    </div>
                )}
            </div>
        </motion.button>
    );
});

function ShelfCardSkeleton() {
    return (
        <div className="flex w-[142px] shrink-0 flex-col gap-2 sm:w-[172px]">
            <div className="aspect-[0.82] w-full animate-pulse rounded-2xl" style={{ background: C.hairSoft }} />
            <div className="h-2.5 w-4/5 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
            <div className="h-3.5 w-2/5 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
        </div>
    );
}

// Hairline progress track under the rail — mirrors Hero16by9Banner's
// mono index + accent progress line, driven by real scroll position
// rather than an autoplay timer. Neutral track, single primary fill —
// no per-shelf colour switching.
function RailProgress({ scrollRef, itemCount }) {
    const [ratio, setRatio] = useState(0);
    const [span, setSpan] = useState(1);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const update = () => {
            const { scrollLeft, scrollWidth, clientWidth } = el;
            const max = scrollWidth - clientWidth;
            setRatio(max > 0 ? Math.min(1, Math.max(0, scrollLeft / max)) : 0);
            setSpan(scrollWidth > 0 ? Math.min(1, clientWidth / scrollWidth) : 1);
        };
        update();
        el.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        return () => {
            el.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollRef, itemCount]);

    if (span >= 1) return null; // everything fits on screen — nothing to indicate

    const trackWidth = 56; // px
    const fillWidth = Math.max(10, trackWidth * span);
    const travel = trackWidth - fillWidth;

    return (
        <div className={`hidden items-center gap-2 sm:flex ${PAGE_PAD}`}>
            <span className="relative block h-[2.5px] shrink-0 overflow-hidden rounded-full" style={{ width: trackWidth, background: C.hairSoft }}>
                <span
                    className="absolute left-0 top-0 h-full rounded-full transition-transform duration-150 ease-out"
                    style={{ width: fillWidth, background: C.primary, transform: `translateX(${ratio * travel}px)` }}
                />
            </span>
        </div>
    );
}

/* ---------------- one shelf ---------------- */
const ProductShelf = memo(function ProductShelf({ category, idx, token, isFirst }) {
    const navigate = useNavigate();
    const [ref, inView] = useInViewOnce({ lookahead: 500 });
    const [items, setItems] = useState(() => shelfCache.get(category.id) || null);
    const [loading, setLoading] = useState(!shelfCache.has(category.id));
    const [error, setError] = useState(false);
    const railRef = useRef(null);

    useEffect(() => {
        if (!inView || shelfCache.has(category.id)) return;
        let cancelled = false;
        const controller = new AbortController();
        setLoading(true);
        setError(false);
        fetchGenericProductBrowse(
            { categoryId: category.id, subcategoryIds: [], q: "", sort: "relevance", limit: SHELF_PRODUCT_LIMIT, offset: 0 },
            controller.signal,
            token
        )
            .then((res) => {
                if (cancelled) return;
                if (!res?.success) throw new Error("failed");
                cacheShelf(category.id, res.items || []);
                setItems(res.items || []);
            })
            .catch(() => { if (!cancelled) setError(true); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; controller.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inView, category.id, token]);

    const openCategory = () => navigate(`/category/${category.slug || category.id}/browse`, { state: { category } });
    const openProduct = (item) => navigate(`/product/${item.slug || item.id}/sellers`, { state: { genericProduct: item, category } });

    // A category with zero live products just doesn't exist in the feed
    // once we know that — no dead-end empty rails.
    if (!loading && !error && items && items.length === 0) return null;

    const title = SHELF_TITLES[idx % SHELF_TITLES.length](category.name);

    return (
        <motion.section
            ref={ref}
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, ease: EASE }}
            className="space-y-3 py-6 ps-3"
            style={{ borderTop: isFirst ? "none" : `1px solid ${C.hairSoft}` }}
        >
            <div className={`flex items-center justify-between ${PAGE_PAD}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                    <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                        style={{ background: C.hairSoft }}
                    >
                        {category.image ? (
                            <img src={category.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                            <Package className="h-4 w-4" style={{ color: C.muted }} />
                        )}
                    </span>
                    <h3 className="truncate text-[16px] font-extrabold leading-tight tracking-[-0.008em] sm:text-[18.5px]" style={{ color: C.ink }}>
                        {title}
                    </h3>
                </div>
                <button
                    onClick={openCategory}
                    className="group flex shrink-0 items-center gap-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide transition-colors duration-150 hover:opacity-70"
                    style={{ color: C.primary }}
                >
                    See all
                    <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </button>
            </div>

            {/* Edge-to-edge rail: bleeds past the page's own padding via
                matching negative margins, then re-applies that same padding
                inside so the first card still lines up with the rest of the
                page at rest. */}
            <div
                className={`overflow-hidden ${PAGE_PAD_NEG}`}
                style={{
                    maskImage: "linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
                }}
            >
                <div
                    ref={railRef}
                    className={`flex snap-x snap-proximity gap-3.5 overflow-x-auto pb-1 ${PAGE_PAD} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
                >
                    {loading || !items ? (
                        Array.from({ length: 6 }).map((_, i) => <ShelfCardSkeleton key={i} />)
                    ) : error ? (
                        <p className="py-6 text-[12.5px] font-medium" style={{ color: C.muted }}>
                            Couldn't load this section.
                        </p>
                    ) : (
                        items.map((item, i) => (
                            <ShelfProductCard key={item.id} item={item} idx={i} onClick={() => openProduct(item)} />
                        ))
                    )}
                </div>
            </div>

            {!loading && !error && items && items.length > 0 && (
                <RailProgress scrollRef={railRef} itemCount={items.length} />
            )}
        </motion.section>
    );
});

/* ---------------- feed ---------------- */
export default function HomeProductShelves() {
    const { token } = useAuth();
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [visibleCount, setVisibleCount] = useState(INITIAL_SHELF_COUNT);
    const revealLockRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        searchCategories("", MAX_CATEGORIES)
            .then((res) => {
                if (cancelled) return;
                if (res?.success) setCategories(res.items || []);
            })
            .catch(() => { })
            .finally(() => { if (!cancelled) setCategoriesLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const hasMore = visibleCount < categories.length;

    // Called on every qualifying Lenis scroll tick (see
    // useInfiniteScrollSentinel) — guards its own re-entrancy the same
    // way loadMore() does in useCatalogBrowse, instead of relying on a
    // timed "revealing" flag.
    const handleNearBottom = useCallback(() => {
        if (revealLockRef.current) return;
        setVisibleCount((c) => {
            if (c >= categories.length) return c;
            revealLockRef.current = true;
            setTimeout(() => { revealLockRef.current = false; }, 250);
            return Math.min(c + SHELVES_PER_BATCH, categories.length);
        });
    }, [categories.length]);

    const sentinelRef = useInfiniteScrollSentinel(handleNearBottom, {
        lookahead: 900,
        disabled: !hasMore || categoriesLoading,
    });

    const visibleCategories = useMemo(() => categories.slice(0, visibleCount), [categories, visibleCount]);

    if (!categoriesLoading && categories.length === 0) return null;

    return (
        <div className="rounded-[20px]" style={{ background: C.canvas }}>
            <div className={`space-y-2 pb-2 pt-6 ${PAGE_PAD}`}>
                <PulseEyebrow label="Live catalog" />
                <h2
                    className="font-extrabold leading-[0.98] tracking-[-0.015em]"
                    style={{ color: C.ink, fontSize: "clamp(22px, 2.1vw, 32px)" }}
                >
                    More to explore
                </h2>
                <p className="max-w-sm text-[13px] font-medium leading-relaxed" style={{ color: C.muted }}>
                    Fresh picks from every category on the marketplace.
                </p>
            </div>

            {categoriesLoading
                ? Array.from({ length: INITIAL_SHELF_COUNT }).map((_, i) => (
                    <div key={i} className="space-y-3 py-6" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.hairSoft}` }}>
                        <div className={`h-5 w-40 animate-pulse rounded-full ${PAGE_PAD}`} style={{ background: C.hairSoft }} />
                        <div className={`flex gap-3.5 overflow-hidden ${PAGE_PAD}`}>
                            {Array.from({ length: 6 }).map((_, j) => <ShelfCardSkeleton key={j} />)}
                        </div>
                    </div>
                ))
                : visibleCategories.map((cat, i) => (
                    <ProductShelf key={cat.id} category={cat} idx={i} token={token} isFirst={i === 0} />
                ))}

            {hasMore ? (
                <div ref={sentinelRef} className="flex justify-center py-5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: C.hair }} />
                </div>
            ) : (
                !categoriesLoading && (
                    <div className={`flex flex-col items-center gap-1.5 py-9 text-center ${PAGE_PAD}`}>
                        <CheckCircle2 className="h-5 w-5" style={{ color: C.secondary }} />
                        <p className="text-[12.5px] font-bold" style={{ color: C.ink }}>You're all caught up</p>
                        <p className="max-w-xs text-[11.5px] font-medium" style={{ color: C.muted }}>
                            That's every category with live listings right now.
                        </p>
                    </div>
                )
            )}
        </div>
    );
}