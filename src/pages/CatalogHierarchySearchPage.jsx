import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Plus, SlidersHorizontal, ArrowUpDown, Store, Box, ShieldCheck, MapPin, Building2, Package, Maximize2, Users } from "lucide-react";
import SellThisItemModal from "../components/SellThisItemModal.jsx";
import { AnimatePresence } from "framer-motion";
import ImageLightbox from "../components/ImageLightbox.jsx";
import useCatalogHierarchySearch from "../hooks/useCatalogHierarchySearch";
import useShopSearch from "../hooks/useShopSearch";
import { IconTile, TileGrid, TileGridSkeleton, SellerRow, SellerListSkeleton, FilterSortChips, CatalogLoadError } from "../components/catalog/CatalogUI";
import { C, EASE } from "../components/catalog/tokens";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import StackedImagePreview from "../components/StackedImagePreview.jsx";
import BuyNowModal from "../components/BuyNowModal.jsx";

/* ------------------------------------------------------------------
   DESIGN NOTES — CatalogHierarchySearchPage
   ------------------------------------------------------------------
   Same design system as CategoriesPage / CategorySubcategoriesPage:
   ink #0B1116, muted #667077, primary #D2462B, secondary #006F83,
   hairline rgba(11,17,22,0.09), [0.16,1,0.3,1] easing, same IconTile
   square-grid rail for category/subcategory/generic_product/brand_item
   levels. The seller level (and the shop-match panel) swaps to a
   row-list layout since a seller card needs a name, location, and
   price line rather than a square thumbnail — but uses the same
   color tokens and card language as BrandItemSellersPage so a seller
   looks the same across every browse surface.
   ------------------------------------------------------------------ */

const LEVEL_LABEL = {
    category: "Categories",
    subcategory: "Subcategories",
    generic_product: "Products",
    brand_item: "Brands",
    seller: "Sellers",
};
const LEVEL_PLACEHOLDER = {
    category: "Search categories (e.g. Bearings, Lubricants)",
    subcategory: "Search subcategories",
    generic_product: "Search products",
    brand_item: "Search brands",
    seller: "Search sellers",
};
const TILE_LEVELS = new Set(["category", "subcategory", "generic_product", "brand_item"]);

function SellerHeroSkeleton() {
    return (
        <div className="mt-3 flex gap-4 rounded-[28px] border bg-white p-4 sm:p-5" style={{ borderColor: C.hair }}>
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-2xl sm:h-28 sm:w-28" style={{ background: C.hairSoft }} />
            <div className="flex-1 py-1">
                <div className="h-2.5 w-1/4 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
                <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full" style={{ background: C.hairSoft }} />
            </div>
        </div>
    );
}

function ShopRow({ shop, idx, isLast }) {
    const navigate = useNavigate();
    return (
        <motion.button
            onClick={() => navigate(`/shop/${shop.shop_slug}`)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3), ease: EASE }}
            className={`flex w-full items-center gap-2.5 py-2.5 text-left transition-colors duration-150 active:bg-black/[0.02] sm:gap-3 sm:rounded-2xl sm:border sm:bg-white sm:p-4 sm:hover:bg-black/[0.02] ${!isLast ? "border-b sm:border-b-0" : ""}`}
            style={{ borderColor: C.hair }}
        >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white sm:h-12 sm:w-12" style={{ borderColor: C.hair }}>
                {shop.logo_url ? (
                    <img src={shop.logo_url} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: C.muted }} />
                )}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 sm:gap-1.5">
                    <p className="truncate text-[12.5px] font-extrabold sm:text-[13.5px]" style={{ color: C.ink }}>{shop.display_name}</p>
                    <ShieldCheck className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" style={{ color: C.secondary }} />
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] font-semibold sm:text-[11.5px]" style={{ color: C.muted }}>
                    {shop.business_type && <span>{shop.business_type} · </span>}
                    <MapPin className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />{shop.city}, {shop.state}
                </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" style={{ color: C.muted }} />
        </motion.button>
    );
}

