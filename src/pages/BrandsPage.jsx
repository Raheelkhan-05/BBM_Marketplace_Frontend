// src/pages/BrandsPage.jsx
//
// Logo grid of every brand, with search and infinite scroll. Tapping a brand
// opens the Home feed filtered to that brand: /brand/<name>. The feed
// applies all the usual rules (wallet, visibility, custom prices, expiry).
//
// CATEGORY FILTER: when a category is applied (header chip / sidebar), only brands that have
// products in it are listed and the product counts are for that category. A notice says so and
// offers "Show all". Clicking a brand keeps the category applied, so the Home feed matches the count.
//
// Seamless-experience features:
//  - Coming back from a brand (browser back) restores the list AND scroll position instantly
//    from an in-memory cache (keyed by viewer + category + search).
//  - Search text lives in the URL (?q=), so it survives refresh / back / share.
//  - While a new search loads, the old results stay visible (dimmed). A CATEGORY change clears
//    the list instead, so brands of the previous category are never shown.
//  - Logos fade in over a placeholder; load-more failures retry inline.
//  - Enter applies the search immediately; Esc clears. Matched text is highlighted.
//  - Dense responsive grid, back-to-top button, safe-area aware, reduced-motion friendly.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUp, Search, X, Loader2, Tags, ListFilter } from "lucide-react";
import { fetchBrandsPage } from "../utils/api";
import useInfiniteScrollSentinel from "../hooks/useInfiniteScrollSentinel";
import { filterLabel } from "../hooks/useCategories.js";
import { resizedImageUrl } from "../utils/imageUrl";
import { useAuth } from "../context/AuthContext.jsx";
import { useHomeFilters } from "../context/HomeFiltersContext.jsx";
import Seo from "../components/Seo.jsx";

const INK = "#0B1116";
const MUTED = "#667077";
const HAIR_SOFT = "rgba(11,17,22,0.05)";
const ACCENT = "#53344D";
const FILTER_BLUE = "#0765CD";
const PAGE = 48;
const DEBOUNCE_MS = 250;
const CACHE_TTL_MS = 5 * 60 * 1000;
const BACK_TO_TOP_AFTER_PX = 1200;

// ── In-memory cache (lives as long as the SPA session) ──────────────────────
// key: viewer + category + search term → { brands, hasMore, scrollY, ts }
const listCache = new Map();
const cacheKey = (viewer, categoryId, q) => `${viewer}::${categoryId || "all"}::${q}`;

function readCache(viewer, categoryId, q) {
    const k = cacheKey(viewer, categoryId, q);
    const entry = listCache.get(k);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        listCache.delete(k);
        return null;
    }
    return entry;
}

// ── Small pieces ────────────────────────────────────────────────────────────

function HighlightedName({ name, term }) {
    const t = term.trim();
    if (!t) return <>{name}</>;
    const idx = name.toLowerCase().indexOf(t.toLowerCase());
    if (idx === -1) return <>{name}</>;
    return (
        <>
            {name.slice(0, idx)}
            <mark className="rounded-sm bg-transparent" style={{ color: ACCENT, textDecoration: "underline", textUnderlineOffset: 2, textDecorationThickness: 1.5 }}>
                {name.slice(idx, idx + t.length)}
            </mark>
            {name.slice(idx + t.length)}
        </>
    );
}

