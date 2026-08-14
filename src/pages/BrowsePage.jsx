import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Store, MapPin, ShieldCheck, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BrowseFilterBar from "../components/catalog/BrowseFilterBar";
import BrandItemCard from "../components/catalog/BrandItemCard";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import { TileGridSkeleton, CatalogLoadError } from "../components/catalog/CatalogUI";
import BuySellChoiceSheet from "../components/catalog/BuySellChoiceSheet";
import SellThisItemModal from "../components/catalog/SellThisItemModal";
import { C, EASE } from "../components/catalog/tokens";
import useCatalogBrowse, { DEFAULT_FILTERS } from "../hooks/useCatalogBrowse";
import useShopSearch from "../hooks/useShopSearch";
import { resolveSearchRoute } from "../utils/searchResolve.js";

export default function BrowsePage() {
    const { idOrSlug } = useParams();
    const { state } = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [category] = useState(() => state?.category || null);
    const navigate = useNavigate();

    // const category = state?.category || null;
    const initialQ = searchParams.get("q") || "";

    const { filters, setFilters, items, facets, total, loading, loadingMore, error, hasMore, loadMore, retry } =
        useCatalogBrowse({ categoryId: category?.id || null, q: initialQ });

    const [searchInput, setSearchInput] = useState(initialQ);
    useEffect(() => { setFilters({ q: searchInput }); }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const t = setTimeout(() => {
            const next = new URLSearchParams(searchParams);
            if (filters.q.trim()) next.set("q", filters.q.trim()); else next.delete("q");
            setSearchParams(next, { replace: true, state: { category } }); // preserve it explicitly too
        }, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.q]);

    // Picks up ?q= changes that originate outside this component (e.g. the
    // mobile BottomSearchBar navigating while /browse is already mounted).
    useEffect(() => {
        const urlQ = searchParams.get("q") || "";
        if (urlQ !== searchInput) setSearchInput(urlQ);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Submitting from THIS page's bar only navigates when the term resolves
    // to something exact (a category/brand/product page) — otherwise we're
    // already filtering live via searchInput, so there's nothing else to do.
    // clearOnSubmit is off (see MarketplaceSearchBar) so the box keeps
    // showing what's actually driving the results on screen.
    const handleSearchSubmit = async (term) => {
        const route = await resolveSearchRoute(term);
        if (route) navigate(route.pathname, { state: route.state });
    };

    const { shops, loading: shopsLoading } = useShopSearch(!category ? filters.q : "");
    const showShops = !category && !!filters.q.trim() && shops.length > 0;

    const sentinelRef = useRef(null);
    useEffect(() => {
        const checkSentinel = () => {
            const el = sentinelRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            if (rect.top <= window.innerHeight + 600) loadMore();
        };
        const lenis = window.lenis;
        if (lenis?.on) {
            lenis.on("scroll", checkSentinel);
            checkSentinel();
            return () => lenis.off?.("scroll", checkSentinel);
        }
        window.addEventListener("scroll", checkSentinel, { passive: true });
        window.addEventListener("resize", checkSentinel);
        checkSentinel();
        return () => {
            window.removeEventListener("scroll", checkSentinel);
            window.removeEventListener("resize", checkSentinel);
        };
    }, [loadMore]);

    // Tapping a tile no longer jumps straight to the sellers page — it
    // opens a Buy/Sell choice first (see BuySellChoiceSheet), same idea
    // as tapping a holding in a trading app. `choiceItem` drives that
    // sheet; `sellItem` drives the "list your price" modal once someone
    // picks Sell, so it can stay open here on /browse without a detour
    // through the sellers list.
    const [choiceItem, setChoiceItem] = useState(null);
    const [sellItem, setSellItem] = useState(null);

    const openItem = (item) => setChoiceItem(item);
    const goToSellersPage = (item) => navigate(`/brand-item/${item.slug || item.id}/sellers`, { state: { brand: item } });

    return (
        <div className="mx-auto min-h-screen max-w-7xl px-2.5 pb-10 pt-6 sm:px-4 lg:px-6">
            {/* ---------- Header ---------- */}
            <div className="flex items-start gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white transition-all duration-150 hover:border-black/20 hover:shadow-sm active:scale-95"
                    style={{ borderColor: C.hair, color: C.ink }}
                    aria-label="Back"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate font-extrabold leading-tight tracking-[-0.01em]" style={{ color: C.ink, fontSize: "clamp(20px, 2vw, 28px)" }}>
                        {category ? category.name : (filters.q ? `Results for "${filters.q}"` : "Browse")}
                    </h1>
                    <p className="mt-1 text-[12.5px] font-medium" style={{ color: C.muted }}>
                        {category
                            ? `Browsing every listed product in ${category.name}`
                            : filters.q
                                ? "Matching products across all categories"
                                : "Explore products across every category"}
                    </p>
                </div>
            </div>

            {/* Desktop only — mobile relies solely on the global BottomSearchBar. */}
            <div className="mt-4 hidden md:block">
                <MarketplaceSearchBar
                    value={searchInput}
                    onChange={setSearchInput}
                    onSubmit={handleSearchSubmit}
                    onImageResolved={(result) => navigate("/browse", { state: { imageResult: result } })}
                    clearOnSubmit={false}
                    placeholder={category ? `Search within ${category.name}` : "Search any product, brand, category..."}
                />
            </div>

            <div className="mt-4">
                <BrowseFilterBar filters={filters} setFilters={setFilters} facets={facets} total={total} loading={loading} />
            </div>

            {showShops && (
                <div className="mt-5">
                    <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: C.ink }}>
                        <Store className="h-4 w-4" style={{ color: C.secondary }} /> Shops matching "{filters.q}"
                    </h3>
                    <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {shops.map((shop) => (
                            <button
                                key={shop.id}
                                onClick={() => navigate(`/shop/${shop.shop_slug}`)}
                                className="flex items-center gap-2.5 rounded-2xl border bg-white p-3 text-left hover:bg-black/[0.02]"
                                style={{ borderColor: C.hair }}
                            >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white" style={{ borderColor: C.hair }}>
                                    {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-contain p-1" /> : <Building2 className="h-4 w-4" style={{ color: C.muted }} />}
                                </span>
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1 truncate text-[12.5px] font-extrabold" style={{ color: C.ink }}>
                                        {shop.display_name} <ShieldCheck className="h-3 w-3 shrink-0" style={{ color: C.secondary }} />
                                    </p>
                                    <p className="flex items-center gap-1 truncate text-[10.5px] font-semibold" style={{ color: C.muted }}>
                                        <MapPin className="h-2.5 w-2.5" /> {shop.city}, {shop.state}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-5 overflow-hidden rounded-[24px] border bg-white p-4 sm:p-6" style={{ borderColor: C.hair }}>
                {loading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="aspect-[0.8] animate-pulse rounded-2xl" style={{ background: C.hairSoft }} />
                        ))}
                    </div>
                ) : error ? (
                    <CatalogLoadError onRetry={retry} />
                ) : items.length === 0 ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center px-6 py-14 text-center">
                        <h3 className="text-[15px] font-extrabold" style={{ color: C.ink }}>No products found</h3>
                        <p className="mt-1.5 max-w-xs text-[12.5px] font-medium" style={{ color: C.muted }}>
                            Try clearing a filter or searching a different term.
                        </p>
                    </motion.div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                            {items.map((item, i) => (
                                <BrandItemCard key={item.id} item={item} idx={i} onClick={() => openItem(item)} />
                            ))}
                        </div>
                        {hasMore && (
                            <div ref={sentinelRef} className="mt-4 flex justify-center py-4">
                                {loadingMore && <TileGridSkeleton rows={1} />}
                            </div>
                        )}
                    </>
                )}
            </div>

            <AnimatePresence>
                {choiceItem && (
                    <BuySellChoiceSheet
                        item={choiceItem}
                        onClose={() => setChoiceItem(null)}
                        onBuy={() => {
                            const it = choiceItem;
                            setChoiceItem(null);
                            goToSellersPage(it);
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
        </div>
    );
}