function EmptyState({ level, query }) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${C.secondary}12`, color: C.secondary }}>
                <Box className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 text-[15px] font-extrabold" style={{ color: C.ink }}>
                No {LEVEL_LABEL[level]?.toLowerCase()} found{query ? ` for "${query}"` : ""}
            </h3>
            <p className="mt-1.5 max-w-xs text-[12.5px] font-medium" style={{ color: C.muted }}>
                Try a different keyword, or use the back button to go up a level.
            </p>
        </motion.div>
    );
}

export default function CatalogHierarchySearchPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const initialQuery = searchParams.get("q") || "";

    const [showLightbox, setShowLightbox] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [showSellModal, setShowSellModal] = useState(false);

    const [buySeller, setBuySeller] = useState(null);

    const {
        stack, currentLevel, parent, query, setQuery,
        items, suggestions, loading, loadingMore, hasMore, error, retry,
        selectItem, selectSuggestion, loadMore, goBack, goToBreadcrumb, canGoBack,
    } = useCatalogHierarchySearch(initialQuery);

    const brandHero = currentLevel === "seller" ? parent : null;
    const brandHeroImages = brandHero?.images?.length ? brandHero.images : (brandHero?.image ? [brandHero.image] : []);

    const lowestPrice = useMemo(() => {
        if (currentLevel !== "seller") return null;
        const priced = items.filter((s) => s.price != null && s.price > 0);
        if (!priced.length) return null;
        return priced.reduce((min, s) => (s.price < min.price ? s : min), priced[0]);
    }, [items, currentLevel]);

    const [inputValue, setInputValue] = useState(initialQuery);
    const { shops, loading: shopsLoading } = useShopSearch(stack.length === 0 ? query : "");

    useEffect(() => setInputValue(query), [query]);
    useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [query]);

    // Infinite scroll sentinel. Same approach as CatalogLevelPage: check
    // the sentinel's position directly on Lenis's own scroll tick rather
    // than IntersectionObserver, since Lenis scrolls via CSS transform
    // (with html/body overflow hidden) rather than native scrolling, and
    // that can make IntersectionObserver unreliable.
    const sentinelRef = useRef(null);
    const showingSuggestionsForScroll = !loading && items.length === 0 && suggestions.length > 0;
    useEffect(() => {
        // Don't paginate while showing "did you mean" suggestions — those
        // aren't a paginated list, and there's nothing to load more of.
        if (showingSuggestionsForScroll) return;

        const checkSentinel = () => {
            const el = sentinelRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const buffer = 600;
            if (rect.top <= window.innerHeight + buffer) loadMore();
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
    }, [loadMore, showingSuggestionsForScroll]);

    function handleBack() {
        if (canGoBack) goBack();
        else navigate(-1);
    }

    function handleSelect(item) {
        if (currentLevel === "seller") {
            setBuySeller(item);
            return;
        }
        selectItem(item);
    }

    const showingSuggestions = !loading && items.length === 0 && suggestions.length > 0;
    const showShops = stack.length === 0 && !!query.trim() && shops.length > 0;

    return (
        <div className="mx-auto min-h-screen max-w-7xl px-2.5 pb-10 pt-3 sm:px-4 lg:px-6">
            {/* header: back + title */}
            <div className="mt-3 flex items-center justify-between gap-3 sm:mb-1">
                <div className="flex min-w-0 items-center gap-3">

                    <button
                        onClick={handleBack}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 hover:bg-black/[0.03]"
                        style={{ borderColor: C.hair, color: C.ink }}
                        aria-label="Back"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                        <h1
                            className="truncate font-extrabold leading-tight tracking-[-0.01em]"
                            style={{ color: C.ink, fontSize: "clamp(19px, 1.8vw, 27px)" }}
                        >
                            {showingSuggestions ? "Did you mean" : LEVEL_LABEL[currentLevel]}
                        </h1>
                        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                            {parent ? `in ${parent.name}` : `${items.length}${hasMore ? "+" : ""} results`}
                        </p>
                    </div>
                </div>
            </div>

            {/* breadcrumbs */}
            {stack.length > 0 && (
                <div className="mt-3 flex min-h-[18px] flex-wrap items-center gap-1 text-[11.5px] font-semibold tracking-wide" style={{ color: C.muted }}>
                    <button onClick={() => goToBreadcrumb(-1)} style={{ color: C.secondary }} className="hover:underline">All Categories</button>
                    {stack.map((crumb, i) => (
                        <span key={crumb.id} className="flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" style={{ color: C.muted, opacity: 0.5 }} />
                            <button
                                onClick={() => goToBreadcrumb(i)}
                                style={{ color: i === stack.length - 1 ? C.ink : C.secondary }}
                                className={i !== stack.length - 1 ? "hover:underline" : ""}
                            >
                                {crumb.name}
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* seller-level hero — mirrors BrandItemSellersPage's product hero */}
            {currentLevel === "seller" && (
                loading && items.length === 0 ? (
                    <SellerHeroSkeleton />
                ) : (
                    <div
                        className="relative mt-3 overflow-hidden rounded-[28px] border p-4 sm:p-5"
                        style={{ borderColor: C.hair, background: `linear-gradient(160deg, ${C.secondary}08 0%, #fff 45%)` }}
                    >
                        <div className="flex gap-4">
                            <StackedImagePreview
                                images={brandHeroImages}
                                name={brandHero?.name}
                                onOpen={(idx) => { setLightboxIndex(idx); setShowLightbox(true); }}
                            />

                            <div className="min-w-0 flex-1">
                                {brandHero?.brand_name && (
                                    <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: C.secondary }}>
                                        {brandHero.brand_name}
                                    </p>
                                )}
                                <h1 className="mt-0.5 font-extrabold leading-tight tracking-[-0.01em]" style={{ color: C.ink, fontSize: "clamp(18px, 1.9vw, 25px)" }}>
                                    {brandHero?.name || "Product"}
                                </h1>

                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <span className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color: C.muted }}>
                                        <Users className="h-3 w-3" /> {items.length}{hasMore ? "+" : ""} seller{items.length === 1 && !hasMore ? "" : "s"}
                                    </span>
                                    {lowestPrice && (
                                        <span className="flex items-baseline gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-extrabold" style={{ background: `${C.primary}12`, color: C.primary }}>
                                            From ₹{lowestPrice.price}{lowestPrice.unit ? `/${lowestPrice.unit}` : ""}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowSellModal(true)}
                                    className="mt-3 hidden items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-white sm:inline-flex"
                                    style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}
                                >
                                    <Plus className="h-3.5 w-3.5" /> I want to sell this
                                </button>
                                <button
                                    onClick={() => setShowSellModal(true)}
                                    className="flex shrink-0 items-center gap-1 rounded-md px-3 py-1 mt-2 text-[12px] font-bold text-white sm:hidden"
                                    style={{ background: `linear-gradient(135deg, ${C.primary} 0%, #c71f11 100%)` }}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Sell this
                                </button>
                            </div>
                        </div>
                    </div>
                )
            )}

            {/* search — same bar shape as MarketplaceSearchBar, always visible here since this IS the search page */}
            <div className="mt-4 hidden lg:block">
                <MarketplaceSearchBar
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={(trimmed) => setQuery(trimmed.trim())}
                />
            </div>

            {/* filter / sort chips */}
            <FilterSortChips />

            {/* shop matches, shown above the hierarchy results at the root level */}
            {showShops && (
                <div className="mt-5">
                    <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: C.ink }}>
                        <Store className="h-4 w-4" style={{ color: C.secondary }} /> Shops matching "{query}"
                    </h3>
                    <div className="mt-2.5 flex flex-col sm:gap-2">
                        {shops.map((shop, i) => <ShopRow key={shop.id} shop={shop} idx={i} isLast={i === shops.length - 1} />)}
                    </div>
                </div>
            )}

            {/* results panel — same rounded card shell as the category grid */}
            <div className="mt-5 overflow-hidden rounded-[24px] border bg-white p-4 sm:p-6" style={{ borderColor: C.hair }}>
                {loading ? (
                    currentLevel === "seller" ? <SellerListSkeleton /> : <TileGridSkeleton />
                ) : error ? (
                    <CatalogLoadError onRetry={retry} />
                ) : items.length === 0 && suggestions.length === 0 && !showShops ? (
                    <EmptyState level={currentLevel} query={query} />
                ) : showingSuggestions ? (
                    <TileGrid>
                        {suggestions.map((s, i) => (
                            <IconTile
                                key={`${s.level}-${s.id ?? i}`}
                                image={s.image}
                                name={s.name}
                                idx={i}
                                sub={s.categoryName || s.subcategoryName || s.genericProductName}
                                onClick={() => selectSuggestion(s)}
                            />
                        ))}
                    </TileGrid>
                ) : currentLevel === "seller" ? (
                    <>
                        <div className="flex flex-col sm:gap-2.5">
                            {items.map((seller, i) => (
                                <SellerRow key={seller.offerId ?? i} seller={seller} idx={i} isLast={i === items.length - 1} onClick={() => handleSelect(seller)} />
                            ))}
                        </div>
                        {hasMore && (
                            <div ref={sentinelRef} className="mt-4 flex justify-center py-4">
                                {loadingMore && <SellerListSkeleton rows={1} />}
                            </div>
                        )}
                    </>
                ) : TILE_LEVELS.has(currentLevel) ? (
                    <>
                        <TileGrid>
                            {items.map((item, i) => (
                                <IconTile
                                    key={item.id ?? i}
                                    image={item.image}
                                    name={item.name}
                                    idx={i}
                                    count={item.subcategoryCount ?? item.productCount ?? item.brandCount ?? item.sellerCount}
                                    sub={currentLevel === "brand_item" ? item.brand_name : null}
                                    onClick={() => handleSelect(item)}
                                />
                            ))}
                        </TileGrid>
                        {hasMore && (
                            <div ref={sentinelRef} className="mt-4 flex justify-center py-4">
                                {loadingMore && <TileGridSkeleton rows={1} />}
                            </div>
                        )}
                    </>
                ) : null}
            </div>
            {showLightbox && brandHeroImages.length > 0 && (
                <ImageLightbox
                    images={brandHeroImages}
                    initialIndex={lightboxIndex}
                    alt={brandHero.name}
                    onClose={() => setShowLightbox(false)}
                />
            )}

            <AnimatePresence>
                {showSellModal && brandHero && (
                    <SellThisItemModal brand={brandHero} onClose={() => setShowSellModal(false)} />
                )}
                {buySeller && <BuyNowModal seller={buySeller} product={brandHero} onClose={() => setBuySeller(null)} />}
            </AnimatePresence>
        </div>
    );
}