function BrandLogo({ src, name }) {
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        const el = imgRef.current;
        if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
    }, [src]);

    if (!src || failed) {
        return (
            <span
                className="flex aspect-square w-1/2 max-w-[28px] items-center justify-center rounded-full text-[8px] font-extrabold tracking-wide sm:text-[9px] lg:text-[10px]"
                style={{ background: HAIR_SOFT, color: ACCENT }}
                aria-label={`${name} logo`}
            >
                {name.trim().split(/\s+/).map((word) => word[0]).join("").toUpperCase()}
            </span>
        );
    }
    return (
        <div className="relative h-full w-full">
            {!loaded && (
                <div className="absolute inset-0.5 animate-pulse rounded-xl motion-reduce:animate-none" style={{ background: HAIR_SOFT }} />
            )}
            <img
                ref={imgRef}
                src={resizedImageUrl(src, { width: 240 })}
                srcSet={[120, 240, 360].map((w) => `${resizedImageUrl(src, { width: w })} ${w}w`).join(", ")}
                sizes="(min-width: 1280px) 95px, (min-width: 1024px) 10vw, (min-width: 768px) 12vw, (min-width: 640px) 14vw, 17vw"
                alt={`${name} logo`}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
                className={`h-full w-full aspect-square object-contain rounded-xl transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
            />
        </div>
    );
}

function BrandCardSkeleton() {
    return (
        <div className="flex flex-col items-center">
            <div className="aspect-square w-full animate-pulse rounded-xl motion-reduce:animate-none" style={{ background: HAIR_SOFT }} />
            <div className="mt-1.5 h-2 w-3/5 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: HAIR_SOFT }} />
            <div className="mt-1 h-1.5 w-2/5 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: HAIR_SOFT }} />
        </div>
    );
}

// "Showing only X in <category>" notice with a one-tap way back to the full list.
function CategoryNotice({ label, noun, onClear }) {
    return (
        <div
            role="status"
            className="mb-4 flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
            style={{ background: "#EAF2FD", borderColor: "#C9DDF7" }}
        >
            <ListFilter className="h-4 w-4 shrink-0" style={{ color: FILTER_BLUE }} strokeWidth={2.4} />
            <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug tracking-wide" style={{ color: INK }}>
                Showing only {noun} with products in{" "}
                <b className="font-extrabold" style={{ color: FILTER_BLUE }}>{label}</b>
            </p>
            <button
                type="button"
                onClick={onClear}
                className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-extrabold tracking-wide transition active:scale-95 hover:bg-[#F4F8FE]"
                style={{ color: FILTER_BLUE }}
            >
                Show all {noun}
            </button>
        </div>
    );
}

const GRID = "grid grid-cols-4 gap-x-7 gap-y-3 sm:grid-cols-5 sm:gap-x-8 md:grid-cols-6 lg:grid-cols-9 lg:gap-x-5 lg:gap-y-5 xl:grid-cols-12";

// ── Page ────────────────────────────────────────────────────────────────────

export default function BrandsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQ = (searchParams.get("q") || "").trim();

    const { token } = useAuth();
    const { activeCategory, activeSubcategory, setCategoryFilter } = useHomeFilters();
    const categoryId = activeCategory?.id || null;
    const subcategoryId = activeSubcategory?.id || null;
    // One key for "which filter is applied": drives the cache, resets and refetches.
    const filterKey = subcategoryId ? `${categoryId}/${subcategoryId}` : categoryId;
    const filterText = activeCategory ? filterLabel(activeCategory, activeSubcategory) : "";
    const viewer = token || "guest";

    const viewerRef = useRef(viewer);
    viewerRef.current = viewer;
    const categoryRef = useRef(filterKey);
    categoryRef.current = filterKey;

    const initialCache = useRef(readCache(viewer, filterKey, initialQ)).current;

    const [input, setInput] = useState(initialQ);
    const [q, setQ] = useState(initialQ);
    const [brands, setBrands] = useState(initialCache?.brands ?? []);
    const [loading, setLoading] = useState(!initialCache);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(initialCache?.hasMore ?? true);
    const [error, setError] = useState(null);
    const [moreError, setMoreError] = useState(false);
    const [showTop, setShowTop] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    const abortRef = useRef(null);
    const seqRef = useRef(0);
    const listRef = useRef(initialCache?.brands ?? []);
    const qRef = useRef(initialQ);
    const scrollYRef = useRef(0);
    const firstRunRef = useRef(true);
    const prevCategoryRef = useRef(filterKey);
    const inputRef = useRef(null);

    qRef.current = q;

    // Debounce the search box
    useEffect(() => {
        const t = setTimeout(() => setQ(input.trim()), DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [input]);

    // Keep ?q= in the URL in sync
    useEffect(() => {
        const current = (searchParams.get("q") || "").trim();
        if (current === q) return;
        const next = new URLSearchParams(searchParams);
        if (q) next.set("q", q);
        else next.delete("q");
        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const load = useCallback((offset, append) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const seq = ++seqRef.current;
        (append ? setLoadingMore : setLoading)(true);
        setError(null);
        setMoreError(false);

        fetchBrandsPage({ q, limit: PAGE, offset, categoryId, subcategoryId, signal: controller.signal, token })
            .then((res) => {
                if (seq !== seqRef.current) return;
                if (!res?.success) throw new Error("bad response");
                const incoming = res.brands || [];
                let next;
                if (!append) {
                    next = incoming;
                } else {
                    const seen = new Set(listRef.current.map((b) => b.brand_name.toLowerCase()));
                    next = [...listRef.current, ...incoming.filter((b) => !seen.has(b.brand_name.toLowerCase()))];
                }
                listRef.current = next;
                setBrands(next);
                setHasMore(!!res.hasMore);
                listCache.set(cacheKey(viewer, filterKey, q), { brands: next, hasMore: !!res.hasMore, scrollY: 0, ts: Date.now() });
            })
            .catch((err) => {
                if (err?.name === "AbortError") return;
                if (seq !== seqRef.current) return;
                if (append) {
                    setMoreError(true);
                } else {
                    setError("Couldn't load brands.");
                    setHasMore(false);
                }
            })
            .finally(() => {
                if (seq !== seqRef.current) return;
                setLoading(false);
                setLoadingMore(false);
            });
    }, [q, token, viewer, categoryId, subcategoryId, filterKey]);

    // Search term or category changed (or first mount)
    useEffect(() => {
        const isFirst = firstRunRef.current;
        firstRunRef.current = false;

        const categoryChanged = prevCategoryRef.current !== filterKey;
        prevCategoryRef.current = filterKey;

        const cached = readCache(viewer, filterKey, q);
        if (cached) {
            abortRef.current?.abort();
            seqRef.current += 1;
            listRef.current = cached.brands;
            setBrands(cached.brands);
            setHasMore(cached.hasMore);
            setLoading(false);
            setLoadingMore(false);
            setError(null);
            setMoreError(false);
            if (isFirst && cached.scrollY > 0) {
                requestAnimationFrame(() => window.scrollTo(0, cached.scrollY));
            } else if (!isFirst) {
                window.scrollTo({ top: 0 });
            }
            return;
        }

        if (!isFirst) window.scrollTo({ top: 0 });
        // A different category must never show the previous category's brands, even dimmed.
        if (categoryChanged) {
            listRef.current = [];
            setBrands([]);
        }
        setHasMore(true);
        load(0, false);
        return () => abortRef.current?.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, filterKey, load]);

    // Track scroll for restore + back-to-top; save position on leave
    useEffect(() => {
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                scrollYRef.current = window.scrollY;
                setShowTop(window.scrollY > BACK_TO_TOP_AFTER_PX);
                setScrolled(window.scrollY > 4);
                ticking = false;
            });
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            const key = cacheKey(viewerRef.current, categoryRef.current, qRef.current);
            const entry = listCache.get(key);
            if (entry) listCache.set(key, { ...entry, scrollY: scrollYRef.current });
        };
    }, []);

    const sentinelRef = useInfiniteScrollSentinel(
        () => !loadingMore && hasMore && load(listRef.current.length, true),
        { lookahead: 600, disabled: loading || loadingMore || !hasMore || !!error || moreError }
    );

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            setQ(input.trim());
            e.currentTarget.blur();
        } else if (e.key === "Escape" && input) {
            setInput("");
        }
    };

    const clearSearch = () => {
        setInput("");
        inputRef.current?.focus();
    };
    const clearCategory = () => setCategoryFilter(null, null);

    const showSkeleton = loading && brands.length === 0;
    const refreshing = loading && brands.length > 0;

    return (
        <div className="min-h-screen bg-white text-slate-900 antialiased">
            <Seo
                title="Brands on BBM – Shop wholesale products by brand"
                description="Browse industrial and wholesale brands on BBM. Compare verified sellers, MOQs and delivery times for every brand."
                path="/brands"
                noindex={!!q || !!categoryId}
            />
            <header
                className={`sticky top-[var(--bbm-header-h,0px)] z-30 bg-white/95 backdrop-blur transition-shadow duration-200 ${scrolled ? "shadow-[0_6px_16px_-12px_rgba(11,17,22,0.35)]" : ""}`}
            >
                <div className="mx-auto px-3 pb-3 pt-3 sm:px-4 lg:px-6">
                    <div className="flex items-center gap-2">
                        <Link
                            to="/home"
                            aria-label="Back to products"
                            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            style={{ outlineColor: ACCENT }}
                        >
                            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} style={{ color: INK }} />
                        </Link>
                        <h1 className="text-[17px] font-extrabold tracking-wide" style={{ color: INK }}>Brands</h1>
                        <p className="mt-1 px-1 text-[12px] font-medium sr-only" style={{ color: MUTED }}>
                            Browse wholesale products by brand and compare verified sellers on BBM.
                        </p>
                    </div>

                    <div className="relative mt-3" role="search">
                        {refreshing ? (
                            <Loader2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" style={{ color: ACCENT }} />
                        ) : (
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: MUTED }} />
                        )}
                        <input
                            ref={inputRef}
                            type="search"
                            inputMode="search"
                            enterKeyHint="search"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={activeCategory ? `Search brands in ${filterText}…` : "Search brands…"}
                            aria-label="Search brands"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            className="h-11 w-full rounded-full border-0 pl-10 pr-10 text-[13px] tracking-wide outline-none transition-shadow focus:shadow-[0_0_0_2px_rgba(83,52,77,0.35)] [&::-webkit-search-cancel-button]:hidden"
                            style={{ background: HAIR_SOFT, color: INK }}
                        />
                        {input && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={clearSearch}
                                aria-label="Clear search"
                                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/[0.06]"
                            >
                                <X className="h-3.5 w-3.5" style={{ color: MUTED }} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto px-3 pb-16 pt-4 sm:px-4 lg:px-6" aria-busy={loading}>
                <p className="sr-only" role="status" aria-live="polite">
                    {loading ? "Loading brands" : brands.length ? `${brands.length} brands shown` : ""}
                </p>

                {activeCategory && <CategoryNotice label={filterText} noun="brands" onClear={clearCategory} />}

                {showSkeleton ? (
                    <div className={GRID}>
                        {Array.from({ length: 18 }).map((_, i) => <BrandCardSkeleton key={i} />)}
                    </div>
                ) : error && brands.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-20 text-center">
                        <p className="text-[13px] font-bold" style={{ color: INK }}>{error}</p>
                        <p className="text-[11.5px] font-medium" style={{ color: MUTED }}>Check your connection and try again.</p>
                        <button
                            type="button"
                            onClick={() => { setHasMore(true); load(0, false); }}
                            className="rounded-full px-4 py-2 text-[12px] font-extrabold tracking-wide text-white"
                            style={{ background: ACCENT }}
                        >
                            Try again
                        </button>
                    </div>
                ) : brands.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-20 text-center">
                        <Tags className="h-6 w-6" style={{ color: MUTED }} />
                        <p className="text-[13px] font-bold" style={{ color: INK }}>
                            {q
                                ? `No brands match “${q}”${activeCategory ? ` in ${filterText}` : ""}`
                                : activeCategory
                                    ? `No brands have products in ${filterText} yet`
                                    : "No brands available yet"}
                        </p>
                        {q && <p className="text-[11.5px] font-medium" style={{ color: MUTED }}>Check the spelling or try a shorter name.</p>}
                        <div className="mt-2 flex flex-wrap justify-center gap-2">
                            {q && (
                                <button
                                    type="button"
                                    onClick={clearSearch}
                                    className="rounded-full px-4 py-2 text-[12px] font-extrabold tracking-wide"
                                    style={{ background: HAIR_SOFT, color: ACCENT }}
                                >
                                    Clear search
                                </button>
                            )}
                            {activeCategory && (
                                <button
                                    type="button"
                                    onClick={clearCategory}
                                    className="rounded-full px-4 py-2 text-[12px] font-extrabold tracking-wide text-white"
                                    style={{ background: FILTER_BLUE }}
                                >
                                    Show all brands
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className={`${GRID} transition-opacity duration-200 motion-reduce:transition-none ${refreshing ? "opacity-50" : "opacity-100"}`}>
                        {brands.map((b) => (
                            <Link
                                key={b.brand_name.toLowerCase()}
                                to={`/brand/${encodeURIComponent(b.brand_name)}`}
                                state={{ brandImage: b.brand_image || null }}
                                className="group flex min-w-0 flex-col items-center rounded-xl text-center transition-transform duration-200 active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                style={{ outlineColor: ACCENT }}
                            >
                                <div className="flex aspect-square w-full items-center justify-center p-1.5 transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 sm:p-2">
                                    <BrandLogo src={b.brand_image} name={b.brand_name} />
                                </div>
                                <p className="mt-0.5 w-full truncate px-0.5 text-[12px] font-extrabold tracking-wide sm:text-[13px] lg:text-[13px] capitalize" style={{ color: INK }}>
                                    <HighlightedName name={b.brand_name} term={q} />
                                </p>
                                <p className="w-full truncate px-0.5 text-[10px] font-medium tracking-wider sm:text-[10px] lg:text-[10px] capitalize" style={{ color: MUTED }}>
                                    {b.item_count} product{Number(b.item_count) === 1 ? "" : "s"}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}

                {loadingMore && (
                    <div className="mt-3">
                        <div className={GRID}>
                            {Array.from({ length: 6 }).map((_, i) => <BrandCardSkeleton key={i} />)}
                        </div>
                    </div>
                )}

                {moreError && (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <p className="text-[12px] font-bold" style={{ color: INK }}>Couldn't load more brands.</p>
                        <button
                            type="button"
                            onClick={() => load(listRef.current.length, true)}
                            className="rounded-full px-4 py-2 text-[12px] font-extrabold tracking-wide text-white"
                            style={{ background: ACCENT }}
                        >
                            Try again
                        </button>
                    </div>
                )}

                {!hasMore && !loading && brands.length > PAGE && (
                    <p className="py-8 text-center text-[11.5px] font-medium tracking-wide" style={{ color: MUTED }}>
                        You've seen all {brands.length} brands
                    </p>
                )}

                {hasMore && !loading && !moreError && <div ref={sentinelRef} className="h-1" />}
            </main>

            <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
                aria-label="Back to top"
                tabIndex={showTop ? 0 : -1}
                className={`fixed right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg shadow-black/20 transition-[opacity,transform] duration-200 motion-reduce:transition-none ${showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
                style={{ background: ACCENT, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
            >
                <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
            </button>
        </div>
    );
}